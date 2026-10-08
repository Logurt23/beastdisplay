# BeastDisplay: Fable report (Phase 0)

Product: BeastDisplay. First deployment: EMM Advertising, Joplin.
Input: `BeastDisplay Build Order`, dated 2026-10-03.
Written: 2026-10-03, by Fable. Reviewed by Logan 2026-10-03, who approved the build and the `pulse.sourceStatus` addition. Executed by: Opus.

What this is: the Phase 0 review the build order asks for in section 0. It covers the five fetch topics, says what the order gets right, what to change and why, engineering notes, the 25-stat menu, open questions, and a handoff block Opus can run.

What this is not: app code. No code, package manifest, or config file was written. Nexus was not called. Nothing was seeded or deployed.

Rules this report does not touch: the product name (BeastDisplay), the core-versus-function split, and the rule that Display never talks to Mothership. Where a fetch pushes against the order, the report says so and recommends; it does not rewrite the product.

---

## Sources fetched

Cited below as [S1] to [S30]. Vendor docs are treated as practice, writeups as evidence of practice, never as requirements.

Wall and kiosk display practice

- [S1] PiMyLifeUp, Raspberry Pi kiosk using Chromium. https://pimylifeup.com/raspberry-pi-kiosk/ . Flags `--kiosk --noerrdialogs --disable-infobars`; `xset s noblank; xset s off; xset -dpms`; `unclutter -idle 0.5 -root`; the `exited_cleanly` / `exit_type` Preferences fix for the crash bubble.
- [S2] SmartUpWorld, Chromium kiosk mode guide. https://smartupworld.com/chromium-kiosk-mode/ . `--disable-session-crashed-bubble`, `--disable-pinch`, `--overscroll-history-navigation=0`, `--no-first-run`, `--no-default-browser-check`; also recommends `--incognito` and `--disk-cache-dir=/dev/null`, which this report argues against for BeastDisplay.
- [S3] Node-RED forum, keeping a dashboard tab alive in Chrome and Edge. https://discourse.nodered.org/t/how-to-make-the-dashboard-run-at-all-time-in-chrome-and-edge-beta/40870 . Tab sleeping and memory saver stop background dashboards; kiosk mode on a Pi ran "3+ days" without issue.
- [S4] MDN, Screen Wake Lock API. https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API . `navigator.wakeLock.request("screen")`; lock is released when the document is hidden and must be re-acquired on `visibilitychange`; HTTPS only; Baseline 2025.
- [S5] EBU R95, safe areas for 16:9. https://tech.ebu.ch/docs/r/r095.pdf . "The action safe area is 3.5% and the graphics safe area is 5%, at the top, bottom and lateral parts of the image."
- [S6] Wikipedia, Safe area (television). https://en.wikipedia.org/wiki/Safe_area_(television) . Flat panels "generally can show most of the picture outside the safe areas"; overscan is a TV setting, not a fixed loss.
- [S7] MDN, CSS `env()` and `safe-area-inset-*`. https://developer.mozilla.org/en-US/docs/Web/CSS/env . Values are 0 on a rectangular viewport; TVs and desktops report zero, so the app cannot read overscan from CSS.
- [S8] MDN, `Window.devicePixelRatio`. https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio . OS or browser zoom changes the CSS pixel viewport; a 4K panel is 3840x2160 CSS px at 100% and 1920x1080 CSS px at 200%.
- [S9] Chrome help, Memory Saver. https://support.google.com/chrome/answer/12929150 . Deactivates background tabs only; an "Always keep these sites active" exclusion list exists.
- [S10] Chrome developers, Memory and Energy Saver modes. https://developer.chrome.com/blog/memory-and-energy-saver-mode . Discards background tabs only; `document.wasDiscarded`; Energy Saver halves the `requestAnimationFrame` rate, CSS animations adapt automatically.

External URL display

- [S11] MDN, `X-Frame-Options`. https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options . `DENY`, `SAMEORIGIN`; `ALLOW-FROM` is obsolete and ignored.
- [S12] MDN, CSP `frame-ancestors`. https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors . "If any ancestor doesn't match, the load is canceled." Header only, not `<meta>`.
- [S13] OWASP, Clickjacking Defense Cheat Sheet. https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html . "Set the X-Frame-Options header for all responses containing HTML content." These defenses block legitimate embedders too.

Always-on screens

- [S14] MDN, Page Visibility API. https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API . Timers are throttled in hidden documents; `visibilitychange` is the hook to resume.
- [S15] Chrome developers, intensive timer throttling in Chrome 88. https://developer.chrome.com/blog/timer-throttling-in-chrome-88 . Hidden more than 5 minutes plus chained timers means wake-ups once per minute. Visible pages are exempt.
- [S16] MDN, `Navigator.onLine`. https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine . "This property is inherently unreliable, and you should not disable features based on the online status, only provide hints."
- [S17] Den Odell, Your SPA is leaking memory, soak test it. https://denodell.com/blog/your-spa-is-leaking-memory-soak-test-it . 86% of 500 repos never remove a listener, timer or subscription; some teams "force-reload their single-page web apps every few hours" as a band-aid; soak test over 200+ loops and assert DOM node and listener counts stay flat.
- [S18] MDN, `AbortSignal.timeout()`. https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static . `fetch(url, { signal: AbortSignal.timeout(ms) })` throws `TimeoutError`; Baseline 2024.
- [S19] MDN, `Cache-Control`. https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control . `no-cache` means revalidate before every reuse; `no-store` means never store.
- [S20] Grafana, playlists and kiosk mode. https://grafana.com/docs/grafana/latest/dashboards/create-manage-playlists/ . Cycle dashboards on an interval in a kiosk view with menus hidden; "perfect for big screens."
- [S21] status.io, "last updated" status bar. https://kb.status.io/design/status-bar-last-updated/ . A visible last-updated time tells viewers whether the page is alive.
- [S22] Chrome developers, tab discarding. https://developer.chrome.com/blog/tab-discarding/ . The active tab is the last candidate for discard.

Read-only display tokens

- [S23] Vite, env variables and modes. https://vite.dev/guide/env-and-mode . "`VITE_*` variables should not contain sensitive information such as API keys. The values of these variables are bundled into your source code at build time."
- [S24] Railway, frontend environment variables. https://docs.railway.com/guides/frontend-environment-variables . "Build-time variables ... become static strings in the output files"; "If you need to change a variable without rebuilding, inject it at serve time."
- [S25] OWASP, Secrets Management Cheat Sheet. https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html . Never hardcode; least privilege; audit "who/what, from which IP" accesses a secret; rotate without redeploy.

