// ============================================================================
// admin.html — gated dashboard: leads (contact/quote submissions) + users.
// Access is gated by ADMIN_EMAILS in firebase-config.js (client-side gate)
// and mirrored in firebase/firestore.rules (server-side enforcement).
// Lead and user fields are written by the public, so every value is escaped
// before it is put into the page.
//
// The panel speaks the admin's language (BG / TR / EN, from the header
// switch; strings in js/admin-i18n.js). What it does:
//   - overview: requests per week + by service (a service bar filters)
//   - leads list: search, status / type / service filters, sort, grouped by
//     day, status picker per row, select several for bulk status / delete
//   - a click opens the full request: call / email / Viber / WhatsApp,
//     a ready reply e-mail, an internal note, status, delete, ← / →
//   - a board view (New / In progress / Done columns, drag a card to move it)
//   - "Needs attention": new requests waiting over a day + due reminders
//   - refreshes itself every minute and flags requests that just arrived
// Internal notes and reminders live in their own collection
// (leadNotes/{leadId}: { text, remindAt "YYYY-MM-DD" | null }), readable
// by admins only — lead docs are also readable by the customer who sent them.
// ============================================================================
import { db } from "./firebase-config.js?v=20261112i";
import { watchAuth, isAdmin } from "./auth.js?v=20261112i";
import { escapeHtml, registerDict, applyI18n, t, getLang } from "./i18n.js?v=20261112i";
import { ADMIN_DICT } from "./admin-i18n.js?v=20261112i";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

registerDict(ADMIN_DICT);
applyI18n();

const $ = (id) => document.getElementById(id);
const loading = $("adminLoading");
const guard = $("adminGuard");
const content = $("adminContent");
const who = $("admWho");
const headActions = $("admHeadActions");
const updatedEl = $("admUpdated");
const leadsList = $("leadsList");
const leadsEmpty = $("leadsEmpty");
const leadsSummary = $("leadsSummary");
const usersList = $("usersList");
const usersEmpty = $("usersEmpty");
const usersSummary = $("usersSummary");
const leadSearch = $("leadSearch");
const leadType = $("leadType");
const leadSort = $("leadSort");
const userSearch = $("userSearch");
const dialog = $("leadDialog");
const toastEl = $("admToast");
const bulkBar = $("bulkBar");
const noteEl = $("dlgNote");
const noteState = $("dlgNoteState");

const STATUSES = ["new", "progress", "done"];
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const AUTO_REFRESH = 60 * 1000;
const BASE_TITLE = document.title;

let leads = null; // null = not loaded yet
let users = null;
let notes = {}; // leadId -> text
let reminders = {}; // leadId -> "YYYY-MM-DD"
let notesBlocked = false; // the published rules don't know leadNotes yet
let leadsError = null;
let usersError = null;
let lastLoaded = null;
let openLeadId = null;
let knownIds = null; // lead ids seen so far — to flag ones that just arrived
const freshIds = new Set();
const selected = new Set();
let visibleIds = []; // the list as shown, for ← / → in the dialog
const filters = { status: "all", type: "all", service: "all", week: false, q: "", sort: "new" };

// The admin's own view choices are remembered in this browser only.
const PREFS_KEY = "smkj_admin_prefs";
let view = "list";
try {
  const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  if (p.view === "board") view = "board";
  if (p.sort === "old") filters.sort = "old";
} catch (e) {
  /* storage unavailable — defaults */
}
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ view, sort: filters.sort }));
  } catch (e) {
    /* storage unavailable */
  }
}

// ------------------------------------------------------------- helpers --
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : vars[k]));
const tr = (key, vars = {}) => fill(t(key), vars);
const locale = () => ({ bg: "bg-BG", tr: "tr-TR" })[getLang()] || "en-GB";
const millis = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);
const statusOf = (l) => (STATUSES.includes(l.status) ? l.status : "new");
const statusLabel = (s) => t(`status.${s}`);
const serviceKey = (l) => l.service || "general";
const denied = (err) => err && err.code === "permission-denied";

function fmtDate(ts, withTime = true) {
  if (!ts || !ts.toDate) return "—";
  const opts = { year: "numeric", month: "short", day: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return ts.toDate().toLocaleString(locale(), opts);
}

// Local calendar dates as "YYYY-MM-DD" (what <input type="date"> uses).
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => isoDay(new Date());
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const fmtDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
};
// Whole days a "new" request has waited (0 under a day).
const waitingDays = (l) => (statusOf(l) === "new" && millis(l.createdAt) ? Math.floor((Date.now() - millis(l.createdAt)) / DAY) : 0);

const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
};

// "14:05" today, "Yesterday", otherwise "3 Nov" (with the year when it differs).
function shortDate(ts) {
  if (!ts || !ts.toDate) return "—";
  const d = ts.toDate();
  const today = startOfToday();
  if (d.getTime() >= today) return d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  if (d.getTime() >= today - DAY) return t("adm.yesterday");
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(locale(), opts);
}

