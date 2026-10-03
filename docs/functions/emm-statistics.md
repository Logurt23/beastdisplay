# EMM pack: statistic menu

Product: BeastDisplay. Function pack: `emm`. Deliverable type: review only. Written 2026-10-03 by Fable, per build order section 6.1.

This is a menu, not a build list. 25 options: 8 are `current` and already in the build order; 17 are `proposed`. Nothing in the proposed group is built until Logan marks it in. Putting a proposed stat on the board before that is a miss.

Every source is `nexus` or `mothership` (Mothership is reached only through Nexus; the display never calls it). Where EMM is not known to have a feed, the source says `unknown` and the note says what feed would be needed. No feed is invented.

Field key:

- **id**: tile id as Nexus would send it in `pulse.tiles[].id`.
- **label**: short enough for a tile at 1080p.
- **counts**: what the number is.
- **source**: `nexus`, `mothership`, or `unknown`.
- **grain**: `live`, `today`, `this week`, `this month`.
- **tone**: what makes it `up`, `down`, or `flat`. Nexus computes tone; the display only renders the `tone` it receives.
- **lobby safe**: `yes` if it can show on a lobby-facing screen with no client names or money.
- **status**: `current` or `proposed`.
- **cost** (proposed only): `low` if Nexus already stores it, `high` if it needs a new Mothership pull or a new external feed.

Grain words are Chicago-local. "Today" starts at Chicago midnight; "this week" is Monday to Sunday; "this month" is calendar month. Nexus owns those boundaries.

---

## Current (8)

These are already in the build order (section 6.1) and count toward the 25.

### 1. `leads_today`
- label: Leads today
- counts: new leads since Chicago midnight (forms plus calls plus any other lead event Mothership tracks)
- source: mothership
- grain: today
- tone: `up` if above the same point yesterday, `down` if below, `flat` within ±1
- lobby safe: yes
- status: current

### 2. `pulse_delta`
- label: vs yesterday
- counts: change versus yesterday on each live pulse tile; rendered as the `delta` and `deltaLabel` on that tile, not as its own tile
- source: mothership
- grain: live
- tone: sign of the delta in the tile's good direction
- lobby safe: yes
- status: current

### 3. `events_ticker`
- label: Recent events
- counts: the most recent event texts (form submit, call, other) with time
- source: mothership
- grain: live
- tone: `info` per item, from Nexus; no aggregate tone
- lobby safe: no (event text can carry client or caller detail; Nexus would need to redact)
- status: current

### 4. `projects_by_status`
- label: Projects by status
- counts: open project counts for queued, active, waiting, review, blocked, done
- source: nexus
- grain: live
- tone: `down` when blocked count rises versus last payload, `up` when it falls, otherwise `flat`
- lobby safe: yes (counts only)
- status: current

### 5. `assignee_load`
- label: Open per person
- counts: open projects per assignee (not done)
- source: nexus
- grain: live
- tone: `flat`; this is a distribution, not a scalar
- lobby safe: yes (staff names, no clients)
- status: current

### 6. `due_buckets`
- label: Due buckets
- counts: projects per due state: overdue, today, soon, scheduled, later, none (section 8 rules)
- source: nexus
- grain: live
- tone: `down` when overdue rises, `up` when it falls, otherwise `flat`
- lobby safe: yes (counts only; the rail itself shows names and is governed by `lobbySafe` per record)
- status: current

### 7. `week_calendar_load`
- label: This week
- counts: due dates and events falling in the visible Monday to Sunday week
- source: nexus
- grain: this week
- tone: `flat`
- lobby safe: no (titles and client names appear on the strip)
- status: current

### 8. `goal_progress`
- label: Goals
- counts: current, target and tick direction per custom goal
- source: nexus
- grain: live
- tone: `up` when the latest change moved in `goodDirection`, `down` when against it, `flat` when unchanged
- lobby safe: yes unless a goal name carries a client
- status: current

---

## Proposed (17)

