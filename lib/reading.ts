import type { RevisionSheet } from "./types";

/**
 * How long the sheet takes to work through, and which of its points are the
 * examinable ones.
 *
 * Both are computed here rather than asked of the model. A reading time the
 * model invents is a guess dressed as a number, and a difficulty label it
 * assigns is unfalsifiable. These two are derived from the text itself, so
 * they can be checked by looking.
 */

/** Revision is slower than reading. This is deliberately below a prose rate. */
const WORDS_PER_MINUTE = 150;

export function wordCount(sheet: RevisionSheet): number {
  const parts = [
    sheet.overview,
    ...sheet.concepts.flatMap((c) => [c.term, c.definition]),
    ...sheet.sections.flatMap((s) => [s.heading, ...s.points]),
    ...sheet.memorize,
    ...sheet.traps,
  ];
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(sheet: RevisionSheet): number {
  return Math.max(1, Math.round(wordCount(sheet) / WORDS_PER_MINUTE));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A point is high yield when it carries something an examiner can mark: one of
 * the sheet's own key terms, a figure, or a formula. Everything else is
 * connective tissue, useful on a first read and skippable on the fourth.
 */
export function isHighYield(point: string, terms: string[]): boolean {
  if (/\d/.test(point)) return true;
  if (/[=<>≤≥±×÷^]|\b[A-Za-z]\s*\(\s*[a-z]\s*\)/.test(point)) return true;
  return terms.some((t) => t.length >= 3 && new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(point));
}

export function highYieldCount(sheet: RevisionSheet): number {
  const terms = sheet.concepts.map((c) => c.term);
  return sheet.sections.reduce(
    (n, s) => n + s.points.filter((p) => isHighYield(p, terms)).length,
    0,
  );
}

export function totalPoints(sheet: RevisionSheet): number {
  return sheet.sections.reduce((n, s) => n + s.points.length, 0);
}
