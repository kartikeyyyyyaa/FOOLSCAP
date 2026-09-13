import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * NEXT_PUBLIC_* values are inlined by Next at BUILD time, not read at runtime.
 * Adding them in a host's dashboard therefore does nothing to a build that
 * already exists: you have to redeploy. That is the single most common reason
 * the sign-in control goes missing in production.
 *
 * Two key names are accepted because Supabase renamed the browser key, and the
 * Vercel integration provisions the newer one while hand-written .env files
 * usually carry the older. Either is correct, and both are safe to expose:
 * row level security is what protects the rows.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const browserKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Returns the browser client, or null when Supabase is not configured.
 *
 * Everything downstream branches on null and falls back to localStorage, so
 * the app is fully usable with no database at all. That is deliberate: a demo
 * must not die because a database is unreachable mid-presentation.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !browserKey) return null;
  if (!client) {
    client = createClient(url, browserKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export const supabaseConfigured = Boolean(url && browserKey);

/**
 * Says out loud why accounts are switched off, so an unconfigured deployment
 * is diagnosable from the browser console instead of looking like a bug. The
 * UI hides the sign-in control in this state, and a silently missing control
 * is indistinguishable from a broken one.
 */
export function describeSupabaseConfig(): string {
  if (supabaseConfigured) return "Supabase configured.";

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !browserKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
  ].filter(Boolean);

  return (
    `[foolscap] Accounts are off: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} missing ` +
    "from this build. These are inlined at build time, so if you have already set them on your host, " +
    "redeploy. Progress will be kept in localStorage until then."
  );
}
