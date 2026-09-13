import { HOLD_MS, PASS } from "./ledger";
import type { Attempt, LedgerEntry, RevisionSheet, SectionStat, TopicStat } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Recording
 * ------------------------------------------------------------------ */

/**
 * Turns a finished quiz into one attempt row. Per-section accuracy is derived
 * here from the `tests` field each question carries, which is what makes the
 * comparison and the topic tracker possible without a second model call.
 */
export function toAttempt(
  sheet: RevisionSheet,
  answers: Record<number, number>,
  now = Date.now(),
): Attempt {
  const sectionStats: Record<string, SectionStat> = {};
  let right = 0;

  sheet.quiz.forEach((q, i) => {
    if (!(i in answers)) return;
    const key = q.tests || "General";
    const stat = sectionStats[key] ?? { right: 0, total: 0 };
    stat.total += 1;
    if (answers[i] === q.answerIndex) {
      stat.right += 1;
      right += 1;
    }
    sectionStats[key] = stat;
  });

  const total = sheet.quiz.length;

  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    topicTitle: sheet.title,
    subject: sheet.subject ?? "",
    right,
    total,
    ratio: total ? right / total : 0,
    sectionStats,
    createdAt: now,
  };
}

/* ------------------------------------------------------------------ *
 * Ledger, derived from attempts
 * ------------------------------------------------------------------ */

/** Newest attempt per topic, newest topic first. */
export function latestPerTopic(attempts: Attempt[]): Attempt[] {
  const seen = new Map<string, Attempt>();
  for (const a of [...attempts].sort((x, y) => y.createdAt - x.createdAt)) {
    if (!seen.has(a.topicTitle)) seen.set(a.topicTitle, a);
  }
  return [...seen.values()];
}

