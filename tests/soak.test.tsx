import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import changedFixture from "../src/functions/emm/fixtures/board.changed.fixture.json";
import fixture from "../src/functions/emm/fixtures/board.fixture.json";
import { LAYOUTS } from "../src/functions/emm/layouts/Layouts";
import { normalizeBoard } from "../src/functions/emm/normalize";

afterEach(cleanup);

/**
 * Phase 12 soak check (report 2.3, S17): 200 payload swaps must not grow the
 * DOM, live timers, or event listeners by more than 5%.
 */
describe("soak", () => {
  it("stays flat over 200 payload swaps", () => {
    vi.useFakeTimers();
    let listeners = 0;
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (...args: Parameters<typeof add>) {
      listeners++;
      return add.apply(this, args);
    };
    EventTarget.prototype.removeEventListener = function (...args: Parameters<typeof remove>) {
      listeners--;
      return remove.apply(this, args);
    };
    try {
      const boards = [normalizeBoard(fixture), normalizeBoard(changedFixture)];
      const Warroom = LAYOUTS.warroom;
      const view = (i: number) => <Warroom board={boards[i % 2]} today="2026-10-03" lobbyMode={false} reduced={false} />;
      const { container, rerender } = render(view(0));
      // Paging changes how many rows are on screen at any moment, so compare the
      // peak of the first 20 swaps with the peak of the last 20. A leak grows; paging does not.
      const samples: { nodes: number; timers: number; listeners: number }[] = [];
      for (let i = 1; i <= 200; i++) {
        rerender(view(i));
        act(() => void vi.advanceTimersByTime(15_000));
        samples.push({ nodes: container.querySelectorAll("*").length, timers: vi.getTimerCount(), listeners });
      }
      const peak = (rows: typeof samples, k: keyof (typeof samples)[number]) => Math.max(...rows.map((r) => r[k]));
      const early = samples.slice(0, 20);
      const late = samples.slice(-20);
      for (const k of ["nodes", "timers", "listeners"] as const) {
        expect(peak(late, k), k).toBeLessThanOrEqual(Math.ceil(peak(early, k) * 1.05));
      }
    } finally {
      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
      vi.useRealTimers();
    }
  });
});
