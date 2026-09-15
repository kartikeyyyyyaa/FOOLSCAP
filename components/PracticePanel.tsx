"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BLANK,
  MASTERED_BOX,
  buildCards,
  buildCloze,
  gradeCard,
  isClozeRight,
  loadCardState,
  masteredCount,
  orderCards,
  saveCardState,
  type CardState,
} from "@/lib/drill";
import type { RevisionSheet } from "@/lib/types";

type Mode = "cards" | "cloze";

interface Props {
  sheet: RevisionSheet;
}

export default function PracticePanel({ sheet }: Props) {
  const [mode, setMode] = useState<Mode>("cards");

  return (
    <div className="practice">
      <div className="practice-head">
        <div>
          <h4 className="block-h">Practice</h4>
          <p className="ask-sub">
            Both of these are built from the sheet you already have. Nothing here was written
            separately, so a card can only ask you something your own material answers.
          </p>
        </div>

        <div className="seg practice-seg" role="group" aria-label="Practice mode">
          <button type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>
            Flashcards
          </button>
          <button type="button" aria-pressed={mode === "cloze"} onClick={() => setMode("cloze")}>
            Fill the blanks
          </button>
        </div>
      </div>

      {mode === "cards" ? <Cards sheet={sheet} /> : <Cloze sheet={sheet} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Flashcards
 * ------------------------------------------------------------------ */

function Cards({ sheet }: Props) {
  const cards = useMemo(() => buildCards(sheet), [sheet]);

  const [state, setState] = useState<CardState>({});
  const [order, setOrder] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);

  // Mastery lives in localStorage, which does not exist during server render.
  useEffect(() => {
    const loaded = loadCardState();
    setState(loaded);
    setOrder(orderCards(cards, loaded).map((c) => c.id));
    setI(0);
    setShown(false);
  }, [cards]);

  const deck = useMemo(
    () => order.map((id) => cards.find((c) => c.id === id)).filter((c) => c !== undefined),
    [order, cards],
  );

  const card = deck[i];
  const mastered = masteredCount(cards, state);

  const grade = useCallback(
    (got: boolean) => {
      if (!card) return;
      const next = gradeCard(state, card.id, got);
      setState(next);
      saveCardState(next);
      setShown(false);
      setI((n) => (n + 1) % Math.max(deck.length, 1));
    },
    [card, state, deck.length],
  );

  if (!card) {
    return (
      <div className="dash-empty">
        <b>No cards yet</b>
        <span>Generate a sheet and its key terms become a deck.</span>
      </div>
    );
  }

  const box = state[card.id]?.box ?? 0;

  return (
    <div className="cards">
      <div className="cards-meta">
        <span className="reel-count">
          {String(i + 1).padStart(2, "0")} / {String(deck.length).padStart(2, "0")}
        </span>
        <span className="cards-mastered">
          {mastered} of {cards.length} mastered
        </span>
        <span className="cards-box" title="Three correct in a row marks a card mastered">
          {Array.from({ length: MASTERED_BOX }, (_, n) => (
            <span key={n} className="pip" data-on={n < box ? "true" : "false"} />
          ))}
        </span>
      </div>

      <button
        className="card-face"
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-expanded={shown}
      >
        <span className="card-kind">{card.kind === "term" ? "Define" : "State it exactly"}</span>
        <span className="card-front">{card.front}</span>
        {shown ? (
          <span className="card-back">{card.back}</span>
        ) : (
          <span className="card-hint">Click to reveal</span>
        )}
      </button>

      <div className="cards-controls">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => grade(false)}>
          Missed it
        </button>
        <button className="btn btn-fill btn-sm" type="button" onClick={() => grade(true)}>
          Knew it
        </button>
        <span className="reel-spacer" />
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShown((s) => !s)}>
          {shown ? "Hide" : "Reveal"}
        </button>
      </div>

      <p className="reel-note">
        You mark yourself here, so this rung does not count as proof. The quiz is what moves a topic
        up the ladder.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cloze
 * ------------------------------------------------------------------ */

function Cloze({ sheet }: Props) {
  const items = useMemo(() => buildCloze(sheet), [sheet]);

  const [i, setI] = useState(0);
  const [given, setGiven] = useState("");
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setI(0);
    setGiven("");
    setVerdict(null);
    setRight(0);
    setDone(false);
  }, [items]);

  const item = items[i];

  const check = useCallback(() => {
    if (!item || verdict) return;
    const ok = isClozeRight(given, item.answer);
    setVerdict(ok ? "right" : "wrong");
    if (ok) setRight((n) => n + 1);
  }, [item, given, verdict]);

  const next = useCallback(() => {
    setGiven("");
    setVerdict(null);
    if (i + 1 < items.length) setI(i + 1);
    else setDone(true);
  }, [i, items.length]);

  if (items.length === 0) {
    return (
      <div className="dash-empty">
        <b>Nothing worth blanking</b>
        <span>
          This sheet has no lines with a key term, figure or formula in them, so a fill-in drill
          would only be hiding filler words.
        </span>
      </div>
    );
  }

  if (done) {
    return (
      <div className="cloze-done">
        <b>
          {right} of {items.length} filled in
        </b>
        <span>
          {right === items.length
            ? "Every blank correct. This is the rung where rereading stops helping and writing it out starts."
            : "The ones you missed are the lines to write out by hand before the exam."}
        </span>
        <button
          className="btn btn-fill btn-sm"
          type="button"
          onClick={() => {
            setI(0);
            setRight(0);
            setDone(false);
          }}
        >
          Run it again
        </button>
      </div>
    );
  }

  const [before, after] = item.text.split(BLANK);

  return (
    <div className="cloze">
      <div className="cards-meta">
        <span className="reel-count">
          {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
        </span>
        <span className="ask-sec">{item.tests}</span>
      </div>

      <p className="cloze-line">
        {before}
        <span className="cloze-slot" data-state={verdict ?? "open"}>
          {verdict ? item.answer : BLANK}
        </span>
        {after}
      </p>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (verdict) next();
          else check();
        }}
      >
        <input
          className="text"
          value={given}
          onChange={(e) => setGiven(e.target.value)}
          placeholder="Type the missing word"
          aria-label="The missing word"
          disabled={verdict !== null}
        />
        <button className="btn btn-fill" type="submit">
          {verdict ? "Next" : "Check"}
        </button>
      </form>

      {verdict && (
        <div className="notice" data-tone={verdict === "right" ? "ok" : "error"}>
          <b>{verdict === "right" ? "Right" : `It was "${item.answer}"`}</b>
          <span>
            {verdict === "right"
              ? "Close spelling counts. Getting the concept is the point."
              : `From ${item.tests.toLowerCase()}. Go back to that section rather than the whole sheet.`}
          </span>
        </div>
      )}
    </div>
  );
}
