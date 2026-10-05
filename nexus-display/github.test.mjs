// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createGitActivity, gitActivityFromEnv, toItem } from "./github.mjs";

const actor = { login: "octo", display_login: "octo" };
const ev = (id, type, created_at, payload) => ({ id: String(id), type, created_at, actor, payload });

const res = (status, body, etag = null) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
  headers: { get: (h) => (h.toLowerCase() === "etag" ? etag : null) },
});

describe("toItem", () => {
  it("words releases, merges, pushes and tags; skips the rest", () => {
    const people = { octo: "Logan" };
    expect(toItem(ev(1, "ReleaseEvent", "2026-10-05T10:00:00Z", { action: "published", release: { tag_name: "v1.4.0" } }), "o/site", people))
      .toEqual({ id: "gh_1", at: "2026-10-05T10:00:00Z", text: "Logan released v1.4.0 · site", tone: "good" });
    expect(toItem(ev(2, "PullRequestEvent", "2026-10-05T10:00:00Z", { action: "closed", number: 7, pull_request: { merged: true, title: "Add hero\nbody" } }), "o/site", people)?.text)
      .toBe("Logan merged #7 Add hero · site");
    expect(toItem(ev(3, "PullRequestEvent", "2026-10-05T10:00:00Z", { action: "closed", number: 8, pull_request: { merged: false, title: "x" } }), "o/site")).toBeNull();
    expect(toItem(ev(4, "PushEvent", "2026-10-05T10:00:00Z", { ref: "refs/heads/main", size: 2, commits: [{ message: "a" }, { message: "Fix nav\n\nmore" }] }), "o/site")?.text)
      .toBe("octo pushed 2 commits to main: Fix nav · site");
    expect(toItem(ev(5, "PushEvent", "2026-10-05T10:00:00Z", { ref: "refs/heads/dev" }), "o/site")?.text).toBe("octo pushed to dev · site");
    expect(toItem(ev(6, "CreateEvent", "2026-10-05T10:00:00Z", { ref_type: "tag", ref: "v2" }), "o/site")?.tone).toBe("good");
    expect(toItem(ev(7, "WatchEvent", "2026-10-05T10:00:00Z", {}), "o/site")).toBeNull();
  });
});

describe("createGitActivity", () => {
  it("merges repos newest first, caps at max, and caches within the ttl", async () => {
    let t = 0;
    const a = Array.from({ length: 10 }, (_, i) => ev(`a${i}`, "PushEvent", `2026-10-05T10:${String(i).padStart(2, "0")}:00Z`, { ref: "main" }));
    const b = Array.from({ length: 10 }, (_, i) => ev(`b${i}`, "PushEvent", `2026-10-05T11:${String(i).padStart(2, "0")}:00Z`, { ref: "main" }));
    const fetchImpl = vi.fn(async (url) => res(200, url.includes("/o/a/") ? a : b, '"e1"'));
    const git = createGitActivity({ repos: ["o/a", "o/b"], fetchImpl, now: () => t });
    const items = await git();
    expect(items).toHaveLength(15);
    expect(items[0].id).toBe("gh_b9");
    expect(items.at(-1).id).toBe("gh_a5");
    await git();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    t = 61_000;
    await git();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[2][1].headers["If-None-Match"]).toBe('"e1"');
  });

  it("keeps the last good events when GitHub fails or says not modified", async () => {
    let t = 0;
    let mode = "ok";
    const fetchImpl = async () =>
      mode === "ok" ? res(200, [ev(1, "PushEvent", "2026-10-05T10:00:00Z", { ref: "main" })]) : mode === "304" ? res(304, null) : res(500, null);
    const git = createGitActivity({ repos: ["o/a"], token: "t", fetchImpl, now: () => t });
    expect(await git()).toHaveLength(1);
    mode = "500";
    t = 61_000;
    expect(await git()).toHaveLength(1);
    mode = "304";
    t = 200_000;
    expect(await git()).toHaveLength(1);
  });

  it("returns nothing when no repos are configured", async () => {
    expect(await gitActivityFromEnv({})()).toEqual([]);
  });
});