// The day group a lead falls in: today, yesterday, earlier this week, then by month.
function groupOf(ts) {
  const ms = millis(ts);
  if (!ms) return { key: "none", label: t("adm.group.older") };
  const today = startOfToday();
  if (ms >= today) return { key: "today", label: t("adm.group.today") };
  if (ms >= today - DAY) return { key: "yesterday", label: t("adm.group.yesterday") };
  if (ms >= today - 6 * DAY) return { key: "week", label: t("adm.group.week") };
  const d = new Date(ms);
  const label = d.toLocaleDateString(locale(), { month: "long", year: "numeric" });
  return { key: `m${d.getFullYear()}-${d.getMonth()}`, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

// "For home" / "For business" — leads from before the switch existed have none.
function audienceLabel(audience) {
  return audience === "personal" ? t("adm.type.personal") : audience === "business" ? t("adm.type.business") : "—";
}

function serviceLabel(service) {
  const key = service && service !== "general" ? `svc.${service}` : "contact.form.svc.general";
  const label = t(key);
  if (label !== key) return label;
  return !service || service === "general" ? t("adm.svc.general") : service;
}

const telHref = (phone) => "tel:" + String(phone).replace(/[^\d+]/g, "");

// International form for Viber / WhatsApp. Bulgarian numbers are usually
// written 0888…; turn them into +359888…. Returns digits without "+".
function intlDigits(phone) {
  let p = String(phone || "").replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+359" + p.slice(1);
  if (!p.startsWith("+")) p = "+" + p;
  const digits = p.slice(1);
  return digits.length >= 9 ? digits : null;
}

function initials(name) {
  const parts = String(name || "").replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

let toastTimer;
function toast(msg, kind = "ok") {
  toastEl.textContent = msg;
  toastEl.className = `adm-toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), kind === "err" ? 5000 : 2600);
}

function errorText(err) {
  return denied(err) ? t("adm.err.denied") : t("adm.err.load");
}

// ----------------------------------------------------------- overview --
function renderOverview() {
  const box = $("admOverview");
  if (!leads || !leads.length) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  // Requests per week: 12 columns, oldest left, this week on the right.
  const today = startOfToday();
  const dow = (new Date(today).getDay() + 6) % 7; // Monday = 0
  const thisWeek = today - dow * DAY;
  const weeks = Array.from({ length: 12 }, (_, i) => ({ start: thisWeek - (11 - i) * WEEK, n: 0 }));
  leads.forEach((l) => {
    const ms = millis(l.createdAt);
    const idx = 11 - Math.floor((thisWeek + WEEK - 1 - ms) / WEEK);
    if (ms && idx >= 0 && idx < 12) weeks[idx].n++;
  });
  const max = Math.max(1, ...weeks.map((w) => w.n));
  const label = (w) => new Date(w.start).toLocaleDateString(locale(), { day: "numeric", month: "short" });
  $("chartWeeks").innerHTML = weeks
    .map((w, i) => {
      const tip = tr("adm.chart.weekOf", { date: label(w), n: w.n });
      const h = w.n ? Math.max(6, (w.n / max) * 100) : 0;
      return `<span class="adm-wk${i === 11 ? " now" : ""}" style="--h:${h}%" tabindex="0" aria-label="${escapeHtml(tip)}" data-tip="${escapeHtml(tip)}"><i></i>${w.n ? `<b>${w.n}</b>` : ""}</span>`;
    })
    .join("");
  $("chartWeeks").setAttribute("aria-label", t("adm.chart.weeks"));
  $("chartWeeksAxis").innerHTML = `<span>${escapeHtml(label(weeks[0]))}</span><span>${escapeHtml(label(weeks[6]))}</span><span>${escapeHtml(label(weeks[11]))}</span>`;

  // By service: horizontal bars, biggest first. A click filters the list.
  const counts = {};
  leads.forEach((l) => (counts[serviceKey(l)] = (counts[serviceKey(l)] || 0) + 1));
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = Math.max(...rows.map((r) => r[1]));
  $("chartServices").innerHTML = rows
    .map(
      ([svc, n]) => `<button type="button" class="adm-bar${filters.service === svc ? " active" : ""}" data-service="${escapeHtml(svc)}" aria-pressed="${filters.service === svc}">
        <span class="adm-bar-label">${escapeHtml(serviceLabel(svc))}</span>
        <span class="adm-bar-track"><i style="width:${(n / top) * 100}%"></i></span>
        <span class="adm-bar-n">${n}</span>
      </button>`
    )
    .join("");
}

$("chartServices").addEventListener("click", (e) => {
  const b = e.target.closest("[data-service]");
  if (!b) return;
  const svc = b.getAttribute("data-service");
  filters.service = filters.service === svc ? "all" : svc;
  renderLeads();
});

// -------------------------------------------------------------- leads --
function matchesLead(l) {
  if (filters.status !== "all" && statusOf(l) !== filters.status) return false;
  if (filters.type !== "all" && l.audience !== filters.type) return false;
  if (filters.service !== "all" && serviceKey(l) !== filters.service) return false;
  if (filters.week && millis(l.createdAt) < Date.now() - WEEK) return false;
  if (filters.q) {
    const hay = [l.name, l.company, l.email, l.phone, l.message, serviceLabel(l.service), notes[l.id]].join(" ").toLowerCase();
    const digits = filters.q.replace(/\D/g, "");
    const phoneHit = digits.length >= 3 && String(l.phone || "").replace(/\D/g, "").includes(digits);
    if (!hay.includes(filters.q) && !phoneHit) return false;
  }
  return true;
}

function shownLeads() {
  const list = leads.filter(matchesLead);
  if (filters.sort === "old") list.reverse();
  return list;
}

function renderStats() {
  const all = leads || [];
  const count = (s) => all.filter((l) => statusOf(l) === s).length;
  $("statNewLeads").textContent = leads ? count("new") : "–";
  $("statProgress").textContent = leads ? count("progress") : "–";
  $("statWeek").textContent = leads ? all.filter((l) => millis(l.createdAt) > Date.now() - WEEK).length : "–";
  $("statTotalLeads").textContent = leads ? all.length : "–";
  $("statUsers").textContent = users ? users.length : "–";
  $("countLeads").textContent = all.length;
  $("countUsers").textContent = users ? users.length : 0;
  document.querySelectorAll("[data-n]").forEach((el) => {
    const s = el.getAttribute("data-n");
    el.textContent = leads ? (s === "all" ? all.length : count(s)) : "";
  });
  const plain = filters.type === "all" && filters.service === "all";
  document.querySelectorAll("[data-stat-filter]").forEach((el) => {
    const f = el.getAttribute("data-stat-filter");
    const on =
      plain && (f === "week" ? filters.week : f === "all" ? !filters.week && filters.status === "all" : !filters.week && filters.status === f);
    el.classList.toggle("active", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });
  // The browser tab shows how many requests still wait for a reply.
  const waiting = leads ? count("new") : 0;
  document.title = waiting ? `(${waiting}) ${BASE_TITLE}` : BASE_TITLE;
}

const BELL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

function leadRow(l) {
  const id = escapeHtml(l.id);
  const s = statusOf(l);
  const name = l.name ? escapeHtml(l.name) : `<span class="text-faint">${escapeHtml(t("adm.unknownName"))}</span>`;
  const msg = String(l.message || "").trim();
  const contact = [];
  if (l.phone) contact.push(`<a href="${escapeHtml(telHref(l.phone))}" class="adm-contact" data-stop>${escapeHtml(l.phone)}</a>`);
  if (l.email) contact.push(`<a href="mailto:${escapeHtml(l.email)}" class="adm-contact" data-stop>${escapeHtml(l.email)}</a>`);
  const typeTag = l.audience ? `<span class="adm-tag">${escapeHtml(audienceLabel(l.audience))}</span>` : "";
  const note = notes[l.id]
    ? `<span class="adm-tag adm-tag-note" title="${escapeHtml(t("adm.hasNote"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z M14 20v-5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="sr-only">${escapeHtml(t("adm.hasNote"))}</span></span>`
    : "";
  const wait = waitingDays(l);
  const waitTag = wait >= 1 ? `<span class="adm-tag adm-tag-wait">${escapeHtml(tr("adm.waiting", { n: wait }))}</span>` : "";
  const rem = reminders[l.id];
  const remTag = rem
    ? `<span class="adm-tag adm-tag-remind${rem <= todayIso() ? " due" : ""}">${BELL}${escapeHtml(fmtDay(rem))}</span>`
    : "";
  const sel = selected.has(l.id);
  return `<li class="adm-lead s-${s}${sel ? " is-selected" : ""}${freshIds.has(l.id) ? " is-fresh" : ""}" data-id="${id}">
    <button type="button" class="adm-lead-open" data-open="${id}" aria-label="${escapeHtml((l.name || "") + " — " + statusLabel(s))}"></button>
    <label class="adm-check" data-stop>
      <input type="checkbox" data-select="${id}" ${sel ? "checked" : ""} />
      <span class="sr-only">${escapeHtml(t("adm.select"))}: ${escapeHtml(l.name || "")}</span>
    </label>
    <span class="adm-avatar" aria-hidden="true">${escapeHtml(initials(l.name))}</span>
    <div class="adm-lead-main">
      <div class="adm-lead-top">
        <span class="adm-lead-name">${name}</span>
        ${l.company ? `<span class="adm-lead-company">${escapeHtml(l.company)}</span>` : ""}
      </div>
      <div class="adm-lead-meta">
        <span class="adm-tag adm-tag-svc">${escapeHtml(serviceLabel(l.service))}</span>${typeTag}${waitTag}${remTag}${note}
        ${contact.join("")}
      </div>
      <p class="adm-lead-msg">${msg ? escapeHtml(msg.slice(0, 220)) : `<span class="text-faint">${escapeHtml(t("adm.noMessage"))}</span>`}</p>
    </div>
    <div class="adm-lead-side">
      <time class="adm-lead-date" title="${escapeHtml(fmtDate(l.createdAt))}">${escapeHtml(shortDate(l.createdAt))}</time>
      <label class="adm-status-pick s-${s}" data-stop>
        <span class="sr-only">${escapeHtml(t("adm.th.status"))}</span>
        <select class="adm-status-select" data-status-for="${id}">
          ${STATUSES.map((v) => `<option value="${v}" ${v === s ? "selected" : ""}>${escapeHtml(statusLabel(v))}</option>`).join("")}
        </select>
      </label>
    </div>
  </li>`;
}

function emptyBlock(text, withClear) {
  return `<p>${escapeHtml(text)}</p>${withClear ? `<button type="button" class="adm-btn" data-clear-filters>${escapeHtml(t("adm.clear"))}</button>` : ""}`;
}

function renderLeads() {
  renderStats();
  renderOverview();
  renderAttention();
  syncFilterUI();
  const boardOn = view === "board" && leads !== null && !leadsError;
  leadsList.hidden = boardOn;
  $("leadsBoard").hidden = !boardOn;
  if (leadsError) {
    leadsList.innerHTML = "";
    leadsSummary.textContent = "";
    leadsEmpty.innerHTML = `<p class="adm-error">${escapeHtml(errorText(leadsError))}</p>`;
    leadsEmpty.classList.remove("hidden");
    renderBulk();
    return;
  }
  if (leads === null) {
    leadsList.innerHTML = Array.from({ length: 4 }, () => `<li class="adm-lead adm-skel" aria-hidden="true"><span></span><span class="adm-avatar"></span><div class="adm-lead-main"><i></i><i></i><i></i></div></li>`).join("");
    leadsEmpty.classList.add("hidden");
    return;
  }
  // Drop selections that no longer exist.
  [...selected].forEach((id) => leads.some((l) => l.id === id) || selected.delete(id));
  const shown = shownLeads();
  visibleIds = shown.map((l) => l.id);
  const filtered = filters.status !== "all" || filters.type !== "all" || filters.service !== "all" || filters.week || !!filters.q;
  const parts = [];
  if (filtered && leads.length) parts.push(tr("adm.showing", { n: shown.length, total: leads.length }));
  if (filters.service !== "all") parts.push(tr("adm.filter.service", { s: serviceLabel(filters.service) }));
  leadsSummary.innerHTML = parts.length
    ? `${escapeHtml(parts.join(" · "))} <button type="button" class="adm-linkbtn" data-clear-filters>${escapeHtml(t("adm.clear"))}</button>`
    : "";
  if (!shown.length) {
    leadsList.innerHTML = "";
    $("leadsBoard").innerHTML = "";
    leadsEmpty.innerHTML = emptyBlock(leads.length ? t("adm.empty.filtered") : t("adm.empty.leads"), leads.length > 0);
    leadsEmpty.classList.remove("hidden");
    renderBulk();
    return;
  }
  leadsEmpty.classList.add("hidden");
  if (view === "board") {
    renderBoard(shown);
    renderBulk();
    return;
  }
  let lastGroup = null;
  leadsList.innerHTML = shown
    .map((l) => {
      const g = groupOf(l.createdAt);
      const head = g.key !== lastGroup ? `<li class="adm-group" role="presentation">${escapeHtml(g.label)}</li>` : "";
      lastGroup = g.key;
      return head + leadRow(l);
    })
    .join("");
  renderBulk();
}

// ---------------------------------------------------------------- board --
// Three columns; the status filter does not apply here (the columns are it).
function boardCard(l) {
  const id = escapeHtml(l.id);
  const wait = waitingDays(l);
  const rem = reminders[l.id];
  const msg = String(l.message || "").trim();
  return `<li class="adm-card s-${statusOf(l)}${freshIds.has(l.id) ? " is-fresh" : ""}" draggable="true" data-card="${id}" tabindex="0">
    <div class="adm-card-top"><span class="adm-lead-name">${l.name ? escapeHtml(l.name) : escapeHtml(t("adm.unknownName"))}</span><time class="adm-lead-date">${escapeHtml(shortDate(l.createdAt))}</time></div>
    ${l.company ? `<div class="adm-lead-company">${escapeHtml(l.company)}</div>` : ""}
    <p class="adm-card-msg">${escapeHtml(msg.slice(0, 120)) || `<span class="text-faint">${escapeHtml(t("adm.noMessage"))}</span>`}</p>
    <div class="adm-lead-meta">
      <span class="adm-tag adm-tag-svc">${escapeHtml(serviceLabel(l.service))}</span>
      ${wait >= 1 ? `<span class="adm-tag adm-tag-wait">${escapeHtml(tr("adm.waiting", { n: wait }))}</span>` : ""}
      ${rem ? `<span class="adm-tag adm-tag-remind${rem <= todayIso() ? " due" : ""}">${BELL}${escapeHtml(fmtDay(rem))}</span>` : ""}
      ${notes[l.id] ? `<span class="adm-tag adm-tag-note" title="${escapeHtml(t("adm.hasNote"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z M14 20v-5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>` : ""}
    </div>
  </li>`;
}

function renderBoard(shown) {
  const source = filters.status === "all" ? shown : shownLeadsIgnoringStatus();
  visibleIds = [];
  $("leadsBoard").innerHTML = STATUSES.map((s) => {
    const items = source.filter((l) => statusOf(l) === s);
    items.forEach((l) => visibleIds.push(l.id));
    return `<section class="adm-col s-${s}" data-col="${s}">
      <header class="adm-col-head"><i class="dot dot-${s}"></i><span>${escapeHtml(statusLabel(s))}</span><span class="adm-count">${items.length}</span></header>
      <ul class="adm-col-list" role="list">${items.map(boardCard).join("") || `<li class="adm-col-empty">${escapeHtml(t("adm.board.empty"))}</li>`}</ul>
    </section>`;
  }).join("");
}

function shownLeadsIgnoringStatus() {
  const keep = filters.status;
  filters.status = "all";
  const out = shownLeads();
  filters.status = keep;
  return out;
}

const board = $("leadsBoard");
board.addEventListener("click", (e) => {
  const card = e.target.closest("[data-card]");
  if (card) openLead(card.getAttribute("data-card"));
});
board.addEventListener("keydown", (e) => {
  const card = e.target.closest("[data-card]");
  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openLead(card.getAttribute("data-card"));
  }
});
let dragId = null;
board.addEventListener("dragstart", (e) => {
  const card = e.target.closest("[data-card]");
  if (!card) return;
  dragId = card.getAttribute("data-card");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragId);
  requestAnimationFrame(() => card.classList.add("dragging"));
});
board.addEventListener("dragend", () => {
  dragId = null;
  board.querySelectorAll(".dragging, .drop-over").forEach((el) => el.classList.remove("dragging", "drop-over"));
});
board.addEventListener("dragover", (e) => {
  const col = e.target.closest("[data-col]");
  if (!col || !dragId) return;
  e.preventDefault();
  board.querySelectorAll(".drop-over").forEach((el) => el !== col && el.classList.remove("drop-over"));
  col.classList.add("drop-over");
});
board.addEventListener("drop", (e) => {
  const col = e.target.closest("[data-col]");
  if (!col || !dragId) return;
  e.preventDefault();
  const id = dragId;
  dragId = null;
  setStatus(id, col.getAttribute("data-col"));
});

function setView(v) {
  view = v;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === v)));
  content.classList.toggle("view-board", v === "board");
  savePrefs();
  renderLeads();
}
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.getAttribute("data-view"))));

// ------------------------------------------------------------ attention --
// New requests that have waited more than a day, and reminders due today or
// earlier — oldest problems first.
function renderAttention() {
  const box = $("admAttention");
  if (!leads) return box.classList.add("hidden");
  const today = todayIso();
  const items = [];
  leads.forEach((l) => {
    const rem = reminders[l.id];
    if (rem && rem <= today && statusOf(l) !== "done")
      items.push({ l, rank: 0, key: rem, text: rem < today ? tr("adm.att.overdue", { date: fmtDay(rem) }) : t("adm.att.remind"), kind: "remind" });
    else if (waitingDays(l) >= 1) items.push({ l, rank: 1, key: String(millis(l.createdAt)), text: tr("adm.att.waiting", { n: waitingDays(l) }), kind: "wait" });
  });
  if (!items.length) return box.classList.add("hidden");
  items.sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));
  box.classList.remove("hidden");
  $("attCount").textContent = items.length;
  $("attList").innerHTML = items
    .slice(0, 6)
    .map(
      ({ l, text, kind }) => `<li><button type="button" class="adm-att-item ${kind}" data-att="${escapeHtml(l.id)}">
        <span class="adm-att-icon">${kind === "remind" ? BELL : `<i class="dot dot-new"></i>`}</span>
        <span class="adm-att-main"><b>${escapeHtml(l.name || t("adm.unknownName"))}</b><span>${escapeHtml(serviceLabel(l.service))}</span></span>
        <span class="adm-att-why">${escapeHtml(text)}</span>
      </button></li>`
    )
    .join("");
}
$("attList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-att]");
  if (b) openLead(b.getAttribute("data-att"));
});

async function setStatus(id, status) {
  const lead = leads && leads.find((l) => l.id === id);
  if (!lead || statusOf(lead) === status) return;
  const before = lead.status;
  lead.status = status; // optimistic — put back if the write fails
  renderLeads();
  if (openLeadId === id) renderDialog();
  try {
    await updateDoc(doc(db, "leads", id), { status });
    toast(tr("adm.saved", { status: statusLabel(status) }));
  } catch (err) {
    console.error(err);
    lead.status = before;
    renderLeads();
    if (openLeadId === id) renderDialog();
    toast(denied(err) ? t("adm.err.denied") : t("adm.saveFailed"), "err");
  }
}

async function deleteLeads(ids) {
  const results = await Promise.allSettled(ids.map((id) => deleteDoc(doc(db, "leads", id))));
  const gone = ids.filter((_, i) => results[i].status === "fulfilled");
  // Notes are best-effort: a missing rule must not block the delete.
  gone.forEach((id) => {
    if ((notes[id] || reminders[id]) && !notesBlocked) deleteDoc(doc(db, "leadNotes", id)).catch(() => {});
    delete notes[id];
    delete reminders[id];
    selected.delete(id);
  });
  leads = leads.filter((l) => !gone.includes(l.id));
  const failed = results.find((r) => r.status === "rejected");
  if (failed) console.error(failed.reason);
  return { gone, failed: failed && failed.reason };
}

async function removeLead(id) {
  const lead = leads && leads.find((l) => l.id === id);
  if (!lead) return;
  if (!confirm(tr("adm.deleteConfirm", { name: lead.name || lead.email || "—" }))) return;
  const { gone, failed } = await deleteLeads([id]);
  if (gone.length) {
    if (dialog.open) dialog.close();
    toast(t("adm.deleted"));
  } else toast(denied(failed) ? t("adm.err.denied") : t("adm.saveFailed"), "err");
  renderLeads();
}

// --------------------------------------------------------------- bulk --
function renderBulk() {
  const n = selected.size;
  bulkBar.hidden = n === 0;
  content.classList.toggle("has-selection", n > 0);
  $("bulkCount").textContent = tr("adm.bulk.count", { n });
}

leadsList.addEventListener("change", (e) => {
  const box = e.target.closest("[data-select]");
  if (box) {
    const id = box.getAttribute("data-select");
    box.checked ? selected.add(id) : selected.delete(id);
    box.closest(".adm-lead").classList.toggle("is-selected", box.checked);
    renderBulk();
    return;
  }
  const sel = e.target.closest("[data-status-for]");
  if (sel) setStatus(sel.getAttribute("data-status-for"), sel.value);
});

// Shift-click a checkbox to select the whole range since the last one.
let lastChecked = null;
leadsList.addEventListener("click", (e) => {
  const box = e.target.closest("[data-select]");
  if (!box) return;
  const id = box.getAttribute("data-select");
  if (e.shiftKey && lastChecked && lastChecked !== id) {
    const a = visibleIds.indexOf(lastChecked);
    const b = visibleIds.indexOf(id);
    if (a > -1 && b > -1) {
      visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => (box.checked ? selected.add(x) : selected.delete(x)));
      queueMicrotask(renderLeads);
    }
  }
  lastChecked = id;
});

document.querySelectorAll("[data-bulk-status]").forEach((b) =>
  b.addEventListener("click", async () => {
    const status = b.getAttribute("data-bulk-status");
    const ids = [...selected].filter((id) => {
      const l = leads.find((x) => x.id === id);
      return l && statusOf(l) !== status;
    });
    const results = await Promise.allSettled(ids.map((id) => updateDoc(doc(db, "leads", id), { status })));
    let ok = 0;
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return console.error(r.reason);
      leads.find((x) => x.id === ids[i]).status = status;
      ok++;
    });
    selected.clear();
    renderLeads();
    if (ok === ids.length) toast(tr("adm.bulk.saved", { n: ok }));
    else toast(t("adm.saveFailed"), "err");
  })
);
$("bulkDelete").addEventListener("click", async () => {
  const ids = [...selected];
  if (!ids.length || !confirm(tr("adm.bulk.deleteConfirm", { n: ids.length }))) return;
  const { gone, failed } = await deleteLeads(ids);
  renderLeads();
  if (failed) toast(denied(failed) ? t("adm.err.denied") : t("adm.saveFailed"), "err");
  else toast(tr("adm.bulk.deleted", { n: gone.length }));
});
$("bulkClear").addEventListener("click", () => {
  selected.clear();
  renderLeads();
});

// ------------------------------------------------------------- dialog --
function replyMailto(l) {
  const first = String(l.name || "").trim().split(/\s+/)[0] || "";
  const subject = t("adm.reply.subject");
  const body = tr("adm.reply.body", { name: first, service: serviceLabel(l.service) });
  return `mailto:${l.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderDialog() {
  const l = leads && leads.find((x) => x.id === openLeadId);
  if (!l) return;
  const s = statusOf(l);
  $("dlgMeta").textContent = [fmtDate(l.createdAt), serviceLabel(l.service), l.audience ? audienceLabel(l.audience) : ""].filter(Boolean).join(" · ");
  $("dlgName").textContent = l.name || t("adm.unknownName");
  $("dlgCompany").textContent = l.company || "";
  $("dlgCompany").classList.toggle("hidden", !l.company);

  const rows = [];
  if (l.phone)
    rows.push(`<div class="adm-crow"><span class="adm-crow-label">${escapeHtml(t("adm.th.phone"))}</span><span class="adm-crow-value">${escapeHtml(l.phone)}</span>
      <span class="adm-crow-actions"><a class="adm-btn adm-btn-primary" href="${escapeHtml(telHref(l.phone))}">${escapeHtml(t("adm.call"))}</a><button type="button" class="adm-btn" data-copy="${escapeHtml(l.phone)}">${escapeHtml(t("adm.copy"))}</button></span></div>`);
  if (l.email)
    rows.push(`<div class="adm-crow"><span class="adm-crow-label">${escapeHtml(t("adm.th.email"))}</span><span class="adm-crow-value">${escapeHtml(l.email)}</span>
      <span class="adm-crow-actions"><button type="button" class="adm-btn" data-copy="${escapeHtml(l.email)}">${escapeHtml(t("adm.copy"))}</button></span></div>`);
  $("dlgContact").innerHTML = rows.join("");

  // Reply: a pre-filled e-mail, and Viber / WhatsApp chats for mobile numbers.
  const reply = [];
  if (l.email)
    reply.push(`<a class="adm-reply-btn" href="${escapeHtml(replyMailto(l))}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 7l7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>${escapeHtml(t("adm.reply.email"))}</a>`);
  const intl = intlDigits(l.phone);
  if (intl) {
    reply.push(`<a class="adm-reply-btn" href="viber://chat?number=%2B${intl}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c4.7 0 8 2.6 8 7.2s-3.3 7.1-8 7.1c-.8 0-1.6-.1-2.3-.2L6.5 20v-3.1C4.6 15.6 4 13.4 4 10.7 4 6.1 7.3 3.5 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>${escapeHtml(t("adm.reply.viber"))}</a>`);
    reply.push(`<a class="adm-reply-btn" href="https://wa.me/${intl}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>${escapeHtml(t("adm.reply.whatsapp"))}</a>`);
  }
  $("dlgReply").innerHTML = reply.join("");

  const msg = String(l.message || "").trim();
  $("dlgMessage").textContent = msg || t("adm.noMessage");
  $("dlgStatus").innerHTML = STATUSES.map(
    (v) => `<button type="button" class="s-${v}${v === s ? " active" : ""}" data-set-status="${v}" aria-pressed="${v === s}"><i class="dot dot-${v}"></i>${escapeHtml(statusLabel(v))}</button>`
  ).join("");

  // Keep what the admin is typing; only fill the note when switching leads.
  if (noteEl.dataset.for !== l.id) {
    noteEl.dataset.for = l.id;
    noteEl.value = notes[l.id] || "";
    noteState.textContent = notesBlocked ? t("adm.note.rules") : "";
    noteState.className = notesBlocked ? "adm-note-state warn" : "adm-note-state";
  }
  noteEl.disabled = notesBlocked;
  remindEl.value = reminders[l.id] || "";
  remindEl.min = todayIso();
  remindEl.disabled = notesBlocked;
  document.querySelectorAll("[data-remind]").forEach((b) => (b.disabled = notesBlocked));
  $("dlgRemindClear").hidden = !reminders[l.id];

  const i = visibleIds.indexOf(l.id);
  $("dlgPos").textContent = i > -1 ? tr("adm.pos", { i: i + 1, n: visibleIds.length }) : "";
  $("dlgPrev").disabled = i <= 0;
  $("dlgNext").disabled = i < 0 || i >= visibleIds.length - 1;
}

function openLead(id) {
  openLeadId = id;
  if (freshIds.delete(id)) leadsList.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.remove("is-fresh");
  renderDialog();
  if (!dialog.open) dialog.showModal();
}

function step(dir) {
  const i = visibleIds.indexOf(openLeadId);
  const next = visibleIds[i + dir];
  if (i < 0 || !next) return;
  flushNote();
  openLead(next);
}
$("dlgPrev").addEventListener("click", () => step(-1));
$("dlgNext").addEventListener("click", () => step(1));
dialog.addEventListener("keydown", (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
  if (/^[123]$/.test(e.key) && openLeadId && !e.metaKey && !e.ctrlKey && !e.altKey) setStatus(openLeadId, STATUSES[Number(e.key) - 1]);
});

dialog.addEventListener("close", () => {
  flushNote();
  const id = openLeadId;
  openLeadId = null;
  noteEl.dataset.for = "";
  const row = id && leadsList.querySelector(`[data-open="${CSS.escape(id)}"]`);
  if (row) row.focus({ preventScroll: true });
});
// A click on the dimmed backdrop closes it.
dialog.addEventListener("click", (e) => {
  if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  const st = e.target.closest("[data-set-status]");
  if (st && openLeadId) setStatus(openLeadId, st.getAttribute("data-set-status"));
});
$("dlgDelete").addEventListener("click", () => openLeadId && removeLead(openLeadId));

// --------------------------------------------------------------- notes --
// Saved by themselves a moment after typing stops, and when the dialog closes.
let noteTimer = null;
let notePending = null; // { id, text }

async function saveNote(id, text) {
  noteState.textContent = t("adm.note.saving");
  noteState.className = "adm-note-state";
  try {
    await setDoc(doc(db, "leadNotes", id), { text, remindAt: reminders[id] || null, updatedAt: serverTimestamp() });
    if (text) notes[id] = text;
    else delete notes[id];
    if (noteEl.dataset.for === id) {
      noteState.textContent = t("adm.note.saved");
      noteState.className = "adm-note-state ok";
    }
    const row = leadsList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const lead = leads.find((l) => l.id === id);
    if (row && lead) row.outerHTML = leadRow(lead);
    if (view === "board") renderLeads();
  } catch (err) {
    console.error(err);
    if (denied(err)) notesBlocked = true;
    noteState.textContent = denied(err) ? t("adm.note.rules") : t("adm.note.failed");
    noteState.className = "adm-note-state warn";
  }
}

async function setReminder(id, iso) {
  const before = reminders[id];
  if (iso) reminders[id] = iso;
  else delete reminders[id];
  try {
    await setDoc(doc(db, "leadNotes", id), { text: notes[id] || "", remindAt: iso || null, updatedAt: serverTimestamp() });
    toast(iso ? tr("adm.remind.set", { date: fmtDay(iso) }) : t("adm.remind.cleared"));
  } catch (err) {
    console.error(err);
    if (before) reminders[id] = before;
    else delete reminders[id];
    if (denied(err)) notesBlocked = true;
    toast(denied(err) ? t("adm.note.rules") : t("adm.saveFailed"), "err");
  }
  renderLeads();
  if (openLeadId === id) renderDialog();
}
const remindEl = $("dlgRemind");
remindEl.addEventListener("change", () => openLeadId && setReminder(openLeadId, remindEl.value || null));
document.querySelectorAll("[data-remind]").forEach((b) =>
  b.addEventListener("click", () => {
    const n = Number(b.getAttribute("data-remind"));
    if (openLeadId) setReminder(openLeadId, n ? plusDays(n) : null);
  })
);

function flushNote() {
  clearTimeout(noteTimer);
  if (!notePending) return;
  const { id, text } = notePending;
  notePending = null;
  if ((notes[id] || "") !== text) saveNote(id, text);
}

noteEl.addEventListener("input", () => {
  const id = noteEl.dataset.for;
  if (!id) return;
  notePending = { id, text: noteEl.value.trim() };
  noteState.textContent = "";
  clearTimeout(noteTimer);
  noteTimer = setTimeout(flushNote, 900);
});
noteEl.addEventListener("blur", flushNote);

// ---------------------------------------------------- shared listeners --
document.addEventListener("click", async (e) => {
  const copy = e.target.closest("[data-copy]");
  if (copy) {
    try {
      await navigator.clipboard.writeText(copy.getAttribute("data-copy"));
      toast(t("adm.copied"));
    } catch (err) {
      /* clipboard blocked — nothing to do */
    }
  }
  if (e.target.closest("[data-clear-filters]")) clearFilters();
});

leadsList.addEventListener("click", (e) => {
  if (e.target.closest("[data-stop]")) return;
  const row = e.target.closest(".adm-lead[data-id]");
  if (row) openLead(row.getAttribute("data-id"));
});

// ------------------------------------------------------------ filters --
function syncFilterUI() {
  document.querySelectorAll(".adm-chip[data-status]").forEach((b) => {
    const on = b.getAttribute("data-status") === filters.status && !filters.week;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  leadType.value = filters.type;
  leadSort.value = filters.sort;
  if (leadSearch.value.trim().toLowerCase() !== filters.q) leadSearch.value = filters.q;
}

function clearFilters() {
  Object.assign(filters, { status: "all", type: "all", service: "all", week: false, q: "" });
  leadSearch.value = "";
  renderLeads();
}

document.querySelectorAll(".adm-chip[data-status]").forEach((b) =>
  b.addEventListener("click", () => {
    filters.status = b.getAttribute("data-status");
    filters.week = false;
    renderLeads();
  })
);
document.querySelectorAll("[data-stat-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    const f = b.getAttribute("data-stat-filter");
    Object.assign(filters, { type: "all", service: "all", week: f === "week", status: f === "new" || f === "progress" ? f : "all" });
    selectTab("tabLeads");
    renderLeads();
  })
);
leadType.addEventListener("change", () => {
  filters.type = leadType.value;
  renderLeads();
});
leadSort.addEventListener("change", () => {
  filters.sort = leadSort.value;
  savePrefs();
  renderLeads();
});
leadSearch.addEventListener("input", () => {
  filters.q = leadSearch.value.trim().toLowerCase();
  renderLeads();
});

// "/" jumps to the search box of the open tab, Esc clears it.
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || dialog.open) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const input = $("tabUsers").hidden ? leadSearch : userSearch;
  if (content.classList.contains("hidden")) return;
  e.preventDefault();
  input.focus();
});
[leadSearch, userSearch].forEach((input) =>
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) {
      input.value = "";
      input.dispatchEvent(new Event("input"));
    }
  })
);

