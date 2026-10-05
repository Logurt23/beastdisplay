import type { CSSProperties } from "react";
import { DUE_COLORS } from "../due";
import { useChangedFlag } from "../hooks";
import { assigneeLoad, dueBuckets, filterTiles, projectsByStatus } from "../stats";
import type { Board, PulseTile } from "../types";
import styles from "../styles/emm.module.css";
import { STATUS_COLOR, STATUS_WORD } from "./labels";
import { Panel } from "./Panel";
import { projectsToday } from "../board";
import { DueToday } from "./DueToday";
import { Lanes } from "./Lanes";
import { Ticker } from "./Ticker";

const TONE_COLOR: Record<PulseTile["tone"], string> = {
  up: "var(--good)",
  down: "var(--hot)",
  flat: "var(--muted)",
  unknown: "var(--muted)",
};
const TONE_GLYPH: Record<PulseTile["tone"], string> = { up: "▲", down: "▼", flat: "■", unknown: "" };

const BUCKET_WORD = { overdue: "Overdue", today: "Today", soon: "Soon", scheduled: "Sched.", later: "Later", none: "None", done: "Done" } as const;

/**
 * Section 6A, reworked 2026-10-05 from the office whiteboard: Projects today
 * (open work not in Pending, from the board) on the left, who's on what (one lane per person) in the middle, due today on
 * the right, ticker underneath. Tone comes from `tone` only.
 */
export function PulsePanel({ board, today, lobbyMode, reduced }: { board: Board; today: string; lobbyMode: boolean; reduced: boolean }) {
  const pt = projectsToday(board.projects, today);
  return (
    <Panel title="Pulse" className={styles.pulse}>
      <div className={styles.pulseGrid}>
        <div className={styles.pulseTiles}>
          <Tile
            tile={{
              id: "projects_today",
              label: "Projects today",
              value: pt.count,
              display: String(pt.count),
              delta: null,
              deltaLabel: `${pt.dueToday} due today`,
              tone: "unknown",
              source: "board",
            }}
          />
        </div>
        <Lanes projects={board.projects} today={today} lobbyMode={lobbyMode} />
        <DueToday projects={board.projects} today={today} lobbyMode={lobbyMode} />
      </div>
      {lobbyMode ? null : <Ticker items={board.pulse.ticker} reduced={reduced} />}
    </Panel>
  );
}

/** Mothership tiles (leads today), or an honest "not connected" when Nexus has none. */
function MothershipTiles({ board }: { board: Board }) {
  const { shown } = filterTiles(board.pulse.tiles);
  const status = board.pulse.sourceStatus;
  if (status === "live" && shown.length > 0) return <>{shown.map((t) => <Tile key={t.id} tile={t} />)}</>;
  return (
    <div className={`${styles.tile} ${styles.tileEmpty}`}>
      <div className={styles.tileEmptyTitle}>{status === "error" ? "Mothership error" : "Mothership not connected"}</div>
      <div className={styles.tileEmptyDetail}>
        {status === "error" ? "Nexus could not reach Mothership." : "Pulse not configured in Nexus. No numbers rather than zeros."}
      </div>
    </div>
  );
}

/** Mothership tiles plus current stats 4 to 6 as tiles (projects by status, due buckets, open per person). Used on the pulse layout. */
export function StatsStrip({ board, today }: { board: Board; today: string }) {
  const byStatus = projectsByStatus(board.projects);
  const buckets = dueBuckets(board.projects, today);
  const load = assigneeLoad(board.projects).slice(0, 6);
  const maxLoad = Math.max(1, ...load.map((r) => r.open));
  return (
    <Panel title="Board stats">
      <div className={styles.tiles}>
        <MothershipTiles board={board} />
        <div className={`${styles.tile} ${styles.tileWide}`} data-stat="projects_by_status">
          <div className={styles.tileLabel}>Projects by status</div>
          <div className={styles.miniGrid}>
            {byStatus.map((r) => (
              <Mini key={r.status} word={STATUS_WORD[r.status]} count={r.count} color={STATUS_COLOR[r.status]} />
            ))}
          </div>
        </div>
        <div className={`${styles.tile} ${styles.tileWide}`} data-stat="due_buckets">
          <div className={styles.tileLabel}>Due</div>
          <div className={styles.miniGrid}>
            {buckets.map((b) => (
              <Mini key={b.state} word={BUCKET_WORD[b.state]} count={b.count} color={`var(--due-${b.state}, ${DUE_COLORS[b.state]})`} />
            ))}
          </div>
        </div>
        <div className={`${styles.tile} ${styles.tileWide}`} data-stat="assignee_load">
          <div className={styles.tileLabel}>Open per person</div>
          {load.length === 0 ? (
            <div className={styles.tileEmptyDetail}>No open projects</div>
          ) : (
            <div className={styles.loadList}>
              {load.map((r) => (
                <div key={r.id} className={styles.loadRow}>
                  <span className={styles.initials}>{r.initials}</span>
                  <span className={styles.loadBar}>
                    <span style={{ width: `${(r.open / maxLoad) * 100}%` }} />
                  </span>
                  <span className={`${styles.loadCount} num`}>{r.open}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Tile({ tile }: { tile: PulseTile }) {
  const bumped = useChangedFlag(tile.value, 400);
  const style = { "--tone": TONE_COLOR[tile.tone] } as CSSProperties;
  return (
    <div className={`${styles.tile} ${bumped ? styles.bump : ""}`} style={style} data-stat={tile.id}>
      <div className={styles.tileLabel}>{tile.label}</div>
      <div className={`${styles.tileValue} num`}>{tile.display}</div>
      {tile.deltaLabel !== null || tile.delta !== null ? (
        <div className={styles.tileDelta}>
          {TONE_GLYPH[tile.tone]} {tile.deltaLabel ?? (tile.delta! > 0 ? `+${tile.delta}` : String(tile.delta))}
        </div>
      ) : null}
    </div>
  );
}

function Mini({ word, count, color }: { word: string; count: number; color: string }) {
  const bumped = useChangedFlag(count, 400);
  return (
    <div className={`${styles.mini} ${bumped ? styles.bump : ""}`} style={{ "--tone": color } as CSSProperties}>
      <div className={`${styles.miniCount} num`}>{count}</div>
      <div className={styles.miniWord}>{word}</div>
    </div>
  );
}
