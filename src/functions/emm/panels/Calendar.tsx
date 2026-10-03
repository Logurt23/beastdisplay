import { useMemo, type CSSProperties } from "react";
import { buildWeek } from "../calendar";
import type { Board } from "../types";
import styles from "../styles/emm.module.css";
import { Panel } from "./Panel";

const MAX_EVENTS = 2;

/** Section 6D. Monday-start Chicago week containing today; today pinned. */
export function CalendarPanel({ board, today, lobbyMode }: { board: Board; today: string; lobbyMode: boolean }) {
  const days = useMemo(() => buildWeek(today, board.projects, board.events), [today, board.projects, board.events]);
  return (
    <Panel title="This week">
      <div className={styles.week}>
        {days.map((d) => {
          const extra = d.events.length - MAX_EVENTS;
          return (
            <div key={d.date} className={`${styles.day} ${d.isToday ? styles.today : ""}`} data-date={d.date}>
              <div className={styles.dayHead}>
                <span className={styles.dayName}>{d.isToday ? "Today" : d.weekday}</span>
                <span className={`${styles.dayNum} num`}>{d.label}</span>
              </div>
              <div className={styles.dayEvents}>
                {lobbyMode ? (
                  d.events.length > 0 ? <div className={styles.dayEvent}>{d.events.length} events</div> : null
                ) : (
                  d.events.slice(0, MAX_EVENTS).map((e) => (
                    <div key={e.id} className={styles.dayEvent} data-kind={e.kind ?? undefined}>
                      <span className={`${styles.eventTime} num`}>{e.time}</span> {e.title}
                    </div>
                  ))
                )}
                {!lobbyMode && extra > 0 ? <div className={styles.more}>+{extra}</div> : null}
              </div>
              {d.dueCount > 0 && d.dueWorst ? (
                <div className={styles.dueBadge} style={{ "--due": `var(--due-${d.dueWorst})` } as CSSProperties} data-due={d.dueWorst}>
                  <span className="num">{d.dueCount}</span> due
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
