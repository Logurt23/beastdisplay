import type { Project } from "./types";

/**
 * Projects panel order (section 6 Phase 6, report 3.5):
 * 1. rush or blocked first, then everything else, then done last
 * 2. dueOn ascending, null after dated
 * 3. name ascending
 */
export function projectGroup(p: Project): number {
  if (p.status === "done") return 2;
  if (p.priority === "rush" || p.status === "blocked") return 0;
  return 1;
}

const byDue = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
};

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort(
    (a, b) => projectGroup(a) - projectGroup(b) || byDue(a.dueOn, b.dueOn) || byName(a.name, b.name) || (a.id < b.id ? -1 : 1),
  );
}

/** Due rail order: dueOn ascending, null last, done after null. */
export function sortDueRail(projects: readonly Project[]): Project[] {
  const rank = (p: Project) => (p.status === "done" ? 2 : p.dueOn === null ? 1 : 0);
  return [...projects].sort(
    (a, b) => rank(a) - rank(b) || byDue(a.dueOn, b.dueOn) || byName(a.name, b.name) || (a.id < b.id ? -1 : 1),
  );
}
