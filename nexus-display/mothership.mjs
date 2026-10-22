/**
 * Mothership adapter for the pulse block. Mothership stays behind Nexus; the
 * display never holds these credentials.
 *
 * What Mothership is, and how to pull from it, is an open item (build order
 * section 12, item 2). Until it is answered this adapter returns an honest empty
 * pulse. It never fakes live numbers.
 *
 * @param {{ credentials?: unknown, pull?: (credentials: unknown) => Promise<{ tiles: unknown[], ticker: unknown[] }> }} opts
 * @returns {Promise<{ tiles: unknown[], ticker: unknown[], sourceStatus: "live" | "unconfigured" | "error" }>}
 */
export async function fetchPulse({ credentials, pull } = {}) {
  if (!credentials || typeof pull !== "function") {
    return { tiles: [], ticker: [], sourceStatus: "unconfigured" };
  }
  try {
    const { tiles = [], ticker = [] } = (await pull(credentials)) ?? {};
    return { tiles: Array.isArray(tiles) ? tiles : [], ticker: Array.isArray(ticker) ? ticker : [], sourceStatus: "live" };
  } catch {
    return { tiles: [], ticker: [], sourceStatus: "error" };
  }
}
