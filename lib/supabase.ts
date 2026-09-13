import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * Returns the browser client, or null when Supabase is not configured.
 *
 * Everything downstream branches on null and falls back to localStorage, so
 * the app is fully usable with no database at all. That is deliberate: a demo
 * must not die because a database is unreachable mid-presentation.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export const supabaseConfigured = Boolean(url && anonKey);
