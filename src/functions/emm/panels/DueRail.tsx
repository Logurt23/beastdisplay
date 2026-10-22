import { useMemo, useRef, type CSSProperties } from "react";
import { dueState } from "../due";
import { usePager, useRowsThatFit } from "../hooks";
import { sortDueRail } from "../sort";
import type { Project } from "../types";
import styles from "../styles/emm.module.css";
import { Empty, Panel } from "./Panel";

export const DUE_ROW_PX = 46;

/** Section 6C. Same records as Projects, by due date, colored by section 8. Pages offset 6 s from Projects. */
export function DueRail({ projects, today }: { projects: readonly Project[]; today: string }) {
  const sorted = useMemo(() => sortDueRail(projects), [projects]);
  const listRef = useRef<HTMLDivElement>(null);
  const perPage = useRowsThatFit(listRef, DUE_ROW_PX, 6);
  const { page, pages, items } = usePager(sorted, perPage, 12_000, 6_000);

  return (
    <Panel title="Due" page={page} pages={pages}>
      <div ref={listRef} className={styles.list}>
        {sorted.length === 0 ? (
          <Empty title="No projects" />
        ) : (
          <div key={page} className={styles.fadeIn}>
            {items.map((p) => {
              const due = dueState(p.dueOn, p.status, today);
              return (
                <div
                  key={p.id}
                  className={`${styles.dueRow} ${p.priority === "rush" ? styles.rush : ""}`}
                  data-due={due.state}
                  style={{ "--due": `var(--due-${due.state})` } as CSSProperties}
                >
                  <span className={`${styles.dueWord} num ${due.strike ? styles.strike : ""}`}>{due.label}</span>
                  <span className={styles.dueName}>{p.name}</span>
                  <span className={styles.initials}>{p.assignee?.initials ?? "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
