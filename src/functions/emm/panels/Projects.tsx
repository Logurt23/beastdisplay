import { useMemo, useRef, type CSSProperties } from "react";
import { dueState } from "../due";
import { usePager, useRowsThatFit } from "../hooks";
import { sortProjects } from "../sort";
import type { Project } from "../types";
import styles from "../styles/emm.module.css";
import { firstName, STATUS_COLOR, STATUS_WORD } from "./labels";
import { Empty, Panel } from "./Panel";

export const PROJECT_ROW_PX = 46;

/** Section 6B. Pages inside the panel every 12 s; the document never scrolls. */
export function ProjectsPanel({ projects, today, lobbyMode }: { projects: readonly Project[]; today: string; lobbyMode: boolean }) {
  const sorted = useMemo(() => sortProjects(projects), [projects]);
  const listRef = useRef<HTMLDivElement>(null);
  const perPage = useRowsThatFit(listRef, PROJECT_ROW_PX, 6);
  const { page, pages, items } = usePager(sorted, perPage, 12_000, 0);
  const open = projects.filter((p) => p.status !== "done").length;

  return (
    <Panel title="Projects" meta={`${open} open`} page={page} pages={pages}>
      <div ref={listRef} className={styles.list}>
        {sorted.length === 0 ? (
          <Empty title="No projects" />
        ) : (
          <div key={page} className={styles.fadeIn}>
            {items.map((p) => (
              <ProjectRow key={p.id} p={p} today={today} lobbyMode={lobbyMode} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ProjectRow({ p, today, lobbyMode }: { p: Project; today: string; lobbyMode: boolean }) {
  const due = dueState(p.dueOn, p.status, today);
  const showClient = p.client && (!lobbyMode || p.lobbySafe);
  return (
    <div
      className={`${styles.projectRow} ${p.priority === "rush" ? styles.rush : ""}`}
      data-status={p.status}
      style={{ "--status": STATUS_COLOR[p.status], "--due": `var(--due-${due.state})` } as CSSProperties}
    >
      <div className={styles.projectName}>
        <span className={styles.projectTitle}>{p.name}</span>
        {showClient ? <span className={styles.projectClient}>{p.client}</span> : null}
      </div>
      <span className={styles.statusWord} title={p.rawStatus}>
        {STATUS_WORD[p.status]}
      </span>
      <span className={styles.assignee}>
        <span className={styles.initials}>{p.assignee?.initials ?? "—"}</span>
        <span className={styles.assigneeName}>{p.assignee ? firstName(p.assignee.name) : "Unassigned"}</span>
      </span>
      <span className={`${styles.dueWord} num ${due.strike ? styles.strike : ""}`}>{due.label}</span>
    </div>
  );
}
