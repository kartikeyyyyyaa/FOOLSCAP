"use client";

import { rungFor, since } from "@/lib/ledger";
import { toLedger, topicStats } from "@/lib/stats";
import type { Attempt } from "@/lib/types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Small trend line. Endpoint is marked because it is the score that counts. */
function Spark({ values }: { values: number[] }) {
  const w = 76;
  const h = 24;
  const pad = 3;

  if (values.length < 2) {
    return (
      <svg className="spark-line" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="One attempt so far">
        <circle cx={w - pad} cy={h - pad - (values[0] ?? 0) * (h - pad * 2)} r="3" fill="#4633E0" />
      </svg>
    );
  }

  const step = (w - pad * 2) / (values.length - 1);
  const points = values
    .map((v, i) => `${pad + i * step},${h - pad - v * (h - pad * 2)}`)
    .join(" ");
  const lastX = pad + (values.length - 1) * step;
  const lastY = h - pad - values[values.length - 1] * (h - pad * 2);

  return (
    <svg className="spark-line" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Trend across ${values.length} attempts`}>
      <polyline points={points} fill="none" stroke="#B4AAF6" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="#4633E0" />
    </svg>
  );
}

interface Props {
  attempts: Attempt[];
  onPick?: (topicTitle: string) => void;
  selected?: string | null;
}

export default function TopicTracker({ attempts, onPick, selected }: Props) {
  const stats = topicStats(attempts);
  const rungs = new Map(toLedger(attempts).map((e) => [e.title, rungFor(e)]));

  if (stats.length === 0) {
    return (
      <div className="pad">
        <div className="notice">
          <b>No topics tracked yet</b>
          <span>
            Finish a quiz and the topic appears here with its accuracy per section, its trend across
            attempts, and the section you keep losing marks on.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker">
      {stats.map((t) => {
        const sections = Object.entries(t.sections).sort(
          (a, b) => a[1].right / a[1].total - b[1].right / b[1].total,
        );
        const move = t.latest - t.first;

        return (
          <button
            className="topic"
            type="button"
            key={t.title}
            aria-pressed={selected === t.title}
            onClick={() => onPick?.(t.title)}
          >
            <div className="topic-head">
              <div>
                <div className="topic-t">
                  {t.title}
                  {rungs.has(t.title) && (
                    <span className="pill" data-tone={rungs.get(t.title)!.tone}>
                      {rungs.get(t.title)!.name}
                    </span>
                  )}
                </div>
                <div className="topic-s">
                  {t.subject || "No subject set"} &middot; {t.attempts}{" "}
                  {t.attempts === 1 ? "attempt" : "attempts"} &middot; {since(t.lastAt)}
                </div>
              </div>
              <div className="topic-nums">
                <Spark values={t.trend} />
                <div className="topic-score">
                  <span className="topic-latest">{pct(t.latest)}</span>
                  {t.attempts > 1 && (
                    <span className={`topic-move${move >= 0 ? "" : " is-down"}`}>
                      {move >= 0 ? "+" : ""}
                      {Math.round(move * 100)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bars">
              {sections.map(([name, s]) => {
                const ratio = s.total ? s.right / s.total : 0;
                const tone = ratio === 1 ? "proved" : ratio >= 0.5 ? "shaky" : "missed";
                return (
                  <div className="bar-row" key={name}>
                    <span className="bar-name">{name}</span>
                    <span className="bar-track">
                      <span className="bar-fill" data-tone={tone} style={{ width: `${ratio * 100}%` }} />
                    </span>
                    <span className="bar-num">
                      {s.right}/{s.total}
                    </span>
                  </div>
                );
              })}
            </div>

            {t.weakestSection && t.latest < 1 && (
              <p className="topic-note">
                Weakest across all attempts: <b>{t.weakestSection}</b>
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
