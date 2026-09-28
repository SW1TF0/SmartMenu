// ============================================================================
// account.html — customer dashboard: profile + the visitor's own submitted
// leads (quote requests / contact messages).
// ============================================================================
import { auth, db } from "./firebase-config.js";
import { watchAuth } from "./auth.js";
import { t, escapeHtml } from "./i18n.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const guard = document.getElementById("accountGuard");
const content = document.getElementById("accountContent");
const nameEl = document.getElementById("acctName");
const emailEl = document.getElementById("acctEmail");
const sinceEl = document.getElementById("acctSince");
const form = document.getElementById("profileForm");
const list = document.getElementById("leadsList");
const empty = document.getElementById("leadsEmpty");

const STATUS_CLASS = { new: "status-new", progress: "status-progress", done: "status-done" };

function fmtDate(ts) {
  if (!ts || !ts.toDate) return "—";
  return ts.toDate().toLocaleDateString(document.documentElement.lang === "bg" ? "bg-BG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function serviceLabel(service) {
  const key = service && service !== "general" ? `svc.${service}` : "contact.form.svc.general";
  const label = t(key);
  return label === key ? service || "—" : label;
}

function statusTag(status) {
  const cls = STATUS_CLASS[status] || "status-new";
  const key = `status.${STATUS_CLASS[status] ? status : "new"}`;
  return `<span class="status-tag ${cls}" data-i18n="${key}">${escapeHtml(t(key))}</span>`;
}

let leads = null;

function renderLeads() {
  if (leads === null) return;
  if (!leads.length) {
    empty.classList.remove("hidden");
    list.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = leads
    .map((l) => {
      const msg = l.message || "";
      return `<tr>
        <td>${escapeHtml(fmtDate(l.createdAt))}</td>
        <td>${escapeHtml(serviceLabel(l.service))}</td>
        <td>${escapeHtml(msg.slice(0, 80))}${msg.length > 80 ? "…" : ""}</td>
        <td>${statusTag(l.status)}</td>
      </tr>`;
    })
    .join("");
}

async function loadLeads(uid) {
  const q = query(collection(db, "leads"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  leads = snap.docs.map((d) => d.data());
  renderLeads();
}

let profileBound = false;

watchAuth(async (user) => {
  if (!user) {
    guard.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }
  guard.classList.add("hidden");
  content.classList.remove("hidden");

  nameEl.value = user.displayName || "";
  emailEl.textContent = user.email;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists() && snap.data().createdAt) sinceEl.textContent = fmtDate(snap.data().createdAt);

  loadLeads(user.uid);

  if (profileBound) return;
  profileBound = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = nameEl.value.trim();
    const note = document.getElementById("profileNote");
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
      await updateDoc(doc(db, "users", auth.currentUser.uid), { name: newName });
      note.textContent = t("acct.profile.saved");
      note.className = "form-note show ok";
      window.dispatchEvent(new Event("smkj:i18n-refresh"));
    } catch (err) {
      note.textContent = err.message;
      note.className = "form-note show err";
    }
  });
});

document.addEventListener("smkj:lang", renderLeads);
