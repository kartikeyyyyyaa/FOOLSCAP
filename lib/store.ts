import { getSupabase } from "./supabase";
import type { Attempt, Depth, RevisionSheet, SavedSheet } from "./types";

const KEY = "foolscap.attempts";
const SHEETS_KEY = "foolscap.sheets";
const MAX_LOCAL = 400;
const MAX_LOCAL_SHEETS = 30;

/* ------------------------------------------------------------------ *
 * Local storage. Always available, and the fallback for everything.
 * ------------------------------------------------------------------ */

export function loadLocal(): Attempt[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

export function saveLocal(attempts: Attempt[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(attempts.slice(0, MAX_LOCAL)));
  } catch {
    // Private windows and blocked site data land here. Progress tracking is a
    // convenience, so losing it must never break the run.
  }
}

/* ------------------------------------------------------------------ *
 * Supabase row mapping
 * ------------------------------------------------------------------ */

interface AttemptRow {
  id: string;
  topic_title: string;
  subject: string | null;
  right_count: number;
  total_count: number;
  section_stats: Attempt["sectionStats"] | null;
  created_at: string;
}

function fromRow(row: AttemptRow): Attempt {
  const total = row.total_count || 0;
  return {
    id: row.id,
    topicTitle: row.topic_title,
    subject: row.subject ?? "",
    right: row.right_count,
    total,
    ratio: total ? row.right_count / total : 0,
    sectionStats: row.section_stats ?? {},
    createdAt: new Date(row.created_at).getTime(),
  };
}

/* ------------------------------------------------------------------ *
 * The public surface. Every call degrades to local on any failure.
 * ------------------------------------------------------------------ */

export async function listAttempts(userId: string | null): Promise<Attempt[]> {
  const supabase = await getSupabase();
  if (!supabase || !userId) return loadLocal();

  const { data, error } = await supabase
    .from("attempts")
    .select("id, topic_title, subject, right_count, total_count, section_stats, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_LOCAL);

  if (error || !data) return loadLocal();
  return (data as AttemptRow[]).map(fromRow);
}

export async function saveAttempt(userId: string | null, attempt: Attempt): Promise<void> {
  const supabase = await getSupabase();

  if (!supabase || !userId) {
    saveLocal([attempt, ...loadLocal()]);
    return;
  }

  const { error } = await supabase.from("attempts").insert({
    user_id: userId,
    topic_title: attempt.topicTitle,
    subject: attempt.subject,
    right_count: attempt.right,
    total_count: attempt.total,
    section_stats: attempt.sectionStats,
    created_at: new Date(attempt.createdAt).toISOString(),
  });

  // A failed write still keeps the attempt on this device rather than losing it.
  if (error) saveLocal([attempt, ...loadLocal()]);
}

export async function clearAttempts(userId: string | null): Promise<void> {
  const supabase = await getSupabase();
  saveLocal([]);
  if (!supabase || !userId) return;
  await supabase.from("attempts").delete().eq("user_id", userId);
}

/* ------------------------------------------------------------------ *
 * Saved sheets. Same shape of contract: Supabase when signed in,
 * localStorage otherwise, and never lose a write.
 * ------------------------------------------------------------------ */

interface SheetRow {
  id: string;
  title: string;
  subject: string | null;
  depth: string | null;
  sheet: RevisionSheet;
  created_at: string;
}

function loadLocalSheets(): SavedSheet[] {
  try {
    const raw = window.localStorage.getItem(SHEETS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedSheet[]) : [];
  } catch {
    return [];
  }
}

function saveLocalSheets(sheets: SavedSheet[]): void {
  try {
    window.localStorage.setItem(SHEETS_KEY, JSON.stringify(sheets.slice(0, MAX_LOCAL_SHEETS)));
  } catch {
    // Storage can be unavailable or full. Losing the cache must not break a run.
  }
}

export async function listSheets(userId: string | null): Promise<SavedSheet[]> {
  const supabase = await getSupabase();
  if (!supabase || !userId) return loadLocalSheets();

  const { data, error } = await supabase
    .from("sheets")
    .select("id, title, subject, depth, sheet, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_LOCAL_SHEETS);

  if (error || !data) return loadLocalSheets();

  return (data as SheetRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject ?? "",
    depth: (row.depth === "thorough" ? "thorough" : "quick") as Depth,
    sheet: row.sheet,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function saveSheet(
  userId: string | null,
  sheet: RevisionSheet,
  depth: Depth,
): Promise<void> {
  const entry: SavedSheet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: sheet.title,
    subject: sheet.subject ?? "",
    depth,
    sheet,
    createdAt: Date.now(),
  };

  const supabase = await getSupabase();
  if (!supabase || !userId) {
    saveLocalSheets([entry, ...loadLocalSheets()]);
    return;
  }

  const { error } = await supabase.from("sheets").insert({
    user_id: userId,
    title: entry.title,
    subject: entry.subject,
    depth,
    sheet,
  });

  if (error) saveLocalSheets([entry, ...loadLocalSheets()]);
}

export async function deleteSheet(userId: string | null, id: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase || !userId) {
    saveLocalSheets(loadLocalSheets().filter((s) => s.id !== id));
    return;
  }
  await supabase.from("sheets").delete().eq("id", id);
}

/**
 * Moves anything recorded before signing in into the account, so a student who
 * tries the tool and then creates an account does not lose their history.
 */
export async function mergeLocalInto(userId: string): Promise<void> {
  const supabase = await getSupabase();
  const local = loadLocal();
  if (!supabase || local.length === 0) return;

  const { error } = await supabase.from("attempts").insert(
    local.map((a) => ({
      user_id: userId,
      topic_title: a.topicTitle,
      subject: a.subject,
      right_count: a.right,
      total_count: a.total,
      section_stats: a.sectionStats,
      created_at: new Date(a.createdAt).toISOString(),
    })),
  );

  if (!error) saveLocal([]);
}
