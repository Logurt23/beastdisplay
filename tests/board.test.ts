import { describe, expect, it } from "vitest";
import { developmentLanes, dueToday, inStage } from "../src/functions/emm/board";
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