Office status boards

- [S26] Mvix, recommended font and screen sizes. https://www.mvix.com/knowledgebase/recommended-font-and-screen-sizes . 10 ft needs 20 pt, 15 ft needs 34 pt; a 43 inch panel suits a 10 ft viewer, 55 inch suits 16 ft.
- [S27] Bowdoin College, digital signage content and design guidelines. https://bowdoin.teamdynamix.com/TDClient/1814/Portal/KB/Article/173961/Digital-Signage-Content-and-Design-Guidelines . "About one inch of text height for every 10 feet"; contrast 4.5:1 normal, 3:1 large; "Do not rely on color alone"; no flashing above three per second; "keep any animation slow and subtle."
- [S28] W3C WCAG 2.2, Understanding 2.2.2 Pause, Stop, Hide. https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html . Auto-updating and scrolling content normally needs a pause control; exempt only when the motion is essential.
- [S29] MDN, `prefers-reduced-motion`. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion . Replace scaling, panning and spinning with static or subtle alternatives; keep the information.
- [S30] MDN, `Intl.DateTimeFormat`. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat . `timeZone: "America/Chicago"` plus `formatToParts()` yields the Chicago calendar date for any instant without string parsing.

Fetch outcome by topic: all five topics returned usable vendor or standards material. Two Chrome documentation URLs returned 404 and were replaced by the MDN and Chrome blog pages above. No fetch required a change to the product name, the core-versus-function split, or the Mothership rule.

---

## 1. What this order gets right

1. **Core before pack, and core boots without Nexus.** A URL player that fails when the data source is down is the most common wallboard failure. The order's non-negotiable 11 and Phase 3 check (`functions.emm.enabled = false` still boots) are the right guard.
2. **Top-level navigation as the default external player.** Most sites send `X-Frame-Options` or `frame-ancestors` and the browser cancels the framed load [S11][S12][S13]. Preferring navigation over an iframe, with an "open blocked" state instead of a blank screen, is current practice.
3. **Keep the last good payload and show a stale badge.** `navigator.onLine` is only a hint [S16]; the order correctly makes the poll result, not the browser flag, the truth and never blanks on failure.
4. **A boring poll, no websocket.** One `GET /api/display/board` every 15 s with an 8 s timeout is simple to reason about, easy to rate limit, and survives proxies. `AbortSignal.timeout` makes the timeout one line [S18].
5. **Runtime `config.js`, not baked secrets.** Vite and hosting docs agree that `VITE_*` values become static strings in the bundle and a change needs a rebuild [S23][S24]. A runtime file is how the token rotates without a rebuild.
6. **Timezone discipline.** ISO-8601 UTC on the wire, `America/Chicago` on the glass, `dueOn` as a plain date, and "timezone bugs are release blockers." Section 8's Chicago-midnight test and Phase 8's "Thursday lands on Thursday" check are exactly the two bugs that ship most often.
7. **Motion is decorative, numbers stay readable.** Animate on value change only, 180 to 400 ms, no full-screen flashes, 40 s ticker, and `prefers-reduced-motion` freezes decoration not data. This matches signage guidance (slow, subtle, no flashing) [S27] and the intent of 2.2.2 and `prefers-reduced-motion` [S28][S29].
8. **Due-date color table with a word for every state.** Six dated states plus `none` and `done`, with rush as an edge not a color swap, is a clean single function with testable boundaries.
9. **Token hygiene already in the plan.** One read token, scoped routes under `/api/display/*`, rotate without rebuild, rate limit, log display id not token, CORS pinned to one origin. That is the OWASP shape for a client-held, least-privilege secret [S25].
10. **Reload every 6 hours as a backstop.** Periodic reload is the field workaround for SPA leaks [S17]. The order treats it as policy, not as a fix; this report adds two conditions to it.
11. **Explicit "do not build" lists.** No settings UI, no auth screens, no second pack, no websocket, no proposed stat until marked in. Scope discipline is what keeps a wallboard shippable.
12. **Statistic menu as a review deliverable.** Separating "what could be on the board" from "what is on the board" keeps Mothership integration honest: an empty pulse is allowed, a faked one is not.

---

## 2. What to change, and why

Each item is tied to a fetch or a named practice. None changes the product name, the core-versus-function split, or the Mothership rule. Items marked **Order conflict** are places where a fetch pushes against the text of the order; Opus follows the order on product rules and this report on engineering tightening, and notes the conflict in the PR.

### 2.1 External targets: framing cannot be auto-detected, and rotation across top-level targets cannot return

**Order conflict** with Phase 2 ("Use iframe only if the target sends frame headers BeastDisplay can use").

A page cannot read another origin's `X-Frame-Options` or `Content-Security-Policy` response headers from JavaScript, and when `frame-ancestors` rejects the embed "the load is canceled" with no reliable event the parent can key off [S11][S12]. Chrome renders an error document inside the frame and still fires `load`. So "if the target sends frame headers we can use" is not something the player can test at runtime.

Second, a top-level navigation leaves BeastDisplay. Once the browser is on `https://example.com`, no BeastDisplay timer exists to bring it back, so `rotate` across top-level external targets cannot work.

Recommendation:

- Each allowlist entry carries an explicit `frame: boolean` set by the installer (default `false`). `frame: true` means "the operator has confirmed this origin permits embedding by `https://display.emmadvertising.com`." The player never guesses.
- `frame: false` entries open by top-level navigation. They are terminal: `rotate` ignores them, and the player logs one console warning when a rotate list contains one.
- `frame: true` entries render in an iframe inside the kiosk frame, so the clock, badge and wordmarks stay on screen. The iframe gets a load watchdog: if `load` has not fired within 15 s, show the "open blocked" state with the URL text. A canceled embed that still fires `load` cannot be distinguished from success, which is why the flag is operator-set.
- `rotate` cycles function layouts and `frame: true` targets only. This keeps rotation inside one document, which is also what the Grafana kiosk playlist does [S20].
- The EMM production config has no external targets, so none of this affects the first deployment. It matters for the "plain BeastDisplay install" promise in section 5.

### 2.2 Connection badge: define the three states from poll outcomes, not from `navigator.onLine`

The order names `live`, `stale`, `offline` but does not define the transitions. `navigator.onLine` is "inherently unreliable" [S16], so it can only nudge.

Recommendation (EMM pack):

