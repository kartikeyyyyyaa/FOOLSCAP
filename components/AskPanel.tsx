"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LevelPicker from "./LevelPicker";
import type { Level } from "@/lib/prompt";
import type { AskResponse, AskTurn, RevisionSheet } from "@/lib/types";

interface Props {
  sheet: RevisionSheet;
  /** The extracted text, when there is one. Saved sheets reopen without it. */
  source: string;
  isSample: boolean;
}

/** Starters drawn from the sheet, so the first question is never a blank page. */
function openers(sheet: RevisionSheet): string[] {
  const out: string[] = [];
  const weakest = sheet.sections[sheet.sections.length - 1]?.heading;

  if (sheet.concepts[0]) out.push(`Explain ${sheet.concepts[0].term} in simpler words`);
  if (weakest) out.push(`Give me a worked example of ${weakest.toLowerCase()}`);
  if (sheet.traps[0]) out.push("Why do students lose marks on this topic?");
  out.push(`What would a five mark exam question on ${sheet.title.toLowerCase()} look like?`);

  return out.slice(0, 4);
}

export default function AskPanel({ sheet, source, isSample }: Props) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<Level>("plain");
  const endRef = useRef<HTMLDivElement | null>(null);

  // A new sheet is a new conversation. Carrying questions about deadlock into
  // a sheet about matrices would poison every answer that follows.
  useEffect(() => {
    setTurns([]);
    setDraft("");
  }, [sheet.title]);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setTurns((prev) => [...prev, { id, question: trimmed, result: null, error: null }]);
      setDraft("");
      setBusy(true);

      // Only settled turns are sent back, so a failed question does not become
      // context for the next one.
      const history = turns
        .filter((t) => t.result)
        .slice(-4)
        .map((t) => ({ question: t.question, answer: t.result!.answer }));

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, sheet, source, history, level }),
        });
        const payload: AskResponse = await res.json();

        setTurns((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  result: payload.result ?? null,
                  error: payload.result ? null : (payload.error ?? "That question could not be answered."),
                }
              : t,
          ),
        );
      } catch {
        setTurns((prev) =>
          prev.map((t) => (t.id === id ? { ...t, error: "The request did not reach the server." } : t)),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, sheet, source, turns, level],
  );

  return (
    <div className="ask">
      <div className="ask-intro">
        <h4 className="block-h">Ask about this topic</h4>
        <p className="ask-sub">
          Answered from your own material. Every answer names the sections it came from, and says so
          plainly when the answer is not in there.
          {isSample && " This is the sample sheet, so questions are answered against the sample."}
        </p>
        <LevelPicker value={level} onChange={setLevel} disabled={busy} />
      </div>

      {turns.length === 0 && (
        <div className="ask-starters">
          {openers(sheet).map((q) => (
            <button className="chip" key={q} type="button" onClick={() => void ask(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="ask-thread">
        {turns.map((turn) => (
          <div className="ask-turn" key={turn.id}>
            <p className="ask-q">{turn.question}</p>

            {turn.error ? (
              <div className="notice" data-tone="error">
                <b>That did not work</b>
                <span>{turn.error}</span>
              </div>
            ) : turn.result ? (
              <div className="ask-a">
                <div className="ask-src">
                  <span className="badge" data-tone={turn.result.grounded ? undefined : "sample"}>
                    {turn.result.grounded ? "From your material" : "Outside your material"}
                  </span>
                  {turn.result.sections.map((s) => (
                    <span className="ask-sec" key={s}>
                      {s}
                    </span>
                  ))}
                </div>

                <p className="ask-body">{turn.result.answer}</p>

                {turn.result.followUps.length > 0 && (
                  <div className="ask-next">
                    {turn.result.followUps.map((f) => (
                      <button className="chip" key={f} type="button" onClick={() => void ask(f)}>
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="ask-wait">
                <span className="pulse" />
                <span>Reading your sheet</span>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <input
          className="text ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask anything about this topic"
          aria-label="Your question"
          maxLength={600}
        />
        <button className="btn btn-fill" type="submit" disabled={busy || draft.trim().length < 3}>
          {busy ? "Thinking" : "Ask"}
        </button>
      </form>
    </div>
  );
}
