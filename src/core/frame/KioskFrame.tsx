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
  /** Pack id on screen; packs scope their brand tokens with [data-pack]. */
  packId?: string;
  /** Pack logo shown beside the heading. Falls back to the wordmark text. */
  packLogo?: string;
  children: ReactNode;
}

/** Core kiosk frame: safe area, optional clock, connection badge, both wordmarks. */
export function KioskFrame({ safeAreaPx, clockTimeZone, status, packWordmark, heading, packId, packLogo, children }: Props) {
  const style = { "--safe": `calc(${safeAreaPx} * var(--u))` } as CSSProperties;
  return (
    <div className={styles.frame} style={style} data-pack={packId}>
      <header className={styles.top}>
        <div className={styles.headingGroup}>
          {packLogo ? (
            <img className={styles.headingLogo} src={packLogo} alt={packWordmark ?? ""} />
          ) : packWordmark && heading ? (
            <span className={styles.headingMark}>{packWordmark}</span>
          ) : null}
          {heading ? <div className={styles.heading}>{heading}</div> : null}
        </div>
        {status?.fixture ? <div className={styles.fixture}>Fixture data, not live</div> : null}
        <div className={styles.topRight}>
          {status ? <ConnectionBadge status={status} /> : null}
          {clockTimeZone ? <Clock timeZone={clockTimeZone} /> : null}
        </div>
      </header>
      <main className={styles.stage}>{children}</main>
      <footer className={styles.bottom}>
        <div className={styles.wordmark}>BeastDisplay</div>
        {packWordmark && !heading ? <div className={styles.packWordmark}>{packWordmark}</div> : null}
      </footer>
    </div>
  );
}
