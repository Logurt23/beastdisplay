/**
 * Sliding-window limiter, per key (token fingerprint + display id).
 * Default 10 requests per minute (build order Phase 12).
 */
export function createRateLimiter({ limit = 10, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return {
    /** @returns {{ allowed: true } | { allowed: false, retryAfterSeconds: number }} */
    take(key) {
      const t = now();
      const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (list.length >= limit) {
        hits.set(key, list);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((list[0] + windowMs - t) / 1000)) };
      }
      list.push(t);
      hits.set(key, list);
      if (hits.size > 1000) {
        for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
      }
      return { allowed: true };
    },
  };
}
