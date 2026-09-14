import { NextResponse } from "next/server";

/**
 * Public Supabase config, served at runtime.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so a
 * blank, mis-scoped or late-added variable fails silently and needs a rebuild
 * to fix. This endpoint reads the same settings on every request instead, so
 * changing them on the host takes effect immediately.
 *
 * It also accepts the names the Vercel Supabase integration provisions, which
 * differ from the hand-written ones and are not NEXT_PUBLIC_ prefixed, so the
 * browser could never see them on its own.
 *
 * Only the project URL and the publishable/anon key are returned. Both are
 * designed to be public and ship in the browser bundle anyway: row level
 * security is what protects the rows. The service role and secret keys are
 * deliberately never read here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "";

  const configured = Boolean(url.trim() && key.trim());

  return NextResponse.json(
    {
      supabase: configured ? { url: url.trim(), key: key.trim() } : null,
      // Named so a misconfigured deployment is diagnosable from the network
      // tab without redeploying anything.
      missing: configured
        ? []
        : [!url.trim() && "SUPABASE_URL", !key.trim() && "SUPABASE_ANON_KEY"].filter(Boolean),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
