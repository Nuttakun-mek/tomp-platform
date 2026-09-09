// The one place that decides what order a driver works through their jobs, and
// which one is "next". Both the driver's QR page and the centre's fleet board
// read this, so the two never disagree.
//
// Order: the job in progress first, then anything the centre flagged urgent
// (inserted work), then the rest by planned start time. Completed and cancelled
// sink to the bottom. An explicit sequence set by the centre wins within a tier.

export interface DriverJobInput {
  id: string;
  status: string;
  /** ISO or null. */
  startTime: string | null;
  /** ISO or null — tiebreaker when there is no start time. */
  createdAt: string | null;
  /** metadata.sequence from the centre, or null. */
  sequence: number | null;
  urgent: boolean;
  isCurrent: boolean;
}

export interface OrderedDriverJob extends DriverJobInput {
  /** 1-based position in the worked order. */
  order: number;
  /** The job to head to after the current one. */
  isNext: boolean;
}

export function isUrgentMeta(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  return meta.urgent === true || meta.priority === "urgent" || meta.priority === "high";
}

function tier(job: DriverJobInput): number {
  if (job.status === "completed") return 40;
  if (job.status === "cancelled") return 50;
  if (job.isCurrent) return 0;
  if (job.urgent) return 5;
  return 10;
}

const toMs = (iso: string | null, fallback: number) => (iso ? new Date(iso).getTime() : fallback);

export function orderDriverJobs(jobs: DriverJobInput[]): OrderedDriverJob[] {
  const sorted = [...jobs].sort((a, b) => {
    const tierDelta = tier(a) - tier(b);
    if (tierDelta !== 0) return tierDelta;

    const seqA = a.sequence ?? Number.POSITIVE_INFINITY;
    const seqB = b.sequence ?? Number.POSITIVE_INFINITY;
    if (seqA !== seqB) return seqA - seqB;

    const startA = toMs(a.startTime, Number.POSITIVE_INFINITY);
    const startB = toMs(b.startTime, Number.POSITIVE_INFINITY);
    if (startA !== startB) return startA - startB;

    return toMs(a.createdAt, 0) - toMs(b.createdAt, 0);
  });

  const nextIndex = sorted.findIndex((job) => !job.isCurrent && tier(job) < 40);

  return sorted.map((job, index) => ({ ...job, order: index + 1, isNext: index === nextIndex }));
}
