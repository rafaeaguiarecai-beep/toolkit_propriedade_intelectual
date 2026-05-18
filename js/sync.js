/* ================================================================
   PI THINKING — Sync Module (Firebase Realtime Database)
   ================================================================
   Responsabilidades:
   - Conectar ao Firebase
   - Registrar participante na oficina
   - Enviar progresso e dados de ferramentas
   - Enviar resultados de quizzes
   - Ler controles do facilitador (fases liberadas)
   - Fornecer API de escuta para o dashboard
   
   Dependências:
   - Firebase SDK (compat) carregado via <script> no HTML
   - js/firebase-config.js carregado antes deste arquivo
   ================================================================ */

var PISync = (function () {
    'use strict';

    /* ── Estado interno ── */
    var db = null;
    var sessionId = null;
    var participantId = null;
    var participantName = '';
    var initialized = false;
    var connectionListeners = [];

    /* ══════════════════════════════════════
       INICIALIZAÇÃO
       ══════════════════════════════════════ */

    /**
     * Inicializa a conexão com o Firebase.
     * Deve ser chamado uma vez, antes de qualquer operação.
     * @param {Object} config - Objeto FIREBASE_CONFIG
     * @returns {Promise}
     */
    function init(config) {
        if (initialized) return Promise.resolve(true);

        return new Promise(function (resolve) {
            try {
                if (typeof firebase === 'undefined') {
                    console.warn('[PISync] Firebase SDK não carregado. Modo offline.');
                    resolve(false);
                    return;
                }

                if (!firebase.apps.length) {
                    firebase.initializeApp(config);
                }

                db = firebase.database();
                initialized = true;

                // Monitorar estado de conexão
                db.ref('.info/connected').on('value', function (snap) {
                    var connected = snap.val() === true;
                    connectionListeners.forEach(function (fn) { fn(connected); });
                });

                console.log('[PISync] Firebase inicializado com sucesso.');
                resolve(true);

            } catch (e) {
                console.error('[PISync] Erro ao inicializar:', e);
                resolve(false);
            }
        });
    }

    /**
     * Verifica se o Firebase foi inicializado com sucesso.
     * @returns {boolean}
     */
    function isOnline() {
        return initialized && db !== null;
    }

    /**
     * Registra listener para mudanças de conexão.
     * @param {Function} callback - Recebe boolean (conectado/desconectado)
     */
    function onConnectionChange(callback) {
        connectionListeners.push(callback);
    }

    /* ══════════════════════════════════════
       SESSÃO DO PARTICIPANTE
       ══════════════════════════════════════ */

    /**
     * Entra em uma sessão de oficina.
     * Registra o participante no Firebase e no localStorage.
     * @param {string} officeCode - Código da oficina (ex: "UFRR-2026-05")
     * @param {string} name - Nome completo do participante
     * @param {string} percurso - Percurso selecionado ("2h", "3h", "4h")
     * @returns {Object} { sessionId, participantId }
     */
    function joinSession(officeCode, name, percurso) {
        sessionId = officeCode.toUpperCase().trim().replace(/[^A-Z0-9\-]/g, '');
        participantName = name.trim();
        percurso = percurso || '3h';

        // Gerar ou recuperar ID único do participante
        participantId = localStorage.getItem('pi-participant-id');
        if (!participantId) {
            participantId = generateId();
            localStorage.setItem('pi-participant-id', participantId);
        }

        // Salvar no localStorage para restauração
        localStorage.setItem('pi-session-id', sessionId);
        localStorage.setItem('pi-participant-name', participantName);
        localStorage.setItem('pi-percurso', percurso);

        // Registrar no Firebase
        if (isOnline()) {
            var ref = db.ref('oficinas/' + sessionId + '/participantes/' + participantId);

            ref.update({
                nome: participantName,
                percurso: percurso,
                entrou_em: firebase.database.ServerValue.TIMESTAMP,
                status: 'ativo',
                ultimo_acesso: firebase.database.ServerValue.TIMESTAMP
            });

            // Marcar como desconectado quando sair
            ref.child('status').onDisconnect().set('desconectado');
            ref.child('desconectou_em').onDisconnect().set(
                firebase.database.ServerValue.TIMESTAMP
            );
        }

        return {
            sessionId: sessionId,
            participantId: participantId
        };
    }

    /**
     * Tenta restaurar uma sessão anterior a partir do localStorage.
     * Útil quando o aluno recarrega a página ou volta de uma ferramenta.
     * @returns {boolean} true se restaurou com sucesso
     */
    function restoreSession() {
        var savedSession = localStorage.getItem('pi-session-id');
        var savedId = localStorage.getItem('pi-participant-id');
        var savedName = localStorage.getItem('pi-participant-name');

        if (!savedSession || !savedId || !savedName) return false;

        sessionId = savedSession;
        participantId = savedId;
        participantName = savedName;

        // Atualizar status no Firebase
        if (isOnline()) {
            var ref = db.ref('oficinas/' + sessionId + '/participantes/' + participantId);
            ref.update({
                status: 'ativo',
                ultimo_acesso: firebase.database.ServerValue.TIMESTAMP
            });
            ref.child('status').onDisconnect().set('desconectado');
            ref.child('desconectou_em').onDisconnect().set(
                firebase.database.ServerValue.TIMESTAMP
            );
        }

        return true;
    }

    /**
     * Verifica se o participante está em uma sessão ativa.
     * @returns {boolean}
     */
    function isInSession() {
        return !!(sessionId && participantId && participantName);
    }

    /**
     * Retorna informações da sessão atual.
     * @returns {Object}
     */
    function getSessionInfo() {
        return {
            sessionId: sessionId,
            participantId: participantId,
            participantName: participantName,
            percurso: localStorage.getItem('pi-percurso') || ''
        };
    }

    /**
     * Encerra a sessão do participante.
     */
    function leaveSession() {
        if (isOnline() && sessionId && participantId) {
            db.ref('oficinas/' + sessionId + '/participantes/' + participantId).update({
                status: 'saiu',
                saiu_em: firebase.database.ServerValue.TIMESTAMP
            });
        }
        sessionId = null;
        participantId = null;
        participantName = '';
        localStorage.removeItem('pi-session-id');
        localStorage.removeItem('pi-participant-id');
        localStorage.removeItem('pi-participant-name');
        localStorage.removeItem('pi-percurso');
        localStorage.removeItem('pi-completed-tools');
    }

    /* ══════════════════════════════════════
       ENVIO DE DADOS (ALUNO → FIREBASE)
       ══════════════════════════════════════ */

    /**
     * Marca uma ferramenta como concluída e envia os dados.
     * Esta é a função principal chamada pelo botão "Concluir e Enviar".
     * @param {string} toolId - ID da ferramenta (ex: "quiz-diagnostico")
     * @param {Object} data - Dados específicos da ferramenta
     * @returns {Promise}
     */
    function sendToolCompletion(toolId, data) {
        if (!toolId) return Promise.reject('toolId obrigatório');

        var payload = {
            concluido: true,
            em: firebase.database.ServerValue.TIMESTAMP,
            dados: data || {}
        };

        // Salvar localmente (funciona offline)
        saveLocalCompletion(toolId, data);

        // Enviar para Firebase
        if (!isOnline() || !sessionId || !participantId) {
            console.warn('[PISync] Offline. Dados salvos localmente.');
            return Promise.resolve(false);
        }

        var path = 'oficinas/' + sessionId + '/participantes/' + participantId +
                   '/ferramentas/' + toolId;

        return db.ref(path).set(payload).then(function () {
            console.log('[PISync] Ferramenta enviada:', toolId);

            // Atualizar último acesso
            db.ref('oficinas/' + sessionId + '/participantes/' + participantId)
              .child('ultimo_acesso')
              .set(firebase.database.ServerValue.TIMESTAMP);

            return true;
        }).catch(function (e) {
            console.error('[PISync] Erro ao enviar:', e);
            return false;
        });
    }

    /**
     * Envia resultado de quiz (diagnóstico ou final).
     * Salva em nó separado para acesso rápido pelo dashboard/ranking.
     * @param {string} quizType - "diagnostico" ou "final"
     * @param {Object} result - { score, total, codigo, tempo_segundos, respostas[] }
     * @returns {Promise}
     */
    function sendQuizResult(quizType, result) {
        if (!result) return Promise.reject('result obrigatório');

        // Formatar respostas com indicação de acerto
        var respostasFormatadas = null;
        if (result.respostas && Array.isArray(result.respostas)) {
            respostasFormatadas = {};
            result.respostas.forEach(function (r, i) {
                respostasFormatadas[i] = {
                    questao: r.questao || (i + 1),
                    selecionada: r.selecionada || '',
                    correta: r.correta || '',
                    acertou: r.acertou || false
                };
            });
        }

        var payload = {
            score: result.score || 0,
            total: result.total || 0,
            codigo: result.codigo || '',
            tempo_segundos: result.tempo_segundos || 0,
            concluido_em: firebase.database.ServerValue.TIMESTAMP
        };

        if (respostasFormatadas) {
            payload.respostas = respostasFormatadas;
        }

        // Salvar localmente
        localStorage.setItem('pi-quiz-' + quizType, JSON.stringify(payload));

        if (!isOnline() || !sessionId || !participantId) {
            return Promise.resolve(false);
        }

        var basePath = 'oficinas/' + sessionId + '/participantes/' + participantId;

        // Salvar no nó do quiz (acesso rápido para ranking)
        var quizPromise = db.ref(basePath + '/' + quizType).set(payload);

        // Também marcar a ferramenta como concluída
        var toolId = quizType === 'diagnostico' ? 'quiz-diagnostico' : 'quiz-final';
        var toolPromise = sendToolCompletion(toolId, {
            score: result.score,
            total: result.total,
            codigo: result.codigo
        });

        return Promise.all([quizPromise, toolPromise]).then(function () {
            return true;
        }).catch(function (e) {
            console.error('[PISync] Erro ao enviar quiz:', e);
            return false;
        });
    }

    /* ══════════════════════════════════════
       LEITURA DE CONTROLES DO FACILITADOR
       ══════════════════════════════════════ */

    /**
     * Escuta as fases e ferramentas liberadas pelo facilitador.
     * O módulo do aluno usa isso para desbloquear ferramentas.
     * @param {Function} callback - Recebe { fases_liberadas: [], ferramentas_liberadas: [] }
     */
    function watchControls(callback) {
        if (!isOnline() || !sessionId) return;

        db.ref('oficinas/' + sessionId + '/controle').on('value', function (snap) {
            var data = snap.val() || {};
            callback({
                fases_liberadas: data.fases_liberadas || [],
                ferramentas_liberadas: data.ferramentas_liberadas || []
            });
        });
    }

    /**
     * Para de escutar controles.
     */
    function stopWatchingControls() {
        if (!isOnline() || !sessionId) return;
        db.ref('oficinas/' + sessionId + '/controle').off();
    }

    /* ══════════════════════════════════════
       API DO DASHBOARD (FACILITADOR)
       ══════════════════════════════════════ */

    /**
     * Cria uma nova sessão de oficina.
     * Chamado pelo facilitador ao configurar o dashboard.
     * @param {string} officeCode - Código da oficina
     * @param {Object} config - { percurso, facilitador }
     * @returns {Promise}
     */
    function createSession(officeCode, config) {
        if (!isOnline()) return Promise.reject('Firebase não conectado');

        var code = officeCode.toUpperCase().trim().replace(/[^A-Z0-9\-]/g, '');

        return db.ref('oficinas/' + code + '/config').set({
            percurso: config.percurso || '3h',
            facilitador: config.facilitador || '',
            criada_em: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
            // Inicializar controle
            return db.ref('oficinas/' + code + '/controle').set({
                fases_liberadas: [1],
                ferramentas_liberadas: []
            });
        }).then(function () {
            sessionId = code;
            return code;
        });
    }

    /**
     * Escuta todos os participantes de uma oficina em tempo real.
     * Chamado pelo dashboard para atualizar visualizações.
     * @param {string} officeCode - Código da oficina
     * @param {Function} callback - Recebe objeto com todos os participantes
     */
    function watchParticipants(officeCode, callback) {
        if (!isOnline()) return;

        var code = officeCode.toUpperCase().trim();
        db.ref('oficinas/' + code + '/participantes').on('value', function (snap) {
            callback(snap.val() || {});
        });
    }

    /**
     * Para de escutar participantes.
     * @param {string} officeCode
     */
    function stopWatchingParticipants(officeCode) {
        if (!isOnline()) return;
        var code = officeCode.toUpperCase().trim();
        db.ref('oficinas/' + code + '/participantes').off();
    }

    /**
     * Libera fases para todos os participantes.
     * @param {string} officeCode
     * @param {number[]} phases - Array de números de fases (ex: [1, 2, 3])
     * @returns {Promise}
     */
    function releasePhases(officeCode, phases) {
        if (!isOnline()) return Promise.reject('Offline');
        var code = officeCode.toUpperCase().trim();
        return db.ref('oficinas/' + code + '/controle/fases_liberadas').set(phases);
    }

    /**
     * Libera ferramentas específicas para todos os participantes.
     * @param {string} officeCode
     * @param {string[]} toolIds - Array de IDs de ferramentas
     * @returns {Promise}
     */
    function releaseTools(officeCode, toolIds) {
        if (!isOnline()) return Promise.reject('Offline');
        var code = officeCode.toUpperCase().trim();
        return db.ref('oficinas/' + code + '/controle/ferramentas_liberadas').set(toolIds);
    }

    /**
     * Escuta a configuração de uma oficina.
     * @param {string} officeCode
     * @param {Function} callback
     */
    function watchConfig(officeCode, callback) {
        if (!isOnline()) return;
        var code = officeCode.toUpperCase().trim();
        db.ref('oficinas/' + code + '/config').on('value', function (snap) {
            callback(snap.val() || {});
        });
    }

    /* ══════════════════════════════════════
       UTILITÁRIOS INTERNOS
       ══════════════════════════════════════ */

    /**
     * Gera ID único para o participante.
     * Formato: P-timestamp36-random5
     */
    function generateId() {
        return 'P-' + Date.now().toString(36) + '-' +
               Math.random().toString(36).substr(2, 5);
    }

    /**
     * Salva conclusão de ferramenta no localStorage.
     * Funciona como backup offline.
     */
    function saveLocalCompletion(toolId, data) {
        var completed = {};
        try {
            completed = JSON.parse(localStorage.getItem('pi-completed-tools') || '{}');
        } catch (e) { completed = {}; }

        completed[toolId] = {
            concluido: true,
            em: new Date().toISOString(),
            dados: data || {}
        };

        localStorage.setItem('pi-completed-tools', JSON.stringify(completed));
    }

    /**
     * Retorna ferramentas concluídas do localStorage.
     * @returns {Object}
     */
    function getLocalCompletions() {
        try {
            return JSON.parse(localStorage.getItem('pi-completed-tools') || '{}');
        } catch (e) { return {}; }
    }

    /* ══════════════════════════════════════
       API PÚBLICA
       ══════════════════════════════════════ */

    return {
        // Inicialização
        init: init,
        isOnline: isOnline,
        onConnectionChange: onConnectionChange,

        // Sessão do participante
        joinSession: joinSession,
        restoreSession: restoreSession,
        isInSession: isInSession,
        getSessionInfo: getSessionInfo,
        leaveSession: leaveSession,

        // Envio de dados (aluno)
        sendToolCompletion: sendToolCompletion,
        sendQuizResult: sendQuizResult,

        // Leitura de controles (aluno)
        watchControls: watchControls,
        stopWatchingControls: stopWatchingControls,

        // API do dashboard (facilitador)
        createSession: createSession,
        watchParticipants: watchParticipants,
        stopWatchingParticipants: stopWatchingParticipants,
        releasePhases: releasePhases,
        releaseTools: releaseTools,
        watchConfig: watchConfig,

        // Utilitários
        getLocalCompletions: getLocalCompletions
    };

})();
