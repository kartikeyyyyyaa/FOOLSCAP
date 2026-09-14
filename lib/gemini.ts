import { GoogleGenAI } from "@google/genai";

/**
 * Shared Gemini plumbing for the routes that ask for structured JSON.
 *
 * `app/api/generate` predates this and keeps its own copy, because its error
 * messages are written for the one call a student cannot proceed without. The
 * two smaller routes share this instead of repeating the model fallback, the
 * fence stripping and the error mapping three times over.
 */

/** Keep current. Google retires ids, so see the fallback in `callJson`. */
export const DEFAULT_MODEL = "gemini-3.6-flash";

/** True when the model id itself was rejected, rather than the request. */
export function isUnknownModel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /NOT_FOUND|is no longer available|not found for API version|404/i.test(message);
}

export class GeminiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface JsonCall {
  apiKey: string;
  prompt: string;
  schema: unknown;
  temperature: number;
  maxOutputTokens: number;
  /** Used in the error text so a failure names the thing that failed. */
  label: string;
}

/**
 * Calls Gemini with an enforced response schema and returns the parsed object.
 * Throws `GeminiError` with a message written for the student and an HTTP
 * status the route can pass straight through.
 */
export async function callJson<T>({
  apiKey,
  prompt,
  schema,
  temperature,
  maxOutputTokens,
  label,
}: JsonCall): Promise<T> {
  const ai = new GoogleGenAI({ apiKey });
  const requested = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const call = (model: string) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        // The SDK types this loosely; the shape is checked by the API itself.
        responseSchema: schema as never,
        temperature,
        // Generous on purpose: newer models spend reasoning tokens from this
        // same budget, and a tight cap truncates the JSON mid-object.
        maxOutputTokens,
      },
    });

  let response;
  try {
    try {
      response = await call(requested);
    } catch (error) {
      if (isUnknownModel(error) && requested !== DEFAULT_MODEL) {
        console.warn(
          `[foolscap] GEMINI_MODEL="${requested}" was rejected. Falling back to "${DEFAULT_MODEL}".`,
        );
        response = await call(DEFAULT_MODEL);
      } else {
        throw error;
      }
    }
  } catch (error) {
    throw new GeminiError(describe(error, requested), statusFor(error));
  }

  const finish = response.candidates?.[0]?.finishReason;
  const raw = response.text;

  if (!raw) {
    throw new GeminiError(
      `Gemini returned nothing for the ${label} (finish reason: ${finish ?? "unknown"}). Try again.`,
      502,
    );
  }

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error(
      `[foolscap] Could not parse the ${label}. finishReason=${finish} length=${raw.length}\n` +
        `--- first 300 chars ---\n${raw.slice(0, 300)}`,
    );
    if (finish === "MAX_TOKENS") {
      throw new GeminiError(
        `Gemini ran out of budget before finishing the ${label}. Try a shorter topic.`,
        502,
      );
    }
    throw new GeminiError(`Gemini returned output this app could not read for the ${label}.`, 502);
  }
}

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (/API key|API_KEY_INVALID|permission/i.test(message)) return 401;
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(message)) return 429;
  if (/overload|UNAVAILABLE|503/i.test(message)) return 503;
  return 502;
}

function describe(error: unknown, requested: string): string {
  const message = error instanceof Error ? error.message : "";
  if (isUnknownModel(error)) {
    return `Gemini rejected the model id "${requested}". Set GEMINI_MODEL in .env.local to a current id.`;
  }
  if (/API key|API_KEY_INVALID|permission/i.test(message)) {
    return "The Gemini API key was rejected. Check GEMINI_API_KEY.";
  }
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(message)) {
    return "Gemini rate limited this key. Wait about a minute and try again.";
  }
  if (/overload|UNAVAILABLE|503/i.test(message)) {
    return "Gemini is busy right now. Try again shortly.";
  }
  return `The Gemini call failed: ${message || "unknown error"}`;
}

/** Reads the key once, in the one place, so a missing key reads the same everywhere. */
export function apiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
}

export const NO_KEY =
  "The server has no GEMINI_API_KEY set. Copy .env.example to .env.local and add a key from Google AI Studio.";
