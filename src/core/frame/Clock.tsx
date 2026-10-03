import { useEffect, useState } from "react";
import { longDate, zonedDate, zonedTime } from "../tz";
import styles from "./frame.module.css";

/** Second-aligned setTimeout chain, so it never drifts and recovers after throttling. */
export function useSecondTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, 1000 - (t % 1000) + 5);
    };
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(timer);
  }, []);
  return now;
}

export function Clock({ timeZone }: { timeZone: string }) {
  const now = useSecondTick();
  return (
    <div className={styles.clock} aria-label="Clock">
      <div className={`${styles.clockTime} num`}>{zonedTime(now, timeZone, true)}</div>
      <div className={styles.clockDate}>{longDate(zonedDate(now, timeZone))}</div>
    </div>
  );
}
