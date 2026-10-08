export type BadgeState = "live" | "stale" | "offline";

/** What a data source (a function pack, or the core probe) reports to the frame. */
export interface FrameStatus {
  state: BadgeState;
  /** Client receipt time (ms) of the last good response. Not the server's clock. */
  updatedAt: number | null;
  /** Short reason line, e.g. "Display token rejected". */
  reason?: string;
  /** True when the payload on screen is labeled fixture or seed data. */
  fixture?: boolean;
}

export interface BadgeInput {
  now: number;
  lastOkAt: number | null;
  consecutiveFailures: number;
  /** navigator.onLine. A hint only (MDN calls it unreliable). */
  online: boolean;
  /** Seconds after which a good payload counts as stale. */
  staleAfterSeconds: number;
  pollSeconds: number;
  /** Failed polls in a row before the badge reads offline. */
  offlineAfterFailures?: number;
}

/**
 * Badge from poll outcomes (Fable report 2.2):
 * live    - last good poll within max(staleAfter, 2 x poll)
 * offline - 4+ consecutive failures, or navigator.onLine is false
 * stale   - anything else
 */
export function badgeState(i: BadgeInput): BadgeState {
  const limit = Math.max(i.staleAfterSeconds, 2 * i.pollSeconds) * 1000;
  if (!i.online) return "offline";
  if (i.consecutiveFailures >= (i.offlineAfterFailures ?? 4)) return "offline";
  if (i.lastOkAt !== null && i.now - i.lastOkAt <= limit) return "live";
  return "stale";
}

export function ageText(now: number, updatedAt: number | null): string {
  if (updatedAt === null) return "Waiting for data";
  const s = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (s < 60) return `Updated ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Updated ${m}m ago`;
  const h = Math.floor(m / 60);
  return `Updated ${h}h ${m % 60}m ago`;
}
