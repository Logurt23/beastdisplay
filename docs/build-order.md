# BeastDisplay Build Order
For Claude.

Product: BeastDisplay.
First deployment: EMM Advertising, Joplin.
Screen URL for that deployment: `https://display.emmadvertising.com`.
Data for that deployment: `https://nexus.emmadvertising.com`.
Date: 2026-10-03.

BeastDisplay is a URL display. EMM is a use of it, not the product. Do not name the app EMM Display. Do not hard-wire agency copy into the core.

Do not invent product scope. If a field, endpoint, or source is not listed here, stop and ask. Do not stub fake business data into production paths. Fixtures are local only, and labeled as fixtures.

---

## 0. Who does what

Fable first. Opus second. Opus does not open a repo until the Fable report is written.

Fable goes over this order before any engineering. Fable uses general experience and live fetches on the matter, then writes a report, then hands off to Opus.

Fable does not write app code. Fable does not call Nexus, does not seed data, and does not deploy.

Fetches Fable must make, then cite in the report:

- Wall and kiosk display practice: full viewport, overscan, Chrome kiosk, sleep, cursor, 1080p and 4K.
- External URL display: iframe blocking, clickjacking headers, when a top-level navigation is the right player.
- Always-on screens: poll interval, stale data, reload leaks, offline last-frame.
- Read-only display tokens: where the secret lives, how it rotates without a rebuild.
- Office status boards: what stays readable at 10 feet, what motion helps, what motion hides numbers.

Fable may fetch vendor docs and current writeups. Fable does not treat a blog as a requirement. If a fetch contradicts this order, the report says so and recommends. It does not silently rewrite the product.

Report path: `docs/fable-report.md`.

The report includes:

1. What this order gets right.
2. What to change, and why, tied to a fetch or to a named practice. No change to the product name, the core-versus-function split, or the rule that Display never talks to Mothership.
3. Engineering notes Opus should follow: stack risks, kiosk failures, timezone traps, token handling.
4. The 25-stat menu from section 6.1. 8 current, 17 proposed. Proposed stats stay proposed.
5. Open questions still worth asking Logan. Do not guess past section 12.
6. A handoff block Opus can execute: phase list, files to create, checks, and what not to build.

Then stop. Hand the report and this order to Opus.

Opus engineers from the report plus this order. Opus does not reopen product scope. If the report and this order conflict, Opus follows this order on product rules and the report on engineering tightening, and notes the conflict in the PR. Opus does not build a proposed stat until Logan marks it in.

---

## 1. What this is

BeastDisplay is a small always-on web app. A screen opens a URL. The page fills that screen and stays there.

Core job: show a URL as a display.

- Full viewport. No chrome a viewer needs to use.
- Works with zero input after load.
- Can show one URL, or rotate a list of URLs.
- Survives a bad network without going blank.
- Stays readable at 10 feet on a 1080p TV. 4K must not break it.

Functions are optional add-ons. A deployment turns on only the ones it needs. The EMM office is the first deployment. Its function pack talks to Nexus.

```
Screen browser
  --> BeastDisplay URL (display.emmadvertising.com)
        --> core: URL player
        --> function pack: EMM board
              --> Nexus (source of truth)
                    --> Mothership (pulse only, via Nexus)
```

Display never talks to Mothership, ad platforms, or a database. Nexus owns EMM records. BeastDisplay core owns the player, not the agency data.

---

## 2. Two layers

### Core (always)
The player.

- Boots to a configured display URL, or to an internal stage if the target is a BeastDisplay function.
- Kiosk frame: clock optional, connection badge, reload policy, safe area.
- Target modes:
  - `external`: load another URL full screen (iframe or top-level redirect, see Phase 2).
  - `function`: render a built-in function pack.
  - `rotate`: cycle targets on a timer.
- Config comes from the URL and a runtime config file. Not from a settings UI in v1.

### Functions (add if wanted)
Each function is a module with a name, a route, and a data source. v1 ships one function pack.

EMM pack, id `emm`:

- Pulse. Fast numbers, color, ticker. Busy on purpose. Source: Mothership through Nexus.
- Projects. Status, assignee, client.
- Due dates. Color coded.
- Calendar.
- Goals. Custom counters that tick up and down when Nexus changes them.

Later functions are not in this build. Leave a registry slot. Do not build them.

Statistic menu is a review deliverable, not a build. See section 6.1. Claude writes the 25 options. Logan picks. Unpicked stats are not implemented.

Out of v1: editing, chat, invoices, staff login on the TV, mobile nav, websockets, lobby mode, a second function pack.

---

## 3. Non-negotiables

