/* ================================================================
   PI THINKING — Sync Module v3.2
   Correções: auto-restore, getSessionInfo alias, saveQuizResult robusto,
   leaveSession limpa pi-session-participant-id
   ================================================================ */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'pi-sync';
  var initialized = false;
  var firebaseReady = false;
  var db = null;
  var app = null;
  var sessionId = '';
  var participantId = '';
  var participantName = '';
  var participantPercurso = '';
  var watchers = { controls: [], participants: [], ranking: [], connection: [] };
  var firebaseSubscriptions = { controls: null, participants: null, connection: null };

  function localKey() {
    return [STORAGE_PREFIX].concat([].slice.call(arguments)).join(':');
  }
  function nowIso() { return new Date().toISOString(); }
  function readJson(key, fallback) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); return value; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function safeMerge(target, source) {
    var out = Object.assign({}, target || {});
    Object.keys(source || {}).forEach(function (k) {
      var s = source[k], t = out[k];
      if (s && typeof s === 'object' && !Array.isArray(s) &&
          t && typeof t === 'object' && !Array.isArray(t)) {
        out[k] = safeMerge(t, s);
      } else { out[k] = s; }
    });
    return out;
  }

  function sanitizeCode(code) {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  }
  function generateId(prefix) {
    return (prefix || 'pi') + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function countKeys(obj) { return Object.keys(obj || {}).length; }

  /* ── helpers de normalização de dados ── */
  function buildLegacyFerramentas(toolStates) {
    var src = toolStates || {}, out = {};
    Object.keys(src).forEach(function (id) {
      var s = src[id] || {}, m = s.metadados || {};
      if (!m.concluido) return;
      var d = safeMerge({}, s.formulario || {});
      d = safeMerge(d, s.progresso || {});
      if (s.respostas && countKeys(s.respostas)) d.respostas = s.respostas;
      out[id] = {
        dados: d, respostas: s.respostas || {}, progresso: s.progresso || {},
        formulario: s.formulario || {}, concluido: true,
        atualizadoEm: m.atualizadoEm || nowIso(),
        concluidoEm: m.concluidoEm || m.atualizadoEm || nowIso()
      };
    });
    return out;
  }

  function normalizeQuizSnap(entry, prefix) {
    if (!entry) return null;
    var score = entry.pontuacao !== undefined ? entry.pontuacao : entry.score;
    score = Number(score || 0);
    return {
      score: score, pontuacao: score,
      percentual: Number(entry.percentual || 0),
      codigo: entry.codigo || (prefix ? prefix + '-' + score : ''),
      respostas: entry.respostas || {},
      total: entry.total || 0,
      atualizadoEm: entry.atualizadoEm || nowIso()
    };
  }

  function buildQuizAliases(quiz) {
    var q = quiz || {};
    return {
      diagnostico: normalizeQuizSnap(q['quiz-diagnostico'], 'D'),
      final: normalizeQuizSnap(q['quiz-final'], 'F')
    };
  }

  function defaultControls() {
    return { fases_liberadas: [1], ferramentas_liberadas: [], atualizadoEm: nowIso(), atualizadoPor: 'sistema' };
  }

  /* ── armazenamento local da sessão ── */
  function getSessionData() {
    if (!sessionId) return null;
    return readJson(localKey('session', sessionId), {
      sessionId: sessionId, controls: defaultControls(), participants: {}, updatedAt: nowIso()
    });
  }

  function saveSessionData(patch) {
    if (!sessionId) return null;
    var data = safeMerge(getSessionData() || {}, patch || {});
    data.sessionId = sessionId;
    data.updatedAt = nowIso();
    writeJson(localKey('session', sessionId), data);
    global.dispatchEvent(new CustomEvent('pi-sync-local-updated', { detail: { sessionId: sessionId, data: data } }));
    return data;
  }

  /* ── Firebase ── */
  function emitConnection(connected) {
    watchers.connection.forEach(function (cb) { cb(!!connected); });
  }

  function setupConnectionWatch() {
    if (!firebaseReady || !db || firebaseSubscriptions.connection) return;
    firebaseSubscriptions.connection = db.ref('.info/connected');
    firebaseSubscriptions.connection.on('value', function (s) { emitConnection(s.val() === true); });
  }

  function bindFirebaseListeners() {
    if (!firebaseReady || !db || !sessionId) return;

    if (!firebaseSubscriptions.controls) {
      firebaseSubscriptions.controls = db.ref('oficinas/' + sessionId + '/controls');
      firebaseSubscriptions.controls.on('value', function (s) {
        var v = s.val() || defaultControls();
        saveSessionData({ controls: v });
        notifyControls();
        global.dispatchEvent(new CustomEvent('pi-controls-updated', { detail: v }));
      });
    }

    if (!firebaseSubscriptions.participants) {
      firebaseSubscriptions.participants = db.ref('oficinas/' + sessionId + '/participantes');
      firebaseSubscriptions.participants.on('value', function (s) {
        saveSessionData({ participants: s.val() || {} });
        notifyParticipants();
      });
    }
  }

  /* ── restore automático ── */
  function tryAutoRestore() {
    if (sessionId) return true;
    var sid = sanitizeCode(localStorage.getItem('pi-session-id') || '');
    var pid = localStorage.getItem('pi-session-participant-id') || '';
    var name = localStorage.getItem('pi-participant-name') || '';
    var perc = localStorage.getItem('pi-percurso') || '';
    if (!sid || !pid) return false;
    sessionId = sid;
    participantId = pid;
    participantName = name;
    participantPercurso = perc;
    if (firebaseReady && db) bindFirebaseListeners();
    return true;
  }

  /* ── init ── */
  function init(config) {
    if (initialized) return Promise.resolve(firebaseReady);
    return new Promise(function (resolve) {
      initialized = true;
      try {
        if (typeof global.firebase === 'undefined' || !config) {
          firebaseReady = false; emitConnection(false); resolve(false); return;
        }
        if (!global.firebase.apps.length) { app = global.firebase.initializeApp(config); }
        else { app = global.firebase.app(); }
        db = global.firebase.database(app);
        firebaseReady = true;
        setupConnectionWatch();
        tryAutoRestore();
        resolve(true);
      } catch (e) {
        console.warn('[PISync] Fallback local ativo.', e);
        firebaseReady = false; emitConnection(false); resolve(false);
      }
    });
  }

  function initFromWindow() {
    if (typeof global.getPIFirebaseConfig === 'function') return init(global.getPIFirebaseConfig());
    return init(global.FIREBASE_CONFIG || global.PI_FIREBASE_CONFIG || null);
  }

  function isOnline() { return !!firebaseReady; }

  function onConnectionChange(cb) {
    if (typeof cb === 'function') watchers.connection.push(cb);
    cb(isOnline());
    return function () { watchers.connection = watchers.connection.filter(function (f) { return f !== cb; }); };
  }

  /* ── identidade ── */
  function setIdentity(name, percurso) {
    participantName = String(name || participantName || '').trim();
    participantPercurso = String(percurso || participantPercurso || '').trim();
    // Gera novo ID por login — não reutiliza ID antigo do dispositivo
    participantId = generateId('participant');
    localStorage.setItem('pi-session-participant-id', participantId);
    localStorage.setItem('pi-participant-name', participantName);
    localStorage.setItem('pi-percurso', participantPercurso);
  }

  /* ── sessão ── */
  function joinSession(code, name, percurso, extra) {
    sessionId = sanitizeCode(code);
    if (!sessionId) throw new Error('Código da oficina inválido.');

    /* ── FIX: reset de listeners do Firebase ao trocar de sessão/aluno ──
       Sem isso, o segundo aluno reutiliza os listeners do primeiro */
    if (firebaseSubscriptions.participants) {
      firebaseSubscriptions.participants.off();
      firebaseSubscriptions.participants = null;
    }
    if (firebaseSubscriptions.controls) {
      firebaseSubscriptions.controls.off();
      firebaseSubscriptions.controls = null;
    }

    setIdentity(name, percurso || '3h');
    localStorage.setItem('pi-session-id', sessionId);

    var payload = {
      id: participantId, nome: participantName, percurso: participantPercurso,
      status: 'ativo', entrouEm: nowIso(), ultimoAcessoEm: nowIso(),
      progresso: 0, totalConcluidas: 0, ferramentaAtual: '',
      quiz: {}, toolStates: {}, extras: extra || {}
    };
    upsertParticipant(payload);
    ensureControls();
    if (firebaseReady && db) bindFirebaseListeners();
    notifyControls();
    notifyParticipants();
    return { sessionId: sessionId, participantId: participantId, participantName: participantName, percurso: participantPercurso };
  }

  function restoreSession() {
    if (!tryAutoRestore()) return false;
    ensureControls();
    touchParticipant();
    if (firebaseReady && db) bindFirebaseListeners();
    notifyControls();
    notifyParticipants();
    return true;
  }

  function leaveSession() {
    if (!sessionId || !participantId) return false;
    upsertParticipant({ status: 'desconectado', saiuEm: nowIso(), ultimoAcessoEm: nowIso() });
    localStorage.removeItem('pi-session-id');
    localStorage.removeItem('pi-session-participant-id');
    sessionId = '';
    participantId = '';
    participantName = '';
    participantPercurso = '';
    return true;
  }

  function isInSession() {
    if (!sessionId) tryAutoRestore();
    return !!sessionId;
  }

  /* ── getSessionMeta + alias getSessionInfo ── */
  function getSessionMeta() {
    if (!sessionId) tryAutoRestore();
    return {
      sessionId: sessionId || '',
      participantId: participantId || '',
      participantName: participantName || localStorage.getItem('pi-participant-name') || '',
      percurso: participantPercurso || localStorage.getItem('pi-percurso') || '',
      online: isOnline()
    };
  }
  var getSessionInfo = getSessionMeta; // alias explícito

  /* ── controles ── */
  function ensureControls() {
    var data = getSessionData();
    if (!data) return null;
    if (!data.controls) saveSessionData({ controls: defaultControls() });
    return getControls();
  }

  function getControls() {
    var data = getSessionData();
    return data && data.controls ? data.controls : defaultControls();
  }

  function setControls(controls) {
    var next = safeMerge(defaultControls(), controls || {});
    next.atualizadoEm = nowIso();
    next.atualizadoPor = participantId || 'facilitador';
    saveSessionData({ controls: next });
    notifyControls();
    if (firebaseReady && db && sessionId) db.ref('oficinas/' + sessionId + '/controls').set(next);
    return next;
  }

  function setReleasedPhases(phases) {
    return setControls({ fases_liberadas: Array.isArray(phases) ? phases.slice() : [1] });
  }
  function setReleasedTools(toolIds) {
    return setControls({ ferramentas_liberadas: Array.isArray(toolIds) ? toolIds.slice() : [] });
  }

  function notifyControls() {
    var c = getControls();
    watchers.controls.forEach(function (cb) { cb(clone(c)); });
  }
  function notifyParticipants() {
    var p = getParticipants();
    watchers.participants.forEach(function (cb) { cb(clone(p)); });
  }

  function watchControls(cb) {
    if (typeof cb !== 'function') return function () {};
    watchers.controls.push(cb);
    cb(clone(getControls()));
    if (firebaseReady && db && sessionId && !firebaseSubscriptions.controls) {
      firebaseSubscriptions.controls = db.ref('oficinas/' + sessionId + '/controls');
      firebaseSubscriptions.controls.on('value', function (s) {
        var v = s.val() || defaultControls();
        saveSessionData({ controls: v });
        notifyControls();
        global.dispatchEvent(new CustomEvent('pi-controls-updated', { detail: v }));
      });
    }
    return function () { watchers.controls = watchers.controls.filter(function (f) { return f !== cb; }); };
  }

  function stopWatchingControls() {
    watchers.controls = [];
    if (firebaseSubscriptions.controls) { firebaseSubscriptions.controls.off(); firebaseSubscriptions.controls = null; }
  }

  /* ── participantes ── */
  function getParticipants() {
    var data = getSessionData();
    return data && data.participants ? data.participants : {};
  }
  function listParticipants() {
    var p = getParticipants();
    return Object.keys(p).map(function (id) { return safeMerge({ id: id }, p[id]); });
  }

  function upsertParticipant(patch) {
    if (!sessionId || !participantId) return null;
    var data = getSessionData() || saveSessionData({});
    var current = (data.participants && data.participants[participantId]) || {};
    var next = safeMerge(current, patch || {});
    next.id = participantId;
    next.nome = next.nome || participantName;
    next.percurso = next.percurso || participantPercurso;
    next.ultimoAcessoEm = nowIso();
    next.toolStates = safeMerge({}, next.toolStates || {});
    next.quiz = safeMerge({}, next.quiz || {});
    next.ferramentas = buildLegacyFerramentas(next.toolStates);
    var aliases = buildQuizAliases(next.quiz);
    next.diagnostico = aliases.diagnostico;
    next.final = aliases.final;
    data.participants = data.participants || {};
    data.participants[participantId] = next;
    saveSessionData({ participants: data.participants });
    if (firebaseReady && db) {
      db.ref('oficinas/' + sessionId + '/participantes/' + participantId).update(next);
    }
    return next;
  }

  function touchParticipant() {
    if (!sessionId || !participantId) return null;
    return upsertParticipant({ status: 'ativo', ultimoAcessoEm: nowIso() });
  }

  function watchParticipants(cb) {
    if (typeof cb !== 'function') return function () {};
    watchers.participants.push(cb);
    cb(clone(getParticipants()));
    if (firebaseReady && db && sessionId && !firebaseSubscriptions.participants) {
      firebaseSubscriptions.participants = db.ref('oficinas/' + sessionId + '/participantes');
      firebaseSubscriptions.participants.on('value', function (s) {
        saveSessionData({ participants: s.val() || {} });
        notifyParticipants();
      });
    }
    return function () { watchers.participants = watchers.participants.filter(function (f) { return f !== cb; }); };
  }

  function stopWatchingParticipants() {
    watchers.participants = [];
    if (firebaseSubscriptions.participants) { firebaseSubscriptions.participants.off(); firebaseSubscriptions.participants = null; }
  }

  /* ── progresso e ferramentas ── */
  function computeProgress(toolStates) {
    var keys = Object.keys(toolStates || {});
    if (!keys.length) return { totalConcluidas: 0, progresso: 0 };
    var c = keys.filter(function (k) {
      return !!(toolStates[k] && toolStates[k].metadados && toolStates[k].metadados.concluido);
    }).length;
    return { totalConcluidas: c, progresso: c };
  }

  function sendToolState(toolId, state) {
    var id = String(toolId || '').trim();
    if (!id) return null;
    if (!sessionId) tryAutoRestore();
    if (!sessionId || !participantId) return null;
    var current = getParticipants()[participantId] || {};
    var toolStates = safeMerge(current.toolStates || {}, {});
    toolStates[id] = state;
    var p = computeProgress(toolStates);
    return upsertParticipant({ ferramentaAtual: id, toolStates: toolStates, totalConcluidas: p.totalConcluidas, progresso: p.progresso });
  }

  function sendToolReset(toolId) {
    if (!sessionId && !tryAutoRestore()) return null;
    if (!sessionId || !participantId) return null;
    var current = getParticipants()[participantId] || {};
    var toolStates = safeMerge(current.toolStates || {}, {});
    delete toolStates[String(toolId || '').trim()];
    var p = computeProgress(toolStates);
    return upsertParticipant({ toolStates: toolStates, totalConcluidas: p.totalConcluidas, progresso: p.progresso });
  }

  function updateParticipantProgress(payload) {
    if (!sessionId && !tryAutoRestore()) return null;
    if (!sessionId || !participantId) return null;
    return upsertParticipant(payload || {});
  }

  /* ── saveQuizResult — escrita direta e robusta no Firebase ── */
  function saveQuizResult(quizId, result) {
    if (!sessionId) tryAutoRestore();
    var r = safeMerge({}, result || {}, { atualizadoEm: nowIso() });

    if (sessionId && participantId) {
      var current = getParticipants()[participantId] || {};
      var quiz = safeMerge(current.quiz || {}, {});
      quiz[quizId] = safeMerge(quiz[quizId] || {}, r);
      var updated = upsertParticipant({ quiz: quiz });

      if (firebaseReady && db) {
        // Escrita direta no path do quiz para garantir chegada ao dashboard
        db.ref('oficinas/' + sessionId + '/participantes/' + participantId + '/quiz/' + quizId)
          .set(r)
          .catch(function (e) { console.warn('[PISync] Falha ao salvar quiz:', e); });

        // Aliases de nível superior (diagnostico / final)
        var alias = quizId === 'quiz-diagnostico' ? 'diagnostico' : quizId === 'quiz-final' ? 'final' : null;
        if (alias) {
          var normalized = normalizeQuizSnap(r, alias === 'diagnostico' ? 'D' : 'F');
          db.ref('oficinas/' + sessionId + '/participantes/' + participantId + '/' + alias)
            .set(normalized)
            .catch(function (e) { console.warn('[PISync] Falha ao salvar alias quiz:', e); });
        }
      }
      return updated;
    }

    // Sem sessão — guarda offline para sync posterior
    writeJson(localKey('offline-quiz', quizId), r);
    return null;
  }

  function calculateEvolution(p) {
    var q = (p && p.quiz) || {};
    return (Number(q['quiz-final'] && q['quiz-final'].pontuacao) || 0) -
           (Number(q['quiz-diagnostico'] && q['quiz-diagnostico'].pontuacao) || 0);
  }

  function buildRanking(options) {
    var opts = options || {};
    return listParticipants()
      .map(function (p) {
        var q = p.quiz || {};
        var v = opts.evolution ? calculateEvolution(p) : Number(q[opts.quizId] && q[opts.quizId].pontuacao) || 0;
        return {
          id: p.id, nome: p.nome || 'Participante', percurso: p.percurso || '',
          status: p.status || 'ativo', pontuacao: v,
          percentual: q[opts.quizId] && q[opts.quizId].percentual,
          totalConcluidas: p.totalConcluidas || 0, evolucao: calculateEvolution(p)
        };
      })
      .sort(function (a, b) {
        if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;
        return (b.totalConcluidas || 0) - (a.totalConcluidas || 0);
      })
      .map(function (item, i) { item.posicao = i + 1; return item; });
  }

  function watchRanking(options, cb) {
    if (typeof cb !== 'function') return function () {};
    var job = { options: options || {}, callback: cb };
    watchers.ranking.push(job);
    cb(buildRanking(job.options));
    var stop = watchParticipants(function () { cb(buildRanking(job.options)); });
    return function () { stop(); watchers.ranking = watchers.ranking.filter(function (e) { return e !== job; }); };
  }

  function getLocalCompletions() {
    /* ── FIX: usa a mesma chave com participant-id que o tool-bridge ──
       Evita contaminar loadCompletions do aluno-engine com dados de outros alunos */
    var pid = localStorage.getItem('pi-session-participant-id') || 'anon';
    return readJson('pi-thinking:completed-index:' + pid, {});
  }

  /* ── boot automático ── */
  (function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryAutoRestore);
    } else {
      tryAutoRestore();
    }
  })();

  global.PISync = {
    version: '3.2.0',
    init: init, initFromWindow: initFromWindow,
    isOnline: isOnline, onConnectionChange: onConnectionChange,
    joinSession: joinSession, restoreSession: restoreSession,
    leaveSession: leaveSession, isInSession: isInSession,
    getSessionMeta: getSessionMeta, getSessionInfo: getSessionInfo,
    getControls: getControls, setControls: setControls,
    setReleasedPhases: setReleasedPhases, setReleasedTools: setReleasedTools,
    watchControls: watchControls, stopWatchingControls: stopWatchingControls,
    getParticipants: getParticipants, listParticipants: listParticipants,
    watchParticipants: watchParticipants, stopWatchingParticipants: stopWatchingParticipants,
    updateParticipantProgress: updateParticipantProgress,
    sendToolState: sendToolState, sendToolReset: sendToolReset,
    saveQuizResult: saveQuizResult, buildRanking: buildRanking,
    watchRanking: watchRanking, getLocalCompletions: getLocalCompletions,
    calculateEvolution: calculateEvolution
  };

})(window);
