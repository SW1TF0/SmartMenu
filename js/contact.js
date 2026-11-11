// ============================================================================
// Contact / quote-request form handling — writes to the `leads` collection.
// Used by contact.html (general + service-specific quote requests). Each lead
// records whether it came from the "For home" or "For business" version of
// the site (audience) and, for businesses, the company name.
// ============================================================================
import { db, auth } from "./firebase-config.js?v=20261111f";
import { getAudience } from "./i18n.js?v=20261111f";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function submitLead({ name, email, phone, service, message, company }) {
  const user = auth.currentUser;
  const audience = getAudience();
  return addDoc(collection(db, "leads"), {
    name: (name || "").trim(),
    email: (email || "").trim(),
    phone: (phone || "").trim(),
    service: service || "general",
    message: (message || "").trim(),
    audience,
    // The company field is only shown to business visitors.
    company: audience === "business" ? (company || "").trim().slice(0, 190) : "",
    uid: user ? user.uid : null,
    status: "new",
    createdAt: serverTimestamp(),
  });
}

export function wireContactForm(form, { onSuccess, onError } = {}) {
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.email || !data.message) return;
    if (btn) btn.disabled = true;
    try {
      await submitLead(data);
      form.reset();
      if (onSuccess) onSuccess();
    } catch (err) {
      if (onError) onError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
