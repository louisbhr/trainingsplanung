// Firebase-Konfiguration. Diese Werte sind bewusst öffentlich im Code —
// das ist bei Firebase Web-Apps normal, Sicherheit läuft über die
// Firestore-Regeln (siehe firestore.rules), nicht über Geheimhaltung.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
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

// Offline-Cache: im Gym ist das Netz oft schlecht. Mit persistentem Cache
// landen Eingaben lokal in IndexedDB und werden synchronisiert, sobald
// wieder Netz da ist. Falls der Browser das nicht kann (z. B. privates
// Fenster in Safari), fallen wir auf den normalen In-Memory-Client zurück.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("Offline-Cache nicht verfügbar, nutze Standard-Firestore:", err);
    return getFirestore(app);
  }
})();

const auth = getAuth(app);

// Wichtig: direkt nach dem Laden ist auth.currentUser noch null, auch wenn
// bereits ein anonymer Account im Browser gespeichert ist. Erst warten, bis
// der Auth-Status wiederhergestellt ist — sonst legt jeder Reload einen
// neuen anonymen Nutzer an.
function authStateReady() {
  if (typeof auth.authStateReady === "function") return auth.authStateReady();
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}

// Firestore-/Auth-Fehler als solche kennzeichnen. Ohne die Markierung
// landet z. B. "fehlende Firestore-Regeln" unter der Überschrift
// "Strava-Problem" — das hat beim Einrichten echte Zeit gekostet.
export class FirebaseAccessError extends Error {
  constructor(err) {
    super("Firebase: " + (err?.message || String(err)));
    this.name = "FirebaseAccessError";
    this.source = "firebase";
    this.code = err?.code;
  }
}

async function fb(fn) {
  try {
    return await fn();
  } catch (err) {
    throw err instanceof FirebaseAccessError ? err : new FirebaseAccessError(err);
  }
}

let signInPromise = null;
export function ensureSignedIn() {
  if (!signInPromise) {
    signInPromise = (async () => {
      await authStateReady();
      if (!auth.currentUser) await fb(() => signInAnonymously(auth));
      return auth.currentUser;
    })().catch((err) => {
      signInPromise = null; // beim nächsten Versuch neu probieren
      throw err;
    });
  }
  return signInPromise;
}

// --- Kraft-Log: eine Zeile pro Datum+Übung ---
export async function saveLog(dateISO, exerciseSlug, data) {
  await ensureSignedIn();
  const ref = doc(db, "logs", `${dateISO}_${exerciseSlug}`);
  await fb(() =>
    setDoc(ref, { date: dateISO, exercise: exerciseSlug, ...data, updatedAt: Date.now() }, { merge: true })
  );
}

export async function loadLog(dateISO, exerciseSlug) {
  await ensureSignedIn();
  const ref = doc(db, "logs", `${dateISO}_${exerciseSlug}`);
  const snap = await fb(() => getDoc(ref));
  return snap.exists() ? snap.data() : null;
}

// Alle Übungen eines Tages in einer einzigen Abfrage — statt pro Übung
// einzeln zu laden. Ergebnis: { slug: daten }
export async function loadLogsForDate(dateISO) {
  await ensureSignedIn();
  const snap = await fb(() => getDocs(query(collection(db, "logs"), where("date", "==", dateISO))));
  const out = {};
  snap.forEach((d) => {
    const data = d.data();
    if (data.exercise) out[data.exercise] = data;
  });
  return out;
}

// Kompletter Verlauf einer Übung, aufsteigend nach Datum. Sortiert wird
// bewusst im Client, damit Firestore keinen zusammengesetzten Index braucht.
export async function loadLogsForExercise(exerciseSlug) {
  await ensureSignedIn();
  const snap = await fb(() => getDocs(query(collection(db, "logs"), where("exercise", "==", exerciseSlug))));
  const out = [];
  snap.forEach((d) => out.push(d.data()));
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

// --- Angepasste Übungen je Trainingstag ---
// { removed: [slug, ...], added: [{ name, soll, hint }, ...] }
export async function loadDayPlan(dateISO) {
  await ensureSignedIn();
  const snap = await fb(() => getDoc(doc(db, "dayplans", dateISO)));
  const d = snap.exists() ? snap.data() : null;
  return { removed: d?.removed || [], added: d?.added || [] };
}

export async function saveDayPlan(dateISO, dayPlan) {
  await ensureSignedIn();
  await fb(() =>
    setDoc(
      doc(db, "dayplans", dateISO),
      { removed: dayPlan.removed || [], added: dayPlan.added || [], updatedAt: Date.now() },
      { merge: true }
    )
  );
}

// --- Strava-Tokens ---
export async function saveStravaTokens(tokens) {
  await ensureSignedIn();
  await fb(() => setDoc(doc(db, "config", "strava"), tokens, { merge: true }));
}

export async function loadStravaTokens() {
  await ensureSignedIn();
  const snap = await fb(() => getDoc(doc(db, "config", "strava")));
  return snap.exists() ? snap.data() : null;
}
