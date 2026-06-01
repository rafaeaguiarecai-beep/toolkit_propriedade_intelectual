/* ================================================================
   PI THINKING — Sync Module
   ================================================================
   Camada de sincronização para o modo oficina.
   - Funciona com Firebase Realtime Database quando disponível
   - Mantém fallback local para testes e operação degradada
   - Expõe ranking, progresso, controles do facilitador e estado do aluno
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

    var watchers = {
        controls: [],
        participants: [],
        ranking: [],
        connection: []
    };

    var firebaseSubscriptions = {
        controls: null,
        participants: null,
        connection: null
    };

    function localKey() {
        return [STORAGE_PREFIX].concat([].slice.call(arguments)).join(':');
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return value;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function safeMerge(target, source) {
        var output = Object.assign({}, target || {});
        Object.keys(source || {}).forEach(function (key) {
            var src = source[key];
            var tgt = output[key];
            if (src && typeof src === 'object' && !Array.isArray(src) && tgt && typeof tgt === 'object' && !Array.isArray(tgt)) {
                output[key] = safeMerge(tgt, src);
            } else {
                output[key] = src;
            }
        });
        return output;
    }

    function sanitizeSessionCode(code) {
        return String(code || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9\-]/g, '');
    }

    function generateId(prefix) {
        return (prefix || 'pi') + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    }


    function countKeys(obj) {
        return Object.keys(obj || {}).length;
    }

    function buildLegacyFerramentas(toolStates) {
        var source = toolStates || {};
        var legacy = {};
        Object.keys(source).forEach(function (toolId) {
            var store = source[toolId] || {};
            var meta = store.metadados || {};
            if (!meta.concluido) return;

            var dados = safeMerge({}, store.formulario || {});
            dados = safeMerge(dados, store.progresso || {});

            if (store.respostas && countKeys(store.respostas)) {
                dados.respostas = store.respostas;
            }

            legacy[toolId] = {
                dados: dados,
                respostas: store.respostas || {},
                progresso: store.progresso || {},
                formulario: store.formulario || {},
                concluido: true,
                atualizadoEm: meta.atualizadoEm || nowIso(),
                concluidoEm: meta.concluidoEm || meta.atualizadoEm || nowIso()
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
            score: score,
            pontuacao: score,
            percentual: typeof entry.percentual !== 'undefined' ? Number(entry.percentual || 0) : 0,
            codigo: entry.codigo || (prefix ? prefix + '-' + score : ''),
            respostas: entry.respostas || {},
            total: entry.total || 0,
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
        return {
            fases_liberadas: [1],
            ferramentas_liberadas: [],
            atualizadoEm: nowIso(),
            atualizadoPor: 'sistema'
        };
    }

    function getCurrentSessionData() {
        if (!sessionId) return null;
        return readJson(localKey('session', sessionId), {
            sessionId: sessionId,
            controls: getDefaultControls(),
            participants: {},
            updatedAt: nowIso()
        });
    }

    function saveCurrentSessionData(payload) {
        if (!sessionId) return null;
        var data = safeMerge(getCurrentSessionData() || {}, payload || {});
        data.sessionId = sessionId;
        data.updatedAt = nowIso();
        writeJson(localKey('session', sessionId), data);
        global.dispatchEvent(new CustomEvent('pi-sync-local-updated', {
            detail: { sessionId: sessionId, data: data }
        }));
        return data;
    }

    function emitConnectionState(connected) {
        watchers.connection.forEach(function (callback) {
            callback(!!connected);
        });
    }

    function setupFirebaseConnectionWatch() {
        if (!firebaseReady || !db || firebaseSubscriptions.connection) return;
        firebaseSubscriptions.connection = db.ref('.info/connected');
        firebaseSubscriptions.connection.on('value', function (snapshot) {
            emitConnectionState(snapshot.val() === true);
        });
    }

    function init(config) {
        if (initialized) return Promise.resolve(firebaseReady);

        return new Promise(function (resolve) {
            initialized = true;
            try {
                if (typeof global.firebase === 'undefined' || !config) {
                    firebaseReady = false;
                    emitConnectionState(false);
                    resolve(false);
                    return;
                }

                if (!global.firebase.apps.length) {
                    app = global.firebase.initializeApp(config);
                } else {
                    app = global.firebase.app();
                }

                db = global.firebase.database(app);
                firebaseReady = true;
                setupFirebaseConnectionWatch();
                resolve(true);
            } catch (error) {
                console.warn('[PISync] Falha ao inicializar Firebase. Fallback local ativo.', error);
                firebaseReady = false;
                emitConnectionState(false);
                resolve(false);
            }
        });
    }

    function initFromWindow() {
        if (typeof global.getPIFirebaseConfig === 'function') {
            return init(global.getPIFirebaseConfig());
        }
        return init(global.FIREBASE_CONFIG || global.PI_FIREBASE_CONFIG || null);
    }

    function isOnline() {
        return !!firebaseReady;
    }

    function onConnectionChange(callback) {
        if (typeof callback === 'function') watchers.connection.push(callback);
        callback(isOnline());
        return function unsubscribe() {
            watchers.connection = watchers.connection.filter(function (fn) { return fn !== callback; });
        };
    }

    function setParticipantIdentity(name, percurso) {
        participantName = String(name || participantName || '').trim();
        participantPercurso = String(percurso || participantPercurso || '').trim();

        participantId = localStorage.getItem('pi-participant-id') || generateId('participant');
        localStorage.setItem('pi-participant-id', participantId);
        localStorage.setItem('pi-participant-name', participantName);
        localStorage.setItem('pi-percurso', participantPercurso);
    }

    function joinSession(code, name, percurso, extra) {
        sessionId = sanitizeSessionCode(code);
        if (!sessionId) throw new Error('Código da oficina inválido.');

        setParticipantIdentity(name, percurso || '3h');
        localStorage.setItem('pi-session-id', sessionId);

        var payload = {
            id: participantId,
            nome: participantName,
            percurso: participantPercurso,
            status: 'ativo',
            entrouEm: nowIso(),
            ultimoAcessoEm: nowIso(),
            progresso: 0,
            totalConcluidas: 0,
            ferramentaAtual: '',
            quiz: {},
            toolStates: {},
            extras: extra || {}
        };

        upsertParticipant(payload);
        ensureControlsExists();
        notifyControlsWatchers();
        notifyParticipantsWatchers();

        return {
            sessionId: sessionId,
            participantId: participantId,
            participantName: participantName,
            percurso: participantPercurso
        };
    }

    function restoreSession() {
        var storedSession = sanitizeSessionCode(localStorage.getItem('pi-session-id') || '');
        var storedParticipant = localStorage.getItem('pi-participant-id') || '';
        var storedName = localStorage.getItem('pi-participant-name') || '';
        var storedPercurso = localStorage.getItem('pi-percurso') || '';

        if (!storedSession || !storedParticipant) return false;

        sessionId = storedSession;
        participantId = storedParticipant;
        participantName = storedName;
        participantPercurso = storedPercurso;

        ensureControlsExists();
        touchParticipant();
        notifyControlsWatchers();
        notifyParticipantsWatchers();
        return true;
    }

    function leaveSession() {
        if (!sessionId || !participantId) return false;
        upsertParticipant({ status: 'desconectado', saiuEm: nowIso(), ultimoAcessoEm: nowIso() });
        localStorage.removeItem('pi-session-id');
        sessionId = '';
        return true;
    }

    function isInSession() {
        return !!sessionId;
    }

    function getSessionMeta() {
        return {
            sessionId: sessionId,
            participantId: participantId,
            participantName: participantName,
            percurso: participantPercurso,
            online: isOnline()
        };
    }

    function ensureControlsExists() {
        var data = getCurrentSessionData();
        if (!data) return null;
        if (!data.controls) {
            saveCurrentSessionData({ controls: getDefaultControls() });
        }
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

        if (firebaseReady && db && sessionId) {
            db.ref('oficinas/' + sessionId + '/controls').set(next);
        }

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
        watchers.controls.forEach(function (callback) {
            callback(clone(controls));
        });
    }

    function notifyParticipantsWatchers() {
        var participants = getParticipants();
        watchers.participants.forEach(function (callback) {
            callback(clone(participants));
        });
    }

    function watchControls(callback) {
        if (typeof callback !== 'function') return function () {};
        watchers.controls.push(callback);
        callback(clone(getControls()));

        if (firebaseReady && db && sessionId && !firebaseSubscriptions.controls) {
            firebaseSubscriptions.controls = db.ref('oficinas/' + sessionId + '/controls');
            firebaseSubscriptions.controls.on('value', function (snapshot) {
                var value = snapshot.val() || getDefaultControls();
                saveCurrentSessionData({ controls: value });
                notifyControlsWatchers();
            });
        }

        return function stop() {
            watchers.controls = watchers.controls.filter(function (fn) { return fn !== callback; });
        };
    }

    function stopWatchingControls() {
        watchers.controls = [];
        if (firebaseSubscriptions.controls) {
            firebaseSubscriptions.controls.off();
            firebaseSubscriptions.controls = null;
        }
    }

    function getParticipants() {
        var data = getCurrentSessionData();
        return data && data.participants ? data.participants : {};
    }

    function listParticipants() {
        var participants = getParticipants();
        return Object.keys(participants).map(function (id) {
            return safeMerge({ id: id }, participants[id]);
        });
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
            firebaseSubscriptions.participants.on('value', function (snapshot) {
                saveCurrentSessionData({ participants: snapshot.val() || {} });
                notifyParticipantsWatchers();
            });
        }

        return function stop() {
            watchers.participants = watchers.participants.filter(function (fn) { return fn !== callback; });
        };
    }

    function stopWatchingParticipants() {
        watchers.participants = [];
        if (firebaseSubscriptions.participants) {
            firebaseSubscriptions.participants.off();
            firebaseSubscriptions.participants = null;
        }
    }

    function computeProgressFromToolStates(toolStates) {
        var keys = Object.keys(toolStates || {});
        if (!keys.length) return { totalConcluidas: 0, progresso: 0 };
        var concluidas = keys.filter(function (key) {
            return !!(toolStates[key] && toolStates[key].metadados && toolStates[key].metadados.concluido);
        }).length;
        return {
            totalConcluidas: concluidas,
            progresso: concluidas > 0 ? concluidas : 0
        };
    }

    function sendToolState(toolId, state) {
        var id = String(toolId || '').trim();
        if (!sessionId || !participantId || !id) return null;

        var current = getParticipants()[participantId] || {};
        var toolStates = safeMerge(current.toolStates || {}, {});
        toolStates[id] = state;
        var progressSummary = computeProgressFromToolStates(toolStates);

        return upsertParticipant({
            ferramentaAtual: id,
            toolStates: toolStates,
            totalConcluidas: progressSummary.totalConcluidas,
            progresso: progressSummary.progresso
        });
    }

    function sendToolReset(toolId) {
        if (!sessionId || !participantId) return null;
        var current = getParticipants()[participantId] || {};
        var toolStates = safeMerge(current.toolStates || {}, {});
        delete toolStates[String(toolId || '').trim()];
        var progressSummary = computeProgressFromToolStates(toolStates);
        return upsertParticipant({
            toolStates: toolStates,
            totalConcluidas: progressSummary.totalConcluidas,
            progresso: progressSummary.progresso
        });
    }

    function updateParticipantProgress(payload) {
        if (!sessionId || !participantId) return null;
        return upsertParticipant(payload || {});
    }

    function saveQuizResult(quizId, result) {
        if (!sessionId || !participantId) return null;
        var current = getParticipants()[participantId] || {};
        var quiz = safeMerge(current.quiz || {}, {});
        quiz[quizId] = safeMerge(quiz[quizId] || {}, result || {}, {
            atualizadoEm: nowIso()
        });
        return upsertParticipant({ quiz: quiz });
    }

    function calculateEvolution(participant) {
        var quiz = (participant && participant.quiz) || {};
        var diagnostico = Number(quiz['quiz-diagnostico'] && quiz['quiz-diagnostico'].pontuacao) || 0;
        var final = Number(quiz['quiz-final'] && quiz['quiz-final'].pontuacao) || 0;
        return final - diagnostico;
    }

    function buildRanking(options) {
        var opts = options || {};
        var quizId = opts.quizId || '';
        var evolution = !!opts.evolution;

        return listParticipants()
            .map(function (participant) {
                var quiz = participant.quiz || {};
                var value = evolution
                    ? calculateEvolution(participant)
                    : Number(quiz[quizId] && quiz[quizId].pontuacao) || 0;

                return {
                    id: participant.id,
                    nome: participant.nome || 'Participante',
                    percurso: participant.percurso || '',
                    status: participant.status || 'ativo',
                    pontuacao: value,
                    percentual: quiz[quizId] && quiz[quizId].percentual,
                    totalConcluidas: participant.totalConcluidas || 0,
                    evolucao: calculateEvolution(participant)
                };
            })
            .sort(function (a, b) {
                if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;
                return (b.totalConcluidas || 0) - (a.totalConcluidas || 0);
            })
            .map(function (item, index) {
                item.posicao = index + 1;
                return item;
            });
    }

    function watchRanking(options, callback) {
        if (typeof callback !== 'function') return function () {};
        var job = {
            options: options || {},
            callback: callback
        };
        watchers.ranking.push(job);
        callback(buildRanking(job.options));

        var stopParticipants = watchParticipants(function () {
            callback(buildRanking(job.options));
        });

        return function stop() {
            stopParticipants();
            watchers.ranking = watchers.ranking.filter(function (entry) { return entry !== job; });
        };
    }

    function getLocalCompletions() {
        var completed = readJson('pi-thinking:completed-index', {});
        return completed || {};
    }

    var api = {
        version: '3.0.0',
        init: init,
        initFromWindow: initFromWindow,
        isOnline: isOnline,
        onConnectionChange: onConnectionChange,
        joinSession: joinSession,
        restoreSession: restoreSession,
        leaveSession: leaveSession,
        isInSession: isInSession,
        getSessionMeta: getSessionMeta,
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