// -------------------------------------------------------------- users --
function renderUsers() {
  renderStats();
  if (usersError) {
    usersList.innerHTML = "";
    usersEmpty.innerHTML = `<p class="adm-error">${escapeHtml(errorText(usersError))}</p>`;
    usersEmpty.classList.remove("hidden");
    return;
  }
  if (users === null) return;
  const q = userSearch.value.trim().toLowerCase();
  const shown = q ? users.filter((u) => [u.name, u.email].join(" ").toLowerCase().includes(q)) : users;
  usersSummary.textContent = q && users.length ? tr("adm.showing", { n: shown.length, total: users.length }) : "";
  if (!shown.length) {
    usersList.innerHTML = "";
    usersEmpty.innerHTML = emptyBlock(users.length ? t("adm.empty.filtered") : t("adm.empty.users"), false);
    usersEmpty.classList.remove("hidden");
    return;
  }
  usersEmpty.classList.add("hidden");
  // How many requests each account has sent (leads carry the sender's uid).
  const perUser = {};
  (leads || []).forEach((l) => l.uid && (perUser[l.uid] = (perUser[l.uid] || 0) + 1));
  usersList.innerHTML = shown
    .map((u) => {
      const n = perUser[u.uid] || 0;
      return `<li class="adm-user">
      <span class="adm-avatar" aria-hidden="true">${escapeHtml(initials(u.name || u.email))}</span>
      <div class="adm-user-main">
        <span class="adm-lead-name">${u.name ? escapeHtml(u.name) : `<span class="text-faint">${escapeHtml(t("adm.unknownName"))}</span>`}</span>
        ${u.email ? `<a href="mailto:${escapeHtml(u.email)}" class="adm-contact">${escapeHtml(u.email)}</a>` : ""}
      </div>
      <div class="adm-user-side">
        ${n ? `<button type="button" class="adm-tag adm-tag-link" data-user-leads="${escapeHtml(u.email || "")}">${escapeHtml(t("adm.tab.leads"))}: ${n}</button>` : ""}
        <time class="adm-lead-date" title="${escapeHtml(fmtDate(u.createdAt))}">${escapeHtml(fmtDate(u.createdAt, false))}</time>
      </div>
    </li>`;
    })
    .join("");
}
userSearch.addEventListener("input", renderUsers);
// "Requests: 3" on a user shows that person's requests.
usersList.addEventListener("click", (e) => {
  const b = e.target.closest("[data-user-leads]");
  if (!b) return;
  Object.assign(filters, { status: "all", type: "all", service: "all", week: false, q: b.getAttribute("data-user-leads").toLowerCase() });
  selectTab("tabLeads");
  renderLeads();
});

