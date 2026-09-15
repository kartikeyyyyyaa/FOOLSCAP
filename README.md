# Foolscap

### Reading it is not revising it.

Foolscap turns any lecture file into revision notes and a quiz, then keeps a ledger of what you have actually proved.

**Live:** [foolscap-ac.vercel.app](https://foolscap-ac.vercel.app)

Built for **Prompt Wars 2026** (Google for Developers with Hack2Skill and Android Club, VIT Bhopal), problem statement 01, *AI-Powered Student Workspace*. Runs on **Google Gemini**.

---

## The problem with every study app

Every study app lets you mark a topic done. Marking it done takes one click and proves nothing.

That is why people walk into exams having "revised" everything and remembering none of it. The tick box measures intention, not recall, and intention is the thing students already have plenty of.

Foolscap replaces the tick box with a proof ladder. A topic only moves up when you answer questions written from your own material, and it drops back down when you leave it alone.

| Rung | What it takes | Counts |
| --- | --- | --- |
| Opened | The file is in | No |
| Read | You have been through the sheet | No |
| Answered | 80 percent or better on questions from that file | Yes |
| Held | Answered again 48 hours later, score held | Yes |
| Explained | Written in your own words, marked against the source | Roadmap |

"Held" is the rung that matters. Answering once measures whether you just read something. Answering again two days later measures whether you know it.

---

## What it does

**One file in.** Drop a lecture PDF, a slide deck, a Word handout, a text file, or paste your own notes. Extraction runs in your browser, so the file itself never leaves your machine. Only the plain text is sent on.

**A sheet you can sit down with.** Not a summary. It splits into the four things people actually revise from: terms you must be able to define, the explanation itself broken into revisable points, what has to be memorised word for word, and where marks get lost on this specific topic.

**A quiz written from your material.** Five or ten multiple-choice questions, each with a marked answer and the reasoning shown the moment you commit. Wrong options are drawn from real confusions in the topic, not filler.

**A debrief that names the section.** A score out of five is not feedback. Foolscap groups your wrong answers by which part of the source they came from and sends you back to that one section rather than the whole document.

**Flashcards and fill-in-the-blanks, for free.** The key terms become a deck with Leitner mastery, and the lines that have to be known verbatim become cloze drills with the key term blanked out. Both are derived from the sheet on the client, so they cost no second model call and cannot ask you something your own material does not answer.

**A map, not just a list.** The same sheet drawn as a mind map, each branch a section heading with its most examinable points under it.

**A question about it, answered from it.** Ask anything about the topic and the answer comes back with the section headings it drew on. When your material does not cover the question, the answer says so in its first sentence and is badged as coming from outside your material, because a student revising needs to know which of those two things just happened.

**One switch for how it is explained.** Simple, exam answer, cram or one line, applied to both the answers and the explainer. It changes the delivery, never the facts.

**An explanation you can listen to.** Gemini writes a short spoken explainer from the same sheet, one idea per scene, and your browser narrates it with captions. There is no video file to fetch and no second API key. There is also a link out to a real YouTube search, built from a query Gemini wrote, for when you want a human lecture instead.

**A photograph works too.** Snap the board or a page of your own handwriting. The image is sized down in the browser, which also strips its EXIF, and Gemini reads it directly. Nothing is guessed: a word that cannot be read is left out rather than invented.

**A plan, not just a rule.** The 48 hour decay is written out as a schedule of what to answer now, later today, tomorrow and this week. Nothing on it was scheduled by hand.

**A ledger that decays.** Answered topics become "due to re-prove" after 48 hours. The dashboard shows your streak, your topics standing, what has slipped, and a GitHub-style activity grid of every day you actually revised.

**Attempt against attempt.** Answer the same topic twice and the two sittings are lined up section by section, each one labelled aced, improved, slipped or stuck, with different advice per verdict. "Stuck" tells you rereading is not working and to write the answer out instead.

---

## The idea worth stealing

Every generated question carries a `tests` field naming the exact section heading it examines:

```ts
{
  question: "With multiple instances of each resource type, a cycle in the graph means:",
  options: [...],
  answerIndex: 1,
  tests: "Detection, and why it differs",   // <- this one field
  explanation: "..."
}
```

That single field does the work of three separate features, all computed on the client, all for free:

- the **debrief** groups wrong answers by `tests` to find the section your mistakes cluster in
- the **topic tracker** pools accuracy per section across every attempt and names your weakest one
- the **comparison** diffs two attempts section by section

No second model call, no embeddings, no vector store. One generation request produces the sheet, the quiz, and the entire analytics layer.

The server also repairs it: if the model returns a `tests` value that does not match a real section heading, `sanitise()` snaps it to the first real section, so the debrief can never point somewhere the student cannot go.

---

## Against the brief

| Requirement | How it is met |
| --- | --- |
| Pick a single flow and finish it end-to-end | Upload, notes, quiz, debrief, tracking, export. No second flow, no half-built tabs. |
| Lecture PDF to revision notes | `lib/extract.ts` reads the file in the browser, `app/api/generate` turns the text into a structured sheet. |
| Uploaded material to auto-generated quiz | The same Gemini call returns 5 or 10 MCQs, each with a marked answer and a reason. |
| **Bonus:** multiple file formats | PDF, DOCX, PPTX, TXT and MD, plus a paste path that always works. |
| **Bonus:** export in a shareable format | Copy, or download a `.md` with notes, quiz and a separated answer key. |
| **Bonus:** light personalisation | A subject field steers terminology, and a depth control changes the brief and the token budget. |
| **Bonus:** ask questions about the material | `app/api/ask` answers from the sheet and names the sections it used, or says the material does not cover it. |
| **Bonus:** an explanation, not just a page | `app/api/explain` writes a narrated explainer and the browser plays it. |
| **Bonus:** more than one way to be tested | Flashcards with mastery and cloze drills, both derived client side from the same sheet. |
| **Bonus:** multimodal input | A photo of a board or of handwriting is read by Gemini directly, with no OCR step. |

---

## Running it

```bash
git clone https://github.com/kartikeyyyyyaa/FOOLSCAP.git
cd FOOLSCAP
npm install
cp .env.example .env.local    # then add your key
npm run dev
```

Open http://localhost:3000.

### Gemini (required)

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey) and put it in `.env.local`:

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.6-flash   # optional
```

`GEMINI_MODEL` is optional. Google retires model ids and gates older ones to existing projects, so if the configured id stops working the route falls back to its built-in default once and logs a warning rather than failing the request.

> **Never put the real key in `.env.example`.** That file is committed. `.env.local` is gitignored and is the only place the key belongs.

### Supabase (optional)

The app is fully usable with no database. Progress is kept in `localStorage` and the sign-in control stays hidden. That is deliberate: a demo must not die because a database is unreachable mid-presentation.

To add accounts and cross-device history:

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor > New query**, paste `supabase/schema.sql`, and run it. Running it twice is safe.
3. Open **Authentication > Sign In / Providers > Email** and turn **Confirm email** off, or a new account cannot sign in until someone clicks a link in an inbox.
4. Copy the project URL and the publishable key from **Project settings** into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

5. Restart the dev server.

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, which fails silently if a variable is added, blanked or mis-scoped after the last build. So `lib/supabase.ts` takes them from the bundle when they are there and otherwise asks `/api/config`, which reads them server-side on every request. Setting them on your host therefore takes effect on the next page load rather than the next deploy, and the endpoint reads only the URL and the publishable key. It never touches the secret key.

The publishable key is meant to be public. Row level security is what protects the rows, which is why step 2 is not optional. The **secret** key (`sb_secret_...`) belongs nowhere in this repo.

Anything recorded before signing in is merged into the account on first sign-in, so trying the tool and then creating an account does not lose your history.

### Deploying

Import the repo into Vercel and set `GEMINI_API_KEY` (plus the two Supabase variables if you are using them) under **Settings > Environment Variables**. Vercel binds variables to a deployment at deploy time, so after adding them you have to redeploy before they take effect.

---

## How it is built

Next.js 16, React 19, TypeScript, Tailwind v4, `@google/genai`, Supabase. Four server routes, no client-side model key.

```
app/
  layout.tsx              fonts, metadata, no-flash theme script
  page.tsx                landing page, server rendered
  dashboard/page.tsx      the signed-in ledger
  globals.css             design tokens and component styles
  api/generate/route.ts   sheet and quiz
  api/ask/route.ts        questions about the topic
  api/explain/route.ts    the explainer script
  api/config/route.ts     public Supabase config, read at runtime
