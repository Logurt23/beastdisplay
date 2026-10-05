import { useMemo, useRef, type CSSProperties } from "react";
import { developmentLanes, type Lane } from "../board";
import { dueState } from "../due";
import { usePager, useRowsThatFit } from "../hooks";
import type { Project } from "../types";
import styles from "../styles/emm.module.css";
import { firstName } from "./labels";

const MAX_LANES = 4;
const MAX_CARDS = 5;
/** Card height plus gap, 1080p px. */
const CARD_PX = 62;

/**
 * Who's on what: the whiteboard's New Development section as one lane per
 * person, each with their numbered queue. More people than fit page every 12 s.
 */
export function Lanes({ projects, today, lobbyMode }: { projects: readonly Project[]; today: string; lobbyMode: boolean }) {
  const lanes = useMemo(() => developmentLanes(projects), [projects]);
  const { page, pages, items } = usePager(lanes, MAX_LANES, 12_000, 9_000);
  if (lanes.length === 0) return <div className={styles.lanesEmpty}>No development work queued</div>;
  return (
    <div className={styles.lanesWrap} aria-label="Who's on what">
      <div className={styles.lanesHead}>
        <span>New development</span>
        {pages > 1 ? (
          <span className={styles.dots} aria-label={`Page ${page + 1} of ${pages}`}>
            {Array.from({ length: pages }, (_, i) => (
              <span key={i} className={i === page ? styles.dotOn : styles.dot} />
            ))}
          </span>
        ) : null}
      </div>
      <div key={page} className={`${styles.lanes} ${styles.fadeIn}`} style={{ "--lanes": MAX_LANES } as CSSProperties}>
        {items.map((lane) => (
          <LaneColumn key={lane.id} lane={lane} today={today} lobbyMode={lobbyMode} />
        ))}
      </div>
    </div>
  );
}

function LaneColumn({ lane, today, lobbyMode }: { lane: Lane; today: string; lobbyMode: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = Math.min(MAX_CARDS, useRowsThatFit(ref, CARD_PX, 3));
  const shown = lane.projects.slice(0, fit);
  const more = lane.projects.length - shown.length;
  return (
    <div className={styles.lane} data-lane={lane.id}>
      <div className={styles.laneHead}>
        <span className={styles.laneInitials}>{lane.assignee?.initials ?? "—"}</span>
        <span className={styles.laneName}>{lane.assignee ? firstName(lane.assignee.name) : "Unassigned"}</span>
        <span className={`${styles.laneCount} num`}>{lane.projects.length}</span>
      </div>
      <div ref={ref} className={styles.laneBody}>
        {shown.map((p, i) => {
          const due = dueState(p.dueOn, p.status, today);
          const showClient = p.client && (!lobbyMode || p.lobbySafe);
          return (
            <div
              key={p.id}
              className={`${styles.laneCard} ${p.priority === "rush" ? styles.rush : ""}`}
              style={{ "--due": `var(--due-${due.state})` } as CSSProperties}
              data-status={p.status}
            >
              <span className={`${styles.laneRank} num`}>{p.rank ?? i + 1}</span>
              <span className={styles.laneText}>
                <span className={styles.laneTitle}>{p.name}</span>
                <span className={styles.laneSub}>
                  <span className={styles.laneClient}>{showClient ? p.client : ""}</span>
                  <span className={`${styles.laneDue} num`}>{due.state === "none" ? "" : due.label}</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.laneMore}>{more > 0 ? `+${more} more` : ""}</div>
    </div>
  );
}