// --------------------------------------------------------------- tabs --
const tabs = [...document.querySelectorAll(".adm-tab")];
function selectTab(panelId, focus = false) {
  tabs.forEach((b) => {
    const on = b.getAttribute("data-tab") === panelId;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  document.querySelectorAll(".adm-panel").forEach((p) => {
    const on = p.id === panelId;
    p.hidden = !on;
    p.classList.toggle("active", on);
  });
}
tabs.forEach((b, i) => {
  b.addEventListener("click", () => selectTab(b.getAttribute("data-tab")));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next.getAttribute("data-tab"), true);
  });
});

// ---------------------------------------------------------------- CSV --
// Spreadsheet apps treat cells starting with = + - @ as formulas; prefix them
// so a malicious lead can't smuggle a formula into the exported file.
function csvCell(value) {
  let s = String(value == null ? "" : value).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(rows, name) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smartmenukj-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Exports what the list shows (the current filters, or just the selected
// requests), in the panel's language.
$("exportCsv").addEventListener("click", () => {
  if (!leads) return;
  const cols = ["date", "name", "company", "email", "phone", "type", "service", "message", "status"];
  const rows = [[...cols.map((c) => t(`adm.th.${c}`)), t("adm.note")]];
  const list = selected.size ? shownLeads().filter((l) => selected.has(l.id)) : shownLeads();
  list.forEach((l) =>
    rows.push([fmtDate(l.createdAt), l.name, l.company, l.email, l.phone, audienceLabel(l.audience), serviceLabel(l.service), l.message, statusLabel(statusOf(l)), notes[l.id] || ""])
  );
  downloadCsv(rows, "leads");
});
$("exportUsers").addEventListener("click", () => {
  if (!users) return;
  const rows = [[t("adm.th.name"), t("adm.th.email"), t("adm.th.registered")]];
  users.forEach((u) => rows.push([u.name, u.email, fmtDate(u.createdAt)]));
  downloadCsv(rows, "users");
});

// ------------------------------------------------------------ loading --
function renderUpdated() {
  if (!lastLoaded) return;
  const mins = Math.round((Date.now() - lastLoaded) / 60000);
  const time = mins < 1 ? t("adm.justNow") : new Date(lastLoaded).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  updatedEl.textContent = tr("adm.updated", { time });
}

let loadingNow = false;
async function loadAll({ quiet = false } = {}) {
  if (loadingNow) return;
  loadingNow = true;
  if (!quiet) $("admRefresh").classList.add("spinning");
  const [l, u, n] = await Promise.allSettled([
    getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"))),
    notesBlocked ? Promise.reject({ code: "permission-denied" }) : getDocs(collection(db, "leadNotes")),
  ]);
  if (l.status === "fulfilled") {
    leads = l.value.docs.map((d) => ({ id: d.id, ...d.data() }));
    leadsError = null;
    // Flag requests that arrived since the last load (not on the first one).
    const ids = new Set(leads.map((x) => x.id));
    if (knownIds) {
      const fresh = [...ids].filter((id) => !knownIds.has(id));
      fresh.forEach((id) => freshIds.add(id));
      if (fresh.length) toast(tr("adm.fresh", { n: fresh.length }));
    }
    knownIds = ids;
  } else {
    console.error(l.reason);
    leadsError = l.reason;
  }
  if (u.status === "fulfilled") {
    users = u.value.docs.map((d) => d.data());
    usersError = null;
  } else {
    console.error(u.reason);
    usersError = u.reason;
  }
  if (n.status === "fulfilled") {
    notes = {};
    reminders = {};
    n.value.docs.forEach((d) => {
      const { text, remindAt } = d.data();
      if (text) notes[d.id] = String(text);
      if (typeof remindAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(remindAt)) reminders[d.id] = remindAt;
    });
  } else if (denied(n.reason)) {
    notesBlocked = true; // rules not published yet — the rest still works
  } else console.error(n.reason);
  lastLoaded = Date.now();
  loadingNow = false;
  $("admRefresh").classList.remove("spinning");
  // A quiet refresh must not throw away what the admin is in the middle of.
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && leadsList.contains(document.activeElement);
  if (!typing) renderLeads();
  renderUsers();
  renderUpdated();
  if (openLeadId) renderDialog();
}
$("admRefresh").addEventListener("click", () => loadAll());

// Refresh every minute while the page is open and visible, and on return.
setInterval(() => {
  renderUpdated();
  if (lastLoaded && document.visibilityState === "visible" && Date.now() - lastLoaded >= AUTO_REFRESH && !dialog.open) loadAll({ quiet: true });
}, 15000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && lastLoaded && Date.now() - lastLoaded >= AUTO_REFRESH) loadAll({ quiet: true });
});

// Re-render dates, labels and counts when the language changes.
document.addEventListener("smkj:lang", () => {
  if (content.classList.contains("hidden")) return;
  renderLeads();
  renderUsers();
  renderUpdated();
  if (openLeadId) {
    renderDialog();
    if (notesBlocked) noteState.textContent = t("adm.note.rules");
  }
  if (who.dataset.email) who.textContent = tr("adm.who", { email: who.dataset.email });
});

let loadedFor = null;
watchAuth((user) => {
  loading.classList.add("hidden");
  if (!isAdmin(user)) {
    guard.classList.remove("hidden");
    content.classList.add("hidden");
    headActions.classList.add("hidden");
    who.classList.add("hidden");
    loadedFor = null;
    return;
  }
  guard.classList.add("hidden");
  content.classList.remove("hidden");
  headActions.classList.remove("hidden");
  who.dataset.email = user.email || "";
  who.textContent = tr("adm.who", { email: user.email || "" });
  who.classList.remove("hidden");
  if (loadedFor === user.uid) return;
  loadedFor = user.uid;
  setView(view); // also draws the skeleton while loading
  loadAll();
});
