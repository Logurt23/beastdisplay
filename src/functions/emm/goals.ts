import type { Goal } from "./types";

export type GoalTone = "good" | "accent" | "hot";

export interface GoalView {
  /** 0..1 bar or ring fill. */
  fill: number;
  tone: GoalTone;
  /** Amount past target in the good direction, e.g. 2 for "+2 sites". 0 if not past. */
  beyond: number;
}

/**
 * Goal rules (section 6E, Phase 9, report 3.5):
 * up:   good when current >= target, accent otherwise.
 * down: good when current <= target, hot when current > target (inverse flips).
 * Fill is clamp(current / target, 0, 1); target <= 0 shows 0 fill.
 */
export function goalView(g: Pick<Goal, "current" | "target" | "goodDirection">): GoalView {
  const fill = g.target > 0 ? Math.min(1, Math.max(0, g.current / g.target)) : 0;
  if (g.goodDirection === "down") {
    const good = g.current <= g.target;
    return { fill, tone: good ? "good" : "hot", beyond: good ? g.target - g.current : 0 };
  }
  const good = g.current >= g.target;
  return { fill, tone: good ? "good" : "accent", beyond: good ? g.current - g.target : 0 };
}
