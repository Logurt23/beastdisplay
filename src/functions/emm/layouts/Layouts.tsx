import type { Board } from "../types";
import { CalendarPanel } from "../panels/Calendar";
import { DueRail } from "../panels/DueRail";
import { GoalsPanel } from "../panels/Goals";
import { ErrorBoundary } from "../../../core/ErrorBoundary";
import { Empty } from "../panels/Panel";
import { ProjectsPanel } from "../panels/Projects";
import { PulsePanel, StatsStrip } from "../panels/Pulse";
import { StagePanel } from "../panels/Stage";
import type { EmmLayout } from "../meta";
import type { ReactNode } from "react";
import styles from "../styles/emm.module.css";

export interface LayoutProps {
  board: Board;
  today: string;
  lobbyMode: boolean;
  reduced: boolean;
}

/** One panel failing never blanks the board. Resets on the next payload. */
function Guard({ board, children }: { board: Board; children: ReactNode }) {
  return (
    <ErrorBoundary resetKey={board} fallback={<Empty title="Panel unavailable" detail="Retrying on the next update." />}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * War room, reworked 2026-10-05 to match the office whiteboard:
 * Pulse (who's on what + due today) on top; Edits, Push live and Pending in the
 * middle; calendar and goals along the bottom.
 */
function Warroom(p: LayoutProps) {
  const common = { projects: p.board.projects, today: p.today, lobbyMode: p.lobbyMode };
  return (
    <div className={styles.warroom}>
      <div className={styles.areaPulse}><Guard board={p.board}><PulsePanel {...p} /></Guard></div>
      <div className={styles.areaEdits}><Guard board={p.board}><StagePanel stage="edits" {...common} /></Guard></div>
      <div className={styles.areaLaunch}><Guard board={p.board}><StagePanel stage="launch" {...common} offsetMs={3_000} /></Guard></div>
      <div className={styles.areaPending}><Guard board={p.board}><StagePanel stage="pending" columns={2} {...common} offsetMs={6_000} /></Guard></div>
      <div className={styles.areaCalendar}><Guard board={p.board}><CalendarPanel board={p.board} today={p.today} lobbyMode={p.lobbyMode} /></Guard></div>
      <div className={styles.areaGoals}><Guard board={p.board}><GoalsPanel goals={p.board.goals} reduced={p.reduced} perPage={2} /></Guard></div>
    </div>
  );
}

function ProjectsLayout(p: LayoutProps) {
  return (
    <div className={styles.split6040}>
      <Guard board={p.board}><ProjectsPanel projects={p.board.projects} today={p.today} lobbyMode={p.lobbyMode} /></Guard>
      <Guard board={p.board}><DueRail projects={p.board.projects} today={p.today} /></Guard>
    </div>
  );
}

function PulseLayout(p: LayoutProps) {
  return (
    <div className={styles.pulseLayout}>
      <Guard board={p.board}><PulsePanel {...p} /></Guard>
      <Guard board={p.board}><StatsStrip board={p.board} today={p.today} /></Guard>
    </div>
  );
}

function GoalsLayout(p: LayoutProps) {
  return (
    <div className={styles.goalsLayout}>
      <Guard board={p.board}><GoalsPanel goals={p.board.goals} reduced={p.reduced} perPage={6} /></Guard>
      <Guard board={p.board}><CalendarPanel board={p.board} today={p.today} lobbyMode={p.lobbyMode} /></Guard>
    </div>
  );
}

export const LAYOUTS: Record<EmmLayout, (p: LayoutProps) => ReactNode> = {
  warroom: Warroom,
  projects: ProjectsLayout,
  pulse: PulseLayout,
  goals: GoalsLayout,
};
