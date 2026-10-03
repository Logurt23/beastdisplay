import { addDays, dayDiff, weekMonday, zonedDate, zonedTime } from "../../core/tz";

/** The EMM board always shows America/Chicago, whatever the TV's own timezone is. */
export const EMM_TZ = "America/Chicago";

/** Chicago calendar date of an instant, YYYY-MM-DD. */
export const chicagoDate = (instant: number | Date | string = Date.now()) => zonedDate(instant, EMM_TZ);
export const chicagoTime = (instant: number | Date | string) => zonedTime(instant, EMM_TZ);

export { addDays, dayDiff, weekMonday };
