import { HOLD_MS, PASS } from "./ledger";
import type { LedgerEntry } from "./types";

/**
 * The schedule the decay rule already implies.
 *
 * Nothing new is decided here. A topic passed at 80 percent is due again 48
 * hours later, a topic that failed is due now, and this file only sorts those
 * facts into days so the student sees a plan instead of a rule.
 */

export type Slot = "now" | "today" | "tomorrow" | "week" | "clear";

export interface PlanItem {
  title: string;
  subject: string;
  /** When it needs answering again. */
  dueAt: number;
  slot: Slot;
  /** Why it is in this slot, in the student's terms. */
  reason: string;
  ratio: number;
}

export interface PlanGroup {
  slot: Slot;
  label: string;
  items: PlanItem[];
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function buildPlan(ledger: LedgerEntry[], now = Date.now()): PlanItem[] {
  const today = startOfDay(now);

  return ledger
    .map((entry): PlanItem => {
      const passed = entry.ratio >= PASS;
      const dueAt = passed ? entry.at + HOLD_MS : now;

      let slot: Slot;
      let reason: string;

      if (!passed) {
        slot = "now";
        reason = `Answered ${Math.round(entry.ratio * 100)} percent. It has not been proved once yet.`;
      } else if (dueAt <= now) {
        slot = "now";
        reason = "Passed once, then left long enough that it no longer counts.";
      } else if (startOfDay(dueAt) === today) {
        slot = "today";
        reason = `Due back at ${new Date(dueAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
      } else if (startOfDay(dueAt) === today + DAY) {
        slot = "tomorrow";
        reason = "The 48 hours are up tomorrow. Answering it early does not count.";
      } else if (dueAt - now <= 7 * DAY) {
        slot = "week";
        reason = `Holds until ${new Date(dueAt).toLocaleDateString([], { weekday: "long" })}.`;
      } else {
        slot = "clear";
        reason = "Held. Nothing to do here for now.";
      }

      return { title: entry.title, subject: entry.subject, dueAt, slot, reason, ratio: entry.ratio };
    })
    .sort((a, b) => a.dueAt - b.dueAt || a.ratio - b.ratio);
}

const LABELS: Record<Slot, string> = {
  now: "Do now",
  today: "Later today",
  tomorrow: "Tomorrow",
  week: "This week",
  clear: "Holding",
};

const ORDER: Slot[] = ["now", "today", "tomorrow", "week", "clear"];

export function groupPlan(items: PlanItem[]): PlanGroup[] {
  return ORDER.map((slot) => ({
    slot,
    label: LABELS[slot],
    items: items.filter((i) => i.slot === slot),
  })).filter((g) => g.items.length > 0);
}

/** One line for the top of the plan, so the student knows where they stand. */
export function planSummary(items: PlanItem[]): string {
  const now = items.filter((i) => i.slot === "now").length;
  const soon = items.filter((i) => i.slot === "today" || i.slot === "tomorrow").length;

  if (items.length === 0) return "Finish a quiz and the schedule builds itself from the result.";
  if (now === 0 && soon === 0) return "Nothing is due. Every topic on your ledger is still holding.";
  if (now === 0) return `Nothing overdue. ${soon} ${soon === 1 ? "topic comes" : "topics come"} back up within a day.`;

  return `${now} ${now === 1 ? "topic needs" : "topics need"} answering now to stay on the ledger.`;
}
