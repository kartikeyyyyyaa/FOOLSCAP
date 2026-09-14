import { Type } from "@google/genai";
import type { Depth, RevisionSheet } from "./types";

/** Anything longer than this is trimmed before it reaches the model. */
export const MAX_SOURCE_CHARS = 60_000;

/**
 * Gemini response schema. Structured output is enforced here rather than
 * parsed out of prose afterwards, so a question can never reach the UI without
 * four options, a marked answer, the section it tests, and a reason.
 */
export const SHEET_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING, description: "The subject or course this material belongs to." },
    title: {
      type: Type.STRING,
      description: "A specific title for this revision sheet, naming the actual topic.",
    },
    overview: {
      type: Type.STRING,
      description: "Two or three sentences on what the material covers and why it matters.",
    },
    concepts: {
      type: Type.ARRAY,
      description: "Terms the student must be able to define.",
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING, description: "One or two sentences." },
        },
        required: ["term", "definition"],
        propertyOrdering: ["term", "definition"],
      },
    },
    sections: {
      type: Type.ARRAY,
      description: "The explanation itself, broken into revisable points.",
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["heading", "points"],
        propertyOrdering: ["heading", "points"],
      },
    },
    memorize: {
      type: Type.ARRAY,
      description: "Formulas, rules, values or lists to know verbatim.",
      items: { type: Type.STRING },
    },
    traps: {
      type: Type.ARRAY,
      description: "Mistakes students make here, each stated as the mistake plus the correction.",
      items: { type: Type.STRING },
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answerIndex: {
            type: Type.INTEGER,
            description: "Zero-based index of the correct option, between 0 and 3.",
          },
          tests: {
            type: Type.STRING,
            description:
              "The exact heading string of the section this question examines, copied character for character.",
          },
          explanation: { type: Type.STRING },
        },
        required: ["question", "options", "answerIndex", "tests", "explanation"],
        propertyOrdering: ["question", "options", "answerIndex", "tests", "explanation"],
      },
    },
  },
  required: ["subject", "title", "overview", "concepts", "sections", "memorize", "traps", "quiz"],
  propertyOrdering: [
    "subject",
    "title",
    "overview",
    "concepts",
    "sections",
    "memorize",
    "traps",
    "quiz",
  ],
};

export function buildPrompt(
  source: string,
  subject: string,
  depth: Depth,
  count: number,
): string {
  const thorough = depth === "thorough";

  const rules = [
    "You are preparing revision notes for a university student who will be examined on this material.",
    subject
      ? `The subject is ${subject}. Use that field's standard terminology and notation.`
      : "Infer the subject from the material itself.",
    thorough
      ? "Depth: thorough. Give 8 to 12 key terms, 4 to 6 sections of 4 to 6 points each, and enough detail to answer a long-form question."
      : "Depth: quick pass. Give 5 to 7 key terms, 3 to 4 sections of 3 to 4 points each. It must be readable in about ten minutes.",
    "Write only what the source material actually supports. Do not invent facts, figures, dates, or citations that are not in it.",
    "sections carry the explanation, broken into short self-contained points a student can revise from.",
    "memorize holds the formulas, rules, values or lists that have to be known verbatim.",
    "traps holds the specific mistakes students make on this topic, stated as the mistake and the correction.",
    `Write exactly ${count} multiple-choice questions, each with exactly 4 options and one correct answer.`,
    "answerIndex is the zero-based index of the correct option. Vary which position is correct across the quiz.",
    "tests must be the exact heading string of the section that question examines, copied character for character from the sections you wrote.",
    "Wrong options must be plausible and drawn from real confusions in this topic, never filler.",
    "explanation says why the right answer is right and, where it helps, why the tempting wrong one is wrong.",
    "Use plain punctuation. Do not use em dashes.",
    "Every field must be present. Never return an empty array.",
  ].join("\n");

  return `${rules}\n\nSOURCE MATERIAL:\n\n${source}`;
}

/* ------------------------------------------------------------------ *
 * Ask
 * ------------------------------------------------------------------ */

/** What a question may be answered against, without resending the whole file. */
export const MAX_ASK_SOURCE_CHARS = 24_000;

/**
 * A compact rendering of the sheet, used as the grounding context for the Ask
 * and Watch routes. The sheet is already the distilled version of the source,
 * so sending it costs a fraction of the original document and keeps every
 * answer anchored to the same section headings the rest of the app tracks.
 */
export function sheetDigest(sheet: RevisionSheet): string {
  const lines: string[] = [
    `TITLE: ${sheet.title}`,
    sheet.subject ? `SUBJECT: ${sheet.subject}` : "",
    sheet.overview ? `OVERVIEW: ${sheet.overview}` : "",
    "",
    "KEY TERMS:",
    ...sheet.concepts.map((c) => `- ${c.term}: ${c.definition}`),
    "",
    "SECTIONS:",
  ];

  for (const section of sheet.sections) {
    lines.push(`## ${section.heading}`);
    lines.push(...section.points.map((p) => `- ${p}`));
  }

  if (sheet.memorize.length) {
    lines.push("", "MUST BE KNOWN VERBATIM:", ...sheet.memorize.map((m) => `- ${m}`));
  }
  if (sheet.traps.length) {
    lines.push("", "COMMON MISTAKES:", ...sheet.traps.map((t) => `- ${t}`));
  }

  return lines.filter((l) => l !== "").join("\n");
}

