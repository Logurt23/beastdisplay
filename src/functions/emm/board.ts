import { sortProjects } from "./sort";
import type { Assignee, Project, Stage } from "./types";

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

/**
 * One lane per person with their open development projects, in queue order:
 * rank first (unranked after), then the Projects sort. People with the most
 * work come first; unassigned work is its own lane at the end.
 */
export function developmentLanes(projects: readonly Project[]): Lane[] {
  const open = sortProjects(projects.filter((p) => p.stage === "development" && p.status !== "done"));
  const map = new Map<string, Lane>();
  for (const p of open) {
    const id = p.assignee?.id ?? "__unassigned";
    const lane = map.get(id) ?? { id, assignee: p.assignee, projects: [] };
    lane.projects.push(p);
    map.set(id, lane);
  }
  const lanes = [...map.values()];
  for (const l of lanes) l.projects.sort((a, b) => byRank(a, b) || open.indexOf(a) - open.indexOf(b));
  return lanes.sort((a, b) => {
    if (!a.assignee !== !b.assignee) return a.assignee ? -1 : 1;
    return b.projects.length - a.projects.length || (a.assignee?.name ?? "").localeCompare(b.assignee?.name ?? "");
  });
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
