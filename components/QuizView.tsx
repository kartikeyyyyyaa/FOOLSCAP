"use client";

import DebriefCard from "./DebriefCard";
import QuizCard from "./QuizCard";
import type { RevisionSheet } from "@/lib/types";

interface Props {
  sheet: RevisionSheet;
  answers: Record<number, number>;
  onAnswer: (questionIndex: number, optionIndex: number) => void;
  onReset: () => void;
}

export default function QuizView({ sheet, answers, onAnswer, onReset }: Props) {
  const answered = Object.keys(answers).length;
  const correct = Object.entries(answers).filter(
    ([q, o]) => sheet.quiz[Number(q)]?.answerIndex === o,
  ).length;
  const complete = answered === sheet.quiz.length && sheet.quiz.length > 0;

  return (
    <div className="quiz">
      <div className="quiz-bar">
        <div className="score">
          Answered <b>{answered}</b> of <b>{sheet.quiz.length}</b>
          {answered > 0 && (
            <>
              , correct <b>{correct}</b>
            </>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onReset}>
          Start over
        </button>
      </div>

      {sheet.quiz.map((item, qi) => (
        <QuizCard
          key={item.question}
          item={item}
          index={qi}
          chosen={qi in answers ? answers[qi] : null}
          onChoose={(oi) => onAnswer(qi, oi)}
        />
      ))}

      {complete && <DebriefCard sheet={sheet} answers={answers} showSolid />}
    </div>
  );
}
