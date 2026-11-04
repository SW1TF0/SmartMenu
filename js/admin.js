// ============================================================================
// admin.html — gated dashboard: leads (contact/quote submissions) + users.
// Access is gated by ADMIN_EMAILS in firebase-config.js (client-side gate)
// and mirrored in firebase/firestore.rules (server-side enforcement).
// Lead and user fields are written by the public, so every value is escaped
// before it is put into the page.
//
// The panel speaks the admin's language (BG / TR / EN, from the header
// switch). Leads show as a searchable, filterable list; a click opens the
// full request with call / email / copy actions, the status and delete.
// ============================================================================
import { db } from "./firebase-config.js?v=20261104";
import { watchAuth, isAdmin } from "./auth.js?v=20261104";
import { escapeHtml, registerDict, applyI18n, t, getLang } from "./i18n.js?v=20261104";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

registerDict({
  en: {
    "adm.eyebrow": "Admin",
    "adm.title": "Dashboard",
    "adm.who": "Signed in as {email}",
    "adm.loading": "Loading…",
    "adm.refresh": "Refresh",
    "adm.updated": "Updated {time}",
    "adm.guard.title": "Admins only",
    "adm.guard.desc": "Sign in with an admin account to view this page.",
    "adm.stat.new": "New",
    "adm.stat.newHint": "waiting for a reply",
    "adm.stat.progress": "In progress",
    "adm.stat.progressHint": "being handled",
    "adm.stat.week": "Last 7 days",
    "adm.stat.weekHint": "new requests",
    "adm.stat.total": "All requests",
    "adm.stat.usersHint": "registered users",
    "adm.tab.leads": "Requests",
    "adm.tab.users": "Users",
    "adm.search.leads": "Search name, phone, email…",
    "adm.search.users": "Search name or email…",
    "adm.filter.status": "Filter by status",
    "adm.filter.all": "All",
    "adm.filter.type": "Filter by type",
    "adm.filter.allTypes": "All types",
    "adm.filter.week": "Last 7 days",
    "adm.type.personal": "Home",
    "adm.type.business": "Business",
    "adm.export": "Export CSV",
    "adm.th.date": "Date",
    "adm.th.name": "Name",
    "adm.th.company": "Company",
    "adm.th.email": "Email",
    "adm.th.phone": "Phone",
    "adm.th.type": "Type",
    "adm.th.service": "Service",
    "adm.th.message": "Message",
    "adm.th.status": "Status",
    "adm.th.registered": "Registered",
    "adm.call": "Call",
    "adm.email": "Email",
    "adm.copy": "Copy",
    "adm.copied": "Copied",
    "adm.close": "Close",
    "adm.delete": "Delete",
    "adm.deleteConfirm": "Delete this request from {name} permanently? This can't be undone.",
    "adm.deleted": "Request deleted",
    "adm.saved": "Status: {status}",
    "adm.saveFailed": "Couldn't save — check your connection and try again.",
    "adm.showing": "{n} of {total}",
    "adm.clear": "Clear filters",
    "adm.empty.leads": "No requests yet. New ones from the contact form will appear here.",
    "adm.empty.users": "No registered users yet.",
    "adm.empty.filtered": "Nothing matches these filters.",
    "adm.err.denied": "No access: this account is not in the Firestore rules admin list. Add it to firebase/firestore.rules and publish the rules in the Firebase console.",
    "adm.err.load": "Could not load data. Check your connection and refresh.",
    "adm.noMessage": "(no message)",
    "adm.justNow": "just now",
    "adm.today": "Today",
    "adm.yesterday": "Yesterday",
    "adm.unknownName": "(no name)",
  },
  bg: {
    "adm.eyebrow": "Админ",
    "adm.title": "Табло",
    "adm.who": "Влезли сте като {email}",
    "adm.loading": "Зареждане…",
    "adm.refresh": "Обнови",
    "adm.updated": "Обновено {time}",
    "adm.guard.title": "Само за администратори",
    "adm.guard.desc": "Влезте с администраторски профил, за да видите тази страница.",
    "adm.stat.new": "Нови",
    "adm.stat.newHint": "чакат отговор",
    "adm.stat.progress": "В процес",
    "adm.stat.progressHint": "в работа",
    "adm.stat.week": "Последните 7 дни",
    "adm.stat.weekHint": "нови запитвания",
    "adm.stat.total": "Всички запитвания",
    "adm.stat.usersHint": "регистрирани потребители",
    "adm.tab.leads": "Запитвания",
    "adm.tab.users": "Потребители",
    "adm.search.leads": "Търси име, телефон, имейл…",
    "adm.search.users": "Търси по име или имейл…",
    "adm.filter.status": "Филтър по статус",
    "adm.filter.all": "Всички",
    "adm.filter.type": "Филтър по тип",
    "adm.filter.allTypes": "Всички типове",
    "adm.filter.week": "Последните 7 дни",
    "adm.type.personal": "Дом",
    "adm.type.business": "Бизнес",
    "adm.export": "Експорт CSV",
    "adm.th.date": "Дата",
    "adm.th.name": "Име",
    "adm.th.company": "Фирма",
    "adm.th.email": "Имейл",
    "adm.th.phone": "Телефон",
    "adm.th.type": "Тип",
    "adm.th.service": "Услуга",
    "adm.th.message": "Съобщение",
    "adm.th.status": "Статус",
    "adm.th.registered": "Регистриран",
    "adm.call": "Обади се",
    "adm.email": "Имейл",
    "adm.copy": "Копирай",
    "adm.copied": "Копирано",
    "adm.close": "Затвори",
    "adm.delete": "Изтрий",
    "adm.deleteConfirm": "Да изтрия ли запитването от {name} завинаги? Това не може да се върне.",
    "adm.deleted": "Запитването е изтрито",
    "adm.saved": "Статус: {status}",
    "adm.saveFailed": "Не успях да запазя — проверете връзката и опитайте пак.",
    "adm.showing": "{n} от {total}",
    "adm.clear": "Изчисти филтрите",
    "adm.empty.leads": "Още няма запитвания. Новите от формата за контакт ще се появят тук.",
    "adm.empty.users": "Още няма регистрирани потребители.",
    "adm.empty.filtered": "Нищо не отговаря на тези филтри.",
    "adm.err.denied": "Няма достъп: този профил не е в списъка с админи във Firestore правилата. Добавете го във firebase/firestore.rules и публикувайте правилата във Firebase конзолата.",
    "adm.err.load": "Данните не се заредиха. Проверете връзката и обновете.",
    "adm.noMessage": "(без съобщение)",
    "adm.justNow": "току-що",
    "adm.today": "Днес",
    "adm.yesterday": "Вчера",
    "adm.unknownName": "(без име)",
  },
  tr: {
    "adm.eyebrow": "Yönetim",
    "adm.title": "Panel",
    "adm.who": "{email} olarak giriş yapıldı",
    "adm.loading": "Yükleniyor…",
    "adm.refresh": "Yenile",
    "adm.updated": "Güncellendi {time}",
    "adm.guard.title": "Yalnızca yöneticiler",
    "adm.guard.desc": "Bu sayfayı görmek için yönetici hesabıyla giriş yapın.",
    "adm.stat.new": "Yeni",
    "adm.stat.newHint": "yanıt bekliyor",
    "adm.stat.progress": "İşlemde",
    "adm.stat.progressHint": "ilgileniliyor",
    "adm.stat.week": "Son 7 gün",
    "adm.stat.weekHint": "yeni talep",
    "adm.stat.total": "Tüm talepler",
    "adm.stat.usersHint": "kayıtlı kullanıcı",
    "adm.tab.leads": "Talepler",
    "adm.tab.users": "Kullanıcılar",
    "adm.search.leads": "Ad, telefon, e-posta ara…",
    "adm.search.users": "Ad veya e-posta ara…",
    "adm.filter.status": "Duruma göre filtrele",
    "adm.filter.all": "Tümü",
    "adm.filter.type": "Türe göre filtrele",
    "adm.filter.allTypes": "Tüm türler",
    "adm.filter.week": "Son 7 gün",
    "adm.type.personal": "Ev",
    "adm.type.business": "İşletme",
    "adm.export": "CSV dışa aktar",
    "adm.th.date": "Tarih",
    "adm.th.name": "Ad",
    "adm.th.company": "Şirket",
    "adm.th.email": "E-posta",
    "adm.th.phone": "Telefon",
    "adm.th.type": "Tür",
    "adm.th.service": "Hizmet",
    "adm.th.message": "Mesaj",
    "adm.th.status": "Durum",
    "adm.th.registered": "Kayıt",
    "adm.call": "Ara",
    "adm.email": "E-posta",
    "adm.copy": "Kopyala",
    "adm.copied": "Kopyalandı",
    "adm.close": "Kapat",
    "adm.delete": "Sil",
    "adm.deleteConfirm": "{name} kişisinin talebi kalıcı olarak silinsin mi? Bu geri alınamaz.",
    "adm.deleted": "Talep silindi",
    "adm.saved": "Durum: {status}",
    "adm.saveFailed": "Kaydedilemedi — bağlantınızı kontrol edip tekrar deneyin.",
    "adm.showing": "{n} / {total}",
    "adm.clear": "Filtreleri temizle",
    "adm.empty.leads": "Henüz talep yok. İletişim formundan gelenler burada görünecek.",
    "adm.empty.users": "Henüz kayıtlı kullanıcı yok.",
    "adm.empty.filtered": "Bu filtrelere uyan bir şey yok.",
    "adm.err.denied": "Erişim yok: bu hesap Firestore kurallarındaki yönetici listesinde değil. firebase/firestore.rules dosyasına ekleyip kuralları Firebase konsolunda yayınlayın.",
    "adm.err.load": "Veriler yüklenemedi. Bağlantınızı kontrol edip yenileyin.",
    "adm.noMessage": "(mesaj yok)",
    "adm.justNow": "az önce",
    "adm.today": "Bugün",
    "adm.yesterday": "Dün",
    "adm.unknownName": "(adsız)",
  },
});
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
const userSearch = $("userSearch");
const dialog = $("leadDialog");
const toastEl = $("admToast");

