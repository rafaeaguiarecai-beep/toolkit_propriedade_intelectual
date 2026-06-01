/* ================================================================
   PI THINKING — Aluno Engine
   ================================================================
   Motor do módulo do aluno.
   - Usa PIConfig como fonte única de dados
   - Usa PIToolBridge para persistência local
   - Usa PISync para modo oficina quando disponível
   ================================================================ */

(function (global) {
    'use strict';

    var state = {
        percursoKey: '',
        percurso: null,
        ferramentas: [],
        completions: {},
        controls: {
            fases_liberadas: [1],
            ferramentas_liberadas: []
        }
    };

    var subscribers = [];
    var stopControlsWatcher = null;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeId(id) {
        return global.PIConfig && typeof global.PIConfig.normalizeId === 'function'
            ? global.PIConfig.normalizeId(id)
            : String(id || '').trim().replace(/\.html$/i, '').toLowerCase();
    }

    function notify() {
        var snapshot = getState();
        subscribers.forEach(function (callback) {
            callback(snapshot);
        });
        global.dispatchEvent(new CustomEvent('pi-aluno-engine-updated', {
            detail: snapshot
        }));
    }

    function loadCompletions() {
        var localIndex = global.PIToolBridge && typeof global.PIToolBridge.getCompletedIndex === 'function'
            ? global.PIToolBridge.getCompletedIndex()
            : {};

        if (global.PISync && typeof global.PISync.getLocalCompletions === 'function') {
            state.completions = Object.assign({}, global.PISync.getLocalCompletions(), localIndex);
        } else {
            state.completions = Object.assign({}, localIndex);
        }
    }

    function resolvePercurso(percursoKey) {
        var key = percursoKey || localStorage.getItem('pi-percurso') || '3h';
        var percurso = global.PIConfig && typeof global.PIConfig.buildPercurso === 'function'
            ? global.PIConfig.buildPercurso(key)
            : null;

        if (!percurso) {
            key = '3h';
            percurso = global.PIConfig.buildPercurso('3h');
        }

        state.percursoKey = key;
        state.percurso = percurso;
        state.ferramentas = percurso ? percurso.ferramentasDetalhadas.slice() : [];
        localStorage.setItem('pi-percurso', key);
    }

    function isCompleted(toolId) {
        var id = normalizeId(toolId);
        return !!(state.completions[id] && state.completions[id].concluido);
    }

    function getLastCompletedIndex() {
        var last = -1;
        state.ferramentas.forEach(function (tool, index) {
            if (isCompleted(tool.id)) last = index;
        });
        return last;
    }

    function isPhaseReleased(phaseNumber) {
        return state.controls.fases_liberadas.indexOf(Number(phaseNumber)) !== -1;
    }

    function isToolReleased(toolId) {
        return state.controls.ferramentas_liberadas.indexOf(normalizeId(toolId)) !== -1;
    }

    function isUnlocked(index) {
        var tool = state.ferramentas[index];
        if (!tool) return false;
        if (index === 0) return true;
        if (isCompleted(tool.id)) return true;
        if (isToolReleased(tool.id)) return true;
        if (isPhaseReleased(tool.fase)) return true;
        var previous = state.ferramentas[index - 1];
        return !!(previous && isCompleted(previous.id));
    }

    function computeFerramentas() {
        return state.ferramentas.map(function (tool, index) {
            var unlocked = isUnlocked(index);
            var completed = isCompleted(tool.id);
            var prevNext = global.PIConfig && typeof global.PIConfig.getPrevNext === 'function'
                ? global.PIConfig.getPrevNext(tool.id, state.percursoKey)
                : { anterior: null, proxima: null };

            return Object.assign({}, tool, {
                indice: index,
                concluida: completed,
                desbloqueada: unlocked,
                bloqueada: !unlocked,
                anterior: prevNext.anterior,
                proxima: prevNext.proxima
            });
        });
    }

    function getCurrentPhase(ferramentas) {
        var list = ferramentas || computeFerramentas();
        var nextOpen = list.find(function (tool) {
            return tool.desbloqueada && !tool.concluida;
        });
        if (nextOpen) return nextOpen.fase;
        var lastCompletedIndex = getLastCompletedIndex();
        if (lastCompletedIndex >= 0) {
            return list[lastCompletedIndex] ? list[lastCompletedIndex].fase : 1;
        }
        return 1;
    }

    function getProximaFerramenta(ferramentas) {
        var list = ferramentas || computeFerramentas();
        for (var i = 0; i < list.length; i += 1) {
            if (list[i].desbloqueada && !list[i].concluida) return list[i];
        }
        return null;
    }

    function getJornadaDisponivel(ferramentas) {
        var list = ferramentas || computeFerramentas();
        if (!list.length) return false;
        return list.every(function (tool) { return tool.concluida; });
    }

    function getState() {
        if (!state.percurso) return null;

        var ferramentas = computeFerramentas();
        var concluidas = ferramentas.filter(function (tool) { return tool.concluida; }).length;
        var total = ferramentas.length;
        var progresso = total ? Math.round((concluidas / total) * 100) : 0;
        var faseAtual = getCurrentPhase(ferramentas);
        var jornadaDisponivel = getJornadaDisponivel(ferramentas);

        return {
            percursoKey: state.percursoKey,
            percurso: clone(state.percurso),
            fases: clone(global.PIConfig ? global.PIConfig.FASES : []),
            ferramentas: ferramentas,
            apoio: global.PIConfig && typeof global.PIConfig.getSupportTools === 'function'
                ? global.PIConfig.getSupportTools()
                : [],
            jornada: global.PIConfig && typeof global.PIConfig.getPostWorkshopTool === 'function'
                ? global.PIConfig.getPostWorkshopTool()
                : null,
            jornadaDisponivel: jornadaDisponivel,
            controls: clone(state.controls),
            totalFerramentas: total,
            totalConcluidas: concluidas,
            progresso: progresso,
            faseAtual: faseAtual,
            concluido: total > 0 && concluidas === total,
            proximaFerramenta: getProximaFerramenta(ferramentas),
            perfil: {
                participantId: localStorage.getItem('pi-participant-id') || '',
                participantName: localStorage.getItem('pi-participant-name') || '',
                percurso: state.percursoKey,
                sessionId: localStorage.getItem('pi-session-id') || ''
            }
        };
    }

    function completeTool(toolId, payload) {
        var id = normalizeId(toolId);
        state.completions[id] = {
            concluido: true,
            concluidoEm: new Date().toISOString(),
            payload: payload || {}
        };

        if (global.PIToolBridge && typeof global.PIToolBridge.markComplete === 'function' && !global.PIToolBridge.isCompleted(id)) {
            global.PIToolBridge.markComplete(id, payload || {}, { skipSync: false });
        }

        if (global.PISync && typeof global.PISync.updateParticipantProgress === 'function' && global.PISync.isInSession && global.PISync.isInSession()) {
            var snapshot = getState();
            global.PISync.updateParticipantProgress({
                progresso: snapshot.progresso,
                totalConcluidas: snapshot.totalConcluidas,
                faseAtual: snapshot.faseAtual,
                ferramentaAtual: id
            });
        }

        notify();
        return getState();
    }

    function reset() {
        state.completions = {};
        state.controls = {
            fases_liberadas: [1],
            ferramentas_liberadas: []
        };
        notify();
        return true;
    }

    function subscribe(callback) {
        if (typeof callback !== 'function') return function () {};
        subscribers.push(callback);
        callback(getState());
        return function unsubscribe() {
            subscribers = subscribers.filter(function (fn) { return fn !== callback; });
        };
    }

    function startWatchingControls() {
        if (stopControlsWatcher) {
            stopControlsWatcher();
            stopControlsWatcher = null;
        }

        if (global.PISync && typeof global.PISync.watchControls === 'function' && global.PISync.isInSession && global.PISync.isInSession()) {
            stopControlsWatcher = global.PISync.watchControls(function (controls) {
                state.controls = Object.assign({
                    fases_liberadas: [1],
                    ferramentas_liberadas: []
                }, controls || {});
                notify();
            });
        }
    }

    function init(percursoKey) {
        if (!global.PIConfig) {
            throw new Error('PIConfig não carregado.');
        }
        resolvePercurso(percursoKey || localStorage.getItem('pi-percurso') || '3h');
        loadCompletions();
        startWatchingControls();
        notify();
        return getState();
    }

    function restore() {
        var saved = localStorage.getItem('pi-percurso');
        if (!saved) return false;
        return init(saved);
    }

    function setPercurso(percursoKey) {
        return init(percursoKey);
    }

    function getFerramenta(toolId) {
        var id = normalizeId(toolId);
        return getState().ferramentas.find(function (tool) {
            return tool.id === id;
        }) || null;
    }

    function getFerramentasPorFase(phaseNumber) {
        return getState().ferramentas.filter(function (tool) {
            return Number(tool.fase) === Number(phaseNumber);
        });
    }

    var api = {
        init: init,
        restore: restore,
        reset: reset,
        subscribe: subscribe,
        getState: getState,
        setPercurso: setPercurso,
        completeTool: completeTool,
        isCompleted: isCompleted,
        isUnlocked: isUnlocked,
        getFerramenta: getFerramenta,
        getFerramentasPorFase: getFerramentasPorFase
    };

    global.AlunoEngine = api;
})(window);
