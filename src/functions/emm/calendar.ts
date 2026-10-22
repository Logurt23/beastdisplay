import { addDays, monthDay, weekdayShort, zonedDate, zonedTime } from "../../core/tz";
import { dueState, worstDue, type DueState } from "./due";
import { EMM_TZ, weekMonday } from "./time";
import type { CalendarEvent, Project } from "./types";

export interface DayEvent {
  id: string;
  title: string;
  /** Chicago HH:mm on the start day; "cont." when continued from a prior day. */
  time: string;
  kind: string | null;
  continued: boolean;
}

export interface Day {
  date: string;
  weekday: string;
  label: string;
  isToday: boolean;
  events: DayEvent[];
  dueCount: number;
  dueWorst: DueState | null;
}

const HOUR = 3_600_000;

/**
 * Seven-day strip, Monday start, the Chicago week containing today.
 * Events land on the Chicago date of startsAt; an event crossing Chicago
 * midnight also appears on each later day it covers, marked continued.
 * Missing endsAt is treated as startsAt + 60 min for placement only.
 */
export function buildWeek(today: string, projects: readonly Project[], events: readonly CalendarEvent[]): Day[] {
  const monday = weekMonday(today);
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, weekday: weekdayShort(date), label: monthDay(date), isToday: date === today, events: [], dueCount: 0, dueWorst: null };
  });
  const index = new Map(days.map((d, i) => [d.date, i]));

  const sorted = [...events].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (const ev of sorted) {
    const start = Date.parse(ev.startsAt);
    let end = ev.endsAt ? Date.parse(ev.endsAt) : start + HOUR;
    if (!(end > start)) end = start + HOUR;
    const first = zonedDate(start, EMM_TZ);
    // Last instant covered is end - 1 ms, so an event ending exactly at midnight stays on one day.
    const last = zonedDate(end - 1, EMM_TZ);
    for (let d = first, guard = 0; d <= last && guard < 60; d = addDays(d, 1), guard++) {
      const i = index.get(d);
      if (i === undefined) continue;
      const continued = d !== first;
      days[i].events.push({ id: ev.id, title: ev.title, time: continued ? "cont." : zonedTime(start, EMM_TZ), kind: ev.kind, continued });
    }
  }

  const states = new Map<number, DueState[]>();
  for (const p of projects) {
    if (!p.dueOn) continue;
    const i = index.get(p.dueOn);
    if (i === undefined) continue;
    days[i].dueCount += 1;
    const list = states.get(i) ?? [];
    list.push(dueState(p.dueOn, p.status, today).state);
    states.set(i, list);
  }
  for (const [i, list] of states) {
    // Done markers count, but never set the color unless every marker that day is done.
    const open = list.filter((s) => s !== "done");
    days[i].dueWorst = worstDue(open.length > 0 ? open : list);
  }
  return days;
}
