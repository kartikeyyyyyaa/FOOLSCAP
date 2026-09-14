export interface Concept {
  term: string;
  definition: string;
}

export interface Section {
  heading: string;
  points: string[];
}

export interface QuizItem {
  question: string;
  options: string[];
  /** Zero based index into `options`. */
  answerIndex: number;
  /**
   * The exact `heading` of the section this question examines. This single
   * field is what powers the debrief, the per-section tracker and the
   * attempt comparison, with no extra model call.
   */
  tests: string;
  explanation: string;
}

export interface RevisionSheet {
  subject: string;
  title: string;
  overview: string;
  concepts: Concept[];
  sections: Section[];
  /** Formulas, rules and lists that have to be known verbatim. */
  memorize: string[];
  /** Specific mistakes students make on this topic. */
  traps: string[];
  quiz: QuizItem[];
}

export type Depth = "quick" | "thorough";

export interface SectionStat {
  right: number;
  total: number;
}

/** One finished quiz. The single source of truth everything else derives from. */
export interface Attempt {
  id: string;
  topicTitle: string;
  subject: string;
  right: number;
  total: number;
  ratio: number;
  /** Accuracy per section heading, from each question's `tests` field. */
  sectionStats: Record<string, SectionStat>;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface TopicStat {
  title: string;
  subject: string;
  attempts: number;
  best: number;
  latest: number;
  first: number;
  lastAt: number;
  /** Last few ratios, oldest first, for the sparkline. */
  trend: number[];
  sections: Record<string, SectionStat>;
  weakestSection: string | null;
}

/** A topic's current standing, derived from its attempts. */
export interface LedgerEntry {
  title: string;
  subject: string;
  right: number;
  total: number;
  ratio: number;
  at: number;
  held: boolean;
}

export type RungTone = "proved" | "shaky" | "missed" | "idle";

export interface Rung {
  name: string;
  tone: RungTone;
}

/** A generated sheet kept so it can be reopened without paying Gemini again. */
export interface SavedSheet {
  id: string;
  title: string;
  subject: string;
  depth: Depth;
  sheet: RevisionSheet;
  createdAt: number;
}

export interface GenerateResponse {
  sheet?: RevisionSheet;
  error?: string;
}

/* ------------------------------------------------------------------ *
 * Ask: a question about the topic, answered from the student's own
 * material rather than from the model's general knowledge.
 * ------------------------------------------------------------------ */

export interface AskAnswer {
  answer: string;
  /** False when the material does not cover it and the answer came from elsewhere. */
  grounded: boolean;
  /** Section headings the answer draws on. Always real headings from the sheet. */
  sections: string[];
  /** Two short questions worth asking next. */
  followUps: string[];
}

export interface AskResponse {
  result?: AskAnswer;
  error?: string;
}

/** One turn in the thread. `pending` while the answer is in flight. */
export interface AskTurn {
  id: string;
  question: string;
  result: AskAnswer | null;
  error: string | null;
}

/* ------------------------------------------------------------------ *
 * Watch: a narrated explainer built from the sheet.
 * ------------------------------------------------------------------ */

export interface ReelScene {
  heading: string;
  /** Two to four short lines shown on screen. Not sentences. */
  lines: string[];
  /** What is said over the scene. */
  narration: string;
  /** How long the scene runs when narration is muted or unavailable. */
  seconds: number;
}

export interface Reel {
  title: string;
  /** One line stating what the viewer will be able to do afterwards. */
  promise: string;
  scenes: ReelScene[];
  /** A search query for finding a human-made lecture on the same topic. */
  search: string;
}

export interface ExplainResponse {
  reel?: Reel;
  error?: string;
}
