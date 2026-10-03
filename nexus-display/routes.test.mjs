// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { checkToken, tokensFromEnv } from "./auth.mjs";
import { buildBoard } from "./board.mjs";
import { fetchPulse } from "./mothership.mjs";
import { createRateLimiter } from "./rateLimit.mjs";
import { createDisplayHandler } from "./routes.mjs";

const ORIGIN = "https://display.emmadvertising.com";

async function withServer(opts, fn) {
  const logs = [];
  const handler = createDisplayHandler({
    getTokens: () => [{ displayId: "office-main", token: "secret-token-1" }],
    getBoard: async () => buildBoard({ pulse: await fetchPulse() }),
    allowedOrigins: [ORIGIN],
    log: (e) => logs.push(e),
    ...opts,
  });
  const server = createServer(async (req, res) => {
    if (!(await handler(req, res))) {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, logs);
  } finally {
    server.close();
  }
}

const auth = { Authorization: "Bearer secret-token-1", "X-Display-Id": "office-main", Origin: ORIGIN };

describe("display routes", () => {
  it("returns the board with a valid token and 401 without", async () => {
    await withServer({}, async (base, logs) => {
      const ok = await fetch(`${base}/api/display/board`, { headers: auth });
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body.pulse).toEqual({ tiles: [], ticker: [], sourceStatus: "unconfigured" });
      expect(body.projects).toEqual([]);
      expect(body.events).toEqual([]);
      expect(body.goals).toEqual([]);
      expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect(ok.headers.get("cache-control")).toBe("no-store");

      expect((await fetch(`${base}/api/display/board`)).status).toBe(401);
      expect((await fetch(`${base}/api/display/board`, { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
      expect(JSON.stringify(logs)).not.toContain("secret-token-1");
      expect(logs.some((l) => l.displayId === "office-main" && l.status === 200)).toBe(true);
    });
  });

  it("serves health with the same token", async () => {
    await withServer({}, async (base) => {
      const res = await fetch(`${base}/api/display/health`, { headers: auth });
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Date.parse(body.time)).not.toBeNaN();
      expect((await fetch(`${base}/api/display/health`)).status).toBe(401);
    });
  });

  it("rejects a token used from a different display id", async () => {
    await withServer({}, async (base, logs) => {
      const res = await fetch(`${base}/api/display/board`, { headers: { ...auth, "X-Display-Id": "lobby" } });
      expect(res.status).toBe(401);
      expect(logs.at(-1).outcome).toBe("display-mismatch");
    });
  });

  it("answers preflight with the allow headers and no CORS for other origins", async () => {
    await withServer({}, async (base) => {
      const pre = await fetch(`${base}/api/display/board`, { method: "OPTIONS", headers: { Origin: ORIGIN } });
      expect(pre.status).toBe(204);
      expect(pre.headers.get("access-control-allow-headers")).toBe("Authorization, X-Display-Id");
      expect(pre.headers.get("access-control-max-age")).toBe("600");
      const other = await fetch(`${base}/api/display/board`, { headers: { ...auth, Origin: "https://evil.example" } });
      expect(other.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  it("rate limits to 10 per minute with Retry-After", async () => {
    await withServer({ limiter: createRateLimiter({ limit: 10 }) }, async (base) => {
      const codes = [];
      let retry = null;
      for (let i = 0; i < 20; i++) {
        const r = await fetch(`${base}/api/display/board`, { headers: auth });
        codes.push(r.status);
        if (r.status === 429) retry = r.headers.get("retry-after");
      }
      expect(codes.filter((c) => c === 200)).toHaveLength(10);
      expect(codes.filter((c) => c === 429)).toHaveLength(10);
      expect(Number(retry)).toBeGreaterThan(0);
    });
  });

  it("refuses writes", async () => {
    await withServer({}, async (base) => {
      const r = await fetch(`${base}/api/display/board`, { method: "POST", headers: auth, body: "{}" });
      expect(r.status).toBe(405);
    });
  });
});

describe("tokens", () => {
  it("reads several tokens per display for rotation overlap", () => {
    const get = tokensFromEnv("T", { T: "office-main:old, office-main:new ,bad" });
    expect(get()).toEqual([
      { displayId: "office-main", token: "old" },
      { displayId: "office-main", token: "new" },
    ]);
    expect(checkToken("Bearer new", "office-main", get())).toEqual({ ok: true, displayId: "office-main" });
    expect(checkToken("Bearer old", undefined, get()).ok).toBe(true);
    expect(checkToken(undefined, undefined, get())).toEqual({ ok: false, reason: "missing" });
  });
});

describe("mothership adapter", () => {
  it("is honestly empty without credentials, and reports errors", async () => {
    expect(await fetchPulse()).toEqual({ tiles: [], ticker: [], sourceStatus: "unconfigured" });
    const failing = await fetchPulse({ credentials: { key: "x" }, pull: async () => { throw new Error("down"); } });
    expect(failing.sourceStatus).toBe("error");
  });
});
