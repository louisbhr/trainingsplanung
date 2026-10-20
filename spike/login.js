// Login-Spike (S0, docs/plan-login-1b.md). Wegwerf-Testseite, wird nach dem
// Geräte-Test wieder gelöscht (B8, docs/review-architecture-login-1b.md).
// Reine Logik steckt in ./spike-logic.js (dort getestet), hier nur die
// Verdrahtung an echte Browser-/Firebase-APIs.
//
// Dieselbe Firebase-CDN-Version wie firebase-init.js (10.13.0), dieselbe
// öffentliche Konfiguration — siehe dort zur Begründung, warum das kein
// Geheimnis ist.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  query,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  formatUnixSeconds,
  formatMillis,
  analyzeNetworkResources,
  isStandaloneMode,
  describeReadResult,
} from "./spike-logic.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMNJBSXNrgTT7qDwhhkO1RPKjwp_EFMak",
  authDomain: "trainingsplanung-2c6c0.firebaseapp.com",
  projectId: "trainingsplanung-2c6c0",
  storageBucket: "trainingsplanung-2c6c0.firebasestorage.app",
  messagingSenderId: "1020715868967",
  appId: "1:1020715868967:web:d78023792a145130917f02",
};

// Eigene, benannte App-Instanz (B8): teilt sich NICHT die Auth-Sitzung oder
// den Firestore-Cache mit der Standard-Instanz [DEFAULT] der Live-App, auch
// wenn beide auf demselben Origin laufen (louisbhr.github.io).
const app = initializeApp(firebaseConfig, "spike");

// Kein popupRedirectResolver: initializeAuth lädt dann kein iframe von
// firebaseapp.com (G1). Die Netzwerkprüfung unten bestätigt das sichtbar.
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// Eigene Firestore-Instanz der Spike-App-Instanz, mit demselben
// Offline-Cache-Fallback wie firebase-init.js.
const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("Spike: Offline-Cache nicht verfügbar, nutze Standard-Firestore:", err);
    return getFirestore(app);
  }
})();

const $ = (id) => document.getElementById(id);

// --- "Zuletzt geöffnet" (eigener, von hm-tracker.* getrennter Schlüssel) ---
const LAST_OPENED_KEY = "spike-login.lastOpened";
function recordLastOpened() {
  const previous = Number(localStorage.getItem(LAST_OPENED_KEY));
  localStorage.setItem(LAST_OPENED_KEY, String(Date.now()));
  return Number.isFinite(previous) && previous > 0 ? previous : null;
}
$("accLastOpened").textContent = formatMillis(recordLastOpened());

// --- Netzwerkprüfung ---
function renderNetwork() {
  const entries = performance.getEntriesByType("resource");
  const { scripts, iframes, hasFirebaseAppIframe } = analyzeNetworkResources(entries);
  $("scriptList").innerHTML = scripts.length ? scripts.map((s) => `<li>${s}</li>`).join("") : "<li>(keine)</li>";
  $("iframeList").innerHTML = iframes.length ? iframes.map((s) => `<li>${s}</li>`).join("") : "<li>(keine)</li>";
  $("networkWarning").innerHTML = hasFirebaseAppIframe
    ? `<p class="banner warn">Achtung: ein iframe von firebaseapp.com wurde geladen.</p>`
    : `<p class="banner ok">Kein iframe von firebaseapp.com geladen.</p>`;
}
renderNetwork();
window.addEventListener("load", renderNetwork);
$("refreshNetworkBtn").addEventListener("click", renderNetwork);

// --- Standalone-Modus ---
function renderStandalone() {
  const navigatorStandalone = window.navigator.standalone === true;
  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  $("navStandalone").textContent = String(window.navigator.standalone ?? "undefined");
  $("displayStandalone").textContent = String(displayModeStandalone);
  const standalone = isStandaloneMode({ navigatorStandalone, displayModeStandalone });
  $("standaloneVerdict").innerHTML = standalone
    ? `<span class="pill yes">Home-Bildschirm-App</span>`
    : `<span class="pill no">Browser-Tab</span>`;
}
renderStandalone();

// --- Anmelde-/Konto-Zustand ---
function setSignedInUI(isSignedIn) {
  $("authLoading").hidden = true;
  $("loginCard").hidden = isSignedIn;
  $("accountCard").hidden = !isSignedIn;
  $("readTestBtn").disabled = !isSignedIn;
  $("readTestBtn").textContent = isSignedIn ? "Jetzt testen" : "Jetzt testen (erst anmelden)";
}

async function renderAccountCard(user) {
  $("signedInPill").innerHTML = `<span class="pill yes">Ja</span>`;
  $("accEmail").textContent = user.email || "(keine E-Mail)";
  $("accUid").textContent = user.uid;
  try {
    const tokenResult = await user.getIdTokenResult();
    const authTime = tokenResult.claims?.auth_time;
    $("accAuthTime").textContent = formatUnixSeconds(authTime != null ? Number(authTime) : undefined);
  } catch (err) {
    $("accAuthTime").textContent = "Fehler: " + (err?.code || err?.message || String(err));
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    setSignedInUI(true);
    renderAccountCard(user);
  } else {
    setSignedInUI(false);
    $("signedInPill").innerHTML = `<span class="pill no">Nein</span>`;
  }
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").textContent = "";
  const email = $("email").value.trim();
  const password = $("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    $("loginError").textContent = "Anmeldung fehlgeschlagen: " + (err?.code || err?.message || String(err));
  }
});

$("logoutBtn").addEventListener("click", () => signOut(auth));

$("copyUid").addEventListener("click", async () => {
  const uid = $("accUid").textContent;
  const btn = $("copyUid");
  try {
    await navigator.clipboard.writeText(uid);
    btn.textContent = "Kopiert";
  } catch (err) {
    btn.textContent = "Fehler";
  }
  setTimeout(() => (btn.textContent = "Kopieren"), 1500);
});

$("readTestBtn").addEventListener("click", async () => {
  $("readResult").textContent = "Lädt …";
  try {
    const snap = await getDocs(query(collection(db, "logs"), limit(1)));
    $("readResult").textContent = describeReadResult({
      count: snap.size,
      fromCache: snap.metadata?.fromCache === true,
    });
  } catch (err) {
    $("readResult").textContent = "Fehler: " + (err?.code || err?.message || String(err));
  }
});
