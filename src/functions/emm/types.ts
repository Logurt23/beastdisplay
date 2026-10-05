/**
 * Section 7 data contract for GET /api/display/board, plus pulse.sourceStatus
 * (approved by Logan 2026-10-03). Field names must match Nexus exactly.
 */

export type ProjectStatus = "queued" | "active" | "waiting" | "review" | "blocked" | "done";
export type Priority = "low" | "normal" | "high" | "rush";
export type Tone = "up" | "down" | "flat";
export type SourceStatus = "live" | "unconfigured" | "error";
/**
 * Whiteboard section (added 2026-10-05 from the office whiteboard). Optional on
 * the wire; when Nexus leaves it out the display derives it from status.
 */
export type Stage = "development" | "edits" | "launch" | "pending";

export interface PulseTile {
  id: string;
  label: string;
  value: number;
  display: string;
  delta: number | null;
  deltaLabel: string | null;
  tone: Tone | "unknown";
  source: string;
}

export interface TickerItem {
  id: string;
  at: string;
  text: string;
  tone: string;
}

export interface Assignee {
  id: string;
  name: string;
  initials: string;
}

export interface Project {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus | "unknown";
  /** Raw value from Nexus when status was not one of the six known words. */
  rawStatus?: string;
  priority: Priority;
  assignee: Assignee | null;
  /** YYYY-MM-DD, or null for none. A date, not an instant. */
  dueOn: string | null;
  lobbySafe: boolean;
  /** Whiteboard section. From Nexus `stage`, or derived from status. */
  stage: Stage;
  /** Order in the assignee's queue (1 = next up), from Nexus `rank`. Null if unranked. */
  rank: number | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  kind: string | null;
}

export interface Goal {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
  goodDirection: "up" | "down";
  updatedAt: string | null;
}

export interface Board {
  generatedAt: string | null;
  timezone: string;
  staleAfterSeconds: number;
  pulse: {
    tiles: PulseTile[];
    ticker: TickerItem[];
    /** Absent from older Nexus builds; normalize() infers it from empty tiles. */
    sourceStatus: SourceStatus;
  };
  projects: Project[];
  events: CalendarEvent[];
  goals: Goal[];
  /** Set when the payload carries a _fixture or _seed label. Shown on screen. */
  fixture: boolean;
}
