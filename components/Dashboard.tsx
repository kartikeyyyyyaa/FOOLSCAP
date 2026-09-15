"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CompareView from "./CompareView";
import Heatmap from "./Heatmap";
import RevisionPlan from "./RevisionPlan";
import TopicTracker from "./TopicTracker";
import { HOLD_MS, PASS, since, standingCount } from "@/lib/ledger";
import { filenameFor, sheetToMarkdown } from "@/lib/markdown";
import { dayStreak, toLedger } from "@/lib/stats";
import { deleteSheet, listAttempts, listSheets } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import type { Attempt, SavedSheet } from "@/lib/types";

/** Handoff key the tool reads on mount when you reopen a saved sheet. */
const OPEN_KEY = "foolscap.open";

export default function Dashboard() {
  const auth = useAuth();

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [sheets, setSheets] = useState<SavedSheet[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.ready) return;
    let active = true;

    void Promise.all([listAttempts(auth.userId), listSheets(auth.userId)]).then(([a, s]) => {
      if (!active) return;
      setAttempts(a);
      setSheets(s);
      setPicked(a[0]?.topicTitle ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [auth.ready, auth.userId]);

  const ledger = useMemo(() => toLedger(attempts), [attempts]);
  const streak = useMemo(() => dayStreak(attempts), [attempts]);
  const standing = useMemo(() => standingCount(ledger), [ledger]);

  const due = useMemo(
    () => ledger.filter((e) => !e.held && e.ratio >= PASS && Date.now() - e.at >= HOLD_MS).length,
    [ledger],
  );

  const open = useCallback((saved: SavedSheet) => {
    try {
      window.sessionStorage.setItem(OPEN_KEY, JSON.stringify(saved));
    } catch {
      // If storage is blocked the tool simply opens on its sample instead.
    }
    window.location.href = "/#tool";
  }, []);

  const remove = useCallback(
    async (id: string) => {
      setSheets((current) => current.filter((s) => s.id !== id));
      await deleteSheet(auth.userId, id);
    },
    [auth.userId],
  );

  if (loading) {
    return (
      <div className="dash">
        <div className="sk sk-h" />
        <div className="tiles">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk" style={{ height: 108, borderRadius: 16 }} />
          ))}
        </div>
        <div className="sk" style={{ height: 160, borderRadius: 16 }} />
      </div>
    );
  }

  const empty = attempts.length === 0 && sheets.length === 0;

  return (
    <div className="dash">
      <header className="dash-head">
        <h1 className="dash-hi">Your ledger</h1>
        <p className="dash-sub">
          {auth.userId
            ? `Signed in as ${auth.email}. Everything here follows you between devices.`
            : "Kept on this device. Sign in from the header to carry it between devices."}
        </p>
      </header>

      <div className="tiles">
        <div className="tile">
          <span className="tile-n">{streak}</span>
          <span className="tile-l">{streak === 1 ? "Day streak" : "Day streak"}</span>
          <span className="tile-s">Consecutive days with a finished quiz.</span>
        </div>
        <div className="tile" data-tone="proved">
          <span className="tile-n">{standing}</span>
          <span className="tile-l">Topics standing</span>
          <span className="tile-s">Answered at {Math.round(PASS * 100)} percent or better, still inside the window.</span>
        </div>
        <div className="tile" data-tone={due > 0 ? "shaky" : undefined}>
          <span className="tile-n">{due}</span>
          <span className="tile-l">Due to re-prove</span>
          <span className="tile-s">Passed once, then left alone for more than 48 hours.</span>
        </div>
        <div className="tile">
          <span className="tile-n">{attempts.length}</span>
          <span className="tile-l">Quizzes answered</span>
          <span className="tile-s">Across {sheets.length} saved {sheets.length === 1 ? "sheet" : "sheets"}.</span>
        </div>
      </div>

      {empty ? (
        <div className="dash-empty">
          <b>Nothing on the ledger yet</b>
          <span>
            Generate a sheet from your own material and finish its quiz. Topics appear here with
            their accuracy per section, and the days you revised fill in the grid.
          </span>
          <a className="btn btn-fill btn-sm" href="/#tool">
            Make your first sheet
          </a>
        </div>
      ) : (
        <>
          <section className="panel-lite">
            <div className="panel-lite-head">
              <span className="panel-lite-t">What to revise next</span>
              <span className="mono-s">From the 48 hour rule</span>
            </div>
            <RevisionPlan ledger={ledger} sheets={sheets} onOpen={open} />
          </section>

          <section className="panel-lite">
            <div className="panel-lite-head">
              <span className="panel-lite-t">Revision activity</span>
              <span className="mono-s">Last 6 months</span>
            </div>
            <Heatmap attempts={attempts} />
          </section>

          <div className="dash-grid">
            <section className="panel-lite">
              <div className="panel-lite-head">
                <span className="panel-lite-t">Saved sheets</span>
                <span className="mono-s">{sheets.length} kept</span>
              </div>

              {sheets.length === 0 ? (
                <p className="body">
                  Sheets you generate from now on are kept here, so you can reopen one without
                  spending another Gemini call on it.
                </p>
              ) : (
                <div className="sheet-list">
                  {sheets.map((s) => (
                    <div className="sheet-row" key={s.id}>
                      <div>
                        <div className="sheet-t">{s.title}</div>
                        <div className="sheet-s">
                          {s.subject || "No subject set"} &middot; {s.sheet.quiz.length} questions
                          &middot; {since(s.createdAt)}
                        </div>
                      </div>
                      <div className="sheet-actions">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => open(s)}>
                          Open
                        </button>
                        <a
                          className="btn btn-ghost btn-sm"
                          href={`data:text/markdown;charset=utf-8,${encodeURIComponent(sheetToMarkdown(s.sheet))}`}
                          download={filenameFor(s.sheet)}
                        >
                          .md
                        </a>
                        <button
                          className="btn-text"
                          type="button"
                          onClick={() => void remove(s.id)}
                          aria-label={`Delete ${s.title}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel-lite">
              <div className="panel-lite-head">
                <span className="panel-lite-t">Topics</span>
                <span className="mono-s">Accuracy by section</span>
              </div>
              <TopicTracker attempts={attempts} onPick={setPicked} selected={picked} />
            </section>
          </div>

          <section className="panel-lite">
            <div className="panel-lite-head">
              <span className="panel-lite-t">Attempt against attempt</span>
              <span className="mono-s">Pick a topic above</span>
            </div>
            <CompareView attempts={attempts} topicTitle={picked} />
          </section>
        </>
      )}
    </div>
  );
}
