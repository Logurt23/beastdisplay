import { useEffect, useRef, type CSSProperties } from "react";
import { goalView } from "../goals";
import { useChangedFlag, usePager, useTween } from "../hooks";
import type { Goal } from "../types";
import styles from "../styles/emm.module.css";
import { Empty, Panel } from "./Panel";

const TONE_VAR = { good: "var(--good)", accent: "var(--cyan)", hot: "var(--hot)" } as const;

const fmt = (n: number, integer: boolean) =>
  integer ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** Section 6E. Values tick over 600 ms on payload change; no count-up on first paint. */
export function GoalsPanel({ goals, reduced, perPage = 4 }: { goals: readonly Goal[]; reduced: boolean; perPage?: number }) {
  const { page, pages, items } = usePager(goals, perPage, 12_000, 3_000);
  return (
    <Panel title="Goals" page={page} pages={pages}>
      {goals.length === 0 ? (
        <Empty title="No goals" detail="Goals are set in Nexus." />
      ) : (
        <div key={page} className={`${styles.goals} ${styles.fadeIn}`}>
          {items.map((g) => (
            <GoalRow key={g.id} goal={g} reduced={reduced} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function GoalRow({ goal, reduced }: { goal: Goal; reduced: boolean }) {
  const v = goalView(goal);
  const shown = useTween(goal.current, 600, reduced);
  const fill = useTween(v.fill, 600, reduced);
  const changed = useChangedFlag(goal.current, 10_000);
  const prev = usePrevious(goal.current);
  const integer = Number.isInteger(goal.current) && Number.isInteger(goal.target);
  const dir = changed && prev !== undefined ? (goal.current > prev ? "▲" : "▼") : null;
  return (
    <div className={styles.goal} data-tone={v.tone} style={{ "--tone": TONE_VAR[v.tone] } as CSSProperties}>
      <div className={styles.goalName}>{goal.name}</div>
      <div className={styles.goalNumbers}>
        <span className={`${styles.goalValue} num`}>{fmt(shown, integer)}</span>
        <span className={`${styles.goalTarget} num`}>
          / {fmt(goal.target, integer)} {goal.unit}
        </span>
        {v.beyond > 0 ? (
          <span className={`${styles.goalBeyond} num`}>
            {goal.goodDirection === "down" ? "−" : "+"}
            {fmt(v.beyond, integer)} {goal.unit}
          </span>
        ) : null}
        {dir && !reduced ? <span className={styles.goalGlyph}>{dir}</span> : null}
      </div>
      <div className={styles.goalBar}>
        <span style={{ transform: `scaleX(${fill})` }} />
      </div>
    </div>
  );
}

function usePrevious<T>(value: T): T | undefined {
  const cur = useRef<T>(value);
  const prev = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!Object.is(cur.current, value)) {
      prev.current = cur.current;
      cur.current = value;
    }
  }, [value]);
  return prev.current;
}
