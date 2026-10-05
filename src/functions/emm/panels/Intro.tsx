import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "../styles/intro.module.css";

/**
 * War Room launch intro (2026-10-05, after FireCore's LaunchIntro). Plays once
 * per browser tab when the board boots, 15 s: the Nexus field fades up and mint
 * motes drift, the EMM Advertising logo lights, WAR ROOM wipes in and catches a
 * shine, the lockup turns once, a status line follows the real board load, then
 * the lockup dissolves into motes and the board shows through. Tap or any key
 * skips. Skipped entirely under prefers-reduced-motion. EMM and War Room only;
 * BeastDisplay is not branded here.
 */

/** Milliseconds from the start. The overlay fade runs from `out` to `done`. */
export const INTRO_T = {
  field: 80,
  logo: 900,
  rule: 2300,
  title: 2700,
  shine: 4600,
  spin: 6200,
  status: 8000,
  dissolve: 11000,
  dissolveFor: 2200,
  out: 13500,
  done: 15000,
};
export const INTRO_SEEN = "warroom-intro-seen";

type Mote = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hot: boolean };

export function Intro({ logo, ready }: { logo: string; ready: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLCanvasElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const dissolveRef = useRef<HTMLCanvasElement>(null);
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
    const canvas = sky.current;
    const melt = dissolveRef.current;
    if (!el || !canvas || !melt) return;
    if (!play.current) {
      const t = setTimeout(() => setGone(true), 0);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let raf = 0;
    let finished = false;
    let alive = true;
    /** State classes are onField, onLogo, ... in intro.module.css, added in timeline order. */
    const add = (c: string) => el.classList.add(styles[`on${c[0].toUpperCase()}${c.slice(1)}`]);

    const finish = (fast: boolean) => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      if (fast) add("skip");
      add("out");
      setTimeout(() => setGone(true), fast ? 520 : INTRO_T.done - INTRO_T.out);
    };
    const skip = () => finish(true);
    el.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);

    // Motes: a steady mint drift up the screen, plus sparks thrown off the lockup as it dissolves.
    const ctx = safeContext(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    size();
    window.addEventListener("resize", size);
    const motes: Mote[] = [];
    const ambient = Math.round(Math.min(120, (window.innerWidth * window.innerHeight) / 16000));
    const unit = Math.min(window.innerHeight / 1080, window.innerWidth / 1920);
    const spawn = (scatter: boolean): Mote => ({
      x: Math.random() * window.innerWidth,
      y: scatter ? Math.random() * window.innerHeight : window.innerHeight + 10,
      vx: (Math.random() - 0.5) * 10 * unit,
      vy: -(14 + Math.random() * 40) * unit,
      r: (0.6 + Math.random() * 1.6) * unit,
      life: 0,
      max: 4 + Math.random() * 6,
      hot: false,
    });
    for (let i = 0; i < ambient; i++) motes.push(spawn(true));

    // Dissolve: the lockup is redrawn into a canvas at its on-screen size, then each pixel gets a
    // threshold from noise, weighted so it goes from the top down, and drifts off as mint motes.
    let meltCtx: CanvasRenderingContext2D | null = null;
    let source: ImageData | null = null;
    let threshold: Float32Array | null = null;
    let frame: ImageData | null = null;
    let meltStart = 0;

    const startDissolve = () => {
      const box = lockupRef.current?.getBoundingClientRect();
      const img = logoRef.current;
      const rule = ruleRef.current;
      const title = titleRef.current;
      meltCtx = safeContext(melt, true);
      if (!box || !img || !rule || !title || !meltCtx || box.width === 0) {
        add("dissolve");
        return;
      }
      const w = (melt.width = Math.round(box.width * dpr));
      const h = (melt.height = Math.round(box.height * dpr));
      meltCtx.setTransform(dpr, 0, 0, dpr, -box.left * dpr, -box.top * dpr);
      const ri = img.getBoundingClientRect();
      meltCtx.drawImage(img, ri.left, ri.top, ri.width, ri.height);
      const rr = rule.getBoundingClientRect();
      meltCtx.fillStyle = getComputedStyle(rule).backgroundColor;
      meltCtx.fillRect(rr.left, rr.top, rr.width, rr.height);
      const rt = title.getBoundingClientRect();
      const cs = getComputedStyle(title);
      meltCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      (meltCtx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = cs.letterSpacing;
      meltCtx.fillStyle = cs.color;
      meltCtx.textBaseline = "middle";
      const text = title.textContent ?? "";
      meltCtx.fillText(cs.textTransform === "uppercase" ? text.toUpperCase() : text, rt.left, rt.top + rt.height / 2);
      meltCtx.setTransform(1, 0, 0, 1, 0, 0);
      source = meltCtx.getImageData(0, 0, w, h);
      frame = meltCtx.createImageData(w, h);
      threshold = dissolveMap(w, h);
      meltStart = performance.now();
      add("dissolve");
    };

    const drawDissolve = (now: number) => {
      if (!meltCtx || !source || !threshold || !frame) return;
      const p = Math.min(1.12, ((now - meltStart) / INTRO_T.dissolveFor) * 1.12);
      const src = source.data;
      const out = frame.data;
      const edge = 0.07;
      const w = source.width;
      const rect = melt.getBoundingClientRect();
      let thrown = 0;
      for (let i = 0, px = 0; i < src.length; i += 4, px++) {
        const a = src[i + 3];
        const t = threshold[px];
        if (a === 0 || t < p - edge) {
          out[i + 3] = 0;
          continue;
        }
        if (t < p) {
          // Dissolving rim: white at the front, EMM mint behind it.
          const k = (p - t) / edge;
          out[i] = 240 - 152 * k;
          out[i + 1] = 255 - 7 * k;
          out[i + 2] = 245 - 61 * k;
          out[i + 3] = a * (1 - k * 0.6);
          if (thrown < 8 && Math.random() < 0.004) {
            thrown++;
            const x = px % w;
            const y = (px - x) / w;
            motes.push({
              x: rect.left + (x / w) * rect.width,
              y: rect.top + (y / source.height) * rect.height,
              vx: (Math.random() - 0.5) * 70 * unit,
              vy: -(50 + Math.random() * 110) * unit,
              r: (0.8 + Math.random() * 1.8) * unit,
              life: 0,
              max: 1.4 + Math.random() * 1.8,
              hot: true,
            });
          }
        } else if (t < p + 0.05) {
          // A mint tint just ahead of the front.
          const k = 1 - (t - p) / 0.05;
          out[i] = src[i] * (1 - 0.5 * k) + 88 * 0.5 * k;
          out[i + 1] = src[i + 1] * (1 - 0.5 * k) + 248 * 0.5 * k;
          out[i + 2] = src[i + 2] * (1 - 0.5 * k) + 184 * 0.5 * k;
          out[i + 3] = a;
        } else {
          out[i] = src[i];
          out[i + 1] = src[i + 1];
          out[i + 2] = src[i + 2];
          out[i + 3] = a;
        }
      }
      meltCtx.putImageData(frame, 0, 0);
      if (p >= 1.12) meltCtx = null;
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drawDissolve(now);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.globalCompositeOperation = "lighter";
        let ambientAlive = 0;
        for (let i = motes.length - 1; i >= 0; i--) {
          const m = motes[i];
          m.life += dt;
          m.x += (m.vx + Math.sin((m.y + i * 37) / 60) * 12 * unit) * dt;
          m.y += m.vy * dt;
          if (m.hot) m.vy *= 0.985;
          if (m.life > m.max || m.y < -20) {
            motes.splice(i, 1);
            continue;
          }
          if (!m.hot) ambientAlive++;
          const fadeIn = Math.min(1, m.life / 0.6);
          const fadeOut = Math.min(1, (m.max - m.life) / 1.2);
          const flicker = 0.75 + 0.25 * Math.sin(now / 110 + i);
          const alpha = fadeIn * fadeOut * flicker;
          ctx.fillStyle = `rgba(88, 248, 184, ${0.14 * alpha})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = m.hot ? `rgba(240, 255, 248, ${alpha})` : `rgba(88, 248, 184, ${0.8 * alpha})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = ambientAlive; i < ambient; i++) motes.push(spawn(false));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

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
      at(INTRO_T.spin, () => add("spin"));
      at(INTRO_T.status, () => add("status"));
      at(INTRO_T.dissolve, startDissolve);
      at(INTRO_T.out, () => finish(false));
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
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("resize", size);
    };
  }, [logo]);

  if (gone) return null;
  return (
    <div ref={root} className={styles.intro} data-intro aria-hidden="true">
      <div className={styles.glow}>
        <span className={`${styles.bloom} ${styles.b1}`} />
        <span className={`${styles.bloom} ${styles.b2}`} />
        <span className={`${styles.bloom} ${styles.b3}`} />
      </div>
      <canvas ref={sky} className={styles.motes} />
      <div className={styles.stage}>
        <div className={styles.float}>
          <div ref={lockupRef} className={styles.lockup}>
            <img ref={logoRef} className={styles.logo} src={logo} alt="" draggable={false} />
            <span ref={ruleRef} className={styles.rule} />
            <span className={styles.titleWrap}>
              <span ref={titleRef} className={styles.title}>War Room</span>
              <span className={styles.shineBar} />
            </span>
            <canvas ref={dissolveRef} className={styles.dissolveCanvas} />
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

/** getContext, or null where canvas is not implemented (jsdom). */
function safeContext(c: HTMLCanvasElement, read = false): CanvasRenderingContext2D | null {
  try {
    return c.getContext("2d", read ? { willReadFrequently: true } : undefined);
  } catch {
    return null;
  }
}

/** Per-pixel dissolve order in 0..1: layered value noise, biased so the top edge goes first. */
function dissolveMap(w: number, h: number) {
  const out = new Float32Array(w * h);
  const seed = Math.random() * 1000;
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = 0.55 * noise(x / 46, y / 46) + 0.3 * noise(x / 19, y / 19) + 0.15 * noise(x / 7, y / 7);
      const t = 0.55 * n + 0.45 * (y / h);
      out[y * w + x] = t;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo);
  return out;
}
