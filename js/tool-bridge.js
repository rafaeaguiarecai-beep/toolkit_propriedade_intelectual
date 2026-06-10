/* ================================================================
   PI THINKING — Tool Bridge v3.5.1
   Correções v3.5.1:
   - markComplete: sincroniza com Firebase e aguarda confirmação
     antes de liberar navegação (evento pi-tool-synced)
   - Botão Concluir do banner: redireciona para aluno.html?returned=toolId
     após confirmação do Firebase ou timeout de 3s
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
      metadados: { criadoEm: nowIso(), atualizadoEm: nowIso(), concluido: false, ultimaOrigem: 'local' },
      eventos: []
    };
  }

  function getToolStore(toolId) {
    var id = normalizeToolId(toolId || getPageToolId());
    return read(toolKey(id), defaultToolStore(id));
  }

  /* FIX análise: antes de sincronizar, extrai dados planos para
     que o Dashboard consiga ler sem aninhamentos */
  function flattenStoreForSync(store) {
    var flat = merge({}, store);
    /* Se progresso tem sub-chave 'progresso', achata */
    if (flat.progresso && flat.progresso.progresso) {
      flat.progresso = merge(flat.progresso, flat.progresso.progresso);
      delete flat.progresso.progresso;
    }
    return flat;
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
    /* FIX: envia versão achatada para que Dashboard leia corretamente */
    global.PISync.sendToolState(toolId, flattenStoreForSync(store));
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
    /* FIX: salva dados de progresso DIRETAMENTE em progresso (sem aninhamento)
       para que o Dashboard leia p.toolStates[id].progresso.trl diretamente */
    var current = getToolStore(id);
    var currentProg = current.progresso || {};
    /* Remove aninhamento duplo se existir */
    if (currentProg.progresso) currentProg = merge(currentProg, currentProg.progresso);
    var newProg = merge(currentProg, progressData || {});
    return saveToolStore(id, {
      progresso: newProg,
      metadados: { ultimoSaveEm: nowIso() }
    }, options);
  }

  function loadProgress(toolId) {
    var store = getToolStore(toolId);
    var prog = store.progresso || {};
    /* Desnormaliza se houver aninhamento */
    if (prog.progresso) return merge(prog, prog.progresso);
    return prog;
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

    /* 1. Salva localmente de imediato */
    var store = saveToolStore(id, {
      metadados: { concluido: true, concluidoEm: nowIso() },
      progresso: merge(loadProgress(id), payload || {})
    }, options);

    /* 2. Atualiza índice de conclusões local */
    updateCompletionIndex(id, store);

    /* 3. Notifica AlunoEngine em memória */
    if (global.AlunoEngine && typeof global.AlunoEngine.completeTool === 'function') {
      global.AlunoEngine.completeTool(id, payload || {});
    }

    /* 4. Registra evento local */
    appendEvent(id, 'conclusao', payload || {});

    /* 5. Dispara evento DOM (banner e análise reagem aqui) */
    global.dispatchEvent(new CustomEvent('pi-tool-completed', {
      detail: { toolId: id, payload: payload || {} }
    }));

    /* 6. Sincroniza com Firebase — aguarda confirmação antes de liberar navegação */
    if (global.PISync && typeof global.PISync.sendToolState === 'function' &&
        global.PISync.isInSession && global.PISync.isInSession()) {

      try {
        /* sendToolState retorna o resultado de upsertParticipant */
        global.PISync.sendToolState(id, flattenStoreForSync(store));
      } catch(e) {
        /* falha silenciosa — não bloqueia navegação */
      }

      /* Aguarda Firebase confirmar escrita (máx 3s) antes de sinalizar pronto */
      var db = global.firebase && global.firebase.apps && global.firebase.apps.length
        ? global.firebase.database()
        : null;

      if (db) {
        var sid = localStorage.getItem('pi-session-id');
        var pid = localStorage.getItem('pi-session-participant-id');
        if (sid && pid) {
          /* Escrita direta do flag de conclusão no nó do participante */
          var ref = db.ref(
            'oficinas/' + sid +
            '/participantes/' + pid +
            '/toolStates/' + id + '/metadados/concluido'
          );
          ref.set(true).then(function() {
            /* Firebase confirmou — dispara evento de "pronto para navegar" */
            global.dispatchEvent(new CustomEvent('pi-tool-synced', {
              detail: { toolId: id }
            }));
          }).catch(function() {
            /* Mesmo em falha de rede, libera navegação */
            global.dispatchEvent(new CustomEvent('pi-tool-synced', {
              detail: { toolId: id }
            }));
          });
        } else {
          /* Sem sessão ativa, libera imediatamente */
          global.dispatchEvent(new CustomEvent('pi-tool-synced', { detail: { toolId: id } }));
        }
      } else {
        /* Sem Firebase, libera imediatamente */
        global.dispatchEvent(new CustomEvent('pi-tool-synced', { detail: { toolId: id } }));
      }

    } else {
      /* Fora de sessão, libera imediatamente */
      global.dispatchEvent(new CustomEvent('pi-tool-synced', { detail: { toolId: id } }));
    }

    return store;
  }

  function isCompleted(toolId) { return !!getToolStore(toolId).metadados.concluido; }

  function clearProgress(toolId, options) {
    var id = normalizeToolId(toolId || getPageToolId());
    remove(toolKey(id)); remove(autosaveKey(id));
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

  function getCompletedIndex() { return read(completionsKey(), {}); }

  /* ── PERSONA ── */
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

  function clearPersonaContext() { remove(personaContextKey()); }

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
        if (!el.textContent || el.textContent.trim() === '') { el.textContent = String(value || ''); }
      }
    });
    return true;
  }

  function getPersonaSummary() {
    var ctx = loadPersonaContext();
    if (!ctx) return null;
    return { nome: ctx.nome || '', role: ctx.role || '', quote: ctx.quote || '',
             piType: ctx.piType || '', dor: ctx.dor || '', ganho: ctx.ganho || '',
             emoji: ctx.emoji || '🧑', savedAt: ctx.savedAt || '' };
  }

  /* ================================================================
     NAVEGAÇÃO — v3.5
     FIX PRINCIPAL: banner inserido APÓS qualquer header existente,
     com z-index alto o suficiente para ficar visível sobre ele.
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

  function getToolLabel(fileOrId) {
    if (!fileOrId) return '';
    if (global.PIConfig && typeof global.PIConfig.getTool === 'function') {
      var tool = global.PIConfig.getTool(fileOrId.replace(/\.html$/i, ''));
      if (tool) return tool.nome;
    }
    return fileOrId.replace(/\.html$/i, '').replace(/-/g, ' ');
  }

  /* Injeta CSS do banner no <head> uma única vez.
     Usa z-index: 9500 para ficar acima de qualquer header fixo (tipicamente 1000). */
  function injectBannerCSS() {
    if (document.getElementById('pi-nb-css')) return;
    var s = document.createElement('style');
    s.id = 'pi-nb-css';
    /* Usamos strings separadas por + para evitar problemas de parsing */
    s.textContent =
      '#pi-nav-banner{' +
        'position:relative;' +   /* NÃO sticky aqui — veja wrapper abaixo */
        'z-index:9500;' +
        'background:rgba(15,23,42,0.97);' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
        'border-bottom:1px solid rgba(255,255,255,0.1);' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.4);' +
        'font-family:Inter,system-ui,sans-serif;' +
        'color:#fff;font-size:0.82rem;line-height:1.3;' +
      '}' +
      /* O wrapper externo É sticky, para ficar visível ao rolar */
      '#pi-nav-banner-sticky{' +
        'position:sticky;top:0;z-index:9500;' +
      '}' +
      '#pi-nav-banner .pnb-row{' +
        'display:flex;align-items:center;justify-content:space-between;' +
        'gap:6px;padding:8px 12px;min-height:46px;flex-wrap:nowrap;' +
      '}' +
      '#pi-nav-banner .pnb-left{' +
        'display:flex;align-items:center;gap:6px;flex-shrink:0;min-width:0;' +
      '}' +
      '#pi-nav-banner .pnb-right{' +
        'display:flex;align-items:center;gap:6px;flex-shrink:0;' +
      '}' +
      /* Persona chip */
      '#pi-nav-banner .pnb-chip{' +
        'display:flex;align-items:center;gap:4px;' +
        'background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);' +
        'border-radius:20px;padding:3px 8px;font-size:0.73rem;font-weight:600;' +
        'color:#fbbf24;max-width:160px;overflow:hidden;' +
      '}' +
      '#pi-nav-banner .pnb-chip-name{' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
      '}' +
      /* Botões */
      '#pi-nav-banner .pnb-btn{' +
        'display:inline-flex;align-items:center;gap:4px;' +
        'padding:6px 10px;border-radius:6px;border:1px solid transparent;' +
        'font-family:inherit;font-size:0.77rem;font-weight:600;' +
        'cursor:pointer;text-decoration:none;white-space:nowrap;' +
        'transition:background 0.15s,transform 0.1s;line-height:1;' +
      '}' +
      '#pi-nav-banner .pnb-btn:active{transform:scale(0.96);}' +
      '#pi-nav-banner .pnb-back{' +
        'background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.9);' +
        'border-color:rgba(255,255,255,0.15);' +
      '}' +
      '#pi-nav-banner .pnb-back:hover{background:rgba(255,255,255,0.18);}' +
      '#pi-nav-banner .pnb-done{' +
        'background:#2563eb;color:#fff;border-color:#1d4ed8;' +
      '}' +
      '#pi-nav-banner .pnb-done:hover{background:#1d4ed8;}' +
      '#pi-nav-banner .pnb-next{' +
        'background:#16a34a;color:#fff;border-color:#15803d;' +
      '}' +
      '#pi-nav-banner .pnb-next:hover{background:#15803d;}' +
      '#pi-nav-banner .pnb-badge{' +
        'display:inline-flex;align-items:center;gap:3px;' +
        'background:rgba(22,163,74,0.2);color:#4ade80;' +
        'border:1px solid rgba(22,163,74,0.4);' +
        'padding:4px 8px;border-radius:6px;font-size:0.73rem;font-weight:700;' +
        'white-space:nowrap;' +
      '}' +
      /* Mobile ≤ 520px: esconde persona chip e texto dos botões */
      '@media(max-width:520px){' +
        '#pi-nav-banner .pnb-chip{display:none;}' +
        '#pi-nav-banner .pnb-lbl{display:none;}' +
        '#pi-nav-banner .pnb-btn{padding:6px 8px;font-size:0.72rem;}' +
      '}' +
      /* Mobile ≤ 380px: ainda menor */
      '@media(max-width:380px){' +
        '#pi-nav-banner .pnb-row{padding:6px 8px;min-height:40px;}' +
        '#pi-nav-banner .pnb-badge .pnb-lbl{display:none;}' +
      '}';
    document.head.appendChild(s);
  }

  /* Encontra o melhor ponto de inserção do banner.
     Lógica: se há um <header> ou elemento com classe 'header',
     insere APÓS ele. Caso contrário, insere no início do body. */
  function findInsertionPoint() {
    /* Procura o header principal da página */
    var selectors = [
      'header.header',   /* PI Thinking padrão */
      'header[id]',
      'header',
      '.topbar',
      '.app-bar',
      'nav[role="navigation"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      /* Ignora o próprio banner */
      if (el && el.id !== 'pi-nav-banner' && el.id !== 'pi-nav-banner-sticky') {
        return { parent: el.parentNode, after: el };
      }
    }
    return { parent: document.body, after: null };
  }

  function injectNavigationBanner(options) {
    var opts = Object.assign({ showPersona: true, container: null, onComplete: null }, options || {});

    injectBannerCSS();

    var toolId = getPageToolId();
    var nav = getNavigationLinks(toolId);
    var persona = opts.showPersona ? getPersonaSummary() : null;

    /* Remove banner anterior */
    var existingSticky = document.getElementById('pi-nav-banner-sticky');
    if (existingSticky) existingSticky.remove();
    var existingBanner = document.getElementById('pi-nav-banner');
    if (existingBanner) existingBanner.remove();

    /* Wrapper sticky */
    var stickyWrap = document.createElement('div');
    stickyWrap.id = 'pi-nav-banner-sticky';

    /* Banner interno */
    var banner = document.createElement('div');
    banner.id = 'pi-nav-banner';
    banner.setAttribute('role', 'navigation');
    banner.setAttribute('aria-label', 'Navegação entre ferramentas PI Thinking');
    stickyWrap.appendChild(banner);

    /* Função que constrói/reconstrói o conteúdo do banner */
    function build() {
      var completed = isCompleted(toolId);

      /* ── Esquerda ── */
      var leftHtml = '<div class="pnb-left">';
      leftHtml += '<a href="aluno.html" class="pnb-btn pnb-back" aria-label="Módulo do Aluno">' +
        '← <span class="pnb-lbl">Módulo</span></a>';
      if (persona) {
        leftHtml += '<div class="pnb-chip" title="' + persona.nome + ' — ' + persona.role + '">' +
          '<span>' + (persona.emoji || '🧑') + '</span>' +
          '<span class="pnb-chip-name">' + persona.nome + '</span>' +
          '</div>';
      }
      leftHtml += '</div>';

      /* ── Direita ── */
      var rightHtml = '<div class="pnb-right">';
      if (!completed) {
        rightHtml += '<button class="pnb-btn pnb-done" id="pnb-complete-btn" ' +
          'type="button" aria-label="Marcar como concluída e avançar">' +
          '✓ <span class="pnb-lbl">Concluir</span></button>';

      } else {
        rightHtml += '<span class="pnb-badge">✓ <span class="pnb-lbl">Concluída</span></span>';
        rightHtml += '<button class="pnb-btn pnb-next" id="pnb-continue-btn" ' +
          'type="button" aria-label="Continuar para o módulo do aluno">' +
          '▶ <span class="pnb-lbl">Continuar</span></button>';
      }
      
      rightHtml += '</div>';

      banner.innerHTML = '<div class="pnb-row">' + leftHtml + rightHtml + '</div>';

      /* Vincula botão Concluir */
      var btn = banner.querySelector('#pnb-complete-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          btn.disabled = true;
          btn.innerHTML = '⏳ Salvando...';
          btn.style.opacity = '0.7';

          markComplete(toolId, {});

          if (typeof opts.onComplete === 'function') opts.onComplete(toolId);

          /* Não redireciona aqui — aguarda o usuário clicar em Continuar */
        });
      }

      /* Vincula botão Continuar (aparece após conclusão) */
      var btnContinue = banner.querySelector('#pnb-continue-btn');
      if (btnContinue) {
        btnContinue.addEventListener('click', function () {
          btnContinue.disabled = true;
          btnContinue.innerHTML = '⏳ <span class="pnb-lbl">Aguarde...</span>';
          btnContinue.style.opacity = '0.7';
          window.location.href = 'aluno.html?returned=' + toolId;
        });
      }
    }

    /* Constrói conteúdo inicial */
    build();

    /* Insere no DOM */
    if (opts.container) {
      var target = document.querySelector(opts.container);
      if (target) { target.insertBefore(stickyWrap, target.firstChild); }
      else { document.body.insertBefore(stickyWrap, document.body.firstChild); }
    } else {
      var ins = findInsertionPoint();
      if (ins.after) {
        /* Insere imediatamente APÓS o header */
        ins.after.insertAdjacentElement('afterend', stickyWrap);
      } else {
        ins.parent.insertBefore(stickyWrap, ins.parent.firstChild);
      }
    }

    /* Atualiza ao receber evento de conclusão */
    global.addEventListener('pi-tool-completed', function (e) {
      if (normalizeToolId(e.detail.toolId) === toolId) {
        setTimeout(build, 50);
      }
    });

    return banner;
  }

  /* ── Demais métodos ── */

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
      if (f.type === 'checkbox') { f.checked = Array.isArray(v) ? v.indexOf(f.value) !== -1 : !!v; return; }
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
    return { toolId: id,
             tool: global.PIConfig && typeof global.PIConfig.getTool === 'function' ? global.PIConfig.getTool(id) : null,
             store: getToolStore(id) };
  }

  function saveSnapshot(toolId, snapshot) {
    return saveToolStore(toolId, snapshot || {}, { origin: 'snapshot' });
  }

  var api = {
    version: '3.5.1',
    getPageToolId: getPageToolId, normalizeToolId: normalizeToolId, getUserProfile: getUserProfile,
    saveProgress: saveProgress, loadProgress: loadProgress,
    saveAnswers: saveAnswers, loadAnswers: loadAnswers,
    saveFormData: saveFormData, loadFormData: loadFormData,
    saveSnapshot: saveSnapshot, appendEvent: appendEvent,
    markComplete: markComplete, isCompleted: isCompleted, clearProgress: clearProgress,
    getCompletedIndex: getCompletedIndex,
    startAutoSave: startAutoSave, stopAutoSave: stopAutoSave,
    serializeForm: serializeForm, hydrateForm: hydrateForm, restoreIntoForm: restoreIntoForm,
    exportState: exportState, importState: importState,
    saveSessionContext: saveSessionContext, loadSessionContext: loadSessionContext,
    getCurrentToolMeta: getCurrentToolMeta,
    savePersonaContext: savePersonaContext, loadPersonaContext: loadPersonaContext,
    clearPersonaContext: clearPersonaContext, autoFillFromPersona: autoFillFromPersona,
    getPersonaSummary: getPersonaSummary,
    getNavigationLinks: getNavigationLinks, injectNavigationBanner: injectNavigationBanner
  };

  global.PIToolBridge = api;
  global.PIThinking = Object.assign(global.PIThinking || {}, api, {
    loadProgressSafe: function (toolId) { return getToolStore(toolId || getPageToolId()); }
  });
})(window);