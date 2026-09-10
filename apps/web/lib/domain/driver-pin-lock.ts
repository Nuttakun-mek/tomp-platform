// Rules for the driver PIN gate: how many wrong tries are allowed, what a
// lockout looks like, and when a phone is allowed to take over a job another
// phone already claimed.
//
// This lives apart from the server action because both the Supabase path and
// the raw-SQL path in app/actions/driver-pin.ts need identical behaviour, and
// because the arithmetic is worth testing without a database.

export const PIN_MAX_ATTEMPTS = 5;
/**
 * Wrong PINs lock the link for a while rather than killing it. Before device
 * re-binding existed, a stranger holding the QR could never reach the PIN
 * prompt — the device check turned them away first — so burning the attempts
 * permanently was safe. Now any phone may try, and a permanent revoke would let
 * someone with only the QR lock the real driver out of their job. Fifteen
 * minutes makes guessing a 6-digit PIN hopeless (5 tries per 15 min) while a
 * driver who fat-fingered theirs just waits for coffee.
 */
export const PIN_LOCK_MS = 15 * 60 * 1000;

export interface PinLockState {
  /** Wrong tries counted so far in the current window. */
  attempts: number;
  /** True while the link refuses PINs. */
  locked: boolean;
  /** Seconds until the lock lifts; 0 when not locked. */
  retryAfterSeconds: number;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readLockedUntil(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/**
 * Current lock state from a token's metadata. Once the cooldown has passed the
 * attempt counter is reported as 0, so the driver gets a full set of tries back
 * without needing a write to clear it.
 */
export function readPinLock(metadata: unknown, now = Date.now()): PinLockState {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const lockedUntil = readLockedUntil(meta.pinLockedUntil);

  if (lockedUntil > now) {
    return {
      attempts: readNumber(meta.pinAttempts),
      locked: true,
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000)
    };
  }

  // Cooldown served: the window resets.
  if (lockedUntil) return { attempts: 0, locked: false, retryAfterSeconds: 0 };

  return { attempts: readNumber(meta.pinAttempts), locked: false, retryAfterSeconds: 0 };
}

/**
 * Metadata patch to apply after a wrong PIN. Reaching PIN_MAX_ATTEMPTS starts
 * the cooldown and zeroes the counter, so the next window begins clean.
 */
export function pinFailurePatch(state: PinLockState, now = Date.now()) {
  const attempts = state.attempts + 1;
  if (attempts >= PIN_MAX_ATTEMPTS) {
    return { pinAttempts: 0, pinLockedUntil: new Date(now + PIN_LOCK_MS).toISOString(), remaining: 0 };
  }
  return { pinAttempts: attempts, pinLockedUntil: null, remaining: PIN_MAX_ATTEMPTS - attempts };
}

export function pinLockedMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `กรอกรหัสผิดหลายครั้ง กรุณารออีก ${minutes} นาทีแล้วลองใหม่ (ไม่ต้องขอ QR ใหม่)`;
}

export function pinWrongMessage(remaining: number): string {
  return `รหัสไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)`;
}

export interface DeviceRebinding {
  /** Device that held the job before this one. */
  from: string;
  at: string;
}

/**
 * Metadata patch that binds the job to the phone that just proved it knows the
 * PIN. A takeover is recorded so the control centre can see the job changed
 * hands — a driver whose phone was wiped looks exactly like a stolen QR here,
 * and only the audit trail tells them apart afterwards.
 */
export function deviceBindPatch(previousDevice: string, deviceHash: string, history: unknown, now = Date.now()) {
  const rebound = Boolean(previousDevice) && previousDevice !== deviceHash;
  if (!rebound) return { deviceHash, deviceRebindings: history, rebound: false };

  const previous = Array.isArray(history) ? (history as DeviceRebinding[]) : [];
  // Keep the tail only: this is a breadcrumb, not a log store.
  const entries = [...previous, { from: previousDevice, at: new Date(now).toISOString() }].slice(-5);
  return { deviceHash, deviceRebindings: entries, rebound: true };
}