components/
  Workbench.tsx           client state, orchestration
  SourcePanel.tsx         upload, extraction, settings
  NotesView.tsx           the revision sheet
  QuizCard.tsx            one question, shared by the quiz and the hero
  QuizView.tsx            the quiz plus its debrief
  DebriefCard.tsx         where your mistakes cluster
  Heatmap.tsx             canvas activity grid with the snake
  TopicTracker.tsx        per-topic accuracy, trend, weakest section
  CompareView.tsx         attempt against attempt
  Dashboard.tsx           stat tiles, saved sheets, the lot
  AskPanel.tsx            questions about the topic, with sources
  PracticePanel.tsx       flashcards and cloze drills
  MindMap.tsx             the sheet drawn as a map
  RevisionPlan.tsx        the decay rule as a schedule
  LevelPicker.tsx         how it should be explained
  ExplainerReel.tsx       the narrated explainer and its player
  NavAuth.tsx             sign in and sign up, in the header
  ThemeToggle.tsx         light and dark
lib/
  extract.ts              PDF, DOCX, PPTX, text readers
  prompt.ts               prompt plus the Gemini response schema
  ledger.ts               proof ladder, decay, debrief maths
  stats.ts                attempts, topic stats, comparison, heatmap
  store.ts                Supabase or localStorage, with fallback
  drill.ts                cards, mastery, cloze generation
  image.ts                photo downscale and encode
  plan.ts                 what to revise next, from the ledger
  reading.ts              study time and what counts as high yield
  gemini.ts               shared model call, fallback and error mapping
  supabase.ts             browser client, null when unconfigured
  useAuth.ts              session state
  demo.ts                 illustrative history
  markdown.ts             export
  sample.ts               worked example shown at rest
