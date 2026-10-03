/**
 * Runtime config for the core player.
 *
 * Precedence: URL query, then window.BEASTDISPLAY_CONFIG (runtime config.js),
 * then the built-in defaults below. Nothing secret is baked into the bundle.
 */

export type Theme = "night" | "day";

export interface AllowEntry {
  origin: string;
  /** Operator-confirmed: this origin permits being framed by the display host. */
  frame: boolean;
}

export type TargetSpec =
  | { kind: "function"; fn: string; layout?: string }
  | { kind: "external"; url: string };

export interface FunctionConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface Config {
  displayId: string;
  theme: Theme;
  clock: { show: boolean; timeZone: string };
  safeAreaPx: number;
  reloadHours: number;
  lobbyMode: boolean;
  defaultTarget: TargetSpec | null;
  allowlist: AllowEntry[];
  targets: TargetSpec[];
  rotateSeconds: number;
  functions: Record<string, FunctionConfig>;
}

export interface Query {
  target?: string;
  fn?: string;
  layout?: string;
  rotate?: number;
  theme?: Theme;
}

declare global {
  interface Window {
    BEASTDISPLAY_CONFIG?: unknown;
  }
}

export const DEFAULTS: Config = {
  displayId: "display",
  theme: "night",
  clock: { show: false, timeZone: "America/Chicago" },
  safeAreaPx: 48,
  reloadHours: 6,
  lobbyMode: false,
  defaultTarget: null,
  allowlist: [],
  targets: [],
  rotateSeconds: 0,
  functions: {},
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min = 0): number =>
  typeof v === "number" && Number.isFinite(v) && v >= min ? v : fallback;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;

const theme = (v: unknown, fallback: Theme): Theme =>
  v === "night" || v === "day" ? v : fallback;

export function parseTargetSpec(v: unknown): TargetSpec | null {
  if (!isObj(v)) return null;
  if (v.kind === "function" && typeof v.fn === "string" && v.fn) {
    return typeof v.layout === "string" && v.layout
      ? { kind: "function", fn: v.fn, layout: v.layout }
      : { kind: "function", fn: v.fn };
  }
  if (v.kind === "external" && typeof v.url === "string" && v.url) {
    return { kind: "external", url: v.url };
  }
  return null;
}

/** Validates a raw config object. Bad fields fall back to defaults; never throws. */
export function parseConfig(raw: unknown): Config {
  if (!isObj(raw)) return { ...DEFAULTS };
  const clock = isObj(raw.clock) ? raw.clock : {};
  const allowlist = Array.isArray(raw.allowlist)
    ? raw.allowlist.flatMap((e): AllowEntry[] => {
        if (!isObj(e) || typeof e.origin !== "string") return [];
        const origin = normalizeOrigin(e.origin);
        return origin ? [{ origin, frame: e.frame === true }] : [];
      })
    : [];
  const functions: Record<string, FunctionConfig> = {};
  if (isObj(raw.functions)) {
    for (const [id, f] of Object.entries(raw.functions)) {
      if (isObj(f)) functions[id] = { ...f, enabled: f.enabled === true };
    }
  }
  return {
    displayId: str(raw.displayId, DEFAULTS.displayId),
    theme: theme(raw.theme, DEFAULTS.theme),
    clock: {
      show: clock.show === true,
      timeZone: str(clock.timeZone, DEFAULTS.clock.timeZone),
    },
    safeAreaPx: num(raw.safeAreaPx, DEFAULTS.safeAreaPx),
    reloadHours: num(raw.reloadHours, DEFAULTS.reloadHours),
    lobbyMode: raw.lobbyMode === true,
    defaultTarget: parseTargetSpec(raw.defaultTarget),
    allowlist,
    targets: Array.isArray(raw.targets)
      ? raw.targets.map(parseTargetSpec).filter((t): t is TargetSpec => t !== null)
      : [],
    rotateSeconds: num(raw.rotateSeconds, DEFAULTS.rotateSeconds),
    functions,
  };
}

export function parseQuery(search: string): Query {
  const p = new URLSearchParams(search);
  const q: Query = {};
  const target = p.get("target");
  if (target) q.target = target;
  const fn = p.get("fn");
  if (fn) q.fn = fn;
  const layout = p.get("layout");
  if (layout) q.layout = layout;
  const rotate = p.get("rotate");
  if (rotate !== null && /^\d+$/.test(rotate)) q.rotate = Number(rotate);
  const t = p.get("theme");
  if (t === "night" || t === "day") q.theme = t;
  return q;
}

/** Applies query over config. Target selection itself is in targets.ts. */
export function applyQuery(config: Config, query: Query): Config {
  return {
    ...config,
    theme: query.theme ?? config.theme,
    rotateSeconds: query.rotate ?? config.rotateSeconds,
  };
}

export function normalizeOrigin(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function readWindowConfig(): Config {
  return parseConfig(typeof window === "undefined" ? undefined : window.BEASTDISPLAY_CONFIG);
}

/**
 * Re-reads config.js from the host, bypassing cache, by re-running the script.
 * Used after a 401 so a token rotated on the host is picked up without a reload.
 */
export function reloadRuntimeConfig(timeoutMs = 5000): Promise<Config> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      s.remove();
      resolve(readWindowConfig());
    };
    const timer = setTimeout(finish, timeoutMs);
    s.src = `/config.js?reread=${Date.now()}`;
    s.onload = finish;
    s.onerror = finish;
    document.head.appendChild(s);
  });
}
