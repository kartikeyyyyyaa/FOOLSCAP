"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";

const KEY = "foolscap.theme";

/** Applies the choice by stamping the root, which the token blocks key off. */
function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");
  const [dark, setDark] = useState(false);

  // Read the stored choice after mount. The inline script in layout.tsx has
  // already stamped the root, so there is nothing to correct here, only state
  // to catch up with.
  useEffect(() => {
    let stored: Choice = "system";
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {
      // Blocked storage just means the system preference wins.
    }
    setChoice(stored);
    setDark(stored === "dark" || (stored === "system" && systemPrefersDark()));
  }, []);

  // Follow the OS while the user has not made an explicit choice.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const toggle = () => {
    const next: Choice = dark ? "light" : "dark";
    setChoice(next);
    setDark(next === "dark");
    apply(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // The page still changes; it just will not be remembered.
    }
  };

  return (
    <button
      className="theme-btn"
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to the light theme" : "Switch to the dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? (
        // Sun: switching back to light
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
        </svg>
      ) : (
        // Moon: switching to dark
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z" />
        </svg>
      )}
    </button>
  );
}
