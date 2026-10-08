import { describe, expect, it } from "vitest";
import { addDays, dayDiff, parseYmd, weekdayIndex, weekMonday } from "../src/core/tz";
import { chicagoDate, chicagoTime } from "../src/functions/emm/time";

describe("Chicago time (runs under TZ=UTC, Asia/Tokyo and America/Chicago)", () => {
  it("finds the Chicago date on both sides of Chicago midnight", () => {
    expect(chicagoDate(Date.parse("2026-10-04T04:59:59Z"))).toBe("2026-10-03"); // 23:59:59 CDT
    expect(chicagoDate(Date.parse("2026-10-04T05:00:00Z"))).toBe("2026-10-04"); // 00:00:00 CDT
    expect(chicagoDate(Date.parse("2026-01-15T05:59:59Z"))).toBe("2026-01-14"); // 23:59:59 CST
    expect(chicagoDate(Date.parse("2026-01-15T06:00:00Z"))).toBe("2026-01-15");
  });

  it("puts a UTC early-morning instant on the previous Chicago day", () => {
    expect(chicagoDate("2026-10-07T04:30:00Z")).toBe("2026-10-06");
    expect(chicagoTime("2026-10-07T04:30:00Z")).toBe("23:30");
  });

  it("handles the DST days", () => {
    // 2026-03-08: 23 h day. 2026-11-01: 25 h day.
    expect(chicagoDate(Date.parse("2026-03-08T07:59:59Z"))).toBe("2026-03-08"); // 01:59:59 CST
    expect(chicagoDate(Date.parse("2026-03-09T04:59:59Z"))).toBe("2026-03-08"); // 23:59:59 CDT
    expect(chicagoDate(Date.parse("2026-11-02T05:59:59Z"))).toBe("2026-11-01"); // 23:59:59 CST
    expect(chicagoDate(Date.parse("2026-11-02T06:00:00Z"))).toBe("2026-11-02");
    expect(dayDiff("2026-03-07", "2026-03-09")).toBe(2);
    expect(dayDiff("2026-10-31", "2026-11-02")).toBe(2);
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("does day math on plain dates", () => {
    expect(dayDiff("2026-10-03", "2026-10-07")).toBe(4);
    expect(dayDiff("2026-10-07", "2026-10-03")).toBe(-4);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(parseYmd("2026-02-30")).toBeNull();
    expect(parseYmd("2026-10-07T00:00:00Z")).toBeNull();
  });

  it("starts the week on Monday", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-08")).toBe(3); // Thursday
    expect(weekdayIndex("2026-10-11")).toBe(6); // Sunday
    expect(weekMonday("2026-10-11")).toBe("2026-10-05");
    expect(weekMonday("2026-10-05")).toBe("2026-10-05");
    expect(weekMonday("2026-11-01")).toBe("2026-10-26");
  });
});
