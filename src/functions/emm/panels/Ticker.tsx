import { useEffect, useMemo, useRef, useState } from "react";
import { chicagoTime } from "../time";
import type { TickerItem } from "../types";
import styles from "../styles/emm.module.css";

const MAX_ITEMS = 12;

function newestFirst(items: readonly TickerItem[]): TickerItem[] {
  return [...items].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).slice(0, MAX_ITEMS);
}

const sig = (items: readonly TickerItem[]) => items.map((i) => i.id).join("|");

/**
 * The one continuous motion on the board: a CSS transform loop, 40 s. New items
 * swap in at the loop boundary, never mid-scroll. Empty ticker renders nothing.
 * Reduced motion: newest 3 static, rotating every 10 s with a fade.
 */
export function Ticker({ items, reduced }: { items: readonly TickerItem[]; reduced: boolean }) {
  const latest = useMemo(() => newestFirst(items), [items]);
  const latestRef = useRef(latest);
  latestRef.current = latest;
  const [shown, setShown] = useState(latest);

  // Nothing on screen yet, or reduced motion: take new items immediately.
  useEffect(() => {
    if (shown.length === 0 || reduced) setShown(latest);
  }, [latest, reduced, shown.length]);

  if (shown.length === 0 && latest.length === 0) return null;

  if (reduced) return <StaticTicker items={latest} />;

  // Repeat short lists so one copy spans the strip, then duplicate for a seamless loop.
  const reps = Math.max(1, Math.ceil(6 / Math.max(1, shown.length)));
  const run = Array.from({ length: reps }, () => shown).flat();
  const onIteration = () => {
    if (sig(latestRef.current) !== sig(shown)) setShown(latestRef.current);
  };

  return (
    <div className={styles.ticker} aria-label="Recent events">
      <div className={styles.tickerTrack} onAnimationIteration={onIteration}>
        {[0, 1].map((copy) =>
          run.map((it, i) => (
            <span key={`${copy}-${i}-${it.id}`} className={styles.tickerItem} aria-hidden={copy === 1}>
              <span className={`${styles.tickerTime} num`}>{it.at ? chicagoTime(it.at) : ""}</span>
              <span className={styles.tickerDot} data-tone={it.tone} />
              {it.text}
            </span>
          )),
        )}
      </div>
    </div>
  );
}

function StaticTicker({ items }: { items: TickerItem[] }) {
  const groups = useMemo(() => {
    const out: TickerItem[][] = [];
    for (let i = 0; i < items.length; i += 3) out.push(items.slice(i, i + 3));
    return out;
  }, [items]);
  const [g, setG] = useState(0);
  useEffect(() => {
    if (groups.length < 2) return;
    const t = setTimeout(() => setG((x) => (x + 1) % groups.length), 10_000);
    return () => clearTimeout(t);
  }, [g, groups.length]);
  const group = groups[Math.min(g, groups.length - 1)] ?? [];
  return (
    <div className={`${styles.ticker} ${styles.tickerStatic}`} aria-label="Recent events">
      <div key={g} className={styles.fadeIn}>
        {group.map((it) => (
          <span key={it.id} className={styles.tickerItem}>
            <span className={`${styles.tickerTime} num`}>{it.at ? chicagoTime(it.at) : ""}</span>
            <span className={styles.tickerDot} data-tone={it.tone} />
            {it.text}
          </span>
        ))}
      </div>
    </div>
  );
}
