import * as SQLite from "expo-sqlite";
import type { AssignmentStatusUpdateInput, DriverCheckinInput, DriverIssueReportInput, DriverLocationUpdateInput } from "@tomp/types/schemas";
import { submitLocation } from "./driver-api";
import { getMobileDriverSession } from "./mobile-session-store";

const DATABASE_NAME = "tomp-driver-outbox.db";
const MAX_QUEUE_SIZE = 2000;

type OfflineAction =
  | { id: string; kind: "readiness"; payload: DriverCheckinInput; createdAt: string }
  | { id: string; kind: "status"; payload: AssignmentStatusUpdateInput; createdAt: string }
  | { id: string; kind: "issue"; payload: DriverIssueReportInput; createdAt: string }
  | { id: string; kind: "location"; payload: DriverLocationUpdateInput; createdAt: string };

interface OutboxRow {
  id: string;
  kind: OfflineAction["kind"];
  payload: string;
  created_at: string;
  attempt_count: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function createId() {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${randomPart}`;
}

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        create table if not exists driver_outbox (
          id text primary key not null,
          kind text not null,
          payload text not null,
          created_at text not null,
          attempt_count integer not null default 0,
          last_error text,
          updated_at text not null
        );
        create index if not exists driver_outbox_created_at_idx on driver_outbox(created_at);
      `);
      return db;
    });
  }
  return dbPromise;
}

function parseRow(row: OutboxRow): OfflineAction | null {
  try {
    return {
      id: row.id,
      kind: row.kind,
      payload: JSON.parse(row.payload) as OfflineAction["payload"],
      createdAt: row.created_at
    } as OfflineAction;
  } catch {
    return null;
  }
}

export async function getOfflineQueueCount() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ count: number }>("select count(*) as count from driver_outbox");
  return Number(rows[0]?.count ?? 0);
}

export async function clearOfflineQueue() {
  const db = await getDatabase();
  await db.runAsync("delete from driver_outbox");
}

export async function enqueueOfflineAction(kind: OfflineAction["kind"], payload: OfflineAction["payload"]) {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "insert into driver_outbox (id, kind, payload, created_at, updated_at) values (?, ?, ?, ?, ?)",
    [createId(), kind, JSON.stringify(payload), createdAt, createdAt]
  );
  await db.runAsync(
    `delete from driver_outbox
     where id in (
       select id from driver_outbox
       order by created_at asc
       limit max((select count(*) from driver_outbox) - ?, 0)
     )`,
    [MAX_QUEUE_SIZE]
  );
}

async function sendAction(action: OfflineAction) {
  if (action.kind === "location") return submitLocation(action.payload, await getMobileDriverSession());
  return { success: false, error: "รายการนี้ต้องส่งผ่าน Driver Web session ไม่ใช่ raw QR token" };
}

export async function flushOfflineQueue() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>("select id, kind, payload, created_at, attempt_count from driver_outbox order by created_at asc limit 100");
  let sent = 0;

  for (const row of rows) {
    const action = parseRow(row);
    if (!action) {
      await db.runAsync("delete from driver_outbox where id = ?", [row.id]);
      continue;
    }

    const result = await sendAction(action).catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : "ส่งข้อมูลไม่สำเร็จ"
    }));

    if (result.success) {
      sent += 1;
      await db.runAsync("delete from driver_outbox where id = ?", [row.id]);
    } else {
      await db.runAsync("update driver_outbox set attempt_count = attempt_count + 1, last_error = ?, updated_at = ? where id = ?", [
        result.error ?? "ส่งข้อมูลไม่สำเร็จ",
        new Date().toISOString(),
        row.id
      ]);
    }
  }

  return {
    sent,
    remaining: await getOfflineQueueCount()
  };
}
