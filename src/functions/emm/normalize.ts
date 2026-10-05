import { parseYmd } from "../../core/tz";
import type {
  Assignee,
  Board,
  CalendarEvent,
  Goal,
  Priority,
  Project,
  ProjectStatus,
  PulseTile,
  SourceStatus,
  Stage,
  TickerItem,
  Tone,
} from "./types";

/**
 * Defensive reader for the board payload (Fable report 2.11). Never throws on a
 * bad record: unknown words render muted, missing arrays read as [], and a
 * record with no id is dropped (it cannot be keyed or animated).
 */

const STATUSES: readonly ProjectStatus[] = ["queued", "active", "waiting", "review", "blocked", "done"];
const PRIORITIES: readonly Priority[] = ["low", "normal", "high", "rush"];
const TONES: readonly Tone[] = ["up", "down", "flat"];
const STAGES: readonly Stage[] = ["development", "edits", "launch", "pending"];

/** Stage when Nexus sends none: waiting reads as pending, review as edits, the rest as development. */
export function deriveStage(status: Project["status"]): Stage {
  if (status === "waiting") return "pending";
  if (status === "review") return "edits";
  return "development";
}

const SOURCE_STATUSES: readonly SourceStatus[] = ["live", "unconfigured", "error"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

/** Dedupe by id, keeping the last occurrence (report 3.5, Projects edge cases). */
function dedupe<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const it of items) {
    map.delete(it.id);
    map.set(it.id, it);
  }
  return [...map.values()];
}

function tile(v: unknown): PulseTile | null {
  if (!isObj(v)) return null;
  const id = s(v.id);
  if (!id) return null;
  const value = n(v.value) ?? 0;
  const tone = TONES.includes(v.tone as Tone) ? (v.tone as Tone) : "unknown";
  return {
    id,
    label: s(v.label) ?? id,
    value,
    display: s(v.display) ?? String(value),
    delta: n(v.delta),
    deltaLabel: s(v.deltaLabel),
    tone,
    source: s(v.source) ?? "unknown",
  };
}

function tickerItem(v: unknown): TickerItem | null {
  if (!isObj(v)) return null;
  const id = s(v.id);
  const text = s(v.text);
  if (!id || !text) return null;
  return { id, at: iso(v.at) ?? "", text, tone: s(v.tone) ?? "info" };
}

function assignee(v: unknown): Assignee | null {
  if (!isObj(v)) return null;
  const name = s(v.name);
  if (!name) return null;
  const initials =
    s(v.initials) ??
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return { id: s(v.id) ?? name, name, initials };
}

function project(v: unknown): Project | null {
  if (!isObj(v)) return null;
  const id = s(v.id);
  if (!id) return null;
  const known = STATUSES.includes(v.status as ProjectStatus);
  const dueOn = parseYmd(v.dueOn) ? (v.dueOn as string) : null;
  const status = known ? (v.status as ProjectStatus) : "unknown";
  const rank = typeof v.rank === "number" && Number.isInteger(v.rank) && v.rank > 0 ? v.rank : null;
  return {
    id,
    name: s(v.name) ?? "Untitled",
    client: s(v.client),
    status: known ? (v.status as ProjectStatus) : "unknown",
    ...(known ? {} : { rawStatus: s(v.status) ?? undefined }),
    priority: PRIORITIES.includes(v.priority as Priority) ? (v.priority as Priority) : "normal",
    assignee: assignee(v.assignee),
    dueOn,
    lobbySafe: v.lobbySafe === true,
    stage: STAGES.includes(v.stage as Stage) ? (v.stage as Stage) : deriveStage(status),
    rank,
  };
}

function event(v: unknown): CalendarEvent | null {
  if (!isObj(v)) return null;
  const id = s(v.id);
  const startsAt = iso(v.startsAt);
  if (!id || !startsAt) return null;
  return { id, title: s(v.title) ?? "Event", startsAt, endsAt: iso(v.endsAt), kind: s(v.kind) };
}

function goal(v: unknown): Goal | null {
  if (!isObj(v)) return null;
  const id = s(v.id);
  const current = n(v.current);
  const target = n(v.target);
  if (!id || current === null || target === null) return null;
  return {
    id,
    name: s(v.name) ?? id,
    current,
    target,
    unit: s(v.unit) ?? "",
    goodDirection: v.goodDirection === "down" ? "down" : "up",
    updatedAt: iso(v.updatedAt),
  };
}

const keep = <T,>(fn: (v: unknown) => T | null) => (list: unknown) =>
  arr(list)
    .map(fn)
    .filter((x): x is T => x !== null);

export function normalizeBoard(raw: unknown): Board {
  const r = isObj(raw) ? raw : {};
  const pulse = isObj(r.pulse) ? r.pulse : {};
  const tiles = dedupe(keep(tile)(pulse.tiles));
  const declared = SOURCE_STATUSES.includes(pulse.sourceStatus as SourceStatus)
    ? (pulse.sourceStatus as SourceStatus)
    : null;
  return {
    generatedAt: iso(r.generatedAt),
    timezone: s(r.timezone) ?? "America/Chicago",
    staleAfterSeconds: n(r.staleAfterSeconds) ?? 60,
    pulse: {
      tiles,
      ticker: dedupe(keep(tickerItem)(pulse.ticker)),
      // Missing sourceStatus with no tiles reads as "not connected", never as zero.
      sourceStatus: declared ?? (tiles.length > 0 ? "live" : "unconfigured"),
    },
    projects: dedupe(keep(project)(r.projects)),
    events: dedupe(keep(event)(r.events)),
    goals: dedupe(keep(goal)(r.goals)),
    fixture: "_fixture" in r || "_seed" in r || r.seed === true,
  };
}
