import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardPoller, backoffMs, storageKey, type PollSnapshot } from "../src/functions/emm/api";
import fixture from "../src/functions/emm/fixtures/board.fixture.json";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

function setup(responses: Array<() => Promise<Response>>, extra: Partial<ConstructorParameters<typeof BoardPoller>[0]> = {}) {
  const calls: RequestInit[] = [];
  const snaps: PollSnapshot[] = [];
  let i = 0;
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init!);
    const r = responses[Math.min(i++, responses.length - 1)];
    return r();
  });
  const poller = new BoardPoller({
    nexusUrl: "https://nexus.example/",
    token: "tok-1",
    displayId: "office-main",
    pollSeconds: 15,
    timeoutMs: 8000,
    onChange: (s) => snaps.push(s),
    fetchImpl: fetchImpl as unknown as typeof fetch,
    storage: memoryStorage(),
    ...extra,
  });
  return { poller, calls, snaps, fetchImpl };
}

describe("BoardPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends the token and display id as headers, never in the URL", async () => {
    const { poller, calls, fetchImpl } = setup([async () => json(fixture)]);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://nexus.example/api/display/board");
    expect(calls[0].headers).toMatchObject({ Authorization: "Bearer tok-1", "X-Display-Id": "office-main" });
    expect(poller.snapshot.board?.projects).toHaveLength(20);
    poller.stop();
  });

  it("polls every pollSeconds with one request in flight", async () => {
    const { poller, fetchImpl } = setup([async () => json(fixture)]);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    poller.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("keeps the last payload and backs off 15/30/60/120 s on failure", async () => {
    const fail = async () => {
      throw new TypeError("network");
    };
    const { poller, fetchImpl } = setup([async () => json(fixture), fail, fail, fail, fail, fail, fail]);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    const board = poller.snapshot.board;
    await vi.advanceTimersByTimeAsync(15_000); // fail 1
    expect(poller.snapshot.failures).toBe(1);
    await vi.advanceTimersByTimeAsync(15_000); // fail 2
    await vi.advanceTimersByTimeAsync(30_000); // fail 3
    await vi.advanceTimersByTimeAsync(60_000); // fail 4
    expect(poller.snapshot.failures).toBe(4);
    expect(poller.snapshot.board).toBe(board);
    expect(poller.snapshot.reason).toBe("Nexus unreachable");
    await vi.advanceTimersByTimeAsync(119_999);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    poller.stop();
    expect(backoffMs(15, 9)).toBe(120_000);
  });

  it("restores the last good payload from storage on boot", async () => {
    const storage = memoryStorage();
    storage.setItem(storageKey("office-main"), JSON.stringify({ receivedAt: 123, payload: fixture }));
    const { poller } = setup([async () => new Promise<Response>(() => {})], { storage });
    expect(poller.snapshot).toMatchObject({ receivedAt: 123, restored: true });
    expect(poller.snapshot.board?.projects).toHaveLength(20);
  });

  it("honors Retry-After on 429 without counting toward offline", async () => {
    const { poller, fetchImpl } = setup([async () => json({}, 429, { "Retry-After": "42" }), async () => json(fixture)]);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.snapshot).toMatchObject({ failures: 0, reason: "Rate limited by Nexus" });
    await vi.advanceTimersByTimeAsync(41_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("re-reads config once on 401 and retries with a rotated token", async () => {
    const reloadToken = vi.fn(async () => "tok-2");
    const { poller, calls } = setup([async () => json({}, 401), async () => json(fixture)], { reloadToken });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(reloadToken).toHaveBeenCalledOnce();
    expect(calls[1].headers).toMatchObject({ Authorization: "Bearer tok-2" });
    expect(poller.snapshot.reason).toBeUndefined();
    poller.stop();
  });

  it("shows 'Display token rejected' and rate-limits config re-reads to one per 10 minutes", async () => {
    const reloadToken = vi.fn(async () => "tok-1");
    const { poller } = setup([async () => json({}, 401)], { reloadToken });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.snapshot).toMatchObject({ reason: "Display token rejected", failures: 0 });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(reloadToken).toHaveBeenCalledOnce();
    poller.stop();
  });

  it("treats a timeout as a failure", async () => {
    const { poller } = setup([
      async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    ]);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.snapshot).toMatchObject({ failures: 1, reason: "Nexus timed out" });
    poller.stop();
  });
});
