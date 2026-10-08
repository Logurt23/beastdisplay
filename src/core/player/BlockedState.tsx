import styles from "./player.module.css";

interface Props {
  title: string;
  detail?: string;
  url?: string;
}

/** Quiet full-stage message. Used for refused, blocked, and not-configured targets. Never blank. */
export function BlockedState({ title, detail, url }: Props) {
  return (
    <div className={styles.blocked} role="status">
      <div className={styles.blockedTitle}>{title}</div>
      {url ? <div className={styles.blockedUrl}>{url}</div> : null}
      {detail ? <div className={styles.blockedDetail}>{detail}</div> : null}
    </div>
  );
}