| Badge | Condition |
| --- | --- |
| `live` | Last successful poll was within `max(staleAfterSeconds, 2 × pollSeconds)` of now. |
| `stale` | Last successful poll is older than that, but fewer than 4 consecutive polls have failed, or `navigator.onLine` is still `true`. |
| `offline` | 4 or more consecutive polls failed (about 60 s at 15 s), or `navigator.onLine` is `false`. Last payload stays on screen. |

Age is computed from the client's receipt time of the last good payload, not from `generatedAt`, so a wrong clock on the TV cannot flip the badge. Next to the badge, show "Updated 14s ago" style text [S21]; a viewer at 10 ft can then tell "alive" from "frozen" without decoding a dot color, which is also the "don't rely on color alone" rule [S27].

For the core player in `external` mode the badge can only report the player's own reachability: probe `GET /config.js` (same origin, `no-cache`) every 60 s and apply the same three states to that probe.

A `401` from Nexus is not `offline`. Show `stale` with the reason line "Display token rejected" so an installer knows to rotate the token rather than check the network (see 2.6).

### 2.3 Reload policy: add two guards, because a reload while offline blanks the screen

The order says reload every 6 hours and skip if a navigation just started. Soak-test writeups confirm periodic reload is a band-aid that still has value [S17]. But a `location.reload()` while the static host is unreachable, or while the TLS certificate has lapsed, replaces the last good frame with a browser error page, which breaks non-negotiable 6.

Recommendation:

- Before any scheduled reload, probe `GET /config.js` with `cache: "no-store"` and a 5 s timeout. Only reload on a 2xx. Otherwise retry the probe every 10 minutes.
- Only reload when the badge is `live`. A `stale` or `offline` board keeps its last frame.
- Persist the last good board payload in `localStorage` (keyed by display id, with `receivedAt`). On boot, paint it immediately with the `stale` badge, then poll. This covers the case where the static host is up but Nexus is briefly down at reload time.
- Do not add a service worker in v1. The probe-before-reload rule gives most of the benefit without the cache-invalidation risk.
- Leak hygiene is still required: every `setTimeout`, listener and subscription is removed in its effect cleanup. Add a soak check (Part 3) so the 6 h reload is a backstop and not the plan.

### 2.4 Polling mechanics: chained `setTimeout`, timeout per request, back-off on 429 and 5xx

Use a chained `setTimeout` scheduled after each response rather than `setInterval`, so a slow Nexus never stacks requests. Use `AbortSignal.timeout(8000)` [S18]. On `429` honor `Retry-After`; on `5xx` or timeout back off 15 s, 30 s, 60 s, 120 s cap, and reset on success. On `visibilitychange` to visible, poll at once [S14]; intensive throttling only applies to documents hidden for 5 minutes [S15], which a kiosk tab never is, but a wrong-window or screensaver incident should recover instantly.

The 10 requests per minute limit in Phase 12 leaves headroom for a 15 s poll (4/min) plus one health call at boot and one config re-read after a `401`. Rate limit per token and display id on the Nexus side, and return `429` with `Retry-After`, so a second screen with a copied token degrades instead of taking the first one down.

### 2.5 Safe area: keep 48 px as the default, make it configurable, and tell the installer to turn overscan off

EBU R95 puts the graphics-safe area at 5% in from every edge [S5]: 96 px horizontally and 54 px vertically at 1920x1080. The order's 48 px is inside graphics-safe vertically and inside action-safe (3.5%, 67 px) horizontally. Modern flat panels "generally can show most of the picture outside the safe areas" [S6], and overscan is a TV menu setting (usually "Just Scan", "Screen Fit" or "1:1"). CSS `env(safe-area-inset-*)` is zero on a TV [S7], so the app cannot measure it.

Recommendation: `safeAreaPx` in runtime config, default 48; `docs/kiosk.md` instructs the installer to set the TV to Just Scan / 1:1 and to raise `safeAreaPx` to 96 if the TV cannot. Nothing that must be read (clock, badge, wordmarks, panel titles) sits within the outer 5% at the default; panel backgrounds may.

### 2.6 Token handling: `no-cache` on `config.js`, re-read on `401`, never in a `VITE_*` variable

Vite states plainly that `VITE_*` values are bundled at build time and must not hold secrets [S23]. Hosting docs say the same and recommend serve-time injection [S24]. The order already puts the token in runtime `config.js`. Tighten:

- Serve `config.js` with `Cache-Control: no-cache` so every reload revalidates it [S19]. A rotated token is live at the next reload.
- On a `401` from Nexus, re-fetch `config.js` once (`cache: "no-store"`) and retry; if still `401`, show the "Display token rejected" reason and keep polling at the back-off cadence. At most one config re-read per 10 minutes, so a bad token never becomes a request storm.
- Never put the token in the URL query string; it would land in access logs on both hosts. The order's `Authorization: Bearer` header is right.
- Nexus logs `X-Display-Id`, source IP and outcome, never the token [S25]. Nexus binds each token to one `displayId` so a token copied to a second device is visible in logs as a mismatch.
- The token is read-only and reaches only `/api/display/*`. Anyone with physical access to the display host can read it; that is accepted because the blast radius is "read the board." Keep it that way: no write route ever accepts the display token.
- `config.example.js` lives in the repo with placeholder values and is the only config file committed. The real `config.js` is written on the display host at deploy time and listed in `.gitignore`.

**Order note** on Phase 11's `VITE_NEXUS_URL`: the Nexus URL is not a secret, so baking it is safe, but it makes the build EMM-specific. Recommend `functions.emm.nexusUrl` in `config.js` with `VITE_NEXUS_URL` as the build-time default only. Product unchanged; one install artifact serves any host.

### 2.7 Readability floors at 10 feet

Signage guidance converges on roughly 20 pt for a 10 ft viewer on a 43 inch panel [S26] and "one inch of text height per 10 feet" [S27]. On a 55 inch 1080p panel a CSS pixel is about 0.63 mm, so 22 px is about 14 mm of em height, which is readable but close to the floor for the second row of a crowded panel.

Recommendation, all at the 1080p stage (see 2.8 for 4K):

| Element | Order | Recommended |
| --- | --- | --- |
| Project title | ≥ 22 px | 22 px hard floor, 26 px target |
| Secondary text (client, assignee, meta) | not stated | ≥ 18 px |
| Ticker text | not stated | ≥ 22 px |
| Pulse tile value | not stated | ≥ 72 px condensed, tabular figures |
| Pulse tile label | not stated | ≥ 20 px |
| Clock | not stated | ≥ 40 px |
| Goal current value | not stated | ≥ 44 px |

