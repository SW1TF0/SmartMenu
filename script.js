/* ============================================================
   SmartMenuKJ — Interaction layer
   Pure, dependency-free JavaScript.
   Sections:
     1.  Helpers
     2.  Internationalization (EN / BG)
     3.  Navbar (scroll state, mobile menu, active link)
     4.  Scroll progress + back-to-top
     5.  Reveal-on-scroll (IntersectionObserver)
     6.  Scroll-driven background morphing
     7.  Animated stat counters
     8.  Cursor glow + magnetic micro-interactions
     9.  Interactive 4-pillar showcase
     10. Project & service calculator
     11. Auth modal (login / register)
     12. Contact form validation
     13. Toast notifications
     14. Misc (footer year)
   ============================================================ */

(function () {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(hover: none)').matches;

  /* ==========================================================
     0. BACKEND ADAPTER
     The site talks to the real PowerShell/Node API when it is
     served by a backend (self-hosted). When deployed as a static
     site (e.g. GitHub Pages) the API is absent, so it transparently
     falls back to a client-side store (localStorage) — registration,
     login, sessions and contact all still work without a server.

     For real contact delivery on a static host, set CONTACT_ENDPOINT
     to a form service URL (e.g. a Formspree endpoint).
     ========================================================== */
  const CONTACT_ENDPOINT = ''; // e.g. 'https://formspree.io/f/xxxxxxx'

  const Backend = (() => {
    let mode = null;            // 'supabase' | 'server' | 'local'
    let firstMe = null;         // cached result of the initial probe
    const KEY = { users: 'smkj_users', session: 'smkj_session', inq: 'smkj_inquiries' };

    // Optional cloud database (Supabase). When configured it becomes the
    // central store for auth, inquiries and view analytics.
    const CFG = window.SMKJ_CONFIG || {};
    // Accept either the bare project URL or one pasted with /rest/v1 or /auth/v1 — supabase-js needs the base.
    const normSbUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '').replace(/\/+$/, '');
    let sb = null;
    const sbUrl = normSbUrl(CFG.SUPABASE_URL);
    if (sbUrl && CFG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
      try { sb = window.supabase.createClient(sbUrl, CFG.SUPABASE_ANON_KEY); } catch (e) { sb = null; }
    }
    const sbName = (u) => (u && u.user_metadata && u.user_metadata.name) || (u && u.email) || '';

    const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const rid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : 'id' + Date.now().toString(16) + Math.random().toString(16).slice(2));

    async function hashPw(pw, salt) {
      const data = new TextEncoder().encode(salt + ':' + pw);
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', data);
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      let h = 0; const s = salt + ':' + pw;
      for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
      return 'w' + h.toString(16);
    }
    const pub = (u) => ({ id: u.id, name: u.name, email: u.email });

    async function serverCall(path, body, method) {
      const opt = { method: method || 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
      if (body) opt.body = JSON.stringify(body);
      const r = await fetch('/api/' + path, opt);
      const j = await r.json().catch(() => ({}));
      return Object.assign({ ok: r.ok, status: r.status }, j);
    }

    async function localRegister(p) {
      const name = (p.name || '').trim();
      const email = (p.email || '').trim().toLowerCase();
      const password = p.password || '';
      if (name.length < 2) return { ok: false, status: 400, error: 'Please enter your name.' };
      if (!isEmail(email)) return { ok: false, status: 400, error: 'Enter a valid email.' };
      if (password.length < 6) return { ok: false, status: 400, error: 'Password must be at least 6 characters.' };
      const users = lsGet(KEY.users, []);
      if (users.some((u) => u.email === email)) return { ok: false, status: 409, error: 'An account with this email already exists.' };
      const salt = rid();
      const user = { id: rid(), name, email, salt, hash: await hashPw(password, salt), createdAt: new Date().toISOString() };
      users.push(user); lsSet(KEY.users, users); lsSet(KEY.session, user.id);
      return { ok: true, status: 201, user: pub(user) };
    }
    async function localLogin(p) {
      const email = (p.email || '').trim().toLowerCase();
      const users = lsGet(KEY.users, []);
      const u = users.find((x) => x.email === email);
      if (!u || u.hash !== await hashPw(p.password || '', u.salt)) return { ok: false, status: 401, error: 'Invalid email or password.' };
      lsSet(KEY.session, u.id);
      return { ok: true, status: 200, user: pub(u) };
    }
    function localMe() {
      const id = lsGet(KEY.session, null);
      if (!id) return { ok: true, status: 200, user: null };
      const u = lsGet(KEY.users, []).find((x) => x.id === id);
      return { ok: true, status: 200, user: u ? pub(u) : null };
    }
    function localLogout() { try { localStorage.removeItem(KEY.session); } catch (e) {} return { ok: true, status: 200 }; }
    function localContact(p) {
      const inq = lsGet(KEY.inq, []);
      inq.push(Object.assign({ id: rid(), createdAt: new Date().toISOString() }, p));
      lsSet(KEY.inq, inq);
      return { ok: true, status: 201, local: true };
    }

    // ----- Supabase (cloud) implementations -----
    async function sbRegister(p) {
      const name = (p.name || '').trim();
      const email = (p.email || '').trim().toLowerCase();
      const password = p.password || '';
      if (name.length < 2) return { ok: false, status: 400, error: 'Please enter your name.' };
      if (!isEmail(email)) return { ok: false, status: 400, error: 'Enter a valid email.' };
      if (password.length < 6) return { ok: false, status: 400, error: 'Password must be at least 6 characters.' };
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return { ok: false, status: 400, error: error.message };
      const u = data.user;
      return { ok: true, status: 201, user: { id: u && u.id, name, email }, pending: !data.session };
    }
    async function sbLogin(p) {
      const email = (p.email || '').trim().toLowerCase();
      const { data, error } = await sb.auth.signInWithPassword({ email, password: p.password || '' });
      if (error) return { ok: false, status: 401, error: 'Invalid email or password.' };
      const u = data.user;
      return { ok: true, status: 200, user: { id: u.id, name: sbName(u), email: u.email } };
    }
    async function sbLogout() { try { await sb.auth.signOut(); } catch (e) {} return { ok: true, status: 200 }; }
    async function sbMe() {
      const { data } = await sb.auth.getUser();
      const u = data && data.user;
      if (!u) return { ok: true, status: 200, user: null };
      return { ok: true, status: 200, user: { id: u.id, name: sbName(u), email: u.email } };
    }
    async function sbContact(p) {
      const { error } = await sb.from('inquiries').insert({
        name: p.name, email: p.email, phone: p.phone, service: p.service, message: p.message,
      });
      if (error) return { ok: false, status: 400, error: error.message };
      return { ok: true, status: 201 };
    }
    async function sbTrack() {
      try { await sb.from('views').insert({ path: location.pathname }); } catch (e) {}
      return { ok: true };
    }

    async function ensureMode() {
      if (mode) return mode;
      if (sb) { mode = 'supabase'; return mode; }
      try {
        const r = await fetch('/api/me', { credentials: 'same-origin' });
        const ct = r.headers.get('content-type') || '';
        if (r.ok && ct.indexOf('json') !== -1) { mode = 'server'; firstMe = await r.json().catch(() => ({ user: null })); }
        else { mode = 'local'; }
      } catch (e) { mode = 'local'; }
      return mode;
    }

    return {
      async me() {
        await ensureMode();
        if (mode === 'supabase') return sbMe();
        if (mode === 'server') {
          if (firstMe) { const f = firstMe; firstMe = null; return Object.assign({ ok: true, status: 200 }, f); }
          return serverCall('me', null, 'GET');
        }
        return localMe();
      },
      async register(p) {
        await ensureMode();
        return mode === 'supabase' ? sbRegister(p) : mode === 'server' ? serverCall('register', p) : localRegister(p);
      },
      async login(p) {
        await ensureMode();
        return mode === 'supabase' ? sbLogin(p) : mode === 'server' ? serverCall('login', p) : localLogin(p);
      },
      async logout() {
        await ensureMode();
        return mode === 'supabase' ? sbLogout() : mode === 'server' ? serverCall('logout', null) : localLogout();
      },
      async contact(p) {
        await ensureMode();
        if (mode === 'supabase') return sbContact(p);
        if (mode === 'server') return serverCall('contact', p);
        if (CONTACT_ENDPOINT) {
          try {
            const r = await fetch(CONTACT_ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
            if (r.ok) return { ok: true, status: 200 };
          } catch (e) {}
        }
        return localContact(p);
      },
      async trackView() {
        await ensureMode();
        if (mode === 'supabase') return sbTrack();
        if (mode === 'server') { try { await fetch('/api/track', { method: 'POST', credentials: 'same-origin' }); } catch (e) {} return { ok: true }; }
        try { const n = (parseInt(localStorage.getItem('smkj_views') || '0', 10) || 0) + 1; localStorage.setItem('smkj_views', String(n)); } catch (e) {}
        return { ok: true };
      },
      async resetPassword(email) {
        await ensureMode();
        email = (email || '').trim().toLowerCase();
        if (!isEmail(email)) return { ok: false, status: 400, error: 'Enter a valid email.' };
        if (mode === 'supabase') {
          const redirectTo = new URL('reset-password.html', location.href).href;
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
          if (error) return { ok: false, status: 400, error: error.message };
          return { ok: true, status: 200 };
        }
        // Self-hosted/local have no email service — direct the user to contact us.
        return { ok: false, status: 501, error: 'unsupported' };
      },
      hasCloud() { return mode === 'supabase'; },
      isLocal() { return mode === 'local'; },
    };
  })();

  /* ==========================================================
     1. THEME / ACCENT TABLE
     ========================================================== */
  const THEMES = {
    web:   { accent: '#38bdf8', glow: '#0ea5e9', bgA: '#0a1626', bgB: '#05070d', orbA: 'rgba(56,189,248,0.30)',  orbB: 'rgba(14,165,233,0.16)' },
    print: { accent: '#34d399', glow: '#10b981', bgA: '#06231c', bgB: '#05070d', orbA: 'rgba(52,211,153,0.26)',  orbB: 'rgba(16,185,129,0.15)' },
    auto:  { accent: '#fbbf24', glow: '#f59e0b', bgA: '#241a05', bgB: '#05070d', orbA: 'rgba(251,191,36,0.24)',  orbB: 'rgba(245,158,11,0.15)' },
    menu:  { accent: '#fb923c', glow: '#f97316', bgA: '#27160a', bgB: '#05070d', orbA: 'rgba(251,146,60,0.26)',  orbB: 'rgba(249,115,22,0.15)' },
  };

  const root = document.documentElement;
  let currentTheme = 'web';

  function applyTheme(key) {
    const t = THEMES[key];
    if (!t || key === currentTheme) return;
    currentTheme = key;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-glow', t.glow);
    root.style.setProperty('--bg-a', t.bgA);
    root.style.setProperty('--bg-b', t.bgB);
    root.style.setProperty('--orb-a', t.orbA);
    root.style.setProperty('--orb-b', t.orbB);
  }

  /* ==========================================================
     2. INTERNATIONALIZATION
     ========================================================== */
  const LANG_KEY = 'smkj-lang';
  let lang = localStorage.getItem(LANG_KEY) || 'en';

  function applyLanguage(next) {
    lang = next;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;

    // Text content
    $$('[data-i18n]').forEach((el) => {
      const val = el.getAttribute('data-' + lang);
      if (val !== null) el.textContent = val;
    });
    // Placeholders
    $$('[data-i18n-ph]').forEach((el) => {
      const val = el.getAttribute('data-' + lang + '-ph');
      if (val !== null) el.setAttribute('placeholder', val);
    });
    // Toggle UI state
    $$('.lang-opt').forEach((o) =>
      o.classList.toggle('is-active', o.getAttribute('data-lang') === lang)
    );

    // Keep the hero rotator word in sync with the active language
    const rot = document.querySelector('.rotator');
    if (rot && rot.dataset.ri !== undefined) {
      const l = (rot.getAttribute('data-rotate-' + lang) || '').split('|');
      const i = parseInt(rot.dataset.ri, 10) % l.length;
      if (l[i]) rot.textContent = l[i];
    }

    // Recompute any dynamic strings (calculator breakdown)
    if (typeof recalc === 'function') recalc();
  }

  const langToggle = $('#lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      applyLanguage(lang === 'en' ? 'bg' : 'en');
    });
  }
  // Direct clicks on EN / BG labels
  $$('.lang-opt').forEach((o) =>
    o.addEventListener('click', (e) => {
      e.stopPropagation();
      applyLanguage(o.getAttribute('data-lang'));
    })
  );

  // Small i18n helper for runtime strings
  const I18N = {
    selectService: { en: 'Select one or more services to begin.', bg: 'Изберете една или повече услуги, за да започнете.' },
    base:          { en: 'Base package', bg: 'Базов пакет' },
    extraPages:    { en: 'Extra pages', bg: 'Допълнителни страници' },
    units:         { en: 'Units / iterations', bg: 'Бройки / итерации' },
    zones:         { en: 'Zones / rooms', bg: 'Зони / стаи' },
    stands:        { en: 'Physical stands', bg: 'Физически стойки' },
    addons:        { en: 'Add-ons', bg: 'Добавки' },
    toastConfig:   { en: 'Configuration ready — scroll down to send it via the contact form.', bg: 'Конфигурацията е готова — превъртете надолу, за да я изпратите чрез формата.' },
    toastSent:     { en: 'Message sent successfully. Thank you!', bg: 'Съобщението е изпратено успешно. Благодарим!' },
    names: {
      web:   { en: 'Web Development', bg: 'Уеб разработка' },
      print: { en: '3D Printing', bg: '3D печат' },
      auto:  { en: 'Automation', bg: 'Автоматизация' },
      menu:  { en: 'SmartMenu Infrastructure', bg: 'SmartMenu инфраструктура' },
    },
  };
  const t = (obj) => obj[lang] || obj.en;

  /* ==========================================================
     3. NAVBAR
     ========================================================== */
  const navbar = $('#navbar');
  const menuBtn = $('#menu-btn');
  const mobileMenu = $('#mobile-menu');

  function onScrollNav() {
    if (!navbar) return;
    navbar.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  onScrollNav();

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('is-open');
      document.body.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars-staggered';
    });
    // Close on link / button click inside the menu
    $$('.mobile-link, #mobile-menu [href], #mobile-menu button', mobileMenu).forEach((a) =>
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.querySelector('i').className = 'fa-solid fa-bars-staggered';
      })
    );
  }

  // Active nav link via section observation
  const navLinks = $$('.nav-link');
  const linkMap = {};
  navLinks.forEach((l) => {
    const id = l.getAttribute('href').replace('#', '');
    linkMap[id] = l;
  });

  /* ==========================================================
     4. SCROLL PROGRESS + BACK TO TOP
     ========================================================== */
  const progressBar = $('#scroll-progress');
  const toTop = $('#to-top');

  function onScrollProgress() {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (scrolled / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
    if (toTop) toTop.classList.toggle('show', scrolled > 600);
  }

  if (toTop) {
    toTop.addEventListener('click', () =>
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
    );
  }

  // Combined scroll handler (rAF-throttled)
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScrollNav();
        onScrollProgress();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  /* ==========================================================
     5. REVEAL ON SCROLL
     ========================================================== */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !prefersReduced) {
    const revObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.getAttribute('data-reveal-delay') || 0;
            setTimeout(() => entry.target.classList.add('is-visible'), Number(delay));
            revObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );
    revealEls.forEach((el) => revObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ==========================================================
     6. BACKGROUND MORPHING + ACTIVE NAV
     ========================================================== */
  const sections = $$('.section-anchor');
  const railDots = $$('.rail-dot');
  if ('IntersectionObserver' in window) {
    const bgObserver = new IntersectionObserver(
      (entries) => {
        // Choose the most visible intersecting section
        let best = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
          }
        });
        if (best) {
          const theme = best.target.getAttribute('data-bg-theme');
          if (theme) applyTheme(theme);

          // Active nav link
          const id = best.target.id;
          navLinks.forEach((l) => l.classList.remove('is-current'));
          if (linkMap[id]) linkMap[id].classList.add('is-current');

          // Active section rail dot
          railDots.forEach((d) => d.classList.toggle('is-current', d.getAttribute('data-rail') === id));
        }
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: '-20% 0px -40% 0px' }
    );
    sections.forEach((s) => bgObserver.observe(s));
  }

  /* ==========================================================
     7. ANIMATED STAT COUNTERS
     ========================================================== */
  const counters = $$('[data-count]');
  if ('IntersectionObserver' in window && !prefersReduced) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => countObserver.observe(c));
  } else {
    counters.forEach((c) => {
      c.textContent = c.getAttribute('data-count') + (c.getAttribute('data-suffix') || '');
    });
  }

  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-count'), 10) || 0;
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1600;
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ==========================================================
     8. CURSOR GLOW + MAGNETIC BUTTONS
     ========================================================== */
  const cursorGlow = $('#cursor-glow');
  if (cursorGlow && !isCoarse && !prefersReduced) {
    let gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    let cx = gx, cy = gy;
    let rafId = null;

    function followGlow() {
      cx += (gx - cx) * 0.14;
      cy += (gy - cy) * 0.14;
      cursorGlow.style.transform = `translate(${cx}px, ${cy}px)`;
      // Keep animating only while meaningfully far from the target,
      // so the compositor can idle once the glow has settled.
      if (Math.abs(gx - cx) > 0.5 || Math.abs(gy - cy) > 0.5) {
        rafId = requestAnimationFrame(followGlow);
      } else {
        rafId = null;
      }
    }

    window.addEventListener('mousemove', (e) => {
      gx = e.clientX; gy = e.clientY;
      cursorGlow.style.opacity = '0.1';
      if (rafId === null) rafId = requestAnimationFrame(followGlow);
    }, { passive: true });
  }

  // Magnetic effect
  if (!isCoarse && !prefersReduced) {
    $$('.magnetic').forEach((el) => {
      const strength = 0.32;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ==========================================================
     8.5  HERO AMBIENT CANVAS (particle constellation)
     Self-contained, dependency-free animated background that
     tints itself with the live accent colour and links nodes
     near the cursor. Pauses when the hero leaves the viewport
     or the tab is hidden, so the compositor can idle.

     To overlay a REAL ambient video instead, set HERO_VIDEO
     below to your .mp4 URL (e.g. 'assets/hero-loop.mp4') — the
     canvas dims and the video plays behind the headline.
     ========================================================== */
  const HERO_VIDEO = ''; // e.g. 'assets/hero-loop.mp4'

  (function heroAmbient() {
    const canvas = $('#hero-canvas');
    const hero = $('#hero');
    if (!canvas || !hero) return;

    // Optional real video overlay
    if (HERO_VIDEO) {
      const v = $('.hero-video');
      if (v) {
        v.src = HERO_VIDEO;
        v.hidden = false;
        v.setAttribute('autoplay', '');
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => {});
        canvas.style.opacity = '0.45';
      }
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let running = false, rafId = null, frame = 0, heroVisible = true;
    const mouse = { x: -9999, y: -9999, active: false };
    let accent = { r: 56, g: 189, b: 248 };
    const LINK = 138; // px node-to-node connection distance

    function hexToRgb(hex) {
      hex = (hex || '').trim().replace('#', '');
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      if (hex.length < 6) return null;
      const n = parseInt(hex, 16);
      if (isNaN(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function refreshAccent() {
      const rgb = hexToRgb(getComputedStyle(root).getPropertyValue('--accent'));
      if (rgb) accent = rgb;
    }

    function seed() {
      const target = Math.min(90, Math.max(26, Math.round((w * h) / 16000)));
      particles = [];
      for (let i = 0; i < target; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6,
        });
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function draw() {
      const { r, g, b } = accent;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 14000 && d2 > 0.5) {
            const d = Math.sqrt(d2);
            const f = ((14000 - d2) / 14000) * 0.7;
            p.x += (dx / d) * f; p.y += (dy / d) * f;
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const bp = particles[j];
          const dx = a.x - bp.x, dy = a.y - bp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - dist / LINK) * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(bp.x, bp.y);
            ctx.stroke();
          }
        }
        if (mouse.active) {
          const dx = a.x - mouse.x, dy = a.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const reach = LINK * 1.5;
          if (dist < reach) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - dist / reach) * 0.65})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }
    }

    function step() {
      frame++;
      if (frame % 30 === 0) refreshAccent();
      draw();
      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (running || prefersReduced) return;
      running = true;
      rafId = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (!isCoarse) {
      hero.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      }, { passive: true });
      hero.addEventListener('mouseleave', () => {
        mouse.active = false; mouse.x = -9999; mouse.y = -9999;
      });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (heroVisible) start();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            heroVisible = en.isIntersecting;
            if (heroVisible && !document.hidden) start();
            else stop();
          });
        },
        { threshold: 0.02 }
      ).observe(hero);
    }

    refreshAccent();
    resize();
    draw(); // immediate first frame — never a blank hero, even before rAF spins up
    if (!prefersReduced) start();
  })();

  /* ==========================================================
     9. INTERACTIVE SHOWCASE
     ========================================================== */
  const showcaseTabs = $$('.showcase-tab');
  const showcasePanels = $$('.showcase-panel');

  function activateShowcase(key) {
    showcaseTabs.forEach((tab) => {
      const on = tab.getAttribute('data-showcase') === key;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    });
    showcasePanels.forEach((panel) =>
      panel.classList.toggle('is-active', panel.getAttribute('data-panel') === key)
    );
  }

  showcaseTabs.forEach((tab) =>
    tab.addEventListener('click', () => activateShowcase(tab.getAttribute('data-showcase')))
  );

  // Pillar "View solutions" → jump to showcase + activate
  $$('[data-pillar-jump]').forEach((link) =>
    link.addEventListener('click', () => {
      activateShowcase(link.getAttribute('data-pillar-jump'));
    })
  );

  /* ==========================================================
     10. PROJECT & SERVICE CALCULATOR
     ========================================================== */
  const calcCards = $$('.calc-card');
  const breakdownEl = $('#calc-breakdown');
  const totalEl = $('#calc-total');
  const bundleEl = $('#calc-bundle');
  const discountEl = $('#calc-discount');

  const euro = (n) =>
    '€' + Math.round(n).toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-US');

  // Toggle service cards on/off
  $$('.calc-toggle').forEach((toggle) => {
    toggle.addEventListener('change', () => {
      const card = toggle.closest('.calc-card');
      card.classList.toggle('is-on', toggle.checked);
      recalc();
    });
  });

  // Steppers
  $$('.calc-stepper').forEach((stepper) => {
    const input = $('input', stepper);
    const min = Number(stepper.getAttribute('data-min')) || 0;
    const max = Number(stepper.getAttribute('data-max')) || 99;
    $$('button', stepper).forEach((btn) =>
      btn.addEventListener('click', () => {
        let val = parseInt(input.value, 10) || 0;
        val += Number(btn.getAttribute('data-step'));
        val = Math.max(min, Math.min(max, val));
        input.value = val;
        recalc();
      })
    );
  });

  // Selects + addons
  $$('[data-calc-input]').forEach((sel) => sel.addEventListener('change', recalc));
  $$('[data-calc-addon]').forEach((cb) => cb.addEventListener('change', recalc));

  function getStepperVal(name) {
    const stepper = $(`[data-stepper="${name}"]`);
    if (!stepper) return 0;
    return parseInt($('input', stepper).value, 10) || 0;
  }

  function serviceLine(key) {
    const card = $(`.calc-card[data-calc-service="${key}"]`);
    if (!card || !card.classList.contains('is-on')) return null;

    let total = 0;
    const parts = [];

    // Base select
    const sel = $(`[data-calc-input="${key}-type"]`, card);
    if (sel) {
      const base = Number(sel.value) || 0;
      total += base;
      // human label = selected option text up to the dash
      const label = sel.options[sel.selectedIndex].textContent.split('—')[0].trim();
      parts.push(label);
    }

    // Per-unit steppers
    const unitMeta = {
      web:   { stepper: 'web-pages',  label: I18N.extraPages },
      print: { stepper: 'print-units', label: I18N.units },
      auto:  { stepper: 'auto-zones', label: I18N.zones },
      menu:  { stepper: 'menu-stands', label: I18N.stands },
    }[key];
    if (unitMeta) {
      const stepper = $(`[data-stepper="${unitMeta.stepper}"]`);
      const unit = Number(stepper.getAttribute('data-unit')) || 0;
      const qty = getStepperVal(unitMeta.stepper);
      if (qty > 0) {
        total += qty * unit;
        parts.push(`${qty}× ${t(unitMeta.label)}`);
      }
    }

    // Add-ons
    let addonSum = 0;
    $$('[data-calc-addon]', card).forEach((cb) => {
      if (cb.checked) addonSum += Number(cb.getAttribute('data-amount')) || 0;
    });
    if (addonSum > 0) {
      total += addonSum;
      parts.push(t(I18N.addons));
    }

    return { key, total, sub: parts.join(' · ') };
  }

  function recalc() {
    if (!breakdownEl) return;
    const lines = ['web', 'print', 'auto', 'menu']
      .map(serviceLine)
      .filter(Boolean);

    breakdownEl.innerHTML = '';

    if (lines.length === 0) {
      const li = document.createElement('li');
      li.className = 'calc-empty';
      li.textContent = t(I18N.selectService);
      breakdownEl.appendChild(li);
      if (bundleEl) bundleEl.hidden = true;
      setTotal(0);
      return;
    }

    let subtotal = 0;
    lines.forEach((line) => {
      subtotal += line.total;
      const li = document.createElement('li');
      li.innerHTML =
        `<span class="ci-name"><span>${t(I18N.names[line.key])}</span>` +
        (line.sub ? `<span class="ci-sub">${line.sub}</span>` : '') +
        `</span><span class="ci-price">${euro(line.total)}</span>`;
      breakdownEl.appendChild(li);
    });

    // Multi-service bundle discount
    let discount = 0;
    if (lines.length >= 2) {
      const rate = lines.length === 2 ? 0.05 : lines.length === 3 ? 0.08 : 0.12;
      discount = subtotal * rate;
      if (bundleEl) {
        bundleEl.hidden = false;
        discountEl.textContent = '−' + euro(discount);
      }
    } else if (bundleEl) {
      bundleEl.hidden = true;
    }

    setTotal(subtotal - discount);
  }

  function setTotal(value) {
    if (!totalEl) return;
    totalEl.textContent = euro(value);
    totalEl.classList.add('bump');
    setTimeout(() => totalEl.classList.remove('bump'), 200);
  }

  // Send configuration → scroll to contact, prefill, toast
  const calcSend = $('#calc-send');
  if (calcSend) {
    calcSend.addEventListener('click', () => {
      const active = ['web', 'print', 'auto', 'menu'].filter((k) =>
        $(`.calc-card[data-calc-service="${k}"]`).classList.contains('is-on')
      );
      const serviceSelect = $('#cf-service');
      const messageField = $('#cf-message');
      if (active.length && serviceSelect) {
        serviceSelect.value = active.length > 1 ? 'multi' : active[0];
      }
      if (messageField && active.length) {
        const names = active.map((k) => t(I18N.names[k])).join(', ');
        const total = totalEl ? totalEl.textContent : '';
        const tpl = lang === 'bg'
          ? `Здравейте, интересувам се от: ${names}. Прогнозна стойност: ${total}. `
          : `Hello, I'm interested in: ${names}. Estimated value: ${total}. `;
        if (!messageField.value.trim()) messageField.value = tpl;
      }
      showToast(t(I18N.toastConfig), 'fa-circle-check');
      const contact = $('#contact');
      if (contact) contact.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  }

  /* ==========================================================
     11. AUTH MODAL
     ========================================================== */
  const authModal = $('#auth-modal');
  const authTabsWrap = $('.auth-tabs');
  let lastFocused = null;

  function openAuth() {
    if (!authModal) return;
    lastFocused = document.activeElement;
    authModal.classList.add('is-open');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const firstInput = $('.auth-form.is-active input');
    if (firstInput) setTimeout(() => firstInput.focus(), 350);
  }
  function closeAuth() {
    if (!authModal) return;
    authModal.classList.remove('is-open');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  $$('[data-open-auth]').forEach((b) => b.addEventListener('click', openAuth));
  $$('[data-close-auth]').forEach((b) => b.addEventListener('click', closeAuth));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('is-open')) closeAuth();
  });

  // Auth tab switching
  function switchAuthTab(key) {
    if (authTabsWrap) authTabsWrap.setAttribute('data-active', key);
    $$('.auth-tab').forEach((tb) =>
      tb.classList.toggle('is-active', tb.getAttribute('data-auth-tab') === key)
    );
    $$('.auth-form').forEach((f) =>
      f.classList.toggle('is-active', f.getAttribute('data-auth-form') === key)
    );
    const success = $('[data-auth-success]');
    if (success) success.hidden = true;
    $$('.auth-form').forEach((f) => (f.style.display = ''));
  }
  $$('.auth-tab').forEach((tab) =>
    tab.addEventListener('click', () => switchAuthTab(tab.getAttribute('data-auth-tab')))
  );

  // Password visibility toggles
  $$('.pw-toggle').forEach((btn) =>
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye';
      }
    })
  );

  /* ---- Auth state + account UI ---- */
  function setAuthState(user) {
    const isIn = !!user;
    $$('[data-open-auth]').forEach((b) => b.classList.toggle('hide', isIn));
    $$('[data-account], [data-account-m]').forEach((b) => b.classList.toggle('hide', !isIn));
    if (isIn) {
      const first = (user.name || '').trim().split(/\s+/)[0] || user.name || '';
      $$('[data-account-name]').forEach((el) => (el.textContent = first));
      $$('[data-account-email]').forEach((el) => (el.textContent = user.email));
    } else {
      $$('[data-account-menu]').forEach((m) => (m.hidden = true));
    }
  }

  // Account dropdown toggle
  $$('[data-account-toggle]').forEach((tgl) =>
    tgl.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = tgl.parentElement.querySelector('[data-account-menu]');
      if (menu) menu.hidden = !menu.hidden;
    })
  );
  document.addEventListener('click', () => $$('[data-account-menu]').forEach((m) => (m.hidden = true)));

  // Logout
  $$('[data-logout]').forEach((b) =>
    b.addEventListener('click', async () => {
      try { await Backend.logout(); } catch (err) {}
      setAuthState(null);
      showToast(lang === 'bg' ? 'Излязохте успешно.' : 'Signed out.', 'fa-right-from-bracket');
    })
  );

  // Restore session on load (cloud / real API / static fallback)
  Backend.me()
    .then((res) => { if (res && res.user) setAuthState(res.user); })
    .catch(() => {});

  // Page-view tracking is consent-gated (see the cookie-consent module below).
  function trackPageView() { Backend.trackView().catch(() => {}); }

  // Auth form submit — real backend (register / login)
  $$('.auth-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kind = form.getAttribute('data-auth-form'); // 'login' | 'register'
      const errEl = $('[data-auth-error]', form);
      const errText = errEl ? errEl.querySelector('span') : null;
      if (errEl) { errEl.hidden = true; errEl.classList.remove('is-info'); }

      let valid = true;
      $$('input[required]', form).forEach((input) => {
        const field = input.closest('.field');
        let ok = input.checkValidity();
        if (input.type === 'checkbox') ok = input.checked;
        if (field) field.classList.toggle('has-error', !ok);
        if (!ok) valid = false;
      });
      if (!valid) return;

      const submitBtn = $('button[type="submit"]', form);
      const payload = {};
      $$('input[name]', form).forEach((i) => { if (i.type !== 'checkbox') payload[i.name] = i.value; });

      if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('is-loading'); }
      try {
        const res = await Backend[kind](payload);
        if (!res.ok) {
          if (errText) errText.textContent = res.error || (lang === 'bg' ? 'Възникна грешка.' : 'Something went wrong.');
          if (errEl) errEl.hidden = false;
          return;
        }
        // Cloud sign-up may require email confirmation (no session yet)
        if (res.pending) {
          if (errText) errText.textContent = (lang === 'bg'
            ? 'Акаунтът е създаден! Проверете имейла си, за да го потвърдите, след което влезте.'
            : 'Account created! Check your email to confirm it, then sign in.');
          if (errEl) { errEl.classList.add('is-info'); errEl.hidden = false; }
          form.reset();
          return;
        }
        setAuthState(res.user);
        const success = $('[data-auth-success]', authModal);
        $$('.auth-form', authModal).forEach((f) => (f.style.display = 'none'));
        if (success) success.hidden = false;
        const first = res.user && res.user.name ? res.user.name.split(' ')[0] : '';
        showToast((lang === 'bg' ? 'Добре дошли, ' : 'Welcome, ') + first + '!', 'fa-circle-check');
        setTimeout(() => {
          closeAuth();
          setTimeout(() => {
            form.reset();
            if (success) success.hidden = true;
            $$('.auth-form', authModal).forEach((f) => (f.style.display = ''));
            switchAuthTab('login');
          }, 400);
        }, 1400);
      } catch (err) {
        if (errText) errText.textContent = (lang === 'bg' ? 'Сървърна грешка. Опитайте отново.' : 'Server error. Please try again.');
        if (errEl) errEl.hidden = false;
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('is-loading'); }
      }
    });
  });

  // Clear error on input
  $$('.auth-form input').forEach((input) =>
    input.addEventListener('input', () => {
      const field = input.closest('.field');
      if (field) field.classList.remove('has-error');
    })
  );

  // Forgot password — sends a reset link to the email entered above
  $$('.auth-forgot').forEach((link) =>
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const form = link.closest('form');
      const emailInput = form ? $('input[name="email"]', form) : null;
      const errEl = form ? $('[data-auth-error]', form) : null;
      const errText = errEl ? errEl.querySelector('span') : null;
      const email = emailInput ? emailInput.value.trim() : '';
      const setMsg = (msg, info) => {
        if (errText) errText.textContent = msg;
        if (errEl) { errEl.hidden = false; errEl.classList.toggle('is-info', !!info); }
      };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailInput) { emailInput.focus(); const f = emailInput.closest('.field'); if (f) f.classList.add('has-error'); }
        setMsg(lang === 'bg' ? 'Въведете имейла си в полето по-горе, след което натиснете „Забравена парола".' : 'Enter your email in the field above, then click "Forgot password".', false);
        return;
      }
      link.style.pointerEvents = 'none';
      let res;
      try { res = await Backend.resetPassword(email); } catch (err) { res = { ok: false }; }
      link.style.pointerEvents = '';
      if (res && res.ok) {
        setMsg(lang === 'bg' ? 'Ако съществува акаунт, изпратихме връзка за нова парола на имейла ви.' : 'If an account exists, we\'ve emailed you a link to reset your password.', true);
      } else if (res && res.error === 'unsupported') {
        setMsg(lang === 'bg' ? 'За нулиране на паролата пишете на krasimiruzun@smartmenukj.com.' : 'To reset your password, contact krasimiruzun@smartmenukj.com.', true);
      } else {
        setMsg((res && res.error) || (lang === 'bg' ? 'Възникна грешка. Опитайте отново.' : 'Something went wrong. Please try again.'), false);
      }
    })
  );

  /* ==========================================================
     12. CONTACT FORM VALIDATION
     ========================================================== */
  const contactForm = $('#contact-form');
  if (contactForm) {
    const successBox = $('#cf-success');
    const submitBtn = $('#cf-submit');

    const validators = {
      'cf-name': (v) => v.trim().length >= 2,
      'cf-email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      'cf-phone': (v) => v.trim() === '' || /^[+()\d][\d\s()-]{5,}$/.test(v.trim()),
      'cf-service': (v) => v !== '',
      'cf-message': (v) => v.trim().length >= 10,
    };

    function validateField(el) {
      const fn = validators[el.id];
      if (!fn) return true;
      const ok = fn(el.value);
      const field = el.closest('.field');
      if (field) field.classList.toggle('has-error', !ok);
      return ok;
    }

    Object.keys(validators).forEach((id) => {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('blur', () => validateField(el));
      el.addEventListener('input', () => {
        const field = el.closest('.field');
        if (field && field.classList.contains('has-error')) validateField(el);
      });
    });

    const consent = $('#cf-consent');
    const consentError = $('#cf-consent-error');
    if (consent) {
      consent.addEventListener('change', () => {
        if (consentError) consentError.classList.toggle('show', !consent.checked);
      });
    }

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      Object.keys(validators).forEach((id) => {
        const el = $('#' + id);
        if (el && !validateField(el)) valid = false;
      });
      if (consent && !consent.checked) {
        if (consentError) consentError.classList.add('show');
        valid = false;
      }
      if (!valid) {
        const firstError = $('.field.has-error');
        if (firstError) firstError.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
        return;
      }

      // Real async send to the backend
      const label = $('.cf-submit-label', submitBtn);
      const icon = $('.cf-submit-icon', submitBtn);
      const spinner = $('.cf-submit-spinner', submitBtn);
      const setLoading = (on) => {
        submitBtn.disabled = on;
        if (icon) icon.hidden = on;
        if (spinner) spinner.hidden = !on;
        if (label) label.style.opacity = on ? '0.7' : '1';
      };
      setLoading(true);

      const payload = {
        name: $('#cf-name').value,
        email: $('#cf-email').value,
        phone: $('#cf-phone').value,
        service: $('#cf-service').value,
        message: $('#cf-message').value,
      };

      Backend.contact(payload)
        .then((res) => {
          setLoading(false);
          if (res.ok) {
            contactForm.reset();
            if (successBox) successBox.hidden = false;
            if (consentError) consentError.classList.remove('show');
            showToast(t(I18N.toastSent), 'fa-paper-plane');
            setTimeout(() => { if (successBox) successBox.hidden = true; }, 6000);
          } else {
            showToast(res.error || (lang === 'bg' ? 'Грешка при изпращане.' : 'Could not send. Please try again.'), 'fa-triangle-exclamation');
          }
        })
        .catch(() => {
          setLoading(false);
          showToast(lang === 'bg' ? 'Сървърна грешка. Опитайте отново.' : 'Server error. Please try again.', 'fa-triangle-exclamation');
        });
    });
  }

  /* ==========================================================
     13. TOAST
     ========================================================== */
  const toastEl = $('#toast');
  let toastTimer;
  function showToast(message, icon = 'fa-circle-check') {
    if (!toastEl) return;
    toastEl.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
  }

  /* ==========================================================
     14. MISC
     ========================================================== */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Smooth-scroll for in-page anchors (respect reduced motion)
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  });

  /* ==========================================================
     15. PRELOADER
     ========================================================== */
  (function preloader() {
    const pre = $('#preloader');
    const fill = $('#preloader-fill');
    if (!pre) { document.body.classList.remove('is-loading'); return; }
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(p + Math.random() * 18 + 6, 90);
      if (fill) fill.style.width = p + '%';
    }, 170);
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      clearInterval(tick);
      if (fill) fill.style.width = '100%';
      setTimeout(() => {
        pre.classList.add('is-done');
        document.body.classList.remove('is-loading');
      }, 350);
    }
    window.addEventListener('load', () => setTimeout(finish, 450));
    setTimeout(finish, 4000); // hard fallback
  })();

  /* ==========================================================
     16. HERO WORD ROTATOR
     ========================================================== */
  (function rotator() {
    const el = $('.rotator');
    if (!el) return;
    const list = () => (el.getAttribute('data-rotate-' + lang) || el.textContent).split('|');
    el.dataset.ri = '0';
    el.textContent = list()[0];
    if (prefersReduced) return;
    setInterval(() => {
      const l = list();
      const i = (parseInt(el.dataset.ri, 10) + 1) % l.length;
      el.dataset.ri = String(i);
      el.classList.add('is-out');
      setTimeout(() => {
        el.textContent = l[i];
        el.classList.remove('is-out');
      }, 300);
    }, 2800);
  })();

  /* ==========================================================
     17. 3D TILT + CURSOR SPOTLIGHT
     ========================================================== */
  if (!isCoarse && !prefersReduced) {
    $$('.tilt').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateZ(6px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }
  if (!isCoarse) {
    $$('.spotlight').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ==========================================================
     18. PORTFOLIO FILTER
     ========================================================== */
  const workFilters = $$('.work-filter');
  const workCards = $$('.work-card');
  workFilters.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.getAttribute('data-filter');
      workFilters.forEach((b) => b.classList.toggle('is-active', b === btn));
      workCards.forEach((card) => {
        const show = f === 'all' || card.getAttribute('data-cat') === f;
        card.classList.toggle('is-hidden', !show);
        if (show) {
          card.classList.remove('is-filtering');
          void card.offsetWidth; // restart animation
          card.classList.add('is-filtering');
        }
      });
    })
  );

  /* ==========================================================
     19. TESTIMONIALS SLIDER
     ========================================================== */
  (function testimonials() {
    const track = $('#testimonial-track');
    const dotsWrap = $('#testimonial-dots');
    if (!track || !dotsWrap) return;
    const slides = $$('.testimonial', track);
    if (!slides.length) return;
    let idx = 0, timer = null;

    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Testimonial ' + (i + 1));
      if (i === 0) b.classList.add('is-active');
      b.addEventListener('click', () => go(i, true));
      dotsWrap.appendChild(b);
    });
    const dots = $$('button', dotsWrap);

    function go(n, manual) {
      idx = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      if (manual) restart();
    }
    function next() { go(idx + 1); }
    function restart() {
      if (timer) clearInterval(timer);
      if (!prefersReduced) timer = setInterval(next, 6000);
    }

    const prevBtn = $('[data-testi-prev]');
    const nextBtn = $('[data-testi-next]');
    if (prevBtn) prevBtn.addEventListener('click', () => go(idx - 1, true));
    if (nextBtn) nextBtn.addEventListener('click', () => go(idx + 1, true));

    const wrap = $('.testimonials');
    if (wrap) {
      wrap.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
      wrap.addEventListener('mouseleave', restart);
    }
    restart();
  })();

  /* ==========================================================
     20. FAQ ACCORDION
     ========================================================== */
  $$('.faq-q').forEach((q) =>
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const isOpen = item.classList.contains('is-open');
      $$('.faq-item').forEach((it) => {
        it.classList.remove('is-open');
        const b = $('.faq-q', it);
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        q.setAttribute('aria-expanded', 'true');
      }
    })
  );

  /* ==========================================================
     21. COOKIE CONSENT (GDPR / EU)
     ========================================================== */
  (function cookieConsent() {
    const banner = $('#cookie-banner');
    if (!banner) return;
    const KEY = 'smkj_consent';
    const prefs = $('[data-cookie-prefs]', banner);
    const analyticsToggle = $('#cookie-analytics', banner);
    const btnSave = $('[data-cookie="save"]', banner);
    const btnAccept = $('[data-cookie="accept"]', banner);
    const btnReject = $('[data-cookie="reject"]', banner);
    const btnCustomize = $('[data-cookie="customize"]', banner);

    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
    const write = (analytics) => { try { localStorage.setItem(KEY, JSON.stringify({ essential: true, analytics: !!analytics, ts: Date.now() })); } catch (e) {} };

    function openBanner(showPrefs) {
      banner.hidden = false;
      if (prefs) prefs.hidden = !showPrefs;
      if (btnSave) btnSave.hidden = !showPrefs;
      [btnAccept, btnReject, btnCustomize].forEach((b) => { if (b) b.hidden = !!showPrefs; });
      const c = read(); if (c && analyticsToggle) analyticsToggle.checked = !!c.analytics;
    }
    function closeBanner() { banner.hidden = true; }

    if (btnAccept) btnAccept.addEventListener('click', () => { write(true); closeBanner(); trackPageView(); });
    if (btnReject) btnReject.addEventListener('click', () => { write(false); closeBanner(); });
    if (btnCustomize) btnCustomize.addEventListener('click', () => openBanner(true));
    if (btnSave) btnSave.addEventListener('click', () => { const a = !!(analyticsToggle && analyticsToggle.checked); write(a); closeBanner(); if (a) trackPageView(); });
    $$('[data-cookie-settings]').forEach((b) => b.addEventListener('click', () => openBanner(true)));

    const existing = read();
    if (!existing) { setTimeout(() => openBanner(false), 700); }
    else if (existing.analytics) { trackPageView(); }
  })();

  /* ==========================================================
     INIT
     ========================================================== */
  applyLanguage(lang);
  applyTheme('web');
  recalc();
})();
