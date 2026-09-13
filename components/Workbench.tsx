"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthBar from "./AuthBar";
import CompareView from "./CompareView";
import Heatmap from "./Heatmap";
import NotesView from "./NotesView";
import QuizView from "./QuizView";
import SourcePanel from "./SourcePanel";
import TopicTracker from "./TopicTracker";
import { demoAttempts } from "@/lib/demo";
import { filenameFor, sheetToMarkdown } from "@/lib/markdown";
import { SAMPLE_SHEET } from "@/lib/sample";
import { dayStreak, toAttempt } from "@/lib/stats";
import { clearAttempts, listAttempts, mergeLocalInto, saveAttempt, saveLocal, saveSheet } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import type { Attempt, Depth, GenerateResponse, RevisionSheet } from "@/lib/types";

type View = "notes" | "quiz" | "progress";

const STAGES = [
  "Reading the material",
  "Picking out what is examinable",
  "Writing the sheet and the questions",
];

export default function Workbench() {
  const auth = useAuth();

  const [source, setSource] = useState("");
  const [subject, setSubject] = useState("");
  const [depth, setDepth] = useState<Depth>("quick");
  const [count, setCount] = useState(5);

  const [sheet, setSheet] = useState<RevisionSheet>(SAMPLE_SHEET);
  const [isSample, setIsSample] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [demo, setDemo] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const [view, setView] = useState<View>("notes");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load history once auth has settled. Reads happen after mount because
  // localStorage does not exist during server rendering.
  useEffect(() => {
    if (!auth.ready || demo) return;
    let active = true;
    void listAttempts(auth.userId).then((rows) => {
      if (active) setAttempts(rows);
    });
    return () => {
      active = false;
    };
  }, [auth.ready, auth.userId, demo]);

  // Carry anything recorded before sign-in into the new account.
  useEffect(() => {
    if (auth.userId) void mergeLocalInto(auth.userId);
  }, [auth.userId]);

  const markdown = useMemo(() => sheetToMarkdown(sheet), [sheet]);
  const downloadHref = useMemo(
    () => `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`,
    [markdown],
  );

  const streak = useMemo(() => dayStreak(attempts), [attempts]);

  const answer = useCallback(
    (qi: number, oi: number) => {
      setAnswers((prev) => {
        if (qi in prev) return prev;
        const next = { ...prev, [qi]: oi };

        if (Object.keys(next).length === sheet.quiz.length && !isSample && !demo) {
          const attempt = toAttempt(sheet, next);
          setAttempts((current) => [attempt, ...current]);
          setPicked(attempt.topicTitle);
          void saveAttempt(auth.userId, attempt);
        }
        return next;
      });
    },
    [sheet, isSample, demo, auth.userId],
  );

  const generate = useCallback(async () => {
    if (busy) return;

    if ((source.match(/\S+/g) ?? []).length < 40) {
      setError(
        "There is not enough text to revise from yet. Add a lecture file, or paste at least a few paragraphs.",
      );
      setView("notes");
      return;
    }

    setBusy(true);
    setError(null);
    setStage(0);
    setView("notes");

    const ticker = window.setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 8000);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, subject, depth, count }),
      });
      const payload: GenerateResponse = await res.json();

      if (!res.ok || !payload.sheet) {
        setError(payload.error ?? "The sheet could not be generated. Try again.");
        return;
      }

      setSheet(payload.sheet);
      setIsSample(false);
      setAnswers({});
      void saveSheet(auth.userId, payload.sheet, depth);
    } catch {
      setError("The request did not reach the server. Check that the dev server is running, then try again.");
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
    }
  }, [busy, source, subject, depth, count, auth.userId]);

  // Reopening a saved sheet from the dashboard hands it over through
  // sessionStorage rather than refetching or regenerating it.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("foolscap.open");
      if (!raw) return;
      window.sessionStorage.removeItem("foolscap.open");
      const saved = JSON.parse(raw) as { sheet?: RevisionSheet; depth?: Depth };
      if (!saved?.sheet?.title || !Array.isArray(saved.sheet.quiz)) return;
      setSheet(saved.sheet);
      setDepth(saved.depth === "thorough" ? "thorough" : "quick");
      setIsSample(false);
      setAnswers({});
    } catch {
      // A blocked or malformed handoff just leaves the sample in place.
    }
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [markdown]);

  const toggleDemo = useCallback(() => {
    if (demo) {
      setDemo(false);
      setAttempts([]);
      setPicked(null);
      void listAttempts(auth.userId).then(setAttempts);
      return;
    }
    const rows = demoAttempts();
    setDemo(true);
    setAttempts(rows);
    setPicked(rows[0]?.topicTitle ?? null);
    setView("progress");
  }, [demo, auth.userId]);

  const wipe = useCallback(() => {
    setAttempts([]);
    setPicked(null);
    if (demo) {
      setDemo(false);
      return;
    }
    saveLocal([]);
    void clearAttempts(auth.userId);
  }, [demo, auth.userId]);

  const tab = (id: View, label: string, badge?: number) => (
    <button
      className="tab"
      role="tab"
      type="button"
      aria-selected={view === id}
      onClick={() => setView(id)}
    >
      {label}
      {badge !== undefined && <span className="tab-c">{badge}</span>}
    </button>
  );

  return (
    <div className="tool">
      <SourcePanel
        subject={subject}
        depth={depth}
        count={count}
        busy={busy}
        onSource={setSource}
        onSubject={setSubject}
        onDepth={setDepth}
        onCount={setCount}
        onGenerate={generate}
      />

      <section className="card" aria-labelledby="outH">
        <div className="card-head">
          <h3 className="sr" id="outH">
            Generated revision material
          </h3>

          <div className="tabs" role="tablist" aria-label="Output view">
            {tab("notes", "Notes")}
            {tab("quiz", "Quiz", sheet.quiz.length)}
            {tab("progress", "Progress", attempts.length)}
          </div>

          <div className="tools">
            <button className="btn btn-ghost btn-sm" type="button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
            <a className="btn btn-ghost btn-sm" href={downloadHref} download={filenameFor(sheet)}>
              Download .md
            </a>
          </div>
        </div>

        {busy ? (
          <LoadingPanel message={STAGES[stage]} />
        ) : error ? (
          <div className="pad">
            <div className="notice" data-tone="error">
              <b>That did not work</b>
              <span>{error}</span>
            </div>
          </div>
        ) : view === "notes" ? (
          <NotesView sheet={sheet} depth={depth} isSample={isSample} />
        ) : view === "quiz" ? (
          <QuizView sheet={sheet} answers={answers} onAnswer={answer} onReset={() => setAnswers({})} />
        ) : (
          <div className="progress">
            <AuthBar
              configured={auth.configured}
              userId={auth.userId}
              email={auth.email}
              demo={demo}
              onSignIn={auth.signIn}
              onSignUp={auth.signUp}
              onSignOut={auth.signOut}
              onDemo={toggleDemo}
            />

            <div className="prog-head">
              <div className="streak">
                <span className="streak-n">{streak}</span>
                <span className="streak-l">
                  {streak === 1 ? "day streak" : "day streak"}, {attempts.length}{" "}
                  {attempts.length === 1 ? "quiz answered" : "quizzes answered"}
                </span>
              </div>
              {attempts.length > 0 && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={wipe}>
                  {demo ? "Clear demo" : "Clear history"}
                </button>
              )}
            </div>

            <Heatmap attempts={attempts} />

            <div className="prog-section">
              <h4 className="block-h">Topics</h4>
              <TopicTracker attempts={attempts} onPick={setPicked} selected={picked} />
            </div>

            <div className="prog-section">
              <h4 className="block-h">Attempt against attempt</h4>
              <CompareView attempts={attempts} topicTitle={picked} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Skeleton shaped like the notes it stands in for, not a spinner. */
function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="loading-wrap">
      <div className="loading-status">
        <span className="pulse" />
        <span>{message}</span>
      </div>
      <div className="sk sk-h" />
      <div style={{ display: "grid", gap: 9 }}>
        {[96, 89, 82, 74, 66].map((w) => (
          <div key={w} className="sk sk-row" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk" style={{ height: 62 }} />
        ))}
      </div>
    </div>
  );
}
