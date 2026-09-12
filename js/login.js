// ============================================================================
// login.html — sign in / register tabs + Google sign-in + forgot password.
// ============================================================================
import { registerWithEmail, loginWithEmail, loginWithGoogle, resetPassword, friendlyAuthError, watchAuth } from "./auth.js";
import { getLang } from "./i18n.js";

const tabs = document.querySelectorAll(".auth-tabs button");
const panels = { signin: document.getElementById("panelSignin"), signup: document.getElementById("panelSignup") };

tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(panels).forEach((p) => p.classList.add("hidden"));
    panels[tab.getAttribute("data-tab")].classList.remove("hidden");
  })
);

function redirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "account.html";
}

function showNote(el, msg, ok) {
  el.textContent = msg;
  el.className = `form-note show ${ok ? "ok" : "err"}`;
}

watchAuth((user) => {
  if (user) window.location.replace(redirectTarget());
});

const signinForm = document.getElementById("signinForm");
const signinNote = document.getElementById("signinNote");
signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signinEmail").value.trim();
  const password = document.getElementById("signinPassword").value;
  const btn = signinForm.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await loginWithEmail(email, password);
  } catch (err) {
    showNote(signinNote, friendlyAuthError(err, getLang()), false);
  } finally {
    btn.disabled = false;
  }
});

const signupForm = document.getElementById("signupForm");
const signupNote = document.getElementById("signupNote");
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const btn = signupForm.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await registerWithEmail(name, email, password);
  } catch (err) {
    showNote(signupNote, friendlyAuthError(err, getLang()), false);
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll(".btn-google").forEach((btn) =>
  btn.addEventListener("click", async () => {
    const note = btn.closest(".tab-panel").querySelector(".form-note");
    try {
      await loginWithGoogle();
    } catch (err) {
      if (note) showNote(note, friendlyAuthError(err, getLang()), false);
    }
  })
);

document.getElementById("forgotLink").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = (document.getElementById("signinEmail").value || "").trim() || prompt(getLang() === "bg" ? "Въведете имейл за възстановяване:" : "Enter your email to reset your password:");
  if (!email) return;
  try {
    await resetPassword(email);
    showNote(signinNote, getLang() === "bg" ? "Изпратихме имейл за възстановяване на паролата." : "Password reset email sent — check your inbox.", true);
  } catch (err) {
    showNote(signinNote, friendlyAuthError(err, getLang()), false);
  }
});
