import { normalizeOrigin, type AllowEntry } from "./config";

/** Exact origin match (scheme + host + port). No wildcards in v1. */
export function matchAllowlist(url: string, allowlist: AllowEntry[]): AllowEntry | null {
  const origin = normalizeOrigin(url);
  if (!origin) return null;
  return allowlist.find((e) => e.origin === origin) ?? null;
}
