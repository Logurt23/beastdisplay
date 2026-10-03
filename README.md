# BeastDisplay

BeastDisplay is a small always-on web app that shows a URL as a display. A screen opens a BeastDisplay URL and the page fills that screen with zero input after load. It can show one allowlisted URL, rotate a list, or render a built-in function pack. The first pack is `emm`, the EMM Advertising war room board, which reads from Nexus.

- Core player: [docs/core.md](docs/core.md)
- EMM pack: [docs/functions/emm.md](docs/functions/emm.md) and the stat menu [docs/functions/emm-statistics.md](docs/functions/emm-statistics.md)
- Kiosk device setup: [docs/kiosk.md](docs/kiosk.md)
- Deploy and token rotation: [docs/deploy.md](docs/deploy.md)
- Nexus read routes to port: [nexus-display/README.md](nexus-display/README.md)
- Product source of truth: [docs/build-order.md](docs/build-order.md); engineering review: [docs/fable-report.md](docs/fable-report.md)

## Layout of the tree

```
src/core/          the URL player (always on): config, targets, allowlist, frame, reload, wake lock, registry
src/functions/     function packs; v1 registry lists emm only
src/functions/emm/ the EMM pack: poller, contract types, due/sort/goal/calendar rules, panels, layouts, fixtures
nexus-display/     reference Nexus read routes + a local fixture Nexus for dev (not deployed)
deploy/            static-host examples (nginx, Cloudflare Pages / Netlify headers), production config template
tests/             unit, component and soak tests
scripts/           browser checks (Chromium), token-in-build check
```

## Run it locally

```
npm install
npm run nexus:dev          # fixture Nexus on :8787 (token dev-token, display office-main)
cp config.example.js config.local.js   # then set nexusUrl to http://127.0.0.1:8787 and token to dev-token
npm run dev                # http://localhost:5173
```

## Checks

```
npm run typecheck
npm test                   # unit, component, soak
npm run test:tz            # the same suite with the runner in UTC, Asia/Tokyo and America/Chicago
npm run build && npm run check:token
npm run build && npm run check:e2e   # Chromium at 1920x1080 and 3840x2160; screenshots in artifacts/
```

Fixture data lives only under `src/functions/emm/fixtures/` and carries a `_fixture` key. The local Nexus tags what it serves with `_seed`. Either label puts a "Fixture data, not live" banner on screen, so fake data cannot pass for live numbers.
