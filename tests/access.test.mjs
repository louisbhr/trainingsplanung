// Reine Logik aus access.js, ohne Browser und ohne Firebase.
import assert from "node:assert/strict";
import { test } from "node:test";
import { accessState, authErrorText, raceTimeout, fetchWithAuthRetry } from "../access.js";

const UID = "abcDEF1234567890abcdEF";

test("accessState: kein Nutzer -> signedOut", () => {
  assert.equal(accessState(null, UID), "signedOut");
  assert.equal(accessState(undefined, UID), "signedOut");
});

test("accessState: anonymer Nutzer -> anonymous (auch mit passender UID)", () => {
  assert.equal(accessState({ uid: "x", isAnonymous: true }, UID), "anonymous");
  assert.equal(accessState({ uid: UID, isAnonymous: true }, UID), "anonymous");
});

test("accessState: fremde UID -> forbidden", () => {
  assert.equal(accessState({ uid: "other", isAnonymous: false }, UID), "forbidden");
});

test("accessState: passende UID -> ok", () => {
  assert.equal(accessState({ uid: UID, isAnonymous: false }, UID), "ok");
});

test("accessState: leere oder fehlende erlaubte UID schlaegt fehl geschlossen fehl", () => {
  for (const allowed of ["", "   ", null, undefined]) {
    assert.equal(accessState({ uid: "", isAnonymous: false }, allowed), "forbidden");
    assert.equal(accessState({ uid: UID, isAnonymous: false }, allowed), "forbidden");
  }
});

test("authErrorText: gleiche Meldung fuer falsches Passwort und unbekanntes Konto (kein Orakel)", () => {
  const a = authErrorText("auth/invalid-credential");
  assert.equal(authErrorText("auth/wrong-password"), a);
  assert.equal(authErrorText("auth/user-not-found"), a);
  assert.match(a, /E-Mail oder Passwort/);
});

test("authErrorText: Sonderfaelle und Fallback, ohne Gedankenstrich", () => {
  assert.match(authErrorText("auth/too-many-requests"), /Zu viele Versuche/);
  assert.match(authErrorText("auth/network-request-failed"), /Netz/);
  assert.match(authErrorText("auth/invalid-email"), /E-Mail-Adresse/);
  assert.match(authErrorText(undefined), /fehlgeschlagen/);
  assert.match(authErrorText("auth/irgendwas"), /fehlgeschlagen/);
  for (const c of ["auth/invalid-credential", "auth/too-many-requests", "auth/network-request-failed", "x"]) {
    assert.ok(!/[–—]/.test(authErrorText(c)));
  }
});

test("raceTimeout: true wenn das Promise zuerst fertig ist, false beim Timeout, false bei Ablehnung", async () => {
  assert.equal(await raceTimeout(Promise.resolve("x"), 50), true);
  assert.equal(await raceTimeout(new Promise(() => {}), 20), false);
  assert.equal(await raceTimeout(Promise.reject(new Error("boom")), 50), false);
});

// ---- fetchWithAuthRetry (B3) ----
const resp = (status, body) => new Response(JSON.stringify(body), { status });

function harness(responses) {
  const calls = { fetch: [], headers: [] };
  const queue = [...responses];
  return {
    calls,
    opts: {
      authHeaders: async ({ force } = {}) => { calls.headers.push(!!force); return { Authorization: `Bearer t${calls.headers.length}` }; },
      fetchImpl: async (url, init) => { calls.fetch.push({ url, init }); return queue.shift(); },
    },
  };
}

test("fetchWithAuthRetry: sendet Authorization und behaelt vorhandene Header", async () => {
  const h = harness([resp(200, { ok: 1 })]);
  const res = await fetchWithAuthRetry("https://w.test/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, h.opts);
  assert.equal(res.status, 200);
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.calls.fetch[0].init.headers.Authorization, "Bearer t1");
  assert.equal(h.calls.fetch[0].init.headers["Content-Type"], "application/json");
});

test("fetchWithAuthRetry: 401 mit error unauthorized -> genau ein Retry mit frischem Token", async () => {
  const h = harness([resp(401, { error: "unauthorized" }), resp(200, { ok: 1 })]);
  const res = await fetchWithAuthRetry("u", { method: "POST" }, h.opts);
  assert.equal(res.status, 200);
  assert.deepEqual(h.calls.headers, [false, true]);
  assert.equal(h.calls.fetch.length, 2);
});

test("fetchWithAuthRetry: bleibt es bei 401 unauthorized, kein dritter Aufruf", async () => {
  const h = harness([resp(401, { error: "unauthorized" }), resp(401, { error: "unauthorized" })]);
  const res = await fetchWithAuthRetry("u", { method: "POST" }, h.opts);
  assert.equal(res.status, 401);
  assert.equal(h.calls.fetch.length, 2);
});

test("fetchWithAuthRetry: 401 ohne error-Feld (z. B. von Strava) -> kein Retry", async () => {
  const h = harness([resp(401, { message: "Authorization Error" })]);
  const res = await fetchWithAuthRetry("u", { method: "POST" }, h.opts);
  assert.equal(res.status, 401);
  assert.equal(h.calls.fetch.length, 1);
});

test("fetchWithAuthRetry: 401 mit Nicht-JSON-Body -> kein Retry", async () => {
  const h = harness([new Response("nope", { status: 401 })]);
  await fetchWithAuthRetry("u", { method: "POST" }, h.opts);
  assert.equal(h.calls.fetch.length, 1);
});

test("fetchWithAuthRetry: 503 auth_unavailable -> sofort zurueck, kein Retry", async () => {
  const h = harness([resp(503, { error: "auth_unavailable" })]);
  const res = await fetchWithAuthRetry("u", { method: "POST" }, h.opts);
  assert.equal(res.status, 503);
  assert.equal(h.calls.fetch.length, 1);
});

test("fetchWithAuthRetry: schlaegt authHeaders fehl, gibt es keinen Aufruf", async () => {
  const calls = [];
  await assert.rejects(
    fetchWithAuthRetry("u", {}, {
      authHeaders: async () => { throw new Error("nicht angemeldet"); },
      fetchImpl: async () => { calls.push(1); return resp(200, {}); },
    }),
    /nicht angemeldet/
  );
  assert.equal(calls.length, 0);
});
