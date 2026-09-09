export const BRIDGE_VERSION = 1;
export const BRIDGE_NAMESPACE = "tomp.driver";

export type BridgeMessage =
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "gps.start"; payload?: { reason?: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "gps.stop"; payload?: { reason?: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "open.url"; payload: { url: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "mobile-session.set"; payload: { session: string; expiresAt: string } };

export type NativeStatus =
  | "shell_ready"
  | "session_ready"
  | "session_missing"
  | "gps_starting"
  | "gps_sharing"
  | "gps_stopped"
  | "gps_error"
  | "navigation_blocked";

export interface NativeStatusMessage {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  type: "native.status";
  payload: {
    status: NativeStatus;
    message: string;
    canBackgroundLocation: boolean;
    recordedAt: string;
    detail?: Record<string, unknown>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.namespace !== BRIDGE_NAMESPACE || parsed.version !== BRIDGE_VERSION) return null;

  if (parsed.type === "gps.start" || parsed.type === "gps.stop") {
    return parsed as BridgeMessage;
  }

  if (parsed.type === "open.url" && isRecord(parsed.payload) && typeof parsed.payload.url === "string") {
    return parsed as BridgeMessage;
  }

  if (
    parsed.type === "mobile-session.set" &&
    isRecord(parsed.payload) &&
    typeof parsed.payload.session === "string" &&
    typeof parsed.payload.expiresAt === "string"
  ) {
    return parsed as BridgeMessage;
  }

  return null;
}

export function buildNativeStatusMessage(
  status: NativeStatus,
  message: string,
  detail?: Record<string, unknown>
): NativeStatusMessage {
  return {
    namespace: BRIDGE_NAMESPACE,
    version: BRIDGE_VERSION,
    type: "native.status",
    payload: {
      status,
      message,
      canBackgroundLocation: status !== "session_missing",
      recordedAt: new Date().toISOString(),
      detail
    }
  };
}
