/* ================================================================
   PI THINKING — Sync Module v3.1 (fix: quiz results + auto-restore)
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

  function localKey() { return [STORAGE_PREFIX].concat([].slice.call(arguments)).join(':'); }
  function nowIso() { return new Date().toISOString(); }
  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); return value; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function safeMerge(target, source) {
    var output = Object.assign({}, target || {});
    Object.keys(source || {}).forEach(function (key) {
      var src = source[key], tgt = output[key];
      if (src && typeof src === 'object' && !Array.isArray(src) && tgt && typeof tgt === 'object' && !Array.isArray(tgt)) {
        output[key] = safeMerge(tgt, src);
      } else { output[key] = src; }
    });
    return output;
  }

  function sanitizeSessionCode(code) {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  }

  function generateId(prefix) {
    return (prefix || 'pi') + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function countKeys(obj) { return Object.keys(obj || {}).length; }

  function buildLegacyFerramentas(toolStates) {
    var source = toolStates || {}, legacy = {};
    Object.keys(source).forEach(function (toolId) {
      var store = source[toolId] || {}, meta = store.metadados || {};
      if (!meta.concluido) return;
      var dados = safeMerge({}, store.formulario || {});
      dados = safeMerge(dados, store.progresso || {});
      if (store.respostas && countKeys(store.respostas)) dados.respostas = store.respostas;
      legacy[toolId] = {
        dados: dados, respostas: store.respostas || {}, progresso: store.progresso || {},
        formulario: store.formulario || {}, concluido: true,
        atualizadoEm: meta.atualizadoEm || nowIso(), concluidoEm: meta.concluidoEm || meta.atualizadoEm || nowIso()
      };
    });
    return legacy;
  }

  function normalizeQuizSnapshot(entry, prefix) {
    if (!entry) return null;
    var score = entry.pontuacao;
    if (typeof score === 'undefined') score = entry.score;
    score = Number(score || 0);
    return {
      score: score, pontuacao: score,
      percentual: typeof entry.percentual !== 'undefined' ? Number(entry.percentual || 0) : 0,
      codigo: entry.codigo || (prefix ? prefix + '-' + score : ''),
      respostas: entry.respostas || {}, total: entry.total || 0,
      atualizadoEm: entry.atualizadoEm || nowIso()
    };
  }

  function buildLegacyQuizAliases(quiz) {
    var source = quiz || {};
    return {
      diagnostico: normalizeQuizSnapshot(source['quiz-diagnostico'], 'D'),
      final: normalizeQuizSnapshot(source['quiz-final'], 'F')
    };
  }

  function getDefaultControls() {
    return { fases_liberadas: [1], ferramentas_liberadas: [], atualizadoEm: nowIso(), atualizadoPor: 'sistema' };
  }

  function getCurrentSessionData() {
    if (!sessionId) return null;
    return readJson(localKey('session', sessionId), {
      sessionId: sessionId, controls: getDefaultControls(), participants: {}, updatedAt: nowIso()
    });
  }

  function saveCurrentSessionData(payload) {
    if (!sessionId) return null;
    var data = safeMerge(getCurrentSessionData() || {}, payload || {});
    data.sessionId = sessionId;
    data.updatedAt = nowIso();
    writeJson(localKey('session', sessionId), data);
    global.dispatchEvent(new CustomEvent('pi-sync-local-updated', { detail: { sessionId: sessionId, data: data } }));
    return data;
  }

  function emitConnectionState(connected) {
    watchers.connection.forEach(function (cb) { cb(!!connected); });
  }

  function setupFirebaseConnectionWatch() {
    if (!firebaseReady || !db || firebaseSubscriptions.connection) return;
    firebaseSubscriptions.connection = db.ref('.info/connected');
    firebaseSubscriptions.connection.on('value', function (snap) { emitConnectionState(snap.val() === true); });
  }

  /* ── INICIALIZAÇÃO ── */
  function init(config) {
    if (initialized) return Promise.resolve(firebaseReady);
    return new Promise(function (resolve) {
      initialized = true;
      try {
        if (typeof global.firebase === 'undefined' || !config) {
          firebaseReady = false; emitConnectionState(false); resolve(false); return;
        }
        if (!global.firebase.apps.length) { app = global.firebase.initializeApp(config); }
        else { app = global.firebase.app(); }
        db = global.firebase.database(app);
        firebaseReady = true;
        setupFirebaseConnectionWatch();

        // ── FIX: restaurar sessão automaticamente após Firebase pronto ──
        _tryAutoRestore();

        resolve(true);
      } catch (e) {
        console.warn('[PISync] Fallback local ativo.', e);
        firebaseReady = false; emitConnectionState(false); resolve(false);
      }
    });
  }

  /* ── FIX PRINCIPAL: Restauração automática da sessão ──
     Lê os dados salvos no localStorage pelo aluno.html e reconfigura
     o estado interno do PISync sem precisar chamar joinSession() novamente.
     Isso garante que isInSession() retorne true em qualquer página do toolkit.
  ── */

