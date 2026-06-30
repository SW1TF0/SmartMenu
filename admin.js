/* ============================================================
   SmartMenuKJ — Admin panel logic
   Data layer adapts to whatever backend is available:
     • Supabase (cloud)   — centralized, works on GitHub Pages
     • server.ps1 (API)   — self-hosted
     • localStorage       — local fallback (this browser)
   ============================================================ */
(function () {
  'use strict';
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const CFG = window.SMKJ_CONFIG || {};
  const ADMIN_EMAILS = (CFG.ADMIN_EMAILS || []).map((e) => String(e).toLowerCase());

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (v) => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString(); };
  const todayUTC = () => new Date().toISOString().slice(0, 10);

  /* ---- toast ---- */
  const toastEl = $('#toast'); let toastTimer;
  function toast(msg, icon) {
    if (!toastEl) return;
    toastEl.innerHTML = '<i class="fa-solid ' + (icon || 'fa-circle-check') + '"></i><span>' + esc(msg) + '</span>';
    toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }

  /* ---- backend mode ---- */
  let sb = null, mode = 'local';
  const normSbUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '').replace(/\/+$/, '');
  const sbUrl = normSbUrl(CFG.SUPABASE_URL);
  if (sbUrl && CFG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
    try { sb = window.supabase.createClient(sbUrl, CFG.SUPABASE_ANON_KEY); mode = 'supabase'; } catch (e) { sb = null; }
  }
  async function detectMode() {
    if (sb) { mode = 'supabase'; return; }
    try {
      const r = await fetch('/api/admin/summary', { credentials: 'same-origin' });
      mode = (r.ok || r.status === 401 || r.status === 403) ? 'server' : 'local';
    } catch (e) { mode = 'local'; }
  }
  const modeLabel = () => ({ supabase: 'Cloud database (Supabase)', server: 'Self-hosted server', local: 'Local (this browser)' }[mode]);

  /* ---- auth ---- */
  async function currentUser() {
    if (mode === 'supabase') {
      // getSession() reads the persisted session (shared across pages) without a network race
      let u = null;
      try { const { data } = await sb.auth.getSession(); u = data && data.session && data.session.user; } catch (e) {}
      if (!u) { try { const { data } = await sb.auth.getUser(); u = data && data.user; } catch (e) {} }
      if (!u) return null;
      return { id: u.id, email: (u.email || '').toLowerCase(), name: (u.user_metadata && u.user_metadata.name) || u.email };
    }
    if (mode === 'server') {
      try { const r = await fetch('/api/me', { credentials: 'same-origin' }); const j = await r.json(); return j.user ? { id: j.user.id, email: (j.user.email || '').toLowerCase(), name: j.user.name } : null; } catch (e) { return null; }
    }
    try {
      const id = JSON.parse(localStorage.getItem('smkj_session') || 'null'); if (!id) return null;
      const u = JSON.parse(localStorage.getItem('smkj_users') || '[]').find((x) => x.id === id);
      return u ? { id: u.id, email: (u.email || '').toLowerCase(), name: u.name } : null;
    } catch (e) { return null; }
  }
  async function doLogin(email, password) {
    email = (email || '').trim().toLowerCase();
    if (mode === 'supabase') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: 'Invalid email or password.' } : { ok: true };
    }
    if (mode === 'server') {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({})); return { ok: r.ok, error: j.error };
    }
    try {
      const u = JSON.parse(localStorage.getItem('smkj_users') || '[]').find((x) => x.email === email);
      if (!u) return { ok: false, error: 'Invalid email or password.' };
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.salt + ':' + password));
      const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (hash !== u.hash) return { ok: false, error: 'Invalid email or password.' };
      localStorage.setItem('smkj_session', JSON.stringify(u.id)); return { ok: true };
    } catch (e) { return { ok: false, error: 'Invalid email or password.' }; }
  }
  async function doLogout() {
    if (mode === 'supabase') { try { await sb.auth.signOut(); } catch (e) {} }
    else if (mode === 'server') { try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {} }
    else { try { localStorage.removeItem('smkj_session'); } catch (e) {} }
  }

  /* ---- data ---- */
  function aggregateDaily(rows) {
    const daily = {};
    rows.forEach((r) => { const d = (r.created_at || r.createdAt || '').slice(0, 10); if (d) daily[d] = (daily[d] || 0) + 1; });
    return daily;
  }
  async function loadSummary(user) {
    if (mode === 'supabase') {
      // admin gate
      let admin = ADMIN_EMAILS.indexOf(user.email) !== -1;
      try { const { data } = await sb.from('profiles').select('is_admin').eq('id', user.id).single(); if (data && data.is_admin) admin = true; } catch (e) {}
      if (!admin) return { forbidden: true };
      const usersQ = await sb.from('profiles').select('name,email,created_at').order('created_at', { ascending: false });
      const inqQ   = await sb.from('inquiries').select('name,email,phone,service,message,created_at').order('created_at', { ascending: false });
      const viewQ  = await sb.from('views').select('created_at');
      // Resilient: if a query fails (e.g. a policy issue) still show the dashboard with what loaded.
      const err = (usersQ.error || inqQ.error || viewQ.error);
      const usersD = usersQ.data || [];
      const inqD = inqQ.data || [];
      const views = viewQ.data || [];
      const daily = aggregateDaily(views);
      return { ok: true, warn: err ? err.message : null, data: {
        admin: { name: user.name, email: user.email },
        views: { total: views.length, today: daily[todayUTC()] || 0, daily },
        usersCount: usersD.length, inquiriesCount: inqD.length,
        users: usersD, inquiries: inqD,
      } };
    }
    if (mode === 'server') {
      const r = await fetch('/api/admin/summary', { credentials: 'same-origin' });
      if (r.status === 403) return { forbidden: true };
      if (!r.ok) return { ok: false };
      const j = await r.json();
      return { ok: true, data: j };
    }
    // local (this browser only)
    const users = JSON.parse(localStorage.getItem('smkj_users') || '[]').map((u) => ({ name: u.name, email: u.email, created_at: u.createdAt }));
    const inquiries = JSON.parse(localStorage.getItem('smkj_inquiries') || '[]');
    const total = parseInt(localStorage.getItem('smkj_views') || '0', 10) || 0;
    const daily = {}; daily[todayUTC()] = total;
    return { ok: true, data: {
      admin: { name: user.name, email: user.email },
      views: { total, today: total, daily },
      usersCount: users.length, inquiriesCount: inquiries.length, users, inquiries,
    } };
  }

  /* ---- rendering ---- */
  const views = { login: $('#admin-login'), denied: $('#admin-denied'), dash: $('#admin-dashboard') };
  function show(which) {
    Object.keys(views).forEach((k) => views[k].classList.toggle('hide', k !== which));
    $('#admin-logout').classList.toggle('hide', which !== 'dash');
  }

  function renderChart(daily) {
    const wrap = $('#admin-chart'); wrap.innerHTML = '';
    const days = [];
    const base = new Date(todayUTC() + 'T00:00:00Z');
    for (let i = 13; i >= 0; i--) { const d = new Date(base); d.setUTCDate(base.getUTCDate() - i); days.push(d.toISOString().slice(0, 10)); }
    const counts = days.map((d) => daily[d] || 0);
    const max = Math.max(1, ...counts);
    days.forEach((d, i) => {
      const c = counts[i];
      const col = document.createElement('div'); col.className = 'admin-bar-col';
      col.innerHTML =
        '<div class="admin-bar-val">' + c + '</div>' +
        '<div class="admin-bar" style="height:' + Math.round((c / max) * 100) + '%"></div>' +
        '<div class="admin-bar-day">' + d.slice(8, 10) + '/' + d.slice(5, 7) + '</div>';
      wrap.appendChild(col);
    });
  }
  function renderTables(data) {
    const inqBody = $('#inq-body'); inqBody.innerHTML = '';
    (data.inquiries || []).forEach((q) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="nowrap">' + esc(fmtDate(q.created_at || q.createdAt)) + '</td>' +
        '<td>' + esc(q.name) + '</td>' +
        '<td><a href="mailto:' + esc(q.email) + '">' + esc(q.email) + '</a></td>' +
        '<td>' + esc(q.service || '—') + '</td>' +
        '<td class="admin-msg">' + esc(q.message) + '</td>';
      inqBody.appendChild(tr);
    });
    $('#inq-count').textContent = data.inquiriesCount || 0;
    $('#inq-empty').hidden = (data.inquiries || []).length > 0;

    const usersBody = $('#users-body'); usersBody.innerHTML = '';
    (data.users || []).forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(u.name) + '</td>' +
        '<td><a href="mailto:' + esc(u.email) + '">' + esc(u.email) + '</a></td>' +
        '<td class="nowrap">' + esc(fmtDate(u.created_at || u.createdAt)) + '</td>';
      usersBody.appendChild(tr);
    });
    $('#users-count').textContent = data.usersCount || 0;
    $('#users-empty').hidden = (data.users || []).length > 0;
  }
  function renderDashboard(user, data) {
    $('#admin-welcome').textContent = 'Signed in as ' + (data.admin && data.admin.email ? data.admin.email : user.email);
    $('#admin-source').textContent = modeLabel();
    $('#m-views').textContent = (data.views && data.views.total != null ? data.views.total : 0).toLocaleString();
    $('#m-today').textContent = (data.views && data.views.today != null ? data.views.today : 0).toLocaleString();
    $('#m-users').textContent = (data.usersCount || 0).toLocaleString();
    $('#m-inq').textContent = (data.inquiriesCount || 0).toLocaleString();
    renderChart((data.views && data.views.daily) || {});
    renderTables(data);
    window.__adminData = data; // for CSV export
  }

  /* ---- CSV export ---- */
  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  }

  /* ---- flow ---- */
  async function enterDashboard(user) {
    const res = await loadSummary(user);
    if (res.forbidden) { show('denied'); return; }
    if (!res.ok) { toast('Could not load data. Check your setup.', 'fa-triangle-exclamation'); show('login'); return; }
    renderDashboard(user, res.data);
    show('dash');
    if (res.warn) toast('Some data could not load: ' + res.warn, 'fa-triangle-exclamation');
  }
  async function init() {
    await detectMode();
    const note = $('#admin-mode-note');
    if (note) {
      note.textContent = 'Backend: ' + modeLabel() + (mode === 'local' ? ' — configure Supabase in config.js for centralized data.' : '');
    }
    const user = await currentUser();
    if (user) { await enterDashboard(user); } else { show('login'); }
  }

  /* ---- events ---- */
  $('#admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const errEl = $('#admin-login-error'); const errText = errEl.querySelector('span');
    errEl.hidden = true;
    const email = f.email.value, password = f.password.value;
    if (!email || password.length < 1) { errText.textContent = 'Enter your email and password.'; errEl.hidden = false; return; }
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; btn.classList.add('is-loading');
    try {
      const res = await doLogin(email, password);
      if (!res.ok) { errText.textContent = res.error || 'Sign in failed.'; errEl.hidden = false; return; }
      const user = await currentUser();
      if (!user) { errText.textContent = 'Sign in failed. If you just registered, confirm your email or disable email confirmation in Supabase.'; errEl.hidden = false; return; }
      await enterDashboard(user);
    } catch (err) {
      errText.textContent = 'Server error. Please try again.'; errEl.hidden = false;
    } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
  });

  $$('.pw-toggle').forEach((btn) => btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input'); const icon = btn.querySelector('i');
    if (input.type === 'password') { input.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
    else { input.type = 'password'; icon.className = 'fa-solid fa-eye'; }
  }));

  async function handleLogout() { await doLogout(); toast('Signed out.', 'fa-right-from-bracket'); show('login'); }
  $('#admin-logout').addEventListener('click', handleLogout);
  $('#admin-denied-logout').addEventListener('click', handleLogout);

  $('#admin-refresh').addEventListener('click', async () => {
    const user = await currentUser();
    if (user) { await enterDashboard(user); toast('Refreshed.', 'fa-rotate'); }
  });

  $('#export-inq').addEventListener('click', () => {
    const d = window.__adminData; if (!d) return;
    const rows = [['Date', 'Name', 'Email', 'Phone', 'Service', 'Message']];
    (d.inquiries || []).forEach((q) => rows.push([fmtDate(q.created_at || q.createdAt), q.name, q.email, q.phone || '', q.service || '', q.message || '']));
    downloadCSV('smartmenukj-inquiries.csv', rows);
  });
  $('#export-users').addEventListener('click', () => {
    const d = window.__adminData; if (!d) return;
    const rows = [['Name', 'Email', 'Joined']];
    (d.users || []).forEach((u) => rows.push([u.name, u.email, fmtDate(u.created_at || u.createdAt)]));
    downloadCSV('smartmenukj-users.csv', rows);
  });

  init();
})();
