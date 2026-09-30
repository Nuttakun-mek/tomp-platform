import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyFlightByNumberAndDate } from "@/lib/airport-transfer/flight-provider";
import { insertAirportTransferCase } from "@/lib/airport-transfer/case-insert";
import { IMPORT_COLUMNS, type ImportField } from "./columns";
import { chooseFlight, suggestedPickupAt, type FlightMatch, type FlightOption } from "./flight-match";
import { duplicateKey, guessMapping, missingRequiredColumns, normalizeRow, type ColumnMapping, type NormalizedRow, type RawRow, type RowMessage } from "./normalize";
import type { RowOps } from "./ops";
import type { ReadWorkbook } from "./workbook";

// One uploaded file is a batch (airport_transfer_import_batches) with one row
// per line (airport_transfer_import_rows). Nothing reaches
// airport_transfer_cases until someone presses "ยืนยันนำเข้า" on a checked batch.

export type RowStatus = "pending" | "valid" | "warning" | "error" | "duplicate" | "imported";

export interface FlightResult {
  status: FlightMatch["status"];
  reason?: string;
  flight?: FlightOption;
  /** How many legs matched, when more than one did. */
  optionCount?: number;
  checkedAt: string;
  /** The flight + date this result belongs to — re-used on a re-check if unchanged. */
  key: string;
}

export interface CheckedRow extends NormalizedRow {
  flight?: FlightResult;
  /** What the control room added on the check page (pickup time, meeting point, unit). */
  ops?: RowOps;
}

export interface BatchMeta {
  projectId: string;
  clientName: string | null;
  isTemplate: boolean;
  sheetName: string;
  headers: string[];
  mapping: ColumnMapping;
  truncated: boolean;
  checkedAt?: string;
  importedCount?: number;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  status: "uploaded" | "validating" | "ready" | "imported" | "failed" | "cancelled";
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createdAt: string;
  completedAt: string | null;
  meta: BatchMeta;
}

export interface ImportRow {
  id: string;
  rowNumber: number;
  status: RowStatus;
  raw: RawRow;
  data: CheckedRow | null;
  messages: RowMessage[];
  caseId: string | null;
}

type Row = Record<string, unknown>;

function mapBatch(row: Row): ImportBatch {
  return {
    id: String(row.id),
    fileName: String(row.file_name),
    status: row.status as ImportBatch["status"],
    totalRows: Number(row.total_rows ?? 0),
    validRows: Number(row.valid_rows ?? 0),
    warningRows: Number(row.warning_rows ?? 0),
    errorRows: Number(row.error_rows ?? 0),
    createdAt: String(row.created_at),
    completedAt: (row.completed_at as string | null) ?? null,
    meta: (row.metadata ?? {}) as BatchMeta
  };
}

function mapRow(row: Row): ImportRow {
  const data = row.normalized_data as CheckedRow | Record<string, never> | null;
  return {
    id: String(row.id),
    rowNumber: Number(row.row_number),
    status: row.validation_status as RowStatus,
    raw: (row.raw_data ?? {}) as RawRow,
    data: data && Object.keys(data).length ? (data as CheckedRow) : null,
    messages: (row.validation_messages ?? []) as RowMessage[],
    caseId: (row.imported_case_id as string | null) ?? null
  };
}

export async function createImportBatch(
  supabase: SupabaseClient,
  input: { projectId: string; fileName: string; clientName: string | null; createdBy: string; workbook: ReadWorkbook }
): Promise<{ ok: true; batchId: string } | { ok: false; message: string }> {
  const { workbook } = input;
  const meta: BatchMeta = {
    projectId: input.projectId,
    clientName: input.clientName,
    isTemplate: workbook.isTemplate,
    sheetName: workbook.sheetName,
    headers: workbook.headers,
    mapping: guessMapping(workbook.headers),
    truncated: workbook.truncated
  };
  const { data, error } = await supabase
    .from("airport_transfer_import_batches")
    .insert({ file_name: input.fileName, status: "uploaded", total_rows: workbook.rows.length, created_by: input.createdBy, metadata: meta })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message || "สร้างชุดนำเข้าไม่สำเร็จ" };
  const batchId = String(data.id);
  if (workbook.rows.length) {
    const { error: rowsError } = await supabase.from("airport_transfer_import_rows").insert(
      workbook.rows.map((row) => ({ batch_id: batchId, row_number: row.rowNumber, raw_data: jsonSafe(row.raw) }))
    );
    if (rowsError) {
      await supabase.from("airport_transfer_import_batches").update({ status: "failed" }).eq("id", batchId);
      return { ok: false, message: rowsError.message };
    }
  }
  return { ok: true, batchId };
}

