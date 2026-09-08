import "server-only";

import { randomUUID } from "crypto";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export interface ProvisionUserInput {
  email: string;
  fullName: string;
  organizationId: string;
  globalRoleKey?: string;
  projectId?: string;
  projectRoleKey?: string;
}

type ValidationResult = { ok: true; value: ProvisionUserInput } | { ok: false; error: string };

export function validateProvisionInput(raw: unknown): ValidationResult {
  const input = (raw ?? {}) as Record<string, unknown>;
  const email = String(input.email ?? "").trim().toLowerCase();
  const fullName = String(input.fullName ?? "").trim();
  const organizationId = String(input.organizationId ?? "").trim();
  const globalRoleKey = input.globalRoleKey ? String(input.globalRoleKey) : undefined;
  const projectId = input.projectId ? String(input.projectId) : undefined;
  const projectRoleKey = input.projectRoleKey ? String(input.projectRoleKey) : undefined;

  if (!email.includes("@") || email.length < 5) return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  if (!fullName) return { ok: false, error: "กรุณากรอกชื่อผู้ใช้" };
  if (!organizationId) return { ok: false, error: "กรุณาเลือกองค์กร" };
  if (!globalRoleKey && !projectRoleKey) return { ok: false, error: "ต้องกำหนดบทบาทอย่างน้อย 1 อย่าง" };
  if (projectRoleKey && !projectId) return { ok: false, error: "เลือกโครงการก่อนกำหนดบทบาทโครงการ" };

  return { ok: true, value: { email, fullName, organizationId, globalRoleKey, projectId, projectRoleKey } };
}

export interface ProfileRow {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
  organizationId: string | null;
  roleKeys: string[];
}

type RoleJoin = { profile_id?: unknown; roles?: { role_key?: string } | { role_key?: string }[] | null };

function roleKeyOf(row: RoleJoin): string | null {
  const roles = row.roles;
  const key = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
  return typeof key === "string" ? key : null;
}

export async function listProfilesWithRoles(): Promise<ProfileRow[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];

  const { data: profiles } = await client
    .from("profiles")
    .select("id, full_name, email, status, organization_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (profiles || []) as Array<Record<string, unknown>>;
  if (!rows.length) return [];

  const ids = rows.map((r) => String(r.id));
  const [{ data: assignments }, { data: members }] = await Promise.all([
    client.from("user_role_assignments").select("profile_id, roles(role_key)").in("profile_id", ids).eq("status", "active"),
    client.from("project_members").select("profile_id, roles(role_key)").in("profile_id", ids).eq("status", "active")
  ]);

  const byProfile = new Map<string, Set<string>>();
  for (const row of [...(assignments || []), ...(members || [])] as RoleJoin[]) {
    const pid = String(row.profile_id);
    const key = roleKeyOf(row);
    if (!key) continue;
    if (!byProfile.has(pid)) byProfile.set(pid, new Set());
    byProfile.get(pid)!.add(key);
  }

  return rows.map((r) => ({
    id: String(r.id),
    fullName: typeof r.full_name === "string" ? r.full_name : "",
    email: typeof r.email === "string" ? r.email : null,
    status: typeof r.status === "string" ? r.status : "unknown",
    organizationId: typeof r.organization_id === "string" ? r.organization_id : null,
    roleKeys: [...(byProfile.get(String(r.id)) ?? [])]
  }));
}

export async function provisionUser(
  input: ProvisionUserInput
): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  const client = getSupabaseServerDataClient();
  if (!client) return { ok: false, error: "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล" };

  const { data: existing } = await client.from("profiles").select("id").ilike("email", input.email).maybeSingle();
  if (existing) return { ok: false, error: "อีเมลนี้มีผู้ใช้อยู่แล้ว" };

  const roleKeys = [input.globalRoleKey, input.projectRoleKey].filter(Boolean) as string[];
  const { data: roles } = await client.from("roles").select("id, role_key").in("role_key", roleKeys);
  const roleIdByKey = new Map(
    ((roles || []) as Array<Record<string, unknown>>).map((r) => [String(r.role_key), String(r.id)])
  );
  for (const key of roleKeys) {
    if (!roleIdByKey.has(key)) return { ok: false, error: `ไม่พบบทบาท ${key}` };
  }

  const profileId = randomUUID();
  const { error: profileError } = await client.from("profiles").insert({
    id: profileId,
    auth_user_id: null,
    organization_id: input.organizationId,
    full_name: input.fullName,
    email: input.email,
    status: "invited",
    metadata: { source: "superadmin_provision" }
  });
  if (profileError) return { ok: false, error: `สร้างผู้ใช้ไม่สำเร็จ: ${profileError.message}` };

  if (input.globalRoleKey) {
    await client.from("user_role_assignments").insert({
      profile_id: profileId,
      organization_id: input.organizationId,
      role_id: roleIdByKey.get(input.globalRoleKey),
      status: "active",
      metadata: { source: "superadmin_provision" }
    });
  }
  if (input.projectRoleKey && input.projectId) {
    await client.from("project_members").insert({
      project_id: input.projectId,
      profile_id: profileId,
      role_id: roleIdByKey.get(input.projectRoleKey),
      status: "active",
      metadata: { source: "superadmin_provision" }
    });
  }

  return { ok: true, profileId };
}
