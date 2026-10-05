import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoopList } from "../src/functions/emm/panels/LoopList";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** One hold plus one slide, flushing React between the two timers. */
const step = () => {
  act(() => vi.advanceTimersByTime(4000));
  act(() => vi.advanceTimersByTime(700));
};
const texts = (c: HTMLElement) => [...c.querySelectorAll("[data-item]")].map((e) => e.textContent);
const list = (items: string[], fit: number, cols = 1) => (
  <LoopList items={items} fit={fit} cols={cols} rowPx={40} holdMs={4000} keyOf={(s) => s} render={(s) => <span data-item>{s}</span>} />
);

describe("LoopList", () => {
  it("shows everything and stays still when it all fits", () => {
    vi.useFakeTimers();
    const { container } = render(list(["a", "b"], 3));
    act(() => vi.advanceTimersByTime(20_000));
    expect(texts(container)).toEqual(["a", "b"]);
    expect(container.querySelector("[data-looping]")).toBeNull();
  });

  it("slides one row at a time through every item and wraps around", () => {
    vi.useFakeTimers();
    const { container } = render(list(["a", "b", "c", "d"], 2));
    expect(texts(container)).toEqual(["a", "b", "c"]);
    act(() => vi.advanceTimersByTime(4000));
    const track = container.querySelector("[data-looping]") as HTMLElement;
    expect(track.style.transform).toContain("translateY");
    act(() => vi.advanceTimersByTime(700));
    expect(texts(container)).toEqual(["b", "c", "d"]);
    step();
    step();
    step();
    expect(texts(container)).toEqual(["a", "b", "c"]);
  });

  it("advances a whole row of columns at once", () => {
    vi.useFakeTimers();
    const { container } = render(list(["a", "b", "c", "d", "e"], 2, 2));
    step();
    expect(texts(container).slice(0, 2)).toEqual(["c", "d"]);
  });
});
