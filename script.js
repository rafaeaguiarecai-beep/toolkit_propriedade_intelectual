/* ==========================================
   PI THINKING v2.0 — SHARED SCRIPT
   Funcionalidades compartilhadas entre todas
   as páginas do toolkit.
   ========================================== */

(function () {
  'use strict';

  /* ═══════════════════════════════════════
     PERSISTENCE API — localStorage helper
     ═══════════════════════════════════════ */
  window.PIThinking = {
    saveProgress: function (key, data) {
      try {
        localStorage.setItem('pit_' + key, JSON.stringify(data));
      } catch (e) {
        // localStorage full or unavailable — fail silently
      }
    },
    loadProgress: function (key) {
      try {
        var raw = localStorage.getItem('pit_' + key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    clearProgress: function (key) {
      try {
        localStorage.removeItem('pit_' + key);
      } catch (e) {
        // fail silently
      }
    }
  };

  /* ═══════════════════════════════════════
     THEME TOGGLE
     ═══════════════════════════════════════ */
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    // Restore saved theme
    var savedTheme = localStorage.getItem('pit_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    themeToggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('pit_theme', next);
      } catch (e) {
        // fail silently
      }
    });
  }

  /* ═══════════════════════════════════════
     HEADER — Scroll behavior
     ═══════════════════════════════════════ */
  var header = document.getElementById('header');
  if (header) {
    var lastScrollY = 0;

    function onHeaderScroll() {
      var scrollY = window.scrollY || window.pageYOffset;
      if (scrollY > 50) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
      lastScrollY = scrollY;
    }

    window.addEventListener('scroll', onHeaderScroll, { passive: true });
    onHeaderScroll(); // run once on load
  }

  /* ═══════════════════════════════════════
     MOBILE NAV TOGGLE
     ═══════════════════════════════════════ */
  var navToggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      nav.classList.toggle('nav--active');
      navToggle.classList.toggle('active');

      // Toggle aria-expanded
      var expanded = navToggle.classList.contains('active');
      navToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });

    // Close nav when clicking a link (mobile)
    var navLinks = nav.querySelectorAll('.nav__link, .dropdown__link');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener('click', function () {
        nav.classList.remove('nav--active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Close nav when clicking outside (mobile)
    document.addEventListener('click', function (e) {
      if (
        nav.classList.contains('nav--active') &&
        !nav.contains(e.target) &&
        !navToggle.contains(e.target)
      ) {
        nav.classList.remove('nav--active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ═══════════════════════════════════════
     MOBILE DROPDOWN TOGGLE
     ═══════════════════════════════════════ */
  var dropdowns = document.querySelectorAll('.nav__dropdown');
  for (var d = 0; d < dropdowns.length; d++) {
    (function (dropdown) {
      var trigger = dropdown.querySelector('.nav__link');
      if (!trigger) return;

      trigger.addEventListener('click', function (e) {
        // Only intercept on mobile (when nav is a side panel)
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdown.classList.toggle('nav__dropdown--active');
        }
      });
    })(dropdowns[d]);
  }

  /* ═══════════════════════════════════════
     READING PROGRESS BAR
     ═══════════════════════════════════════ */
  var readingProgress = document.getElementById('readingProgress');
  if (readingProgress) {
    function updateReadingProgress() {
      var scrollTop = window.scrollY || window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        var progress = (scrollTop / docHeight) * 100;
        readingProgress.style.width = Math.min(progress, 100) + '%';
      }
    }

    window.addEventListener('scroll', updateReadingProgress, { passive: true });
    updateReadingProgress();
  }

  /* ═══════════════════════════════════════
     BACK TO TOP BUTTON
     ═══════════════════════════════════════ */
  var backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    function onBackToTopScroll() {
      var scrollY = window.scrollY || window.pageYOffset;
      if (scrollY > 600) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', onBackToTopScroll, { passive: true });
    onBackToTopScroll();

    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ═══════════════════════════════════════
     REVEAL ON SCROLL (Intersection Observer)
     ═══════════════════════════════════════ */
  var revealElements = document.querySelectorAll('[data-reveal]');
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            // Optionally stop observing after reveal
            // revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    for (var r = 0; r < revealElements.length; r++) {
      revealObserver.observe(revealElements[r]);
    }
  } else {
    // Fallback: reveal all immediately if IntersectionObserver not supported
    for (var rf = 0; rf < revealElements.length; rf++) {
      revealElements[rf].classList.add('revealed');
    }
  }

  /* ═══════════════════════════════════════
     TIMELINE ITEMS — Scroll reveal
     ═══════════════════════════════════════ */
  var timelineItems = document.querySelectorAll('.timeline__item');
  if (timelineItems.length > 0 && 'IntersectionObserver' in window) {
    var timelineObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    for (var t = 0; t < timelineItems.length; t++) {
      timelineObserver.observe(timelineItems[t]);
    }
  } else {
    for (var tf = 0; tf < timelineItems.length; tf++) {
      timelineItems[tf].classList.add('visible');
    }
  }

  /* ═══════════════════════════════════════
     PRELOADER
     ═══════════════════════════════════════ */
  var preloader = document.querySelector('.preloader');
  if (preloader) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        preloader.classList.add('hidden');
      }, 800);
    });

    // Safety fallback: hide preloader after 3s even if load never fires
    setTimeout(function () {
      if (preloader && !preloader.classList.contains('hidden')) {
        preloader.classList.add('hidden');
      }
    }, 3000);
  }

  /* ═══════════════════════════════════════
     FAQ ACCORDION
     ═══════════════════════════════════════ */
  var faqQuestions = document.querySelectorAll('.faq-item__question');
  for (var f = 0; f < faqQuestions.length; f++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      });
    })(faqQuestions[f]);
  }

  /* ═══════════════════════════════════════
     SMOOTH SCROLL for anchor links
     ═══════════════════════════════════════ */
  var anchorLinks = document.querySelectorAll('a[href^="#"]');
  for (var a = 0; a < anchorLinks.length; a++) {
    anchorLinks[a].addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href === '#' || href === '') return;

      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var headerOffset = 80;
        var elementPosition = target.getBoundingClientRect().top;
        var offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });

        // Close mobile nav if open
        if (nav && nav.classList.contains('nav--active')) {
          nav.classList.remove('nav--active');
          if (navToggle) {
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
          }
        }
      }
    });
  }

  /* ═══════════════════════════════════════
     KEYBOARD ACCESSIBILITY — Enter/Space on
     elements with role="button" and tabindex
     ═══════════════════════════════════════ */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var el = e.target;
      if (
        el.getAttribute('role') === 'button' &&
        el.getAttribute('tabindex') !== null
      ) {
        e.preventDefault();
        el.click();
      }
    }
  });

})();
