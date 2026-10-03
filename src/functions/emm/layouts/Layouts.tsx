import type { Board } from "../types";
import { CalendarPanel } from "../panels/Calendar";
import { DueRail } from "../panels/DueRail";
import { GoalsPanel } from "../panels/Goals";
import { ErrorBoundary } from "../../../core/ErrorBoundary";
import { Empty } from "../panels/Panel";
import { ProjectsPanel } from "../panels/Projects";
import { PulsePanel } from "../panels/Pulse";
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

/** Section 9 grid at 1080p: pulse top 38%; projects 60% / due 40%; calendar and goals share the bottom 28%. */
function Warroom(p: LayoutProps) {
  return (
    <div className={styles.warroom}>
      <div className={styles.areaPulse}><Guard board={p.board}><PulsePanel {...p} /></Guard></div>
      <div className={styles.areaProjects}><Guard board={p.board}><ProjectsPanel projects={p.board.projects} today={p.today} lobbyMode={p.lobbyMode} /></Guard></div>
      <div className={styles.areaDue}><Guard board={p.board}><DueRail projects={p.board.projects} today={p.today} /></Guard></div>
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
    <div className={styles.single}>
      <Guard board={p.board}><PulsePanel {...p} /></Guard>
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
