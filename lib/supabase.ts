import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase config is resolved in two stages.
 *
 * 1. Build time. NEXT_PUBLIC_* values are inlined into the bundle by Next. When
 *    they are present this is instant and no request is made.
 * 2. Runtime. Otherwise the app asks /api/config, which reads the same settings
 *    server-side on every request. That covers the cases build-time inlining
 *    cannot: a variable added after the last build, one left blank, one scoped
 *    to the wrong environment, or the names the Vercel Supabase integration
 *    provisions without a NEXT_PUBLIC_ prefix.
 *
 * The practical effect is that changing the values on your host takes effect on
 * the next page load instead of the next deploy.
 */

interface PublicConfig {
  url: string;
  key: string;
}

const buildUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const buildKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";

/** True only when the values were baked into this build. */
export const supabaseConfiguredAtBuild = Boolean(buildUrl && buildKey);

let resolved: PublicConfig | null = supabaseConfiguredAtBuild
  ? { url: buildUrl, key: buildKey }
  : null;

let lookup: Promise<PublicConfig | null> | null = null;
let client: SupabaseClient | null = null;
let lastMissing: string[] = [];

async function resolveConfig(): Promise<PublicConfig | null> {
  if (resolved) return resolved;
  if (typeof window === "undefined") return null;

  // Memoised: many components call this, one request goes out.
  if (!lookup) {
    lookup = fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { supabase: PublicConfig | null; missing?: string[] } | null) => {
        lastMissing = body?.missing ?? [];
        resolved = body?.supabase ?? null;
        return resolved;
      })
      .catch(() => null);
  }

  return lookup;
}

/**
 * Returns the browser client, or null when Supabase is not configured.
 *
 * Everything downstream branches on null and falls back to localStorage, so
 * the app is fully usable with no database at all. That is deliberate: a demo
 * must not die because a database is unreachable mid-presentation.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  const config = await resolveConfig();
  if (!config) return null;

  if (!client) {
    client = createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** Whether accounts are available, after the runtime lookup has settled. */
export async function isSupabaseConfigured(): Promise<boolean> {
  return Boolean(await resolveConfig());
}

/**
 * Says out loud why accounts are switched off, so an unconfigured deployment
 * is diagnosable from the browser console instead of looking like a bug. The
 * UI hides the sign-in control in this state, and a silently missing control
 * is indistinguishable from a broken one.
 */
export function describeSupabaseConfig(): string {
  if (resolved) return "[foolscap] Supabase configured.";

  const names = lastMissing.length ? lastMissing.join(" and ") : "SUPABASE_URL and SUPABASE_ANON_KEY";

  return (
    `[foolscap] Accounts are off: ${names} ${lastMissing.length === 1 ? "is" : "are"} missing on the server. ` +
    "Set them in your host's environment variables. This build reads them at runtime from /api/config, " +
    "so no redeploy is needed once they are set. Progress stays in localStorage until then."
  );
}
