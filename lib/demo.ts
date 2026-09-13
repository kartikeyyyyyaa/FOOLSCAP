import type { Attempt, SectionStat } from "./types";

/**
 * Deterministic demo history, used by the "Try the demo" button and when no
 * database is configured. It exists so a new visitor sees the tracker, the
 * heatmap and the comparison populated instead of three empty panels.
 *
 * This is illustrative data and the UI labels it as such. It is never
 * presented as another student's real record.
 */

const DAY = 24 * 60 * 60 * 1000;

interface Plan {
  title: string;
  subject: string;
  /** [daysAgo, correct out of 5] per attempt, oldest first. */
  runs: [number, number][];
  sections: string[];
}

const PLANS: Plan[] = [
  {
    title: "Deadlock: conditions, handling, and the banker's algorithm",
    subject: "Operating Systems",
    runs: [[23, 2], [18, 3], [4, 5]],
    sections: ["The four Coffman conditions", "Banker's algorithm, step by step", "Detection, and why it differs"],
  },
  {
    title: "CPU scheduling: turnaround, waiting time and starvation",
    subject: "Operating Systems",
    runs: [[31, 3], [27, 4], [9, 4]],
    sections: ["Scheduling criteria", "Round robin and the quantum", "Starvation and ageing"],
  },
  {
    title: "Normalisation up to BCNF",
    subject: "Database Systems",
    runs: [[16, 4], [2, 3]],
    sections: ["Functional dependencies", "Second and third normal form", "BCNF and lossless joins"],
  },
  {
    title: "Nucleophilic substitution: SN1 against SN2",
    subject: "Organic Chemistry",
    runs: [[12, 2], [6, 4], [1, 5]],
    sections: ["Rate laws and mechanism", "Substrate and solvent effects", "Stereochemical outcome"],
  },
  {
    title: "Elasticity and consumer surplus",
    subject: "Microeconomics",
    runs: [[20, 5]],
    sections: ["Price elasticity of demand", "Determinants of elasticity", "Welfare and surplus"],
  },
];

/** Splits a score across sections so the weakest one is visibly weakest. */
function splitScore(sections: string[], right: number, total: number): Record<string, SectionStat> {
  const out: Record<string, SectionStat> = {};
  const per = Math.floor(total / sections.length) || 1;
  let remainingTotal = total;
  let remainingRight = right;

  sections.forEach((name, i) => {
    const last = i === sections.length - 1;
    const t = last ? remainingTotal : Math.min(per, remainingTotal);
    // Earlier sections carry the correct answers, later ones carry the misses,
    // which is the usual shape and makes the weakest section meaningful.
    const r = Math.max(0, Math.min(t, last ? remainingRight : Math.min(remainingRight, t)));
    out[name] = { right: r, total: t };
    remainingTotal -= t;
    remainingRight -= r;
  });

  return out;
}

export function demoAttempts(now = Date.now()): Attempt[] {
  const attempts: Attempt[] = [];

  PLANS.forEach((plan, pi) => {
    plan.runs.forEach(([daysAgo, right], ri) => {
      const total = 5;
      // Spread the time of day so the heatmap does not sit on one hour.
      const at = now - daysAgo * DAY + (pi * 97 + ri * 41) * 60_000;
      attempts.push({
        id: `demo-${pi}-${ri}`,
        topicTitle: plan.title,
        subject: plan.subject,
        right,
        total,
        ratio: right / total,
        sectionStats: splitScore(plan.sections, right, total),
        createdAt: at,
      });
    });
  });

  return attempts.sort((a, b) => b.createdAt - a.createdAt);
}
