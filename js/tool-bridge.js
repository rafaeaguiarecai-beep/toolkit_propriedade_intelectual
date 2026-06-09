/* ================================================================
   PI THINKING — Tool Bridge v3.3
   Correções:
   - savePersonaContext / loadPersonaContext: persiste a persona
     selecionada nas Cartas Personas para preenchimento automático
     em ferramentas subsequentes (Canvas de Diagnóstico, Estratégia etc.)
   - getPersonaContext: retorna persona + mapa de empatia + dilema
   - autoFillFromPersona: preenche campos de texto que tenham
     data-persona-field nos formulários das ferramentas
   ================================================================ */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'pi-thinking';
  var AUTOSAVE_DELAY = 500;
  var timers = {};
  var autoSaveRegistry = {};

  // ── Chave dedicada ao contexto de persona (por sessão e participante) ──
  var PERSONA_CONTEXT_KEY = 'pi-persona-context';

  function nowIso() { return new Date().toISOString(); }

  function safeJsonParse(v, fallback) {
    if (!v) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }

  function storageKey() {
    return [STORAGE_PREFIX].concat([].slice.call(arguments)).join(':');
  }

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

  function personaContextKey() {
    var pid = currentParticipantId();
    var sid = localStorage.getItem('pi-session-id') || 'nosession';
    return PERSONA_CONTEXT_KEY + ':' + sid + ':' + pid;
  }

  function read(key, fallback) {
    try { return safeJsonParse(localStorage.getItem(key), fallback); }
    catch (e) { return fallback; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function remove(key) { localStorage.removeItem(key); }

  function merge(target, source) {
    var out = Object.assign({}, target || {});
    Object.keys(source || {}).forEach(function (k) {
      var s = source[k], t = out[k];
      if (s && typeof s === 'object' && !Array.isArray(s) &&
          t && typeof t === 'object' && !Array.isArray(t)) {
        out[k] = merge(t, s);
      } else {
        out[k] = s;
      }
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
    global.dispatchEvent(new CustomEvent('pi-tool-updated', {
      detail: { toolId: toolId, store: store }
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
      metadados: { concluido: true, concluidoEm: nowIso() },
      progresso: merge(getToolStore(id).progresso || {}, payload || {})
    }, options);
    updateCompletionIndex(id, store);
    if (global.AlunoEngine && typeof global.AlunoEngine.completeTool === 'function') {
      global.AlunoEngine.completeTool(id, payload || {});
    }
    appendEvent(id, 'conclusao', payload || {});

    // CORREÇÃO 2: após marcar como concluída, notifica o engine do aluno
    // para que o módulo atualize a lista de ferramentas disponíveis
    global.dispatchEvent(new CustomEvent('pi-tool-completed', {
      detail: { toolId: id, payload: payload || {} }
    }));

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
    if (!(options && options.skipSync) &&
        global.PISync && typeof global.PISync.sendToolReset === 'function' &&
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

  /* ================================================================
     CORREÇÃO 4: CONTEXTO DE PERSONA
     Persiste a persona escolhida e a torna acessível globalmente
     para preenchimento automático nas demais ferramentas.
     ================================================================ */

  /**
   * Salva o contexto completo da persona selecionada.
   * Deve ser chamado pelas Cartas Personas quando o usuário sorteia/escolhe.
   *
   * @param {Object} personaData
   *   - id: número identificador da persona
   *   - nome: nome da persona
   *   - role: papel/profissão
   *   - quote: fala da persona
   *   - context: contexto narrativo completo
   *   - dilema: dilema de PI da persona
   *   - piType: tipo de PI provável
   *   - dor: dor principal
   *   - ganho: ganho esperado
   *   - tags: array de tags
   *   - legal: base legal
   */
  function savePersonaContext(personaData) {
    if (!personaData) return null;
    var ctx = Object.assign({
      savedAt: nowIso(),
      source: 'cartas-personas'
    }, personaData);
    write(personaContextKey(), ctx);
    // Também salva no progresso da ferramenta cartas-personas
    saveProgress('cartas-personas', { personaSelecionada: ctx });
    // Dispara evento para ferramentas abertas possam reagir
    global.dispatchEvent(new CustomEvent('pi-persona-selected', { detail: ctx }));
    return ctx;
  }

  /**
   * Recupera o contexto da persona selecionada.
   * Retorna null se nenhuma persona foi selecionada ainda.
   */
  function loadPersonaContext() {
    var ctx = read(personaContextKey(), null);
    // fallback: tenta ler do progresso da ferramenta
    if (!ctx) {
      var prog = loadProgress('cartas-personas');
      ctx = prog.personaSelecionada || null;
    }
    return ctx;
  }

  /**
   * Limpa o contexto de persona (usar quando o aluno reinicia a sessão).
   */
  function clearPersonaContext() {
    remove(personaContextKey());
  }

  /**
   * Preenche automaticamente elementos HTML que possuam o atributo
   * data-persona-field com o valor correspondente da persona.
   *
   * Exemplo de uso no HTML:
   *   <textarea data-persona-field="context"></textarea>
   *   <input data-persona-field="nome" />
   *   <input data-persona-field="piType" />
   *
   * Campos suportados: nome, role, quote, context, dilema,
   *   piType, dor, ganho, tags (separados por vírgula), legal
   */
  function autoFillFromPersona(container) {
    var ctx = loadPersonaContext();
    if (!ctx) return false;
    var root = container || document;
    var fields = root.querySelectorAll('[data-persona-field]');
    Array.prototype.forEach.call(fields, function (el) {
      var field = el.getAttribute('data-persona-field');
      if (!field || !(field in ctx)) return;
      var value = ctx[field];
      if (Array.isArray(value)) value = value.join(', ');
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        // Só preenche se estiver vazio (não sobrescreve edições manuais)
        if (!el.value || el.value.trim() === '') {
          el.value = String(value || '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        // Para elementos de exibição (div, span, p)
        if (!el.textContent || el.textContent.trim() === '') {
          el.textContent = String(value || '');
        }
      }
    });
    return true;
  }

  /**
   * Retorna um resumo formatado da persona para exibição nas ferramentas.
   * Útil para mostrar um banner "Você está trabalhando com: [Persona]"
   */
  function getPersonaSummary() {
    var ctx = loadPersonaContext();
    if (!ctx) return null;
    return {
      nome: ctx.nome || '',
      role: ctx.role || '',
      quote: ctx.quote || '',
      piType: ctx.piType || '',
      dor: ctx.dor || '',
      ganho: ctx.ganho || '',
      emoji: ctx.emoji || '🧑',
      savedAt: ctx.savedAt || ''
    };
  }

  /* ================================================================
     CORREÇÃO 2: NAVEGAÇÃO ENTRE FERRAMENTAS
     Fornece utilitários para retornar ao módulo do aluno
     ou avançar para a próxima ferramenta após conclusão.
     ================================================================ */

  /**
   * Obtém URLs de navegação para a ferramenta atual.
   * Retorna { anterior, proxima, modulo } com as URLs relativas.
   */
  function getNavigationLinks(toolId) {
    var id = normalizeToolId(toolId || getPageToolId());
    var percurso = localStorage.getItem('pi-percurso') || '3h';
    var links = { anterior: null, proxima: null, modulo: 'aluno.html' };

    if (global.PIConfig && typeof global.PIConfig.getPrevNext === 'function') {
      var nav = global.PIConfig.getPrevNext(id, percurso);
      if (nav.anterior) links.anterior = nav.anterior.arquivo;
      if (nav.proxima) links.proxima = nav.proxima.arquivo;
    }
    return links;
  }

  /**
   * Injeta um banner de navegação na página da ferramenta.
   * O banner mostra: [← Voltar ao Módulo] [Próxima Ferramenta →]
   * Deve ser chamado após o carregamento da página.
   *
   * @param {Object} options
   *   - container: seletor CSS onde inserir o banner (default: body, após o header ou no topo)
   *   - showPersona: boolean — exibe mini-card da persona ativa
   *   - onComplete: callback chamado quando a ferramenta for marcada concluída
   */
  function injectNavigationBanner(options) {
    var opts = Object.assign({
      container: null,
      showPersona: true,
      position: 'top'
    }, options || {});

    var toolId = getPageToolId();
    var nav = getNavigationLinks(toolId);
    var persona = opts.showPersona ? getPersonaSummary() : null;
    var isCompleted = getToolStore(toolId).metadados.concluido;

    // Evita duplicação
    var existing = document.getElementById('pi-nav-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'pi-nav-banner';
    banner.setAttribute('role', 'navigation');
    banner.setAttribute('aria-label', 'Navegação entre ferramentas do PI Thinking');
    banner.style.cssText = [
      'position: sticky',
      'top: 0',
      'z-index: 1000',
      'background: rgba(15,23,42,0.95)',
      'backdrop-filter: blur(10px)',
      'border-bottom: 1px solid rgba(255,255,255,0.1)',
      'padding: 0.6rem 1rem',
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'gap: 0.5rem',
      'flex-wrap: wrap',
      'font-family: Inter, system-ui, sans-serif',
      'font-size: 0.82rem',
      'color: #fff',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.3)'
    ].join('; ');

    var leftHtml = '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">';
    leftHtml += '<a href="aluno.html" style="color:#94a3b8;text-decoration:none;padding:0.3rem 0.7rem;border:1px solid rgba(148,163,184,0.3);border-radius:6px;transition:all 0.2s;" aria-label="Voltar ao Módulo do Aluno">← Módulo</a>';

    if (persona) {
      leftHtml += '<span style="color:rgba(255,255,255,0.5);padding:0 0.3rem;">|</span>';
      leftHtml += '<span style="color:#fbbf24;font-weight:600;" title="Persona ativa: ' + persona.nome + ' — ' + persona.role + '">' +
        (persona.emoji || '🧑') + ' ' + persona.nome + '</span>';
      leftHtml += '<span style="color:rgba(255,255,255,0.4);font-size:0.75rem;">' + persona.role + '</span>';
    }
    leftHtml += '</div>';

    var rightHtml = '<div style="display:flex;align-items:center;gap:0.5rem;">';

    if (isCompleted) {
      rightHtml += '<span style="background:rgba(22,163,74,0.2);color:#4ade80;border:1px solid rgba(22,163,74,0.4);padding:0.25rem 0.6rem;border-radius:6px;font-weight:600;">✓ Concluída</span>';
    }

    if (nav.proxima) {
      var proximaLabel = 'Próxima';
      if (global.PIConfig && typeof global.PIConfig.getTool === 'function') {
        var proximaTool = global.PIConfig.getTool(nav.proxima.replace(/\.html$/i, ''));
        if (proximaTool) proximaLabel = proximaTool.nome;
      }
      rightHtml += '<a href="' + nav.proxima + '" id="pi-nav-next" style="background:#4361ee;color:#fff;text-decoration:none;padding:0.3rem 0.8rem;border-radius:6px;font-weight:600;transition:all 0.2s;" aria-label="Ir para a próxima ferramenta: ' + proximaLabel + '">' + proximaLabel + ' →</a>';
    } else {
      rightHtml += '<a href="aluno.html" style="background:#16a34a;color:#fff;text-decoration:none;padding:0.3rem 0.8rem;border-radius:6px;font-weight:600;" aria-label="Voltar ao Módulo do Aluno">✓ Ver Percurso</a>';
    }
    rightHtml += '</div>';

    banner.innerHTML = leftHtml + rightHtml;

    var target = opts.container ? document.querySelector(opts.container) : null;
    if (target) {
      target.insertBefore(banner, target.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    // Listener para atualizar o banner quando a ferramenta for concluída
    global.addEventListener('pi-tool-completed', function (e) {
      if (normalizeToolId(e.detail.toolId) === toolId) {
        var badge = banner.querySelector('#pi-nav-completed-badge');
        if (!badge) {
          var completedBadge = document.createElement('span');
          completedBadge.id = 'pi-nav-completed-badge';
          completedBadge.style.cssText = 'background:rgba(22,163,74,0.2);color:#4ade80;border:1px solid rgba(22,163,74,0.4);padding:0.25rem 0.6rem;border-radius:6px;font-weight:600;';
          completedBadge.textContent = '✓ Concluída';
          var rightDiv = banner.querySelector('div:last-child');
          if (rightDiv) rightDiv.insertBefore(completedBadge, rightDiv.firstChild);
        }
      }
    });

    return banner;
  }

  /* ── Demais métodos (inalterados) ── */

  function serializeForm(container) {
    var root = container || document;
    var fields = root.querySelectorAll('input[name], textarea[name], select[name]');
    var data = {};
    Array.prototype.forEach.call(fields, function (f) {
      if (f.type === 'radio') { if (f.checked) data[f.name] = f.value; return; }
      if (f.type === 'checkbox') {
        if (!Array.isArray(data[f.name])) data[f.name] = [];
        if (f.checked) data[f.name].push(f.value || true);
        return;
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
        f.checked = Array.isArray(v) ? v.indexOf(f.value) !== -1 : !!v;
        return;
      }
      f.value = v;
    });
  }

  function startAutoSave(config) {
    var s = Object.assign({
      toolId: getPageToolId(),
      container: document,
      mode: 'form',
      delay: AUTOSAVE_DELAY,
      capture: null
    }, config || {});
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
    var out = {
      exportadoEm: nowIso(),
      usuario: getUserProfile(),
      completions: getCompletedIndex(),
      ferramentas: {}
    };
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf(prefix) === 0) out.ferramentas[k.replace(prefix, '')] = read(k, {});
    });
    return out;
  }

  function importState(snapshot, options) {
    var data = snapshot || {};
    Object.keys(data.ferramentas || {}).forEach(function (id) {
      saveToolStore(id, data.ferramentas[id],
        Object.assign({}, options || {}, { skipSync: true, origin: 'import' }));
    });
    if (data.completions) write(completionsKey(), data.completions);
    return true;
  }

  function saveSessionContext(ctx) {
    var c = read(storageKey('session-context'), {});
    return write(storageKey('session-context'), Object.assign(c, ctx || {}));
  }

  function loadSessionContext() {
    return read(storageKey('session-context'), {});
  }

  function getCurrentToolMeta() {
    var id = getPageToolId();
    return {
      toolId: id,
      tool: global.PIConfig && typeof global.PIConfig.getTool === 'function'
        ? global.PIConfig.getTool(id) : null,
      store: getToolStore(id)
    };
  }

  function saveSnapshot(toolId, snapshot) {
    return saveToolStore(toolId, snapshot || {}, { origin: 'snapshot' });
  }

  var api = {
    version: '3.3.0',
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
    getCurrentToolMeta: getCurrentToolMeta,
    // CORREÇÃO 4: persona context
    savePersonaContext: savePersonaContext,
    loadPersonaContext: loadPersonaContext,
    clearPersonaContext: clearPersonaContext,
    autoFillFromPersona: autoFillFromPersona,
    getPersonaSummary: getPersonaSummary,
    // CORREÇÃO 2: navegação
    getNavigationLinks: getNavigationLinks,
    injectNavigationBanner: injectNavigationBanner
  };

  global.PIToolBridge = api;
  global.PIThinking = Object.assign(global.PIThinking || {}, api, {
    loadProgressSafe: function (toolId) {
      return getToolStore(toolId || getPageToolId());
    }
  });
})(window);
