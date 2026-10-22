import { useSecondTick } from "./Clock";
import { ageText, type FrameStatus } from "./status";
import styles from "./frame.module.css";

const WORD = { live: "Live", stale: "Stale", offline: "Offline" } as const;

export function ConnectionBadge({ status }: { status: FrameStatus }) {
  const now = useSecondTick();
  return (
    <div className={styles.badge} data-state={status.state} role="status">
      <div className={styles.badgeRow}>
        <span className={styles.badgeDot} aria-hidden />
        <span className={styles.badgeWord}>{WORD[status.state]}</span>
      </div>
      <div className={styles.badgeAge}>{ageText(now, status.updatedAt)}</div>
      {status.reason ? <div className={styles.badgeReason}>{status.reason}</div> : null}
    </div>
  );
}
