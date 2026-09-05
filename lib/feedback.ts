import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type FeedbackEntry = {
  readonly note: string;
  readonly role?: string;
  readonly company?: string;
};

export function feedbackLogPath(): string {
  return path.join(process.cwd(), "evals", "user-feedback.md");
}

export function formatFeedbackLine(entry: FeedbackEntry, at = new Date()): string {
  const date = at.toISOString().slice(0, 10);
  const note = entry.note.replace(/\|/g, "/").replace(/\n/g, " ").trim();
  const role = (entry.role ?? "").replace(/\|/g, "/");
  const company = (entry.company ?? "").replace(/\|/g, "/");
  return `| ${date} | anonymous | ${company} / ${role} | ${note} | |\n`;
}

export async function recordFeedback(entry: FeedbackEntry): Promise<string> {
  const line = formatFeedbackLine(entry);
  const file = feedbackLogPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, line, "utf8");
  return line;
}
