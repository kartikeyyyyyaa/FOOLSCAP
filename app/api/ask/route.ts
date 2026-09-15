import { NextResponse } from "next/server";
import { GeminiError, NO_KEY, apiKey, callJson } from "@/lib/gemini";
import { ASK_SCHEMA, MAX_ASK_SOURCE_CHARS, asLevel, buildAskPrompt, sheetDigest } from "@/lib/prompt";
import type { AskAnswer, AskResponse, RevisionSheet } from "@/lib/types";

/**
 * Answers a question about the topic the student is revising.
 *
 * The point of difference from a general chatbot is the grounding contract:
 * the answer is drawn from their sheet, it names the sections it came from,
 * and when the material does not cover the question it says so out loud rather
 * than quietly answering from the model's own knowledge. A student revising
 * for an exam needs to know which of those two things just happened.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_HISTORY = 4;

function fail(error: string, status: number) {
  return NextResponse.json<AskResponse>({ error }, { status });
}

export async function POST(request: Request) {
  const key = apiKey();
  if (!key) return fail(NO_KEY, 500);

  let body: {
    question?: string;
    sheet?: RevisionSheet;
    source?: string;
    level?: string;
    history?: { question?: string; answer?: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return fail("The request body was not valid JSON.", 400);
  }

  const question = (body.question ?? "").trim().slice(0, 600);
  const sheet = body.sheet;

  if (question.length < 3) return fail("Type a question first.", 400);
  if (!sheet?.title || !Array.isArray(sheet.sections)) {
    return fail("Generate a revision sheet before asking questions about it.", 400);
  }

  const history = (body.history ?? [])
    .slice(-MAX_HISTORY)
    .map((h) => ({ question: (h.question ?? "").slice(0, 400), answer: (h.answer ?? "").slice(0, 900) }))
    .filter((h) => h.question && h.answer);

  const digest = sheetDigest(sheet);
  const source = (body.source ?? "").trim().slice(0, MAX_ASK_SOURCE_CHARS);

  try {
    const parsed = await callJson<AskAnswer>({
      apiKey: key,
      prompt: buildAskPrompt(question, digest, source, history, asLevel(body.level)),
      schema: ASK_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 8192,
      label: "answer",
    });

    if (!parsed?.answer?.trim()) return fail("Gemini returned an empty answer. Try rewording it.", 502);

    const headings = new Set(sheet.sections.map((s) => s.heading));

    const result: AskAnswer = {
      answer: parsed.answer.trim(),
      grounded: parsed.grounded === true,
      // A heading the student cannot find in their own sheet is worse than no
      // citation at all, so anything that does not match exactly is dropped.
      sections: (parsed.sections ?? []).filter((s) => headings.has(s)).slice(0, 4),
      followUps: (parsed.followUps ?? []).filter(Boolean).slice(0, 2),
    };

    // The badge claims the sheet backs the answer, so it has to survive the
    // filter above rather than resting on the model's own say-so.
    if (result.sections.length === 0) result.grounded = false;

    return NextResponse.json<AskResponse>({ result });
  } catch (error) {
    if (error instanceof GeminiError) return fail(error.message, error.status);
    return fail("The answer could not be generated. Try again.", 502);
  }
}
