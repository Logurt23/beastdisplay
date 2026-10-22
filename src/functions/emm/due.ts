import { dayDiff, monthDay, parseYmd } from "../../core/tz";
import type { Project } from "./types";

export type DueState = "overdue" | "today" | "soon" | "scheduled" | "later" | "none" | "done";

export interface DueView {
  state: DueState;
  /** Section 8 color. */
  color: string;
  /** Word shown beside the color, so color is never the only signal. */
  label: string;
  /** Whole days from today (negative = overdue). Null when there is no date. */
  days: number | null;
  /** Date struck through (status done). */
  strike: boolean;
}

/** Section 8 colors, exactly. */
export const DUE_COLORS: Record<DueState, string> = {
  overdue: "#ff4d4d",
  today: "#ffb020",
  soon: "#f2e35b",
  scheduled: "#3dd6c6",
  later: "#7aa2ff",
  none: "#8b93a7",
  done: "#6f7a72",
};

/** Worst-first order, used for calendar badges and the due buckets stat. */
export const DUE_ORDER: readonly DueState[] = ["overdue", "today", "soon", "scheduled", "later", "none", "done"];

/**
 * The one due-date function (section 8). Projects rows, the due rail and the
 * calendar markers all call this. `today` is the Chicago date, YYYY-MM-DD.
 */
export function dueState(dueOn: string | null, status: Project["status"], today: string): DueView {
  const valid = dueOn !== null && parseYmd(dueOn) !== null;
  if (status === "done") {
    return {
      state: "done",
      color: DUE_COLORS.done,
      label: valid ? monthDay(dueOn!) : "Done",
      days: valid ? dayDiff(today, dueOn!) : null,
      strike: valid,
    };
  }
  if (!valid) return { state: "none", color: DUE_COLORS.none, label: "None", days: null, strike: false };
  const days = dayDiff(today, dueOn!);
  let state: DueState;
  let label: string;
  if (days < 0) {
    state = "overdue";
    label = days === -1 ? "Overdue 1d" : `Overdue ${-days}d`;
  } else if (days === 0) {
    state = "today";
    label = "Today";
  } else if (days <= 3) {
    state = "soon";
    label = `${days}d`;
  } else if (days <= 14) {
    state = "scheduled";
    label = `${days}d`;
  } else {
    state = "later";
    label = monthDay(dueOn!);
  }
  return { state, color: DUE_COLORS[state], label, days, strike: false };
}

export function worstDue(states: DueState[]): DueState | null {
  let best: DueState | null = null;
  for (const st of states) {
    if (best === null || DUE_ORDER.indexOf(st) < DUE_ORDER.indexOf(best)) best = st;
  }
  return best;
}
