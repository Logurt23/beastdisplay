import { useMemo } from "react";
import { dueToday } from "../board";
import { usePager } from "../hooks";
import type { Project } from "../types";
import styles from "../styles/emm.module.css";
import { firstName, STATUS_COLOR, STATUS_WORD } from "./labels";

/** Everything due today, Chicago date, with who owns it. Overdue shows as a count, not mixed in. */
export function DueToday({ projects, today, lobbyMode, perPage = 4 }: { projects: readonly Project[]; today: string; lobbyMode: boolean; perPage?: number }) {
  const { today: list, overdue } = useMemo(() => dueToday(projects, today), [projects, today]);
  const { page, items } = usePager(list, perPage, 12_000, 4_000);
  return (
    <div className={styles.dueToday} aria-label="Due today">
      <div className={styles.dueTodayHead}>
        <span>Due today</span>
        <span className={`${styles.dueTodayCount} num`}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className={styles.dueTodayEmpty}>Nothing due today</div>
      ) : (
        <div key={page} className={styles.fadeIn}>
          {items.map((p) => (
            <div key={p.id} className={`${styles.dueTodayRow} ${p.priority === "rush" ? styles.rush : ""}`}>
              <span className={styles.initials}>{p.assignee?.initials ?? "—"}</span>
              <span className={styles.laneText}>
                <span className={styles.laneTitle}>{p.name}</span>
                <span className={styles.laneClient}>
                  {p.assignee ? firstName(p.assignee.name) : "Unassigned"}
                  {p.client && (!lobbyMode || p.lobbySafe) ? ` · ${p.client}` : ""}
                </span>
              </span>
              <span className={styles.statusWord} style={{ color: STATUS_COLOR[p.status] }}>
                {STATUS_WORD[p.status]}
              </span>
            </div>
          ))}
        </div>
      )}
      {overdue > 0 ? <div className={styles.dueTodayOverdue}>+ {overdue} overdue</div> : null}
    </div>
  );
}