Contrast check of section 9's palette on panel `#10151d` (computed, WCAG formula): text `#e8eef8` about 15:1, muted `#8b93a7` about 6:1, cyan about 10:1, amber about 10:1, hot `#ff4d4d` about 5.6:1, later `#7aa2ff` about 7.4:1, done `#6f7a72` about 4.1:1. All pass 4.5:1 except `done`, which passes the 3:1 large-text threshold and is intentionally dim. No palette change needed; do not use `done` grey for text under 24 px.

"Do not rely on color alone" [S27]: the due rail and project rows carry a short word with the color (`Overdue`, `Today`, `3d`, `Oct 14`, `None`, `Done`). Status is a word, not only a dot. Tone on pulse tiles is color plus the `deltaLabel` text Nexus already sends.

### 2.8 4K: design on a 1080p stage and scale by viewport height

A 4K TV at 100% OS scaling is 3840x2160 CSS px; at 200% it is 1920x1080 CSS px [S8]. The layout must survive both. Recommend one CSS custom property `--u: calc(100vh / 1080)` on `:root`, with every size in the EMM pack written as `calc(N * var(--u))` where N is the 1080p pixel value from section 9. Percent-based grid tracks stay as written. At 200% scaling `--u` is 1 px; at 100% it is 2 px; a 1440p monitor on a developer's desk gets 1.33 px. `docs/kiosk.md` says: set the OS to 100% or 200%, set Chrome zoom to 100%, and let the app scale. The Phase 5 check runs at both viewports.

### 2.9 Kiosk device practice

From [S1][S2][S3][S4][S9][S10], the `docs/kiosk.md` contents:

- Chrome or Chromium flags: `--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run --no-default-browser-check --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000 "https://display.emmadvertising.com/"`.
- Do not use `--incognito` or `--disk-cache-dir=/dev/null` (both suggested in [S2]). The display relies on `localStorage` for the last-good payload and on the HTTP cache for a reload during a Nexus outage.
- Linux: `xset s noblank; xset s off; xset -dpms`; `unclutter -idle 3 -root` [S1] (the order says hide after 3 s). Windows: power plan never sleeps the display, screensaver off. ChromeOS managed kiosk is an option but not required.
- Crash bubble: the Preferences `exited_cleanly` / `exit_type` fix on each boot [S1], in addition to the flag.
- Chrome Memory Saver does not discard the active tab [S9][S10][S22], but add the display URL to "Always keep these sites active" and turn Energy Saver off; Energy Saver halves `requestAnimationFrame` [S10], so the ticker and tick animations must be CSS animations and transitions, not JS frame loops.
- In-app: request a screen wake lock on load and re-acquire on `visibilitychange` [S4]. It needs HTTPS, which the display host has. It is belt-and-braces; the OS setting is the primary guard.
- In-app: `cursor: none` on `html` always. The TV has no mouse; `unclutter` is for the odd time one is plugged in.
- A daily reboot at 04:00 Chicago via cron or Task Scheduler is cheap insurance and also lets Chrome apply updates. The 6 h in-app reload stays.
- Known blank-screen causes outside the app: TLS certificate expiry on the display host, DNS, a TV input auto-switch, a Chrome update prompt. The probe-before-reload rule in 2.3 covers the first two at reload time only; certificate renewal must be automated on the host.

### 2.10 Ticker and motion: one perpetual motion, everything else on change

WCAG 2.2.2 would require a pause control for a scrolling ticker that runs beside other content [S28]. A no-input TV cannot offer one, and a status board is not a user-operated page, so the ticker is a conscious exception; this report records it as such. To keep the exception small: the ticker is the only continuous motion on the board. Tiles, rows, rings and bars animate only on a value change, in 180 to 400 ms as the order says, and never more than once per poll. When ticker items change, swap content at the loop boundary, not mid-scroll. Numbers use `font-variant-numeric: tabular-nums` so a tick from 9 to 10 does not reflow the tile.

`prefers-reduced-motion: reduce` [S29] stops the ticker scroll (show the newest 3 items static, rotate every 10 s with a fade), disables tick animations (values snap), and leaves data updates unchanged, which is what the order says.

### 2.11 Contract tightening (field names unchanged)

Section 7 is the contract; nothing is renamed. These are reading rules for the display and one proposed addition for Logan to confirm.

- `pulse.sourceStatus` (approved by Logan 2026-10-03, see Part 5): `"live" | "unconfigured" | "error"`. Phase 4 and Phase 10 both need the display to know "Mothership not connected" from "Mothership returned zero leads," and the current shape cannot express that. If `sourceStatus` is absent, the display treats an empty `tiles` array as unconfigured and shows "Mothership not connected."
- `staleAfterSeconds`: the display uses `max(staleAfterSeconds, 2 × pollSeconds)`.
- Unknown `status`, `priority` or `tone` values render muted as `unknown`, `normal`, and `flat`. Never crash, never drop the record.
- `assignee: null` renders "Unassigned" with an em-dash chip.
- `delta: null` hides the delta line; `deltaLabel` is shown verbatim when present.
- `endsAt` missing on an event is treated as `startsAt` plus 60 minutes for placement only.
- Arrays absent or `null` are read as `[]` defensively even though the contract says Nexus sends `[]`.
- `display` is the string shown; `value` is used only for change detection and animation.

---

## 3. Engineering notes for Opus

Written for a medium-effort run: each note is a rule, a reason, and a check.

### 3.1 Stack risks

- **Vite env leakage.** Only `VITE_NEXUS_URL` may be a `VITE_*` variable, and only as a default. A grep of `dist/` for the token string must return nothing (Phase 11 check). [S23]
- **`setInterval` stacking.** Never `setInterval` for network work. Chained `setTimeout` after each response. One in-flight request at a time.
- **Effect cleanup.** Every `useEffect` that adds a timer, listener, `ResizeObserver` or `AbortController` returns a cleanup. The soak check below catches misses. [S17]
- **CSS modules, one global sheet for tokens.** `src/styles/tokens.css` holds section 9's colors as custom properties and `--u`. No component library.
- **Fonts.** Self-host Barlow (labels) and Barlow Condensed (numbers) as woff2 under `public/fonts/`, both OFL, one family. `font-display: block` with a 2 s swap window plus `<link rel="preload">` so the first paint does not flash a fallback. No Google Fonts request, no third-party script, no analytics (Phase 12).
- **CORS preflight.** `Authorization` and `X-Display-Id` are non-simple headers, so every poll is preflighted. Nexus must answer `OPTIONS /api/display/*` with `Access-Control-Allow-Origin: https://display.emmadvertising.com`, `Access-Control-Allow-Headers: Authorization, X-Display-Id`, and `Access-Control-Max-Age: 600` so the preflight is cached and the poll stays one request.
- **SPA fallback.** Static host serves `index.html` for unknown paths; `config.js` is excluded from the fallback and from any fingerprinting or bundling.
- **Zero console errors** at 1920x1080 and 3840x2160 with fixture JSON (Phase 5 check). Treat a React key warning as a failure.