function _tryAutoRestore() {
    if (sessionId) return true;

    var storedSession = sanitizeSessionCode(localStorage.getItem('pi-session-id') || '');
    var storedParticipant = localStorage.getItem('pi-session-participant-id') || '';
    var storedName = localStorage.getItem('pi-participant-name') || '';
    var storedPercurso = localStorage.getItem('pi-percurso') || '';

    if (!storedSession || !storedParticipant) return false;

    sessionId = storedSession;
    participantId = storedParticipant;
    participantName = storedName;
    participantPercurso = storedPercurso;

    if (firebaseReady && db) _bindFirebaseListeners();
    return true;
}


  function _bindFirebaseListeners() {
    if (!firebaseReady || !db || !sessionId) return;

    // Listener de controles (facilitador → alunos)
    if (!firebaseSubscriptions.controls) {
      firebaseSubscriptions.controls = db.ref('oficinas/' + sessionId + '/controls');
      firebaseSubscriptions.controls.on('value', function (snap) {
        var value = snap.val() || getDefaultControls();
        saveCurrentSessionData({ controls: value });
        notifyControlsWatchers();
        // Propaga para o AlunoEngine se existir
        global.dispatchEvent(new CustomEvent('pi-controls-updated', { detail: value }));
      });
    }

    // Listener de participantes (para dashboard)
    if (!firebaseSubscriptions.participants) {
      firebaseSubscriptions.participants = db.ref('oficinas/' + sessionId + '/participantes');
      firebaseSubscriptions.participants.on('value', function (snap) {
        saveCurrentSessionData({ participants: snap.val() || {} });
        notifyParticipantsWatchers();
      });
    }
  }

  function initFromWindow() {
    if (typeof global.getPIFirebaseConfig === 'function') return init(global.getPIFirebaseConfig());
    return init(global.FIREBASE_CONFIG || global.PI_FIREBASE_CONFIG || null);
  }

  function isOnline() { return !!firebaseReady; }

  function onConnectionChange(callback) {
    if (typeof callback === 'function') watchers.connection.push(callback);
    callback(isOnline());
    return function () { watchers.connection = watchers.connection.filter(function (fn) { return fn !== callback; }); };
  }


function setParticipantIdentity(name, percurso) {
    participantName = String(name || participantName || '').trim();
    participantPercurso = String(percurso || participantPercurso || '').trim();

    // ── FIX: gera sempre um novo ID por login, sem reutilizar do dispositivo ──
    // O ID antigo (pi-participant-id) era permanente no dispositivo.
    // Agora usamos pi-session-participant-id que é limpo a cada novo joinSession.
    var storedId = localStorage.getItem('pi-session-participant-id');
    participantId = storedId || generateId('participant');

    localStorage.setItem('pi-session-participant-id', participantId);
    localStorage.setItem('pi-participant-name', participantName);
    localStorage.setItem('pi-percurso', participantPercurso);
}


  function joinSession(code, name, percurso, extra) {
    sessionId = sanitizeSessionCode(code);
    if (!sessionId) throw new Error('Código da oficina inválido.');
    setParticipantIdentity(name, percurso || '3h');
    localStorage.setItem('pi-session-id', sessionId);

    var payload = {
      id: participantId, nome: participantName, percurso: participantPercurso,
      status: 'ativo', entrouEm: nowIso(), ultimoAcessoEm: nowIso(),
      progresso: 0, totalConcluidas: 0, ferramentaAtual: '',
      quiz: {}, toolStates: {}, extras: extra || {}
    };
    upsertParticipant(payload);
    ensureControlsExists();

    // ── FIX: vincular listeners do Firebase logo após entrar ──
    if (firebaseReady && db) _bindFirebaseListeners();

    notifyControlsWatchers();
    notifyParticipantsWatchers();
    return { sessionId: sessionId, participantId: participantId, participantName: participantName, percurso: participantPercurso };
  }

  function restoreSession() {
    var ok = _tryAutoRestore();
    if (!ok) return false;
    ensureControlsExists();
    touchParticipant();
    if (firebaseReady && db) _bindFirebaseListeners();
    notifyControlsWatchers();
    notifyParticipantsWatchers();
    return true;
  }


