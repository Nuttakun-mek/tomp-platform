// The contract between the driver Web app and the native mobile shell.
//
// It was declared three times — `apps/mobile-driver/src/bridge/protocol.ts`,
// the injected bootstrap in `apps/mobile-driver/App.tsx`, and hand-written
// shapes in two web components — so bumping BRIDGE_VERSION on one side would
// silently stop matching on the other with no type error. This is the single
// source both sides import.
//
// Keep this module DOM-free and dependency-free: React Native imports it too.
// Anything that needs a `window` takes it as a parameter.

export const BRIDGE_NAMESPACE = "tomp.driver";
export const BRIDGE_VERSION = 1;

/** CustomEvent the shell dispatches into the WebView after injecting the handle. */
export const MOBILE_SHELL_READY_EVENT = "tomp:mobile-shell-ready";
/** CustomEvent the shell dispatches for every native status change. */
export const NATIVE_STATUS_EVENT = "tomp:native-status";

export type BridgeMessageType =
  | "gps.start"
  | "gps.stop"
  // The page can ask; before this it could only wait to be told. Each driver
  // tab is a separate URL, so switching tabs remounts the page with its sharing
  // state reset to idle, while the shell is still sharing. The shell does post
  // its status on navigation, but that fires before the page's listener exists,
  // so the answer was routinely lost and the page offered "start sharing" for a
  // session already running.
  | "gps.status.request"
  | "open.url"
  | "driver.notification.unread"
  | "mobile-session.challenge"
  | "mobile-session.set";

export type BridgeMessage =
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "gps.start"; payload?: { reason?: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "gps.stop"; payload?: { reason?: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "gps.status.request"; payload?: { reason?: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "open.url"; payload: { url: string } }
  | { namespace: typeof BRIDGE_NAMESPACE; version: typeof BRIDGE_VERSION; type: "driver.notification.unread"; payload?: { count?: number } }
  | {
      namespace: typeof BRIDGE_NAMESPACE;
      version: typeof BRIDGE_VERSION;
      type: "mobile-session.challenge";
      payload: { code: string; expiresAt: string };
    }
  | {
      namespace: typeof BRIDGE_NAMESPACE;
      version: typeof BRIDGE_VERSION;
      type: "mobile-session.set";
      payload: { session: string; expiresAt: string };
    };

export type NativeStatus =
  | "shell_ready"
  | "session_ready"
  | "session_missing"
  | "gps_starting"
  | "gps_sharing"
  | "gps_stopped"
  | "gps_error"
  | "navigation_blocked";

export interface NativeStatusPayload {
  status: NativeStatus;
  message: string;
  canBackgroundLocation: boolean;
  recordedAt: string;
  detail?: Record<string, unknown>;
}

export interface NativeStatusMessage {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  type: "native.status";
  payload: NativeStatusPayload;
}

/** The object the native shell injects as `window.TOMP_MOBILE_SHELL`. */
export interface MobileShellHandle {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  platform?: string;
  appVersion?: string;
  canBackgroundLocation?: boolean;
  postMessage: (message: BridgeMessage) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isMobileShell(value: unknown): value is MobileShellHandle {
  return (
    isRecord(value) &&
    value.namespace === BRIDGE_NAMESPACE &&
    value.version === BRIDGE_VERSION &&
    typeof value.postMessage === "function"
  );
}

/**
 * The shell handle for the given global, or null when the page is running in a
 * plain browser. Pass `window`; anything else returns null.
 */
export function getMobileShell(container: unknown): MobileShellHandle | null {
  if (!isRecord(container)) return null;
  const shell = (container as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL;
  return isMobileShell(shell) ? shell : null;
}

/** Payload shape per message type. `gps.*` payloads are optional. */
export interface BridgePayloadMap {
  "gps.start": { reason?: string };
  "gps.stop": { reason?: string };
  "gps.status.request": { reason?: string };
  "open.url": { url: string };
  "driver.notification.unread": { count?: number };
  "mobile-session.challenge": { code: string; expiresAt: string };
  "mobile-session.set": { session: string; expiresAt: string };
}

export function buildBridgeMessage<T extends BridgeMessageType>(
  type: T,
  payload?: BridgePayloadMap[T]
): BridgeMessage {
  return { namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type, payload } as BridgeMessage;
}

/** Parse a raw postMessage string from the WebView. Returns null when it is not ours. */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.namespace !== BRIDGE_NAMESPACE || parsed.version !== BRIDGE_VERSION) return null;

  if (parsed.type === "gps.start" || parsed.type === "gps.stop" || parsed.type === "gps.status.request") {
    return parsed as BridgeMessage;
  }

  if (parsed.type === "driver.notification.unread") {
    return parsed as BridgeMessage;
  }

  if (parsed.type === "open.url" && isRecord(parsed.payload) && typeof parsed.payload.url === "string") {
    return parsed as BridgeMessage;
  }

  if (
    parsed.type === "mobile-session.challenge" &&
    isRecord(parsed.payload) &&
    typeof parsed.payload.code === "string" &&
    typeof parsed.payload.expiresAt === "string"
  ) {
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
  detail?: Record<string, unknown>,
  options?: { canBackgroundLocation?: boolean }
): NativeStatusMessage {
  return {
    namespace: BRIDGE_NAMESPACE,
    version: BRIDGE_VERSION,
    type: "native.status",
    payload: {
      status,
      message,
      canBackgroundLocation: options?.canBackgroundLocation ?? status !== "session_missing",
      recordedAt: new Date().toISOString(),
      detail
    }
  };
}

/** Read a `tomp:native-status` CustomEvent detail without trusting its shape. */
export function parseNativeStatusDetail(detail: unknown): NativeStatusPayload | null {
  if (!isRecord(detail)) return null;
  const payload = detail.payload;
  if (!isRecord(payload) || typeof payload.status !== "string") return null;
  return payload as unknown as NativeStatusPayload;
}

/** CustomEvent the shell dispatches to tell the page which tab is now active. */
export const VIEW_SWITCH_EVENT = "tomp:view-switch";

export type DriverWebViewKey = "home" | "next" | "messages" | "gps";

export interface ViewSwitchMessage {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  type: "view.switch";
  payload: { view: DriverWebViewKey };
}

export function buildViewSwitchMessage(view: DriverWebViewKey): ViewSwitchMessage {
  return { namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type: "view.switch", payload: { view } };
}

const VIEW_KEYS: readonly DriverWebViewKey[] = ["home", "next", "messages", "gps"];

/** Read a `tomp:view-switch` CustomEvent detail without trusting its shape. */
export function parseViewSwitchDetail(detail: unknown): DriverWebViewKey | null {
  if (!isRecord(detail)) return null;
  const payload = detail.payload;
  if (!isRecord(payload) || typeof payload.view !== "string") return null;
  return (VIEW_KEYS as readonly string[]).includes(payload.view) ? (payload.view as DriverWebViewKey) : null;
}