/** Dates become ISO strings in jsonb; normalize.parseDateCell reads both. */
function jsonSafe(raw: RawRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value instanceof Date ? value.toISOString().slice(0, 10) : value]));
}

export async function getImportBatch(supabase: SupabaseClient, batchId: string, projectId: string) {
  const { data } = await supabase.from("airport_transfer_import_batches").select("*").eq("id", batchId).maybeSingle();
  if (!data) return null;
  const batch = mapBatch(data as Row);
  // Batches carry their project in metadata (the table predates projects);
  // a batch from another project is as good as not found.
  if (batch.meta.projectId !== projectId) return null;
  const { data: rows } = await supabase.from("airport_transfer_import_rows").select("*").eq("batch_id", batchId).order("row_number");
  return { batch, rows: ((rows || []) as Row[]).map(mapRow) };
}

export async function listImportBatches(supabase: SupabaseClient, projectId: string): Promise<ImportBatch[]> {
  const { data } = await supabase
    .from("airport_transfer_import_batches")
    .select("*")
    .eq("metadata->>projectId", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data || []) as Row[]).map(mapBatch);
}

export async function saveBatchMapping(supabase: SupabaseClient, batch: ImportBatch, mapping: ColumnMapping) {
  const allowed = new Set(batch.meta.headers);
  const clean = Object.fromEntries(Object.entries(mapping).filter(([, header]) => header && allowed.has(header))) as ColumnMapping;
  await supabase.from("airport_transfer_import_batches").update({ metadata: { ...batch.meta, mapping: clean } }).eq("id", batch.id);
  return { ...batch, meta: { ...batch.meta, mapping: clean } };
}

const FLIGHT_LOOKUP_LIMIT = 120;
const FLIGHT_CONCURRENCY = 4;
const RECHECK_AFTER_MS = 30 * 60 * 1000;

async function lookUpFlights(keys: string[]): Promise<Map<string, FlightOption[] | { failed: "not_configured" | "provider_error" | "invalid_input" | "not_found" }>> {
  const results = new Map<string, FlightOption[] | { failed: "not_configured" | "provider_error" | "invalid_input" | "not_found" }>();
  let index = 0;
  async function worker() {
    while (index < keys.length) {
      const key = keys[index++];
      const [flightNumber, date] = key.split("@");
      const verification = await verifyFlightByNumberAndDate(flightNumber, date);
      results.set(
        key,
        verification.ok
          ? verification.candidates.map((candidate) => ({
              flightNumber: candidate.flightNumber,
              originAirport: candidate.originAirport,
              destinationAirport: candidate.destinationAirport,
              scheduledDepartureAt: candidate.scheduledDepartureAt,
              scheduledDepartureLocal: candidate.scheduledDepartureLocal,
              scheduledArrivalAt: candidate.scheduledArrivalAt,
              scheduledArrivalLocal: candidate.scheduledArrivalLocal,
              status: candidate.status
            }))
          : { failed: verification.reason }
      );
    }
  }
  await Promise.all(Array.from({ length: FLIGHT_CONCURRENCY }, worker));
  return results;
}

const FLIGHT_MESSAGE: Record<string, RowMessage | null> = {
  verified: null,
  multiple_matches: { level: "warning", field: "flightNumber", text: "เที่ยวบินนี้มีหลายเที่ยวในวันนั้น — นำเข้าได้ แล้วเลือกเที่ยวที่ถูกในหน้าเคส" },
  route_mismatch: { level: "warning", field: "flightNumber", text: "เที่ยวบินนี้ไม่ได้ลง/ออกจากสนามบินในไทยตามขาเดินทาง — ตรวจขาเดินทางหรือเลขเที่ยวบิน" },
  not_found: { level: "warning", field: "flightNumber", text: "ไม่พบเที่ยวบินนี้ในวันที่ระบุ — ตรวจเลขเที่ยวบินและวันที่" },
  not_configured: { level: "warning", field: "flightNumber", text: "ยังไม่ได้ตั้งค่าระบบตรวจเที่ยวบิน — นำเข้าแล้วต้องตรวจเอง" },
  provider_error: { level: "warning", field: "flightNumber", text: "ระบบตรวจเที่ยวบินไม่ตอบ — กด “ตรวจอีกครั้ง” ภายหลัง" },
  invalid_input: { level: "warning", field: "flightNumber", text: "ระบบตรวจเที่ยวบินอ่านเลขนี้ไม่ได้" },
  skipped: { level: "warning", field: "flightNumber", text: "ยังไม่ได้ตรวจเที่ยวบิน (ไฟล์ใหญ่ ตรวจทีละชุด) — กด “ตรวจอีกครั้ง”" }
};

