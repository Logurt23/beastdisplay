import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "../hooks";
import styles from "../styles/emm.module.css";

const SLIDE_MS = 700;

/**
 * Shows `fit` items and, when there are more, loops through all of them: every
 * `holdMs` the list slides up one row (`cols` items) and the top row wraps to
 * the end. Replaces "+N more". Under reduced motion it steps without sliding.
 * `rowPx` is one row plus the gap, in 1080p px.
 */
export function LoopList<T>({
  items,
  fit,
  cols = 1,
  rowPx,
  holdMs = 4_000,
  className,
  keyOf,
  render,
}: {
  items: readonly T[];
  fit: number;
  cols?: number;
  rowPx: number;
  holdMs?: number;
  className?: string;
  keyOf: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
}) {
  const reduced = useReducedMotion();
  const n = items.length;
  const looping = n > fit;
  const [offset, setOffset] = useState(0);
  const [moving, setMoving] = useState(false);

  // Data changed under us: start the loop again from the top.
  const sig = items.map(keyOf).join("|");
  useEffect(() => {
    setOffset(0);
    setMoving(false);
  }, [sig]);

  useEffect(() => {
    if (!looping) return;
    if (moving) {
      const t = setTimeout(() => {
        setMoving(false);
        setOffset((o) => (o + cols) % n);
      }, SLIDE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => (reduced ? setOffset((o) => (o + cols) % n) : setMoving(true)), holdMs);
    return () => clearTimeout(t);
  }, [looping, moving, offset, reduced, holdMs, cols, n]);

  const count = looping ? fit + cols : n;
  const shown = Array.from({ length: count }, (_, i) => ({ item: items[(offset + i) % n], i }));
  const style = {
    "--cols": cols,
    transform: moving ? `translateY(calc(${-rowPx} * var(--u)))` : "none",
    transition: moving ? `transform ${SLIDE_MS}ms ease-in-out` : "none",
  } as CSSProperties;

  const track = (
    <div className={`${styles.loopTrack} ${className ?? ""}`} style={style} data-looping={looping ? "true" : undefined}>
      {shown.map(({ item, i }) => (
        <div key={`${i}-${keyOf(item)}`} className={styles.loopCell}>
          {render(item, (offset + i) % n)}
        </div>
      ))}
    </div>
  );
  if (!looping) return track;
  // Clip to exactly the rows that fit, so the incoming row stays hidden until it slides in.
  return (
    <div className={styles.loopClip} style={{ height: `calc(${Math.ceil(fit / cols) * rowPx} * var(--u))` }}>
      {track}
    </div>
  );
}