### 3.2 Kiosk failures

- Blank on reload while offline: fixed by 2.3. Test by pulling the network, then forcing the reload timer; the frame must remain.
- Blank on Nexus down at boot: fixed by the `localStorage` last-good payload in 2.3. Test by booting with Nexus unreachable and a stored payload; the board paints with `stale`.
- Frozen clock: the clock is a `setTimeout` chain aligned to the next second boundary, not `setInterval(…, 1000)`, so it never drifts and recovers after throttling.
- Energy Saver halving frame rate: ticker is a CSS `transform` animation, so it adapts [S10].
- Screen sleep: OS settings plus wake lock [S4][S1].
- Restore-pages bubble after power loss: flag plus Preferences fix [S1][S2].
- Cursor: `cursor: none` plus `unclutter`.
- Overscan: TV set to Just Scan; `safeAreaPx` fallback (2.5).

### 3.3 Timezone traps

- `new Date("2026-10-07")` parses as UTC midnight. Calling `getDate()` on it in Chicago at 7 pm gives the 6th. Never parse `dueOn` with the `Date` constructor for display.
- "Today" is the Chicago calendar date of now, obtained with `Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year, month, day }).formatToParts(now)` [S30], assembled as `YYYY-MM-DD`. The `en-CA` locale yields ISO order, but build the string from parts, not from `format()`.
- Day difference: convert both `YYYY-MM-DD` strings to `Date.UTC(y, m - 1, d)` and divide by 86,400,000. This is DST-proof because UTC days are always 24 h. Chicago has a 23 h day on 2026-03-08 and a 25 h day on 2026-11-01; a `Date` subtraction in local time gets both wrong.
- Event placement: the Chicago calendar date of `startsAt` via the same `formatToParts` call. A 2026-10-07T04:30:00Z event is Tuesday 11:30 pm Chicago, not Wednesday.
- Week strip: Monday of the Chicago week containing today. Compute the Chicago date, its weekday via `formatToParts` with `weekday`, step back to Monday with UTC arithmetic on the `YYYY-MM-DD` parts.
- Midnight rollover: recompute "today" on every poll and on every clock tick that crosses midnight, and re-derive due colors. A board left on overnight must flip `today` to `overdue` at 00:00 Chicago without a reload. Test with a faked clock.
- Nexus owns "since Chicago midnight" for Leads today. The display never computes a business-day boundary for a Mothership number.
- Tests (Phase 7 and 8) must include: 23:59:59 and 00:00:00 Chicago on both sides of a due date; a due date on 2026-11-01 and 2026-03-08; a UTC timestamp that is the previous Chicago day; and the browser's own timezone set to UTC and to Asia/Tokyo in the test runner, because the TV might not be set to Chicago.

### 3.4 Token handling

Covered in 2.6. Checks: `grep -r "<token>" dist/` empty; `curl` without header is `401`; `curl` with header is `200`; rotate the token in `config.js`, force reload, board polls with the new token and the old one returns `401` in Nexus logs with the display id.

### 3.5 Module notes: make each module solid enough to hook in later

Logan asked that every module be good enough to "just hook in." For each: inputs, derived state, rendering rules, edge cases, and the check that proves it.

**Core player**

- Inputs: URL query (`target`, `fn`, `layout`, `rotate`, `theme`) over `window.BEASTDISPLAY_CONFIG` over built-in defaults. Precedence is URL, then config, then default, and `docs/core.md` states it.
- Target resolution is a pure function `resolveTargets(query, config) → Target[]`, where `Target` is `{ kind: "function", fn, layout } | { kind: "external", url, frame }`. Unit-test it: non-allowlisted URL yields a `refused` target; `fn=emm` with the pack disabled yields `function-not-configured`; a rotate list containing a `frame: false` external drops it with a warning.
- Allowlist matching is by origin (scheme plus host plus port), exact, no wildcards in v1.
- The kiosk frame (clock optional, badge, safe area, both wordmarks) is core. The EMM pack turns the clock on through its layout, not by owning the clock.
- Rotator: one timer, current index, advances on `rotateSeconds`; a function layout renders in place; a `frame: true` external renders an iframe. The rotator pauses while the badge is `offline` so a dead network does not cycle into a blank iframe.
- Checks: boots to `function-not-configured` with no config; `?target=` allowlisted fills the screen; non-allowlisted is refused with the URL shown; network pull keeps the frame.

**Pulse (section 6A, Phase 10)**

- Inputs: `pulse.tiles[]`, `pulse.ticker[]`, and `pulse.sourceStatus` (approved).
- Tiles keyed by `id`. Change detection compares `value`; animation (180 to 400 ms) runs only for ids present in both the previous and current payload with a different `value`. New ids appear without animation. Removed ids leave without animation.
- Tone color comes from `tone` only (`up`, `down`, `flat`, unknown as `flat`). The display never infers tone from the sign of `delta`.
- Grid: 6 columns at 1080p, two rows when more than 6 tiles, capped at 12; fewer than 6 stretch. Value in condensed, tabular figures, 72 px plus.
- Ticker: items ordered by `at` descending, newest first; 40 s loop; content swaps at loop boundary; each item shows Chicago `HH:mm` and `text`. Up to 12 items.
- Empty: `tiles` empty and status unconfigured renders "Mothership not connected" in muted text over the pulse area; `ticker` empty renders nothing (no placeholder text scrolling).
- Check: fixture with 8 tiles and a second fixture with one changed value; only that tile animates.

**Projects (section 6B, Phase 6)**

