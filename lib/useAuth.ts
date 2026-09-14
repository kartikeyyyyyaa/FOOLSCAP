"use client";

import { useCallback, useEffect, useState } from "react";
import {
  describeSupabaseConfig,
  getSupabase,
  supabaseConfiguredAtBuild,
} from "./supabase";

let warned = false;

export interface AuthState {
  /** Supabase user id, or null when signed out or running without a database. */
  userId: string | null;
  email: string | null;
  /** True once the config lookup and session check have both settled. */
  ready: boolean;
  /** True when accounts are available at all. */
  configured: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    userId: null,
    email: null,
    ready: false,
    // Optimistic only when the values were baked in. Otherwise it flips true
    // after /api/config answers, which is why `ready` gates the UI.
    configured: supabaseConfiguredAtBuild,
  });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const supabase = await getSupabase();

      if (!supabase) {
        if (!warned) {
          warned = true;
          console.warn(describeSupabaseConfig());
        }
        if (active) {
          setState({ userId: null, email: null, ready: true, configured: false });
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setState({
        userId: data.session?.user.id ?? null,
        email: data.session?.user.email ?? null,
        ready: true,
        configured: true,
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setState({
          userId: session?.user.id ?? null,
          email: session?.user.email ?? null,
          ready: true,
          configured: true,
        });
      });

      unsubscribe = () => sub.subscription.unsubscribe();
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabase();
    if (!supabase) return "Accounts are not available on this deployment.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabase();
    if (!supabase) return "Accounts are not available on this deployment.";
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await getSupabase();
    if (supabase) await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signUp, signOut };
}
