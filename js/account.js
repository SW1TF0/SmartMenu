// ============================================================================
// account.html — customer dashboard: profile + the visitor's own submitted
// leads (quote requests / contact messages).
// ============================================================================
import { auth, db } from "./firebase-config.js";
import { watchAuth } from "./auth.js";
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

function fmtDate(ts) {
  if (!ts || !ts.toDate) return "—";
  return ts.toDate().toLocaleDateString(document.documentElement.lang === "bg" ? "bg-BG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusTag(status) {
  const map = { new: "status-new", progress: "status-progress", done: "status-done" };
  const label = { new: "New", progress: "In progress", done: "Completed" }[status] || status;
  return `<span class="status-tag ${map[status] || "status-new"}">${label}</span>`;
}

async function loadLeads(uid) {
  const q = query(collection(db, "leads"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  if (snap.empty) {
    empty.classList.remove("hidden");
    list.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = snap.docs
    .map((d) => {
      const l = d.data();
      return `<tr>
        <td>${fmtDate(l.createdAt)}</td>
        <td>${l.service || "general"}</td>
        <td>${(l.message || "").slice(0, 80)}${l.message && l.message.length > 80 ? "…" : ""}</td>
        <td>${statusTag(l.status)}</td>
      </tr>`;
    })
    .join("");
}

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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = nameEl.value.trim();
    const note = document.getElementById("profileNote");
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
      await updateDoc(doc(db, "users", user.uid), { name: newName });
      note.textContent = "Saved.";
      note.className = "form-note show ok";
      window.dispatchEvent(new Event("smkj:i18n-refresh"));
    } catch (err) {
      note.textContent = err.message;
      note.className = "form-note show err";
    }
  });
});
