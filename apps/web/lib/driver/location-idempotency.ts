const CLIENT_EVENT_ID_MAX_LENGTH = 120;
const CLIENT_EVENT_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

export function normalizeLocationClientEventId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CLIENT_EVENT_ID_MAX_LENGTH) return null;
  if (!CLIENT_EVENT_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function extractLocationClientEventId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return normalizeLocationClientEventId((metadata as Record<string, unknown>).clientEventId);
}

export function isDuplicateLocationClientEventError(error: unknown): boolean {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : "";
  const message =
    typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : "";
  return code === "23505" || message.includes("gps_locations_client_event_id_unique");
}
