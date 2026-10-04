import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { applyQuery, parseQuery, readWindowConfig, type Config } from "../core/config";
import { ErrorBoundary } from "../core/ErrorBoundary";
import { KioskFrame } from "../core/frame/KioskFrame";
import type { FrameStatus } from "../core/frame/status";
import { BlockedState } from "../core/player/BlockedState";
import { ExternalTarget } from "../core/player/ExternalTarget";
import { useRotation } from "../core/player/Rotator";
import { probeConfig } from "../core/probe";
import type { FunctionModule, FunctionProps } from "../core/registry";
import { startReloadPolicy } from "../core/reload";
import { resolveTargets, targetKey, type Target } from "../core/targets";
import { useProbeStatus } from "../core/useProbeStatus";
import { holdWakeLock } from "../core/wakeLock";
import { FUNCTIONS } from "../functions";

const lazyCache = new Map<string, ComponentType<FunctionProps>>();
function lazyPack(m: FunctionModule): ComponentType<FunctionProps> {
  let c = lazyCache.get(m.id);
  if (!c) {
    c = lazy(m.load);
    lazyCache.set(m.id, c);
  }
  return c;
}

const LAYOUT_TITLES: Record<string, string> = {
  warroom: "War room",
  projects: "Projects",
  pulse: "Pulse",
  goals: "Goals",
};

export function App({ initialConfig, search }: { initialConfig?: Config; search?: string }) {
  const query = useMemo(() => parseQuery(search ?? window.location.search), [search]);
  const config = useMemo(() => applyQuery(initialConfig ?? readWindowConfig(), query), [initialConfig, query]);
  const resolution = useMemo(() => resolveTargets(query, config, FUNCTIONS), [query, config]);

  useEffect(() => {
    for (const w of resolution.warnings) console.warn(`[BeastDisplay] ${w}`);
  }, [resolution]);

  useEffect(() => {
    document.documentElement.dataset.theme = config.theme;
  }, [config.theme]);

  const [packStatus, setPackStatus] = useState<FrameStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const current = useRotation(resolution.targets, resolution.rotateSeconds, offline);
  const isFunction = current.kind === "function";
  const probeStatus = useProbeStatus(!isFunction);
  const status: FrameStatus = isFunction ? packStatus ?? { state: "stale", updatedAt: null } : probeStatus;

  useEffect(() => setOffline(status.state === "offline"), [status.state]);

  // Reload policy and wake lock live for the life of the app.
  const badgeRef = useRef(status.state);
  badgeRef.current = status.state;
  const switchedAt = useRef(Date.now());
  useEffect(() => {
    switchedAt.current = Date.now();
  }, [current]);
  useEffect(
    () =>
      startReloadPolicy({
        hours: config.reloadHours,
        badge: () => badgeRef.current,
        probe: () => probeConfig(5000),
        busy: () => Date.now() - switchedAt.current < 30_000,
        reload: () => window.location.reload(),
      }),
    [config.reloadHours],
  );
  useEffect(() => holdWakeLock(), []);

  const onStatus = useCallback((s: FrameStatus) => setPackStatus(s), []);

  const module = current.kind === "function" ? FUNCTIONS.find((m) => m.id === current.fn) ?? null : null;
  const showClock = config.clock.show || (module?.wantsClock ?? false);

  return (
    <KioskFrame
      safeAreaPx={config.safeAreaPx}
      clockTimeZone={showClock ? config.clock.timeZone : null}
      status={status}
      packWordmark={module?.wordmark}
      packId={module?.id}
      packLogo={module?.logo}
      heading={current.kind === "function" ? LAYOUT_TITLES[current.layout] ?? current.layout : undefined}
    >
      <ErrorBoundary key={targetKey(current)} fallback={<BlockedState title="Display error" detail="This view failed to render. It will retry on the next rotation or reload." />}>
        <TargetView target={current} config={config} module={module} onStatus={onStatus} />
      </ErrorBoundary>
    </KioskFrame>
  );
}

function TargetView({
  target,
  config,
  module,
  onStatus,
}: {
  target: Target;
  config: Config;
  module: FunctionModule | null;
  onStatus: (s: FrameStatus) => void;
}) {
  switch (target.kind) {
    case "function": {
      if (!module) return <BlockedState title="Function not configured" detail={target.fn} />;
      const Pack = lazyPack(module);
      return (
        <Suspense fallback={null}>
          <Pack layout={target.layout} config={config} fnConfig={config.functions[target.fn]} onStatus={onStatus} />
        </Suspense>
      );
    }
    case "external":
      return <ExternalTarget url={target.url} frame={target.frame} />;
    case "refused":
      return (
        <BlockedState
          title={target.reason === "invalid-url" ? "Not a valid URL" : "Not on the allowlist"}
          url={target.url}
          detail="BeastDisplay only shows origins listed in its runtime config."
        />
      );
    case "function-not-configured":
      return <BlockedState title="Function not configured" detail={target.fn} />;
    case "none":
      return <BlockedState title="No display target configured" detail="Set defaultTarget in config.js, or open with ?target= or ?fn=." />;
  }
}
