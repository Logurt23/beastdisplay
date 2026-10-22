import { sortProjects } from "./sort";
import type { Assignee, CalendarEvent, Project, Stage } from "./types";

/**
 * Whiteboard views (2026-10-05). The office whiteboard has four sections:
 * New Development (a numbered queue per person), Edits, Push Live and Pending.
 */

export interface Lane {
  id: string;
  assignee: Assignee | null;
  projects: Project[];
}

const byRank = (a: Project, b: Project) => {
  if (a.rank !== b.rank) {
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  }
  return 0;
};

/** True when `who` (a config entry: assignee id or first name) names this assignee. Case-insensitive. */
export function matchesPerson(a: Assignee, who: string): boolean {
  const w = who.trim().toLowerCase();
  return w !== "" && (a.id.toLowerCase() === w || a.name.toLowerCase() === w || (a.name.split(/\s+/)[0] ?? "").toLowerCase() === w);
}

/**
 * One lane per person with their open development projects, in queue order:
 * rank first (unranked after), then the Projects sort.
 *
 * With `developers` set (config `functions.emm.developers`), there is exactly
 * one lane per developer in that order, shown even when empty; development
 * work assigned to anyone else is left out (it still shows in Team today),
 * and unassigned work gets no lane (the header counts it instead).
 * Without it, everyone with development work gets a lane, busiest first, and
 * unassigned work is its own lane at the end.
 */
export function developmentLanes(projects: readonly Project[], developers: readonly string[] = []): Lane[] {
  const open = sortProjects(projects.filter((p) => p.stage === "development" && p.status !== "done"));
  const map = new Map<string, Lane>();
  for (const p of open) {
    const id = p.assignee?.id ?? "__unassigned";
    const lane = map.get(id) ?? { id, assignee: p.assignee, projects: [] };
    lane.projects.push(p);
    map.set(id, lane);
  }
  const all = [...map.values()];
  for (const l of all) l.projects.sort((a, b) => byRank(a, b) || open.indexOf(a) - open.indexOf(b));
  const unassigned = all.filter((l) => !l.assignee);

  if (developers.length > 0) {
    const lanes = developers.map((who): Lane => {
      const hit = all.find((l) => l.assignee && matchesPerson(l.assignee, who));
      if (hit) return hit;
      const name = who.trim();
      return { id: `__dev_${name.toLowerCase()}`, assignee: { id: name, name, initials: name.slice(0, 1).toUpperCase() }, projects: [] };
    });
    return lanes;
  }

  const named = all.filter((l) => l.assignee);
  named.sort(
    (a, b) => b.projects.length - a.projects.length || (a.assignee?.name ?? "").localeCompare(b.assignee?.name ?? ""),
  );
  return [...named, ...unassigned];
}

/** Open development work with nobody on it. */
export function unassignedDevelopment(projects: readonly Project[]): number {
  return projects.filter((p) => p.stage === "development" && p.status !== "done" && !p.assignee).length;
}

export function inStage(projects: readonly Project[], stage: Stage): Project[] {
  return sortProjects(projects.filter((p) => p.stage === stage && p.status !== "done"));
}

/** Open projects due today (Chicago date), plus how many are already overdue. */
export function dueToday(projects: readonly Project[], today: string): { today: Project[]; overdue: number } {
  const open = projects.filter((p) => p.status !== "done" && p.dueOn !== null);
  return {
    today: sortProjects(open.filter((p) => p.dueOn === today)),
    overdue: open.filter((p) => p.dueOn! < today).length,
  };
}

/**
 * "Projects today" tile: open work on the board that is not parked in Pending,
 * plus how many of those are due today.
 */
export function projectsToday(projects: readonly Project[], today: string): { count: number; dueToday: number } {
  const open = projects.filter((p) => p.status !== "done" && p.stage !== "pending");
  return { count: open.length, dueToday: open.filter((p) => p.dueOn === today).length };
}

export interface NextEvent {
  id: string;
  title: string;
  /** Chicago start instant, ms. */
  startsAt: number;
  endsAt: number;
  /** True when the event has already started. */
  now: boolean;
}

export interface PersonDay {
  id: string;
  assignee: Assignee;
  /** What this person should work on, most urgent first. */
  tasks: Project[];
  next: NextEvent | null;
}

const STAGE_ORDER: Record<Stage, number> = { launch: 0, edits: 1, development: 2, pending: 3 };
const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

/**
 * Person-based overview: one entry per person with open work or an event.
 * Tasks: due today or overdue first, then Push live, Edits, their development
 * queue by rank, and Pending last. Next event: the first one this person is in
 * (or a whole-team event) that has not ended, within the next 7 days.
 */
export function teamToday(projects: readonly Project[], events: readonly CalendarEvent[], today: string, nowMs: number): PersonDay[] {
  const people = new Map<string, PersonDay>();
  const person = (a: Assignee) => {
    let d = people.get(a.id);
    if (!d) people.set(a.id, (d = { id: a.id, assignee: a, tasks: [], next: null }));
    return d;
  };
  const open = sortProjects(projects.filter((p) => p.status !== "done" && p.assignee));
  for (const p of open) person(p.assignee!).tasks.push(p);
  const urgent = (p: Project) => (p.dueOn !== null && p.dueOn <= today ? 0 : 1);
  for (const d of people.values()) {
    d.tasks.sort(
      (a, b) =>
        urgent(a) - urgent(b) ||
        STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
        byRank(a, b) ||
        open.indexOf(a) - open.indexOf(b),
    );
  }

  const upcoming = events
    .map((e) => {
      const start = Date.parse(e.startsAt);
      let end = e.endsAt ? Date.parse(e.endsAt) : start + HOUR;
      if (!(end > start)) end = start + HOUR;
      return { e, start, end };
    })
    .filter(({ start, end }) => end > nowMs && start < nowMs + WEEK)
    .sort((a, b) => a.start - b.start);
  for (const { e } of upcoming) for (const a of e.people) person(a);
  for (const d of people.values()) {
    const hit = upcoming.find(({ e }) => e.people.length === 0 || e.people.some((a) => a.id === d.id));
    if (hit) d.next = { id: hit.e.id, title: hit.e.title, startsAt: hit.start, endsAt: hit.end, now: hit.start <= nowMs };
  }

  return [...people.values()].sort(
    (a, b) => b.tasks.length - a.tasks.length || a.assignee.name.localeCompare(b.assignee.name),
  );
}
