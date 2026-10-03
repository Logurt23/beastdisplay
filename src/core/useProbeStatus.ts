import { useEffect, useState } from "react";
import { probeConfig } from "./probe";
import { badgeState, type FrameStatus } from "./frame/status";

const PROBE_SECONDS = 60;

/**
 * Badge for core modes with no function pack: the player's own reachability,
 * from a same-origin probe of config.js every 60 s (Fable report 2.2).
 */
export function useProbeStatus(active: boolean): FrameStatus {
  const [status, setStatus] = useState<FrameStatus>({ state: "live", updatedAt: Date.now() });

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastOkAt: number | null = Date.now();
    let failures = 0;
    let inFlight = false;
    const run = async () => {
      if (inFlight) return;
      inFlight = true;
      const ok = await probeConfig();
      inFlight = false;
      if (stopped) return;
      clearTimeout(timer);
      const now = Date.now();
      if (ok) {
        lastOkAt = now;
        failures = 0;
      } else failures += 1;
      setStatus({
        state: badgeState({
          now,
          lastOkAt,
          consecutiveFailures: failures,
          online: navigator.onLine,
          staleAfterSeconds: PROBE_SECONDS,
          pollSeconds: PROBE_SECONDS,
          offlineAfterFailures: 2,
        }),
        updatedAt: lastOkAt,
      });
      timer = setTimeout(run, PROBE_SECONDS * 1000);
    };
    timer = setTimeout(run, PROBE_SECONDS * 1000);
    const onNet = () => {
      clearTimeout(timer);
      void run();
    };
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, [active]);

  return status;
}