- Inputs: `projects[]`. Sort key, in order: group (`priority === "rush" || status === "blocked"` first, then everything else, then `status === "done"` last), then `dueOn` ascending with `null` after dated, then `name` ascending. Expose as `sortProjects(projects, today)` and unit-test it.
- Row: name (22 px floor, 26 px target), client (hidden when `lobbySafe` is false on a lobby deployment; shown by default), status word plus color, assignee chip with initials and name, due word plus color from the shared due function, rush edge. Height budget: the middle band is 34% of 1080 px, about 367 px less padding, so about 7 rows at 44 px. 20 fixture projects means 3 pages.
- Paging: inside the panel every 12 s, page indicator dots, no document scroll. Paging pauses on `prefers-reduced-motion`? No: paging is data presentation, not decoration; it continues with a fade.
- Lobby rule: a single `lobbyMode` flag from config decides whether `client` is rendered when `lobbySafe` is `false`. Default off (office). The flag is core config so later packs can use it.
- Edge cases: unknown status, null assignee, null due, duplicate ids (dedupe by id, keep last), very long names (two-line clamp, then ellipsis).
- Check: 20 fixtures, no document scroll at 1080p or 4K, order matches the sort table in `docs/functions/emm.md`.

**Due rail (section 6C, Phase 7)**

- Inputs: the same `projects[]`. Sorted by `dueOn` ascending, `null` last, `done` after `null` with the date struck.
- One pure function `dueState(dueOn, status, today) → { state, color, label }` implementing the section 8 table, where `label` is the word shown (`Overdue`, `Today`, `3d`, `Oct 14`, `None`, `Done`). This same function colors Projects rows and Calendar markers, so there is one source of truth.
- Boundaries: `soon` is 1 to 3 days, `scheduled` 4 to 14, `later` more than 14. Test each boundary day and both sides of Chicago midnight.
- Rush adds a 3 px left edge in `#ff4d4d`; it never changes the date color.
- Rail density: 40% width, about 7 to 8 rows visible; overflow pages inside the panel on the same 12 s cadence as Projects, but offset by 6 s so both panels do not flip at once.
- Check: unit tests for every row of the section 8 table including `done` with a past date (struck, grey, not red).

**Calendar (section 6D, Phase 8)**

- Inputs: `projects[]` (due markers) and `events[]`.
- Seven columns, Monday to Sunday, the Chicago week containing today, today's column highlighted. Default chosen here: the current Mon to Sun week, not a rolling 7 days from today. Open question 5.4 asks Logan to confirm.
- Each day cell: date number, weekday abbreviation, up to 3 event titles with Chicago start time, then a due count badge colored by the worst due state that day (overdue beats today beats soon). More than 3 items shows "+N".
- Event placement by the Chicago date of `startsAt`; an event crossing midnight Chicago appears on both days with a continuation mark. `kind` maps to a small icon or prefix; unknown kinds get none.
- Bottom band is 28% of 1080 px, about 302 px, split with Goals; the calendar gets 60% of the width. Cells are about 150 px wide and 250 px tall after headers, enough for 3 lines at 18 px plus the badge.
- Check: a `dueOn` of a Thursday renders in the Thursday column with the test runner's timezone set to UTC and to Asia/Tokyo; an event at 04:30Z lands on the previous Chicago day.

**Goals (section 6E, Phase 9)**

- Inputs: `goals[]` with `current`, `target`, `unit`, `goodDirection`, `updatedAt`.
- Fill ratio: `clamp(current / target, 0, 1)` for both directions (guard `target <= 0` as 0 fill and show the raw numbers).
- Color: for `up`, good when `current >= target`, accent otherwise. For `down`, good when `current <= target`, hot when `current > target`. This is the "inverse goals flip the color" rule made explicit. Over target in the good direction caps fill at 100% and shows `+N unit` beside the value.
- Animation: on payload change, animate the displayed number from the previous `current` to the new one over 600 ms with tabular figures; the bar or ring animates on the same curve. First paint shows the value directly, no count-up from zero, so a reload never looks like a change.
- A small up or down glyph appears for 10 s after a change, then fades; it is decoration and is frozen under reduced motion.
- Layout: 40% of the bottom band, 2 to 4 goals visible; more than 4 pages every 12 s. Name 20 px, value 44 px condensed, `unit` muted.
- Check: fixture A to fixture B with one goal changed; only that goal animates; a `down` goal above target is hot; a `down` goal under target is good.

---

## 4. The 25-stat menu

Full menu with every field from section 6.1 is in `docs/functions/emm-statistics.md`. Summary table here. Status `current` means already in the order; `proposed` means not built until Logan marks it in. Cost `low` means Nexus already stores it; `high` means a new Mothership pull. `unknown` source means no feed EMM is known to have; the stat is listed because it is agency-real, not because a feed exists.

| # | id | Label | Source | Grain | Lobby | Status | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `leads_today` | Leads today | mothership | today | yes | current | n/a |
| 2 | `pulse_delta` | vs yesterday | mothership | live | yes | current | n/a |
| 3 | `events_ticker` | Recent events | mothership | live | no | current | n/a |
| 4 | `projects_by_status` | Projects by status | nexus | live | yes | current | n/a |
| 5 | `assignee_load` | Open per person | nexus | live | yes | current | n/a |
| 6 | `due_buckets` | Due buckets | nexus | live | yes | current | n/a |
| 7 | `week_calendar_load` | This week | nexus | this week | no | current | n/a |
| 8 | `goal_progress` | Goals | nexus | live | yes | current | n/a |
| 9 | `calls_today` | Calls today | mothership | today | yes | proposed | high |
| 10 | `forms_today` | Form submits today | mothership | today | yes | proposed | high |
| 11 | `ad_spend_mtd` | Ad spend MTD | mothership (unknown) | this month | no | proposed | high |
| 12 | `cost_per_lead_mtd` | Cost per lead | mothership (unknown) | this month | no | proposed | high |
| 13 | `campaigns_live` | Campaigns live | nexus (unknown) | live | yes | proposed | low if Nexus stores |
| 14 | `sites_up` | Sites up | unknown | live | yes | proposed | high |
| 15 | `seo_rank_movers_week` | Rank movers | unknown | this week | yes | proposed | high |
| 16 | `organic_sessions_week` | Organic sessions | mothership (unknown) | this week | yes | proposed | high |
| 17 | `ott_impressions_week` | OTT impressions | mothership (unknown) | this week | yes | proposed | high |
| 18 | `social_scheduled_7d` | Social queued | nexus (unknown) | this week | yes | proposed | low if Nexus stores |
| 19 | `pipeline_open` | Pipeline open | nexus (unknown) | live | no | proposed | low if Nexus stores |
| 20 | `won_this_month` | Won this month | nexus (unknown) | this month | yes | proposed | low if Nexus stores |
| 21 | `oldest_blocked_days` | Oldest blocked | nexus | live | yes | proposed | low |
| 22 | `overdue_count` | Overdue | nexus | live | yes | proposed | low |
| 23 | `completed_this_week` | Shipped this week | nexus | this week | yes | proposed | low |
| 24 | `waiting_on_client` | Waiting on client | nexus | live | no | proposed | low |
| 25 | `invoices_outstanding` | Invoices open | nexus (unknown) | live | no | proposed | low if Nexus stores |

