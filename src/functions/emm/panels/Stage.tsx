import { useMemo, useRef, type CSSProperties } from "react";
import { inStage } from "../board";
import { dueState } from "../due";
import { usePager, useRowsThatFit } from "../hooks";
import type { Project, Stage } from "../types";
import styles from "../styles/emm.module.css";
import { firstName } from "./labels";
import { Empty, Panel } from "./Panel";

export const STAGE_TITLE: Record<Stage, string> = {
  development: "New development",
  edits: "Edits",
  launch: "Push live",
  pending: "Pending",
};

const ROW_PX = 46;

/** One whiteboard section (Edits, Push Live, Pending) as a list with owner and due date. */
export function StagePanel({
  stage,
  projects,
  today,
  lobbyMode,
  columns = 1,
  offsetMs = 0,
}: {
  stage: Stage;
  projects: readonly Project[];
  today: string;
  lobbyMode: boolean;
  columns?: number;
  offsetMs?: number;
}) {
  const list = useMemo(() => inStage(projects, stage), [projects, stage]);
  const ref = useRef<HTMLDivElement>(null);
  const rows = useRowsThatFit(ref, ROW_PX, 4);
  const { page, pages, items } = usePager(list, rows * columns, 12_000, offsetMs);
  return (
    <Panel title={STAGE_TITLE[stage]} meta={String(list.length)} page={page} pages={pages} className={styles.stage}>
      <div ref={ref} className={styles.list} data-stage={stage}>
        {list.length === 0 ? (
          <Empty title="Clear" />
        ) : (
          <div key={page} className={`${styles.stageGrid} ${styles.fadeIn}`} style={{ "--cols": columns } as CSSProperties}>
            {items.map((p) => {
              const due = dueState(p.dueOn, p.status, today);
              const showClient = p.client && (!lobbyMode || p.lobbySafe);
              return (
                <div
                  key={p.id}
                  className={`${styles.stageRow} ${p.priority === "rush" ? styles.rush : ""}`}
                  style={{ "--due": `var(--due-${due.state})` } as CSSProperties}
                  data-due={due.state}
                >
                  <span className={styles.initials} title={p.assignee ? firstName(p.assignee.name) : "Unassigned"}>
                    {p.assignee?.initials ?? "—"}
                  </span>
                  <span className={styles.laneText}>
                    <span className={styles.laneTitle}>{p.name}</span>
                    {showClient ? <span className={styles.laneClient}>{p.client}</span> : null}
                  </span>
                  <span className={`${styles.laneDue} num`}>{due.state === "none" ? "" : due.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