supabase/
  schema.sql              tables, indexes, row level security, demo seed
```

### Decisions worth explaining

**Extraction runs in the browser.** `pdfjs-dist`, `mammoth` and `jszip` are all dynamically imported, so a student who only pastes text never downloads a PDF engine, and the original file never leaves the machine.

**Structured output is enforced, not parsed.** The route passes `responseSchema` and `responseMimeType: "application/json"` to Gemini, so the model emits typed JSON directly. There is no fence-stripping or regex recovery in the happy path, and malformed questions are dropped before render rather than becoming unanswerable cards.

**One attempt row is the source of truth.** The ledger, the heatmap, the tracker and the comparison are all derived from the same list of attempts. There is no second state to keep in sync.

**The explainer is composed, not rendered.** Gemini returns a script (scenes, on-screen lines, narration, timing) and the browser plays it with its own speech synthesis. Rendering video server-side would mean an encoder, storage and a wait, for something the browser can compose instantly and keep in the theme. A browser with no voice installed falls back to the scene's own timing and the captions carry every word.

**No invented video ids.** A model asked for YouTube ids produces ones that 404. The route returns a search query instead, so the link always lands somewhere real.

**The extra study formats are derived, not generated.** Cards, cloze blanks, the map, the reading time and the high-yield filter are all computed from the sheet on the client. That is not a shortcut: a blank the model chose could hide a word the sheet never taught, and a difficulty label it assigned could not be checked by looking. Deriving them means every one of them is falsifiable against the sheet in front of you.

**Everything degrades.** No Supabase means localStorage. A retired model id means a fallback. A scanned PDF means a message pointing at the paste path. Blocked storage means the feature quietly turns off rather than throwing.

**The app opens in a working state.** `lib/sample.ts` carries a real Operating Systems revision sheet on deadlock, badged as a sample, so the first paint shows what the product does. The landing page renders its previews from that same data through the same components, so nothing on the page is a mockup.

### Design

The visual system is adapted from the Stripe analysis in [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md): white canvas, an atmospheric gradient mesh across the upper third, deep navy ink for body copy, and exactly one filled indigo pill per band. Manrope at weight 300 with tight negative tracking for display, IBM Plex Mono for data. Light and dark are both defined at token level, with a no-flash script in `layout.tsx`.

The activity grid is drawn on canvas rather than as 180 DOM nodes, and reads its palette from the same CSS custom properties as everything else so it follows the theme. It renders as a static grid under `prefers-reduced-motion`.

---

## Honesty notes

- The student reviews on the landing page are **illustrative** and labelled as such on the page. They are not real users and no user count is claimed anywhere.
- The demo history is badged **Demo data** wherever it appears.

## Known limits

- Scanned PDFs with no text layer are rejected with a message pointing at the paste path. There is no OCR, but a photograph of the same page works, because Gemini reads images directly.
- Photographs are capped at three per sheet and sized to 1600px on the long edge before upload.
- Flashcard mastery is kept in `localStorage`, so it does not follow you between devices the way attempts do.
- Source text is capped at 60,000 characters. Longer documents are trimmed from the end.
- PPTX extraction reads slide body text, not speaker notes or text baked into images.
- Without Supabase the ledger is per browser and does not sync.
- The explainer plays in the browser. There is no downloadable video file, and the voice is whichever one the operating system provides.
- The YouTube link opens a search, not a specific video. Nothing on the page claims to have watched it.

## Roadmap

- **The Explained rung.** Write the answer in your own words, marked against the source. It closes the ladder.
- **Photograph the board.** Gemini is multimodal. Snap a blackboard photo and get a sheet from it.
- **Exam dates.** Reorder the ledger by least proved, soonest examined.
- **A share link.** Read-only access to your ledger for a friend or parent, so the commitment has a witness.

## Licence

MIT.
