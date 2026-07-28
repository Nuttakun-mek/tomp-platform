import "server-only";

import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

type TableName = "projects" | "missions" | "drivers" | "vehicles" | "call_signs" | "assignments" | "driver_access_tokens" | "gps_locations";

interface SourceCheck {
  table: TableName;
  label: string;
  select: string;
  textFields: string[];
}

export interface DataQualityIssue {
  id: string;
  severity: "warning" | "critical";
  area: string;
  title: string;
  detail: string;
  sample?: string;
}

export interface DataQualityReport {
  mode: "service_role" | "anon_development" | "missing";
  checkedAt: string;
  connected: boolean;
  issues: DataQualityIssue[];
  tableCounts: Record<string, number>;
  error?: string;
}

const sourceChecks: SourceCheck[] = [
  { table: "projects", label: "โครงการ", select: "id,project_code,project_name,status", textFields: ["project_code", "project_name", "status"] },
  { table: "missions", label: "ภารกิจ", select: "id,mission_code,mission_name,mission_type,status", textFields: ["mission_code", "mission_name", "mission_type", "status"] },
  { table: "drivers", label: "คนขับ", select: "id,full_name,phone,status", textFields: ["full_name", "phone", "status"] },
  { table: "vehicles", label: "รถ", select: "id,plate_number,vehicle_type,status", textFields: ["plate_number", "vehicle_type", "status"] },
  { table: "call_signs", label: "Call Sign", select: "id,call_sign,group_name,status", textFields: ["call_sign", "group_name", "status"] },
  { table: "assignments", label: "Assignment", select: "id,project_id,mission_id,call_sign_id,driver_id,vehicle_id,status", textFields: ["status"] },
  { table: "driver_access_tokens", label: "QR คนขับ", select: "id,project_id,assignment_id,driver_id,status,expires_at", textFields: ["status"] },
  { table: "gps_locations", label: "ตำแหน่ง GPS", select: "id,project_id,assignment_id,driver_id,vehicle_id,created_at,recorded_at,source", textFields: ["source"] }
];

const mojibakePatterns = [/เธ\S*/, /เน[^\s]*/, /โ€/, /�/, /\?{4,}/, /à¸|à¹/];

function asRows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object") : [];
}

function textValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function hasEncodingIssue(value: string) {
  return mojibakePatterns.some((pattern) => pattern.test(value));
}

function addIssue(issues: DataQualityIssue[], issue: Omit<DataQualityIssue, "id">) {
  issues.push({ id: `${issue.area}-${issues.length + 1}`, ...issue });
}

export async function getDataQualityReport(): Promise<DataQualityReport> {
  const checkedAt = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const { client, mode, error } = getSupabaseWriteClient();

  if (!client) {
    return {
      mode,
      checkedAt,
      connected: false,
      issues: [
        {
          id: "connection-1",
          severity: "critical",
          area: "การเชื่อมต่อ",
          title: "ยังไม่ได้ตั้งค่า Supabase สำหรับ server-side",
          detail: error || "ไม่พบค่า Supabase URL หรือ key สำหรับอ่านข้อมูลฝั่ง server"
        }
      ],
      tableCounts: {},
      error
    };
  }

  const issues: DataQualityIssue[] = [];
  const tableCounts: Record<string, number> = {};
  const rowsByTable = new Map<TableName, Record<string, unknown>[]>();

  for (const check of sourceChecks) {
    const { data, error: queryError } = await client.from(check.table).select(check.select).limit(200);
    const rows = asRows(data);
    rowsByTable.set(check.table, rows);
    tableCounts[check.label] = rows.length;

    if (queryError) {
      addIssue(issues, {
        severity: "critical",
        area: check.label,
        title: `อ่านข้อมูล ${check.label} ไม่สำเร็จ`,
        detail: queryError.message
      });
      continue;
    }

    for (const row of rows) {
      for (const field of check.textFields) {
        const value = textValue(row, field);
        if (value && hasEncodingIssue(value)) {
          addIssue(issues, {
            severity: "critical",
            area: check.label,
            title: `พบข้อความภาษาไทยเพี้ยนใน ${check.label}`,
            detail: `ฟิลด์ ${field} มีรูปแบบ encoding ที่ควร cleanup ก่อนทดสอบกับผู้ใช้จริง`,
            sample: value.slice(0, 80)
          });
          break;
        }
      }
    }
  }

  const projects = rowsByTable.get("projects") ?? [];
  const projectCodes = new Set<string>();
  for (const project of projects) {
    const code = textValue(project, "project_code");
    if (!code) {
      addIssue(issues, {
        severity: "warning",
        area: "โครงการ",
        title: "พบโครงการที่ไม่มีรหัส",
        detail: "ควรกำหนดรหัสโครงการให้ชัดเจนเพื่อใช้แยกงานและติดตาม GPS"
      });
    } else if (projectCodes.has(code)) {
      addIssue(issues, {
        severity: "critical",
        area: "โครงการ",
        title: "พบรหัสโครงการซ้ำในข้อมูลที่อ่านได้",
        detail: "ควรตรวจสอบข้อมูลซ้ำก่อนทดสอบสร้างงานใหม่",
        sample: code
      });
    }
    projectCodes.add(code);
  }

  const assignments = rowsByTable.get("assignments") ?? [];
  for (const assignment of assignments) {
    if (!assignment.driver_id || !assignment.vehicle_id || !assignment.call_sign_id) {
      addIssue(issues, {
        severity: "warning",
        area: "Assignment",
        title: "พบ Assignment ที่ยังไม่ครบสำหรับทดสอบ GPS",
        detail: "Assignment ควรมี Call Sign, คนขับ และรถก่อนสร้าง QR ให้คนขับ",
        sample: textValue(assignment, "id")
      });
    }
  }

  const tokens = rowsByTable.get("driver_access_tokens") ?? [];
  if (assignments.length > 0 && tokens.length === 0) {
    addIssue(issues, {
      severity: "warning",
      area: "QR คนขับ",
      title: "ยังไม่มี QR/token สำหรับงานที่จัดสรร",
      detail: "ให้สร้าง QR จากหน้า Assignment เพื่อให้คนขับเปิดหน้าคนขับและแชร์ GPS"
    });
  }

  const gpsLocations = rowsByTable.get("gps_locations") ?? [];
  if (tokens.length > 0 && gpsLocations.length === 0) {
    addIssue(issues, {
      severity: "warning",
      area: "ตำแหน่ง GPS",
      title: "ยังไม่มีตำแหน่ง GPS จากคนขับ",
      detail: "ต้องเปิดลิงก์คนขับบนมือถือ กดเริ่มแชร์ และอนุญาตตำแหน่งใน browser"
    });
  }

  return {
    mode,
    checkedAt,
    connected: true,
    issues,
    tableCounts
  };
}
