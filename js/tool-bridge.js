/* ================================================================
   PI THINKING — Tool Bridge
   ================================================================
   Camada única de persistência local + sincronização opcional.

   Responsabilidades:
   - Detectar a ferramenta atual
   - Salvar e restaurar progresso, respostas e formulários
   - Padronizar chaves no localStorage
   - Enviar snapshots ao modo oficina quando PISync existir
   - Oferecer API global compatível com as ferramentas atuais
   ================================================================ */

(function (global) {
    'use strict';

    var STORAGE_PREFIX = 'pi-thinking';
    var AUTOSAVE_DELAY = 500;
    var timers = {};
    var autoSaveRegistry = {};

    function nowIso() {
        return new Date().toISOString();
    }

    function safeJsonParse(value, fallback) {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function storageKey() {
        return [STORAGE_PREFIX].concat([].slice.call(arguments)).join(':');
    }

    function read(key, fallback) {
        try {
            return safeJsonParse(localStorage.getItem(key), fallback);
        } catch (error) {
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return value;
    }

    function remove(key) {
        localStorage.removeItem(key);
    }

    function merge(target, source) {
        var output = Object.assign({}, target || {});
        Object.keys(source || {}).forEach(function (key) {
            var srcValue = source[key];
            var tgtValue = output[key];
            if (srcValue && typeof srcValue === 'object' && !Array.isArray(srcValue) && tgtValue && typeof tgtValue === 'object' && !Array.isArray(tgtValue)) {
                output[key] = merge(tgtValue, srcValue);
            } else {
                output[key] = srcValue;
            }
        });
        return output;
    }

    function debounce(key, fn, delay) {
        clearTimeout(timers[key]);
        timers[key] = setTimeout(fn, delay || AUTOSAVE_DELAY);
    }

    function getPageToolId() {
        var body = document.body;
        var explicit = body && body.getAttribute('data-tool-id');
        if (explicit) return normalizeToolId(explicit);
        var path = (global.location.pathname || '').split('/').pop() || '';
        if (path) return normalizeToolId(path.replace(/\.html$/i, ''));
        return 'pagina-estrutural';
    }

    function normalizeToolId(id) {
        if (global.PIConfig && typeof global.PIConfig.normalizeId === 'function') {
            return global.PIConfig.normalizeId(id);
        }
        return String(id || '').trim().replace(/\.html$/i, '').toLowerCase();
    }

    function getUserProfile() {
        return {
            participantId: localStorage.getItem('pi-participant-id') || '',
            participantName: localStorage.getItem('pi-participant-name') || '',
            sessionId: localStorage.getItem('pi-session-id') || '',
            percurso: localStorage.getItem('pi-percurso') || '',
            turma: localStorage.getItem('pi-turma') || ''
        };
    }

    function getToolStore(toolId) {
        var id = normalizeToolId(toolId || getPageToolId());
        return read(storageKey('tool', id), defaultToolStore(id));
    }

    function defaultToolStore(toolId) {
        return {
            toolId: normalizeToolId(toolId || getPageToolId()),
            progresso: {},
            respostas: {},
            formulario: {},
            metadados: {
                criadoEm: nowIso(),
                atualizadoEm: nowIso(),
                concluido: false,
                ultimaOrigem: 'local'
            },
            eventos: []
        };
    }

    function saveToolStore(toolId, payload, options) {
        var id = normalizeToolId(toolId || getPageToolId());
        var current = getToolStore(id);
        var next = merge(current, payload || {});
        next.toolId = id;
        next.metadados = merge(current.metadados || {}, next.metadados || {});
        next.metadados.atualizadoEm = nowIso();
        next.metadados.ultimaOrigem = (options && options.origin) || 'local';
        write(storageKey('tool', id), next);
        notifyToolUpdated(id, next);
        syncToolState(id, next, options);
        return next;
    }

    function notifyToolUpdated(toolId, store) {
        global.dispatchEvent(new CustomEvent('pi-tool-updated', {
            detail: {
                toolId: toolId,
                store: store
            }
        }));
    }

    function syncToolState(toolId, store, options) {
        if (options && options.skipSync) return;
        if (!global.PISync || typeof global.PISync.sendToolState !== 'function') return;
        if (!global.PISync.isInSession || !global.PISync.isInSession()) return;
        global.PISync.sendToolState(toolId, store);
    }

    function appendEvent(toolId, eventName, payload) {
        var store = getToolStore(toolId);
        var eventos = Array.isArray(store.eventos) ? store.eventos.slice() : [];
        eventos.push({
            nome: eventName,
            em: nowIso(),
            dados: payload || {}
        });
        while (eventos.length > 50) eventos.shift();
        return saveToolStore(toolId, { eventos: eventos });
    }

    function saveProgress(toolId, progressData, options) {
        var id = normalizeToolId(toolId || getPageToolId());
        var payload = {
            progresso: merge(getToolStore(id).progresso || {}, progressData || {}),
            metadados: {
                ultimoSaveEm: nowIso()
            }
        };
        return saveToolStore(id, payload, options);
    }

    function loadProgress(toolId) {
        return getToolStore(toolId).progresso || {};
    }

    function saveAnswers(toolId, answers, options) {
        var id = normalizeToolId(toolId || getPageToolId());
        return saveToolStore(id, {
            respostas: merge(getToolStore(id).respostas || {}, answers || {})
        }, options);
    }

    function loadAnswers(toolId) {
        return getToolStore(toolId).respostas || {};
    }

    function saveFormData(toolId, formData, options) {
        var id = normalizeToolId(toolId || getPageToolId());
        return saveToolStore(id, {
            formulario: merge(getToolStore(id).formulario || {}, formData || {})
        }, options);
    }

    function loadFormData(toolId) {
        return getToolStore(toolId).formulario || {};
    }

    function markComplete(toolId, payload, options) {
        var id = normalizeToolId(toolId || getPageToolId());
        var store = saveToolStore(id, {
            metadados: {
                concluido: true,
                concluidoEm: nowIso()
            },
            progresso: merge(getToolStore(id).progresso || {}, payload || {})
        }, options);

        updateCompletionIndex(id, store);

        if (global.AlunoEngine && typeof global.AlunoEngine.completeTool === 'function') {
            global.AlunoEngine.completeTool(id, payload || {});
        }

        appendEvent(id, 'conclusao', payload || {});
        return store;
    }

    function isCompleted(toolId) {
        return !!getToolStore(toolId).metadados.concluido;
    }

    function clearProgress(toolId, options) {
        var id = normalizeToolId(toolId || getPageToolId());
        remove(storageKey('tool', id));
        remove(storageKey('autosave', id));
        clearCompletionIndex(id);
        notifyToolUpdated(id, defaultToolStore(id));
        if (!(options && options.skipSync) && global.PISync && typeof global.PISync.sendToolReset === 'function' && global.PISync.isInSession && global.PISync.isInSession()) {
            global.PISync.sendToolReset(id);
        }
        return true;
    }

    function updateCompletionIndex(toolId, store) {
        var index = read(storageKey('completed-index'), {});
        index[toolId] = {
            concluido: !!(store && store.metadados && store.metadados.concluido),
            concluidoEm: store && store.metadados ? store.metadados.concluidoEm || nowIso() : nowIso()
        };
        write(storageKey('completed-index'), index);
    }

    function clearCompletionIndex(toolId) {
        var index = read(storageKey('completed-index'), {});
        delete index[normalizeToolId(toolId)];
        write(storageKey('completed-index'), index);
    }

    function getCompletedIndex() {
        return read(storageKey('completed-index'), {});
    }

    function serializeForm(container) {
        var root = container || document;
        var fields = root.querySelectorAll('input[name], textarea[name], select[name]');
        var data = {};
        Array.prototype.forEach.call(fields, function (field) {
            if (field.type === 'radio') {
                if (field.checked) data[field.name] = field.value;
                return;
            }
            if (field.type === 'checkbox') {
                if (!Array.isArray(data[field.name])) data[field.name] = [];
                if (field.checked) data[field.name].push(field.value || true);
                return;
            }
            data[field.name] = field.value;
        });
        return data;
    }

    function hydrateForm(container, values) {
        var root = container || document;
        var data = values || {};
        var fields = root.querySelectorAll('input[name], textarea[name], select[name]');
        Array.prototype.forEach.call(fields, function (field) {
            var value = data[field.name];
            if (typeof value === 'undefined') return;
            if (field.type === 'radio') {
                field.checked = String(field.value) === String(value);
                return;
            }
            if (field.type === 'checkbox') {
                if (Array.isArray(value)) {
                    field.checked = value.indexOf(field.value) !== -1;
                } else {
                    field.checked = !!value;
                }
                return;
            }
            field.value = value;
        });
    }

    function startAutoSave(config) {
        var settings = Object.assign({
            toolId: getPageToolId(),
            container: document,
            mode: 'form',
            delay: AUTOSAVE_DELAY,
            capture: null
        }, config || {});

        var toolId = normalizeToolId(settings.toolId);
        stopAutoSave(toolId);

        var root = settings.container || document;
        var handler = function () {
            debounce('autosave:' + toolId, function () {
                var data = typeof settings.capture === 'function'
                    ? settings.capture()
                    : serializeForm(root);

                if (settings.mode === 'answers') {
                    saveAnswers(toolId, data);
                } else if (settings.mode === 'progress') {
                    saveProgress(toolId, data);
                } else {
                    saveFormData(toolId, data);
                }

                write(storageKey('autosave', toolId), {
                    ativo: true,
                    atualizadoEm: nowIso(),
                    mode: settings.mode
                });
            }, settings.delay);
        };

        root.addEventListener('input', handler, true);
        root.addEventListener('change', handler, true);

        autoSaveRegistry[toolId] = {
            root: root,
            handler: handler
        };

        return true;
    }

    function stopAutoSave(toolId) {
        var id = normalizeToolId(toolId || getPageToolId());
        var registered = autoSaveRegistry[id];
        if (!registered) return false;
        registered.root.removeEventListener('input', registered.handler, true);
        registered.root.removeEventListener('change', registered.handler, true);
        delete autoSaveRegistry[id];
        return true;
    }

    function restoreIntoForm(toolId, container, source) {
        var data;
        if (source === 'answers') data = loadAnswers(toolId);
        else if (source === 'progress') data = loadProgress(toolId);
        else data = loadFormData(toolId);
        hydrateForm(container || document, data);
        return data;
    }

    function exportState() {
        var exportData = {
            exportadoEm: nowIso(),
            usuario: getUserProfile(),
            completions: getCompletedIndex(),
            ferramentas: {}
        };

        Object.keys(localStorage).forEach(function (key) {
            if (key.indexOf(STORAGE_PREFIX + ':tool:') === 0) {
                exportData.ferramentas[key.replace(STORAGE_PREFIX + ':tool:', '')] = read(key, {});
            }
        });

        return exportData;
    }

    function importState(snapshot, options) {
        var data = snapshot || {};
        Object.keys(data.ferramentas || {}).forEach(function (toolId) {
            saveToolStore(toolId, data.ferramentas[toolId], Object.assign({}, options || {}, { skipSync: true, origin: 'import' }));
        });
        if (data.completions) {
            write(storageKey('completed-index'), data.completions);
        }
        return true;
    }

    function saveSessionContext(context) {
        var current = read(storageKey('session-context'), {});
        return write(storageKey('session-context'), merge(current, context || {}));
    }

    function loadSessionContext() {
        return read(storageKey('session-context'), {});
    }

    function getCurrentToolMeta() {
        var id = getPageToolId();
        var tool = global.PIConfig && typeof global.PIConfig.getTool === 'function'
            ? global.PIConfig.getTool(id)
            : null;
        return {
            toolId: id,
            tool: tool,
            store: getToolStore(id)
        };
    }

    function saveSnapshot(toolId, snapshot) {
        return saveToolStore(toolId, snapshot || {}, { origin: 'snapshot' });
    }

    var api = {
        version: '3.0.0',
        getPageToolId: getPageToolId,
        normalizeToolId: normalizeToolId,
        getUserProfile: getUserProfile,
        saveProgress: saveProgress,
        loadProgress: loadProgress,
        saveAnswers: saveAnswers,
        loadAnswers: loadAnswers,
        saveFormData: saveFormData,
        loadFormData: loadFormData,
        saveSnapshot: saveSnapshot,
        appendEvent: appendEvent,
        markComplete: markComplete,
        isCompleted: isCompleted,
        clearProgress: clearProgress,
        getCompletedIndex: getCompletedIndex,
        startAutoSave: startAutoSave,
        stopAutoSave: stopAutoSave,
        serializeForm: serializeForm,
        hydrateForm: hydrateForm,
        restoreIntoForm: restoreIntoForm,
        exportState: exportState,
        importState: importState,
        saveSessionContext: saveSessionContext,
        loadSessionContext: loadSessionContext,
        getCurrentToolMeta: getCurrentToolMeta
    };

    global.PIToolBridge = api;
    global.PIThinking = Object.assign(global.PIThinking || {}, api, {
        loadProgressSafe: function (toolId) {
            return getToolStore(toolId || getPageToolId());
        }
    });
})(window);