/** Normalise every row, check flights and duplicates, and store the verdicts. */
export async function checkImportBatch(supabase: SupabaseClient, batchId: string, projectId: string, today: string) {
  const loaded = await getImportBatch(supabase, batchId, projectId);
  if (!loaded) return { ok: false as const, message: "ไม่พบชุดนำเข้า" };
  const { batch, rows } = loaded;
  if (batch.status === "imported" || batch.status === "cancelled") return { ok: false as const, message: "ชุดนี้ปิดแล้ว" };

  const missing = missingRequiredColumns(batch.meta.mapping);
  if (missing.length) {
    const names = missing.map((field) => IMPORT_COLUMNS.find((column) => column.field === field)?.th ?? field);
    return { ok: false as const, message: `ยังไม่ได้จับคู่คอลัมน์: ${names.join(", ")}` };
  }

  await supabase.from("airport_transfer_import_batches").update({ status: "validating" }).eq("id", batch.id);

  const pending = rows.filter((row) => row.status !== "imported");
  const normalized = pending.map((row) => ({ row, ...normalizeRow(row.raw, batch.meta.mapping, today) }));

  // Duplicates inside the file, and against cases already in this project.
  const seen = new Map<string, number>();
  const dates = [...new Set(normalized.map((item) => item.data.travelDate).filter(Boolean))] as string[];
  const existing = new Set<string>();
  if (dates.length) {
    const { data: cases } = await supabase
      .from("airport_transfer_cases")
      .select("direction, travel_date, flight_number, passenger_first_name, passenger_last_name")
      .eq("project_id", projectId)
      .in("travel_date", dates)
      .is("deleted_at", null)
      .neq("operational_status", "cancelled");
    for (const item of (cases || []) as Row[]) {
      const key = duplicateKey({
        direction: item.direction as "arrival" | "departure",
        travelDate: String(item.travel_date),
        flightNumber: String(item.flight_number),
        passengerFirstName: String(item.passenger_first_name),
        passengerLastName: String(item.passenger_last_name)
      });
      if (key) existing.add(key);
    }
  }

  // Flight checks: one lookup per flight + date, re-using a recent result.
  const now = Date.now();
  const wanted = new Set<string>();
  for (const item of normalized) {
    const { data } = item;
    if (!data.flightNumber || !data.travelDate || item.messages.some((m) => m.level === "error" && m.field === "flightNumber")) continue;
    const key = `${data.flightNumber}@${data.travelDate}`;
    const previous = item.row.data?.flight;
    const fresh = previous?.key === key && previous.status !== "unchecked" && now - Date.parse(previous.checkedAt) < RECHECK_AFTER_MS;
    if (!fresh) wanted.add(key);
  }
  const toLookUp = [...wanted].slice(0, FLIGHT_LOOKUP_LIMIT);
  const lookups = await lookUpFlights(toLookUp);
  const checkedAt = new Date().toISOString();

  let valid = 0;
  let warning = 0;
  let errors = 0;
  const updates = normalized.map(({ row, data, messages }) => {
    const out: CheckedRow = { ...data };
    const all = [...messages];
    const key = data.flightNumber && data.travelDate ? `${data.flightNumber}@${data.travelDate}` : null;

    if (key && data.direction) {
      const previous = row.data?.flight;
      const lookup = lookups.get(key);
      let result: FlightResult | undefined;
      if (lookup && Array.isArray(lookup)) {
        const match = chooseFlight(data.direction, data.travelDate!, lookup);
        result = {
          status: match.status,
          key,
          checkedAt,
          flight: match.status === "verified" ? match.flight : undefined,
          optionCount: "options" in match ? match.options.length : undefined
        };
      } else if (lookup) {
        result = { status: lookup.failed === "not_found" ? "not_found" : "unchecked", reason: lookup.failed, key, checkedAt };
      } else if (previous?.key === key) {
        result = previous;
      }
      if (result) {
        out.flight = result;
        const message = FLIGHT_MESSAGE[result.status === "unchecked" ? result.reason ?? "provider_error" : result.status];
        if (message) all.push(message);
      } else if (!all.some((m) => m.field === "flightNumber")) {
        all.push(FLIGHT_MESSAGE.skipped!);
      }
    }

    let status: RowStatus = all.some((m) => m.level === "error") ? "error" : all.length ? "warning" : "valid";
    const dupe = duplicateKey(data);
    if (status !== "error" && dupe) {
      if (existing.has(dupe)) {
        status = "duplicate";
        all.push({ level: "error", text: "มีเคสของผู้โดยสารคนนี้ เที่ยวบินและวันเดียวกันอยู่แล้ว" });
      } else if (seen.has(dupe)) {
        status = "duplicate";
        all.push({ level: "error", text: `ซ้ำกับแถวที่ ${seen.get(dupe)} ในไฟล์นี้` });
      } else {
        seen.set(dupe, row.rowNumber);
      }
    }
    if (status === "valid") valid += 1;
    else if (status === "warning") warning += 1;
    else errors += 1;
    if (row.data?.ops) out.ops = row.data.ops;
    return { id: row.id, batch_id: batch.id, row_number: row.rowNumber, raw_data: row.raw, normalized_data: out, validation_status: status, validation_messages: all };
  });

  for (let i = 0; i < updates.length; i += 200) {
    const { error } = await supabase.from("airport_transfer_import_rows").upsert(updates.slice(i, i + 200));
    if (error) {
      await supabase.from("airport_transfer_import_batches").update({ status: "failed" }).eq("id", batch.id);
      return { ok: false as const, message: error.message };
    }
  }

  const imported = rows.length - pending.length;
  await supabase
    .from("airport_transfer_import_batches")
    .update({
      status: "ready",
      valid_rows: valid,
      warning_rows: warning,
      error_rows: errors,
      metadata: { ...batch.meta, checkedAt, importedCount: imported }
    })
    .eq("id", batch.id);

  const remaining = [...wanted].length - toLookUp.length;
  return { ok: true as const, valid, warning, errors, remaining };
}

