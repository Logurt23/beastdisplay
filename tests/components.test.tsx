import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App";
import { parseConfig } from "../src/core/config";
import changedFixture from "../src/functions/emm/fixtures/board.changed.fixture.json";
import fixture from "../src/functions/emm/fixtures/board.fixture.json";
import { LAYOUTS } from "../src/functions/emm/layouts/Layouts";
import { normalizeBoard } from "../src/functions/emm/normalize";
import { GoalsPanel } from "../src/functions/emm/panels/Goals";
import { ProjectsPanel } from "../src/functions/emm/panels/Projects";
import { PulsePanel } from "../src/functions/emm/panels/Pulse";

afterEach(cleanup);

const A = normalizeBoard(fixture);
const B = normalizeBoard(changedFixture);
const today = "2026-10-03";

describe("core boots without the EMM pack", () => {
  it("shows function-not-configured when emm is disabled", () => {
    render(<App initialConfig={parseConfig({ defaultTarget: { kind: "function", fn: "emm" }, functions: { emm: { enabled: false } } })} search="" />);
    expect(screen.getByText("Function not configured")).toBeTruthy();
    expect(screen.getByText("BeastDisplay")).toBeTruthy();
  });

  it("boots with no config at all", () => {
    render(<App initialConfig={parseConfig(undefined)} search="" />);
    expect(screen.getByText("No display target configured")).toBeTruthy();
  });

  it("refuses a non-allowlisted target and shows the URL", () => {
    render(<App initialConfig={parseConfig({})} search="?target=https://evil.example.com/" />);
    expect(screen.getByText("Not on the allowlist")).toBeTruthy();
    expect(screen.getByText("https://evil.example.com/")).toBeTruthy();
  });

  it("frames an allowlisted frame:true target inside the kiosk frame", () => {
    const { container } = render(
      <App initialConfig={parseConfig({ allowlist: [{ origin: "https://status.example.com", frame: true }] })} search="?target=https://status.example.com/x" />,
    );
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://status.example.com/x");
  });
});

describe("Pulse", () => {
  it("animates only the tile whose value changed", () => {
    const { container, rerender } = render(<PulsePanel board={A} today={today} lobbyMode={false} reduced={false} />);
    expect(container.querySelectorAll("[class*=bump]")).toHaveLength(0);
    rerender(<PulsePanel board={B} today={today} lobbyMode={false} reduced={false} />);
    const bumped = [...container.querySelectorAll("[class*=bump]")].map((el) => el.getAttribute("data-stat"));
    expect(bumped).toEqual(["leads_today"]);
  });

  it("shows 'Mothership not connected', never zeros, when unconfigured", () => {
    const board = normalizeBoard({ ...fixture, pulse: { tiles: [], ticker: [], sourceStatus: "unconfigured" } });
    const { container } = render(<PulsePanel board={board} today={today} lobbyMode={false} reduced={false} />);
    expect(screen.getByText("Mothership not connected")).toBeTruthy();
    expect(container.querySelector('[data-stat="leads_today"]')).toBeNull();
    expect(screen.queryByLabelText("Recent events")).toBeNull();
  });

  it("does not render proposed stats even if Nexus sends them", () => {
    const board = normalizeBoard({
      ...fixture,
      pulse: { ...fixture.pulse, tiles: [...fixture.pulse.tiles, { id: "calls_today", label: "Calls today", value: 9, display: "9", tone: "up" }] },
    });
    render(<PulsePanel board={board} today={today} lobbyMode={false} reduced={false} />);
    expect(screen.queryByText("Calls today")).toBeNull();
    expect(screen.getByText("Leads today")).toBeTruthy();
  });

  it("hides the ticker in lobby mode", () => {
    render(<PulsePanel board={A} today={today} lobbyMode={true} reduced={false} />);
    expect(screen.queryByLabelText("Recent events")).toBeNull();
  });
});

describe("Goals", () => {
  it("paints the value directly on first render (no count-up)", () => {
    render(<GoalsPanel goals={A.goals} reduced={false} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("flips an inverse goal to hot above target", () => {
    const { container } = render(<GoalsPanel goals={A.goals} reduced={true} />);
    const tones = [...container.querySelectorAll("[data-tone]")].map((el) => el.getAttribute("data-tone"));
    expect(tones).toEqual(["accent", "hot", "good", "good"]);
  });

  it("snaps to the new value under reduced motion", () => {
    const { rerender } = render(<GoalsPanel goals={A.goals} reduced={true} />);
    rerender(<GoalsPanel goals={B.goals} reduced={true} />);
    expect(screen.getByText("4")).toBeTruthy();
  });
});

describe("Projects", () => {
  it("pages 20 projects inside the panel and hides non-lobby-safe clients in lobby mode", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ProjectsPanel projects={A.projects} today={today} lobbyMode={false} />);
    expect(container.querySelector('[aria-label^="Page 1 of"]')).toBeTruthy();
    const firstPage = [...container.querySelectorAll("[data-status]")].map((r) => r.textContent);
    act(() => void vi.advanceTimersByTime(12_000));
    const secondPage = [...container.querySelectorAll("[data-status]")].map((r) => r.textContent);
    expect(secondPage).not.toEqual(firstPage);
    rerender(<ProjectsPanel projects={A.projects} today={today} lobbyMode={true} />);
    const clients = A.projects.filter((p) => !p.lobbySafe).map((p) => p.client);
    const shownText = container.textContent ?? "";
    const unsafeVisible = A.projects.filter((p) => !p.lobbySafe && shownText.includes(`${p.name}${p.client}`));
    expect(clients.length).toBeGreaterThan(0);
    expect(unsafeVisible).toEqual([]);
    vi.useRealTimers();
  });
});

describe("Warroom layout", () => {
  it("renders every panel from the fixture", () => {
    const Warroom = LAYOUTS.warroom;
    render(<Warroom board={A} today={today} lobbyMode={false} reduced={false} />);
    for (const label of ["Pulse", "Projects", "Due", "This week", "Goals"]) expect(screen.getByLabelText(label)).toBeTruthy();
  });
});
