import { describe, expect, it } from "vitest";
import { sortDueRail, sortProjects } from "../src/functions/emm/sort";
import type { Project } from "../src/functions/emm/types";

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

describe("sortProjects", () => {
  it("puts rush and blocked first, done last, then due date, then name", () => {
    const list = [
      p("e-done", { status: "done", dueOn: "2026-10-01" }),
      p("d-normal-late", { dueOn: "2026-10-20" }),
      p("c-normal-none", {}),
      p("b-blocked", { status: "blocked", dueOn: "2026-10-09" }),
      p("a-rush", { priority: "rush", dueOn: "2026-10-08" }),
      p("f-normal-soon", { dueOn: "2026-10-04" }),
      p("g-normal-soon", { dueOn: "2026-10-04" }),
    ];
    expect(sortProjects(list).map((x) => x.id)).toEqual([
      "a-rush",
      "b-blocked",
      "f-normal-soon",
      "g-normal-soon",
      "d-normal-late",
      "c-normal-none",
      "e-done",
    ]);
  });

  it("does not mutate input", () => {
    const list = [p("b", {}), p("a", {})];
    sortProjects(list);
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("sortDueRail", () => {
  it("orders by due date, null after dated, done after null", () => {
    const list = [p("done", { status: "done", dueOn: "2026-09-01" }), p("none", {}), p("late", { dueOn: "2026-10-30" }), p("soon", { dueOn: "2026-10-04" })];
    expect(sortDueRail(list).map((x) => x.id)).toEqual(["soon", "late", "none", "done"]);
  });
});
