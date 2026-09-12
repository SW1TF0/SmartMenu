// ============================================================================
// Shared authentication helpers — used by login.html, account.html, admin.html
// and the site header (nav auth state) via chrome.js.
// ============================================================================
import { auth, db, googleProvider, ADMIN_EMAILS } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function isAdmin(user) {
  return !!user && ADMIN_EMAILS.includes((user.email || "").toLowerCase());
}

async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || extra.name || "",
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
}

export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await ensureUserDoc(cred.user, { name });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export function logout() {
  return signOut(auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function friendlyAuthError(err, lang = "en") {
  const code = err && err.code ? err.code : "";
  const map = {
    en: {
      "auth/email-already-in-use": "That email is already registered — try signing in instead.",
      "auth/invalid-email": "That email address doesn't look right.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password. Try again.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    },
    bg: {
      "auth/email-already-in-use": "Този имейл вече е регистриран — опитайте да влезете.",
      "auth/invalid-email": "Имейл адресът изглежда невалиден.",
      "auth/weak-password": "Паролата трябва да е поне 6 символа.",
      "auth/user-not-found": "Няма акаунт с този имейл.",
      "auth/wrong-password": "Грешна парола. Опитайте отново.",
      "auth/invalid-credential": "Грешен имейл или парола.",
      "auth/too-many-requests": "Твърде много опити. Изчакайте малко и опитайте пак.",
      "auth/popup-closed-by-user": "Прозорецът на Google беше затворен.",
    },
  };
  const dict = map[lang] || map.en;
  return dict[code] || (lang === "bg" ? "Възникна грешка. Опитайте отново." : "Something went wrong. Please try again.");
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
