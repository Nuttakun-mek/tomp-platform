// Which clock-in and clock-out rows belong to a job's working day.
//
// A shift used to be "whatever the driver did in the last 18 hours". A driver
// who clocked in at 17:56 and never clocked out was still "on duty since
// 17:56 yesterday" at the next morning's pre-start check: the phone showed
// yesterday's time and greyed out "เริ่มปฏิบัติงาน", and the control room
// card said the same. The working day is the job's own day in Bangkok, from
// midnight, running on to noon the next day so a late job can clock out after
// midnight.

import { bangkokDayOf } from "./driver-current-job";

const RUNS_PAST_MIDNIGHT_MS = 36 * 60 * 60 * 1000;

export function workDayWindow(anchor: string | null | undefined, now = new Date()): { start: number; end: number } {
  const day = bangkokDayOf(anchor ? new Date(anchor) : now);
  const start = Date.parse(`${day}T00:00:00+07:00`);
  return { start, end: start + RUNS_PAST_MIDNIGHT_MS };
}

export function inWorkDay(at: string | null | undefined, window: { start: number; end: number }) {
  if (!at) return false;
  const ms = Date.parse(at);
  return Number.isFinite(ms) && ms >= window.start && ms < window.end;
}