Not built until Logan marks each one in. Each has a one-line cost note.

### 9. `calls_today`
- label: Calls today
- counts: tracked inbound phone calls since Chicago midnight (a split of Leads today)
- source: mothership
- grain: today
- tone: `up` above the same point yesterday, `down` below, `flat` within ±1
- lobby safe: yes
- status: proposed
- cost: `low` if call events already arrive in the ticker feed and Nexus can count them; otherwise `high` (new Mothership pull).

### 10. `forms_today`
- label: Form submits today
- counts: web form submissions since Chicago midnight (the other split of Leads today)
- source: mothership
- grain: today
- tone: same rule as calls
- lobby safe: yes
- status: proposed
- cost: `low` if form events already arrive in the ticker feed; otherwise `high`.

### 11. `ad_spend_mtd`
- label: Ad spend MTD
- counts: paid media spend month to date across all managed ad accounts, in dollars
- source: mothership (unknown whether Mothership aggregates ad platform spend)
- grain: this month
- tone: `flat` by default; `up` or `down` only if Nexus also holds a monthly budget to pace against
- lobby safe: no (money)
- status: proposed
- cost: `high`; needs a Mothership pull from the ad platforms, and a budget figure in Nexus for tone.

### 12. `cost_per_lead_mtd`
- label: Cost per lead
- counts: `ad_spend_mtd` divided by paid leads month to date
- source: mothership (unknown; derived from 11 and a paid-lead count)
- grain: this month
- tone: `up` (good) when lower than last month, `down` when higher, `flat` within 5%
- lobby safe: no (money)
- status: proposed
- cost: `high`; depends on 11 and on Mothership attributing leads to paid sources.

### 13. `campaigns_live`
- label: Campaigns live
- counts: number of ad campaigns currently running across clients
- source: nexus (unknown whether Nexus tracks campaigns as records; if not, mothership)
- grain: live
- tone: `flat`
- lobby safe: yes (count only)
- status: proposed
- cost: `low` if Nexus stores campaigns; `high` if it must come from the ad platforms through Mothership.

### 14. `sites_up`
- label: Sites up
- counts: managed client sites responding, as "N of M up"
- source: unknown (needs an uptime monitor feed; none is named in the order)
- grain: live
- tone: `up` when all up, `down` when any site is down, `flat` never
- lobby safe: yes (count only)
- status: proposed
- cost: `high`; needs an uptime monitor and a pull into Nexus. If EMM already runs one, `low`.

### 15. `seo_rank_movers_week`
- label: Rank movers
- counts: tracked keywords that moved up versus down this week, as "+N / −M"
- source: unknown (needs a rank tracker feed)
- grain: this week
- tone: `up` when more moved up than down, `down` when the reverse, `flat` when equal
- lobby safe: yes (counts only)
- status: proposed
- cost: `high`; needs a rank-tracking source and a weekly pull through Nexus.

### 16. `organic_sessions_week`
- label: Organic sessions
- counts: organic search sessions this week across managed sites
- source: mothership (unknown whether Mothership pulls analytics)
- grain: this week
- tone: `up` above the same days last week, `down` below, `flat` within 5%
- lobby safe: yes (aggregate)
- status: proposed
- cost: `high`; needs an analytics pull per site.

### 17. `ott_impressions_week`
- label: OTT impressions
- counts: OTT/CTV ad impressions delivered this week across campaigns
- source: mothership (unknown whether Mothership has OTT platform reporting)
- grain: this week
- tone: `flat` by default; `up`/`down` against a weekly delivery goal only if Nexus stores one
- lobby safe: yes (aggregate count)
- status: proposed
- cost: `high`; needs an OTT platform pull.

### 18. `social_scheduled_7d`
- label: Social queued
- counts: social posts scheduled for the next 7 days, with posts published in the last 7 as the delta
- source: nexus (unknown whether Nexus tracks social production; if not, unknown scheduler feed)
- grain: this week
- tone: `down` when the queue is empty for any client with an active social retainer, otherwise `flat`
- lobby safe: yes (counts only)
- status: proposed
- cost: `low` if social posts are Nexus records; `high` if they live only in a scheduling tool.

