import { checkToken, tokenFingerprint } from "./auth.mjs";
import { createRateLimiter } from "./rateLimit.mjs";

/**
 * Read-only display routes for Nexus (build order Phase 4, report 3.1, 2.4, 2.6).
 *
 *   GET /api/display/board   -> section 7 payload
 *   GET /api/display/health  -> { ok: true, time }
 *
 * - Authorization: Bearer <DISPLAY_TOKEN>; missing or wrong is 401
 * - token bound to X-Display-Id
 * - CORS for the display origin only; preflight cached 10 minutes
 * - 10 requests per minute per token and display id; 429 with Retry-After
 * - logs display id, ip and outcome; never the token
 * - no write route accepts the display token
 *
 * Framework-agnostic: works as a Node http handler, and as Express middleware
 * (it returns false for paths it does not own so you can call next()).
 *
 * @param {{
 *   getTokens: () => { displayId: string, token: string }[],
 *   getBoard: (ctx: { displayId: string }) => Promise<object>,
 *   allowedOrigins: string[],
 *   limiter?: ReturnType<typeof createRateLimiter>,
 *   log?: (entry: object) => void,
 *   now?: () => Date,
 * }} opts
 */
export function createDisplayHandler(opts) {
  const limiter = opts.limiter ?? createRateLimiter();
  const log = opts.log ?? ((e) => console.log(JSON.stringify(e)));
  const now = opts.now ?? (() => new Date());
  const allowed = new Set(opts.allowedOrigins);

  const cors = (req, res) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, X-Display-Id");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Expose-Headers", "Retry-After");
      res.setHeader("Access-Control-Max-Age", "600");
    }
  };

  const send = (res, status, body, extra = {}) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    res.end(JSON.stringify(body));
  };

  return async function displayHandler(req, res) {
    const url = new URL(req.url ?? "/", "http://nexus.local");
    const route = url.pathname.replace(/\/+$/, "");
    if (route !== "/api/display/board" && route !== "/api/display/health") return false;

    cors(req, res);
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "unknown";
    const displayHeader = typeof req.headers["x-display-id"] === "string" ? req.headers["x-display-id"] : undefined;
    const entry = (status, outcome, displayId = displayHeader ?? null) =>
      log({ at: now().toISOString(), route, displayId, ip, status, outcome });

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return true;
    }
    if (req.method !== "GET") {
      send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, OPTIONS" });
      entry(405, "method");
      return true;
    }

    const auth = checkToken(req.headers.authorization, displayHeader, opts.getTokens());
    if (!auth.ok) {
      send(res, 401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });
      entry(401, auth.reason);
      return true;
    }

    const bearer = /^Bearer\s+(\S+)/i.exec(req.headers.authorization)[1];
    const rl = limiter.take(`${tokenFingerprint(bearer)}:${auth.displayId}`);
    if (!rl.allowed) {
      send(res, 429, { error: "rate_limited" }, { "Retry-After": String(rl.retryAfterSeconds) });
      entry(429, "rate-limited", auth.displayId);
      return true;
    }

    if (route === "/api/display/health") {
      send(res, 200, { ok: true, time: now().toISOString().replace(/\.\d{3}Z$/, "Z") });
      entry(200, "ok", auth.displayId);
      return true;
    }

    try {
      const board = await opts.getBoard({ displayId: auth.displayId });
      send(res, 200, board);
      entry(200, "ok", auth.displayId);
    } catch (err) {
      send(res, 500, { error: "board_unavailable" });
      entry(500, `error:${err instanceof Error ? err.name : "unknown"}`, auth.displayId);
    }
    return true;
  };
}
