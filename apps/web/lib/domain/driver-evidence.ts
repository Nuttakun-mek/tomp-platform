// A check-in photo is taken by a person, not by a job.
//
// The photos are stored per assignment because that is the row the driver was
// looking at when the camera opened, but a driver working four jobs in a day
// checks in once. Indexing the display by assignment meant the control room saw
// the photo on whichever job happened to carry it — usually the first one the
// driver opened — and nothing on the rest.

export interface EvidenceLike {
  assignmentId: string;
  driverId?: string | null;
  at: string;
}

const timeOf = (value: string) => {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Newest check-in per driver, from check-ins keyed by assignment. Entries with
 * no driver are skipped: they belong to unassigned work, which is still shown
 * against its own job.
 */
export function latestEvidenceByDriver<T extends EvidenceLike>(evidence: Record<string, T>): Map<string, T> {
  const byDriver = new Map<string, T>();
  for (const entry of Object.values(evidence)) {
    const driverId = entry.driverId;
    if (!driverId) continue;
    const held = byDriver.get(driverId);
    if (!held || timeOf(entry.at) > timeOf(held.at)) byDriver.set(driverId, entry);
  }
  return byDriver;
}