Counts: 8 current, 17 proposed, 25 total. Nothing in rows 9 to 25 is built until Logan marks it in.

---

## 5. Open questions still worth asking Logan

Section 12's five items stand with their defaults (REST JSON; Mothership unknown so the adapter stays empty; office screen with client names; EMM host only on the allowlist; Nexus staff edit goals). These are additional. No answer is guessed; where the report needed a default to keep moving, it is named and can be flipped.

1. **`pulse.sourceStatus`.** Answered by Logan on 2026-10-03: yes. Nexus adds `pulse.sourceStatus: "live" | "unconfigured" | "error"` to the board payload, and Nexus may add any other routes or fields the display needs (map names in the display route; do not rename live Nexus records). The display still treats missing `sourceStatus` with empty `tiles` as "Mothership not connected" for backward compatibility.
2. **Done projects in the payload.** How long does Nexus keep `status: "done"` projects in `/api/display/board`? Forever crowds the Projects panel; the display will not filter them itself. Default: render whatever Nexus sends, done sorted last.
3. **Nexus repo access.** Phase 4 says "only if Nexus does not already expose this." Opus needs the Nexus repository attached to check, or a statement that the routes do not exist. Default: Opus writes the display side against the fixture and lists Phase 4 as blocked until the repo is attached.
4. **Week strip definition.** Monday to Sunday containing today (chosen default), or a rolling 7 days starting today?
5. **Calendar events.** Does Nexus have all-day events, and what are the `kind` values? The contract has no all-day flag. Default: every event has a time; unknown `kind` gets no icon.
6. **Delta semantics.** Is `delta` on Leads today versus the whole of yesterday, or versus the same time yesterday? This affects the `deltaLabel` wording Nexus sends, not display code, but it decides whether the morning board reads as a collapse.
7. **The display device.** Pi, Windows mini PC, or ChromeOS? `docs/kiosk.md` will cover Linux and Windows unless told one.
8. **TV size and overscan.** Model and size, and whether its menu offers Just Scan / 1:1. Decides `safeAreaPx`.
9. **Static host.** What serves `display.emmadvertising.com` (nginx, Cloudflare Pages, Netlify, other)? Decides how `config.js` is placed and how `Cache-Control: no-cache` is set on it.
10. **Second screen.** Will a second display (lobby or a second room) ever share the token? Default: one token per display id, rate limit per token.

---

## 6. Handoff block for Opus

Read this with the build order. The order wins on product rules; this report wins on engineering tightening; note any conflict in the PR. Effort is medium, so every step below is concrete. Do not reopen scope. Do not build rows 9 to 25 of the stat menu.

### 6.0 Before Phase 1

