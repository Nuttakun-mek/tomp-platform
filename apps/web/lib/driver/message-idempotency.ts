const CLIENT_EVENT_ID_MAX_LENGTH = 120;
const CLIENT_EVENT_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

export function normalizeDriverMessageClientEventId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CLIENT_EVENT_ID_MAX_LENGTH) return null;
  if (!CLIENT_EVENT_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function extractDriverMessageClientEventId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return normalizeDriverMessageClientEventId((metadata as Record<string, unknown>).clientEventId);
}

export function createDriverMessageClientEventId(kind: "message" | "issue", now = new Date()): string {
  const compactTime = now.toISOString().replace(/[^0-9TZ]/g, "");
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `driver-${kind}:${compactTime}:${randomPart}`;
}
