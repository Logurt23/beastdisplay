import { useMemo, type CSSProperties } from "react";
import { buildWeek } from "../calendar";
import type { Board } from "../types";
import styles from "../styles/emm.module.css";
import { LoopList } from "./LoopList";
import { Panel } from "./Panel";

const MAX_EVENTS = 2;
/** One event (two lines) plus the gap, 1080p px. */
const EVENT_PX = 48;

/** Section 6D. Monday-start Chicago week containing today; today pinned. */
export function CalendarPanel({ board, today, lobbyMode }: { board: Board; today: string; lobbyMode: boolean }) {
  const days = useMemo(() => buildWeek(today, board.projects, board.events), [today, board.projects, board.events]);
  return (
    <Panel title="This week">
      <div className={styles.week}>
        {days.map((d) => {
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
                  <LoopList
                    items={d.events}
                    fit={MAX_EVENTS}
                    rowPx={EVENT_PX}
                    holdMs={5_000}
                    className={styles.dayEventList}
                    keyOf={(e) => e.id}
                    render={(e) => (
                      <div className={styles.dayEvent} data-kind={e.kind ?? undefined}>
                        <span className={`${styles.eventTime} num`}>{e.time}</span> {e.title}
                      </div>
                    )}
                  />
                )}
              </div>
              <div className={styles.dayFoot}>
                {d.dueCount > 0 && d.dueWorst ? (
                  <div className={styles.dueBadge} style={{ "--due": `var(--due-${d.dueWorst})` } as CSSProperties} data-due={d.dueWorst}>
                    <span className="num">{d.dueCount}</span> due
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
