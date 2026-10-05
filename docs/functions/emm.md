# EMM function pack (`emm`)

The first BeastDisplay function pack, for EMM Advertising, Joplin. It renders the war room board from one Nexus call per poll. Code: `src/functions/emm/`. The pack can be turned off (`functions.emm.enabled = false`) and core still boots.

Sections 6, 6.1, 7 and 8 of the build order are copied verbatim below. After them: how the build reads the contract, the approved `pulse.sourceStatus` addition, and the module rules each panel follows.

---

### Build order § 6. EMM function modules

#### Build order § A. Pulse
6 to 12 tiles. Label, value, delta, tone. Bottom ticker of recent events. Animate on value change only. Source key `mothership`.

#### Build order § B. Projects
Name, client, status (`queued | active | waiting | review | blocked | done`), assignee name and initials, due date, priority (`low | normal | high | rush`).

#### Build order § C. Due rail
Same records, sorted by due date, colored by section 8.

#### Build order § D. Calendar
Week strip, America/Chicago, Monday start. Project due markers. Nexus events if present. Today pinned.

#### Build order § E. Goals
Name, current, target, unit, `goodDirection` (`up` or `down`). Bar or ring. Animate from previous payload so the number ticks up or down.

---

### Build order § 6.1 Statistic menu (review only, do not build yet)

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

### Build order § 7. Data contract (EMM pack)

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

### Build order § 8. Due date colors

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

## Approved contract addition

`pulse.sourceStatus: "live" | "unconfigured" | "error"`, approved by Logan on 2026-10-03. It lets the board tell "Mothership not connected" from "zero leads". If Nexus omits it, the display reads empty `tiles` as `unconfigured`. No field from section 7 is renamed.

Whiteboard fields on each project, added 2026-10-05 so the war room mirrors the office whiteboard (Logan said Nexus may add the fields it needs). Both are optional; nothing existing is renamed.

- `stage: "development" | "edits" | "launch" | "pending"` is the whiteboard section: New Development, Edits, Push Live, Pending. If Nexus omits it or sends something else, the display derives it from `status`: `waiting` is pending, `review` is edits, everything else is development. Push Live has no status equivalent, so it stays empty until Nexus sends `stage`.
- `rank: number | null` is the person's queue number on the whiteboard (1 is next). Only positive integers are kept. Unranked work sorts after ranked work, then by the Projects sort.

## Contract reading rules (`normalize.ts`)

- Absent or `null` arrays read as `[]`. A record with no `id` is dropped (it cannot be keyed); duplicate ids keep the last one.
- Unknown `status` renders as `unknown` in muted color (the raw word is kept on `rawStatus`). Unknown `priority` reads as `normal`. Unknown `tone` renders muted.
- `assignee: null` renders "Unassigned" with an em-dash chip. Initials are derived from the name if Nexus leaves them out.
- `dueOn` must be a real `YYYY-MM-DD`; anything else reads as no date.
- `delta: null` hides the delta line; `deltaLabel` is shown verbatim.
- Missing `endsAt` places an event as `startsAt + 60 min`.
- `display` is what is shown; `value` is only for change detection.
- A top-level `_fixture`, `_seed` or `seed: true` puts "Fixture data, not live" on screen.

## Polling (`api.ts`)

`GET {nexusUrl}/api/display/board` with `Authorization: Bearer <token>` and `X-Display-Id`. Every 15 s, 8 s timeout, chained timeouts with one request in flight. Back-off 15/30/60/120 s on timeout, network error, 5xx or unreadable JSON. 429 waits for `Retry-After`. 401/403 re-reads `config.js` (at most once per 10 minutes) and retries if the token changed; otherwise the badge shows "Display token rejected" and does not count it as offline. Poll at once when the page becomes visible or the browser comes back online. The last good payload is stored in `localStorage` under `beastdisplay:emm:last-good:<displayId>`.

## Time

