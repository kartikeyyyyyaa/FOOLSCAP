import type { RevisionSheet, Rung, LedgerEntry } from "./types";

/** A topic only enters the ledger at this score or better. */
export const PASS = 0.8;

/** How long before an answered topic has to be answered again. */
export const HOLD_MS = 48 * 60 * 60 * 1000;

/** Where a topic currently sits on the proof ladder. */
export function rungFor(entry: LedgerEntry, now = Date.now()): Rung {
  const age = now - entry.at;
  if (entry.held) return { name: "Held", tone: "proved" };
  if (entry.ratio >= PASS && age < HOLD_MS) return { name: "Answered", tone: "proved" };
  if (entry.ratio >= PASS) return { name: "Due to re-prove", tone: "shaky" };
  return { name: "Not proved", tone: "missed" };
}

export function standingCount(ledger: LedgerEntry[], now = Date.now()): number {
  return ledger.filter((e) => e.held || (e.ratio >= PASS && now - e.at < HOLD_MS)).length;
}

export function since(ts: number, now = Date.now()): string {
  const mins = Math.round((now - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export interface Debrief {
  right: number;
  answered: number;
  total: number;
  ratio: number;
  gaps: { name: string; n: number }[];
  line: string;
}

/**
 * Computed entirely on the client from the `tests` field each question carries,
 * so the debrief costs no extra model call.
 */
export function buildDebrief(sheet: RevisionSheet, answers: Record<number, number>): Debrief {
  const misses = new Map<string, number>();
  let right = 0;

  sheet.quiz.forEach((q, i) => {
    if (!(i in answers)) return;
    if (answers[i] === q.answerIndex) {
      right += 1;
      return;
    }
    const key = q.tests || "General";
    misses.set(key, (misses.get(key) ?? 0) + 1);
  });

  const answered = Object.keys(answers).length;
  const ratio = answered ? right / answered : 0;
  const gaps = [...misses.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);

  let line: string;
  if (answered === 0) {
    line = "Answer the quiz and the debrief fills in here.";
  } else if (gaps.length === 0) {
    line = "Clean run. Nothing to send you back to.";
  } else if (ratio >= PASS) {
    line = `Passed, but ${gaps[0].name.toLowerCase()} is the soft spot. Reread that section before the exam.`;
  } else {
    line =
      "Not proved yet. Your mistakes are concentrated, not scattered, so one section fixes most of this.";
  }

  return { right, answered, total: sheet.quiz.length, ratio, gaps, line };
}
