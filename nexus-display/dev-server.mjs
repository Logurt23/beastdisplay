/**
 * LOCAL DEV ONLY. A stand-in Nexus that serves the display routes with the
 * labeled fixture board, rebased so its dates sit around today in Chicago.
 * Every payload carries "_seed" so the display shows a "Fixture data" banner.
 * Never deploy this; the real routes belong inside Nexus (see README.md).
 *
 *   DISPLAY_TOKENS=office-main:dev-token node nexus-display/dev-server.mjs
 *
 * Dev controls (no auth, localhost only):
 *   POST /__dev/mode?m=ok|changed|alternate|down|drop|slow|unconfigured|error
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokensFromEnv } from "./auth.mjs";
import { createRateLimiter } from "./rateLimit.mjs";
import { createDisplayHandler } from "./routes.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const load = (name) => JSON.parse(readFileSync(here(`../src/functions/emm/fixtures/${name}`), "utf8"));
const base = load("board.fixture.json");
const changed = load("board.changed.fixture.json");

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
process.env.DISPLAY_TOKENS ??= "office-main:dev-token";
const origins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173").split(",");
const rateLimit = Number(process.env.RATE_LIMIT ?? 10);

let mode = process.env.MODE ?? "ok";
let flip = false;

function chicagoToday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** Shift every date in the fixture by whole days so "today" in the fixture is today. */
function rebase(board) {
  const days = Math.round((Date.parse(chicagoToday()) - Date.parse(board._fixture.anchorDate)) / 86_400_000);
  const ms = days * 86_400_000;
  const shiftIso = (s) => (s ? new Date(Date.parse(s) + ms).toISOString().replace(/\.\d{3}Z$/, "Z") : s);
  const shiftYmd = (s) => (s ? new Date(Date.parse(s) + ms).toISOString().slice(0, 10) : s);
  const out = structuredClone(board);
  delete out._fixture;
  out._seed = { note: "seed: local fixture, rebased to today. Not EMM business data." };
  out.generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  out.pulse.ticker = out.pulse.ticker.map((t) => ({ ...t, at: shiftIso(t.at) }));
  out.projects = out.projects.map((p) => ({ ...p, dueOn: shiftYmd(p.dueOn) }));
  out.events = out.events.map((e) => ({ ...e, startsAt: shiftIso(e.startsAt), endsAt: shiftIso(e.endsAt) }));
  out.goals = out.goals.map((g) => ({ ...g, updatedAt: shiftIso(g.updatedAt) }));
  return out;
}

async function getBoard() {
  if (mode === "down") throw new Error("simulated outage");
  if (mode === "slow") await new Promise((r) => setTimeout(r, 12_000));
  let src = base;
  if (mode === "changed") src = changed;
  if (mode === "alternate") src = (flip = !flip) ? changed : base;
  const board = rebase(src);
  if (mode === "unconfigured") board.pulse = { tiles: [], ticker: [], sourceStatus: "unconfigured" };
  if (mode === "error") board.pulse = { tiles: [], ticker: [], sourceStatus: "error" };
  return board;
}

const handler = createDisplayHandler({
  getTokens: tokensFromEnv(),
  getBoard,
  allowedOrigins: origins,
  limiter: createRateLimiter({ limit: rateLimit }),
  log: (e) => process.env.QUIET ? undefined : console.log(JSON.stringify(e)),
});

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname === "/__dev/mode" && req.method === "POST") {
    mode = url.searchParams.get("m") ?? "ok";
    res.end(JSON.stringify({ mode }));
    return;
  }
  if (mode === "drop" && url.pathname.startsWith("/api/display/") && req.method === "GET") {
    req.socket.destroy();
    return;
  }
  if (!(await handler(req, res))) {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(PORT, HOST, () => console.log(`[nexus-dev] fixture Nexus on http://${HOST}:${PORT} (mode ${mode})`));