The board is always America/Chicago, whatever the TV's timezone. `chicagoDate()` uses `Intl.DateTimeFormat#formatToParts`; day math runs on `Date.UTC` of plain dates, so DST days cannot skew it; `dueOn` is never parsed with `new Date()`. "Today" is re-checked every second, so at Chicago midnight `today` flips to `overdue` without a reload. Tests run with the runner in UTC, Asia/Tokyo and America/Chicago (`npm run test:tz`).

## Statistics on the board

Only the 8 current stats from [emm-statistics.md](emm-statistics.md). `stats.ts` holds the list. The Pulse panel renders Mothership tiles only if their id is current (today just `leads_today`), so a proposed stat sent by Nexus is ignored until Logan marks it in and its id is added in the same change.

| # | Stat | Where |
| --- | --- | --- |
| 1 | `leads_today` | Pulse tile from `pulse.tiles` |
| 2 | `pulse_delta` | Delta line on each Mothership tile |
| 3 | `events_ticker` | Pulse ticker from `pulse.ticker` |
| 4 | `projects_by_status` | Pulse tile, counted from `projects[]` |
| 5 | `assignee_load` | Pulse tile "Open per person", counted from `projects[]` |
| 6 | `due_buckets` | Pulse tile "Due", counted with the section 8 function |
| 7 | `week_calendar_load` | Calendar panel |
| 8 | `goal_progress` | Goals panel |

Stats 4 to 6 are counted on the display from the `projects` Nexus sends, so they need no new Nexus field.

## Module rules

**Layouts.** `warroom` at 1080p (whiteboard version, 2026-10-05): Pulse across the top 44%, holding the leads tile, "New development" as one lane per person with their numbered queue (4 lanes per page, rotating), and "Due today" with an overdue count, ticker underneath; Edits, Push live and Pending side by side in the middle 26%; calendar and goals in the bottom 30%. The projects-by-status, due-bucket and open-per-person tiles live on the `pulse` layout as "Board stats". `projects`: projects and due rail full height. `pulse`: pulse over board stats. `goals`: goals over calendar. Each panel has its own error boundary, so one bad panel never blanks the board.

**Pulse.** Mothership tiles keyed by id; a tile animates (180 to 400 ms) only when its `value` changed. Tone color comes from `tone` only, never the sign of `delta`. `sourceStatus` `unconfigured` shows "Mothership not connected" and `error` shows "Mothership error", never zeros. Values use condensed tabular figures (96 px at 1080p).

**Ticker.** The one continuous motion: a 40 s CSS transform loop, newest first, up to 12 items, Chicago `HH:mm`. New items swap in at the loop boundary. Empty ticker renders nothing. Reduced motion: newest 3 static, rotating every 10 s. Hidden in lobby mode (stat 3 is not lobby safe).

**Projects.** Sort: rush or blocked first, then everything else, then done last; within a group by `dueOn` ascending (null after dated), then name (`sort.ts`). Row: title (26 px), client (hidden in lobby mode unless `lobbySafe`), status word in color, assignee initials and first name, due word in color, red left edge for rush. Rows that fit are measured; overflow pages every 12 s with page dots. The document never scrolls.

**Due rail.** Same records by `dueOn` ascending, null after dated, done last with the date struck. Color and word from `dueState()`; rush adds the red edge without changing the date color. Pages every 12 s, offset 6 s from Projects.

**Due function.** `dueState(dueOn, status, today)` in `due.ts` is the only due rule; Projects, the due rail, the calendar and the due buckets all call it. Words: `Overdue Nd`, `Today`, `Nd` (soon and scheduled), `Oct 14` (later), `None`, and the struck date for done.

**Calendar.** Monday-start Chicago week containing today; today pinned and outlined. Events land on the Chicago date of `startsAt`; one crossing Chicago midnight appears on each day it covers, marked `cont.`. Up to 2 events per day then `+N`; a due badge counts due projects, colored by the worst open state. Lobby mode shows event counts, not titles.

**Goals.** Fill `clamp(current / target, 0, 1)`, 0 when `target <= 0`. `up`: good at or over target, accent under. `down`: good at or under, hot over. Over target in the good direction shows `+N unit`. On payload change the number and bar tick over 600 ms; first paint shows the value directly. A small up or down glyph shows for 10 s after a change. More goals than fit page every 12 s.
