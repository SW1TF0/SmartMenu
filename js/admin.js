// ============================================================================
// admin.html — gated dashboard: leads (contact/quote submissions) + users.
// Access is gated by ADMIN_EMAILS in firebase-config.js (client-side gate)
// and mirrored in firebase/firestore.rules (server-side enforcement).
// Lead and user fields are written by the public, so every value is escaped
// before it is put into the page.
// ============================================================================
import { db } from "./firebase-config.js?v=20260928";
import { watchAuth, isAdmin } from "./auth.js?v=20260928";
import { escapeHtml } from "./i18n.js?v=20260928";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const guard = document.getElementById("adminGuard");
const content = document.getElementById("adminContent");
const statTotal = document.getElementById("statTotalLeads");
const statNew = document.getElementById("statNewLeads");
const statUsers = document.getElementById("statUsers");
const statWeek = document.getElementById("statWeek");
const leadsBody = document.getElementById("leadsBody");
const usersBody = document.getElementById("usersBody");
const leadsEmpty = document.getElementById("leadsEmpty");
const usersEmpty = document.getElementById("usersEmpty");
const exportBtn = document.getElementById("exportCsv");

const STATUSES = ["new", "progress", "done"];
let leadsCache = [];

function fmtDate(ts) {
  if (!ts || !ts.toDate) return "—";
  return ts.toDate().toLocaleString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusOptions(current) {
  return STATUSES.map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`).join("");
}

async function loadLeads() {
  const snap = await getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc")));
  leadsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  statTotal.textContent = leadsCache.length;
  statNew.textContent = leadsCache.filter((l) => l.status === "new").length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  statWeek.textContent = leadsCache.filter((l) => l.createdAt && l.createdAt.toMillis && l.createdAt.toMillis() > weekAgo).length;

  if (!leadsCache.length) {
    leadsEmpty.classList.remove("hidden");
    leadsBody.innerHTML = "";
    return;
  }
  leadsEmpty.classList.add("hidden");
  leadsBody.innerHTML = leadsCache
    .map((l) => {
      const id = escapeHtml(l.id);
      const email = l.email ? String(l.email) : "";
      return `<tr data-id="${id}">
      <td>${escapeHtml(fmtDate(l.createdAt))}</td>
      <td>${escapeHtml(l.name || "")}</td>
      <td>${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ""}</td>
      <td>${escapeHtml(l.phone || "—")}</td>
      <td>${escapeHtml(l.service || "general")}</td>
      <td style="max-width:260px;">${escapeHtml(String(l.message || "").slice(0, 140))}</td>
      <td><select class="status-select" data-id="${id}" aria-label="Status">${statusOptions(l.status)}</select></td>
      <td><button type="button" class="btn btn-ghost btn-sm delete-lead" data-id="${id}">Delete</button></td>
    </tr>`;
    })
    .join("");

  leadsBody.querySelectorAll(".status-select").forEach((sel) =>
    sel.addEventListener("change", async () => {
      await updateDoc(doc(db, "leads", sel.getAttribute("data-id")), { status: sel.value });
    })
  );
  leadsBody.querySelectorAll(".delete-lead").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this lead permanently?")) return;
      await deleteDoc(doc(db, "leads", btn.getAttribute("data-id")));
      loadLeads();
    })
  );
}

async function loadUsers() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  const users = snap.docs.map((d) => d.data());
  statUsers.textContent = users.length;
  if (!users.length) {
    usersEmpty.classList.remove("hidden");
    usersBody.innerHTML = "";
    return;
  }
  usersEmpty.classList.add("hidden");
  usersBody.innerHTML = users
    .map((u) => `<tr><td>${escapeHtml(u.name || "—")}</td><td>${escapeHtml(u.email || "")}</td><td>${escapeHtml(fmtDate(u.createdAt))}</td></tr>`)
    .join("");
}

// Spreadsheet apps treat cells starting with = + - @ as formulas; prefix them
// so a malicious lead can't smuggle a formula into the exported file.
function csvCell(value) {
  let s = String(value == null ? "" : value).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportLeadsCsv() {
  const rows = [["Date", "Name", "Email", "Phone", "Service", "Message", "Status"]];
  leadsCache.forEach((l) => rows.push([fmtDate(l.createdAt), l.name, l.email, l.phone, l.service, l.message, l.status]));
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smartmenukj-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll(".tab-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById(btn.getAttribute("data-tab")).classList.add("active");
  })
);

if (exportBtn) exportBtn.addEventListener("click", exportLeadsCsv);

watchAuth((user) => {
  if (!isAdmin(user)) {
    guard.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }
  guard.classList.add("hidden");
  content.classList.remove("hidden");
  loadLeads();
  loadUsers();
});
