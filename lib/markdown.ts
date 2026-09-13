import type { RevisionSheet } from "./types";

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];

/** Shareable export: notes, quiz, and a separated answer key. */
export function sheetToMarkdown(sheet: RevisionSheet): string {
  const lines: string[] = [];

  lines.push(`# ${sheet.title}`, "");
  if (sheet.subject) lines.push(`*${sheet.subject}*`, "");
  lines.push(sheet.overview, "");

  if (sheet.concepts.length) {
    lines.push("## Key terms", "");
    for (const c of sheet.concepts) {
      lines.push(`**${c.term}**  `, c.definition, "");
    }
  }

  for (const section of sheet.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const point of section.points) lines.push(`- ${point}`);
    lines.push("");
  }

  if (sheet.memorize.length) {
    lines.push("## Commit to memory", "");
    for (const item of sheet.memorize) lines.push(`- ${item}`);
    lines.push("");
  }

  if (sheet.traps.length) {
    lines.push("## Where marks get lost", "");
    for (const item of sheet.traps) lines.push(`- ${item}`);
    lines.push("");
  }

  if (sheet.quiz.length) {
    lines.push("## Practice quiz", "");
    sheet.quiz.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`);
      q.options.forEach((opt, oi) => lines.push(`   ${OPTION_KEYS[oi]}) ${opt}`));
      lines.push("");
    });
    lines.push("### Answer key", "");
    sheet.quiz.forEach((q, i) => {
      lines.push(`${i + 1}. ${OPTION_KEYS[q.answerIndex]}. ${q.explanation}`);
    });
    lines.push("");
  }

  lines.push("---", "Made with Foolscap.");
  return lines.join("\n");
}

export function filenameFor(sheet: RevisionSheet): string {
  const stem =
    sheet.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "revision";
  return `${stem}.md`;
}
