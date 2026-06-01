/* ================================================================
   PI THINKING — Tool Bridge v3.2
   Correção principal: namespace das ferramentas inclui participant-id
   para isolar progresso por aluno no mesmo dispositivo
   ================================================================ */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'pi-thinking';
  var AUTOSAVE_DELAY = 500;
  var timers = {};
  var autoSaveRegistry = {};

  function nowIso() { return new Date().toISOString(); }

  function safeJsonParse(v, fallback) {
    if (!v) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }

  function storageKey() {
    return [STORAGE_PREFIX].concat([].slice.call(arguments)).join(':');
  }

  /* ── CORREÇÃO CENTRAL: chave de ferramenta isolada por participante ── */
  function currentParticipantId() {
    return localStorage.getItem('pi-session-participant-id') || 'anon';
  }

  function toolKey(toolId) {
    return storageKey('tool', currentParticipantId(), String(toolId || '').trim());
  }

  function completionsKey() {
    return storageKey('completed-index', currentParticipantId());
  }

  function autosaveKey(toolId) {
    return storageKey('autosave', currentParticipantId(), String(toolId || '').trim());
  }

  function read(key, fallback) {
    try { return safeJsonParse(localStorage.getItem(key), fallback); }
    catch (e) { return fallback; }
  }

  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); return value; }
  function remove(key) { localStorage.removeItem(key); }

  function merge(target, source) {
    var out = Object.assign({}, target || {});
    Object.keys(source || {}).forEach(function (k) {
      var s = source[k], t = out[k];
      if (s && typeof s === 'object' && !Array.isArray(s) &&
          t && typeof t === 'object' && !Array.isArray(t)) {
        out[k] = merge(t, s);
      } else { out[k] = s; }
    });
    return out;
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
      participantId: localStorage.getItem('pi-session-participant-id') || '',
      participantName: localStorage.getItem('pi-participant-name') || '',
      sessionId: localStorage.getItem('pi-session-id') || '',
      percurso: localStorage.getItem('pi-percurso') || '',
      turma: localStorage.getItem('pi-turma') || ''
    };
  }

  function defaultToolStore(toolId) {
    return {
      toolId: normalizeToolId(toolId || getPageToolId()),
      progresso: {}, respostas: {}, formulario: {},
      metadados: {
        criadoEm: nowIso(), atualizadoEm: nowIso(),
        concluido: false, ultimaOrigem: 'local'
      },
      eventos: []
    };
  }

  function getToolStore(toolId) {
    var id = normalizeToolId(toolId || getPageToolId());
    return read(toolKey(id), defaultToolStore(id));
  }

  function saveToolStore(toolId, payload, options) {
    var id = normalizeToolId(toolId || getPageToolId());
    var current = getToolStore(id);
    var next = merge(current, payload || {});
    next.toolId = id;
    next.metadados = merge(current.metadados || {}, next.metadados || {});
    next.metadados.atualizadoEm = nowIso();
    next.metadados.ultimaOrigem = (options && options.origin) || 'local';
    write(toolKey(id), next);
    notifyToolUpdated(id, next);
    syncToolState(id, next, options);
    return next;
  }

  function notifyToolUpdated(toolId, store) {
    global.dispatchEvent(new CustomEvent('pi-tool-updated', { detail: { toolId: toolId, store: store } }));
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
    eventos.push({ nome: eventName, em: nowIso(), dados: payload || {} });
    while (eventos.length > 50) eventos.shift();
    return saveToolStore(toolId, { eventos: eventos });
  }

  function saveProgress(toolId, progressData, options) {
    var id = normalizeToolId(toolId || getPageToolId());
    return saveToolStore(id, {
      progresso: merge(getToolStore(id).progresso || {}, progressData || {}),
      metadados: { ultimoSaveEm: nowIso() }
    }, options);
  }

  function loadProgress(toolId) {
    return getToolStore(toolId).progresso || {};
  }

  function saveAnswers(toolId, answers, options) {
    var id = normalizeToolId(toolId || getPageToolId());
    return saveToolStore(id, { respostas: merge(getToolStore(id).respostas || {}, answers || {}) }, options);
  }

  function loadAnswers(toolId) { return getToolStore(toolId).respostas || {}; }

  function saveFormData(toolId, formData, options) {
    var id = normalizeToolId(toolId || getPageToolId());
    return saveToolStore(id, { formulario: merge(getToolStore(id).formulario || {}, formData || {}) }, options);
  }

  function loadFormData(toolId) { return getToolStore(toolId).formulario || {}; }

  function markComplete(toolId, payload, options) {
    var id = normalizeToolId(toolId || getPageToolId());
    var store = saveToolStore(id, {
      metadados: { concluido: true, concluidoEm: nowIso() },
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
    remove(toolKey(id));
    remove(autosaveKey(id));
    clearCompletionIndex(id);
    notifyToolUpdated(id, defaultToolStore(id));
    if (!(options && options.skipSync) && global.PISync &&
        typeof global.PISync.sendToolReset === 'function' &&
        global.PISync.isInSession && global.PISync.isInSession()) {
      global.PISync.sendToolReset(id);
    }
    return true;
  }

  function updateCompletionIndex(toolId, store) {
    var index = read(completionsKey(), {});
    index[toolId] = {
      concluido: !!(store && store.metadados && store.metadados.concluido),
      concluidoEm: store && store.metadados ? store.metadados.concluidoEm || nowIso() : nowIso()
    };
    write(completionsKey(), index);
  }

  function clearCompletionIndex(toolId) {
    var index = read(completionsKey(), {});
    delete index[normalizeToolId(toolId)];
    write(completionsKey(), index);
  }

  function getCompletedIndex() {
    return read(completionsKey(), {});
  }

  function serializeForm(container) {
    var root = container || document;
    var fields = root.querySelectorAll('input[name], textarea[name], select[name]');
    var data = {};
    Array.prototype.forEach.call(fields, function (f) {
      if (f.type === 'radio') { if (f.checked) data[f.name] = f.value; return; }
      if (f.type === 'checkbox') {
        if (!Array.isArray(data[f.name])) data[f.name] = [];
        if (f.checked) data[f.name].push(f.value || true); return;
      }
      data[f.name] = f.value;
    });
    return data;
  }

  function hydrateForm(container, values) {
    var root = container || document;
    var data = values || {};
    var fields = root.querySelectorAll('input[name], textarea[name], select[name]');
    Array.prototype.forEach.call(fields, function (f) {
      var v = data[f.name];
      if (typeof v === 'undefined') return;
      if (f.type === 'radio') { f.checked = String(f.value) === String(v); return; }
      if (f.type === 'checkbox') {
        f.checked = Array.isArray(v) ? v.indexOf(f.value) !== -1 : !!v; return;
      }
      f.value = v;
    });
  }

  function startAutoSave(config) {
    var s = Object.assign({ toolId: getPageToolId(), container: document, mode: 'form', delay: AUTOSAVE_DELAY, capture: null }, config || {});
    var id = normalizeToolId(s.toolId);
    stopAutoSave(id);
    var root = s.container || document;
    var handler = function () {
      debounce('autosave:' + id, function () {
        var data = typeof s.capture === 'function' ? s.capture() : serializeForm(root);
        if (s.mode === 'answers') saveAnswers(id, data);
        else if (s.mode === 'progress') saveProgress(id, data);
        else saveFormData(id, data);
        write(autosaveKey(id), { ativo: true, atualizadoEm: nowIso(), mode: s.mode });
      }, s.delay);
    };
    root.addEventListener('input', handler, true);
    root.addEventListener('change', handler, true);
    autoSaveRegistry[id] = { root: root, handler: handler };
    return true;
  }

  function stopAutoSave(toolId) {
    var id = normalizeToolId(toolId || getPageToolId());
    var reg = autoSaveRegistry[id];
    if (!reg) return false;
    reg.root.removeEventListener('input', reg.handler, true);
    reg.root.removeEventListener('change', reg.handler, true);
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
    var pid = currentParticipantId();
    var prefix = STORAGE_PREFIX + ':tool:' + pid + ':';
    var out = { exportadoEm: nowIso(), usuario: getUserProfile(), completions: getCompletedIndex(), ferramentas: {} };
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf(prefix) === 0) out.ferramentas[k.replace(prefix, '')] = read(k, {});
    });
    return out;
  }

  function importState(snapshot, options) {
    var data = snapshot || {};
    Object.keys(data.ferramentas || {}).forEach(function (id) {
      saveToolStore(id, data.ferramentas[id], Object.assign({}, options || {}, { skipSync: true, origin: 'import' }));
    });
    if (data.completions) write(completionsKey(), data.completions);
    return true;
  }

  function saveSessionContext(ctx) {
    var c = read(storageKey('session-context'), {});
    return write(storageKey('session-context'), Object.assign(c, ctx || {}));
  }
  function loadSessionContext() { return read(storageKey('session-context'), {}); }

  function getCurrentToolMeta() {
    var id = getPageToolId();
    return {
      toolId: id,
      tool: global.PIConfig && typeof global.PIConfig.getTool === 'function' ? global.PIConfig.getTool(id) : null,
      store: getToolStore(id)
    };
  }

  function saveSnapshot(toolId, snapshot) {
    return saveToolStore(toolId, snapshot || {}, { origin: 'snapshot' });
  }

  var api = {
    version: '3.2.0',
    getPageToolId: getPageToolId, normalizeToolId: normalizeToolId, getUserProfile: getUserProfile,
    saveProgress: saveProgress, loadProgress: loadProgress,
    saveAnswers: saveAnswers, loadAnswers: loadAnswers,
    saveFormData: saveFormData, loadFormData: loadFormData,
    saveSnapshot: saveSnapshot, appendEvent: appendEvent,
    markComplete: markComplete, isCompleted: isCompleted, clearProgress: clearProgress,
    getCompletedIndex: getCompletedIndex,
    startAutoSave: startAutoSave, stopAutoSave: stopAutoSave,
    serializeForm: serializeForm, hydrateForm: hydrateForm,
    restoreIntoForm: restoreIntoForm, exportState: exportState, importState: importState,
    saveSessionContext: saveSessionContext, loadSessionContext: loadSessionContext,
    getCurrentToolMeta: getCurrentToolMeta
  };

  global.PIToolBridge = api;
  global.PIThinking = Object.assign(global.PIThinking || {}, api, {
    loadProgressSafe: function (toolId) { return getToolStore(toolId || getPageToolId()); }
  });

})(window);
