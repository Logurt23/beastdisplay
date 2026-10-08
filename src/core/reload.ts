import type { BadgeState } from "./frame/status";

export interface ReloadDeps {
  hours: number;
  /** Current badge. Reload only when live: a stale or offline board keeps its frame. */
  badge: () => BadgeState;
  /** Same-origin probe; reload only on 2xx so a dead host never replaces the last frame. */
  probe: () => Promise<boolean>;
  /** True while a navigation or target switch just started. */
  busy: () => boolean;
  reload: () => void;
  retryMs?: number;
  busyRetryMs?: number;
}

/**
 * The 6 h reload backstop with the report's two guards (2.3).
 * Returns a stop function. Uses chained timeouts only.
 */
export function startReloadPolicy(d: ReloadDeps): () => void {
  if (!(d.hours > 0)) return () => {};
  const retryMs = d.retryMs ?? 10 * 60 * 1000;
  const busyRetryMs = d.busyRetryMs ?? 30 * 1000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = (ms: number) => {
    if (stopped) return;
    timer = setTimeout(attempt, ms);
  };

  const attempt = async () => {
    timer = null;
    if (stopped) return;
    if (d.busy()) return schedule(busyRetryMs);
    if (d.badge() !== "live") return schedule(retryMs);
    const ok = await d.probe();
    if (stopped) return;
    if (ok && d.badge() === "live" && !d.busy()) d.reload();
    else schedule(retryMs);
  };

  schedule(d.hours * 60 * 60 * 1000);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
