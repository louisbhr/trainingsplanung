// Ordnet Strava-Läufe den Lauftagen des Plans zu.
//
// Ein Lauf landet nicht immer am geplanten Tag — verschiebt man den
// Mittwochslauf auf Donnerstag, soll er trotzdem beim Mittwoch auftauchen.
// Reihenfolge: manuelle Zuordnung schlägt exakten Treffer, exakter Treffer
// schlägt automatische Verschiebung. Jeder Lauf wird höchstens einmal
// vergeben.
//
// Bewusst ohne Firebase-/Browser-Abhängigkeiten, damit es sich ohne
// Browser testen lässt.

const DAY_MS = 86400000;

function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Ganze Tage von a nach b; positiv heißt: b liegt später
export function daysBetween(aISO, bISO) {
  return Math.round((fromISO(bISO) - fromISO(aISO)) / DAY_MS);
}

// Wie weit darf ein Lauf vom Plantag abweichen, damit er automatisch
// zugeordnet wird: bis zu einem Tag früher, bis zu drei Tage später.
export const AUTO_WINDOW = { before: 1, after: 3 };

// Wie weit die Auswahl bei der manuellen Zuordnung reicht
export const PICKER_WINDOW = 7;

const idOf = (run) => String(run.id);

/**
 * @param planDays [{ date, distKm }] — Lauftage des Plans
 * @param runs     [{ id, date, distanceKm }] — Strava-Läufe
 * @param links    { [planDate]: { activityId } } — activityId null = bewusst leer
 * @returns { [planDate]: { run, offset, source } }
 *          source: "manual" | "exact" | "auto" | "ignored"
 */
export function assignRuns(planDays, runs = [], links = {}) {
  const days = [...planDays].sort((a, b) => (a.date < b.date ? -1 : 1));
  const planDates = new Set(days.map((d) => d.date));
  const result = {};
  const used = new Set();

  // 1) Was von Hand gesetzt wurde, gilt
  for (const p of days) {
    const link = links[p.date];
    if (!link) continue;
    if (link.activityId === null || link.activityId === undefined) {
      result[p.date] = { run: null, offset: 0, source: "ignored" };
      continue;
    }
    const run = runs.find((r) => idOf(r) === String(link.activityId));
    if (!run) continue; // Lauf inzwischen gelöscht — fällt auf Automatik zurück
    result[p.date] = { run, offset: daysBetween(p.date, run.date), source: "manual" };
    used.add(idOf(run));
  }

  // 2) Läufe am geplanten Tag. Bei mehreren gewinnt der längste.
  for (const p of days) {
    if (result[p.date]) continue;
    const sameDay = runs.filter((r) => r.date === p.date && !used.has(idOf(r)));
    if (!sameDay.length) continue;
    const best = sameDay.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
    result[p.date] = { run: best, offset: 0, source: "exact" };
    used.add(idOf(best));
  }

  // 3) Nachgeholt: alle offenen Plantage und freien Läufe gemeinsam
  // betrachten, nicht Plantag für Plantag — sonst schnappt sich der
  // frühere Tag einen Lauf, der eindeutig zum späteren gehört.
  const openDays = days.filter((p) => !result[p.date]);
  const pairs = [];
  for (const p of openDays) {
    for (const r of runs) {
      if (used.has(idOf(r))) continue;
      if (planDates.has(r.date)) continue; // liegt auf einem anderen Lauftag
      const off = daysBetween(p.date, r.date);
      if (off === 0 || off < -AUTO_WINDOW.before || off > AUTO_WINDOW.after) continue;
      pairs.push({ day: p, run: r, off, distGap: Math.abs(r.distanceKm - (p.distKm || 0)) });
    }
  }
  pairs.sort((a, b) => {
    const byDay = Math.abs(a.off) - Math.abs(b.off);
    if (byDay !== 0) return byDay;
    // Bei gleichem Abstand ist „nachgeholt" wahrscheinlicher als „vorgezogen"
    if (a.off > 0 !== b.off > 0) return a.off > 0 ? -1 : 1;
    if (a.distGap !== b.distGap) return a.distGap - b.distGap;
    return a.day.date < b.day.date ? -1 : 1;
  });
  for (const pair of pairs) {
    if (result[pair.day.date] || used.has(idOf(pair.run))) continue;
    result[pair.day.date] = { run: pair.run, offset: pair.off, source: "auto" };
    used.add(idOf(pair.run));
  }

  return result;
}

// Auswahl für „Lauf zuordnen". Fest vergeben sind nur Läufe, die an ihrem
// eigenen Plantag liegen oder von Hand zugeordnet wurden — eine automatische
// Zuordnung ist eine Vermutung und darf die Korrektur nicht blockieren.
export function pickableRuns(runs, assignment, planDate, windowDays = PICKER_WINDOW) {
  const used = new Set(
    Object.entries(assignment)
      .filter(([date, a]) => a.run && date !== planDate && (a.source === "manual" || a.source === "exact"))
      .map(([, a]) => idOf(a.run))
  );
  return runs
    .filter((r) => !used.has(idOf(r)) && Math.abs(daysBetween(planDate, r.date)) <= windowDays)
    .sort((a, b) => Math.abs(daysBetween(planDate, a.date)) - Math.abs(daysBetween(planDate, b.date)));
}

// "nachgeholt am Donnerstag" / "einen Tag früher gelaufen"
export function offsetLabel(offset) {
  if (!offset) return "";
  const n = Math.abs(offset);
  const tage = n === 1 ? "einen Tag" : `${n} Tage`;
  return offset > 0 ? `${tage} später nachgeholt` : `${tage} früher gelaufen`;
}
