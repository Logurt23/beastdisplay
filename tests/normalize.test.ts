import { describe, expect, it } from "vitest";
import fixture from "../src/functions/emm/fixtures/board.fixture.json";
import { normalizeBoard } from "../src/functions/emm/normalize";
import { assigneeLoad, dueBuckets, filterTiles, projectsByStatus } from "../src/functions/emm/stats";

describe("normalizeBoard (contract reading rules)", () => {
  it("reads the fixture and flags it as fixture data", () => {
    const b = normalizeBoard(fixture);
    expect(b.projects).toHaveLength(20);
    expect(b.fixture).toBe(true);
    expect(b.pulse.sourceStatus).toBe("live");
  });

  it("reads null or missing arrays as empty and never throws", () => {
    for (const raw of [null, undefined, 42, "x", [], {}, { pulse: null, projects: null, events: "no", goals: [null, 1] }]) {
      const b = normalizeBoard(raw);
      expect(b.projects).toEqual([]);
      expect(b.events).toEqual([]);
      expect(b.goals).toEqual([]);
      expect(b.pulse.tiles).toEqual([]);
      expect(b.pulse.ticker).toEqual([]);
    }
  });

  it("treats missing sourceStatus with no tiles as not connected", () => {
    expect(normalizeBoard({ pulse: { tiles: [] } }).pulse.sourceStatus).toBe("unconfigured");
    expect(normalizeBoard({ pulse: { tiles: [], sourceStatus: "error" } }).pulse.sourceStatus).toBe("error");
  });

  it("keeps unknown words muted instead of dropping records", () => {
    const b = normalizeBoard({
      projects: [
        { id: "a", name: "A", status: "on-hold", priority: "urgent", assignee: null, dueOn: "2026-13-40" },
        { id: "a", name: "A2", status: "active" },
        { name: "no id" },
      ],
      pulse: { tiles: [{ id: "t", value: 3, tone: "sideways" }] },
    });
    expect(b.projects).toEqual([
      { id: "a", name: "A2", client: null, status: "active", priority: "normal", assignee: null, dueOn: null, lobbySafe: false, stage: "development", rank: null },
    ]);
    const c = normalizeBoard({ projects: [{ id: "x", status: "on-hold" }] });
    expect(c.projects[0]).toMatchObject({ status: "unknown", rawStatus: "on-hold" });
    expect(b.pulse.tiles[0]).toMatchObject({ tone: "unknown", display: "3", delta: null, deltaLabel: null });
  });

  it("derives initials when Nexus leaves them out", () => {
    const b = normalizeBoard({ projects: [{ id: "a", assignee: { id: "u", name: "Logan Brewer" } }] });
    expect(b.projects[0].assignee).toEqual({ id: "u", name: "Logan Brewer", initials: "LB" });
  });
});

describe("current stats only", () => {
  it("shows only current Mothership tile ids; proposed ids are ignored", () => {
    const b = normalizeBoard({
      pulse: {
        tiles: [
          { id: "leads_today", label: "Leads today", value: 4 },
          { id: "calls_today", label: "Calls today", value: 9 },
          { id: "ad_spend_mtd", label: "Ad spend", value: 1 },
        ],
      },
    });
    const f = filterTiles(b.pulse.tiles);
    expect(f.shown.map((t) => t.id)).toEqual(["leads_today"]);
    expect(f.ignored).toEqual(["calls_today", "ad_spend_mtd"]);
  });

  it("derives status counts, due buckets and assignee load from projects", () => {
    const b = normalizeBoard(fixture);
    const byStatus = Object.fromEntries(projectsByStatus(b.projects).map((r) => [r.status, r.count]));
    expect(Object.values(byStatus).reduce((a, n) => a + n, 0)).toBe(20);
    expect(byStatus.done).toBe(2);
    const buckets = dueBuckets(b.projects, "2026-10-03");
    expect(buckets.map((x) => x.state)).toEqual(["overdue", "today", "soon", "scheduled", "later", "none"]);
    expect(buckets.reduce((a, x) => a + x.count, 0)).toBe(18);
    const load = assigneeLoad(b.projects);
    expect(load.reduce((a, r) => a + r.open, 0)).toBe(18);
    expect(load.some((r) => r.name === "Unassigned")).toBe(true);
  });
});
