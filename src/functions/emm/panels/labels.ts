import type { Project } from "../types";

export const STATUS_WORD: Record<Project["status"], string> = {
  queued: "Queued",
  active: "Active",
  waiting: "Waiting",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
  unknown: "Unknown",
};

/** CSS variable per status. Not in the order's palette table; built from section 9 accents. */
export const STATUS_COLOR: Record<Project["status"], string> = {
  queued: "var(--muted)",
  active: "var(--cyan)",
  waiting: "var(--amber)",
  review: "var(--due-later)",
  blocked: "var(--hot)",
  done: "var(--due-done)",
  unknown: "var(--muted)",
};

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
