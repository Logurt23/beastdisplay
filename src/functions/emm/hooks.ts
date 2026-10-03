import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [reduced, setReduced] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Pages a list inside a panel. Paging is data presentation, not decoration, so
 * it keeps running under reduced motion (with a fade instead of a slide).
 * offsetMs staggers panels so they do not flip at the same moment.
 */
export function usePager<T>(items: readonly T[], perPage: number, intervalMs = 12_000, offsetMs = 0) {
  const size = Math.max(1, perPage);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const [page, setPage] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (pages < 2) {
      setPage(0);
      return;
    }
    const wait = first.current ? intervalMs + offsetMs : intervalMs;
    first.current = false;
    const timer = setTimeout(() => setPage((p) => (p + 1) % pages), wait);
    return () => clearTimeout(timer);
  }, [page, pages, intervalMs, offsetMs]);

  const current = Math.min(page, pages - 1);
  return { page: current, pages, items: items.slice(current * size, current * size + size) };
}

/** How many fixed-height rows fit in an element. Re-measures on resize. */
export function useRowsThatFit(ref: RefObject<HTMLElement | null>, rowPx1080: number, fallback: number): number {
  const [rows, setRows] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const u = Math.min(window.innerHeight / 1080, window.innerWidth / 1920);
      const h = el.clientHeight;
      if (h > 0) setRows(Math.max(1, Math.floor(h / (rowPx1080 * u))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, rowPx1080]);
  return rows;
}

/**
 * Animates a number from its previous value to the new one. First paint shows
 * the value directly: a reload never counts up from zero. Reduced motion snaps.
 */
export function useTween(value: number, ms: number, reduced: boolean): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);
  shownRef.current = shown;

  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = shownRef.current;
    from.current = value;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - k) ** 3;
      setShown(start + (value - start) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduced]);

  return shown;
}

/** True for `ms` after `value` changes (not on first paint). */
export function useChangedFlag(value: unknown, ms: number): boolean {
  const [changed, setChanged] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    setChanged(true);
    const t = setTimeout(() => setChanged(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return changed;
}
