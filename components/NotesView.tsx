"use client";

import { useMemo, useState } from "react";
import MindMap from "./MindMap";
import { highYieldCount, isHighYield, readingMinutes, totalPoints, wordCount } from "@/lib/reading";
import type { Depth, RevisionSheet } from "@/lib/types";

interface Props {
  sheet: RevisionSheet;
  depth?: Depth;
  isSample?: boolean;
  /** Drops the memorize and traps blocks, for the landing page showcase. */
  compact?: boolean;
  limitConcepts?: number;
  limitSections?: number;
}

export default function NotesView({
  sheet,
  depth = "quick",
  isSample = false,
  compact = false,
  limitConcepts,
  limitSections,
}: Props) {
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [asMap, setAsMap] = useState(false);

  const concepts = limitConcepts ? sheet.concepts.slice(0, limitConcepts) : sheet.concepts;
  const sections = limitSections ? sheet.sections.slice(0, limitSections) : sheet.sections;

  const stats = useMemo(
    () => ({
      minutes: readingMinutes(sheet),
      words: wordCount(sheet),
      high: highYieldCount(sheet),
      total: totalPoints(sheet),
      terms: sheet.concepts.map((c) => c.term),
    }),
    [sheet],
  );

  // Offering the filter when it would hide nothing, or nearly everything, is
  // a control that lies about what it does.
  const filterWorthOffering =
    !compact && stats.high > 0 && stats.high < stats.total && stats.total >= 4;

  return (
    <div className="notes">
      <div className="notes-head">
        <div className="badges">
          {sheet.subject && <span className="badge">{sheet.subject}</span>}
          <span className="badge">{depth === "thorough" ? "Thorough" : "Quick pass"}</span>
          {isSample && (
            <span className="badge" data-tone="sample">
              Sample
            </span>
          )}
        </div>
        <h3 className="notes-t">{sheet.title}</h3>
        <p className="notes-o">{sheet.overview}</p>

        {!compact && (
          <div className="notes-bar">
            <span className="notes-time">
              About {stats.minutes} {stats.minutes === 1 ? "minute" : "minutes"} to work through,{" "}
              {stats.words.toLocaleString()} words
            </span>

            {!asMap && filterWorthOffering && (
              <button
                className="chip"
                type="button"
                aria-pressed={highYieldOnly}
                onClick={() => setHighYieldOnly((v) => !v)}
                title="Points carrying a key term, a figure or a formula"
              >
                {highYieldOnly
                  ? `High yield only, ${stats.high} of ${stats.total}`
                  : "High yield only"}
              </button>
            )}

            <div className="seg notes-seg" role="group" aria-label="How to show the sheet">
              <button type="button" aria-pressed={!asMap} onClick={() => setAsMap(false)}>
                Sheet
              </button>
              <button type="button" aria-pressed={asMap} onClick={() => setAsMap(true)}>
                Map
              </button>
            </div>
          </div>
        )}
      </div>

      {asMap && !compact ? (
        <MindMap sheet={sheet} />
      ) : (
      <>
      {concepts.length > 0 && (
        <div className="block">
          <h4 className="block-h">Key terms</h4>
          <dl className="concepts">
            {concepts.map((c) => (
              <div className="concept" key={c.term}>
                <dt>{c.term}</dt>
                <dd>{c.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {sections.map((section) => {
        const points = highYieldOnly
          ? section.points.filter((p) => isHighYield(p, stats.terms))
          : section.points;

        // A section whose points are all connective tissue is dropped rather
        // than left as an empty heading.
        if (points.length === 0) return null;

        return (
          <div className="sec" key={section.heading}>
            <h4 className="sec-h">{section.heading}</h4>
            <ul className="pt-list">
              {points.map((point, i) => (
                <li className="pt" key={point}>
                  <span className="pt-n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {!compact && sheet.memorize.length > 0 && (
        <div className="block">
          <h4 className="block-h">Commit to memory</h4>
          <div className="memo-grid">
            {sheet.memorize.map((item) => (
              <div className="memo" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && sheet.traps.length > 0 && (
        <div className="block">
          <h4 className="block-h">Where marks get lost</h4>
          <div className="traps">
            {sheet.traps.map((item) => (
              <div className="trap" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
