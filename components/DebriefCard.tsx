import { PASS, buildDebrief } from "@/lib/ledger";
import type { RevisionSheet } from "@/lib/types";

interface Props {
  sheet: RevisionSheet;
  answers: Record<number, number>;
  /** Show the sections answered cleanly, not only the gaps. */
  showSolid?: boolean;
}

export default function DebriefCard({ sheet, answers, showSolid = false }: Props) {
  const d = buildDebrief(sheet, answers);
  const pct = d.answered ? Math.round(d.ratio * 100) : 0;
  const complete = d.answered === d.total && d.total > 0;

  return (
    <div className="debrief">
      <div className="debrief-head">
        <span className="t">Debrief</span>
        <span className="s">
          {d.right} of {d.answered} correct{d.answered > 0 && ` · ${pct}%`}
        </span>
      </div>

      <div className="debrief-body">
        <p className="verdict-line">{d.line}</p>

        {d.gaps.map((gap) => (
          <div className="gap-row" key={gap.name}>
            <div>
              <div className="gap-name">{gap.name}</div>
              <div className="gap-sub">
                {gap.n} {gap.n === 1 ? "question" : "questions"} missed here. Go back to this section.
              </div>
            </div>
            <span className="pill" data-tone="missed">
              Weak
            </span>
          </div>
        ))}

        {showSolid &&
          d.gaps.length === 0 &&
          d.answered > 0 &&
          sheet.sections.slice(0, 2).map((s) => (
            <div className="gap-row" key={s.heading}>
              <div>
                <div className="gap-name">{s.heading}</div>
                <div className="gap-sub">Answered without a miss.</div>
              </div>
              <span className="pill" data-tone="proved">
                Solid
              </span>
            </div>
          ))}

        {complete && (
          <div className="gap-row">
            <div>
              <div className="gap-name">Next checkpoint</div>
              <div className="gap-sub">
                Re-answer in 48 hours to move this from Answered to Held.
              </div>
            </div>
            <span className="pill" data-tone={d.ratio >= PASS ? "proved" : "idle"}>
              {d.ratio >= PASS ? "In the ledger" : "Not yet"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
