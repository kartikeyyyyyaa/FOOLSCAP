# Foolscap

**Reading it is not revising it.**

Foolscap turns any lecture file into revision notes and a quiz, then keeps a ledger of what you have actually proved.

Built for **Prompt Wars 2026** (Google for Developers with Hack2Skill and Android Club, VIT Bhopal), problem statement 01, *AI-Powered Student Workspace*. Runs on **Google Gemini**.

---

## The idea

Every study app lets you mark a topic done. Marking it done takes one click and proves nothing, which is exactly why people walk into exams having "revised" everything and remembering none of it.

Foolscap replaces the tick box with a proof ladder. A topic only moves up when you answer questions written from your own material, and it drops back down when you leave it alone.

| Rung | What it takes | Counts |
| --- | --- | --- |
| Opened | The file is in | No |
| Read | You have been through the sheet | No |
| Answered | 80 percent or better on questions from that file | Yes |
| Held | Answered again 48 hours later, score held | Yes |
| Explained | Written in your own words, marked against the source | Roadmap |

The single flow stays tight: material in, notes and quiz out. Everything else is derived from what you answered.

## Against the brief

| Requirement | How it is met |
| --- | --- |
| Pick a single flow and finish it end-to-end | Upload, notes, quiz, debrief, tracking, export. No second flow, no half-built tabs. |
| Lecture PDF to revision notes | `lib/extract.ts` reads the file in the browser, `app/api/generate` turns the text into a structured sheet. |
| Uploaded material to auto-generated quiz | The same Gemini call returns 5 or 10 MCQs, each with a marked answer and a reason. |
| **Bonus:** multiple file formats | PDF, DOCX, PPTX, TXT and MD, plus a paste path that always works. |
| **Bonus:** export in a shareable format | Copy, or download a `.md` with notes, quiz and a separated answer key. |
| **Bonus:** light personalisation | A subject field steers terminology, and a depth control changes the brief and the token budget. |

## What makes it more than a notes generator

**One field does all the analytics.** Every question carries a `tests` value naming the exact section it examines. That single field powers three things with no extra model call:

- the **debrief**, which clusters your wrong answers and sends you back to one section rather than the whole document
- the **per-topic tracker**, which shows accuracy per section pooled across every attempt, and names the section you keep losing marks on
- the **attempt comparison**, which lines up your last two sittings on a topic section by section and labels each one aced, improved, slipped or stuck, with advice that differs per verdict

**The ledger decays.** An answered topic becomes "due to re-prove" after 48 hours. Answer it again and hold the score, and it becomes "Held", which is the checkpoint that actually predicts recall. A topic you never return to sinks, and the app says so instead of nagging.

**Activity heatmap with a snake.** A GitHub-style contribution grid of finished quizzes, drawn on canvas with a snake that eats the filled days. It reads correctly as a static grid under `prefers-reduced-motion`, which is also what the first paint shows.

**The sheet is not a summary.** It splits into the four things people actually revise from: terms to define, the explanation itself, what has to be memorised verbatim, and where marks get lost.

---

## Running it

```bash
cp .env.example .env.local   # then add your key
npm install
npm run dev
```

