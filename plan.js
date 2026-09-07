// Trainingsplan-Daten. Phase 1 (Woche 1-8) ist im Detail ausformuliert,
// Phase 2-4 als Struktur mit Datumsbereich — Details folgen nach der
// Re-Kalibrierung am Ende von Phase 1.

export const PLAN_START = "2026-08-31"; // Montag, Woche 1
export const TOTAL_WEEKS = 31;
export const DETAILED_UNTIL_WEEK = 8;

export const goal = {
  time: "1:29:59 h",
  race: "Halbmarathon, Anfang/Mitte April 2027",
  targetPace: "4:16 /km",
};

export const zones = [
  { zone: "Z1 – Recovery", hf: "< 148", pace: "> 6:40 /km", use: "Regeneration" },
  { zone: "Z2 – Easy", hf: "148–163", pace: "6:10–6:35 /km", use: "Grundlage" },
  { zone: "Z3 – Tempo", hf: "165–170", pace: "5:00–5:20 /km", use: "Marathon-Pace" },
  { zone: "Z4 – Schwelle", hf: "172–181", pace: "4:35–4:50 /km", use: "Schwellenläufe" },
  { zone: "Z5 – VO2max", hf: "> 184", pace: "4:05–4:20 /km", use: "Intervalle" },
];

export const phases = [
  { n: 1, name: "Basis", range: "31.08.–25.10.2026", weeks: [1, 8], focus: "Volumenaufbau, Maximalkraft" },
  { n: 2, name: "Aufbau", range: "26.10.2026–03.01.2027", weeks: [9, 18], focus: "Schwelle, Plyometrie" },
  { n: 3, name: "Spezifisch", range: "04.01.–07.03.2027", weeks: [19, 27], focus: "Renntempo, Kraft-Erhalt" },
  { n: 4, name: "Taper", range: "08.03.–05.04.2027", weeks: [28, 31], focus: "Volumen runter, Frische" },
];

// --- Datums-Helfer (rein lokal, ohne toISOString/UTC-Verschiebung) ---
const pad = (n) => String(n).padStart(2, "0");
export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
// Montag der Woche w (1-basiert)
export function weekStart(w) {
  return addDays(PLAN_START, (w - 1) * 7);
}
// Alle sieben Daten einer Woche, Montag zuerst
export function weekDates(w) {
  const start = weekStart(w);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function weekNumberFor(iso) {
  const diffMs = fromISO(iso) - fromISO(PLAN_START);
  // Runden statt Abschneiden: Sommer-/Winterzeit verschiebt die Differenz
  // sonst um eine Stunde und kippt den Tag.
  const diffDays = Math.round(diffMs / 86400000);
  const w = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(w, 1), TOTAL_WEEKS);
}

// Wochentags-Offsets ab Montag
const MO = 0, DI = 1, MI = 2, DO = 3, SA = 5, SO = 6;

function easy(date, dist, steig) {
  return {
    date,
    type: "Easy run" + (steig ? " + " + steig : ""),
    shortType: "Easy",
    dist,
    pace: "6:10–6:35 /km",
    hf: "148–163 bpm",
  };
}
function easyDeload(date, dist) {
  return { date, type: "Easy run", shortType: "Easy", dist, pace: "6:15–6:40 /km", hf: "148–160 bpm" };
}
function longRun(date, dist) {
  return { date, type: "Long run", shortType: "Long", dist, pace: "6:15–6:40 /km", hf: "148–160 bpm" };
}
function recovery(date, dist, note) {
  return { date, type: "Recovery run", shortType: "Recovery", dist, pace: "> 6:40 /km", hf: "< 148 bpm", note };
}

// ---- Kraft: alter Split (nur Woche 1) ----
const kraftA_alt = [
  { name: "Back squat", soll: "3x8-10", hint: "Aufwärmsätze, dann Arbeitsgewicht bei RPE 6-7 in Satz 3" },
  { name: "Rumänisches Kreuzheben", soll: "3x8-10", hint: "Start bei ca. 60-70% des Squat-Gewichts" },
  { name: "Bulgarian split squat", soll: "3x8/Seite", hint: "Start mit 2 Kurzhanteln à 8-12 kg" },
  { name: "Nordic hamstring curl", soll: "3x4", hint: "Kein Zusatzgewicht, langsames Ablassen" },
  { name: "Soleus raise", soll: "3x15/Seite", hint: "Körpergewicht oder leichte Kurzhantel auf dem Knie" },
  { name: "Pallof press", soll: "3x10/Seite", hint: "Leichter bis mittlerer Kabelzug/Band" },
];
const kraftB_alt = [
  { name: "Klimmzug", soll: "3x8-10", hint: "Ohne Zusatzgewicht oder bandunterstützt bei RPE 6-7" },
  { name: "Schrägbankdrücken", soll: "3x8-10", hint: "Startgewicht bei RPE 6-7 in Satz 3" },
  { name: "Langhantelrudern", soll: "3x8", hint: "Startgewicht bei RPE 6-7 in Satz 3" },
  { name: "Copenhagen plank", soll: "3x20-30s/Seite", hint: "Anfangs unteres Knie auf der Bank" },
  { name: "Hüftabduktion (Band)", soll: "3x15/Seite", hint: "Moderate Bandstärke" },
  { name: "Single-leg glute bridge", soll: "3x10/Seite", hint: "Körpergewicht" },
  { name: "Side plank", soll: "3x30-45s/Seite", hint: "Kein Gewicht" },
];

