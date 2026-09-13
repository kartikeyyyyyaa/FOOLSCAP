"use client";

import { useState } from "react";

interface Props {
  configured: boolean;
  userId: string | null;
  email: string | null;
  demo: boolean;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<string | null>;
  onSignOut: () => void;
  onDemo: () => void;
}

export default function AuthBar({
  configured,
  userId,
  email,
  demo,
  onSignIn,
  onSignUp,
  onSignOut,
  onDemo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [emailValue, setEmailValue] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const err = mode === "in" ? await onSignIn(emailValue, password) : await onSignUp(emailValue, password);
    setBusy(false);

    if (err) {
      setMessage(err);
      return;
    }
    if (mode === "up") {
      setMessage("Account created. Check your inbox if confirmation is switched on, then sign in.");
      setMode("in");
      return;
    }
    setOpen(false);
    setPassword("");
  };

  if (userId) {
    return (
      <div className="authbar">
        <span className="auth-state">
          <span className="pill" data-tone="proved">
            Synced
          </span>
          {email}
        </span>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="authbar">
      <span className="auth-state">
        <span className="pill" data-tone={demo ? "shaky" : "idle"}>
          {demo ? "Demo data" : "This browser"}
        </span>
        {demo
          ? "Illustrative history, not a real student"
          : configured
            ? "Progress stays on this device until you sign in"
            : "Progress stays on this device"}
      </span>

      <div className="auth-actions">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onDemo}>
          {demo ? "Clear demo" : "Try the demo"}
        </button>
        {configured && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Sign in"}
          </button>
        )}
      </div>

      {open && configured && (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="field">
            <label htmlFor="authEmail">Email</label>
            <input
              id="authEmail"
              className="text"
              type="email"
              required
              autoComplete="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="authPassword">Password</label>
            <input
              id="authPassword"
              className="text"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-submit">
            <button className="btn btn-fill btn-sm" type="submit" disabled={busy}>
              {busy ? "Working" : mode === "in" ? "Sign in" : "Create account"}
            </button>
            <button
              className="btn-text"
              type="button"
              onClick={() => {
                setMode((m) => (m === "in" ? "up" : "in"));
                setMessage(null);
              }}
            >
              {mode === "in" ? "Create an account" : "I already have one"}
            </button>
          </div>

          {message && <p className="field-help">{message}</p>}
        </form>
      )}
    </div>
  );
}
