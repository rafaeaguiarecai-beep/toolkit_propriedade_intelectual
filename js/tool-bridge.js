/* ================================================================
   PI THINKING — Tool Bridge v3.4
   Correções v3.4:
   - Banner de navegação completamente refeito para mobile-first
   - Botão "✓ Concluir Ferramenta" sempre visível quando não concluída
   - Layout responsivo: colapsa em coluna no mobile sem quebrar
   - Cartas Personas: botão de conclusão funcional integrado
   - Banner não conflita com headers existentes (usa posicionamento relativo)
   - Persona mini-card escondido no mobile para economizar espaço
   - Z-index corrigido para não sobrepor modais e dropdowns nativos
   ================================================================ */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'pi-thinking';
  var AUTOSAVE_DELAY = 500;
  var timers = {};
  var autoSaveRegistry = {};
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
     CONTEXTO DE PERSONA
     ================================================================ */

  function savePersonaContext(personaData) {
    if (!personaData) return null;
    var ctx = Object.assign({ savedAt: nowIso(), source: 'cartas-personas' }, personaData);
    write(personaContextKey(), ctx);
    saveProgress('cartas-personas', { personaSelecionada: ctx });
    global.dispatchEvent(new CustomEvent('pi-persona-selected', { detail: ctx }));
    return ctx;
  }

  function loadPersonaContext() {
    var ctx = read(personaContextKey(), null);
    if (!ctx) {
      var prog = loadProgress('cartas-personas');
      ctx = prog.personaSelecionada || null;
    }
    return ctx;
  }

  function clearPersonaContext() {
    remove(personaContextKey());
  }

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
        if (!el.value || el.value.trim() === '') {
          el.value = String(value || '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        if (!el.textContent || el.textContent.trim() === '') {
          el.textContent = String(value || '');
        }
      }
    });
    return true;
  }

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
     NAVEGAÇÃO ENTRE FERRAMENTAS — v3.4 MOBILE-FIRST
     ================================================================ */

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
   * Retorna o nome amigável de uma ferramenta pelo arquivo ou ID.
   */
  function getToolLabel(fileOrId) {
    if (!fileOrId) return '';
    if (global.PIConfig && typeof global.PIConfig.getTool === 'function') {
      var tool = global.PIConfig.getTool(fileOrId.replace(/\.html$/i, ''));
      if (tool) return tool.icone + ' ' + tool.nome;
    }
    return fileOrId.replace(/\.html$/i, '').replace(/-/g, ' ');
  }

  /**
   * Injeta CSS do banner uma única vez no <head>.
   * Separar o CSS do JS facilita manutenção e garante
   * que media queries funcionem corretamente.
   */
  function injectBannerCSS() {
    if (document.getElementById('pi-nav-banner-style')) return;
    var style = document.createElement('style');
    style.id = 'pi-nav-banner-style';
    style.textContent = [
      /* ── Wrapper externo ── */
      '#pi-nav-banner {',
      '  position: sticky;',
      '  top: 0;',
      '  z-index: 900;',       /* abaixo de modais (1000+) mas acima do conteúdo */
      '  background: rgba(15,23,42,0.97);',
      '  backdrop-filter: blur(12px);',
      '  -webkit-backdrop-filter: blur(12px);',
      '  border-bottom: 1px solid rgba(255,255,255,0.08);',
      '  box-shadow: 0 2px 12px rgba(0,0,0,0.35);',
      '  font-family: Inter, system-ui, -apple-system, sans-serif;',
      '  font-size: 0.82rem;',
      '  color: #fff;',
      '  padding: 0;',
      '  line-height: 1.4;',
      '}',

      /* ── Linha interna ── */
      '#pi-nav-banner .pnb-inner {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 0.5rem;',
      '  padding: 0.55rem 1rem;',
      '  flex-wrap: nowrap;',   /* nunca quebra linha — botões prioritários */
      '  min-height: 48px;',
      '}',

      /* ── Lado esquerdo ── */
      '#pi-nav-banner .pnb-left {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 0.4rem;',
      '  flex-shrink: 0;',
      '  min-width: 0;',
      '}',

      /* ── Persona chip (escondido no mobile pequeno) ── */
      '#pi-nav-banner .pnb-persona {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 0.3rem;',
      '  background: rgba(251,191,36,0.15);',
      '  border: 1px solid rgba(251,191,36,0.25);',
      '  border-radius: 20px;',
      '  padding: 0.2rem 0.55rem;',
      '  font-size: 0.75rem;',
      '  font-weight: 600;',
      '  color: #fbbf24;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  max-width: 180px;',
      '}',
      '#pi-nav-banner .pnb-persona-name {',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',

      /* ── Lado direito ── */
      '#pi-nav-banner .pnb-right {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 0.4rem;',
      '  flex-shrink: 0;',
      '}',

      /* ── Botões base ── */
      '#pi-nav-banner .pnb-btn {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.3rem;',
      '  padding: 0.38rem 0.75rem;',
      '  border-radius: 6px;',
      '  font-family: inherit;',
      '  font-size: 0.78rem;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  text-decoration: none;',
      '  border: 1px solid transparent;',
      '  transition: background 0.2s, transform 0.15s;',
      '  white-space: nowrap;',
      '  line-height: 1;',
      '}',
      '#pi-nav-banner .pnb-btn:hover { transform: translateY(-1px); }',
      '#pi-nav-banner .pnb-btn:active { transform: scale(0.97); }',

      /* Botão módulo */
      '#pi-nav-banner .pnb-btn-modulo {',
      '  background: rgba(255,255,255,0.1);',
      '  color: rgba(255,255,255,0.85);',
      '  border-color: rgba(255,255,255,0.15);',
      '}',
      '#pi-nav-banner .pnb-btn-modulo:hover {',
      '  background: rgba(255,255,255,0.18);',
      '}',

      /* Botão concluir */
      '#pi-nav-banner .pnb-btn-concluir {',
      '  background: #2563eb;',
      '  color: #fff;',
      '  border-color: #1d4ed8;',
      '}',
      '#pi-nav-banner .pnb-btn-concluir:hover {',
      '  background: #1d4ed8;',
      '}',

      /* Botão próxima */
      '#pi-nav-banner .pnb-btn-proxima {',
      '  background: #16a34a;',
      '  color: #fff;',
      '  border-color: #15803d;',
      '}',
      '#pi-nav-banner .pnb-btn-proxima:hover {',
      '  background: #15803d;',
      '}',

      /* Badge concluída */
      '#pi-nav-banner .pnb-badge-done {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.25rem;',
      '  background: rgba(22,163,74,0.2);',
      '  color: #4ade80;',
      '  border: 1px solid rgba(22,163,74,0.4);',
      '  padding: 0.3rem 0.6rem;',
      '  border-radius: 6px;',
      '  font-size: 0.75rem;',
      '  font-weight: 700;',
      '  white-space: nowrap;',
      '}',

      /* ── MOBILE ≤ 480px ── */
      '@media (max-width: 480px) {',
      '  #pi-nav-banner .pnb-inner {',
      '    padding: 0.45rem 0.75rem;',
      '    min-height: 44px;',
      '  }',
      /* Esconde a persona no mobile muito pequeno */
      '  #pi-nav-banner .pnb-persona { display: none; }',
      /* Reduz tamanho dos botões */
      '  #pi-nav-banner .pnb-btn {',
      '    padding: 0.35rem 0.6rem;',
      '    font-size: 0.74rem;',
      '  }',
      /* Esconde o texto longo do botão módulo, mantém apenas o ícone */
      '  #pi-nav-banner .pnb-btn-modulo .pnb-label { display: none; }',
      '}',

      /* ── MOBILE ≤ 360px (telas muito pequenas) ── */
      '@media (max-width: 360px) {',
      '  #pi-nav-banner .pnb-btn {',
      '    padding: 0.3rem 0.5rem;',
      '    font-size: 0.7rem;',
      '  }',
      /* No botão proxima, esconde label e mostra só ícone */
      '  #pi-nav-banner .pnb-btn-proxima .pnb-label { display: none; }',
      '  #pi-nav-banner .pnb-btn-concluir .pnb-label { display: none; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * Injeta o banner de navegação.
   *
   * Lógica de botões:
   *  - SEMPRE: botão "← Módulo" (volta ao aluno.html)
   *  - SE NÃO CONCLUÍDA: botão "✓ Concluir" (chama markComplete + atualiza banner)
   *  - SE CONCLUÍDA + TEM PRÓXIMA: badge "✓ Concluída" + botão "Próxima →"
   *  - SE CONCLUÍDA + SEM PRÓXIMA: badge "✓ Concluída" + botão "Ver Percurso"
   *
   * @param {Object} options
   *   - showPersona {boolean} — exibe chip da persona ativa (default: true)
   *   - container {string|null} — seletor CSS onde inserir (default: início do body)
   *   - onComplete {function|null} — callback após marcar como concluída
   */
  function injectNavigationBanner(options) {
    var opts = Object.assign({
      showPersona: true,
      container: null,
      onComplete: null
    }, options || {});

    /* Injeta CSS uma única vez */
    injectBannerCSS();

    var toolId = getPageToolId();
    var nav = getNavigationLinks(toolId);
    var persona = opts.showPersona ? getPersonaSummary() : null;

    /* Remove banner anterior se já existir */
    var existing = document.getElementById('pi-nav-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'pi-nav-banner';
    banner.setAttribute('role', 'navigation');
    banner.setAttribute('aria-label', 'Navegação entre ferramentas PI Thinking');

    /* Reconstrói o conteúdo do banner */
    function buildBannerContent() {
      var completed = isCompleted(toolId);

      /* ── Lado esquerdo ── */
      var leftHtml = '<div class="pnb-left">';

      /* Botão módulo — sempre presente */
      leftHtml += '<a href="aluno.html" class="pnb-btn pnb-btn-modulo" aria-label="Voltar ao Módulo do Aluno">' +
        '← <span class="pnb-label">Módulo</span>' +
        '</a>';

      /* Chip de persona — se disponível */
      if (persona) {
        leftHtml += '<div class="pnb-persona" title="' + persona.nome + ' — ' + persona.role + '">' +
          '<span>' + (persona.emoji || '🧑') + '</span>' +
          '<span class="pnb-persona-name">' + persona.nome + '</span>' +
          '</div>';
      }

      leftHtml += '</div>';

      /* ── Lado direito ── */
      var rightHtml = '<div class="pnb-right">';

      if (!completed) {
        /* Ferramenta não concluída: mostra botão de concluir */
        rightHtml += '<button class="pnb-btn pnb-btn-concluir" id="pnb-btn-complete" ' +
          'aria-label="Marcar esta ferramenta como concluída e avançar">' +
          '✓ <span class="pnb-label">Concluir</span>' +
          '</button>';
      } else {
        /* Ferramenta concluída */
        rightHtml += '<span class="pnb-badge-done">✓ <span class="pnb-label">Concluída</span></span>';

        if (nav.proxima) {
          var proximaLabel = getToolLabel(nav.proxima);
          rightHtml += '<a href="' + nav.proxima + '" class="pnb-btn pnb-btn-proxima" ' +
            'aria-label="Ir para a próxima ferramenta: ' + proximaLabel + '">' +
            '<span class="pnb-label">' + proximaLabel + '</span> →' +
            '</a>';
        } else {
          rightHtml += '<a href="aluno.html" class="pnb-btn pnb-btn-proxima" ' +
            'aria-label="Ver percurso completo no Módulo do Aluno">' +
            '📋 <span class="pnb-label">Ver Percurso</span>' +
            '</a>';
        }
      }

      rightHtml += '</div>';

      banner.innerHTML = '<div class="pnb-inner">' + leftHtml + rightHtml + '</div>';

      /* Vincula o botão de concluir se ele foi renderizado */
      var completeBtn = banner.querySelector('#pnb-btn-complete');
      if (completeBtn) {
        completeBtn.addEventListener('click', function () {
          /* Feedback visual imediato */
          completeBtn.textContent = '⏳';
          completeBtn.disabled = true;

          /* Chama markComplete */
          markComplete(toolId, {});

          /* Callback personalizado se fornecido */
          if (typeof opts.onComplete === 'function') {
            opts.onComplete(toolId);
          }

          /* Reconstrói o banner para mostrar "Concluída + Próxima" */
          buildBannerContent();
        });
      }
    }

    /* Constrói conteúdo inicial */
    buildBannerContent();

    /* Insere o banner */
    var target = opts.container ? document.querySelector(opts.container) : null;
    if (target) {
      target.insertBefore(banner, target.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    /* Escuta o evento de conclusão vindo de outros lugares (ex: botão interno da ferramenta) */
    global.addEventListener('pi-tool-completed', function (e) {
      if (normalizeToolId(e.detail.toolId) === toolId) {
        buildBannerContent();
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
    version: '3.4.0',
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
    savePersonaContext: savePersonaContext,
    loadPersonaContext: loadPersonaContext,
    clearPersonaContext: clearPersonaContext,
    autoFillFromPersona: autoFillFromPersona,
    getPersonaSummary: getPersonaSummary,
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
