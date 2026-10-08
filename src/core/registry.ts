import type { ComponentType } from "react";
import type { Config, FunctionConfig } from "./config";
import type { FrameStatus } from "./frame/status";

/** What core passes to a mounted function pack. */
export interface FunctionProps {
  layout: string;
  config: Config;
  fnConfig: FunctionConfig;
  /** Report data health so the core badge can show it. */
  onStatus: (status: FrameStatus) => void;
}

/** Static description of a function pack. Loading the pack itself is lazy. */
export interface FunctionModule {
  id: string;
  title: string;
  /** Small wordmark shown opposite the BeastDisplay mark while the pack is on screen. */
  wordmark: string;
  /**
   * Optional brand mark shown beside the heading while the pack is on screen.
   * Path under public/ (e.g. "/brand/emm-logo.svg"). Without it the wordmark text is shown.
   */
  logo?: string;
  layouts: readonly string[];
  defaultLayout: string;
  /** Packs that want the clock turn it on through their layout; core owns the clock. */
  wantsClock: boolean;
  load: () => Promise<{ default: ComponentType<FunctionProps> }>;
}

/** The registry row the build order asks for: { id, title, enabled }. */
export interface RegistryEntry {
  id: string;
  title: string;
  enabled: boolean;
}

export function registryEntries(modules: readonly FunctionModule[], config: Config): RegistryEntry[] {
  return modules.map((m) => ({ id: m.id, title: m.title, enabled: config.functions[m.id]?.enabled === true }));
}

export function findEnabled(
  modules: readonly FunctionModule[],
  config: Config,
  id: string,
): FunctionModule | null {
  const m = modules.find((x) => x.id === id);
  return m && config.functions[id]?.enabled === true ? m : null;
}