- Confirm `docs/fable-report.md` and `docs/functions/emm-statistics.md` are in the repo at those paths (copy them in from this thread's attachments).
- Ask Logan to attach the `nexus` repository if Phase 4 is to be done in this run. If it is not attached, write the display against fixtures and leave Phase 4 as a listed blocker in the PR description.

### 6.1 Repo layout to create

```
beastdisplay/
  README.md                         BeastDisplay, one paragraph, link to docs
  package.json                      vite, react, react-dom, typescript, vitest, @testing-library/react
  vite.config.ts  tsconfig.json  index.html
  .gitignore                        includes public/config.js
  public/
    config.example.js               window.BEASTDISPLAY_CONFIG = { ... } with placeholders
    fonts/                          Barlow and Barlow Condensed woff2, OFL license file
  src/
    main.tsx
    app/App.tsx                     resolves targets, mounts KioskFrame and the active target
    core/
      config.ts                     reads window config and URL query, applies precedence, validates
      targets.ts                    resolveTargets(query, config) pure function
      allowlist.ts                  origin match
      frame/KioskFrame.tsx          safe area, clock (optional), ConnectionBadge, wordmarks
      frame/Clock.tsx               Chicago or configured tz, second-aligned setTimeout chain
      frame/ConnectionBadge.tsx     live, stale, offline plus age text and reason line
      player/ExternalTarget.tsx     top-level navigation or framed iframe with watchdog
      player/Rotator.tsx            cycles function layouts and frame:true externals
      player/BlockedState.tsx       "open blocked" with URL text
      reload.ts                     6 h reload with probe and live-only guards
      wakeLock.ts                   request on load, re-acquire on visibilitychange
      probe.ts                      same-origin GET /config.js reachability
      registry.ts                   function registry { id, title, enabled }
    functions/
      index.ts                      registry list: [emm]
      emm/
        index.tsx                   pack entry, picks layout from query
        types.ts                    section 7 contract as TypeScript types
        api.ts                      poll loop, timeout, back-off, 401 handling, localStorage last-good
        time.ts                     chicagoDate(now), dayDiff(a, b), weekMonday(today)
        due.ts                      dueState(dueOn, status, today)
        sort.ts                     sortProjects(projects)
        layouts/Warroom.tsx  Projects.tsx  Pulse.tsx  Goals.tsx
        panels/Pulse.tsx  Ticker.tsx  Projects.tsx  DueRail.tsx  Calendar.tsx  Goals.tsx
        fixtures/board.fixture.json       labeled FIXTURE in a top-level "_fixture" key
        fixtures/board.changed.fixture.json
        styles/*.module.css
    styles/tokens.css               section 9 colors, --u, fonts
  tests/
    targets.test.ts  config.test.ts  due.test.ts  time.test.ts  sort.test.ts  goals.test.ts  calendar.test.ts
  docs/
    fable-report.md  core.md  kiosk.md
    functions/emm.md  functions/emm-statistics.md
```

### 6.2 Runtime config shape (write into `docs/core.md` and `config.example.js`)

```
window.BEASTDISPLAY_CONFIG = {
  displayId: "office-main",
  theme: "night",
  clock: { show: false, timeZone: "America/Chicago" },
  safeAreaPx: 48,
  reloadHours: 6,
  lobbyMode: false,
  defaultTarget: { kind: "function", fn: "emm", layout: "warroom" },
  allowlist: [ { origin: "https://display.emmadvertising.com", frame: false } ],
  rotateSeconds: 0,
  functions: {
    emm: { enabled: true, nexusUrl: "https://nexus.emmadvertising.com", token: "REPLACE_ON_HOST", pollSeconds: 15, timeoutMs: 8000 }
  }
};
```

Precedence: URL query over config over defaults. `token` is never committed; `config.example.js` carries the placeholder.

### 6.3 Phases, with the report's additions

Phase 1. Name and contract. Create `docs/core.md` (URL model, precedence, allowlist with `frame`, rotate rules from 2.1, offline and reload behavior from 2.2 and 2.3, badge table), `docs/functions/emm.md` (sections 6 to 8 copied, plus the module rules in 3.5 and the contract reading rules in 2.11), `src/core/registry.ts`. Check: a reviewer can tell core from pack in the tree.

Phase 2. Core URL display. Shell, no document scroll, `--u` scaling, `tokens.css`, `config.ts`, `targets.ts`, `allowlist.ts`, `KioskFrame`, `ExternalTarget` with the `frame` flag and watchdog, `BlockedState`, `Rotator`, `reload.ts` with both guards, `wakeLock.ts`, `probe.ts`, `cursor: none`. Tests: `targets.test.ts`, `config.test.ts`. Check: allowlisted `?target=` fills the screen; non-allowlisted shows refused with URL; network pull keeps the frame; forced reload while offline is skipped.

Phase 3. Function slot. `?fn=emm` mounts the pack; disabled pack shows "function not configured"; unknown `fn` same. Check: boots with `functions.emm.enabled = false`.

Phase 4. Nexus read API. Only if the `nexus` repo is attached and lacks the routes. `GET /api/display/board`, `GET /api/display/health`, bearer token, `401` on missing or wrong, CORS as 3.1, rate limit per token and display id with `429` and `Retry-After`, log display id and IP never token, seed tagged `seed`, `fetchPulse()` adapter returning empty tiles and `sourceStatus: "unconfigured"` when credentials are missing. Check: curl with token 200, without 401, preflight returns the allow headers.

Phase 5. EMM shell. `api.ts` poll loop per 2.4 with `AbortSignal.timeout`, back-off, `401` config re-read, `localStorage` last-good; badge states per 2.2 with age text; layout from query; layout rotation only when `rotate` is set and no external targets; empty copy. Check: 1920x1080 and 3840x2160 with fixture JSON, zero console errors, badge flips live to stale to offline when Nexus is blocked, and back.

Phase 6. Projects. `sort.ts` and panel per 3.5; paging every 12 s; `lobbyMode` client hiding. Tests: `sort.test.ts`. Check: 20 fixtures, no document scroll, 3 pages.

Phase 7. Due colors. `due.ts` as the single source for rail, rows, and calendar badges; word labels. Tests: `due.test.ts` covering every section 8 row, boundaries 3/4 and 14/15 days, Chicago midnight both sides, `done` with a past date, test runner in UTC and Asia/Tokyo.

Phase 8. Calendar. `time.ts` with `chicagoDate`, `dayDiff`, `weekMonday`; Monday-start current week; today pinned; due markers via `due.ts`; events by Chicago date; midnight-crossing events on both days. Tests: `time.test.ts`, `calendar.test.ts` (Thursday stays Thursday; 04:30Z is the previous Chicago day; DST days 2026-03-08 and 2026-11-01).

Phase 9. Goals. Fill, color, 600 ms tick, no count-up on first paint, over-target label, inverse flip. Tests: `goals.test.ts`. Check: fixture A to B animates one goal only.

Phase 10. Pulse. Current 8 only. Tiles keyed by id, animate on changed `value` only, tone from `tone` only, ticker as CSS transform 40 s loop swapping at boundary, "Mothership not connected" on unconfigured or empty tiles, reduced-motion behavior from 2.10. Check: changed fixture animates one tile; empty tiles show the not-connected copy, never zeros.

Phase 11. EMM deploy. Static host, TLS, SPA fallback excluding `config.js`, `Cache-Control: no-cache` on `config.js`, `VITE_NEXUS_URL` as default with `config.js` override, token on host only, production config pins `fn=emm` and `layout=warroom` and `clock.show = true`. `docs/kiosk.md` from 2.9. Check: production URL shows the board; `grep` of `dist/` for the token is empty; airplane pull shows offline with last data; forced reload while offline is skipped.

Phase 12. Hardening. Token rotation walkthrough (edit `config.js`, reload, old token 401 in logs), rate limit verified with a loop of 20 requests, logs show display id only, no third-party requests in the network panel. Add the soak check: a script or Vitest run that applies 200 fixture payload swaps and asserts document node count and listener count (via `getEventListeners` in a Puppeteer or Playwright run, or a counted wrapper in test) stay within 5% of the starting value.

### 6.4 Definition of done per module (copy into the PR checklist)

- Core: boots with no config; refuses non-allowlisted; never blank on network pull; reload guarded; wake lock requested; zero console errors at both resolutions.
- Pulse: 8 current tiles from fixture; one-tile animation; honest empty state; ticker is CSS motion.
- Projects: sort table matches docs; 20 fixtures page inside the panel; lobby flag hides clients.
- Due rail: all section 8 rows tested including midnight and DST; words beside colors; rush edge only.
- Calendar: Monday start; Thursday stays Thursday in any runner timezone; midnight-crossing event on both days.
- Goals: 600 ms tick on change only; inverse goal colors flip; no count-up on first paint.
- Deploy: token absent from `dist/`; `config.js` is `no-cache`; kiosk doc covers flags, sleep, cursor, overscan, reboot.

### 6.5 What not to build

- Any stat from rows 9 to 25 of the menu, in code or as a hidden tile.
- A settings UI, auth screen, login, or any write route.
- A second function pack; the registry has a slot and nothing else.
- Websockets, server-sent events, or a service worker.
- Auto-detection of frameability; it is an operator flag.
- Rotation across `frame: false` externals.
- Any Mothership call from the display, or any Mothership credential anywhere in `beastdisplay`.
- Fake business data in production paths. Fixtures carry a `_fixture` key and live under `fixtures/`.
- Third-party fonts at runtime, analytics, or error reporting SDKs.
- Renaming any section 7 field. Map in the Nexus display route if Nexus differs.

### 6.6 Conflicts to note in the PR

- Phase 2 frameability detection replaced by the operator `frame` flag (report 2.1, sources S11 to S13).
- Phase 11 `VITE_NEXUS_URL` kept as default, overridable by `config.js` (report 2.6).
- Reload policy gains two guards beyond "skip if a navigation just started" (report 2.3).
- `pulse.sourceStatus` approved by Logan on 2026-10-03 (open question 5.1); Nexus adds it. Empty tiles with no `sourceStatus` still mean not connected.

End of report. Hand this file and the build order to Opus. Fable stops here.
