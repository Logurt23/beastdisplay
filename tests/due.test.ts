import { describe, expect, it } from "vitest";
import { DUE_COLORS, dueState } from "../src/functions/emm/due";
import { chicagoDate } from "../src/functions/emm/time";

const today = "2026-10-03";

describe("dueState (section 8)", () => {
  it.each([
    ["2026-10-02", "overdue", "#ff4d4d", "Overdue 1d"],
    ["2026-09-20", "overdue", "#ff4d4d", "Overdue 13d"],
    ["2026-10-03", "today", "#ffb020", "Today"],
    ["2026-10-04", "soon", "#f2e35b", "1d"],
    ["2026-10-06", "soon", "#f2e35b", "3d"],
    ["2026-10-07", "scheduled", "#3dd6c6", "4d"],
    ["2026-10-17", "scheduled", "#3dd6c6", "14d"],
    ["2026-10-18", "later", "#7aa2ff", "Oct 18"],
  ] as const)("%s is %s", (dueOn, state, color, label) => {
    expect(dueState(dueOn, "active", today)).toMatchObject({ state, color, label, strike: false });
  });

  it("null is none", () => {
    expect(dueState(null, "active", today)).toEqual({ state: "none", color: "#8b93a7", label: "None", days: null, strike: false });
  });

  it("done wins over the date, struck and grey, even when past", () => {
    expect(dueState("2026-09-01", "done", today)).toMatchObject({ state: "done", color: "#6f7a72", strike: true, label: "Sep 1" });
    expect(dueState(null, "done", today)).toMatchObject({ state: "done", label: "Done", strike: false });
  });

  it("unknown status still gets a due color", () => {
    expect(dueState("2026-10-02", "unknown", today).state).toBe("overdue");
  });

  it("flips today to overdue at Chicago midnight, not UTC midnight", () => {
    const due = "2026-10-03";
    const before = chicagoDate(Date.parse("2026-10-04T04:59:59Z")); // 23:59:59 Chicago, already Oct 4 in UTC
    const after = chicagoDate(Date.parse("2026-10-04T05:00:00Z"));
    expect(dueState(due, "active", before).state).toBe("today");
    expect(dueState(due, "active", after).state).toBe("overdue");
  });

  it("is DST-proof across the fall-back day", () => {
    expect(dueState("2026-11-01", "active", "2026-10-31").state).toBe("soon");
    expect(dueState("2026-11-04", "active", "2026-11-01")).toMatchObject({ state: "soon", label: "3d" });
    expect(dueState("2026-03-08", "active", "2026-03-07")).toMatchObject({ state: "soon", label: "1d" });
  });

  it("uses exactly the section 8 colors", () => {
    expect(DUE_COLORS).toEqual({
      overdue: "#ff4d4d",
      today: "#ffb020",
      soon: "#f2e35b",
      scheduled: "#3dd6c6",
      later: "#7aa2ff",
      none: "#8b93a7",
      done: "#6f7a72",
    });
  });
});
