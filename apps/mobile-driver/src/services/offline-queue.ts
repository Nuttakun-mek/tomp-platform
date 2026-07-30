import * as SecureStore from "expo-secure-store";
import type { AssignmentStatusUpdateInput, DriverCheckinInput, DriverIssueReportInput, DriverLocationUpdateInput } from "@tomp/types/schemas";
import { submitIssue, submitLocation, submitReadiness, submitStatus } from "./driver-api";

const OFFLINE_QUEUE_KEY = "tomp_driver_offline_queue";
const MAX_QUEUE_SIZE = 20;

type OfflineAction =
  | { id: string; kind: "readiness"; payload: DriverCheckinInput; createdAt: string }
  | { id: string; kind: "status"; payload: AssignmentStatusUpdateInput; createdAt: string }
  | { id: string; kind: "issue"; payload: DriverIssueReportInput; createdAt: string }
  | { id: string; kind: "location"; payload: DriverLocationUpdateInput; createdAt: string };

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<OfflineAction[]> {
  const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(actions: OfflineAction[]) {
  await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(actions.slice(-MAX_QUEUE_SIZE)));
}

export async function getOfflineQueueCount() {
  const queue = await readQueue();
  return queue.length;
}

export async function clearOfflineQueue() {
  await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
}

export async function enqueueOfflineAction(kind: OfflineAction["kind"], payload: OfflineAction["payload"]) {
  const queue = await readQueue();
  await writeQueue([
    ...queue,
    {
      id: createId(),
      kind,
      payload,
      createdAt: new Date().toISOString()
    } as OfflineAction
  ]);
}

async function sendAction(action: OfflineAction) {
  if (action.kind === "readiness") return submitReadiness(action.payload);
  if (action.kind === "status") return submitStatus(action.payload);
  if (action.kind === "issue") return submitIssue(action.payload);
  return submitLocation(action.payload);
}

export async function flushOfflineQueue() {
  const queue = await readQueue();
  const remaining: OfflineAction[] = [];
  let sent = 0;

  for (const action of queue) {
    const result = await sendAction(action).catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : "ส่งข้อมูลไม่สำเร็จ"
    }));

    if (result.success) {
      sent += 1;
    } else {
      remaining.push(action);
    }
  }

  await writeQueue(remaining);
  return {
    sent,
    remaining: remaining.length
  };
}