const STATUSES = ["new", "progress", "done"];
const WEEK = 7 * 24 * 60 * 60 * 1000;

let leads = null; // null = not loaded yet
let users = null;
let leadsError = null;
let usersError = null;
let lastLoaded = null;
let openLeadId = null;
const filters = { status: "all", type: "all", week: false, q: "" };

// ------------------------------------------------------------- helpers --
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : vars[k]));
const tr = (key, vars = {}) => fill(t(key), vars);
const locale = () => ({ bg: "bg-BG", tr: "tr-TR" })[getLang()] || "en-GB";
const millis = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);
const statusOf = (l) => (STATUSES.includes(l.status) ? l.status : "new");
const statusLabel = (s) => t(`status.${s}`);

function fmtDate(ts, withTime = true) {
  if (!ts || !ts.toDate) return "—";
  const opts = { year: "numeric", month: "short", day: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return ts.toDate().toLocaleString(locale(), opts);
}

// "14:05" today, "Yesterday", otherwise "3 Nov" (with the year when it differs).
function shortDate(ts) {
  if (!ts || !ts.toDate) return "—";
  const d = ts.toDate();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  if (d.getTime() >= startToday) return time;
  if (d.getTime() >= startToday - 86400000) return t("adm.yesterday");
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(locale(), opts);
}

// "For home" / "For business" — leads from before the switch existed have none.
function audienceLabel(audience) {
  return audience === "personal" ? t("adm.type.personal") : audience === "business" ? t("adm.type.business") : "—";
}

function serviceLabel(service) {
  const key = service && service !== "general" ? `svc.${service}` : "contact.form.svc.general";
  const label = t(key);
  return label === key ? service || "—" : label;
}

const telHref = (phone) => "tel:" + String(phone).replace(/[^\d+]/g, "");

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
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function errorText(err) {
  return err && err.code === "permission-denied" ? t("adm.err.denied") : t("adm.err.load");
}

// -------------------------------------------------------------- leads --
function matchesLead(l) {
  if (filters.status !== "all" && statusOf(l) !== filters.status) return false;
  if (filters.type !== "all" && l.audience !== filters.type) return false;
  if (filters.week && millis(l.createdAt) < Date.now() - WEEK) return false;
  if (filters.q) {
    const hay = [l.name, l.company, l.email, l.phone, l.message, serviceLabel(l.service)].join(" ").toLowerCase();
    const digits = filters.q.replace(/\D/g, "");
    const phoneHit = digits.length >= 3 && String(l.phone || "").replace(/\D/g, "").includes(digits);
    if (!hay.includes(filters.q) && !phoneHit) return false;
  }
  return true;
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
  document.querySelectorAll("[data-stat-filter]").forEach((el) => {
    const f = el.getAttribute("data-stat-filter");
    const on =
      f === "week" ? filters.week : f === "all" ? !filters.week && filters.status === "all" : !filters.week && filters.status === f;
    el.classList.toggle("active", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function leadRow(l) {
  const id = escapeHtml(l.id);
  const s = statusOf(l);
  const name = l.name ? escapeHtml(l.name) : `<span class="text-faint">${escapeHtml(t("adm.unknownName"))}</span>`;
  const msg = String(l.message || "").trim();
  const contact = [];
  if (l.phone) contact.push(`<a href="${escapeHtml(telHref(l.phone))}" class="adm-contact" data-stop>${escapeHtml(l.phone)}</a>`);
  if (l.email) contact.push(`<a href="mailto:${escapeHtml(l.email)}" class="adm-contact" data-stop>${escapeHtml(l.email)}</a>`);
  const typeTag = l.audience ? `<span class="adm-tag">${escapeHtml(audienceLabel(l.audience))}</span>` : "";
  return `<li class="adm-lead s-${s}" data-id="${id}">
    <button type="button" class="adm-lead-open" data-open="${id}" aria-label="${escapeHtml((l.name || "") + " — " + statusLabel(s))}"></button>
    <span class="adm-avatar" aria-hidden="true">${escapeHtml(initials(l.name))}</span>
    <div class="adm-lead-main">
      <div class="adm-lead-top">
        <span class="adm-lead-name">${name}</span>
        ${l.company ? `<span class="adm-lead-company">${escapeHtml(l.company)}</span>` : ""}
      </div>
      <div class="adm-lead-meta">
        <span class="adm-tag adm-tag-svc">${escapeHtml(serviceLabel(l.service))}</span>${typeTag}
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
  if (leadsError) {
    leadsList.innerHTML = "";
    leadsSummary.textContent = "";
    leadsEmpty.innerHTML = `<p class="adm-error">${escapeHtml(errorText(leadsError))}</p>`;
    leadsEmpty.classList.remove("hidden");
    return;
  }
  if (leads === null) {
    leadsList.innerHTML = Array.from({ length: 4 }, () => `<li class="adm-lead adm-skel" aria-hidden="true"><span class="adm-avatar"></span><div class="adm-lead-main"><i></i><i></i><i></i></div></li>`).join("");
    leadsEmpty.classList.add("hidden");
    return;
  }
  const shown = leads.filter(matchesLead);
  const filtered = filters.status !== "all" || filters.type !== "all" || filters.week || !!filters.q;
  leadsSummary.textContent = filtered && leads.length ? tr("adm.showing", { n: shown.length, total: leads.length }) : "";
  if (!shown.length) {
    leadsList.innerHTML = "";
    leadsEmpty.innerHTML = emptyBlock(leads.length ? t("adm.empty.filtered") : t("adm.empty.leads"), leads.length > 0);
    leadsEmpty.classList.remove("hidden");
    return;
  }
  leadsEmpty.classList.add("hidden");
  leadsList.innerHTML = shown.map(leadRow).join("");
}

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
    toast(err && err.code === "permission-denied" ? t("adm.err.denied") : t("adm.saveFailed"), "err");
  }
}

async function removeLead(id) {
  const lead = leads && leads.find((l) => l.id === id);
  if (!lead) return;
  if (!confirm(tr("adm.deleteConfirm", { name: lead.name || lead.email || "—" }))) return;
  try {
    await deleteDoc(doc(db, "leads", id));
    leads = leads.filter((l) => l.id !== id);
    if (dialog.open) dialog.close();
    renderLeads();
    toast(t("adm.deleted"));
  } catch (err) {
    console.error(err);
    toast(err && err.code === "permission-denied" ? t("adm.err.denied") : t("adm.saveFailed"), "err");
  }
}

// ------------------------------------------------------------- dialog --
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
      <span class="adm-crow-actions"><a class="adm-btn adm-btn-primary" href="mailto:${escapeHtml(l.email)}">${escapeHtml(t("adm.email"))}</a><button type="button" class="adm-btn" data-copy="${escapeHtml(l.email)}">${escapeHtml(t("adm.copy"))}</button></span></div>`);
  $("dlgContact").innerHTML = rows.join("");
  const msg = String(l.message || "").trim();
  $("dlgMessage").textContent = msg || t("adm.noMessage");
  $("dlgStatus").innerHTML = STATUSES.map(
    (v) => `<button type="button" class="s-${v}${v === s ? " active" : ""}" data-set-status="${v}" aria-pressed="${v === s}"><i class="dot dot-${v}"></i>${escapeHtml(statusLabel(v))}</button>`
  ).join("");
}

function openLead(id) {
  openLeadId = id;
  renderDialog();
  if (!dialog.open) dialog.showModal();
}

dialog.addEventListener("close", () => {
  const id = openLeadId;
  openLeadId = null;
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
leadsList.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-status-for]");
  if (sel) setStatus(sel.getAttribute("data-status-for"), sel.value);
});

// ------------------------------------------------------------ filters --
function syncFilterUI() {
  document.querySelectorAll(".adm-chip[data-status]").forEach((b) => {
    const on = b.getAttribute("data-status") === filters.status;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  leadType.value = filters.type;
  if (leadSearch.value.trim().toLowerCase() !== filters.q) leadSearch.value = filters.q;
}

function clearFilters() {
  Object.assign(filters, { status: "all", type: "all", week: false, q: "" });
  leadSearch.value = "";
  syncFilterUI();
  renderLeads();
}

document.querySelectorAll(".adm-chip[data-status]").forEach((b) =>
  b.addEventListener("click", () => {
    filters.status = b.getAttribute("data-status");
    filters.week = false;
    syncFilterUI();
    renderLeads();
  })
);
document.querySelectorAll("[data-stat-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    const f = b.getAttribute("data-stat-filter");
    filters.week = f === "week";
    filters.status = f === "new" || f === "progress" ? f : "all";
    selectTab("tabLeads");
    syncFilterUI();
    renderLeads();
  })
);
leadType.addEventListener("change", () => {
  filters.type = leadType.value;
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
  usersList.innerHTML = shown
    .map(
      (u) => `<li class="adm-user">
      <span class="adm-avatar" aria-hidden="true">${escapeHtml(initials(u.name || u.email))}</span>
      <div class="adm-user-main">
        <span class="adm-lead-name">${u.name ? escapeHtml(u.name) : `<span class="text-faint">${escapeHtml(t("adm.unknownName"))}</span>`}</span>
        ${u.email ? `<a href="mailto:${escapeHtml(u.email)}" class="adm-contact">${escapeHtml(u.email)}</a>` : ""}
      </div>
      <time class="adm-lead-date" title="${escapeHtml(fmtDate(u.createdAt))}">${escapeHtml(fmtDate(u.createdAt, false))}</time>
    </li>`
    )
    .join("");
}
userSearch.addEventListener("input", renderUsers);

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

// Exports what the list shows (the current filters), in the panel's language.
$("exportCsv").addEventListener("click", () => {
  if (!leads) return;
  const cols = ["date", "name", "company", "email", "phone", "type", "service", "message", "status"];
  const rows = [cols.map((c) => t(`adm.th.${c}`))];
  leads.filter(matchesLead).forEach((l) =>
    rows.push([fmtDate(l.createdAt), l.name, l.company, l.email, l.phone, audienceLabel(l.audience), serviceLabel(l.service), l.message, statusLabel(statusOf(l))])
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
setInterval(renderUpdated, 30000);

let loadingNow = false;
async function loadAll() {
  if (loadingNow) return;
  loadingNow = true;
  $("admRefresh").classList.add("spinning");
  const [l, u] = await Promise.allSettled([
    getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"))),
  ]);
  if (l.status === "fulfilled") {
    leads = l.value.docs.map((d) => ({ id: d.id, ...d.data() }));
    leadsError = null;
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
  lastLoaded = Date.now();
  loadingNow = false;
  $("admRefresh").classList.remove("spinning");
  renderLeads();
  renderUsers();
  renderUpdated();
  if (openLeadId) renderDialog();
}
$("admRefresh").addEventListener("click", loadAll);

// Re-render dates, labels and counts when the language changes.
document.addEventListener("smkj:lang", () => {
  if (content.classList.contains("hidden")) return;
  renderLeads();
  renderUsers();
  renderUpdated();
  if (openLeadId) renderDialog();
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
  renderLeads(); // skeleton while loading
  loadAll();
});
