import { describe, expect, it } from "vitest";
import { goalView } from "../src/functions/emm/goals";

describe("goalView", () => {
  it("up goals: accent under target, good at or over, fill capped", () => {
    expect(goalView({ current: 3, target: 6, goodDirection: "up" })).toEqual({ fill: 0.5, tone: "accent", beyond: 0 });
    expect(goalView({ current: 6, target: 6, goodDirection: "up" })).toEqual({ fill: 1, tone: "good", beyond: 0 });
    expect(goalView({ current: 9, target: 6, goodDirection: "up" })).toEqual({ fill: 1, tone: "good", beyond: 3 });
  });

  it("down goals flip: hot over target, good at or under", () => {
    expect(goalView({ current: 2, target: 1, goodDirection: "down" })).toMatchObject({ tone: "hot", beyond: 0 });
    expect(goalView({ current: 1, target: 1, goodDirection: "down" })).toMatchObject({ tone: "good" });
    expect(goalView({ current: 3.5, target: 4, goodDirection: "down" })).toMatchObject({ tone: "good", beyond: 0.5 });
  });

  it("guards zero and negative targets and negative values", () => {
    expect(goalView({ current: 5, target: 0, goodDirection: "up" }).fill).toBe(0);
    expect(goalView({ current: -2, target: 4, goodDirection: "up" }).fill).toBe(0);
  });
});
