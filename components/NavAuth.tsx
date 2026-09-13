"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

/**
 * Auth in the page header, which is where people look for it.
 *
 * The same control also exists inside the Progress panel, next to the data it
 * governs. Both read one Supabase session, so signing in from either updates
 * the other.
 */
export default function NavAuth() {
  const { configured, userId, email, signIn, signUp, signOut } = useAuth();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [emailValue, setEmailValue] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPassword("");
    setNote(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Nothing to offer when the deployment has no database.
  if (!configured) return null;

  if (userId) {
    return (
      <div className="nav-auth">
        <span className="nav-who">{email}</span>
        <a className="btn btn-ghost btn-sm" href="/dashboard">
          Ledger
        </a>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setNote(null);

    const err = mode === "in" ? await signIn(emailValue, password) : await signUp(emailValue, password);
    setBusy(false);

    if (err) {
      setNote({ text: err, error: true });
      return;
    }
    if (mode === "up") {
      setMode("in");
      setNote({ text: "Account created. Sign in with it now.", error: false });
      return;
    }
    close();
  };

  return (
    <div className="nav-auth">
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)}>
        Sign in
      </button>

      {open && (
        <div
          className="scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="authTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <h2 className="modal-title" id="authTitle">
                  {mode === "in" ? "Sign in" : "Create an account"}
                </h2>
                <p className="modal-sub">
                  Your ledger follows you between devices. Everything you have already answered on
                  this one comes with you.
                </p>
              </div>
              <button className="modal-x" type="button" onClick={close} aria-label="Close">
                &times;
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="field">
                <label htmlFor="navEmail">Email</label>
                <input
                  id="navEmail"
                  className="text"
                  type="email"
                  required
                  autoComplete="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="navPassword">Password</label>
                <input
                  id="navPassword"
                  className="text"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="field-help">At least six characters.</p>
              </div>

              <div className="modal-foot">
                <button className="btn btn-fill" type="submit" disabled={busy}>
                  {busy ? "Working" : mode === "in" ? "Sign in" : "Create account"}
                </button>
                <button
                  className="btn-text"
                  type="button"
                  onClick={() => {
                    setMode((m) => (m === "in" ? "up" : "in"));
                    setNote(null);
                  }}
                >
                  {mode === "in" ? "Create an account" : "I already have one"}
                </button>
              </div>

              {note && (
                <p className="modal-note" data-tone={note.error ? "error" : undefined}>
                  {note.text}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