1. Product name in code, title, and docs is BeastDisplay.
2. EMM screen is `https://display.emmadvertising.com`.
3. EMM data is `https://nexus.emmadvertising.com` only.
4. The TV has no keyboard. Zero interaction after load.
5. One read token on the display device for the EMM pack. No staff login on the screen.
6. Failed fetch must not blank the screen. Keep last good payload and show a stale badge.
7. No client names on a lobby-facing screen unless Nexus says `lobbySafe: true`. Default deployment is internal office, client names allowed.
8. No write UI on the display. Goals, assignments, and due dates are edited in Nexus.
9. Motion is decorative. Numbers stay readable.
10. 1920x1080 first. 3840x2160 must not break layout.
11. Core must still boot if the EMM pack is turned off.

---

## 4. Stack

Display app:

- Vite + React + TypeScript.
- One repo: `beastdisplay`.
- CSS modules or a single global sheet. No admin component library.
- Poll for function data. No websocket in v1.
- Static host behind the existing `*.emmadvertising.com` setup.

Nexus, EMM pack only. Do not rewrite Nexus.

- Read routes under `/api/display/*`.
- `Authorization: Bearer <DISPLAY_TOKEN>`.
- JSON. Timestamps ISO-8601 UTC. Display converts to `America/Chicago`.
- CORS allow `https://display.emmadvertising.com` only.

Mothership stays behind Nexus. Display never holds those credentials.

---

## 5. URL model

One app. The URL picks the target.

- `/` reads runtime config and boots the default target.
- `?target=https://example.com` external URL display. Allowlist required. Do not iframe arbitrary origins in production.
- `?fn=emm` EMM function pack.
- `?layout=warroom` default EMM cut. Also `projects`, `pulse`, `goals`.
- `?rotate=45` seconds between configured targets. Omit to pin one target.
- `?theme=night` default. `theme=day` optional.

EMM production config pins `fn=emm` and `layout=warroom`. A plain BeastDisplay install with no function still opens and can show an allowlisted URL.

No root scroll. Panels may tick, marquee, or page inside themselves.
Safe area: 48px. TV overscan crops edges.

---

## 6. EMM function modules

### A. Pulse
6 to 12 tiles. Label, value, delta, tone. Bottom ticker of recent events. Animate on value change only. Source key `mothership`.

### B. Projects
Name, client, status (`queued | active | waiting | review | blocked | done`), assignee name and initials, due date, priority (`low | normal | high | rush`).

### C. Due rail
Same records, sorted by due date, colored by section 8.

### D. Calendar
Week strip, America/Chicago, Monday start. Project due markers. Nexus events if present. Today pinned.

### E. Goals
Name, current, target, unit, `goodDirection` (`up` or `down`). Bar or ring. Animate from previous payload so the number ticks up or down.

---

## 6.1 Statistic menu (review only, do not build yet)

Before wiring extra pulse tiles, Claude writes `docs/functions/emm-statistics.md`.

25 options total. Not 25 new ones. The current set counts toward the 25. Claude fills the rest.

Logan reviews that list with Claude. Nothing in the proposed group is built until Logan marks it in. Building the menu, or sneaking a proposed stat into the board, is a miss.

Each option uses this shape:

- id
- label (short enough for a tile)
- what it counts
- source: `nexus` or `mothership` (via Nexus only)
- grain: live, today, this week, this month
- tone rule: what makes it up, down, or flat
- lobby safe: yes or no
- status: `current` or `proposed`

Current, already in this order. These 8 count toward the 25:

1. Leads today. Mothership. Count of new leads since Chicago midnight.
2. Pulse delta. Mothership. Change versus yesterday on each live tile.
3. Recent events ticker. Mothership. Form submit, call, or other event text.
4. Projects by status. Nexus. Counts for queued, active, waiting, review, blocked, done.
5. Assignee load. Nexus. Open projects per person.
6. Due buckets. Nexus. Overdue, today, soon, scheduled, later, none.
7. Week calendar load. Nexus. Due dates and events on the visible week.
8. Goal progress. Nexus. Current, target, and tick direction per custom goal.

Claude proposes 17 more. Agency-real only: ads, sites, SEO, OTT, social, pipeline, production, billing status if Nexus has it. No vanity metrics that need a source EMM does not have. If a source is unknown, say unknown. Do not invent a feed.

After the list, add a one-line note under each proposed stat: build cost `low` if Nexus already stores it, `high` if it needs a new Mothership pull. Then stop. Wait for the review.

---

## 7. Data contract (EMM pack)

One call per poll.

`GET /api/display/board`

Headers: `Authorization: Bearer <token>`, `X-Display-Id: office-main`.

