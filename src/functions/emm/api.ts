import { normalizeBoard } from "./normalize";
import type { Board } from "./types";

/**
 * Poll loop for GET /api/display/board (Phase 5, report 2.2 to 2.6).
 * - chained setTimeout after each response, one request in flight
 * - AbortSignal.timeout per request
 * - back-off on timeout, network and 5xx: 1x, 2x, 4x, 8x pollSeconds (15/30/60/120 s)
 * - 429 honors Retry-After
 * - 401/403 re-reads config.js at most once per 10 minutes; not counted as offline
 * - last good payload persisted in localStorage and painted on boot
 */

export interface PollSnapshot {
  board: Board | null;
  /** Client receipt time of the last good payload (ms). */
  receivedAt: number | null;
  /** Consecutive network-type failures (timeout, unreachable, 5xx, bad JSON). */
  failures: number;
  reason?: string;
  /** True until the first live response replaces a payload restored from storage. */
  restored: boolean;
}

export interface PollerOptions {
  nexusUrl: string;
  token: string;
  displayId: string;
  pollSeconds: number;
  timeoutMs: number;
  onChange: (s: PollSnapshot) => void;
  /** Re-reads runtime config and returns the token it now holds. */
  reloadToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  storage?: Storage | null;
  now?: () => number;
}

const CONFIG_REREAD_MS = 10 * 60 * 1000;

export function storageKey(displayId: string): string {
  return `beastdisplay:emm:last-good:${displayId}`;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLastGood(storage: Storage | null, displayId: string): { board: Board; receivedAt: number } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(displayId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { receivedAt?: unknown; payload?: unknown };
    if (typeof parsed.receivedAt !== "number" || !parsed.payload) return null;
    return { board: normalizeBoard(parsed.payload), receivedAt: parsed.receivedAt };
  } catch {
    return null;
  }
}

function writeLastGood(storage: Storage | null, displayId: string, payload: unknown, receivedAt: number) {
  if (!storage) return;
  try {
    storage.setItem(storageKey(displayId), JSON.stringify({ receivedAt, payload }));
  } catch {
    // Quota or privacy mode. The board still works; it just cannot survive a reload.
  }
}

export function boardUrl(nexusUrl: string): string {
  return `${nexusUrl.replace(/\/+$/, "")}/api/display/board`;
}

export function backoffMs(pollSeconds: number, failures: number): number {
  const step = Math.min(Math.max(failures, 1), 4) - 1;
  return pollSeconds * 1000 * 2 ** step;
}

export class BoardPoller {
  private o: Required<Omit<PollerOptions, "reloadToken">> & Pick<PollerOptions, "reloadToken">;
  private snap: PollSnapshot;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private stopped = true;
  private lastConfigReread = -Infinity;
  private token: string;

  constructor(opts: PollerOptions) {
    this.o = {
      fetchImpl: (...a) => fetch(...a),
      storage: safeStorage(),
      now: () => Date.now(),
      ...opts,
    };
    this.token = opts.token;
    const last = readLastGood(this.o.storage, opts.displayId);
    this.snap = { board: last?.board ?? null, receivedAt: last?.receivedAt ?? null, failures: 0, restored: last !== null };
  }

  get snapshot(): PollSnapshot {
    return this.snap;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisible);
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
    this.o.onChange(this.snap);
    void this.poll();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisible);
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
  }

  /** Poll now unless a request is already in flight. */
  pollNow() {
    if (this.stopped || this.inFlight) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.poll();
  }

  private onVisible = () => {
    if (document.visibilityState === "visible") this.pollNow();
  };

  private onOnline = () => this.pollNow();

  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, ms);
  }

  private update(patch: Partial<PollSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.o.onChange(this.snap);
  }

  private fail(reason: string, networkType: boolean, retryMs?: number) {
    const failures = networkType ? this.snap.failures + 1 : this.snap.failures;
    this.update({ failures, reason });
    this.schedule(retryMs ?? backoffMs(this.o.pollSeconds, Math.max(failures, 1)));
  }

  private async poll(): Promise<void> {
    if (this.stopped || this.inFlight) return;
    this.inFlight = true;
    let res: Response;
    try {
      res = await this.o.fetchImpl(boardUrl(this.o.nexusUrl), {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          "X-Display-Id": this.o.displayId,
        },
        signal: AbortSignal.timeout(this.o.timeoutMs),
      });
    } catch (err) {
      this.inFlight = false;
      if (this.stopped) return;
      const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
      return this.fail(timedOut ? "Nexus timed out" : "Nexus unreachable", true);
    }

    if (res.status === 401 || res.status === 403) {
      this.inFlight = false;
      if (this.stopped) return;
      const now = this.o.now();
      if (this.o.reloadToken && now - this.lastConfigReread >= CONFIG_REREAD_MS) {
        this.lastConfigReread = now;
        const fresh = await this.o.reloadToken().catch(() => null);
        if (this.stopped) return;
        if (fresh && fresh !== this.token) {
          this.token = fresh;
          return this.pollNow();
        }
      }
      return this.fail("Display token rejected", false);
    }

    if (res.status === 429) {
      this.inFlight = false;
      if (this.stopped) return;
      const ra = Number(res.headers.get("Retry-After"));
      const retry = Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoffMs(this.o.pollSeconds, 2);
      return this.fail("Rate limited by Nexus", false, retry);
    }

    if (!res.ok) {
      this.inFlight = false;
      if (this.stopped) return;
      return this.fail(`Nexus error ${res.status}`, true);
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      this.inFlight = false;
      if (this.stopped) return;
      return this.fail("Nexus sent unreadable data", true);
    }
    this.inFlight = false;
    if (this.stopped) return;
    const receivedAt = this.o.now();
    writeLastGood(this.o.storage, this.o.displayId, payload, receivedAt);
    this.update({ board: normalizeBoard(payload), receivedAt, failures: 0, reason: undefined, restored: false });
    this.schedule(this.o.pollSeconds * 1000);
  }
}
