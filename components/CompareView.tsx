"use client";

import { since } from "@/lib/ledger";
import { compareAttempts, type CompareVerdict } from "@/lib/stats";
import type { Attempt } from "@/lib/types";

const TONE: Record<CompareVerdict, string> = {
  aced: "proved",
  improved: "proved",
  slipped: "missed",
  stuck: "shaky",
  new: "idle",
};

const LABEL: Record<CompareVerdict, string> = {
  aced: "Aced",
  improved: "Improved",
  slipped: "Slipped",
  stuck: "Stuck",
  new: "New",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

interface Props {
  attempts: Attempt[];
  topicTitle: string | null;
}

/**
 * Attempt against attempt on the same topic, section by section. This is the
 * panel that answers "what actually got better", which a single score cannot.
 */
export default function CompareView({ attempts, topicTitle }: Props) {
  const comparison = topicTitle ? compareAttempts(attempts, topicTitle) : null;

  if (!comparison) {
    return (
      <div className="pad">
        <div className="notice">
          <b>Nothing to compare yet</b>
          <span>
            Pick a topic in the tracker after you have answered it twice. Foolscap lines the two
            attempts up section by section and tells you what moved.
          </span>
        </div>
      </div>
    );
  }

  const { current, previous, rows, headline } = comparison;

  return (
    <div className="compare">
      <div className="compare-head">
        <div>
          <div className="compare-t">{comparison.topicTitle}</div>
          <div className="compare-s">
            {previous
              ? `${since(previous.createdAt)} against ${since(current.createdAt)}`
              : `One attempt, ${since(current.createdAt)}`}
          </div>
        </div>
        <div className="compare-scores">
          {previous && (
            <>
              <span className="compare-old">{pct(previous.ratio)}</span>
              <span className="compare-arrow" aria-hidden="true">
                &rarr;
              </span>
            </>
          )}
          <span className="compare-new">{pct(current.ratio)}</span>
        </div>
      </div>

      <p className="compare-line">{headline}</p>

      <div className="compare-rows">
        {rows.map((row) => (
          <div className="cmp" key={row.section}>
            <div className="cmp-top">
              <span className="cmp-name">{row.section}</span>
              <span className="pill" data-tone={TONE[row.verdict]}>
                {LABEL[row.verdict]}
              </span>
            </div>

            <div className="cmp-meter">
              {row.previous !== null && (
                <span className="cmp-prev" style={{ width: `${row.previous * 100}%` }} />
              )}
              <span className="cmp-cur" data-tone={TONE[row.verdict]} style={{ width: `${row.current * 100}%` }} />
            </div>

            <div className="cmp-foot">
              <span className="cmp-delta">
                {row.previous === null
                  ? pct(row.current)
                  : `${pct(row.previous)} to ${pct(row.current)}`}
              </span>
              <span className="cmp-advice">{row.advice}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
