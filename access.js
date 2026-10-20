// Reine Zugriffslogik ohne DOM und ohne Firebase (in Node testbar).
// Die Prüfung im Client ist nur Bedienkomfort: den eigentlichen Schutz
// bilden die Firestore-Regeln und der Worker (siehe firestore.rules,
// worker.js).

// Zustand der Sitzung gegenüber der erlaubten UID.
//   signedOut: niemand angemeldet
//   anonymous: Altsitzung aus der Zeit vor dem Login
//   forbidden: angemeldet, aber nicht Louis (oder keine UID konfiguriert)
//   ok:        Louis
export function accessState(user, allowedUid) {
  if (!user) return "signedOut";
  if (user.isAnonymous) return "anonymous";
  const allowed = typeof allowedUid === "string" ? allowedUid.trim() : "";
  // Fail closed: eine leere erlaubte UID darf nie jemanden durchlassen.
  if (!allowed || user.uid !== allowed) return "forbidden";
  return "ok";
}

const CREDENTIAL_TEXT = "E-Mail oder Passwort stimmt nicht.";

// Deutsche Meldung zu einem Firebase-Auth-Fehlercode. Falsches Passwort und
// unbekanntes Konto bekommen bewusst denselben Text, damit die Anmeldung
// nicht verrät, welche E-Mail-Adressen existieren.
export function authErrorText(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return CREDENTIAL_TEXT;
    case "auth/invalid-email":
      return "Bitte eine gültige E-Mail-Adresse eingeben.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte kurz warten und noch einmal probieren.";
    case "auth/network-request-failed":
      return "Keine Verbindung. Das Anmelden geht nur mit Netz.";
    case "auth/user-disabled":
      return "Dieses Konto ist gesperrt.";
    default:
      return "Anmeldung fehlgeschlagen. Bitte noch einmal versuchen.";
  }
}

// true, wenn das Promise innerhalb von ms fertig wird; false bei Timeout
// oder Ablehnung. Der Timer wird immer aufgeräumt.
export async function raceTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(false), ms); });
  try {
    return await Promise.race([promise.then(() => true, () => false), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function isWorkerAuthRejection(res) {
  if (res.status !== 401) return false;
  const data = await res.clone().json().catch(() => null);
  return data?.error === "unauthorized";
}

// fetch mit Firebase-ID-Token. Nur ein 401 mit error "unauthorized" (also
// vom Worker, nicht von Strava) führt zu genau einem Retry mit frisch
// erzwungenem Token; 503 auth_unavailable und alles andere geht sofort
// zurück an den Aufrufer. Schlägt authHeaders() fehl, gibt es keinen Aufruf.
export async function fetchWithAuthRetry(url, init = {}, { authHeaders, fetchImpl = (...a) => fetch(...a) }) {
  const send = async (force) => {
    const auth = await authHeaders({ force });
    return fetchImpl(url, { ...init, headers: { ...(init.headers || {}), ...auth } });
  };
  const res = await send(false);
  if (await isWorkerAuthRejection(res)) return send(true);
  return res;
}
