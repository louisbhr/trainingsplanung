// Leitet aus den eingetragenen Wiederholungen ab, ob beim nächsten Mal
// mehr Gewicht dran ist — statt nach dem Anstrengungsgrad (RPE) zu fragen.
//
// Der Plan steuert die Progression über RPE ("+2.5 kg falls RPE ≤7").
// Wer im Gym nicht über sein Empfinden nachdenken will, bekommt dieselbe
// Entscheidung aus den Zahlen, die ohnehin erfasst werden: das ist
// Double Progression — erst die Wiederholungen ans obere Ende der
// Spanne bringen, dann das Gewicht erhöhen.
//
// Bewusst ohne Firebase-/Browser-Abhängigkeiten, damit es sich ohne
// Browser testen lässt.

// "3x8-10" -> { sets: 3, repMin: 8, repMax: 10 }
// "4x6/Seite" -> { sets: 4, repMin: 6, repMax: 6 }
// "3x30-45s" -> zeitbasiert, kein Gewichtsvorschlag
export function parseSoll(soll) {
  const text = String(soll || "");
  const m = text.match(/(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i);
  if (!m) return null;
  const timeBased = /\d\s*-?\s*\d*\s*s\b/i.test(text.slice(m.index + m[0].length - 1));
  return {
    sets: Number(m[1]),
    repMin: Number(m[2]),
    repMax: Number(m[3] || m[2]),
    timeBased,
    deload: /deload/i.test(text),
  };
}

const round = (n) => Math.round(n * 10) / 10;

// Schrittweite: an der Langhantel gröber als an Kurzhanteln
function stepFor(kg) {
  if (kg >= 60) return 5;
  if (kg >= 20) return 2.5;
  return 1;
}

/**
 * @param soll  Sollvorgabe aus dem Plan, z. B. "3x8-10"
 * @param last  letzter Eintrag: { sets: [{kg, reps}], date }
 * @returns null oder { level, text }
 *          level: "up" | "hold" | "down" | "info"
 */
export function suggestProgression(soll, last) {
  const spec = parseSoll(soll);
  if (!spec || !last?.sets?.length) return null;

  const sets = last.sets.filter((s) => s.reps != null && s.reps > 0);
  if (!sets.length) return null;

  const reps = sets.map((s) => s.reps);
  const weights = sets.map((s) => s.kg).filter((k) => k != null && k > 0);
  const topKg = weights.length ? Math.max(...weights) : null;
  const minReps = Math.min(...reps);
  const maxReps = Math.max(...reps);

  // Zeit- oder Körpergewichtsübungen: über Wiederholungen steigern
  if (spec.timeBased || topKg === null) {
    if (minReps >= spec.repMax) {
      return { level: "up", text: `Zuletzt ${reps.join("/")} — mehr Wiederholungen oder schwerere Variante.` };
    }
    return { level: "info", text: `Zuletzt ${reps.join("/")}.` };
  }

  const kgText = `${round(topKg)} kg`;

  if (spec.deload) {
    return { level: "info", text: `Deload. Zuletzt ${kgText} × ${reps.join("/")}.` };
  }

  // Alle Sätze am oberen Ende der Spanne: Gewicht hoch
  if (minReps >= spec.repMax) {
    const next = round(topKg + stepFor(topKg));
    return {
      level: "up",
      text: `Zuletzt ${kgText} × ${reps.join("/")} — Spanne voll ausgeschöpft, heute ${next} kg versuchen.`,
    };
  }

  // Unter der unteren Grenze: zu schwer
  if (minReps < spec.repMin) {
    const softer = round(topKg - stepFor(topKg));
    return {
      level: "down",
      text: `Zuletzt ${kgText} × ${reps.join("/")} — unter dem Soll, heute ${softer} kg oder Gewicht halten.`,
    };
  }

  // In der Spanne: Gewicht halten, Wiederholungen ausbauen
  const note = maxReps - minReps >= 3 ? " Der Abfall über die Sätze spricht für halten." : "";
  return {
    level: "hold",
    text: `Zuletzt ${kgText} × ${reps.join("/")} — Gewicht halten, auf ${spec.repMax} Wdh in allen Sätzen hinarbeiten.${note}`,
  };
}

// Jüngster Eintrag vor einem Datum
export function previousEntry(entries, beforeISO) {
  return (
    entries
      .filter((e) => e.date < beforeISO && e.sets?.length)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .pop() || null
  );
}