// ---- Kraft: neuer Full-Body-Split (ab Woche 2) ----
const fullBodyA_tbl = {
  2: ["3x8-10", "3x5", "3x4", "3x6-8", "3x8-10", "Wie Woche 1, +2.5-5 kg falls RPE klar unter 7"],
  3: ["3x8-10", "3x5", "3x5", "3x6-8", "3x8-10", "+2.5-5 kg falls Woche 2 RPE ≤7, sonst halten"],
  4: ["2x8 (Deload)", "2x5 (Deload)", "2x4 (Deload)", "2x6 (Deload)", "2x8 (Deload)", "Ca. 80% des Woche-3-Gewichts"],
  5: ["4x4-6", "4x3-5", "3x5", "4x5-7", "4x6-8", "Zurück auf Woche-3-Gewicht, jetzt RPE 8 bei weniger Wdh"],
  6: ["4x4-6", "4x3-5", "3x6", "4x5-7", "4x6-8", "+2.5-5 kg falls Woche 5 RPE ≤8, sonst halten"],
  7: ["4x4-6", "4x3-5", "3x6", "4x5-7", "4x6-8", "Höchste Last der Phase, +2.5-5 kg falls RPE ≤8"],
  8: ["2x6 (Deload)", "2x5 (Deload)", "2x5 (Deload)", "2x6 (Deload)", "2x6 (Deload)", "Ca. 80% des Woche-7-Gewichts"],
};
const fullBodyB_tbl = {
  2: ["3x8/Seite", "3x8/Seite", "3x10-12", "3x8-10", "3x8-10", "Start moderat, RPE 6-7 in Satz 3"],
  3: ["3x8/Seite", "3x8/Seite", "3x10-12", "3x8-10", "3x8-10", "+1-2.5 kg/Hand falls Woche 2 RPE ≤7"],
  4: ["2x8/Seite (Deload)", "2x8/Seite (Deload)", "2x10 (Deload)", "2x8 (Deload)", "2x8 (Deload)", "Ca. 80% des Woche-3-Gewichts"],
  5: ["4x6/Seite", "4x6/Seite", "3x10-12", "4x8-10", "4x6-8", "Zurück auf Woche-3-Gewicht, RPE 8 Zielbereich"],
  6: ["4x6/Seite", "4x6/Seite", "3x10-12", "4x8-10", "4x6-8", "+1-2.5 kg/Hand falls Woche 5 RPE ≤8"],
  7: ["4x6/Seite", "4x6/Seite", "3x10-12", "4x8-10", "4x6-8", "Höchstes Volumen der Phase"],
  8: ["2x6/Seite (Deload)", "2x6/Seite (Deload)", "2x10 (Deload)", "2x8 (Deload)", "2x6 (Deload)", "Ca. 80% des Woche-7-Gewichts"],
};

