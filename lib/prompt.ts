import { Type } from "@google/genai";
import type { Depth } from "./types";

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
