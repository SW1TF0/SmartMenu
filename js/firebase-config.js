// ============================================================================
// Firebase configuration — project: smartmenukj
// console.firebase.google.com/project/smartmenukj
// Firebase v10 modular SDK loaded from the gstatic CDN — no build step needed.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdfNQ-Y72qkqPSgBqZYFm-d1PmM0Wpd_M",
  authDomain: "smartmenukj.firebaseapp.com",
  projectId: "smartmenukj",
  storageBucket: "smartmenukj.firebasestorage.app",
  messagingSenderId: "465512343655",
  appId: "1:465512343655:web:7c187c5c0b0e0cdbda4cc2",
  measurementId: "G-1F714HKKB4",
};

// ----------------------------------------------------------------------------
// Admin identification — anyone signed in with one of these emails gets
// access to admin.html. Keep this list in sync with firebase/firestore.rules.
// ----------------------------------------------------------------------------
export const ADMIN_EMAILS = ["krasimiruzun@smartmenukj.com"];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