export const ASK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: {
      type: Type.STRING,
      description:
        "The answer, in plain prose. Two to six sentences unless the question genuinely needs more.",
    },
    grounded: {
      type: Type.BOOLEAN,
      description:
        "True only if the revision material itself supports the answer. False if you had to go outside it.",
    },
    sections: {
      type: Type.ARRAY,
      description:
        "Exact section headings the answer draws on, copied character for character. Empty when grounded is false.",
      items: { type: Type.STRING },
    },
    followUps: {
      type: Type.ARRAY,
      description: "Exactly two short questions worth asking next about this material.",
      items: { type: Type.STRING },
    },
  },
  required: ["answer", "grounded", "sections", "followUps"],
  propertyOrdering: ["answer", "grounded", "sections", "followUps"],
};

export function buildAskPrompt(
  question: string,
  digest: string,
  source: string,
  history: { question: string; answer: string }[],
): string {
  const rules = [
    "You are answering a university student's question about material they are revising.",
    "Answer from the REVISION MATERIAL below first, and from the SOURCE EXTRACT where one is given.",
    "If the material supports the answer, set grounded to true and list the exact section headings you used.",
    "If the material does not cover it, set grounded to false, say so in the first sentence, then answer briefly from general knowledge of the subject. Never pretend the material said something it did not.",
    "Do not invent formulas, figures, dates or citations that are not in the material.",
    "Write for someone revising, not for a textbook. Lead with the answer, then the reason.",
    "If the question is about how to answer an exam question, say what the marker is looking for.",
    "sections must copy headings character for character from the SECTIONS list. If you used none, return an empty array.",
    "Use plain punctuation. Do not use em dashes.",
  ].join("\n");

  const thread = history.length
    ? `\n\nEARLIER IN THIS CONVERSATION:\n${history
        .map((h) => `Q: ${h.question}\nA: ${h.answer}`)
        .join("\n\n")}`
    : "";

  const extract = source ? `\n\nSOURCE EXTRACT:\n\n${source}` : "";

  return `${rules}\n\nREVISION MATERIAL:\n\n${digest}${extract}${thread}\n\nQUESTION:\n${question}`;
}

/* ------------------------------------------------------------------ *
 * Watch
 * ------------------------------------------------------------------ */

export const REEL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The topic being explained." },
    promise: {
      type: Type.STRING,
      description: "One line stating what the viewer will be able to do after watching.",
    },
    scenes: {
      type: Type.ARRAY,
      description: "The explanation in order, one idea per scene.",
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING, description: "Four words at most." },
          lines: {
            type: Type.ARRAY,
            description: "Two to four short on-screen lines. Fragments, not sentences.",
            items: { type: Type.STRING },
          },
          narration: {
            type: Type.STRING,
            description:
              "What is said aloud over this scene. 35 to 55 words, spoken English, no bullet syntax.",
          },
          seconds: {
            type: Type.INTEGER,
            description: "How long the scene should hold, between 10 and 22.",
          },
        },
        required: ["heading", "lines", "narration", "seconds"],
        propertyOrdering: ["heading", "lines", "narration", "seconds"],
      },
    },
    search: {
      type: Type.STRING,
      description:
        "A YouTube search query that would find a good human-made lecture on this exact topic. Six words at most, no quotes.",
    },
  },
  required: ["title", "promise", "scenes", "search"],
  propertyOrdering: ["title", "promise", "scenes", "search"],
};

export function buildReelPrompt(digest: string, minutes: number): string {
  const scenes = minutes <= 2 ? "5 or 6" : "8 to 10";

  const rules = [
    "You are writing a short spoken explainer that a student will watch instead of rereading their notes.",
    `Write ${scenes} scenes, in the order the idea has to be built up.`,
    "Open by naming the problem the topic solves, not by announcing what the video will cover.",
    "Each scene carries exactly one idea. If a scene needs the word 'and' twice, split it.",
    "narration is spoken aloud by a screen reader voice, so write it as speech: full sentences, no bullets, no symbols, no markdown, no abbreviations a voice would mangle. Write 'for example' rather than 'e.g.'.",
    "Spell out notation in words where a voice would stumble. Say 'n log n' as 'n log n', not as a formula.",
    "lines are what appears on screen while that narration plays. Fragments a student could copy into a margin. Never repeat the narration verbatim.",
    "Close on the mistake most students make on this topic, and what to do instead.",
    "Only explain what the material supports. Do not add facts, figures or examples that are not in it.",
    "Use plain punctuation. Do not use em dashes.",
  ].join("\n");

  return `${rules}\n\nREVISION MATERIAL:\n\n${digest}`;
}
