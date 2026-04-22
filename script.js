// PI THINKING v2.0 - INTERATIVIDADE

document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    initMobileMenu();
    initScrollReveal();
    initCounters();
    initBackToTop();
    initReadingProgress();
    initThemeToggle();
    initHeaderScroll();
    initTimelineAnimation();
    initFaqAccordion();
    initSmoothScroll();
    initPhasesInteraction();
});

function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    window.addEventListener('load', () => {
        setTimeout(() => preloader.classList.add('hidden'), 800);
    });
}

function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('nav--active');
        toggle.classList.toggle('active', isOpen);
        toggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('nav--active');
            toggle.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });

    const dropdowns = nav.querySelectorAll('.nav__dropdown');
    dropdowns.forEach(drop => {
        const link = drop.querySelector('.nav__link--dropdown');
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                drop.classList.toggle('nav__dropdown--active');
                link.setAttribute('aria-expanded', drop.classList.contains('nav__dropdown--active'));
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !toggle.contains(e.target) && nav.classList.contains('nav--active')) {
            nav.classList.remove('nav--active');
            toggle.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    });
}

function initScrollReveal() {
    const reveals = document.querySelectorAll('[data-reveal]');
    if (!reveals.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.revealDelay || 0;
                setTimeout(() => entry.target.classList.add('revealed'), delay);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => observer.observe(el));
}

function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(el) {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(easeOut * target) + suffix;
        if (progress < 1) requestAnimationFrame(update);
        else el.textContent = target + suffix;
    }
    requestAnimationFrame(update);
}

function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 500));
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initReadingProgress() {
    const progress = document.getElementById('readingProgress');
    if (!progress) return;
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (scrollTop / docHeight) * 100 + '%';
    });
}

function initThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const savedTheme = localStorage.getItem('pi-thinking-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pi-thinking-theme', next);
    });
}

function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;
    window.addEventListener('scroll', () => header.classList.toggle('header--scrolled', window.scrollY > 50));
}

function initTimelineAnimation() {
    const items = document.querySelectorAll('[data-timeline]');
    if (!items.length) return;
    const progress = document.getElementById('timelineProgress');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                if (progress) {
                    const visible = document.querySelectorAll('.timeline__item.visible');
                    progress.style.height = (visible.length / items.length) * 100 + '%';
                }
            }
        });
    }, { threshold: 0.3 });
    items.forEach(item => observer.observe(item));
}

function initFaqAccordion() {
    const questions = document.querySelectorAll('.faq-item__question');
    if (!questions.length) return;
    questions.forEach(q => {
        q.addEventListener('click', () => {
            const isExpanded = q.getAttribute('aria-expanded') === 'true';
            questions.forEach(other => other.setAttribute('aria-expanded', 'false'));
            if (!isExpanded) q.setAttribute('aria-expanded', 'true');
        });
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
    });
}

function initPhasesInteraction() {
    const pills = document.querySelectorAll('.phase-pill');
    const steps = document.querySelectorAll('.phases-visual__step');
    pills.forEach(pill => {
        pill.addEventListener('mouseenter', () => {
            const phase = pill.dataset.phase;
            steps.forEach(step => step.classList.toggle('phases-visual__step--active', step.dataset.step === phase));
        });
    });
}
