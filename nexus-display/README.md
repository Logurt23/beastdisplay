# Nexus display routes (to port into Nexus)

The Nexus repository was not available to this build, so these are reference routes written to the build order (Phase 4) and Fable report (3.1, 2.4, 2.6). They are plain Node ESM with no dependencies. Port them into Nexus, or mount them as-is:

```js
import { createDisplayHandler } from "./nexus-display/routes.mjs";
import { tokensFromEnv } from "./nexus-display/auth.mjs";
import { buildBoard } from "./nexus-display/board.mjs";
import { fetchPulse } from "./nexus-display/mothership.mjs";

const display = createDisplayHandler({
  getTokens: tokensFromEnv("DISPLAY_TOKENS"),            // "office-main:<token>[,office-main:<next>]"
  allowedOrigins: ["https://display.emmadvertising.com"],
  getBoard: async () =>
    buildBoard({
      projects: await nexusProjectsForDisplay(),           // map Nexus field names to section 7 here
      events: await nexusEventsForDisplay(),
      goals: await nexusGoalsForDisplay(),
      pulse: await fetchPulse({ credentials: mothershipCredentials(), pull: mothershipPull }),
    }),
});

// Express: app.use((req, res, next) => display(req, res).then((handled) => handled || next()));
// Node http: if (!(await display(req, res))) { ...your other routes }
```

## What it does

| Route | Response |
| --- | --- |
| `GET /api/display/board` | Section 7 payload plus `pulse.sourceStatus` (approved 2026-10-03). |
| `GET /api/display/health` | `{ "ok": true, "time": "<iso>" }`. |
| `OPTIONS` either route | 204 with `Allow-Origin` for the display host only, `Allow-Headers: Authorization, X-Display-Id`, `Max-Age: 600`, `Expose-Headers: Retry-After`. |
| Anything else on those paths | 405. No write route accepts the display token. |

- `Authorization: Bearer <token>`; missing or wrong token is 401. Tokens are compared as SHA-256 digests in constant time.
- Each token is bound to a display id. A token sent with a different `X-Display-Id` is 401 and logged as `display-mismatch`.
- Rate limit: 10 requests per minute per token and display id, then 429 with `Retry-After`.
- Logs one JSON line per request: time, route, display id, IP, status, outcome. Never the token.
- `Cache-Control: no-store` on every response.
- `buildBoard` fills missing arrays with `[]` and stamps `generatedAt`, `timezone: "America/Chicago"`, `staleAfterSeconds: 60`.
- `fetchPulse` returns `{ tiles: [], ticker: [], sourceStatus: "unconfigured" }` until Mothership credentials and a pull function exist, and `sourceStatus: "error"` if the pull throws. It never fakes numbers. What Mothership is remains an open item.

## What still needs Nexus access

1. Check whether Nexus already exposes `/api/display/*` (Phase 4 says build only if it does not).
2. Write the three record queries above against real Nexus tables, mapping names to section 7 without renaming live records. Decide how long `done` projects stay in the payload (open question).
3. Wire Mothership into `fetchPulse` once its API and credentials are known. Nexus computes `leads_today`, its `delta`, `deltaLabel` and `tone`.
4. Set `DISPLAY_TOKENS` in the Nexus environment and the same token in the display host's `config.js`.
5. Run the checks: `curl` with the token is 200, without it 401, preflight returns the allow headers, 20 quick requests give ten 429s.

## Local fixture Nexus

`dev-server.mjs` serves the fixture board through these same routes for local development. It rebases fixture dates to today, tags the payload `_seed`, and has dev-only switches (`POST /__dev/mode?m=ok|changed|alternate|down|drop|slow|unconfigured|error`). Never deploy it.

Tests: `routes.test.mjs` (run with `npm test`).
