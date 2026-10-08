interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: "release", cb: () => void): void;
}

/**
 * Requests a screen wake lock and re-acquires it when the page becomes visible
 * again (the browser releases it when hidden). OS power settings stay the
 * primary guard; this is belt and braces. Returns a cleanup function.
 */
export function holdWakeLock(): () => void {
  const nav = navigator as Navigator & {
    wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
  };
  if (!nav.wakeLock) return () => {};
  let sentinel: WakeLockSentinelLike | null = null;
  let stopped = false;

  const acquire = async () => {
    if (stopped || document.visibilityState !== "visible" || sentinel) return;
    try {
      const s = await nav.wakeLock!.request("screen");
      if (stopped) {
        void s.release();
        return;
      }
      sentinel = s;
      s.addEventListener("release", () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      // Not allowed (no user activation, insecure context). Nothing to do.
    }
  };

  const onVisible = () => void acquire();
  document.addEventListener("visibilitychange", onVisible);
  void acquire();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    if (sentinel) void sentinel.release();
    sentinel = null;
  };
}
