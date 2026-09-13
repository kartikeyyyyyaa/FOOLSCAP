import DebriefCard from "@/components/DebriefCard";
import NavAuth from "@/components/NavAuth";
import ThemeToggle from "@/components/ThemeToggle";
import NotesView from "@/components/NotesView";
import ProgressShowcase from "@/components/ProgressShowcase";
import QuizCard from "@/components/QuizCard";
import Reviews from "@/components/Reviews";
import Workbench from "@/components/Workbench";
import { SAMPLE_SHEET } from "@/lib/sample";

/** A part-finished attempt, used to show what a real debrief looks like. */
const DEMO_ATTEMPT = { 0: 3, 1: 0, 2: 1, 3: 0, 4: 3 };

const RUNGS = [
  {
    n: "01",
    h: "Opened",
    p: "The file is in. This counts for nothing and the ledger says so.",
    tag: "No credit",
    live: true,
  },
  {
    n: "02",
    h: "Read",
    p: "You have been through the sheet. Still self-reported, still worth nothing.",
    tag: "No credit",
    live: true,
  },
  {
    n: "03",
    h: "Answered",
    p: "You scored 80 percent or better on questions written from that file. The topic enters the ledger.",
    tag: "Counts",
    live: true,
  },
  {
    n: "04",
    h: "Held",
    p: "You answered again 48 hours later and held the score. This is the one that predicts the exam.",
    tag: "Counts",
    live: true,
  },
  {
    n: "05",
    h: "Explained",
    p: "You write the answer in your own words and it gets marked against the source.",
    tag: "On the roadmap",
    live: false,
  },
];

const STEPS = [
  {
    h: "Drop the file",
    p: "A PDF, a deck, a handout or pasted text. It is read in your browser, not uploaded.",
  },
  {
    h: "Answer for it",
    p: "Questions written from your own material, with the reasoning shown the moment you commit.",
  },
  {
    h: "Come back when it says",
    p: "The ledger tells you what has slipped. You re-prove it, or it stays slipped.",
  },
];

const CREDITS = ["Prompt Wars 2026", "Google for Developers", "Hack2Skill", "Android Club, VIT Bhopal"];

