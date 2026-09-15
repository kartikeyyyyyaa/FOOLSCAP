"use client";

import { useMemo } from "react";
import { buildPlan, groupPlan, planSummary } from "@/lib/plan";
import type { LedgerEntry, SavedSheet } from "@/lib/types";

interface Props {
  ledger: LedgerEntry[];
  /** Used to offer a direct reopen when the sheet is still saved. */
  sheets?: SavedSheet[];
  onOpen?: (sheet: SavedSheet) => void;
}

export default function RevisionPlan({ ledger, sheets = [], onOpen }: Props) {
  const items = useMemo(() => buildPlan(ledger), [ledger]);
  const groups = useMemo(() => groupPlan(items), [items]);
  const summary = useMemo(() => planSummary(items), [items]);

  return (
    <div className="plan">
      <p className="plan-sum">{summary}</p>

      {groups.map((group) => (
        <div className="plan-group" key={group.slot}>
          <div className="plan-label" data-slot={group.slot}>
            <span>{group.label}</span>
            <span className="mono-s">{group.items.length}</span>
          </div>

          <ul className="plan-list">
            {group.items.map((item) => {
              const saved = sheets.find((s) => s.title === item.title);

              return (
                <li className="plan-row" key={`${item.title}-${item.dueAt}`}>
                  <div className="plan-main">
                    <span className="plan-t">{item.title}</span>
                    <span className="plan-r">{item.reason}</span>
                  </div>

                  {saved && onOpen ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => onOpen(saved)}
                    >
                      Open
                    </button>
                  ) : (
                    <span className="mono-s">{Math.round(item.ratio * 100)}%</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {items.length > 0 && (
        <p className="reel-note">
          This is the 48 hour rule written out as days. Nothing here was scheduled by hand, and
          answering a topic early does not move it up the ladder.
        </p>
      )}
    </div>
  );
}
