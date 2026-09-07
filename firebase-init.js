// Firebase-Konfiguration. Diese Werte sind bewusst öffentlich im Code —
// das ist bei Firebase Web-Apps normal, Sicherheit läuft über die
// Firestore-Regeln (siehe firestore.rules), nicht über Geheimhaltung.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMNJBSXNrgTT7qDwhhkO1RPKjwp_EFMak",
  authDomain: "trainingsplanung-2c6c0.firebaseapp.com",
  projectId: "trainingsplanung-2c6c0",
  storageBucket: "trainingsplanung-2c6c0.firebasestorage.app",
  messagingSenderId: "1020715868967",
  appId: "1:1020715868967:web:d78023792a145130917f02",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const auth = getAuth(app);

export async function ensureSignedIn() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}

// --- Kraft-Log: eine Zeile pro Datum+Übung ---
export async function saveLog(dateISO, exerciseSlug, data) {
  await ensureSignedIn();
  const ref = doc(db, "logs", `${dateISO}_${exerciseSlug}`);
  await setDoc(ref, { date: dateISO, exercise: exerciseSlug, ...data, updatedAt: Date.now() }, { merge: true });
}

export async function loadLog(dateISO, exerciseSlug) {
  await ensureSignedIn();
  const ref = doc(db, "logs", `${dateISO}_${exerciseSlug}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// --- Strava-Tokens ---
export async function saveStravaTokens(tokens) {
  await ensureSignedIn();
  await setDoc(doc(db, "config", "strava"), tokens, { merge: true });
}

export async function loadStravaTokens() {
  await ensureSignedIn();
  const snap = await getDoc(doc(db, "config", "strava"));
  return snap.exists() ? snap.data() : null;
}
