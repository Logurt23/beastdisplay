# Deploy (EMM)

Production: `https://display.emmadvertising.com`, data from `https://nexus.emmadvertising.com`.

## Build

```
VITE_NEXUS_URL=https://nexus.emmadvertising.com npm run build
npm run check:token      # fails if dist/ contains a token or a config.js
```

`VITE_NEXUS_URL` is only a default (the Nexus URL is not a secret). `functions.emm.nexusUrl` in `config.js` overrides it, so one build can serve any host.

Upload `dist/` to the static host. Then write `config.js` beside `index.html` on the host, from `deploy/config.production.example.js`, with the real token.

## Static host requirements

- TLS, with automatic certificate renewal.
- SPA fallback: unknown paths serve `index.html`. `/config.js` is excluded from the fallback (a missing config must 404, not return HTML).
- `config.js`: `Cache-Control: no-cache`, so a rotated token is live at the next reload.
- `index.html`: `Cache-Control: no-cache`. `/assets/*` (fingerprinted): long-lived immutable cache.
- Security headers: a CSP that allows only `'self'` plus Nexus in `connect-src`, and no third-party script, font or analytics origins.

Examples: [deploy/nginx.conf](../deploy/nginx.conf) and [deploy/_headers](../deploy/_headers) + [deploy/_redirects](../deploy/_redirects) (Cloudflare Pages or Netlify). Which host serves `display.emmadvertising.com` is still open; pick the matching file.

## Production config

`deploy/config.production.example.js` pins `fn=emm`, `layout=warroom`, the Chicago clock on, and no external targets. `lobbyMode: false` (office screen, client names allowed).

## Token rotation (no rebuild)

1. In Nexus, add the new token next to the old one for the same display id: `DISPLAY_TOKENS="office-main:<old>,office-main:<new>"`.
2. On the display host, edit `config.js` to the new token.
3. The screen picks it up at the next reload, or within one poll if Nexus has already dropped the old token (a 401 makes the display re-read `config.js` once).
4. Remove the old token from Nexus. Nexus logs show any request still using it as a 401 with the display id.

## Checks after deploy

- The production URL shows the board with the Chicago clock and a live badge.
- `curl -s https://display.emmadvertising.com/assets/*.js | grep <token>` finds nothing (or run `npm run check:token` on the build).
- `curl -I https://display.emmadvertising.com/config.js` shows `Cache-Control: no-cache`.
- Pull the network on the display device: the badge goes offline and the last board stays.
- No requests leave for any host other than the display host and Nexus (browser network panel).
