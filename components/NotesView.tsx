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
  const concepts = limitConcepts ? sheet.concepts.slice(0, limitConcepts) : sheet.concepts;
  const sections = limitSections ? sheet.sections.slice(0, limitSections) : sheet.sections;

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
      </div>

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

      {sections.map((section) => (
        <div className="sec" key={section.heading}>
          <h4 className="sec-h">{section.heading}</h4>
          <ul className="pt-list">
            {section.points.map((point, i) => (
              <li className="pt" key={point}>
                <span className="pt-n">{String(i + 1).padStart(2, "0")}</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

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
    </div>
  );
}
