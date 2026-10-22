import { dueState, DUE_ORDER, type DueState } from "./due";
import type { Project, ProjectStatus, PulseTile } from "./types";

/**
 * The 8 current stats from docs/functions/emm-statistics.md. Only these are on
 * the board. The 17 proposed stats are not built until Logan marks them in;
 * to add one, put its id here and in the doc in the same change.
 *
 * 1 leads_today         Mothership tile (via Nexus pulse.tiles)
 * 2 pulse_delta         delta / deltaLabel on each Mothership tile, not its own tile
 * 3 events_ticker       pulse.ticker
 * 4 projects_by_status  derived from projects[]
 * 5 assignee_load       derived from projects[]
 * 6 due_buckets         derived from projects[] with the section 8 due function
 * 7 week_calendar_load  the Calendar panel
 * 8 goal_progress       the Goals panel
 */
export const CURRENT_STATS = [
  "leads_today",
  "pulse_delta",
  "events_ticker",
  "projects_by_status",
  "assignee_load",
  "due_buckets",
  "week_calendar_load",
  "goal_progress",
] as const;

/** Pulse tiles Nexus may send that the board renders. Anything else is ignored. */
export const MOTHERSHIP_TILE_IDS: ReadonlySet<string> = new Set(["leads_today"]);

export interface TileFilter {
  shown: PulseTile[];
  ignored: string[];
}

export function filterTiles(tiles: readonly PulseTile[]): TileFilter {
  const shown: PulseTile[] = [];
  const ignored: string[] = [];
  for (const t of tiles) {
    if (MOTHERSHIP_TILE_IDS.has(t.id)) shown.push(t);
    else ignored.push(t.id);
  }
  return { shown, ignored };
}

export const STATUS_ORDER: readonly ProjectStatus[] = ["queued", "active", "waiting", "review", "blocked", "done"];

/** Stat 4: counts for each status. Unknown statuses are counted separately. */
export function projectsByStatus(projects: readonly Project[]): { status: ProjectStatus | "unknown"; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of projects) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  const rows: { status: ProjectStatus | "unknown"; count: number }[] = STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 }));
  const unknown = counts.get("unknown") ?? 0;
  if (unknown > 0) rows.push({ status: "unknown", count: unknown });
  return rows;
}

/** Stat 5: open (not done) projects per assignee, highest first. */
export function assigneeLoad(projects: readonly Project[]): { id: string; name: string; initials: string; open: number }[] {
  const map = new Map<string, { id: string; name: string; initials: string; open: number }>();
  for (const p of projects) {
    if (p.status === "done") continue;
    const key = p.assignee?.id ?? "__unassigned";
    const row = map.get(key) ?? {
      id: key,
      name: p.assignee?.name ?? "Unassigned",
      initials: p.assignee?.initials ?? "—",
      open: 0,
    };
    row.open += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

/** Stat 6: overdue, today, soon, scheduled, later, none. Done projects are not due. */
export const DUE_BUCKETS: readonly DueState[] = DUE_ORDER.filter((s) => s !== "done");

export function dueBuckets(projects: readonly Project[], today: string): { state: DueState; count: number }[] {
  const counts = new Map<DueState, number>();
  for (const p of projects) {
    if (p.status === "done") continue;
    const st = dueState(p.dueOn, p.status, today).state;
    counts.set(st, (counts.get(st) ?? 0) + 1);
  }
  return DUE_BUCKETS.map((state) => ({ state, count: counts.get(state) ?? 0 }));
}