function leaveSession() {
    if (!sessionId || !participantId) return false;
    upsertParticipant({ status: 'desconectado', saiuEm: nowIso(), ultimoAcessoEm: nowIso() });
    localStorage.removeItem('pi-session-id');
    localStorage.removeItem('pi-session-participant-id');  // ← usa nova chave
    sessionId = '';
    participantId = '';
    return true;
}
  

  function isInSession() { return !!sessionId; }

  function getSessionMeta() {
    // ── FIX: tentar auto-restore antes de reportar estado ──
    if (!sessionId) _tryAutoRestore();
    return {
      sessionId: sessionId, participantId: participantId,
      participantName: participantName, percurso: participantPercurso,
      online: isOnline()
    };
  }

  /* ── Alias para compatibilidade com dashboard.html ── */
  function getSessionInfo() { return getSessionMeta(); }

  function ensureControlsExists() {
    var data = getCurrentSessionData();
    if (!data) return null;
    if (!data.controls) saveCurrentSessionData({ controls: getDefaultControls() });
    return getControls();
  }

  function getControls() {
    var data = getCurrentSessionData();
    return data && data.controls ? data.controls : getDefaultControls();
  }

  function setControls(controls) {
    var next = safeMerge(getDefaultControls(), controls || {});
    next.atualizadoEm = nowIso();
    next.atualizadoPor = participantId || 'facilitador';
    saveCurrentSessionData({ controls: next });
    notifyControlsWatchers();
    if (firebaseReady && db && sessionId) db.ref('oficinas/' + sessionId + '/controls').set(next);
    return next;
  }

  function setReleasedPhases(phases) {
    return setControls({ fases_liberadas: Array.isArray(phases) ? phases.slice() : [1] });
  }

  function setReleasedTools(toolIds) {
    return setControls({ ferramentas_liberadas: Array.isArray(toolIds) ? toolIds.slice() : [] });
  }

  function notifyControlsWatchers() {
    var controls = getControls();
    watchers.controls.forEach(function (cb) { cb(clone(controls)); });
  }

  function notifyParticipantsWatchers() {
    var participants = getParticipants();
    watchers.participants.forEach(function (cb) { cb(clone(participants)); });
  }

  function watchControls(callback) {
    if (typeof callback !== 'function') return function () {};
    watchers.controls.push(callback);
    callback(clone(getControls()));
    if (firebaseReady && db && sessionId) {
      // reusar listener existente ou criar novo
      if (!firebaseSubscriptions.controls) {
        firebaseSubscriptions.controls = db.ref('oficinas/' + sessionId + '/controls');
        firebaseSubscriptions.controls.on('value', function (snap) {
          var value = snap.val() || getDefaultControls();
          saveCurrentSessionData({ controls: value });
          notifyControlsWatchers();
          global.dispatchEvent(new CustomEvent('pi-controls-updated', { detail: value }));
        });
      }
    }
    return function () { watchers.controls = watchers.controls.filter(function (fn) { return fn !== callback; }); };
  }

  function stopWatchingControls() {
    watchers.controls = [];
    if (firebaseSubscriptions.controls) { firebaseSubscriptions.controls.off(); firebaseSubscriptions.controls = null; }
  }

  function getParticipants() {
    var data = getCurrentSessionData();
    return data && data.participants ? data.participants : {};
  }

  function listParticipants() {
    var participants = getParticipants();
    return Object.keys(participants).map(function (id) { return safeMerge({ id: id }, participants[id]); });
  }

  function upsertParticipant(patch) {
    if (!sessionId || !participantId) return null;
    var data = getCurrentSessionData() || saveCurrentSessionData({});
    var current = (data.participants && data.participants[participantId]) || {};
    var next = safeMerge(current, patch || {});
    next.id = participantId;
    next.nome = next.nome || participantName;
    next.percurso = next.percurso || participantPercurso;
    next.ultimoAcessoEm = nowIso();
    next.toolStates = safeMerge({}, next.toolStates || {});
    next.quiz = safeMerge({}, next.quiz || {});
    next.ferramentas = buildLegacyFerramentas(next.toolStates);
    var aliases = buildLegacyQuizAliases(next.quiz);
    next.diagnostico = aliases.diagnostico;
    next.final = aliases.final;
    data.participants = data.participants || {};
    data.participants[participantId] = next;
    saveCurrentSessionData({ participants: data.participants });
    if (firebaseReady && db) {
      db.ref('oficinas/' + sessionId + '/participantes/' + participantId).update(next);
    }
    return next;
  }

  function touchParticipant() {
    if (!sessionId || !participantId) return null;
    return upsertParticipant({ status: 'ativo', ultimoAcessoEm: nowIso() });
  }

  function watchParticipants(callback) {
    if (typeof callback !== 'function') return function () {};
    watchers.participants.push(callback);
    callback(clone(getParticipants()));
    if (firebaseReady && db && sessionId && !firebaseSubscriptions.participants) {
      firebaseSubscriptions.participants = db.ref('oficinas/' + sessionId + '/participantes');
      firebaseSubscriptions.participants.on('value', function (snap) {
        saveCurrentSessionData({ participants: snap.val() || {} });
        notifyParticipantsWatchers();
      });
    }
    return function () { watchers.participants = watchers.participants.filter(function (fn) { return fn !== callback; }); };
  }

  function stopWatchingParticipants() {
    watchers.participants = [];
    if (firebaseSubscriptions.participants) { firebaseSubscriptions.participants.off(); firebaseSubscriptions.participants = null; }
  }

  function computeProgressFromToolStates(toolStates) {
    var keys = Object.keys(toolStates || {});
    if (!keys.length) return { totalConcluidas: 0, progresso: 0 };
    var concluidas = keys.filter(function (k) {
      return !!(toolStates[k] && toolStates[k].metadados && toolStates[k].metadados.concluido);
    }).length;
    return { totalConcluidas: concluidas, progresso: concluidas > 0 ? concluidas : 0 };
  }

  function sendToolState(toolId, state) {
    var id = String(toolId || '').trim();
    if (!id) return null;

    // ── FIX: garantir que a sessão está restaurada antes de enviar ──
    if (!sessionId) _tryAutoRestore();
    if (!sessionId || !participantId) return null;

    var current = getParticipants()[participantId] || {};
    var toolStates = safeMerge(current.toolStates || {}, {});
    toolStates[id] = state;
    var progressSummary = computeProgressFromToolStates(toolStates);
    return upsertParticipant({
      ferramentaAtual: id, toolStates: toolStates,
      totalConcluidas: progressSummary.totalConcluidas, progresso: progressSummary.progresso
    });
  }

  function sendToolReset(toolId) {
    if (!sessionId && !_tryAutoRestore()) return null;
    if (!sessionId || !participantId) return null;
    var current = getParticipants()[participantId] || {};
    var toolStates = safeMerge(current.toolStates || {}, {});
    delete toolStates[String(toolId || '').trim()];
    var progressSummary = computeProgressFromToolStates(toolStates);
    return upsertParticipant({ toolStates: toolStates, totalConcluidas: progressSummary.totalConcluidas, progresso: progressSummary.progresso });
  }

  function updateParticipantProgress(payload) {
    if (!sessionId && !_tryAutoRestore()) return null;
    if (!sessionId || !participantId) return null;
    return upsertParticipant(payload || {});
  }

  /* ── FIX PRINCIPAL: saveQuizResult com auto-restore e fallback Firebase direto ── */
  function saveQuizResult(quizId, result) {
    // Tenta restaurar sessão silenciosamente se não estiver ativa
    if (!sessionId) _tryAutoRestore();

    // Fallback: mesmo sem PISync ativo, salva localmente e tenta Firebase direto
    var resultWithTimestamp = safeMerge({}, result || {}, { atualizadoEm: nowIso() });

    // Salva localmente no namespace do participante
    if (sessionId && participantId) {
      var current = getParticipants()[participantId] || {};
      var quiz = safeMerge(current.quiz || {}, {});
      quiz[quizId] = safeMerge(quiz[quizId] || {}, resultWithTimestamp);

      var updated = upsertParticipant({ quiz: quiz });

      // ── FIX: Forçar escrita direta no Firebase para o campo quiz ──
      // O upsertParticipant usa .update() que não garante profundidade do quiz.
      // Adicionamos um set() específico no caminho quiz/{quizId} para garantir.
      if (firebaseReady && db && sessionId && participantId) {
        db.ref('oficinas/' + sessionId + '/participantes/' + participantId + '/quiz/' + quizId)
          .set(resultWithTimestamp)
          .catch(function (err) { console.warn('[PISync] Falha ao salvar quiz no Firebase:', err); });

        // Atualiza também os aliases de nível superior (diagnostico / final)
        var aliasKey = quizId === 'quiz-diagnostico' ? 'diagnostico' : quizId === 'quiz-final' ? 'final' : null;
        if (aliasKey) {
          db.ref('oficinas/' + sessionId + '/participantes/' + participantId + '/' + aliasKey)
            .set(normalizeQuizSnapshot(resultWithTimestamp, aliasKey === 'diagnostico' ? 'D' : 'F'))
            .catch(function (err) { console.warn('[PISync] Falha ao salvar alias quiz:', err); });
        }
      }

      return updated;
    }

    // Sem sessão: salva apenas no localStorage para eventual sync posterior
    var offlineKey = localKey('offline-quiz', quizId);
    writeJson(offlineKey, resultWithTimestamp);
    return null;
  }

  function calculateEvolution(participant) {
    var quiz = (participant && participant.quiz) || {};
    var diagnostico = Number(quiz['quiz-diagnostico'] && quiz['quiz-diagnostico'].pontuacao) || 0;
    var final = Number(quiz['quiz-final'] && quiz['quiz-final'].pontuacao) || 0;
    return final - diagnostico;
  }

  function buildRanking(options) {
    var opts = options || {}, quizId = opts.quizId || '', evolution = !!opts.evolution;
    return listParticipants()
      .map(function (participant) {
        var quiz = participant.quiz || {};
        var value = evolution ? calculateEvolution(participant) : Number(quiz[quizId] && quiz[quizId].pontuacao) || 0;
        return {
          id: participant.id, nome: participant.nome || 'Participante',
          percurso: participant.percurso || '', status: participant.status || 'ativo',
          pontuacao: value, percentual: quiz[quizId] && quiz[quizId].percentual,
          totalConcluidas: participant.totalConcluidas || 0, evolucao: calculateEvolution(participant)
        };
      })
      .sort(function (a, b) {
        if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;
        return (b.totalConcluidas || 0) - (a.totalConcluidas || 0);
      })
      .map(function (item, index) { item.posicao = index + 1; return item; });
  }

  function watchRanking(options, callback) {
    if (typeof callback !== 'function') return function () {};
    var job = { options: options || {}, callback: callback };
    watchers.ranking.push(job);
    callback(buildRanking(job.options));
    var stopParticipants = watchParticipants(function () { callback(buildRanking(job.options)); });
    return function () {
      stopParticipants();
      watchers.ranking = watchers.ranking.filter(function (e) { return e !== job; });
    };
  }

  function getLocalCompletions() { return readJson('pi-thinking:completed-index', {}); }

  /* ── Boot automático: tenta restaurar sessão assim que o módulo carrega ── */
  (function autoBootRestore() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { _tryAutoRestore(); });
    } else {
      _tryAutoRestore();
    }
  })();

  var api = {
    version: '3.1.0',
    init: init,
    initFromWindow: initFromWindow,
    isOnline: isOnline,
    onConnectionChange: onConnectionChange,
    joinSession: joinSession,
    restoreSession: restoreSession,
    leaveSession: leaveSession,
    isInSession: isInSession,
    getSessionMeta: getSessionMeta,
    getSessionInfo: getSessionInfo,       // alias para dashboard.html
    getControls: getControls,
    setControls: setControls,
    setReleasedPhases: setReleasedPhases,
    setReleasedTools: setReleasedTools,
    watchControls: watchControls,
    stopWatchingControls: stopWatchingControls,
    getParticipants: getParticipants,
    listParticipants: listParticipants,
    watchParticipants: watchParticipants,
    stopWatchingParticipants: stopWatchingParticipants,
    updateParticipantProgress: updateParticipantProgress,
    sendToolState: sendToolState,
    sendToolReset: sendToolReset,
    saveQuizResult: saveQuizResult,
    buildRanking: buildRanking,
    watchRanking: watchRanking,
    getLocalCompletions: getLocalCompletions,
    calculateEvolution: calculateEvolution
  };

  global.PISync = api;

})(window);
