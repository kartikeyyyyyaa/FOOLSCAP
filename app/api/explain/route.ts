import { NextResponse } from "next/server";
import { GeminiError, NO_KEY, apiKey, callJson } from "@/lib/gemini";
import { REEL_SCHEMA, buildReelPrompt, sheetDigest } from "@/lib/prompt";
import type { ExplainResponse, Reel, ReelScene, RevisionSheet } from "@/lib/types";

/**
 * Writes the script for the explainer: scenes, what appears on screen, what is
 * said over each one, and how long it holds.
 *
 * It returns a script rather than a video file on purpose. Rendering video
 * server-side would mean an encoder, storage and a wait; the player composes
 * the same thing in the browser instantly and stays in the theme. It also
 * returns a search query rather than a video id, because a model asked for
 * YouTube ids invents ones that 404, and a dead embed is worse than a link
 * that actually finds something.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(error: string, status: number) {
  return NextResponse.json<ExplainResponse>({ error }, { status });
}

/** Keeps the player honest: no empty scene, no runaway hold, no missing line. */
function sanitise(reel: Reel, sheet: RevisionSheet): Reel {
  const scenes: ReelScene[] = (reel.scenes ?? [])
    .filter((s) => s?.narration?.trim() && s?.heading?.trim())
    .map((s) => ({
      heading: s.heading.trim().slice(0, 60),
      lines: (s.lines ?? []).filter(Boolean).map((l) => l.trim().slice(0, 90)).slice(0, 4),
      narration: s.narration.trim(),
      seconds: Math.min(Math.max(Math.round(s.seconds) || 14, 8), 26),
    }))
    .slice(0, 12);

  return {
    title: reel.title?.trim() || sheet.title,
    promise: reel.promise?.trim() || "",
    scenes,
    search: (reel.search?.trim() || `${sheet.title} ${sheet.subject ?? ""}`).slice(0, 120),
  };
}

export async function POST(request: Request) {
  const key = apiKey();
  if (!key) return fail(NO_KEY, 500);

  let body: { sheet?: RevisionSheet; length?: string };
  try {
    body = await request.json();
  } catch {
    return fail("The request body was not valid JSON.", 400);
  }

  const sheet = body.sheet;
  if (!sheet?.title || !Array.isArray(sheet.sections) || sheet.sections.length === 0) {
    return fail("Generate a revision sheet before asking for an explanation of it.", 400);
  }

  const minutes = body.length === "long" ? 4 : 2;

  try {
    const parsed = await callJson<Reel>({
      apiKey: key,
      prompt: buildReelPrompt(sheetDigest(sheet), minutes),
      schema: REEL_SCHEMA,
      temperature: 0.55,
      maxOutputTokens: minutes > 2 ? 16384 : 10240,
      label: "explanation",
    });

    const reel = sanitise(parsed, sheet);
    if (reel.scenes.length < 2) return fail("The explanation came back incomplete. Try again.", 502);

    return NextResponse.json<ExplainResponse>({ reel });
  } catch (error) {
    if (error instanceof GeminiError) return fail(error.message, error.status);
    return fail("The explanation could not be generated. Try again.", 502);
  }
}
