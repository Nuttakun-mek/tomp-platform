"use client";

export type DriverOutboxKind = "status" | "message" | "issue";

export interface DriverOutboxItem {
  id: string;
  kind: DriverOutboxKind;
  createdAt: string;
  payload: Record<string, unknown>;
}

const MAX_ITEMS = 20;

function key(token: string) {
  return `tomp:driver-outbox:${token}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readDriverOutbox(token: string): DriverOutboxItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(key(token));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is DriverOutboxItem => typeof item?.id === "string") : [];
  } catch {
    return [];
  }
}

export function writeDriverOutbox(token: string, items: DriverOutboxItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key(token), JSON.stringify(items.slice(-MAX_ITEMS)));
}

export function enqueueDriverOutbox(token: string, item: Omit<DriverOutboxItem, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const items = readDriverOutbox(token);
  const next: DriverOutboxItem = {
    id: item.id || `${item.kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: item.kind,
    createdAt: item.createdAt || new Date().toISOString(),
    payload: item.payload
  };
  if (items.some((existing) => existing.id === next.id)) return;
  writeDriverOutbox(token, [...items, next]);
}

export async function flushDriverOutbox(
  token: string,
  sender: (item: DriverOutboxItem) => Promise<{ success: boolean }>
): Promise<{ sent: number; remaining: number }> {
  const items = readDriverOutbox(token);
  const remaining: DriverOutboxItem[] = [];
  let sent = 0;

  for (const item of items) {
    try {
      const result = await sender(item);
      if (result.success) {
        sent += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  writeDriverOutbox(token, remaining);
  return { sent, remaining: remaining.length };
}