```json
{
  "generatedAt": "2026-10-03T06:04:00Z",
  "timezone": "America/Chicago",
  "staleAfterSeconds": 60,
  "pulse": {
    "tiles": [
      {
        "id": "leads_today",
        "label": "Leads today",
        "value": 14,
        "display": "14",
        "delta": 3,
        "deltaLabel": "+3 vs yesterday",
        "tone": "up",
        "source": "mothership"
      }
    ],
    "ticker": [
      {
        "id": "evt_1",
        "at": "2026-10-03T05:40:00Z",
        "text": "Form submit · Roofing · Joplin",
        "tone": "info"
      }
    ]
  },
  "projects": [
    {
      "id": "prj_1",
      "name": "Fireplace Shoppe site",
      "client": "The Fireplace Shoppe",
      "status": "active",
      "priority": "high",
      "assignee": { "id": "usr_1", "name": "Logan Brewer", "initials": "LB" },
      "dueOn": "2026-10-07",
      "lobbySafe": false
    }
  ],
  "events": [
    {
      "id": "evt_cal_1",
      "title": "Client shoot",
      "startsAt": "2026-10-06T15:00:00Z",
      "endsAt": "2026-10-06T17:00:00Z",
      "kind": "shoot"
    }
  ],
  "goals": [
    {
      "id": "goal_1",
      "name": "Sites launched this month",
      "current": 3,
      "target": 6,
      "unit": "sites",
      "goodDirection": "up",
      "updatedAt": "2026-10-03T05:00:00Z"
    }
  ]
}
```

Rules:

- Missing arrays return `[]`, not null.
- Unknown status renders as `unknown` in muted color. Do not crash.
- `dueOn` is a date. Null means none.
- Numbers arrive as numbers. `display` is the string Nexus wants shown.

Health: `GET /api/display/health` returns `{ "ok": true, "time": "<iso>" }` with the same token.

---

## 8. Due date colors

Compare `dueOn` to today in America/Chicago.

| State | Rule | Color |
| --- | --- | --- |
| overdue | before today | `#ff4d4d` |
| today | equal to today | `#ffb020` |
| soon | 1 to 3 days out | `#f2e35b` |
| scheduled | 4 to 14 days out | `#3dd6c6` |
| later | more than 14 days | `#7aa2ff` |
| none | null | `#8b93a7` |
| done | status done | `#6f7a72` strike the date |

Rush adds a red edge. It does not replace the date color.

---

## 9. Visual system

Two skins. Core is neutral. EMM pack is the night war room.

Core player:

- Background `#07090d`.
- Wordmark: BeastDisplay, small, bottom left.
- Connection badge. Clock optional, off unless config says on.

EMM pack:

- Panel `#10151d` at 92% opacity, 1px border `#1e2836`.
- Text `#e8eef8`. Muted `#8b93a7`.
- Accent cyan `#3dd6c6`, amber `#ffb020`, hot `#ff4d4d`, good `#3dff9a`.
- Numbers: condensed grotesk, self-hosted (Barlow Condensed or equivalent). Labels: one readable sans. No Google Fonts runtime call.
- Project titles at least 22px at 1080p.
- Grid at 1080p: pulse top 38%. Projects left 60%. Due rail right 40%. Calendar and goals split the bottom 28%.
- Motion 180 to 400ms on value change. Ticker 40s loop. No full-screen flashes. `prefers-reduced-motion` freezes decoration, not data updates.
- Clock top right, Chicago time, seconds on, so the screen looks alive.
- EMM wordmark small, opposite the BeastDisplay mark. Do not restyle this as the marketing site.

---

## 10. Build order

Fable completes the report before any phase below. Opus runs the phases. Opus does not skip the report.

### Phase 0. Fable report
Fable writes `docs/fable-report.md` as specified in section 0, including the statistic menu from section 6.1.

Check: report exists, fetches are cited, 25 stats are listed, no app code was written. Handoff to Opus happens after that file is in the repo or pasted into the Opus thread.

### Phase 1. Name and contract
Repo `beastdisplay`. Title BeastDisplay.

- Write `docs/core.md`: URL player, allowlist, rotate, offline behavior.
- Write `docs/functions/emm.md`: copy sections 6 through 8.
- Function registry: `{ id, title, enabled }`. v1 list is `emm` only.
- Note Nexus stack and where the display token will live.

Check: a reviewer can tell core from the EMM pack in the file tree.

### Phase 2. Core URL display
- Vite React TS shell. Full viewport. No document scroll.
- Runtime `config.js` (not baked secrets): default target, allowlist, rotate seconds, theme, display id.
- External target: allowlisted origins only. Prefer a top-level navigation to that URL. Use iframe only if the target sends frame headers BeastDisplay can use. If framing fails, show the target URL and an "open blocked" state, not a blank screen.
- Rotate mode cycles allowlisted URLs.
- Offline: last frame stays. Badge says offline.
- Reload the app every 6 hours. Skip reload if a navigation just started.

