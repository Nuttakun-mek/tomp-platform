// Which phone number the driver's "call the centre" button dials.
//
// The number was only ever read from `assignment.metadata` and written nowhere
// except the test seeders, so on real work the button had nothing to dial. It
// was also stored at the wrong level: a project with two hundred jobs would have
// meant typing the same number two hundred times, and changing it meant editing
// two hundred rows.
//
// So the project carries the number and an assignment may override it — which is
// what a job with its own on-site coordinator needs.

export interface ContactSource {
  coordinatorPhone?: unknown;
  coordinator_phone?: unknown;
  operationPhone?: unknown;
  operation_phone?: unknown;
}

/** Keep digits, spaces, dashes and a leading +; drop anything else. */
export function normalisePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[^\d+\-\s()]/g, "").trim();
  // A "number" with no digits in it is someone's placeholder, not a number.
  return /\d/.test(cleaned) ? cleaned : "";
}

function pick(source: ContactSource | null | undefined, camel: keyof ContactSource, snake: keyof ContactSource): string {
  if (!source) return "";
  return normalisePhone(source[camel]) || normalisePhone(source[snake]);
}

/**
 * The number to dial, most specific first: this job's own coordinator, then the
 * project's. Empty when neither is set — callers should hide the button rather
 * than offer a dead one.
 */
export function resolveCoordinatorPhone(
  assignmentMeta: ContactSource | null | undefined,
  projectMeta: ContactSource | null | undefined
): string {
  return pick(assignmentMeta, "coordinatorPhone", "coordinator_phone") || pick(projectMeta, "coordinatorPhone", "coordinator_phone");
}

/** The operations line, resolved the same way. */
export function resolveOperationPhone(
  assignmentMeta: ContactSource | null | undefined,
  projectMeta: ContactSource | null | undefined
): string {
  return pick(assignmentMeta, "operationPhone", "operation_phone") || pick(projectMeta, "operationPhone", "operation_phone");
}

/** `tel:` href for a resolved number, or null when there is nothing to dial. */
export function telHref(phone: string): string | null {
  const dialable = phone.replace(/[^\d+]/g, "");
  return dialable.replace(/\D/g, "").length >= 4 ? `tel:${dialable}` : null;
}
