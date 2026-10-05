import { useMemo, useRef, type CSSProperties } from "react";
import { teamToday, type NextEvent, type PersonDay } from "../board";
import { dueState } from "../due";
import { useNow, usePager, useRowsThatFit } from "../hooks";
import { chicagoDate, chicagoTime } from "../time";
import { weekdayShort } from "../../../core/tz";
import type { Project, Stage } from "../types";
import styles from "../styles/emm.module.css";
import { firstName } from "./labels";
import { Empty, Panel } from "./Panel";

const PER_PAGE = 5;
/** Task row height plus gap, 1080p px. */
const TASK_PX = 36;

const STAGE_TAG: Record<Stage, string> = { development: "Dev", edits: "Edit", launch: "Live", pending: "Hold" };

/**
 * Team today: one card per person with what they should be doing today and
 * what's next on their calendar, so anyone glancing at the screen knows who is
 * on what. Pages every 12 s when more people than fit.
 */
export function TeamTodayPanel({
  projects,
  events,
  today,
  lobbyMode,
  perPage = PER_PAGE,
}: {
  projects: readonly Project[];
  events: Parameters<typeof teamToday>[1];
  today: string;
  lobbyMode: boolean;
  perPage?: number;
}) {
  const now = useNow();
  const people = useMemo(() => teamToday(projects, events, today, now), [projects, events, today, now]);
  const { page, pages, items } = usePager(people, perPage, 12_000, 2_000);
  return (
    <Panel title="Team today" page={page} pages={pages}>
      {people.length === 0 ? (
        <Empty title="Nobody has work or events today" />
      ) : (
        <div key={page} className={`${styles.team} ${styles.fadeIn}`} style={{ "--people": Math.max(3, Math.min(perPage, people.length)) } as CSSProperties}>
          {items.map((d) => (
            <PersonCard key={d.id} day={d} today={today} lobbyMode={lobbyMode} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function nextLabel(n: NextEvent, today: string): string {
  if (n.now) return "Now";
  const date = chicagoDate(n.startsAt);
  return date === today ? chicagoTime(n.startsAt) : `${weekdayShort(date)} ${chicagoTime(n.startsAt)}`;
}

function PersonCard({ day, today, lobbyMode }: { day: PersonDay; today: string; lobbyMode: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useRowsThatFit(ref, TASK_PX, 3);
  const shown = day.tasks.slice(0, fit);
  const more = day.tasks.length - shown.length;
  const dueNow = day.tasks.filter((p) => p.dueOn !== null && p.dueOn <= today).length;
  return (
    <div className={styles.person} data-person={day.id}>
      <div className={styles.laneHead}>
        <span className={styles.laneInitials}>{day.assignee.initials}</span>
        <span className={styles.laneName}>{firstName(day.assignee.name)}</span>
        {dueNow > 0 ? <span className={`${styles.personDue} num`}>{dueNow} due</span> : null}
      </div>
      <div className={styles.personNext} data-now={day.next?.now ? "true" : undefined}>
        {day.next ? (
          <>
            <span className={`${styles.personNextTime} num`}>{nextLabel(day.next, today)}</span>
            <span className={styles.personNextTitle}>{lobbyMode ? "Event" : day.next.title}</span>
          </>
        ) : (
          <span className={styles.personNextNone}>No events coming up</span>
        )}
      </div>
      <div ref={ref} className={styles.personTasks}>
        {shown.length === 0 ? <div className={styles.personNextNone}>No open tasks</div> : null}
        {shown.map((p) => {
          const due = dueState(p.dueOn, p.status, today);
          return (
            <div
              key={p.id}
              className={`${styles.personTask} ${p.priority === "rush" ? styles.rush : ""}`}
              style={{ "--due": `var(--due-${due.state})` } as CSSProperties}
              data-stage={p.stage}
            >
              <span className={styles.stageTag}>{STAGE_TAG[p.stage]}</span>
              <span className={styles.laneTitle}>{p.name}</span>
              <span className={`${styles.laneDue} num`}>{due.state === "none" ? "" : due.label}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.laneMore}>{more > 0 ? `+${more} more` : ""}</div>
    </div>
  );
}
