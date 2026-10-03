import type { CSSProperties, ReactNode } from "react";
import { Clock } from "./Clock";
import { ConnectionBadge } from "./ConnectionBadge";
import type { FrameStatus } from "./status";
import styles from "./frame.module.css";

interface Props {
  safeAreaPx: number;
  clockTimeZone: string | null;
  status: FrameStatus | null;
  /** Small wordmark of the function pack on screen, opposite BeastDisplay. */
  packWordmark?: string;
  /** Short heading at top left, e.g. the layout name. */
  heading?: string;
  children: ReactNode;
}

/** Core kiosk frame: safe area, optional clock, connection badge, both wordmarks. */
export function KioskFrame({ safeAreaPx, clockTimeZone, status, packWordmark, heading, children }: Props) {
  const style = { "--safe": `calc(${safeAreaPx} * var(--u))` } as CSSProperties;
  return (
    <div className={styles.frame} style={style}>
      <header className={styles.top}>
        <div className={styles.heading}>{heading}</div>
        {status?.fixture ? <div className={styles.fixture}>Fixture data, not live</div> : null}
        <div className={styles.topRight}>
          {status ? <ConnectionBadge status={status} /> : null}
          {clockTimeZone ? <Clock timeZone={clockTimeZone} /> : null}
        </div>
      </header>
      <main className={styles.stage}>{children}</main>
      <footer className={styles.bottom}>
        <div className={styles.wordmark}>BeastDisplay</div>
        {packWordmark ? <div className={styles.packWordmark}>{packWordmark}</div> : null}
      </footer>
    </div>
  );
}