Check: `?target=` on an allowlisted URL fills the screen. A non-allowlisted URL is refused. Pulling the network does not blank the page.

### Phase 3. Function slot
- `?fn=emm` loads the EMM pack instead of an external URL.
- Pack off: core still boots to the URL player.
- Empty pack state is a quiet "function not configured", not a crash.

Check: app boots with `functions.emm.enabled = false`.

### Phase 4. Nexus read API
Only if Nexus does not already expose this.

- `GET /api/display/board` and `/api/display/health`.
- Token auth. Missing or wrong token is 401.
- Local seed tagged `seed`.
- Mothership adapter: `fetchPulse()`. If credentials are missing, empty pulse and `sourceStatus: "unconfigured"`. Do not fake live numbers.

Check: curl with token returns the bundle. Curl without token returns 401.

### Phase 5. EMM shell inside the pack
- Poll every 15s. Timeout 8s. Keep last payload.
- Badge: `live`, `stale`, `offline`.
- Layout from query. Rotate layouts only if `rotate` is set and no external targets are in the list.
- Empty copy: "No projects", "Pulse not configured".

Check: 1920x1080 and 3840x2160 with fixture JSON. No console errors.

### Phase 6. Projects and assignees
Sort: rush and blocked first, then due date, then name. 20 fixture projects do not scroll the page. Overflow pages inside the panel every 12s.

### Phase 7. Due colors
One function. Tests for each state in section 8, including Chicago midnight.

### Phase 8. Calendar
Seven-day strip. A Thursday due date lands on Thursday, not UTC Wednesday.

### Phase 9. Goals
Animate current value over 600ms on payload change. Over target is good if direction matches. Inverse goals flip the color.

### Phase 10. Pulse
Tiles and ticker for the current 8 only, until Logan marks proposed stats in. Tone color comes from `tone` only. Unconfigured Mothership shows "Mothership not connected", not zeros.

### Phase 11. EMM deploy
- `display.emmadvertising.com` TLS, static host, SPA fallback to `index.html`.
- `VITE_NEXUS_URL=https://nexus.emmadvertising.com`.
- Token in runtime `config.js` on the display host, not in the repo.
- `docs/kiosk.md`: Chrome `--kiosk`, no sleep, 100% zoom, hide cursor after 3s.
- Production config pins `fn=emm`.

Check: production URL shows the EMM board. Token is absent from the built JS. Airplane-pull shows offline and last data.

### Phase 12. Hardening
- Rotate token without a rebuild.
- Rate limit display token to 10 requests per minute.
- Log display id, not token.
- No third-party analytics on the page.

---

## 11. Claude rules

- Fable reviews first. Opus engineers second. No repo work before `docs/fable-report.md`.
- Product name is BeastDisplay. EMM is the first function pack and the first host.
- The 25-stat menu is part of the Fable report. 8 current plus 17 proposed. Opus does not build a proposed stat until Logan marks it in.
- Build core before the pack. A URL display that cannot boot without Nexus is wrong.
- Do not add auth screens, settings pages, or extra function packs.
- Do not call Mothership from BeastDisplay.
- Do not invent clients, staff, or metrics in production code.
- Match section 7 field names. If Nexus already uses other names, map them in the Nexus display route. Do not rename live Nexus records.
- Timezone bugs are release blockers.
- Prefer a boring poll over a live socket.

---

## 12. Open items (do not guess)

Ask once. Default in parentheses.

1. Nexus API style, if it already exists? (REST JSON.)
2. What is Mothership? (Unknown. Adapter stays empty.)
3. Is the EMM screen public-facing? (Office. Client names allowed.)
4. External URL allowlist for core, besides the EMM host? (EMM host only until a list is given.)
5. Who edits goals? (Nexus staff only.)

---

## 13. Done when

Fable: `docs/fable-report.md` is written, fetches are cited, the plan is tightened, the 25-stat menu is included, and the handoff block is addressed to Opus.

Core: a screen opens a BeastDisplay URL and shows an allowlisted page with no input, and does not go blank when the network drops.

EMM function: `https://display.emmadvertising.com` shows Chicago time, assignments, color-coded due dates, a week calendar, goals that move when Nexus changes them, and a Mothership pulse that is either live or honestly empty.

Statistic menu: `docs/functions/emm-statistics.md` has 25 options, the 8 current ones included, and no proposed stat is on the screen until Logan marks it in.
