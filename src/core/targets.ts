import { matchAllowlist } from "./allowlist";
import type { Config, Query, TargetSpec } from "./config";

export interface FunctionMeta {
  id: string;
  layouts: readonly string[];
  defaultLayout: string;
}

export type Target =
  | { kind: "function"; fn: string; layout: string }
  | { kind: "external"; url: string; frame: boolean }
  | { kind: "refused"; url: string; reason: "not-allowlisted" | "invalid-url" }
  | { kind: "function-not-configured"; fn: string }
  | { kind: "none" };

export interface Resolution {
  targets: Target[];
  /** 0 means pinned. Only > 0 when there are at least two targets to cycle. */
  rotateSeconds: number;
  warnings: string[];
}

function resolveSpec(spec: TargetSpec, config: Config, fns: readonly FunctionMeta[], warnings: string[]): Target {
  if (spec.kind === "external") {
    let parsed: URL;
    try {
      parsed = new URL(spec.url);
    } catch {
      return { kind: "refused", url: spec.url, reason: "invalid-url" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { kind: "refused", url: spec.url, reason: "invalid-url" };
    }
    const entry = matchAllowlist(spec.url, config.allowlist);
    if (!entry) return { kind: "refused", url: spec.url, reason: "not-allowlisted" };
    return { kind: "external", url: parsed.href, frame: entry.frame };
  }
  const meta = fns.find((f) => f.id === spec.fn);
  if (!meta || config.functions[spec.fn]?.enabled !== true) {
    return { kind: "function-not-configured", fn: spec.fn };
  }
  let layout = spec.layout ?? meta.defaultLayout;
  if (!meta.layouts.includes(layout)) {
    warnings.push(`Unknown layout "${layout}" for ${spec.fn}; using ${meta.defaultLayout}.`);
    layout = meta.defaultLayout;
  }
  return { kind: "function", fn: spec.fn, layout };
}

/**
 * Pure target resolution. Query wins over config.
 *
 * Rotation rules (Fable report 2.1):
 * - Only function layouts and frame:true externals rotate; frame:false externals
 *   are top-level navigations, cannot come back, and are dropped with a warning.
 * - A single function target with rotate set cycles that pack's layouts,
 *   as long as no external target is in the list.
 */
export function resolveTargets(query: Query, config: Config, fns: readonly FunctionMeta[]): Resolution {
  const warnings: string[] = [];
  const rotate = query.rotate ?? config.rotateSeconds;

  let specs: TargetSpec[];
  if (query.target) specs = [{ kind: "external", url: query.target }];
  else if (query.fn) specs = [{ kind: "function", fn: query.fn, layout: query.layout }];
  else if (rotate > 0 && config.targets.length > 0) specs = config.targets;
  else if (config.defaultTarget) {
    const d = config.defaultTarget;
    specs = [d.kind === "function" && query.layout ? { ...d, layout: query.layout } : d];
  } else specs = [];

  if (specs.length === 0) return { targets: [{ kind: "none" }], rotateSeconds: 0, warnings };

  let targets = specs.map((s) => resolveSpec(s, config, fns, warnings));

  if (rotate > 0 && targets.length > 1) {
    const kept = targets.filter((t) => {
      if (t.kind === "external" && !t.frame) {
        warnings.push(`Rotate skips ${t.url}: it opens top-level and could not return.`);
        return false;
      }
      return true;
    });
    targets = kept.length > 0 ? kept : [targets[0]];
  }

  if (rotate > 0 && targets.length === 1 && targets[0].kind === "function") {
    const t = targets[0];
    const meta = fns.find((f) => f.id === t.fn)!;
    if (meta.layouts.length > 1) {
      const start = meta.layouts.indexOf(t.layout);
      const order = [...meta.layouts.slice(start), ...meta.layouts.slice(0, start)];
      targets = order.map((layout) => ({ kind: "function", fn: t.fn, layout }));
    }
  }

  return { targets, rotateSeconds: rotate > 0 && targets.length > 1 ? rotate : 0, warnings };
}

export function targetKey(t: Target): string {
  switch (t.kind) {
    case "function":
      return `fn:${t.fn}:${t.layout}`;
    case "external":
    case "refused":
      return `${t.kind}:${t.url}`;
    case "function-not-configured":
      return `nofn:${t.fn}`;
    case "none":
      return "none";
  }
}
