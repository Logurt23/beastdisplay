import { describe, expect, it } from "vitest";
import { buildWeek } from "../src/functions/emm/calendar";
import type { CalendarEvent, Project } from "../src/functions/emm/types";

const proj = (id: string, dueOn: string | null, status: Project["status"] = "active"): Project => ({
  id,
  name: id,
  client: null,
  status,
  priority: "normal",
  assignee: null,
  dueOn,
  lobbySafe: false,
  stage: "development",
  rank: null,
});
const ev = (id: string, startsAt: string, endsAt: string | null = null): CalendarEvent => ({ id, title: id, startsAt, endsAt, kind: null });

describe("buildWeek", () => {
  const today = "2026-10-07"; // Wednesday

  it("is the Monday-start Chicago week containing today, with today pinned", () => {
    const days = buildWeek(today, [], []);
    expect(days.map((d) => d.date)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(days.map((d) => d.weekday)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual([today]);
  });

  it("lands a Thursday due date on Thursday, not UTC Wednesday", () => {
    const days = buildWeek(today, [proj("thu", "2026-10-08")], []);
    expect(days[3]).toMatchObject({ weekday: "Thu", dueCount: 1, dueWorst: "soon" });
    expect(days[2].dueCount).toBe(0);
  });

  it("places 04:30Z on the previous Chicago day", () => {
    const days = buildWeek(today, [], [ev("late", "2026-10-07T04:30:00Z", "2026-10-07T04:45:00Z")]);
    expect(days[1].events.map((e) => [e.id, e.time])).toEqual([["late", "23:30"]]);
    expect(days[2].events).toEqual([]);
  });

  it("shows a midnight-crossing event on both days", () => {
    const days = buildWeek(today, [], [ev("render", "2026-10-07T03:00:00Z", "2026-10-07T09:00:00Z")]);
    expect(days[1].events[0]).toMatchObject({ id: "render", continued: false, time: "22:00" });
    expect(days[2].events[0]).toMatchObject({ id: "render", continued: true, time: "cont." });
  });

  it("does not spill an event ending exactly at midnight", () => {
    const days = buildWeek(today, [], [ev("eod", "2026-10-07T03:00:00Z", "2026-10-07T05:00:00Z")]);
    expect(days[1].events).toHaveLength(1);
    expect(days[2].events).toHaveLength(0);
  });

  it("treats missing endsAt as one hour", () => {
    const days = buildWeek(today, [], [ev("open", "2026-10-07T04:30:00Z")]);
    expect(days[1].events).toHaveLength(1);
    expect(days[2].events).toHaveLength(1);
  });

  it("colors a day badge by the worst open due state", () => {
    const days = buildWeek(today, [proj("a", "2026-10-05"), proj("b", "2026-10-05", "done"), proj("c", "2026-10-07")], []);
    expect(days[0]).toMatchObject({ dueCount: 2, dueWorst: "overdue" });
    expect(days[2]).toMatchObject({ dueCount: 1, dueWorst: "today" });
  });

  it("handles a DST week", () => {
    const days = buildWeek("2026-11-01", [proj("x", "2026-11-01")], [ev("fallback", "2026-11-01T06:30:00Z", "2026-11-01T07:30:00Z")]);
    expect(days[0].date).toBe("2026-10-26");
    expect(days[6]).toMatchObject({ date: "2026-11-01", isToday: true, dueCount: 1 });
    expect(days[6].events.map((e) => e.time)).toEqual(["01:30"]);
  });
});
