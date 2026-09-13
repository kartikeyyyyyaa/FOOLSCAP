"use client";

import { OPTION_KEYS } from "@/lib/markdown";
import type { QuizItem } from "@/lib/types";

interface Props {
  item: QuizItem;
  index: number;
  chosen: number | null;
  onChoose?: (optionIndex: number) => void;
}

/**
 * One question. Shared by the quiz panel and the landing page hero, so the
 * page never shows a mocked-up version of a component that exists for real.
 */
export default function QuizCard({ item, index, chosen, onChoose }: Props) {
  const done = chosen !== null;
  const isRight = chosen === item.answerIndex;

  return (
    <div className="q">
      <div className="q-head">
        <span className="q-n">{String(index + 1).padStart(2, "0")}</span>
        <p className="q-t">{item.question}</p>
      </div>

      <div className="opts">
        {item.options.map((opt, oi) => {
          let stateAttr: string | undefined;
          if (done) {
            if (oi === item.answerIndex) stateAttr = "correct";
            else if (oi === chosen) stateAttr = "wrong";
          }
          return (
            <button
              className="opt"
              type="button"
              key={opt}
              disabled={done}
              data-state={stateAttr}
              onClick={() => onChoose?.(oi)}
            >
              <span className="opt-k">{OPTION_KEYS[oi]}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {done && (
        <div className="verdict" data-tone={isRight ? "correct" : "wrong"}>
          <span className="verdict-k">{isRight ? "Correct" : "Not quite"}</span>
          <span>{item.explanation}</span>
        </div>
      )}
    </div>
  );
}