### 19. `pipeline_open`
- label: Pipeline open
- counts: open proposals or opportunities, count and total value
- source: nexus (unknown whether Nexus stores proposals)
- grain: live
- tone: `up` when count rose since last payload, `down` when it fell, `flat` otherwise
- lobby safe: no (money and prospect names)
- status: proposed
- cost: `low` if Nexus stores proposals; otherwise unknown and not buildable.

### 20. `won_this_month`
- label: Won this month
- counts: proposals marked won this calendar month
- source: nexus (unknown whether Nexus stores proposals)
- grain: this month
- tone: `up` on each new win in the latest payload, otherwise `flat`
- lobby safe: yes (count only)
- status: proposed
- cost: `low` if Nexus stores proposals; otherwise unknown and not buildable.

### 21. `oldest_blocked_days`
- label: Oldest blocked
- counts: days since the longest-blocked open project entered `blocked`
- source: nexus
- grain: live
- tone: `up` when under 2 days, `flat` at 2 to 5 days, `down` when over 5 days
- lobby safe: yes (number only; the project name stays in the Projects panel)
- status: proposed
- cost: `low` if Nexus records when a status changed; otherwise `low` with a Nexus schema addition (status changed-at timestamp).

### 22. `overdue_count`
- label: Overdue
- counts: open projects with `dueOn` before today Chicago, as a single number
- source: nexus
- grain: live
- tone: `up` when zero, `down` when above zero and rising, `flat` when above zero and unchanged
- lobby safe: yes
- status: proposed
- cost: `low`; it is the overdue row of the due buckets as a pulse tile.

### 23. `completed_this_week`
- label: Shipped this week
- counts: projects moved to `done` since Monday Chicago, with last week's count as the delta
- source: nexus
- grain: this week
- tone: `up` when ahead of last week's same-day count, `down` when behind, `flat` when equal
- lobby safe: yes
- status: proposed
- cost: `low` if Nexus records a done timestamp; otherwise needs that field.

### 24. `waiting_on_client`
- label: Waiting on client
- counts: projects in `waiting`, with the longest wait in days
- source: nexus
- grain: live
- tone: `flat` under 3 days longest wait, `down` at 3 days or more
- lobby safe: no (implies specific clients are slow; counts-only variant could be yes)
- status: proposed
- cost: `low`; status is already in the contract; the day count needs a status changed-at timestamp as in 21.

### 25. `invoices_outstanding`
- label: Invoices open
- counts: unpaid invoices, count and total, with overdue count
- source: nexus (unknown whether Nexus stores billing; "billing status if Nexus has it")
- grain: live
- tone: `down` when any invoice is overdue, `flat` otherwise
- lobby safe: no (money)
- status: proposed
- cost: `low` if Nexus stores invoices; otherwise not buildable from known sources.

---

## Tally

| Status | Count |
| --- | --- |
| current | 8 |
| proposed | 17 |
| total | 25 |

Proposed by cost: `low` or `low if Nexus stores` 10 (items 13, 18, 19, 20, 21, 22, 23, 24, 25 and the conditional `low` on 9 and 10), `high` 9 (items 9, 10, 11, 12, 14, 15, 16, 17, and 13 if not in Nexus). Items 9, 10 and 13 appear in both because their cost depends on what Nexus already holds.

Overlap note: items 9 and 10 are splits of item 1; if both are marked in, item 1 can stay as the total or be dropped. Item 22 is a tile view of item 6. Logan decides.

## Review

Logan reviews this list with Claude. For each proposed item, mark `in`, `out`, or `later`. Items marked `in` move to the build order with their Nexus or Mothership work named. Until then, Phase 10 builds the current 8 only.

End of menu. Nothing below this line.
