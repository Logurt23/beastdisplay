import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ageText, badgeState } from "../src/core/frame/status";
import { startReloadPolicy } from "../src/core/reload";

describe("badgeState", () => {
  const base = { now: 100_000, lastOkAt: 90_000, consecutiveFailures: 0, online: true, staleAfterSeconds: 60, pollSeconds: 15 };
  it("is live within max(staleAfter, 2 x poll)", () => {
    expect(badgeState(base)).toBe("live");
    expect(badgeState({ ...base, lastOkAt: 100_000 - 60_000 })).toBe("live");
    expect(badgeState({ ...base, lastOkAt: 100_000 - 60_001 })).toBe("stale");
    expect(badgeState({ ...base, staleAfterSeconds: 10, lastOkAt: 100_000 - 29_000 })).toBe("live");
  });
  it("is offline after 4 failed polls or when the browser says offline", () => {
    expect(badgeState({ ...base, consecutiveFailures: 3, lastOkAt: 0 })).toBe("stale");
    expect(badgeState({ ...base, consecutiveFailures: 4 })).toBe("offline");
    expect(badgeState({ ...base, online: false })).toBe("offline");
  });
  it("is stale before any data", () => {
    expect(badgeState({ ...base, lastOkAt: null })).toBe("stale");
  });
  it("writes the age line", () => {
    expect(ageText(100_000, null)).toBe("Waiting for data");
    expect(ageText(100_000, 86_000)).toBe("Updated 14s ago");
    expect(ageText(10_000_000, 10_000_000 - 3_720_000)).toBe("Updated 1h 2m ago");
  });
});

describe("reload policy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const H6 = 6 * 3600 * 1000;

  it("reloads after 6 h when live and the host answers", async () => {
    const reload = vi.fn();
    startReloadPolicy({ hours: 6, badge: () => "live", probe: async () => true, busy: () => false, reload });
    await vi.advanceTimersByTimeAsync(H6 - 1);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("skips while offline or stale, and retries every 10 minutes", async () => {
    let badge: "live" | "stale" | "offline" = "offline";
    const reload = vi.fn();
    const probe = vi.fn(async () => true);
    startReloadPolicy({ hours: 6, badge: () => badge, probe, busy: () => false, reload });
    await vi.advanceTimersByTimeAsync(H6 + 30 * 60 * 1000);
    expect(reload).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    badge = "live";
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("never reloads when the host probe fails (would replace the last frame with an error page)", async () => {
    const reload = vi.fn();
    startReloadPolicy({ hours: 6, badge: () => "live", probe: async () => false, busy: () => false, reload });
    await vi.advanceTimersByTimeAsync(H6 + 60 * 60 * 1000);
    expect(reload).not.toHaveBeenCalled();
  });

  it("waits while a navigation just started", async () => {
    let busy = true;
    const reload = vi.fn();
    startReloadPolicy({ hours: 6, badge: () => "live", probe: async () => true, busy: () => busy, reload });
    await vi.advanceTimersByTimeAsync(H6 + 60_000);
    expect(reload).not.toHaveBeenCalled();
    busy = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("stops cleanly", async () => {
    const reload = vi.fn();
    const stop = startReloadPolicy({ hours: 6, badge: () => "live", probe: async () => true, busy: () => false, reload });
    stop();
    await vi.advanceTimersByTimeAsync(H6 * 2);
    expect(reload).not.toHaveBeenCalled();
  });
});
