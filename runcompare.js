// Reine Vergleichslogik für den Lauf-Tag (Stride, Etappe E2): Zielwerte lesen,
// Range-Balken berechnen, "im Plan"/"zu kurz" und die Farbe von Pace und HF.
// Kein DOM, keine Abhängigkeiten. Die Geometrie-Regeln stehen in
// docs/ui-markup-stride.md ("Range-Balken"), --from/--to/--at sind
// einheitenlose Prozentwerte mit höchstens einer Nachkommastelle.

const NUM = "\\d+(?:[.,]\\d+)?";
const PACE = "\\d{1,2}:\\d{2}";
const OP = "(?:[<>]=?|[≤≥])";
const FREE = { type: "free", min: null, max: null };

// Läufe, deren Durchschnittspace nichts über das Ziel sagt (Ein-/Auslaufen,
// Intervalle). Pace bleibt dort neutral (F9).
const NEUTRAL_PACE = /^(schwelle|test)$|intervall|schwelle|kalibrierung/i;

const toNumber = (s) => Number(s.replace(",", "."));
const paceToSec = (s) => {
  const [m, sec] = s.split(":");
  return Number(m) * 60 + Number(sec);
};
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Zielwert-Text lesen.
 * kind "pace": "5:45–6:15 /km", "> 6:40 /km"; kind "hr": "148–163 bpm", "< 148", "> 184".
 * Alles andere (Freitext, zusammengesetzt wie "…, Schluss 5:00–5:10 /km",
 * "frei, Ø notieren") ist "free" und bekommt keinen Balken.
 * openMin = nur Untergrenze ("> g", max null), openMax = nur Obergrenze ("< g", min null).
 * Werte: Pace in Sekunden pro km, HF in bpm.
 * @returns {{type:"closed"|"openMin"|"openMax"|"free", min:number|null, max:number|null}}
 */
export function parseTarget(text, kind) {
  if (typeof text !== "string" || (kind !== "pace" && kind !== "hr")) return { ...FREE };
  const value = kind === "pace" ? PACE : NUM;
  const unit = kind === "pace" ? "(?:\\/\\s*km)?" : "(?:bpm)?";
  const conv = kind === "pace" ? paceToSec : toNumber;

  const open = text.match(new RegExp(`^\\s*(${OP})\\s*(${value})\\s*${unit}\\s*$`, "i"));
  if (open) {
    const g = conv(open[2]);
    return /^[>≥]/.test(open[1]) ? { type: "openMin", min: g, max: null } : { type: "openMax", min: null, max: g };
  }
  const closed = text.match(new RegExp(`^\\s*(${value})\\s*[–-]\\s*(${value})\\s*${unit}\\s*$`, "i"));
  if (closed) {
    const [a, b] = [conv(closed[1]), conv(closed[2])];
    return a <= b ? { type: "closed", min: a, max: b } : { ...FREE };
  }
  return { ...FREE };
}

// Abstände der Skala zum Ziel: [unter min, über max] je Art und Zieltyp.
const MARGINS = {
  pace: { closed: [30, 30], openMin: [30, 60], openMax: [60, 30] },
  hr: { closed: [18, 18], openMin: [18, 36], openMax: [36, 18] },
};
const FALLBACK_SCALE = { pace: { min: 345, max: 435 }, hr: { min: 130, max: 175 } }; // 5:45-7:15, 130-175

/** Skala {min,max} um das Ziel; free (und unbekannte Art) bekommt die Fallback-Skala. */
export function rangeScale(target, kind) {
  const margins = MARGINS[kind]?.[target?.type];
  if (!margins) return { ...(FALLBACK_SCALE[kind] ?? FALLBACK_SCALE.pace) };
  const anchorLow = target.min ?? target.max;
  const anchorHigh = target.max ?? target.min;
  return { min: anchorLow - margins[0], max: anchorHigh + margins[1] };
}

const pct = (value, scale) => {
  const raw = ((value - scale.min) / (scale.max - scale.min)) * 100;
  return round1(Math.min(100, Math.max(0, raw)));
};

/**
 * Balkengeometrie in Prozent (0 bis 100, eine Nachkommastelle, geklemmt).
 * from/to: Zielband (offene Seite reicht bis zum Rand), at: Istwert oder null.
 * free hat kein Band: from und to sind null.
 */
export function rangeBar(scale, target, value) {
  const at = typeof value === "number" && Number.isFinite(value) ? pct(value, scale) : null;
  switch (target?.type) {
    case "closed": return { from: pct(target.min, scale), to: pct(target.max, scale), at };
    case "openMin": return { from: pct(target.min, scale), to: 100, at };
    case "openMax": return { from: 0, to: pct(target.max, scale), at };
    default: return { from: null, to: null, at };
  }
}

/**
 * "imPlan" | "zuKurz" | null. Bewertet auf der angezeigten Genauigkeit
 * (km mit einer Nachkommastelle, Auflage C4), damit "7,2 km" von 8 km nie
 * "zu kurz" heißt: genau 90 % ist im Plan. Länger als das Soll ist ebenfalls im Plan.
 */
export function distanceStatus(actualKm, sollKm, THRESHOLDS) {
  if (!(typeof actualKm === "number" && Number.isFinite(actualKm) && actualKm >= 0)) return null;
  if (!(typeof sollKm === "number" && sollKm > 0)) return null;
  const shownTenths = Math.round(actualKm * 10);
  const neededTenths = sollKm * THRESHOLDS.lauf.zuKurz * 10;
  // 1e-9 fängt Gleitkomma-Reste wie 7 * 0.9 * 10 = 63.00000000000001 ab
  return shownTenths + 1e-9 >= neededTenths ? "imPlan" : "zuKurz";
}

/**
 * Farbe der Pace: "ok" im Band (auf ganze Sekunden gerundet, wie angezeigt),
 * sonst "warn"; "neutral" bei freiem Ziel und bei Schwelle/Intervallen/Test;
 * null ohne Messwert.
 * @param runType shortType oder Typtext der Einheit, z. B. "Schwelle"
 */
export function paceStatus(target, paceSecPerKm, runType = "") {
  if (!(typeof paceSecPerKm === "number" && Number.isFinite(paceSecPerKm))) return null;
  if (!target || target.type === "free" || NEUTRAL_PACE.test(String(runType))) return "neutral";
  const sec = Math.round(paceSecPerKm);
  const aboveMin = target.min == null || sec >= target.min;
  const belowMax = target.max == null || sec <= target.max;
  return aboveMin && belowMax ? "ok" : "warn";
}

/**
 * Farbe der HF: "ok" genau dann, wenn avgHr <= hfMax (dieselbe Regel wie
 * Woche und Easy-Ampel, ungerundet), sonst "warn"; null ohne Wert oder ohne Obergrenze.
 */
export function hrStatus(avgHr, hfMax) {
  if (!(typeof avgHr === "number" && Number.isFinite(avgHr))) return null;
  if (!(typeof hfMax === "number" && Number.isFinite(hfMax))) return null;
  return avgHr <= hfMax ? "ok" : "warn";
}
