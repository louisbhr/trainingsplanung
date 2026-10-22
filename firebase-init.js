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
  deleteDoc,
  waitForPendingWrites as fsWaitForPendingWrites,
  terminate,
  clearIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { ALLOWED_UID } from "./config.js?v=202610221430";
import { accessState, raceTimeout } from "./access.js?v=202610221430";

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

// Sitzung dauerhaft speichern (IndexedDB, Ersatz localStorage). Bewusst ohne
// popupRedirectResolver: sonst lädt Firebase beim Start einen iframe von
// firebaseapp.com, den Safari blockiert (Spike S0, 20.10.2026: so läuft es
// auf iPhone-Tab, Home-Bildschirm-App und MacBook).
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// Wichtig: direkt nach dem Laden ist auth.currentUser noch null, auch wenn
// bereits eine Sitzung im Browser gespeichert ist. Erst warten, bis der
// Auth-Status wiederhergestellt ist, sonst wirkt jeder Start wie abgemeldet.
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

// --- Anmeldung ---
// Gespeicherte Sitzung (nach dem Wiederherstellen), oder null. Auch offline
// liefert das den zuletzt angemeldeten Nutzer.
export async function authReady() {
  await authStateReady();
  return auth.currentUser;
}

export async function signIn(email, password) {
  const cred = await fb(() => signInWithEmailAndPassword(auth, email, password));
  return cred.user;
}

// Das gemerkte Ergebnis von ensureSignedIn() gilt nur für den aktuellen
// Nutzer; bei jedem Wechsel oder Abmelden muss es neu berechnet werden.
let signInPromise = null;
onAuthStateChanged(auth, () => { signInPromise = null; });

// Legt nichts mehr an: ohne passenden Nutzer (Louis) wirft es. Die Firestore-
// Zugriffe unten rufen es vorab auf, damit ein Fremdkonto nie bis zu den
// Regeln kommt.
export function ensureSignedIn() {
  if (!signInPromise) {
    signInPromise = (async () => {
      await authStateReady();
      const user = auth.currentUser;
      if (accessState(user, ALLOWED_UID) !== "ok") {
        throw new FirebaseAccessError({ code: "auth/not-signed-in", message: "Nicht angemeldet." });
      }
      return user;
    })().catch((err) => {
      signInPromise = null; // beim nächsten Versuch neu probieren
      throw err;
    });
  }
  return signInPromise;
}

// Header für den Worker. force erzwingt ein frisches Token (einmaliger Retry
// nach einem 401 des Workers, siehe access.js).
export async function authHeaders({ force = false } = {}) {
  const user = await ensureSignedIn();
  const token = await fb(() => user.getIdToken(force));
  return { Authorization: `Bearer ${token}` };
}

// Wartet, bis alle lokal gespeicherten Schreibvorgänge beim Server sind.
export function waitForPendingWrites() {
  return fsWaitForPendingWrites(db);
}

// Einfaches Abmelden (Fremdkonto, anonyme Altsitzung). Der Offline-Cache
// bleibt, damit nichts Ungesendetes verloren geht.
export async function signOutUser() {
  signInPromise = null;
  await fb(() => signOut(auth));
}

// "Abmelden" im Plan-Tab räumt das Gerät: erst alle Schreibvorgänge senden
// lassen (sonst gingen sie verloren), dann abmelden, den Offline-Cache und
// die eigenen lokalen Kopien löschen. Bei offenen Schreibvorgängen wird
// nichts gelöscht. Rückgabe: { ok: false, reason: "pending" } oder
// { ok: true, cacheCleared } (false, wenn der Offline-Cache bleibt, z. B. weil
// ein zweiter Tab der App ihn noch hält).
export async function signOutAndWipeDevice({ flushMs = 10000 } = {}) {
  const flushed = await raceTimeout(fsWaitForPendingWrites(db), flushMs);
  if (!flushed) return { ok: false, reason: "pending" };
  await signOutUser();
  let cacheCleared = true;
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    // Ohne persistenten Cache (z. B. privates Fenster) gibt es nichts zu
    // löschen. Mit zweitem Tab scheitert das Löschen (failed-precondition);
    // dann darf die App nicht behaupten, das Gerät sei geräumt.
    console.warn("Offline-Cache konnte nicht geleert werden:", err);
    cacheCleared = err?.code !== "failed-precondition";
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("hm-tracker."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage kann in privaten Fenstern werfen */
  }
  return { ok: true, cacheCleared };
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

// Kompletter Kraft-Verlauf in einer Abfrage. Über 31 Wochen sind das
// einige hundert Zeilen — einmal laden und im Speicher halten ist
// günstiger als eine Abfrage je Übung.
export async function loadAllLogs() {
  await ensureSignedIn();
  const snap = await fb(() => getDocs(collection(db, "logs")));
  const out = [];
  snap.forEach((d) => out.push(d.data()));
  return out;
}

// Alle Tages-Anpassungen (dayplans) auf einmal — für die Ampel "Wochensoll"
// und die Adhärenz (M2-3): beide brauchen die *effektive* Übungsliste
// mehrerer Tage, nicht nur des gerade offenen Tages. Rückgabe: { [datum]:
// { removed, added } }, wie loadDayPlan() pro Tag, nur für alle Tage auf
// einmal.
export async function loadAllDayPlans() {
  await ensureSignedIn();
  const snap = await fb(() => getDocs(collection(db, "dayplans")));
  const out = {};
  snap.forEach((d) => {
    const data = d.data();
    out[d.id] = { removed: data.removed || [], added: data.added || [] };
  });
  return out;
}

// --- Zuordnung von Strava-Läufen zu Plan-Lauftagen ---
// Doc-Id ist das Plan-Datum. activityId null heißt: an dem Tag bewusst
// kein Lauf, die automatische Zuordnung soll nichts hineinraten.
export async function loadRunLinks() {
  await ensureSignedIn();
  const snap = await fb(() => getDocs(collection(db, "runlinks")));
  const out = {};
  snap.forEach((d) => (out[d.id] = { activityId: d.data().activityId ?? null }));
  return out;
}

export async function saveRunLink(planDateISO, activityId) {
  await ensureSignedIn();
  await fb(() =>
    setDoc(doc(db, "runlinks", planDateISO), { activityId: activityId ?? null, updatedAt: Date.now() })
  );
}

// Zurück auf Automatik
export async function clearRunLink(planDateISO) {
  await ensureSignedIn();
  await fb(() => deleteDoc(doc(db, "runlinks", planDateISO)));
}

// --- Coach (F6, M2-9/M2-10): coach/{datum}, coachweek/{planId}_W{n} ---
// Feld-/Limit-Logik (generations, inputHash, ...) lebt in coach.js —
// hier nur reines Lesen/Schreiben, wie bei den übrigen Sammlungen.
export async function loadCoach(dateISO) {
  await ensureSignedIn();
  const snap = await fb(() => getDoc(doc(db, "coach", dateISO)));
  return snap.exists() ? snap.data() : null;
}

export async function saveCoach(dateISO, data) {
  await ensureSignedIn();
  await fb(() => setDoc(doc(db, "coach", dateISO), data, { merge: true }));
}

export async function loadCoachWeek(key) {
  await ensureSignedIn();
  const snap = await fb(() => getDoc(doc(db, "coachweek", key)));
  return snap.exists() ? snap.data() : null;
}

export async function saveCoachWeek(key, data) {
  await ensureSignedIn();
  await fb(() => setDoc(doc(db, "coachweek", key), data, { merge: true }));
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