function fullBodyA(w) {
  const tbl = fullBodyA_tbl[w];
  return [
    { name: "Squats", soll: tbl[0], hint: tbl[5] },
    { name: "Deadlift", soll: tbl[1], hint: "Reduziertes Volumen — nach dem Squat begrenzte Reserve" },
    { name: "Nordic hamstring curl", soll: tbl[2], hint: "Kein Zusatzgewicht, Steigerung über Wdh/Tempo" },
    { name: "Klimmzüge", soll: tbl[3], hint: "Hohe Frequenz bewusst — skill-lastige Bewegung" },
    { name: "Brustpresse", soll: tbl[4], hint: "Horizontaler Push" },
    { name: "Soleus raises", soll: "3x15/Seite", hint: "Steigern wenn 15 Wdh sauber gelingen" },
    { name: "Pallof press", soll: "3x10/Seite", hint: "Anti-Rotation, Fokus ruhige Hüfte" },
    { name: "Planks (wechselnd)", soll: "3x30-45s", hint: "Front-/Seiten-/RKC-Plank abwechselnd" },
  ];
}
function fullBodyB(w) {
  const tbl = fullBodyB_tbl[w];
  return [
    { name: "Bulgarian split squats", soll: tbl[0], hint: tbl[5] },
    { name: "Single leg RDL", soll: tbl[1], hint: "Fokus Balance & Hüftstreckung" },
    { name: "Hamstring curls (Maschine)", soll: tbl[2], hint: "Konzentrisch, ermüdungsärmer als Nordic Curls" },
    { name: "Klimmzüge", soll: tbl[3], hint: "Etwas höhere Wdh als Dienstag" },
    { name: "Schulterpresse", soll: tbl[4], hint: "Vertikaler Push, andere Winkelbelastung als Dienstag" },
    { name: "Copenhagen planks", soll: "3x20-30s/Seite", hint: "Bein strecken sobald 30s sauber gelingen" },
    { name: "Hüftbeuger", soll: "3x12-15/Seite", hint: "Band oder Körpergewicht" },
    { name: "Crunches", soll: "3x15-20", hint: "Hypertrophie-Fokus, nahe Muskelversagen" },
  ];
}

const runDist = {
  1: ["7 km", "7 km", "12 km"],
  2: ["8 km", "8 km", "13 km"],
  3: ["8 km", "9 km", "15 km"],
  4: ["7 km", "7 km", "10 km"],
  5: ["8 km", "9 km", "13 km"],
  6: ["9 km", "9 km", "14 km"],
  7: ["10 km", "10 km", "16 km"],
  8: ["8 km", "8 km", "11 km"],
};
const steig = { 2: "4x20s", 3: "5x20s", 5: "5x20s", 6: "6x20s", 7: "6x20s" };
const recoveryWeeks = { 5: "4 km", 6: "5 km", 7: "5 km", 8: "3 km" };
const deloadWeeks = [4, 8];

export const weeks = {};

for (let w = 1; w <= DETAILED_UNTIL_WEEK; w++) {
  const start = weekStart(w);
  const dist = runDist[w];
  const isDeload = deloadWeeks.includes(w);

  const runs = [
    isDeload ? easyDeload(addDays(start, MO), dist[0]) : easy(addDays(start, MO), dist[0]),
    isDeload ? easyDeload(addDays(start, MI), dist[1]) : easy(addDays(start, MI), dist[1], steig[w]),
    longRun(addDays(start, SA), dist[2]),
  ];
  if (recoveryWeeks[w]) {
    runs.push(
      recovery(
        addDays(start, SO),
        recoveryWeeks[w],
        w === DETAILED_UNTIL_WEEK ? "Ende Phase 1 — Re-Kalibrierung fällig" : null
      )
    );
  }

  weeks[w] = {
    n: w,
    phase: 1,
    deload: isDeload,
    start,
    end: addDays(start, SO),
    dateRange: start + " bis " + addDays(start, SO),
    runs,
    kraft: {
      di: {
        date: addDays(start, DI),
        label: w === 1 ? "Kraft A (alter Split)" : "Full Body A",
        shortLabel: w === 1 ? "Kraft A" : "FB A",
        exercises: w === 1 ? kraftA_alt : fullBodyA(w),
      },
      do: {
        date: addDays(start, DO),
        label: w === 1 ? "Kraft B (alter Split)" : "Full Body B",
        shortLabel: w === 1 ? "Kraft B" : "FB B",
        exercises: w === 1 ? kraftB_alt : fullBodyB(w),
      },
    },
  };
}

// Wochen 9-31: Struktur bekannt, Details folgen nach Re-Kalibrierung
for (let w = DETAILED_UNTIL_WEEK + 1; w <= TOTAL_WEEKS; w++) {
  const phase = phases.find((p) => w >= p.weeks[0] && w <= p.weeks[1]);
  const start = weekStart(w);
  weeks[w] = {
    n: w,
    phase: phase.n,
    placeholder: true,
    focus: phase.focus,
    start,
    end: addDays(start, SO),
    dateRange: start + " bis " + addDays(start, SO),
  };
}

// Alle Übungen, die im Plan vorkommen — für die Auswahl im Verlauf.
export const exerciseCatalog = (() => {
  const seen = new Map();
  for (let w = 1; w <= DETAILED_UNTIL_WEEK; w++) {
    for (const day of [weeks[w].kraft.di, weeks[w].kraft.do]) {
      for (const ex of day.exercises) {
        if (!seen.has(ex.name)) seen.set(ex.name, { name: ex.name, firstWeek: w });
      }
    }
  }
  return [...seen.values()];
})();
