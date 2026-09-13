import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { MAX_SOURCE_CHARS, SHEET_SCHEMA, buildPrompt } from "@/lib/prompt";
import type { Depth, GenerateResponse, RevisionSheet } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Google retires model ids and blocks new projects from older ones, so a
 * hard-coded id eventually returns NOT_FOUND. Keep this current, and note the
 * fallback below: a stale GEMINI_MODEL in someone's .env does not take the app
 * down with it.
 */
const DEFAULT_MODEL = "gemini-3.6-flash";

function fail(error: string, status: number) {
  return NextResponse.json<GenerateResponse>({ error }, { status });
}

/** True when the model id itself was rejected, rather than the request. */
function isUnknownModel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /NOT_FOUND|is no longer available|not found for API version|404/i.test(message);
}

/**
 * Drops anything malformed rather than letting a half-built question reach the
 * UI, where it would render as an unanswerable card.
 */
function sanitise(sheet: RevisionSheet): RevisionSheet {
  const sections = (sheet.sections ?? []).filter((s) => s?.heading && Array.isArray(s.points));
  const headings = new Set(sections.map((s) => s.heading));

  return {
    subject: sheet.subject ?? "",
    title: sheet.title ?? "",
    overview: sheet.overview ?? "",
    sections,
    concepts: (sheet.concepts ?? []).filter((c) => c?.term && c?.definition),
    memorize: (sheet.memorize ?? []).filter(Boolean),
    traps: (sheet.traps ?? []).filter(Boolean),
    quiz: (sheet.quiz ?? [])
      .filter(
        (q) =>
          q?.question &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          typeof q.answerIndex === "number" &&
          q.answerIndex >= 0 &&
          q.answerIndex < q.options.length,
      )
      // A `tests` value that does not name a real section would send the
      // debrief somewhere the student cannot go, so it is normalised here.
      .map((q) => ({
        ...q,
        tests: headings.has(q.tests) ? q.tests : (sections[0]?.heading ?? "General"),
      })),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return fail(
      "The server has no GEMINI_API_KEY set. Copy .env.example to .env.local and add a key from Google AI Studio.",
      500,
    );
  }

  let body: { source?: string; subject?: string; depth?: Depth; count?: number };
  try {
    body = await request.json();
  } catch {
    return fail("The request body was not valid JSON.", 400);
  }

  const source = (body.source ?? "").trim().slice(0, MAX_SOURCE_CHARS);
  const subject = (body.subject ?? "").trim().slice(0, 120);
  const depth: Depth = body.depth === "thorough" ? "thorough" : "quick";
  const count = body.count === 10 ? 10 : 5;

  if ((source.match(/\S+/g) ?? []).length < 40) {
    return fail("There is not enough text to revise from. Send at least a few paragraphs.", 400);
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(source, subject, depth, count);

  const call = (model: string) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SHEET_SCHEMA,
        temperature: 0.4,
        // Generous on purpose. Newer Gemini models spend reasoning tokens out
        // of this same budget, so a tight cap truncates the JSON mid-object
        // and the parse fails with no obvious cause.
        maxOutputTokens: depth === "thorough" ? 32768 : 16384,
      },
    });

  const requested = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  try {
    let response;
    try {
      response = await call(requested);
    } catch (error) {
      // A retired or gated model id should not take the app down. Fall back to
      // the built-in default once, and say so in the server log.
      if (isUnknownModel(error) && requested !== DEFAULT_MODEL) {
        console.warn(
          `[foolscap] GEMINI_MODEL="${requested}" was rejected by the API. Falling back to "${DEFAULT_MODEL}". Update .env.local to silence this.`,
        );
        response = await call(DEFAULT_MODEL);
      } else {
        throw error;
      }
    }

    const finish = response.candidates?.[0]?.finishReason;
    const raw = response.text;

    if (!raw) {
      return fail(`Gemini returned no text (finish reason: ${finish ?? "unknown"}). Try again.`, 502);
    }

    // responseMimeType usually prevents fences, but a model that ignores it
    // should not cost the student their run.
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    let parsed: RevisionSheet;
    try {
      parsed = JSON.parse(cleaned) as RevisionSheet;
    } catch {
      console.error(
        `[foolscap] Could not parse Gemini output. finishReason=${finish} length=${raw.length}\n` +
          `--- first 400 chars ---\n${raw.slice(0, 400)}\n` +
          `--- last 200 chars ---\n${raw.slice(-200)}`,
      );

      if (finish === "MAX_TOKENS") {
        return fail(
          "Gemini ran out of output budget before finishing the sheet. Try Quick pass, or a shorter source.",
          502,
        );
      }
      return fail(
        `Gemini returned output this app could not read (finish reason: ${finish ?? "unknown"}). The server log has the first part of it.`,
        502,
      );
    }

    const sheet = sanitise(parsed);
    if (!sheet.title || sheet.quiz.length === 0) {
      return fail("The revision sheet came back incomplete. Try again.", 502);
    }

    return NextResponse.json<GenerateResponse>({ sheet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (isUnknownModel(error)) {
      return fail(
        `Gemini rejected both "${requested}" and the built-in default "${DEFAULT_MODEL}". Set GEMINI_MODEL in .env.local to a current model id from https://ai.google.dev/gemini-api/docs/models`,
        502,
      );
    }
    if (/API key|API_KEY_INVALID|permission/i.test(message)) {
      return fail("The Gemini API key was rejected. Check GEMINI_API_KEY.", 401);
    }
    if (/quota|RESOURCE_EXHAUSTED|429/i.test(message)) {
      return fail("Gemini rate limited this key. Wait about a minute and try again.", 429);
    }
    if (/overload|UNAVAILABLE|503/i.test(message)) {
      return fail("Gemini is busy right now. Try again shortly.", 503);
    }

    return fail(`The Gemini call failed: ${message || "unknown error"}`, 502);
  }
}
