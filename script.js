/* ============================================
   PI THINKING — JavaScript
   Lógica de Interação, Tema e Animações
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // === TEMA: DARK / LIGHT MODE ===
    const themeToggle = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;

    // Verifica se o usuário já tem uma preferência salva no navegador
    const savedTheme = localStorage.getItem('pi-thinking-theme');
    
    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
    } else {
        // Define Dark Mode como padrão tecnológico inicial
        htmlElement.setAttribute('data-theme', 'dark');
    }

    // Lógica do botão de alternância
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('pi-thinking-theme', newTheme);
        });
    }

    // === EFEITO HEADER SCROLL ===
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        // Reduz o header e aplica sombra quando rola a página
        if (header) {
            header.classList.toggle('header--scrolled', window.scrollY > 20);
        }
    });

    // === MENU MOBILE (HAMBÚRGUER) ===
    const navToggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');

    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            nav.classList.toggle('nav--open');
            navToggle.classList.toggle('active');
        });

        // Fecha o menu ao clicar em um link
        document.querySelectorAll('.nav__link, .dropdown__link').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('nav--open');
                navToggle.classList.remove('active');
            });
        });
    }

    // === DROPDOWN MOBILE ===
    const dropdowns = document.querySelectorAll('.nav__dropdown');
    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.nav__link--dropdown');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    dropdown.classList.toggle('open');
                }
            });
        }
    });

    // === SCROLL OBSERVER: HIGHLIGHT NAV & PHASES BAR ===
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');
    const phasePills = document.querySelectorAll('.phase-pill');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                
                // 1. Atualiza links da navegação principal
                navLinks.forEach(link => {
                    link.classList.remove('nav__link--active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('nav__link--active');
                    }
                });

                // 2. Atualiza os "Pills" da barra de Fases (Sticky)
                if (id.startsWith('fase')) {
                    phasePills.forEach(pill => {
                        // Remove o estado visual ativo dos outros pills
                        pill.style.opacity = '0.6';
                        pill.style.transform = 'scale(0.95)';
                        
                        // Destaca a fase atual
                        if (pill.getAttribute('href') === `#${id}`) {
                            pill.style.opacity = '1';
                            pill.style.transform = 'scale(1.05)';
                        }
                    });
                } else {
                    // Se não estiver em nenhuma fase, reseta todos para o visual normal
                    phasePills.forEach(pill => {
                        pill.style.opacity = '1';
                        pill.style.transform = 'scale(1)';
                    });
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => sectionObserver.observe(section));

    // === CARDS COM MUITO TEXTO: EXPANDIR / RECOLHER ===
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        const body = card.querySelector('.tool-card__body');

        // Recolhe cards com conteúdo muito longo
        if (body && body.scrollHeight > 250) {
            body.style.maxHeight = '180px';
            body.style.overflow = 'hidden';
            body.style.position = 'relative';

            // Cria botão moderno de "Ler Mais"
            const expandBtn = document.createElement('button');
            expandBtn.textContent = 'Ver Detalhes';
            expandBtn.style.cssText = `
                display: block; width: 100%; padding: 15px 10px 10px; margin-top: 8px;
                background: linear-gradient(to bottom, transparent, var(--card-bg) 40%);
                border: none; color: var(--primary); font-weight: 600; font-family: var(--font-heading);
                cursor: pointer; font-size: 0.85rem; position: absolute;
                bottom: 0; left: 0; text-transform: uppercase; letter-spacing: 0.05em;
                backdrop-filter: blur(2px); transition: color 0.3s;
            `;

            body.appendChild(expandBtn);

            expandBtn.addEventListener('click', () => {
                if (body.style.maxHeight === '180px') {
                    body.style.maxHeight = 'none';
                    expandBtn.textContent = 'Recolher';
                    expandBtn.style.position = 'static';
                    expandBtn.style.background = 'transparent';
                    expandBtn.style.padding = '10px 0 0 0';
                } else {
                    body.style.maxHeight = '180px';
                    expandBtn.textContent = 'Ver Detalhes';
                    expandBtn.style.position = 'absolute';
                    expandBtn.style.background = 'linear-gradient(to bottom, transparent, var(--card-bg) 40%)';
                    expandBtn.style.padding = '15px 10px 10px';
                    // Rola suavemente de volta para o topo do card
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    });

    // === SMOOTH SCROLL ===
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // === ANIMAÇÃO DE ENTRADA SUAVE (STAGGERED FADE-UP) ===
    // Seleciona os elementos que devem aparecer suavemente
    const animateElements = document.querySelectorAll('.tool-card, .stat-card, .digital-tool-card, .download-card, .timeline__item, .ref-card');

    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // Remove o delay para que aconteça na hora que entrar na tela
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { 
        threshold: 0.1, 
        rootMargin: '0px 0px -50px 0px' // Dispara um pouco antes de aparecer totalmente
    });

    // Prepara os elementos antes da rolagem
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
        // Usa uma curva de bezier cúbica para um movimento mais "Apple/Moderno"
        el.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        fadeObserver.observe(el);
    });

});