export function toLedger(attempts: Attempt[]): LedgerEntry[] {
  return latestPerTopic(attempts).map((latest) => {
    const forTopic = attempts
      .filter((a) => a.topicTitle === latest.topicTitle)
      .sort((x, y) => y.createdAt - x.createdAt);

    // "Held" needs a passing attempt that follows an earlier passing attempt
    // at least 48 hours older. That gap is the whole point of the rung.
    const held =
      latest.ratio >= PASS &&
      forTopic.some((a) => a !== latest && a.ratio >= PASS && latest.createdAt - a.createdAt >= HOLD_MS);

    return {
      title: latest.topicTitle,
      subject: latest.subject,
      right: latest.right,
      total: latest.total,
      ratio: latest.ratio,
      at: latest.createdAt,
      held,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Per-topic tracker
 * ------------------------------------------------------------------ */

export function topicStats(attempts: Attempt[]): TopicStat[] {
  const byTopic = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = byTopic.get(a.topicTitle) ?? [];
    list.push(a);
    byTopic.set(a.topicTitle, list);
  }

  return [...byTopic.entries()]
    .map(([title, list]) => {
      const ordered = [...list].sort((x, y) => x.createdAt - y.createdAt);
      const latest = ordered[ordered.length - 1];
      const ratios = ordered.map((a) => a.ratio);

      // Section accuracy pooled across every attempt on this topic.
      const pooled: Record<string, SectionStat> = {};
      for (const a of ordered) {
        for (const [name, s] of Object.entries(a.sectionStats)) {
          const cur = pooled[name] ?? { right: 0, total: 0 };
          pooled[name] = { right: cur.right + s.right, total: cur.total + s.total };
        }
      }

      const weakest = Object.entries(pooled)
        .filter(([, s]) => s.total > 0)
        .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];

      return {
        title,
        subject: latest.subject,
        attempts: ordered.length,
        best: Math.max(...ratios),
        latest: latest.ratio,
        first: ratios[0],
        lastAt: latest.createdAt,
        trend: ratios.slice(-8),
        sections: pooled,
        weakestSection: weakest ? weakest[0] : null,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

/* ------------------------------------------------------------------ *
 * Attempt comparison
 * ------------------------------------------------------------------ */

export type CompareVerdict = "aced" | "improved" | "slipped" | "stuck" | "new";

export interface CompareRow {
  section: string;
  previous: number | null;
  current: number;
  delta: number | null;
  verdict: CompareVerdict;
  advice: string;
}

export interface Comparison {
  topicTitle: string;
  current: Attempt;
  previous: Attempt | null;
  rows: CompareRow[];
  headline: string;
}

function verdictFor(previous: number | null, current: number): CompareVerdict {
  if (current === 1) return "aced";
  if (previous === null) return "new";
  if (current > previous + 0.001) return "improved";
  if (current < previous - 0.001) return "slipped";
  return "stuck";
}

const ADVICE: Record<CompareVerdict, string> = {
  aced: "Clean. Leave it alone until the ledger asks for it again.",
  improved: "Moving the right way. One more pass and this is safe.",
  slipped: "You had this and lost it. Reread this section before anything else.",
  stuck: "Same score twice. Rereading is not working here, so try writing the answer out instead.",
  new: "First time through this section. No baseline to compare against yet.",
};

/** Compares the two most recent attempts on a topic, section by section. */
export function compareAttempts(attempts: Attempt[], topicTitle: string): Comparison | null {
  const ordered = attempts
    .filter((a) => a.topicTitle === topicTitle)
    .sort((x, y) => y.createdAt - x.createdAt);

  if (ordered.length === 0) return null;

  const current = ordered[0];
  const previous = ordered[1] ?? null;

  const names = new Set([
    ...Object.keys(current.sectionStats),
    ...Object.keys(previous?.sectionStats ?? {}),
  ]);

  const rows: CompareRow[] = [...names].map((section) => {
    const cur = current.sectionStats[section];
    const prev = previous?.sectionStats[section];

    const currentRatio = cur && cur.total ? cur.right / cur.total : 0;
    const previousRatio = prev && prev.total ? prev.right / prev.total : null;
    const verdict = verdictFor(previousRatio, currentRatio);

    return {
      section,
      previous: previousRatio,
      current: currentRatio,
      delta: previousRatio === null ? null : currentRatio - previousRatio,
      verdict,
      advice: ADVICE[verdict],
    };
  });

  rows.sort((a, b) => a.current - b.current);

  let headline: string;
  if (!previous) {
    headline = "First attempt on this topic. Answer it again in 48 hours and this fills with a comparison.";
  } else {
    const up = rows.filter((r) => r.verdict === "improved").length;
    const down = rows.filter((r) => r.verdict === "slipped").length;
    const delta = current.ratio - previous.ratio;
    const pts = Math.round(Math.abs(delta) * 100);

    if (delta > 0.001) {
      headline = `Up ${pts} points on the last attempt, ${up} ${up === 1 ? "section" : "sections"} better.`;
    } else if (delta < -0.001) {
      headline = `Down ${pts} points, ${down} ${down === 1 ? "section" : "sections"} worse than last time.`;
    } else {
      headline = "Same overall score as last time, but the sections moved underneath it.";
    }
  }

  return { topicTitle, current, previous, rows, headline };
}

/* ------------------------------------------------------------------ *
 * Activity heatmap
 * ------------------------------------------------------------------ */

export interface HeatCell {
  /** Days before today, 0 is today. */
  daysAgo: number;
  date: Date;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Builds a GitHub-style grid ending on today. Columns are weeks, rows are
 * weekdays starting Sunday, so the last column is the current partial week.
 */
export function heatmapCells(attempts: Attempt[], weeks = 26, now = Date.now()): HeatCell[][] {
  const counts = new Map<number, number>();
  for (const a of attempts) {
    const key = startOfDay(a.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = startOfDay(now);
  const todayDow = new Date(today).getDay();
  // Last column holds today, so walk back to the Sunday of the first column.
  const firstDay = today - ((weeks - 1) * 7 + todayDow) * DAY_MS;

  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const ts = firstDay + (w * 7 + d) * DAY_MS;
      const count = ts > today ? 0 : (counts.get(ts) ?? 0);
      col.push({
        daysAgo: Math.round((today - ts) / DAY_MS),
        date: new Date(ts),
        count,
        level: ts > today ? 0 : (Math.min(count, 4) as 0 | 1 | 2 | 3 | 4),
      });
    }
    grid.push(col);
  }
  return grid;
}

/** Consecutive days ending today (or yesterday) with at least one attempt. */
export function dayStreak(attempts: Attempt[], now = Date.now()): number {
  const days = new Set(attempts.map((a) => startOfDay(a.createdAt)));
  const today = startOfDay(now);

  let cursor = days.has(today) ? today : today - DAY_MS;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
