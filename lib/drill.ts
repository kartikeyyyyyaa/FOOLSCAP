import type { RevisionSheet } from "./types";

/**
 * Flashcards and cloze drills, both derived from the sheet that has already
 * been generated. No second model call, and nothing here can invent a fact:
 * every card front, card back and blanked answer is text the sheet already
 * contains.
 */

export type CardKind = "term" | "verbatim";

export interface Card {
  id: string;
  kind: CardKind;
  front: string;
  back: string;
}

export interface ClozeItem {
  id: string;
  /** The sentence with the answer replaced by a blank marker. */
  text: string;
  answer: string;
  /** The section heading this came from, so a miss lands in the right place. */
  tests: string;
}

/* ------------------------------------------------------------------ *
 * Cards
 * ------------------------------------------------------------------ */

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Stable across regenerations of the same topic, so mastery is not lost. */
export function cardId(topicTitle: string, front: string): string {
  return `${slug(topicTitle)}::${slug(front)}`;
}

export function buildCards(sheet: RevisionSheet): Card[] {
  const cards: Card[] = sheet.concepts.map((c) => ({
    id: cardId(sheet.title, c.term),
    kind: "term" as const,
    front: c.term,
    back: c.definition,
  }));

  // Things that have to be known word for word are asked the other way round:
  // the cue is what it is for, the answer is the statement itself.
  for (const item of sheet.memorize) {
    const [cue, ...rest] = item.split(/:\s+/);
    const hasCue = rest.length > 0 && cue.length <= 60;
    cards.push({
      id: cardId(sheet.title, item),
      kind: "verbatim",
      front: hasCue ? cue : "State this from memory",
      back: hasCue ? rest.join(": ") : item,
    });
  }

  return cards;
}

/* ------------------------------------------------------------------ *
 * Mastery. Leitner boxes, kept on the device.
 * ------------------------------------------------------------------ */

const CARDS_KEY = "foolscap.cards";

/** Box 3 is mastered. A miss drops a card two boxes, never below zero. */
export const MASTERED_BOX = 3;

export type CardState = Record<string, { box: number; at: number }>;

export function loadCardState(): CardState {
  try {
    const raw = window.localStorage.getItem(CARDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as CardState) : {};
  } catch {
    return {};
  }
}

export function saveCardState(state: CardState): void {
  try {
    window.localStorage.setItem(CARDS_KEY, JSON.stringify(state));
  } catch {
    // Blocked storage turns mastery into a per-session thing rather than
    // breaking the deck.
  }
}

export function gradeCard(state: CardState, id: string, got: boolean): CardState {
  const box = state[id]?.box ?? 0;
  const next = got ? Math.min(box + 1, MASTERED_BOX) : Math.max(box - 2, 0);
  return { ...state, [id]: { box: next, at: Date.now() } };
}

export function masteredCount(cards: Card[], state: CardState): number {
  return cards.filter((c) => (state[c.id]?.box ?? 0) >= MASTERED_BOX).length;
}

/**
 * Weakest first, mastered last. A deck that opens on the card you already know
 * wastes the only thing the student is short of.
 */
export function orderCards(cards: Card[], state: CardState): Card[] {
  return [...cards].sort((a, b) => {
    const ab = state[a.id]?.box ?? 0;
    const bb = state[b.id]?.box ?? 0;
    if (ab !== bb) return ab - bb;
    return (state[a.id]?.at ?? 0) - (state[b.id]?.at ?? 0);
  });
}

/* ------------------------------------------------------------------ *
 * Cloze
 * ------------------------------------------------------------------ */

export const BLANK = "░░░░";

/** Words too common to be worth blanking, if nothing better is found. */
const STOP =
  /^(the|and|for|that|this|with|from|into|when|which|while|each|both|than|then|are|is|of|to|in|on|a|an|it|its|as|by|or|be|can|may|not|all|one|two|has|have|must|only|also|such|they|their|there|these|those|if|but|at|no|nor|so)$/i;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Blanks the most examinable thing in a line: a key term from the sheet if the
 * line contains one, otherwise a number or formula, otherwise the longest
 * content word. Returns null when nothing in the line is worth hiding, which is
 * deliberate. A blank over a filler word teaches nothing.
 */
function blankOut(line: string, terms: string[]): { text: string; answer: string } | null {
  for (const term of terms) {
    if (term.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    const match = re.exec(line);
    if (match) {
      return { text: line.replace(re, BLANK), answer: match[0] };
    }
  }

  const numeric = /\b\d+(?:[.,]\d+)?\s*(?:%|ms|s|kb|mb|gb|bits?|bytes?)?\b/i.exec(line);
  if (numeric && numeric[0].trim().length > 1) {
    return { text: line.replace(numeric[0], BLANK), answer: numeric[0].trim() };
  }

  const words = line.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) ?? [];
  const candidate = words.filter((w) => !STOP.test(w)).sort((a, b) => b.length - a.length)[0];
  if (!candidate) return null;

  return {
    text: line.replace(new RegExp(`\\b${escapeRegExp(candidate)}\\b`), BLANK),
    answer: candidate,
  };
}

export function buildCloze(sheet: RevisionSheet, limit = 12): ClozeItem[] {
  // Longest terms first, so "circular wait" is preferred over "wait".
  const terms = sheet.concepts.map((c) => c.term).sort((a, b) => b.length - a.length);
  const items: ClozeItem[] = [];
  const seen = new Set<string>();

  const push = (line: string, tests: string) => {
    if (items.length >= limit) return;
    const trimmed = line.trim();
    if (trimmed.length < 25 || seen.has(trimmed)) return;

    const blanked = blankOut(trimmed, terms);
    if (!blanked) return;

    seen.add(trimmed);
    items.push({
      id: `${items.length}-${slug(blanked.answer)}`,
      text: blanked.text,
      answer: blanked.answer,
      tests,
    });
  };

  // Verbatim material first: it is the part that has to be exact.
  for (const line of sheet.memorize) push(line, "Commit to memory");

  // Then one point per section before taking a second from any, so the drill
  // covers the whole topic rather than hammering the first section.
  const sections = sheet.sections;
  for (let round = 0; round < 4; round += 1) {
    for (const section of sections) {
      const point = section.points[round];
      if (point) push(point, section.heading);
    }
  }

  return items;
}

/** Forgiving on case, spacing and punctuation, strict on the word itself. */
export function isClozeRight(given: string, answer: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const a = norm(given);
  const b = norm(answer);
  if (!a) return false;
  if (a === b) return true;

  // A single typo in a long word should not read as not knowing it.
  if (b.length >= 6 && Math.abs(a.length - b.length) <= 1) {
    let edits = 0;
    for (let i = 0, j = 0; i < a.length && j < b.length; i += 1, j += 1) {
      if (a[i] === b[j]) continue;
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) j -= 1;
      else if (a.length < b.length) i -= 1;
    }
    return edits <= 1;
  }

  return false;
}