Open http://localhost:3000.

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash   # optional
```

`gemini-2.5-flash` is the default and is the right balance for this workload. Set `gemini-2.5-pro` for dense material at the cost of latency.

## Accounts and history (optional)

The app is fully usable with no database. Progress is kept in `localStorage` and the sign-in control stays hidden. That is deliberate: a demo must not die because a database is unreachable mid-presentation.

To add real accounts and cross-device history:

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor > New query**, paste `supabase/schema.sql`, and run it. It creates the `attempts` table, its indexes, and the row level security policies that make a student's history readable only by that student. Running it twice is safe.
3. Copy **Project settings > Data API > URL** and **Project settings > API keys > anon public** into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

The anon key is meant to be public. Row level security is what protects the rows, which is why step 2 is not optional.

Anything a student recorded before signing in is merged into their account on first sign-in, so trying the tool and then creating an account does not lose their history.

**Demo account.** The bottom of `supabase/schema.sql` seeds ten weeks of plausible revision history for a `demo@foolscap.app` user, so the heatmap, tracker and comparison have something to show on a fresh machine. Create that user in **Authentication > Users > Add user** first, confirm the email, then run the block. There is also a **Try the demo** button that loads the same illustrative history with no database at all.

## Deploying

Push to GitHub and import into Vercel. Set `GEMINI_API_KEY`, and the two Supabase variables if you are using them. The generate route declares `maxDuration = 60` because thorough mode on a long PDF can run past the default limit.

---

## How it is built

```
app/
  layout.tsx              fonts, metadata
  page.tsx                the landing page, server rendered
  globals.css             design tokens and component styles
  api/generate/route.ts   the one server route, Gemini
components/
  Workbench.tsx           client state, orchestration
  SourcePanel.tsx         upload, extraction, settings
  NotesView.tsx           the revision sheet
  QuizCard.tsx            one question, shared by the quiz and the hero
  QuizView.tsx            the quiz plus its debrief
  DebriefCard.tsx         where your mistakes cluster
  Heatmap.tsx             canvas activity grid with the snake
  TopicTracker.tsx        per-topic accuracy, trend and weakest section
  CompareView.tsx         attempt against attempt, section by section
  ProgressShowcase.tsx    the landing page version, on demo data
  AuthBar.tsx             sign in, sign up, demo toggle
  Reviews.tsx             illustrative feedback marquee
lib/
  extract.ts              PDF, DOCX, PPTX, text readers
  prompt.ts               prompt plus the Gemini response schema
  ledger.ts               proof ladder, decay, debrief maths
  stats.ts                attempts, topic stats, comparison, heatmap
  store.ts                Supabase or localStorage, with fallback
  supabase.ts             browser client, null when unconfigured
  useAuth.ts              session state
  demo.ts                 illustrative history
  markdown.ts             export
  sample.ts               worked example shown at rest
  types.ts
supabase/
  schema.sql              table, indexes, row level security, demo seed
```

**Extraction runs in the browser.** `pdfjs-dist`, `mammoth` and `jszip` are dynamically imported, so a student who only pastes text never downloads a PDF engine, and the original file never leaves the machine. Only extracted plain text is posted to the server.

**Structured output is enforced, not parsed.** The route passes `responseSchema` and `responseMimeType: "application/json"` to Gemini, so the model emits typed JSON directly. `sanitise()` then drops malformed questions and repairs any `tests` value that does not name a real section, so the analytics can never point somewhere the student cannot go.

**One attempt row is the source of truth.** The ledger, the heatmap, the topic tracker and the comparison are all derived from the same list of attempts, so there is no second state to keep in sync.

**The app opens in a working state.** `lib/sample.ts` carries a real Operating Systems revision sheet on deadlock, badged as a sample. The landing page renders its previews from that same data through the same components, so nothing on the page is a mockup.

### Design

The visual system is adapted from the Stripe analysis in [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md): white canvas, an atmospheric gradient mesh across the upper third, deep navy ink for all body copy, and exactly one filled indigo pill per band. Type is Manrope at weight 300 with tight negative tracking for display, IBM Plex Mono for data and labels. Radius rule: buttons are full pills, cards are 16px, inputs and chips are 8px.

### Honesty notes

- The reviews on the landing page are **illustrative** and labelled as such on the page. They are not real users and no user count is claimed anywhere.
- The demo history is clearly badged **Demo data** wherever it appears.

### Known limits

- Scanned PDFs with no text layer are rejected with a message pointing at the paste path. There is no OCR.
- Source text is capped at 60,000 characters. Longer documents are trimmed from the end.
- PPTX extraction reads slide body text, not speaker notes or text baked into images.
- Without Supabase the ledger is per browser and does not sync.

## Licence

MIT.
