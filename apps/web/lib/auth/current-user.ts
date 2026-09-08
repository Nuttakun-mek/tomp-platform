import "server-only";

import { randomUUID } from "crypto";
import { getSessionAwareAuthClient } from "@/lib/auth/auth-server";
import { resolvePrimaryRole } from "@/lib/auth/role-model";
import { roleLabelTh } from "@/lib/i18n/role-th";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export interface CurrentUserProfile {
  id: string;
  authUserId: string | null;
  organizationId: string | null;
  fullName: string;
  email: string | null;
  roleLabel: string;
  isDevelopmentFallback: boolean;
  productionRisk?: string | null;
}

function allowDevelopmentFallback() {
  return process.env.NODE_ENV !== "production" || process.env.TOMP_ALLOW_AUTH_FALLBACK === "1";
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const supabase = await getSessionAwareAuthClient();

  if (!supabase) {
    return fallbackProfile("development-profile", "โหมดพัฒนา", "ยังไม่ได้ตั้งค่า Supabase Auth server client");
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (!authUser) {
    if (allowDevelopmentFallback()) {
      return fallbackProfile("development-profile", "โหมดพัฒนา", "ไม่มี session ผู้ใช้จริง");
    }
    return {
      id: "anonymous",
      authUserId: null,
      organizationId: null,
      fullName: "ยังไม่ได้เข้าสู่ระบบ",
      email: null,
      roleLabel: "ยังไม่ได้เข้าสู่ระบบ",
      isDevelopmentFallback: false,
      productionRisk: "ต้องเข้าสู่ระบบก่อนใช้งาน"
    };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("id, auth_user_id, organization_id, full_name, email")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (!profile) {
    profile = await linkInvitedProfile(authUser.id, authUser.email || null);
  }

  if (!profile) {
    profile = await bootstrapFirstProfileIfEmpty(authUser.id, authUser.email || null);
  }

  const roleKeys = typeof profile?.id === "string" ? await queryRoleKeys(profile.id) : [];
  const primaryRole = resolvePrimaryRole(roleKeys);

  return {
    id: typeof profile?.id === "string" ? profile.id : authUser.id,
    authUserId: authUser.id,
    organizationId: typeof profile?.organization_id === "string" ? profile.organization_id : null,
    fullName: typeof profile?.full_name === "string" && profile.full_name.trim() ? profile.full_name : authUser.email || "ผู้ใช้งานระบบ",
    email: typeof profile?.email === "string" ? profile.email : authUser.email || null,
    roleLabel: roleLabelTh(primaryRole),
    isDevelopmentFallback: false,
    productionRisk: primaryRole ? null : "บัญชีนี้ยังไม่ได้รับบทบาทในระบบ"
  };
}

type RoleKeyJoin = { roles?: { role_key?: string } | { role_key?: string }[] | null };

function roleKeyFromJoin(row: RoleKeyJoin): string | null {
  const roles = row.roles;
  const key = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
  return typeof key === "string" ? key : null;
}

// อ่านบทบาททั้ง global (user_role_assignments, project_id null) และรายโครงการ
// (project_members) ผ่าน service-role client — สองตารางนี้ RLS ปิดกั้น authenticated
async function queryRoleKeys(profileId: string): Promise<string[]> {
  const admin = getSupabaseServerDataClient();
  if (!admin) return [];

  const keys = new Set<string>();

  const { data: globalRoles } = await admin
    .from("user_role_assignments")
    .select("roles(role_key)")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("project_id", null);
  for (const row of (globalRoles || []) as RoleKeyJoin[]) {
    const key = roleKeyFromJoin(row);
    if (key) keys.add(key);
  }

  const { data: memberRoles } = await admin
    .from("project_members")
    .select("roles(role_key)")
    .eq("profile_id", profileId)
    .eq("status", "active");
  for (const row of (memberRoles || []) as RoleKeyJoin[]) {
    const key = roleKeyFromJoin(row);
    if (key) keys.add(key);
  }

  return [...keys];
}

// เจอ profile ที่ email ตรงและยังไม่ผูก auth_user_id (invited) → ผูกให้
async function linkInvitedProfile(authUserId: string, email: string | null) {
  const adminClient = getSupabaseServerDataClient();
  if (!adminClient || !email) return null;

  const { data: invited } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, organization_id, full_name, email")
    .ilike("email", email)
    .is("auth_user_id", null)
    .maybeSingle();

  if (!invited) return null;

  const { data: linked } = await adminClient
    .from("profiles")
    .update({ auth_user_id: authUserId, status: "active" })
    .eq("id", invited.id)
    .select("id, auth_user_id, organization_id, full_name, email")
    .single();

  return linked ?? null;
}

async function bootstrapFirstProfileIfEmpty(authUserId: string, email: string | null) {
  const adminClient = getSupabaseServerDataClient();
  if (!adminClient || !email) return null;

  const { count, error: countError } = await adminClient.from("profiles").select("id", { count: "exact", head: true });
  if (countError || count !== 0) return null;

  const organizationId = randomUUID();
  const profileId = randomUUID();
  const fullName = "ผู้ดูแลระบบ";

  const { error: organizationError } = await adminClient.from("organizations").insert({
    id: organizationId,
    name: "TOMP Operations",
    organization_type: "operator",
    status: "active",
    metadata: { bootstrap: true, source: "first_login" }
  });
  if (organizationError) return null;

  const { data: insertedProfile, error: profileError } = await adminClient
    .from("profiles")
    .insert({
      id: profileId,
      auth_user_id: authUserId,
      organization_id: organizationId,
      full_name: fullName,
      email,
      status: "active",
      metadata: { bootstrap: true, source: "first_login" }
    })
    .select("id, auth_user_id, organization_id, full_name, email")
    .single();

  if (profileError || !insertedProfile) return null;

  const { data: role } = await adminClient.from("roles").select("id").eq("role_key", "super_admin").maybeSingle();
  const roleId = typeof role?.id === "string" ? role.id : null;
  if (roleId) {
    await adminClient.from("user_role_assignments").insert({
      profile_id: profileId,
      organization_id: organizationId,
      role_id: roleId,
      status: "active",
      metadata: { bootstrap: true, source: "first_login" }
    });
  }

  return insertedProfile;
}

function fallbackProfile(id: string, roleLabel: string, productionRisk: string): CurrentUserProfile {
  return {
    id,
    authUserId: null,
    organizationId: "10000000-0000-4000-8000-000000000001",
    fullName: "ผู้ดูแลระบบทดสอบ",
    email: null,
    roleLabel,
    isDevelopmentFallback: true,
    productionRisk
  };
}

export interface ProjectMembership {
  projectId: string;
  profileId: string;
  roleKey: string;
  permissions: string[];
  isDevelopmentFallback: boolean;
}

export async function getProjectMembership(projectId: string): Promise<ProjectMembership | null> {
  const profile = await getCurrentUserProfile();

  if (profile.isDevelopmentFallback) {
    return {
      projectId,
      profileId: profile.id,
      roleKey: "project_manager",
      permissions: [
        "project.read",
        "project.create",
        "project.publish",
        "mission.read",
        "mission.create",
        "assignment.read",
        "assignment.create",
        "assignment.update",
        "driver.create",
        "vehicle.create",
        "timeline.read",
        "timeline.create",
        "change.create",
        "change.approve",
        "change.apply"
      ],
      isDevelopmentFallback: true
    };
  }

  if (!profile.authUserId || profile.id === "anonymous") return null;

  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("project_members")
    .select("project_id, profile_id, role_id")
    .eq("project_id", projectId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  const roleId = typeof data?.role_id === "string" ? data.role_id : null;
  if (!roleId) return null;

  const { data: role } = await supabase.from("roles").select("role_key").eq("id", roleId).maybeSingle();
  const roleKey = typeof role?.role_key === "string" ? role.role_key : null;
  if (!roleKey) return null;

  return {
    projectId,
    profileId: profile.id,
    roleKey,
    permissions: [],
    isDevelopmentFallback: false
  };
}
