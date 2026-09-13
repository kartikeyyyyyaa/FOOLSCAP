"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "./supabase";

export interface AuthState {
  /** Supabase user id, or null when signed out or running without a database. */
  userId: string | null;
  email: string | null;
  ready: boolean;
  configured: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    userId: null,
    email: null,
    ready: !supabaseConfigured,
    configured: supabaseConfigured,
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({
        userId: data.session?.user.id ?? null,
        email: data.session?.user.email ?? null,
        ready: true,
        configured: true,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        ready: true,
        configured: true,
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return "Supabase is not configured on this deployment.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return "Supabase is not configured on this deployment.";
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signUp, signOut };
}
