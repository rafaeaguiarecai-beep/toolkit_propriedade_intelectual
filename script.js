/* ============================================
   PI THINKING — JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // === HEADER SCROLL EFFECT ===
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('header--scrolled', window.scrollY > 10);
    });

    // === MOBILE MENU ===
    const navToggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');

    navToggle.addEventListener('click', () => {
        nav.classList.toggle('nav--open');
        navToggle.classList.toggle('active');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav__link, .dropdown__link').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('nav--open');
            navToggle.classList.remove('active');
        });
    });

    // === MOBILE DROPDOWN ===
    const dropdowns = document.querySelectorAll('.nav__dropdown');
    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.nav__link--dropdown');
        trigger.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                dropdown.classList.toggle('open');
            }
        });
    });

    // === ACTIVE NAV LINK ON SCROLL ===
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -80% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('nav__link--active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('nav__link--active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // === TOOL CARDS — EXPAND/COLLAPSE ===
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        const body = card.querySelector('.tool-card__body');
        const title = card.querySelector('.tool-card__title');

        // Initially collapse cards with lots of content
        if (body && body.scrollHeight > 250) {
            body.style.maxHeight = '200px';
            body.style.overflow = 'hidden';
            body.style.position = 'relative';

            // Create "read more" button
            const expandBtn = document.createElement('button');
            expandBtn.textContent = '▼ Ver ferramenta completa';
            expandBtn.style.cssText = `
                display: block; width: 100%; padding: 10px; margin-top: 8px;
                background: linear-gradient(to bottom, transparent, white 30%);
                border: none; color: var(--primary, #1565C0); font-weight: 600;
                cursor: pointer; font-size: 0.85rem; position: absolute;
                bottom: 0; left: 0; padding-top: 40px;
            `;

            body.appendChild(expandBtn);

            expandBtn.addEventListener('click', () => {
                if (body.style.maxHeight === '200px') {
                    body.style.maxHeight = 'none';
                    body.style.overflow = 'visible';
                    expandBtn.textContent = '▲ Recolher';
                    expandBtn.style.position = 'static';
                    expandBtn.style.background = 'none';
                    expandBtn.style.paddingTop = '10px';
                } else {
                    body.style.maxHeight = '200px';
                    body.style.overflow = 'hidden';
                    expandBtn.textContent = '▼ Ver ferramenta completa';
                    expandBtn.style.position = 'absolute';
                    expandBtn.style.background = 'linear-gradient(to bottom, transparent, white 30%)';
                    expandBtn.style.paddingTop = '40px';
                }
            });
        }
    });

    // === SMOOTH SCROLL FOR PHASE PILLS ===
    document.querySelectorAll('.phase-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(pill.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // === ANIMATION ON SCROLL (simple fade-in) ===
    const animateElements = document.querySelectorAll('.tool-card, .stat-card, .digital-tool-card, .download-card, .timeline__item');

    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        fadeObserver.observe(el);
    });

});
