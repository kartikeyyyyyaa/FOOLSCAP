"use client";

import type { Level } from "@/lib/prompt";

/**
 * How the same material should be delivered. Shared by Ask and Watch so the
 * two features cannot drift into offering different vocabularies for the same
 * idea, and so a student who learns the control once knows it everywhere.
 */
const OPTIONS: { id: Level; label: string; title: string }[] = [
  { id: "plain", label: "Normal", title: "Pitched at someone revising the topic" },
  { id: "eli5", label: "Simple", title: "Everyday words and one concrete analogy" },
  { id: "exam", label: "Exam answer", title: "Written the way it earns marks" },
  { id: "cram", label: "Cram", title: "Only what is likely to be examined" },
  { id: "tldr", label: "One line", title: "Thirty words at most" },
];

interface Props {
  value: Level;
  onChange: (level: Level) => void;
  disabled?: boolean;
}

export default function LevelPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="levels" role="group" aria-label="Explanation level">
      {OPTIONS.map((o) => (
        <button
          className="chip"
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
