import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import styles from "../styles/intro.module.css";
import sparks from "../styles/sparks.module.css";

/**
 * War Room launch intro. Plays once per browser tab when the board boots, 15 s.
 * The field fades up with the Street Phoenix spark field drifting through it (the
 * same port FireCore's intro uses), the EMM Advertising logo lights, WAR ROOM
 * wipes in and catches a shine, and a status line follows the real board load.
 * Then the whole scene turns red, the EMM logo fades out, WAR ROOM slides to the
 * middle, a red seam cuts through it and the screen splits open onto the board.
 * Tap or any key skips. Skipped entirely under prefers-reduced-motion. EMM and
 * War Room only; BeastDisplay is not branded here.
 */

/** Milliseconds from the start. The split runs from `split` to `done`. */
export const INTRO_T = {
  field: 80,
  logo: 900,
  rule: 2300,
  title: 2700,
  shine: 4600,
  status: 6000,
  red: 9800,
  fade: 10600,
  center: 11500,
  seam: 13000,
  split: 13600,
  done: 15000,
};
export const INTRO_SEEN = "warroom-intro-seen";

export function Intro({ logo, ready }: { logo: string; ready: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);
  // Decided once per mount; a ref keeps the answer when React runs effects twice in development.
  const play = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    if (play.current === null) play.current = !seen() && !reducedMotion();
    if (!play.current) root.current.style.display = "none";
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!play.current) {
      const t = setTimeout(() => setGone(true), 0);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let finished = false;
    let alive = true;
    /** State classes are onField, onLogo, ... in intro.module.css, added in timeline order. */
    const add = (c: string) => el.classList.add(styles[`on${c[0].toUpperCase()}${c.slice(1)}`]);

    const skip = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      add("skip");
      setTimeout(() => setGone(true), 520);
    };
    el.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);

    // Where WAR ROOM has to travel to sit in the middle, and where the seam cuts, measured
    // just before the slide so a resize earlier in the intro is taken into account.
    const center = () => {
      const r = titleRef.current?.getBoundingClientRect();
      if (r && r.width > 0) {
        el.style.setProperty("--slide", `${window.innerWidth / 2 - (r.left + r.width / 2)}px`);
        el.style.setProperty("--seam", `${r.top + r.height / 2}px`);
      }
      add("center");
    };

    // Start once the logo and the heavy title face are ready, so nothing pops in half loaded.
    let started = false;
    const run = () => {
      if (started || finished || !alive) return;
      started = true;
      try {
        sessionStorage.setItem(INTRO_SEEN, "1");
      } catch {
        /* storage blocked: the intro may play again next load, which is fine */
      }
      at(INTRO_T.field, () => add("field"));
      at(INTRO_T.logo, () => add("logo"));
      at(INTRO_T.rule, () => add("rule"));
      at(INTRO_T.title, () => add("title"));
      at(INTRO_T.shine, () => add("shine"));
      at(INTRO_T.status, () => add("status"));
      at(INTRO_T.red, () => add("red"));
      at(INTRO_T.fade, () => add("fade"));
      at(INTRO_T.center, center);
      at(INTRO_T.seam, () => add("seam"));
      at(INTRO_T.split, () => add("split"));
      at(INTRO_T.done, () => {
        finished = true;
        setGone(true);
      });
    };
    const img = new Image();
    img.src = logo;
    const fonts = typeof document.fonts?.load === "function" ? document.fonts.load('700 100px "Barlow Condensed"') : Promise.resolve();
    Promise.all([img.decode(), fonts]).then(run, run);
    const fallback = setTimeout(run, 3000);

    return () => {
      alive = false;
      clearTimeout(fallback);
      timers.forEach(clearTimeout);
      el.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [logo]);

  if (gone) return null;
  // The scene is drawn twice, once per half of the screen, so the split at the end can carry
  // each half away with its share of the background, sparks and WAR ROOM. Only the top copy is
  // measured and read by assistive tech (the whole overlay is aria-hidden anyway).
  return (
    <div ref={root} className={styles.intro} data-intro aria-hidden="true" style={{ "--slide": "0px", "--seam": "50%" } as CSSProperties}>
      <Scene half={styles.top} logo={logo} ready={ready} titleRef={titleRef} />
      <Scene half={styles.bottom} logo={logo} ready={ready} />
      <span className={styles.seamLine} />
    </div>
  );
}

function Scene({ half, logo, ready, titleRef }: { half: string; logo: string; ready: boolean; titleRef?: RefObject<HTMLSpanElement | null> }) {
  return (
    <div className={`${styles.half} ${half}`}>
      <div className={styles.bg} />
      <div className={styles.glow}>
        <span className={`${styles.bloom} ${styles.b1}`} />
        <span className={`${styles.bloom} ${styles.b2}`} />
        <span className={`${styles.bloom} ${styles.b3}`} />
      </div>
      <div className={styles.redWash} />
      <div className={`${sparks.field} ${styles.sparks}`}>
        <span className={sparks.sparks1} />
        <span className={sparks.sparks2} />
        <span className={sparks.sparks3} />
      </div>
      <div className={styles.stage}>
        <div className={styles.float}>
          <div className={styles.lockup}>
            <img className={styles.logo} src={logo} alt="" draggable={false} />
            <span className={styles.rule} />
            <span className={styles.titleWrap}>
              <span ref={titleRef} className={styles.title}>War Room</span>
              <span className={styles.shineBar} />
            </span>
          </div>
        </div>
        <div className={styles.status}>
          <span className={styles.statusText}>{ready ? "Board ready" : "Loading the board"}</span>
          <span className={styles.bar}>
            <span className={ready ? styles.barDone : undefined} />
          </span>
        </div>
      </div>
    </div>
  );
}

function seen() {
  try {
    return sessionStorage.getItem(INTRO_SEEN) === "1";
  } catch {
    return false;
  }
}

function reducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
