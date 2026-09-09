// A driver cannot be in two places at once. When the centre gives one driver two
// jobs whose planned windows overlap, that is almost always a mistake — surface
// it on the dispatch board before the day starts.

export interface SchedulableAssignment {
  id: string;
  driverId: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
}

export interface TimeConflict {
  driverId: string;
  a: string;
  b: string;
}

const IGNORED = new Set(["cancelled", "archived", "completed"]);

function windowOf(a: SchedulableAssignment): [number, number] | null {
  if (!a.startTime) return null;
  const start = new Date(a.startTime).getTime();
  if (Number.isNaN(start)) return null;
  const end = a.endTime ? new Date(a.endTime).getTime() : start + 60 * 60 * 1000; // assume 1h when open-ended
  return [start, Number.isNaN(end) ? start + 60 * 60 * 1000 : Math.max(end, start)];
}

export function findDriverTimeConflicts(assignments: SchedulableAssignment[]): TimeConflict[] {
  const byDriver = new Map<string, SchedulableAssignment[]>();
  for (const assignment of assignments) {
    if (!assignment.driverId || IGNORED.has(assignment.status)) continue;
    const list = byDriver.get(assignment.driverId) ?? [];
    list.push(assignment);
    byDriver.set(assignment.driverId, list);
  }

  const conflicts: TimeConflict[] = [];
  for (const [driverId, list] of byDriver) {
    const windows = list
      .map((assignment) => ({ id: assignment.id, window: windowOf(assignment) }))
      .filter((entry): entry is { id: string; window: [number, number] } => entry.window !== null)
      .sort((x, y) => x.window[0] - y.window[0]);

    for (let i = 0; i < windows.length - 1; i += 1) {
      for (let j = i + 1; j < windows.length; j += 1) {
        if (windows[j].window[0] >= windows[i].window[1]) break; // sorted — no later window can overlap
        conflicts.push({ driverId, a: windows[i].id, b: windows[j].id });
      }
    }
  }
  return conflicts;
}
