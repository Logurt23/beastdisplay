import { describe, expect, it } from "vitest";
import { developmentLanes, unassignedDevelopment, dueToday, inStage, projectsToday, teamToday } from "../src/functions/emm/board";
import { deriveStage } from "../src/functions/emm/normalize";
import type { Assignee, Project } from "../src/functions/emm/types";

const amy: Assignee = { id: "u1", name: "Amy Example", initials: "AE" };
const bo: Assignee = { id: "u2", name: "Bo Example", initials: "BE" };

const p = (id: string, o: Partial<Project>): Project => ({
  id,
  name: id,
  client: null,
  status: "active",
  priority: "normal",
  assignee: null,
  dueOn: null,
  lobbySafe: false,
  stage: "development",
  rank: null,
  ...o,
});

describe("developmentLanes", () => {
  it("groups open development work by person, busiest first, unassigned last", () => {
    const lanes = developmentLanes([
      p("x", {}),
      p("a2", { assignee: amy, rank: 2 }),
      p("a1", { assignee: amy, rank: 1 }),
      p("a-unranked", { assignee: amy }),
      p("b1", { assignee: bo, rank: 1 }),
      p("b-done", { assignee: bo, status: "done" }),
      p("b-edit", { assignee: bo, stage: "edits" }),
    ]);
    expect(lanes.map((l) => l.id)).toEqual(["u1", "u2", "__unassigned"]);
    expect(lanes[0].projects.map((x) => x.id)).toEqual(["a1", "a2", "a-unranked"]);
    expect(lanes[1].projects.map((x) => x.id)).toEqual(["b1"]);
  });
});

describe("developmentLanes with configured developers", () => {
  it("shows one lane per developer in config order, even when empty, and leaves out others", () => {
    const cy: Assignee = { id: "u3", name: "Cy Example", initials: "CE" };
    const lanes = developmentLanes(
      [p("b1", { assignee: bo }), p("c1", { assignee: cy }), p("x", {})],
      ["bo", "Dee"],
    );
    expect(lanes.map((l) => l.assignee?.name)).toEqual(["Bo Example", "Dee"]);
    expect(lanes[1].projects).toEqual([]);
    expect(lanes.flatMap((l) => l.projects.map((x) => x.id))).not.toContain("c1");
  });

  it("counts unassigned development work for the header", () => {
    expect(unassignedDevelopment([p("x", {}), p("y", { stage: "edits" }), p("z", { status: "done" }), p("a", { assignee: amy })])).toBe(1);
  });

  it("matches by assignee id too", () => {
    const lanes = developmentLanes([p("a1", { assignee: amy })], ["u1"]);
    expect(lanes.map((l) => l.id)).toEqual(["u1"]);
  });
});

describe("inStage", () => {
  it("returns open projects in one whiteboard section", () => {
    const list = [p("e1", { stage: "edits" }), p("e2", { stage: "edits", status: "done" }), p("l1", { stage: "launch" })];
    expect(inStage(list, "edits").map((x) => x.id)).toEqual(["e1"]);
    expect(inStage(list, "pending")).toEqual([]);
  });
});

describe("dueToday", () => {
  it("lists open work due today and counts overdue separately", () => {
    const r = dueToday(
      [
        p("t1", { dueOn: "2026-10-05" }),
        p("t-done", { dueOn: "2026-10-05", status: "done" }),
        p("late", { dueOn: "2026-10-01" }),
        p("later", { dueOn: "2026-10-09" }),
      ],
      "2026-10-05",
    );
    expect(r.today.map((x) => x.id)).toEqual(["t1"]);
    expect(r.overdue).toBe(1);
  });
});

describe("deriveStage", () => {
  it("maps status to a whiteboard section when Nexus sends no stage", () => {
    expect(deriveStage("waiting")).toBe("pending");
    expect(deriveStage("review")).toBe("edits");
    expect(deriveStage("active")).toBe("development");
    expect(deriveStage("queued")).toBe("development");
  });
});

describe("projectsToday", () => {
  it("counts open work not in Pending, and how much is due today", () => {
    const r = projectsToday(
      [p("a", { dueOn: "2026-10-05" }), p("b", { stage: "edits" }), p("c", { stage: "pending", dueOn: "2026-10-05" }), p("d", { status: "done" })],
      "2026-10-05",
    );
    expect(r).toEqual({ count: 2, dueToday: 1 });
  });
});

describe("teamToday", () => {
  const now = Date.parse("2026-10-05T15:00:00Z"); // 10:00 Chicago
  const ev = (id: string, startsAt: string, people: Assignee[], endsAt: string | null = null) => ({ id, title: id, startsAt, endsAt, kind: null, people });

  it("orders each person's tasks: due today first, then live, edits, queue by rank, pending", () => {
    const [amyDay] = teamToday(
      [
        p("dev2", { assignee: amy, rank: 2 }),
        p("pend", { assignee: amy, stage: "pending" }),
        p("dev1", { assignee: amy, rank: 1 }),
        p("edit", { assignee: amy, stage: "edits" }),
        p("live", { assignee: amy, stage: "launch" }),
        p("due", { assignee: amy, rank: 3, dueOn: "2026-10-05" }),
        p("done", { assignee: amy, status: "done" }),
      ],
      [],
      "2026-10-05",
      now,
    );
    expect(amyDay.tasks.map((x) => x.id)).toEqual(["due", "live", "edit", "dev1", "dev2", "pend"]);
    expect(amyDay.next).toBeNull();
  });

  it("picks each person's next event, counting whole-team events and ones in progress", () => {
    const days = teamToday(
      [p("a", { assignee: amy }), p("b", { assignee: bo })],
      [
        ev("past", "2026-10-05T13:00:00Z", [amy], "2026-10-05T14:00:00Z"),
        ev("bo-now", "2026-10-05T14:30:00Z", [bo], "2026-10-05T15:30:00Z"),
        ev("team", "2026-10-05T16:00:00Z", []),
        ev("amy-later", "2026-10-05T18:00:00Z", [amy]),
      ],
      "2026-10-05",
      now,
    );
    const byId = Object.fromEntries(days.map((d) => [d.id, d]));
    expect(byId.u1.next?.id).toBe("team");
    expect(byId.u2.next).toMatchObject({ id: "bo-now", now: true });
  });

  it("includes people who only have events", () => {
    const cy: Assignee = { id: "u3", name: "Cy Example", initials: "CE" };
    const days = teamToday([], [ev("shoot", "2026-10-06T15:00:00Z", [cy])], "2026-10-05", now);
    expect(days.map((d) => d.id)).toEqual(["u3"]);
    expect(days[0].tasks).toEqual([]);
  });
});
