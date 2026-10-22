/**
 * Git activity for the Pulse ticker (Logan, 2026-10-05): releases, merges,
 * pushes and tags from the team's GitHub repos, newest first, at most 15.
 *
 * Runs inside Nexus, so the GitHub token never reaches the display. Each repo's
 * events are cached for `ttlMs` and re-fetched with If-None-Match, so the board
 * route can be polled every 15 s by every display without spending the GitHub
 * rate limit. A repo that fails keeps its last good events.
 */

const API = "https://api.github.com";

/**
 * @param {{
 *   repos: string[],                       // "owner/name"
 *   token?: string,                        // fine-grained token with read access; optional for public repos
 *   people?: Record<string, string>,       // GitHub login -> name shown on the board
 *   max?: number,
 *   ttlMs?: number,
 *   fetchImpl?: typeof fetch,
 *   now?: () => number,
 * }} opts
 * @returns {() => Promise<Array<{ id: string, at: string, text: string, tone: string }>>}
 */
export function createGitActivity({ repos, token, people = {}, max = 15, ttlMs = 60_000, fetchImpl = fetch, now = Date.now }) {
  /** @type {Map<string, { at: number, etag: string | null, items: any[] }>} */
  const cache = new Map();

  async function repoEvents(repo) {
    const hit = cache.get(repo);
    if (hit && now() - hit.at < ttlMs) return hit.items;
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "beastdisplay-nexus", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (hit?.etag) headers["If-None-Match"] = hit.etag;
    try {
      const res = await fetchImpl(`${API}/repos/${repo}/events?per_page=30`, { headers });
      if (res.status === 304 && hit) {
        hit.at = now();
        return hit.items;
      }
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      const items = (await res.json()).map((e) => toItem(e, repo, people)).filter(Boolean);
      cache.set(repo, { at: now(), etag: res.headers.get("etag"), items });
      return items;
    } catch {
      if (hit) hit.at = now(); // back off for one ttl, keep showing the last good events
      return hit?.items ?? [];
    }
  }

  return async function gitActivity() {
    const all = (await Promise.all(repos.map(repoEvents))).flat();
    return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, max);
  };
}

/** GITHUB_TOKEN, GITHUB_REPOS ("owner/a,owner/b"), GITHUB_PEOPLE ("login:Name,login:Name"). */
export function gitActivityFromEnv(env = process.env) {
  const repos = (env.GITHUB_REPOS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (repos.length === 0) return async () => [];
  const people = Object.fromEntries(
    (env.GITHUB_PEOPLE ?? "")
      .split(",")
      .map((pair) => pair.split(":").map((s) => s.trim()))
      .filter(([login, name]) => login && name),
  );
  return createGitActivity({ repos, token: env.GITHUB_TOKEN || undefined, people });
}

const short = (repo) => repo.split("/").pop();
const firstLine = (s) => String(s ?? "").split("\n")[0].trim();

/** One GitHub event as a ticker item, or null for events the board does not show. */
export function toItem(e, repo, people = {}) {
  const who = people[e.actor?.login] ?? e.actor?.display_login ?? e.actor?.login ?? "Someone";
  const p = e.payload ?? {};
  const where = short(repo);
  let text = null;
  let tone = "info";
  switch (e.type) {
    case "ReleaseEvent":
      if (p.action === "published" || p.action === "released") {
        text = `${who} released ${p.release?.name || p.release?.tag_name} · ${where}`;
        tone = "good";
      }
      break;
    case "PullRequestEvent":
      if (p.action === "closed" && p.pull_request?.merged) {
        text = `${who} merged #${p.number} ${firstLine(p.pull_request.title)} · ${where}`;
        tone = "good";
      } else if (p.action === "opened") {
        text = `${who} opened #${p.number} ${firstLine(p.pull_request?.title)} · ${where}`;
      }
      break;
    case "PushEvent": {
      const branch = String(p.ref ?? "").replace(/^refs\/heads\//, "");
      const n = p.size ?? p.commits?.length ?? 0;
      const msg = firstLine(p.commits?.[p.commits.length - 1]?.message);
      text = n > 0
        ? `${who} pushed ${n} commit${n === 1 ? "" : "s"} to ${branch}${msg ? `: ${msg}` : ""} · ${where}`
        : `${who} pushed to ${branch} · ${where}`;
      break;
    }
    case "CreateEvent":
      if (p.ref_type === "tag") {
        text = `${who} tagged ${p.ref} · ${where}`;
        tone = "good";
      } else if (p.ref_type === "repository") {
        text = `${who} created ${where}`;
      }
      break;
    default:
      break;
  }
  if (!text || !e.id || !e.created_at) return null;
  return { id: `gh_${e.id}`, at: e.created_at, text, tone };
}