export default function Page() {
  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="mesh" aria-hidden="true" />
        <div className="mesh-fade" aria-hidden="true" />

        <div className="wrap">
          <nav className="nav">
            <a className="logo" href="#top">
              <span className="logo-mark" aria-hidden="true" />
              <span className="logo-name">Foolscap</span>
            </a>
            <div className="nav-right">
              <div className="nav-links">
                <a href="#proof">Proof</a>
                <a href="#progress">Tracking</a>
                <a href="#tool">Try it</a>
                <a href="#engine">Engine</a>
              </div>
              <ThemeToggle />
              <NavAuth />
              <a className="btn btn-fill btn-sm" href="#tool">
                Try it free
              </a>
            </div>
          </nav>

          <div className="hero-grid" id="top">
            <div className="hero-copy">
              <h1 className="d1">
                Reading it is
                <br />
                not revising it.
              </h1>
              <p className="lead">
                Foolscap turns any lecture file into revision notes and a quiz, then keeps a ledger
                of what you have actually proved.
              </p>
              <div className="hero-cta">
                <a className="btn btn-fill" href="#tool">
                  Try it on your notes
                </a>
                <a className="btn btn-ghost" href="#proof">
                  See how proof works
                </a>
              </div>
            </div>

            <div className="float-card rise">
              <div className="float-head">
                <span className="float-title">Question 04 of 05</span>
                <span className="pill" data-tone="shaky">
                  Not proved yet
                </span>
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                <QuizCard item={SAMPLE_SHEET.quiz[3]} index={3} chosen={0} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- the sheet ---------------- */}
      <section className="band">
        <div className="wrap">
          <div className="band-head">
            <h2 className="d2">One file in. A sheet you can sit down with.</h2>
            <p className="lead">
              Not a summary. The four things you actually revise from, separated out: terms to
              define, the explanation itself, what has to be memorised word for word, and where
              people lose marks.
            </p>
          </div>

          <div className="showcase">
            <div className="showcase-strip">
              <span className="badge">{SAMPLE_SHEET.subject}</span>
              <span className="badge">Quick pass</span>
              <span className="mono-s">Generated from a 14 page lecture PDF</span>
            </div>
            <div className="showcase-body">
              <div className="showcase-left">
                <NotesView sheet={SAMPLE_SHEET} compact limitConcepts={4} limitSections={1} />
              </div>
              <div className="showcase-right">
                <div style={{ display: "grid", gap: 16 }}>
                  <div className="block">
                    <h4 className="block-h">Commit to memory</h4>
                    <div style={{ display: "grid", gap: 9 }}>
                      {SAMPLE_SHEET.memorize.slice(0, 3).map((m) => (
                        <div className="memo" key={m}>
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="block">
                    <h4 className="block-h">Where marks get lost</h4>
                    <div className="traps">
                      {SAMPLE_SHEET.traps.slice(0, 2).map((t) => (
                        <div className="trap" key={t}>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- proof ---------------- */}
      <section className="band band-soft" id="proof">
        <div className="wrap">
          <div className="band-head">
            <span className="eyebrow">The ledger</span>
            <h2 className="d2">A tick box is not proof.</h2>
            <p className="lead">
              Every study app lets you mark a topic done. Marking it done takes one click and proves
              nothing. Foolscap only moves a topic up when you answer for it, and it drops back down
              when you leave it alone.
            </p>
          </div>

          <div className="ladder">
            {RUNGS.map((r) => (
              <div className="rung" data-live={r.live ? "1" : "0"} key={r.n}>
                <div className="rung-top" />
                <span className="rung-n">{r.n}</span>
                <h3 className="rung-h">{r.h}</h3>
                <p className="rung-p">{r.p}</p>
                <span className="rung-tag">{r.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- debrief ---------------- */}
      <section className="band">
        <div className="wrap">
          <div className="split">
            <div className="split-copy">
              <h2 className="d2">It tells you why you missed.</h2>
              <p className="body">
                A score out of five is not feedback. When you get questions wrong, Foolscap looks at
                which part of the source each one came from, finds the section your mistakes cluster
                in, and sends you back to that section rather than to the whole document.
              </p>
              <p className="body">
                Miss a topic for long enough and it does not nag. It moves the topic back down the
                ladder, which is the honest thing to do, and puts it at the top of the ledger.
              </p>
            </div>

            <DebriefCard sheet={SAMPLE_SHEET} answers={DEMO_ATTEMPT} showSolid />
          </div>
        </div>
      </section>

      {/* ---------------- the tool ---------------- */}
      <section className="band band-warm" id="tool">
        <div className="wrap">
          <div className="band-head">
            <h2 className="d2">Try it on something you have to revise this week.</h2>
            <p className="lead">
              Drop in a lecture PDF, a slide deck, a handout, or paste your own rough notes. Nothing
              is uploaded anywhere: the file is read in this browser and only the text goes on.
            </p>
          </div>

          <Workbench />
        </div>
      </section>

      {/* ---------------- progress showcase ---------------- */}
      <section className="band" id="progress">
        <div className="wrap">
          <div className="band-head">
            <span className="eyebrow">Tracking</span>
            <h2 className="d2">Your revision, the way LeetCode shows your solving.</h2>
            <p className="lead">
              Every finished quiz marks a day and updates the topic it belongs to. Answer the same
              topic twice and the two attempts get lined up section by section, so you can see what
              moved instead of guessing.
            </p>
          </div>

          <ProgressShowcase />
        </div>
      </section>

      {/* ---------------- reviews ---------------- */}
      <section className="band band-soft">
        <div className="wrap">
          <Reviews />
        </div>
      </section>

      {/* ---------------- how ---------------- */}
      <section className="band">
        <div className="wrap">
          <div className="band-head">
            <h2 className="d2">Three things, then you are revising.</h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.h}>
                <h3 className="step-h">{s.h}</h3>
                <p className="step-p">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- engine ---------------- */}
      <section className="band band-soft" id="engine">
        <div className="wrap">
          <div className="engine">
            <span className="eyebrow">The engine</span>
            <h2 className="d3">The notes, the questions and the marking all run on Gemini.</h2>

            <span className="gemini-mark">
              <svg className="spark" viewBox="0 0 24 24" role="img" aria-label="Gemini">
                <defs>
                  <linearGradient id="gm" x1="0" y1="24" x2="24" y2="0">
                    <stop offset="0" stopColor="#4633E0" />
                    <stop offset="0.5" stopColor="#7161FF" />
                    <stop offset="1" stopColor="#94D6FF" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#gm)"
                  d="M12 0c.5 6.2 5.3 11 11.5 11.5v1C17.3 13 12.5 17.8 12 24h-1C10.5 17.8 5.7 13 -.5 12.5v-1C5.7 11 10.5 6.2 11 0h1z"
                />
              </svg>
              Built on Google Gemini
            </span>

            <p className="body" style={{ textAlign: "center" }}>
              Structured output is enforced at the schema level, so a question can never reach you
              without four options, a marked answer and a reason. Malformed items are dropped before
              render.
            </p>

            <div className="credits">
              {CREDITS.map((c) => (
                <span className="credit" key={c}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="wrap">
        <div className="foot">
          <p className="foot-note">
            Foolscap. Problem statement 01, AI-Powered Student Workspace. One flow, finished end to
            end.
          </p>
          <a className="btn btn-fill" href="#tool">
            Try it on your notes
          </a>
        </div>
      </footer>
    </>
  );
}
