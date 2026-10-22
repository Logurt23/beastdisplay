import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Display tokens. Each token is bound to one display id, so a token copied to a
 * second device shows up in logs as a mismatch. Read on every request, so a
 * rotated token is live without a rebuild or restart.
 *
 * Env format: DISPLAY_TOKENS="office-main:<token>[,office-main:<next-token>]"
 * Two tokens for one display id is the rotation overlap window.
 */
export function tokensFromEnv(name = "DISPLAY_TOKENS", env = process.env) {
  return () =>
    String(env[name] ?? "")
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .flatMap((pair) => {
        const i = pair.indexOf(":");
        if (i <= 0) return [];
        const displayId = pair.slice(0, i).trim();
        const token = pair.slice(i + 1).trim();
        return displayId && token ? [{ displayId, token }] : [];
      });
}

const digest = (s) => createHash("sha256").update(s, "utf8").digest();

/** Short, non-reversible id for logs and rate-limit keys. Never log the token. */
export function tokenFingerprint(token) {
  return digest(token).toString("hex").slice(0, 10);
}

/**
 * @returns {{ ok: true, displayId: string } | { ok: false, reason: "missing" | "invalid" | "display-mismatch" }}
 */
export function checkToken(authorization, displayIdHeader, entries) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  if (!m) return { ok: false, reason: "missing" };
  const given = digest(m[1]);
  let match = null;
  for (const e of entries) {
    // Compare fixed-length digests in constant time; keep scanning to avoid early exit timing.
    if (timingSafeEqual(given, digest(e.token)) && !match) match = e;
  }
  if (!match) return { ok: false, reason: "invalid" };
  if (displayIdHeader && displayIdHeader !== match.displayId) return { ok: false, reason: "display-mismatch" };
  return { ok: true, displayId: match.displayId };
}
