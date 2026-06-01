/* ================================================================
   PI THINKING — Script Global do Site
   ================================================================
   Interações compartilhadas para páginas estruturais e ferramentas.
   Compatível com o novo config-ferramentas.js.
   ================================================================ */

(function (global, document) {
    'use strict';

    var PIUI = {
        init: init,
        renderInstitutionalLogos: renderInstitutionalLogos,
        renderSequenceNavigation: renderSequenceNavigation,
        getCurrentToolId: getCurrentToolId,
        applyToolMetadata: applyToolMetadata,
        initTheme: initTheme
    };

    function init() {
        initTheme();
        initMobileNav();
        initHeaderScroll();
        initBackToTop();
        initReadingProgress();
        initSmoothAnchors();
        applyToolMetadata();
        hidePreloader();
    }

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function getCurrentToolId() {
        var bodyId = document.body && document.body.getAttribute('data-tool-id');
        if (bodyId) return normalizeToolId(bodyId);
        var file = (global.location.pathname || '').split('/').pop() || '';
        return normalizeToolId(file.replace(/\.html$/i, ''));
    }

    function normalizeToolId(id) {
        return global.PIConfig && typeof global.PIConfig.normalizeId === 'function'
            ? global.PIConfig.normalizeId(id)
            : String(id || '').trim().replace(/\.html$/i, '').toLowerCase();
    }

    function initTheme() {
        var toggle = qs('[data-theme-toggle], .theme-toggle');
        var storedTheme = localStorage.getItem('pi-theme') || document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(storedTheme);

        if (!toggle) return;
        toggle.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) document.body.setAttribute('data-theme', theme);
        localStorage.setItem('pi-theme', theme);
    }

    function initMobileNav() {
        var toggle = qs('.header__toggle');
        var nav = qs('.nav');
        if (!toggle || !nav) return;

        toggle.addEventListener('click', function () {
            toggle.classList.toggle('active');
            nav.classList.toggle('nav--active');
            toggle.setAttribute('aria-expanded', nav.classList.contains('nav--active') ? 'true' : 'false');
        });

        qsa('.nav__dropdown > .nav__link, .nav__dropdown > button', nav).forEach(function (trigger) {
            trigger.addEventListener('click', function () {
                if (global.innerWidth > 768) return;
                var wrapper = trigger.closest('.nav__dropdown');
                if (wrapper) wrapper.classList.toggle('nav__dropdown--active');
            });
        });
    }

    function initHeaderScroll() {
        var header = qs('.header, .topbar');
        if (!header) return;
        var handler = function () {
            if (global.scrollY > 16) header.classList.add('header--scrolled');
            else header.classList.remove('header--scrolled');
        };
        handler();
        global.addEventListener('scroll', handler, { passive: true });
    }

    function initBackToTop() {
        var button = qs('.back-to-top, .btt');
        if (!button) return;

        var handler = function () {
            if (global.scrollY > 400) button.classList.add('visible');
            else button.classList.remove('visible');
        };

        button.addEventListener('click', function () {
            global.scrollTo({ top: 0, behavior: 'smooth' });
        });

        handler();
        global.addEventListener('scroll', handler, { passive: true });
    }

    function initReadingProgress() {
        var bar = qs('.reading-progress');
        if (!bar) return;
        var handler = function () {
            var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
        };
        handler();
        global.addEventListener('scroll', handler, { passive: true });
    }

    function initSmoothAnchors() {
        qsa('a[href^="#"]').forEach(function (link) {
            link.addEventListener('click', function (event) {
                var href = link.getAttribute('href');
                if (!href || href === '#') return;
                var target = qs(href);
                if (!target) return;
                event.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function hidePreloader() {
        var preloader = qs('.preloader');
        if (!preloader) return;
        global.setTimeout(function () {
            preloader.classList.add('hidden');
        }, 250);
    }

    function applyToolMetadata() {
        if (!global.PIConfig) return;
        var toolId = getCurrentToolId();
        var tool = global.PIConfig.getTool(toolId);
        if (!tool) return;

        var titleTargets = qsa('[data-tool-name]');
        titleTargets.forEach(function (node) {
            node.textContent = tool.nome;
        });

        var phaseTargets = qsa('[data-tool-phase]');
        phaseTargets.forEach(function (node) {
            node.textContent = 'Fase ' + tool.fase + ' — ' + (tool.faseDados ? tool.faseDados.nome : '');
        });

        var classTargets = qsa('[data-tool-classification]');
        classTargets.forEach(function (node) {
            node.textContent = tool.classificacaoDados ? tool.classificacaoDados.rotulo : '';
        });

        if (document.body && !document.body.getAttribute('data-tool-id')) {
            document.body.setAttribute('data-tool-id', tool.id);
        }
    }

    function renderInstitutionalLogos(container, options) {
        if (!container || !global.PIConfig) return null;
        var opts = Object.assign({
            variant: 'hero',
            withLabels: false
        }, options || {});

        container.innerHTML = '';
        container.classList.add('institutional-logos', 'institutional-logos--' + opts.variant);

        global.PIConfig.INSTITUICOES.forEach(function (item) {
            var wrapper = document.createElement(opts.withLabels ? 'figure' : 'div');
            var img = document.createElement('img');
            img.src = item.arquivo;
            img.alt = item.nome;
            img.loading = 'lazy';
            wrapper.appendChild(img);

            if (opts.withLabels) {
                var caption = document.createElement('figcaption');
                caption.className = 'sr-only';
                caption.textContent = item.nome;
                wrapper.appendChild(caption);
            }

            container.appendChild(wrapper);
        });

        return container;
    }

    function renderSequenceNavigation(container, currentToolId, percursoKey) {
        if (!container || !global.PIConfig) return null;
        var currentId = normalizeToolId(currentToolId || getCurrentToolId());
        var sequence = global.PIConfig.getPrevNext(currentId, percursoKey || '4h');
        container.innerHTML = '';
        container.classList.add('sequence-nav');

        [
            { data: sequence.anterior, label: 'Anterior', fallback: 'Início do percurso' },
            { data: sequence.proxima, label: 'Próxima', fallback: 'Fim do percurso' }
        ].forEach(function (item) {
            var element = document.createElement(item.data ? 'a' : 'div');
            element.className = 'sequence-nav__link';
            if (item.data) element.href = item.data.url;

            var eyebrow = document.createElement('span');
            eyebrow.className = 'sequence-nav__eyebrow';
            eyebrow.textContent = item.label;

            var title = document.createElement('strong');
            title.className = 'sequence-nav__title';
            title.textContent = item.data ? item.data.nome : item.fallback;

            var desc = document.createElement('span');
            desc.className = 'sequence-nav__desc';
            if (item.data) {
                desc.textContent = 'Fase ' + item.data.fase + ' — ' + item.data.labelClassificacao;
            } else {
                desc.textContent = 'Navegação sequencial indisponível.';
            }

            element.appendChild(eyebrow);
            element.appendChild(title);
            element.appendChild(desc);
            container.appendChild(element);
        });

        return container;
    }

    document.addEventListener('DOMContentLoaded', init);
    global.PIUI = PIUI;
})(window, document);