import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { reloadRuntimeConfig } from "../../core/config";
import { useSecondTick } from "../../core/frame/Clock";
import { badgeState, type FrameStatus } from "../../core/frame/status";
import type { FunctionProps } from "../../core/registry";
import { BoardPoller, type PollSnapshot } from "./api";
import { useReducedMotion } from "./hooks";
import { LAYOUTS } from "./layouts/Layouts";
import { EMM_LAYOUTS, emmModule, type EmmLayout } from "./meta";
import { Field } from "./panels/Field";
import { Intro } from "./panels/Intro";
import { Empty } from "./panels/Panel";
import { chicagoDate } from "./time";
import styles from "./styles/emm.module.css";

export interface EmmSettings {
  nexusUrl: string;
  token: string;
  pollSeconds: number;
  timeoutMs: number;
  /** Who gets a New Development lane: assignee ids or first names. Empty: everyone with dev work. */
  developers: string[];
  /** Play the 15 s War Room intro once per tab on boot. Config `functions.emm.intro: false` turns it off. */
  intro: boolean;
}

/** Reads the pack's slice of runtime config. nexusUrl falls back to the build-time default. */
export function emmSettings(fn: Record<string, unknown>): EmmSettings {
  const nexusUrl =
    typeof fn.nexusUrl === "string" && fn.nexusUrl ? fn.nexusUrl : (import.meta.env.VITE_NEXUS_URL as string | undefined) ?? "";
  const pos = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : d);
  return {
    nexusUrl,
    token: typeof fn.token === "string" ? fn.token : "",
    pollSeconds: pos(fn.pollSeconds, 15),
    timeoutMs: pos(fn.timeoutMs, 8000),
    developers: Array.isArray(fn.developers)
      ? fn.developers.filter((d): d is string => typeof d === "string" && d.trim() !== "")
      : [],
    intro: fn.intro !== false,
  };
}

function useBoard(settings: EmmSettings, displayId: string): PollSnapshot | null {
  const [snap, setSnap] = useState<PollSnapshot | null>(null);
  useEffect(() => {
    if (!settings.nexusUrl) return;
    const poller = new BoardPoller({
      ...settings,
      displayId,
      onChange: setSnap,
      reloadToken: async () => {
        const c = await reloadRuntimeConfig();
        const t = c.functions.emm?.token;
        return typeof t === "string" ? t : null;
      },
    });
    poller.start();
    return () => poller.stop();
  }, [settings.nexusUrl, settings.token, settings.pollSeconds, settings.timeoutMs, displayId]); // eslint-disable-line react-hooks/exhaustive-deps
  return snap;
}

/** EMM pack entry. Picks the layout from the query; reports data health to the core badge. */
export default function EmmPack({ layout, config, fnConfig, onStatus }: FunctionProps) {
  const settings = useMemo(() => emmSettings(fnConfig), [fnConfig]);
  const snap = useBoard(settings, config.displayId);
  const reduced = useReducedMotion();
  const today = useChicagoToday();
  const Layout = LAYOUTS[(EMM_LAYOUTS as readonly string[]).includes(layout) ? (layout as EmmLayout) : "warroom"];
  useEffect(() => {
    document.title = "War Room · EMM Advertising";
  }, []);
  // Field, intro and status reporter sit at one stable spot in the tree, so the
  // intro is not remounted (and cut short) when the board arrives.
  let body: ReactNode;
  if (!settings.nexusUrl) {
    body = <Empty title="Function not configured" detail="Set functions.emm.nexusUrl in config.js." />;
  } else if (!snap?.board) {
    body = (
      <div className={styles.waiting}>
        <Empty title="Waiting for Nexus" detail={snap?.reason} />
      </div>
    );
  } else {
    body = <Layout board={snap.board} today={today} lobbyMode={config.lobbyMode} reduced={reduced} developers={settings.developers} />;
  }
  return (
    <>
      <Field />
      {settings.intro && emmModule.logo ? <Intro logo={emmModule.logo} ready={Boolean(snap?.board)} /> : null}
      <StatusReporter snap={snap} settings={settings} onStatus={onStatus} />
      {body}
    </>
  );
}

/**
 * Chicago "today", re-checked every second but only re-rendering when the date
 * changes, so the board flips today to overdue at Chicago midnight without a reload.
 */
function useChicagoToday(): string {
  const [today, setToday] = useState(() => chicagoDate());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setToday(chicagoDate());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, []);
  return today;
}

/** Ticks once a second so the badge ages from live to stale without a new poll. Renders nothing. */
function StatusReporter({
  snap,
  settings,
  onStatus,
}: {
  snap: PollSnapshot | null;
  settings: EmmSettings;
  onStatus: (s: FrameStatus) => void;
}) {
  const now = useSecondTick();
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const computed = badgeState({
    now,
    lastOkAt: snap?.receivedAt ?? null,
    consecutiveFailures: snap?.failures ?? 0,
    online,
    staleAfterSeconds: snap?.board?.staleAfterSeconds ?? 60,
    pollSeconds: settings.pollSeconds,
  });
  // A payload restored from storage after a reload is never "live" until Nexus answers.
  const state = snap?.restored && computed === "live" ? "stale" : computed;
  const reason = !settings.nexusUrl ? "Nexus URL not set" : snap?.reason;
  const fixture = snap?.board?.fixture ?? false;
  const receivedAt = snap?.receivedAt ?? null;

  const last = useRef<string>("");
  useEffect(() => {
    const status: FrameStatus = { state, updatedAt: receivedAt, reason, fixture };
    const key = JSON.stringify(status);
    if (key !== last.current) {
      last.current = key;
      onStatus(status);
    }
  }, [state, receivedAt, reason, fixture, onStatus]);

  return null;
}