function airportLabel(code: string | null | undefined, flightNumber: string) {
  return code ? `สนามบิน ${code}` : `สนามบิน (ตามเที่ยวบิน ${flightNumber})`;
}

/** Turn the rows that passed (and, if asked, those with warnings) into cases. */
export async function commitImportBatch(
  supabase: SupabaseClient,
  input: { batchId: string; projectId: string; organizationId: string | null; profileId: string; rowIds: string[] }
) {
  const loaded = await getImportBatch(supabase, input.batchId, input.projectId);
  if (!loaded) return { ok: false as const, message: "ไม่พบชุดนำเข้า" };
  const { batch, rows } = loaded;
  if (batch.status !== "ready") return { ok: false as const, message: "ต้องตรวจชุดนี้ให้เสร็จก่อนนำเข้า" };

  // Only the rows ticked on the check page, and only ones that passed.
  const picked = new Set(input.rowIds);
  const eligible = rows.filter((row) => picked.has(row.id) && row.data && (row.status === "valid" || row.status === "warning"));
  if (!eligible.length) return { ok: false as const, message: "ยังไม่ได้เลือกแถวที่นำเข้าได้" };
  let imported = 0;
  const failures: string[] = [];

  // The units chosen for rows: their driver and vehicle, read now so the case
  // carries today's plate and phone, and only from this project.
  const unitIds = [...new Set(eligible.map((row) => row.data!.ops?.callSignId).filter((id): id is string => Boolean(id)))];
  const units = new Map<string, { vehicleId: string | null; driverId: string | null; plate: string | null; vehicleType: string | null; driverName: string | null; driverPhone: string | null }>();
  if (unitIds.length) {
    const { data: callSigns } = await supabase.from("call_signs").select("id, vehicle_id, driver_id").eq("project_id", input.projectId).in("id", unitIds);
    const vehicleIds = (callSigns || []).map((row) => row.vehicle_id).filter(Boolean) as string[];
    const driverIds = (callSigns || []).map((row) => row.driver_id).filter(Boolean) as string[];
    const [{ data: vehicles }, { data: drivers }] = await Promise.all([
      vehicleIds.length ? supabase.from("vehicles").select("id, plate_number, vehicle_type").in("id", vehicleIds) : Promise.resolve({ data: [] as Row[] }),
      driverIds.length ? supabase.from("drivers").select("id, full_name, phone").in("id", driverIds) : Promise.resolve({ data: [] as Row[] })
    ]);
    const vehicleById = new Map(((vehicles || []) as Row[]).map((row) => [String(row.id), row]));
    const driverById = new Map(((drivers || []) as Row[]).map((row) => [String(row.id), row]));
    for (const callSign of (callSigns || []) as Row[]) {
      const vehicle = callSign.vehicle_id ? vehicleById.get(String(callSign.vehicle_id)) : undefined;
      const driver = callSign.driver_id ? driverById.get(String(callSign.driver_id)) : undefined;
      units.set(String(callSign.id), {
        vehicleId: (callSign.vehicle_id as string | null) ?? null,
        driverId: (callSign.driver_id as string | null) ?? null,
        plate: (vehicle?.plate_number as string | undefined) ?? null,
        vehicleType: (vehicle?.vehicle_type as string | undefined) ?? null,
        driverName: (driver?.full_name as string | undefined) ?? null,
        driverPhone: (driver?.phone as string | undefined) ?? null
      });
    }
  }

  for (const row of eligible) {
    const data = row.data!;
    const flight = data.flight?.flight;
    const verified = data.flight?.status === "verified";
    const arrival = data.direction === "arrival";
    const ops = data.ops ?? {};
    const unit = ops.callSignId ? units.get(ops.callSignId) : undefined;
    const baseAirport = airportLabel(arrival ? flight?.destinationAirport : flight?.originAirport, data.flightNumber!);
    const airport = ops.meetingPoint ? `${baseAirport} · ${ops.meetingPoint}` : baseAirport;
    const pickupAt = flight ? suggestedPickupAt(data.direction!, flight) : null;
    const driverName = unit?.driverName ?? ops.driverName ?? null;
    const result = await insertAirportTransferCase(supabase, {
      projectId: input.projectId,
      organizationId: input.organizationId,
      createdBy: input.profileId,
      direction: data.direction!,
      clientName: batch.meta.clientName,
      passengerTitle: data.passengerTitle,
      passengerFirstName: data.passengerFirstName!,
      passengerLastName: data.passengerLastName!,
      passengerEmail: data.passengerEmail,
      passengerMobile: data.passengerMobile,
      passengerCount: data.passengerCount ?? 1,
      luggageCount: data.luggageCount,
      travelDate: data.travelDate!,
      flightNumber: data.flightNumber!,
      originAirport: flight?.originAirport ?? null,
      destinationAirport: flight?.destinationAirport ?? null,
      departureAt: flight?.scheduledDepartureAt ?? null,
      arrivalAt: flight?.scheduledArrivalAt ?? null,
      pickupName: arrival ? airport : data.placeName!,
      pickupAddress: arrival ? null : data.placeAddress,
      pickupMapsUrl: arrival ? null : data.placeMapsUrl,
      dropoffName: arrival ? data.placeName! : airport,
      dropoffAddress: arrival ? data.placeAddress : null,
      dropoffMapsUrl: arrival ? data.placeMapsUrl : null,
      recommendedPickupAt: pickupAt,
      confirmedPickupAt: ops.pickupAt ?? null,
      pickupTimeOverrideReason: ops.pickupAt ? "กำหนดตอนนำเข้า" : null,
      vehicleType: unit?.vehicleType ?? ops.vehicleType ?? null,
      vehicleId: unit?.vehicleId ?? null,
      driverId: unit?.driverId ?? null,
      vehiclePlate: unit?.plate ?? ops.vehiclePlate ?? null,
      driverName,
      driverPhone: unit?.driverPhone ?? ops.driverPhone ?? null,
      // A case whose flight checked out and has a driver is already assigned.
      operationalStatus: data.flight?.status === "verified" && driverName ? "assigned" : undefined,
      fastTrack: data.fastTrack,
      notes: data.notes,
      verificationStatus: data.flight ? (data.flight.status === "unchecked" ? (data.flight.reason === "provider_error" ? "provider_unavailable" : "pending") : data.flight.status) : "pending",
      providerConsulted: Boolean(data.flight && data.flight.reason !== "not_configured"),
      providerCheckedAt: data.flight?.checkedAt ?? null,
      snapshots: verified && flight ? [{ scheduledDepartureAt: flight.scheduledDepartureAt, scheduledArrivalAt: flight.scheduledArrivalAt, status: flight.status, raw: flight }] : [],
      source: { importBatchId: batch.id, fileName: batch.fileName, rowNumber: row.rowNumber }
    });
    if (result.ok) {
      imported += 1;
      await supabase.from("airport_transfer_import_rows").update({ validation_status: "imported", imported_case_id: result.caseId }).eq("id", row.id);
    } else {
      failures.push(`แถว ${row.rowNumber}: ${result.message}`);
    }
  }

  const left = rows.filter((row) => row.status !== "imported").length - imported;
  await supabase
    .from("airport_transfer_import_batches")
    .update({
      // Rows left behind (errors, or warnings not taken) keep the batch open to fix and re-check.
      status: left > 0 ? "ready" : "imported",
      completed_at: left > 0 ? null : new Date().toISOString(),
      metadata: { ...batch.meta, importedCount: (batch.meta.importedCount ?? 0) + imported }
    })
    .eq("id", batch.id);

  return { ok: true as const, imported, failures, left };
}

