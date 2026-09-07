// Trainingsplan-Daten. Phase 1 (Woche 1-8) ist im Detail ausformuliert,
// Phase 2-4 als Struktur mit Datumsbereich - Details folgen nach der
// Re-Kalibrierung am Ende von Phase 1.

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

function easy(date, dist, steig) {
  return { date, type: "Easy run" + (steig ? " + " + steig : ""), dist, pace: "6:10–6:35 /km", hf: "148–163 bpm" };
}
function easyDeload(date, dist) {
  return { date, type: "Easy run", dist, pace: "6:15–6:40 /km", hf: "148–160 bpm" };
}
function longRun(date, dist, deload) {
  return { date, type: "Long run", dist, pace: deload ? "6:15–6:40 /km" : "6:15–6:40 /km", hf: "148–160 bpm" };
}
function recovery(date, dist, note) {
  return { date, type: "Recovery run", dist, pace: "> 6:40 /km", hf: "< 148 bpm", note };
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
function fullBodyA(w) {
  const tbl = {
    2: ["3x8-10", "3x5", "3x4", "3x6-8", "3x8-10", "Wie Woche 1, +2.5-5 kg falls RPE klar unter 7"],
    3: ["3x8-10", "3x5", "3x5", "3x6-8", "3x8-10", "+2.5-5 kg falls Woche 2 RPE ≤7, sonst halten"],
    4: ["2x8 (Deload)", "2x5 (Deload)", "2x4 (Deload)", "2x6 (Deload)", "2x8 (Deload)", "Ca. 80% des Woche-3-Gewichts"],
    5: ["4x4-6", "4x3-5", "3x5", "4x5-7", "4x6-8", "Zurück auf Woche-3-Gewicht, jetzt RPE 8 bei weniger Wdh"],
    6: ["4x4-6", "4x3-5", "3x6", "4x5-7", "4x6-8", "+2.5-5 kg falls Woche 5 RPE ≤8, sonst halten"],
    7: ["4x4-6", "4x3-5", "3x6", "4x5-7", "4x6-8", "Höchste Last der Phase, +2.5-5 kg falls RPE ≤8"],
    8: ["2x6 (Deload)", "2x5 (Deload)", "2x5 (Deload)", "2x6 (Deload)", "2x6 (Deload)", "Ca. 80% des Woche-7-Gewichts"],
  }[w];
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
  const tbl = {
    2: ["3x8/Seite", "3x8/Seite", "3x10-12", "3x8-10", "3x8-10", "Start moderat, RPE 6-7 in Satz 3"],
    3: ["3x8/Seite", "3x8/Seite", "3x10-12", "3x8-10", "3x8-10", "+1-2.5 kg/Hand falls Woche 2 RPE ≤7"],
    4: ["2x8/Seite (Deload)", "2x8/Seite (Deload)", "2x10 (Deload)", "2x8 (Deload)", "2x8 (Deload)", "Ca. 80% des Woche-3-Gewichts"],
    5: ["4x6/Seite", "4x6/Seite", "3x10-12", "4x8-10", "4x6-8", "Zurück auf Woche-3-Gewicht, RPE 8 Zielbereich"],
    6: ["4x6/Seite", "4x6/Seite", "3x10-12", "4x8-10", "4x6-8", "+1-2.5 kg/Hand falls Woche 5 RPE ≤8"],
    7: ["4x6/Seite", "4x6/Seite", "3x10-12", "4x8-10", "4x6-8", "Höchstes Volumen der Phase"],
    8: ["2x6/Seite (Deload)", "2x6/Seite (Deload)", "2x10 (Deload)", "2x8 (Deload)", "2x6 (Deload)", "Ca. 80% des Woche-7-Gewichts"],
  }[w];
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

export const weeks = {};
const runDates = {
  1: { mo: "2026-08-31", mi: "2026-09-02", sa: "2026-09-05" },
  2: { mo: "2026-09-07", mi: "2026-09-09", sa: "2026-09-12" },
  3: { mo: "2026-09-14", mi: "2026-09-16", sa: "2026-09-19" },
  4: { mo: "2026-09-21", mi: "2026-09-23", sa: "2026-09-26" },
  5: { mo: "2026-09-28", mi: "2026-09-30", sa: "2026-10-03", so: "2026-10-04" },
  6: { mo: "2026-10-05", mi: "2026-10-07", sa: "2026-10-10", so: "2026-10-11" },
  7: { mo: "2026-10-12", mi: "2026-10-14", sa: "2026-10-17", so: "2026-10-18" },
  8: { mo: "2026-10-19", mi: "2026-10-21", sa: "2026-10-24", so: "2026-10-25" },
};
const kraftDates = {
  1: { di: "2026-09-01", do: "2026-09-03" },
  2: { di: "2026-09-08", do: "2026-09-10" },
  3: { di: "2026-09-15", do: "2026-09-17" },
  4: { di: "2026-09-22", do: "2026-09-24" },
  5: { di: "2026-09-29", do: "2026-10-01" },
  6: { di: "2026-10-06", do: "2026-10-08" },
  7: { di: "2026-10-13", do: "2026-10-15" },
  8: { di: "2026-10-20", do: "2026-10-22" },
};
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
const deloadWeeks = [4, 8];

for (let w = 1; w <= 8; w++) {
  const rd = runDates[w];
  const dist = runDist[w];
  const isDeload = deloadWeeks.includes(w);
  const runs = [];
  runs.push(isDeload ? easyDeload(rd.mo, dist[0]) : easy(rd.mo, dist[0]));
  runs.push(isDeload ? easyDeload(rd.mi, dist[1]) : easy(rd.mi, dist[1], steig[w]));
  runs.push(longRun(rd.sa, dist[2], isDeload));
  if (rd.so) runs.push(recovery(rd.so, w === 8 ? "3 km" : w === 5 ? "4 km" : "5 km", w === 8 ? "Ende Phase 1 — Re-Kalibrierung fällig" : null));

  const kd = kraftDates[w];
  weeks[w] = {
    phase: 1,
    dateRange: rd.mo + " bis " + (rd.so || rd.sa),
    runs,
    kraft: {
      di: { date: kd.di, label: w === 1 ? "Kraft A (alter Split)" : "Full Body A", exercises: w === 1 ? kraftA_alt : fullBodyA(w) },
      do: { date: kd.do, label: w === 1 ? "Kraft B (alter Split)" : "Full Body B", exercises: w === 1 ? kraftB_alt : fullBodyB(w) },
    },
  };
}

// Wochen 9-31: Struktur bekannt, Details folgen nach Re-Kalibrierung
for (let w = 9; w <= 31; w++) {
  const phase = phases.find((p) => w >= p.weeks[0] && w <= p.weeks[1]);
  weeks[w] = { phase: phase.n, placeholder: true, focus: phase.focus };
}
