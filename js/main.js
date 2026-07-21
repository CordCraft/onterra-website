/* =========================================================
   ONTERRA, interactions + GSAP scroll animations
   ========================================================= */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Preloader ---------- */
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('preloaderBar');
  let prog = 0;
  const fakeLoad = setInterval(() => {
    prog = Math.min(100, prog + Math.random() * 26);
    if (bar) bar.style.width = prog + '%';
    if (prog >= 100) clearInterval(fakeLoad);
  }, 140);

  window.addEventListener('load', () => {
    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      if (preloader) preloader.classList.add('is-done');
      playHero();
    }, 350);
  });
  // Safety: never trap the user behind the loader
  setTimeout(() => { if (preloader) preloader.classList.add('is-done'); }, 4000);

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('header');
  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (burger && nav) {
    const toggle = (open) => {
      const isOpen = open ?? !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', isOpen);
      burger.classList.toggle('is-open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
    };
    burger.addEventListener('click', () => toggle());
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
  }

  /* ---------- Hero intro ---------- */
  function playHero() {
    if (!hasGSAP || reduceMotion) {
      document.querySelectorAll('.hero__title .line>span, .hero .reveal-up')
        .forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to('.hero__title .line>span', { y: '0%', duration: 1.1, stagger: 0.12 })
      .to('.hero .reveal-up', { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 }, '-=0.6');
  }

  /* ---------- Generic reveal-on-scroll ---------- */
  function setupReveals() {
    const items = document.querySelectorAll('.reveal-up:not(.hero .reveal-up)');
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) {
      items.forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }
    items.forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });
  }

  /* ---------- Animated counters ---------- */
  function setupCounters() {
    const nums = document.querySelectorAll('[data-count]');
    nums.forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const run = () => {
        if (reduceMotion || !hasGSAP) { el.textContent = end; return; }
        const obj = { v: 0 };
        gsap.to(obj, {
          v: end, duration: 1.6, ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(obj.v); },
        });
      };
      if (window.ScrollTrigger) {
        ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: run });
      } else { run(); }
    });
  }

  /* ---------- Section image lazy-load (with fallback) ---------- */
  function setupImages() {
    const phs = document.querySelectorAll('.ph[data-src]');
    phs.forEach((ph) => {
      const src = ph.dataset.src;
      const seed = ph.dataset.seed || 'oil';
      const img = new Image();
      img.alt = '';
      img.addEventListener('load', () => ph.classList.add('is-loaded'));
      img.addEventListener('error', () => {
        if (img.dataset.fb) return;
        img.dataset.fb = '1';
        img.src = `https://picsum.photos/seed/onterra-${seed}/1000/1200`;
      });
      img.src = src;
      ph.appendChild(img);
    });
  }

  /* ---------- Timeline progressive line ---------- */
  function setupTimeline() {
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) return;
    gsap.from('.timeline__dot', {
      scale: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(2)',
      scrollTrigger: { trigger: '.timeline', start: 'top 80%' },
    });
  }

  /* ---------- Subtle parallax on media ---------- */
  function setupParallax() {
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) return;
    document.querySelectorAll('.ph img, .about__media, .cap__media').forEach((el) => {
      gsap.to(el, {
        yPercent: -8, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ---------- Contact form → WhatsApp ---------- */
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (document.getElementById('cf-name').value || '').trim();
      const company = (document.getElementById('cf-company').value || '').trim();
      const stage = document.getElementById('cf-stage').value;
      const msg = (document.getElementById('cf-msg').value || '').trim();
      const text =
        `Hello Onterra,%0A%0AName: ${encodeURIComponent(name)}` +
        (company ? `%0ACompany: ${encodeURIComponent(company)}` : '') +
        `%0AStage: ${encodeURIComponent(stage)}` +
        (msg ? `%0A%0A${encodeURIComponent(msg)}` : '');
      window.open(`https://wa.me/2348147669552?text=${text}`, '_blank', 'noopener');
    });
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- init ---------- */
  setupImages();
  setupReveals();
  setupCounters();
  setupTimeline();
  setupParallax();
})();