/**
 * Fix one row on screen instead of editing the file and uploading it again.
 * The new values are written into the row's raw cells (through the batch's
 * column mapping), so the same checks run on them as on anything uploaded.
 */
export async function updateImportRowValues(
  supabase: SupabaseClient,
  input: { batchId: string; projectId: string; rowId: string; values: Partial<Record<ImportField, string>> }
) {
  const loaded = await getImportBatch(supabase, input.batchId, input.projectId);
  if (!loaded) return { ok: false as const, message: "ไม่พบชุดนำเข้า" };
  const { batch, rows } = loaded;
  if (batch.status === "imported" || batch.status === "cancelled") return { ok: false as const, message: "ชุดนี้ปิดแล้ว" };
  const row = rows.find((item) => item.id === input.rowId);
  if (!row) return { ok: false as const, message: "ไม่พบแถวนี้" };
  if (row.status === "imported") return { ok: false as const, message: "แถวนี้นำเข้าแล้ว — แก้ที่หน้าเคสแทน" };

  const raw: RawRow = { ...row.raw };
  for (const [field, value] of Object.entries(input.values) as Array<[ImportField, string | undefined]>) {
    const header = batch.meta.mapping[field];
    if (header && value !== undefined) raw[header] = value.trim() || null;
  }
  const { error } = await supabase.from("airport_transfer_import_rows").update({ raw_data: raw, validation_status: "pending" }).eq("id", row.id);
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

/** Save the control room's part of one or more rows (the bulk bar sends several). */
export async function setImportRowsOps(
  supabase: SupabaseClient,
  input: { batchId: string; projectId: string; rowIds: string[]; patch: RowOps }
) {
  const loaded = await getImportBatch(supabase, input.batchId, input.projectId);
  if (!loaded) return { ok: false as const, message: "ไม่พบชุดนำเข้า" };
  if (loaded.batch.status === "imported" || loaded.batch.status === "cancelled") return { ok: false as const, message: "ชุดนี้ปิดแล้ว" };
  if (input.patch.callSignId) {
    const { data } = await supabase.from("call_signs").select("id").eq("id", input.patch.callSignId).eq("project_id", input.projectId).maybeSingle();
    if (!data) return { ok: false as const, message: "ไม่พบ Call Sign นี้ในโครงการ" };
  }
  const targets = loaded.rows.filter((row) => input.rowIds.includes(row.id) && row.status !== "imported" && row.data);
  for (const row of targets) {
    const ops: RowOps = { ...(row.data!.ops ?? {}), ...input.patch };
    // Choosing a unit replaces a typed-in vehicle, and the other way round.
    if (input.patch.callSignId) Object.assign(ops, { vehiclePlate: null, driverName: null, driverPhone: null, vehicleType: null });
    if (input.patch.vehiclePlate || input.patch.driverName) ops.callSignId = null;
    const { error } = await supabase.from("airport_transfer_import_rows").update({ normalized_data: { ...row.data, ops } }).eq("id", row.id);
    if (error) return { ok: false as const, message: error.message };
  }
  return { ok: true as const, updated: targets.length };
}

export async function cancelImportBatch(supabase: SupabaseClient, batchId: string, projectId: string) {
  const loaded = await getImportBatch(supabase, batchId, projectId);
  if (!loaded) return { ok: false as const, message: "ไม่พบชุดนำเข้า" };
  await supabase.from("airport_transfer_import_batches").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", batchId);
  return { ok: true as const };
}

export const MAPPABLE_FIELDS: Array<{ field: ImportField; label: string; required: boolean }> = IMPORT_COLUMNS.map((column) => ({
  field: column.field,
  label: column.th,
  required: column.required
}));
