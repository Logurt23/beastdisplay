# BeastDisplay core: the URL player

Core is always on and never depends on a function pack or on Nexus. If every pack is turned off, core still boots.

## URL model

| Query | Meaning |
| --- | --- |
| (none) | Boot `defaultTarget` from runtime config. |
| `?target=<url>` | Show an external URL. Origin must be on the allowlist. |
| `?fn=emm` | Render the EMM function pack. |
| `?layout=warroom` | Pack layout. EMM: `warroom` (default), `projects`, `pulse`, `goals`. Unknown falls back to the default with a console warning. |
| `?rotate=45` | Seconds between targets. Omit to pin one target. |
| `?theme=night` | `night` (default) or `day`. |

Precedence: URL query, then `window.BEASTDISPLAY_CONFIG` from runtime `config.js`, then built-in defaults (`src/core/config.ts`). Bad config values fall back to defaults; config parsing never throws.

## Runtime config

`config.js` is written on the display host beside `index.html`. It is never bundled and never in the repo (`config.example.js` is the template; `config.local.js` is for local dev and gitignored). Shape:

```js
window.BEASTDISPLAY_CONFIG = {
  displayId: "office-main",
  theme: "night",
  clock: { show: false, timeZone: "America/Chicago" },
  safeAreaPx: 48,                 // 1080p px, scaled with the screen; raise to 96 if the TV cannot do Just Scan
  reloadHours: 6,
  lobbyMode: false,               // true hides client names unless Nexus sends lobbySafe: true
  defaultTarget: { kind: "function", fn: "emm", layout: "warroom" },
  allowlist: [{ origin: "https://warroom.emmadvertising.com", frame: false }],
  targets: [],                    // rotate list; empty rotates the pinned pack's layouts
  rotateSeconds: 0,
  functions: { emm: { enabled: true, nexusUrl: "...", token: "...", pollSeconds: 15, timeoutMs: 8000 } },
};
```

## Function registry

`src/functions/index.ts` lists packs. Each has `{ id, title }` plus layouts and a lazy loader; `enabled` comes only from `functions.<id>.enabled === true` in config (`registryEntries()` returns `{ id, title, enabled }`). v1 lists `emm` only. A pack's code is not downloaded unless it is shown.

Target resolution is a pure function, `resolveTargets(query, config, functions)` in `src/core/targets.ts`. It returns one of: `function`, `external { url, frame }`, `refused { url, reason }`, `function-not-configured`, `none`. Each non-function result has a quiet full-stage message; nothing renders blank.

## Allowlist and external targets

- Matching is by exact origin: scheme, host and port. No wildcards in v1.
- Each entry carries an operator-set `frame` flag (default `false`). BeastDisplay never tries to detect frameability: a page cannot read another origin's `X-Frame-Options` or `frame-ancestors`, and a cancelled embed can still fire `load` (Fable report 2.1).
- `frame: false`: top-level navigation to the URL. This leaves BeastDisplay, so it cannot rotate back.
- `frame: true`: iframe inside the kiosk frame (clock, badge and wordmarks stay). If `load` has not fired in 15 s, the stage shows "Open blocked" with the URL.
- Non-allowlisted or invalid URLs show "Not on the allowlist" / "Not a valid URL" with the URL text.

## Rotate

- One timer, one index. Rotation pauses while the badge is offline.
- Only function layouts and `frame: true` externals rotate. `frame: false` externals in a rotate list are dropped with a console warning.
- `?fn=emm&rotate=45` (or a default function target with `rotateSeconds`) cycles that pack's layouts when no external target is in the list.
- A single target is pinned even when rotate is set.

## Kiosk frame

Safe area (`safeAreaPx`, default 48 at 1080p), top bar (heading, fixture banner, connection badge, clock), stage, bottom bar (BeastDisplay wordmark bottom left, pack wordmark bottom right). The clock is off unless `clock.show` is true or the current pack asks for it (EMM does). `cursor: none` always; no document scroll.

All sizes are written at 1080p and scaled by `--u = min(100vh/1080, 100vw/1920)`, so 3840x2160 at 100% OS scaling renders the same layout at twice the size.

## Connection badge

| Badge | Condition |
| --- | --- |
| `live` | Last good response within `max(staleAfterSeconds, 2 x pollSeconds)` of now (client receipt time, not server time). |
| `stale` | Older than that, fewer than 4 consecutive failures; or a 401/429 (with a reason line); or a payload restored from storage that Nexus has not confirmed yet. |
| `offline` | 4+ consecutive network failures (timeout, unreachable, 5xx), or `navigator.onLine` is false. |

An "Updated 14s ago" line sits under the badge. With no function pack on screen, the badge reports the player's own reachability from a `GET /config.js` probe every 60 s.

## Offline and reload

- A failed fetch never blanks the screen: the last good payload stays and the badge changes.
- The last good EMM payload is saved in `localStorage` and painted on boot (badge `stale` until Nexus answers).
- Reload every `reloadHours` (6) as a leak backstop, with three guards: only when the badge is `live`; only after a same-origin `GET /config.js` (no-store, 5 s timeout) returns 2xx; and not within 30 s of a target switch. Otherwise retry in 10 minutes. A reload while the host is down would replace the last frame with a browser error page.
- Screen wake lock is requested on load and re-acquired when the page becomes visible.
- No service worker in v1.

## Where the display token lives

In runtime `config.js` on the display host, served `Cache-Control: no-cache`. Never in a `VITE_*` variable, never in the URL. See [deploy.md](deploy.md).
