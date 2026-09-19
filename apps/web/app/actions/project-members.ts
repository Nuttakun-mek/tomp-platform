"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { requirePermission } from "@/lib/auth/rbac";
import { isRoleAllowedForSystem } from "@/lib/auth/system-roles";
import { getProjectById } from "@/lib/data/projects";
import { issueProjectHelperToken } from "@/lib/project-helper/tokens";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

function generateTempPassword(): string {
  const bytes = randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return `Tomp-${bytes.slice(0, 14)}`;
}

// Compound OR with Airport Transfer's own project-scoped manager check —
// same reasoning as the Settings page's entry gate (docs/11-codex/984
// "Granting access"): requirePermission() can never approve an
// airport_admin/airport_dispatcher since the 5 Airport Transfer roles hold
// zero role_permissions rows on purpose (access.ts checks project_members
// roles directly instead). Without this, an airport_admin could see the
// grant form render (Settings page gate) but have every submit rejected.
async function canManageProjectMembers(projectId: string): Promise<{ allowed: boolean; reason?: string }> {
  const permission = await requirePermission(projectId, "project.manage_members");
  if (permission.allowed) return permission;
  const airportAccess = await getAirportTransferAccess(projectId);
  return airportAccess.canManage ? { allowed: true } : permission;
}

// SECURITY: roleKey must be validated against the per-system allowlist, not
// just "exists in the roles table" — `roles` also holds super_admin, and
// getUserRoles() unions every project_members role a profile holds into that
// profile's GLOBAL role set. Without this check, anyone with
// project.manage_members on any project could grant themselves super_admin.
// Checked with superRefine (not a plain z.enum on roleKey alone) because the
// valid set depends on systemKey, which is itself part of this same object.
const roleMatchesSystem = (data: { systemKey: string; roleKey: string }, ctx: z.RefinementCtx) => {
  if (!isRoleAllowedForSystem(data.systemKey, data.roleKey)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "บทบาทนี้ใช้กับระบบนี้ไม่ได้", path: ["roleKey"] });
  }
};

const addMemberSchema = z
  .object({
    projectId: z.string().uuid(),
    systemKey: z.enum(["ground_transfer", "airport_transfer"]),
    roleKey: z.string().min(1),
    email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
    fullName: z.string().trim().optional()
  })
  .superRefine(roleMatchesSystem);

// Full-account path: an existing profile's email is looked up first, so
// re-granting an already-known person never creates a duplicate account.
// Only when no profile owns that email does this provision a brand-new one
// (a real Supabase Auth user with a temporary password, the same shape
// lib/superadmin/users.ts's provisionUser already uses) — a project manager
// grants access to their own project without needing the org-wide
// admin.manage_users permission that provisionUser is normally gated behind.
export async function addProjectMemberAction(input: unknown): Promise<ActionResult<{ profileId: string; created: boolean; tempPassword?: string }>> {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) return actionFailure("ข้อมูลไม่ครบถ้วน", parsed.error.flatten().fieldErrors);

  const permission = await canManageProjectMembers(parsed.data.projectId);
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์เพิ่มสมาชิกโครงการนี้");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data: role, error: roleError } = await client.from("roles").select("id").eq("role_key", parsed.data.roleKey).maybeSingle();
  if (roleError || !role) return actionFailure("ไม่พบบทบาทนี้ในระบบ");

  // .eq, not .ilike: `_` and `%` are LIKE wildcards zod's email validator
  // permits in a local-part (e.g. "a_min@x.com" would match "admin@x.com"),
  // which could attach this grant to the wrong person's account.
  const email = parsed.data.email.toLowerCase();
  const { data: existingProfile } = await client.from("profiles").select("id").eq("email", email).maybeSingle();

  let profileId: string;
  let created = false;
  let tempPassword: string | undefined;

  if (existingProfile) {
    profileId = String(existingProfile.id);
  } else {
    const fullName = parsed.data.fullName?.trim();
    if (!fullName) return actionFailure("ไม่พบบัญชีนี้ในระบบ กรุณากรอกชื่อเพื่อสร้างบัญชีใหม่", { fullName: ["กรุณากรอกชื่อ"] });

    const project = await getProjectById(parsed.data.projectId);
    if (!project) return actionFailure("ไม่พบโครงการนี้");

    tempPassword = generateTempPassword();
    const createdAuthUser = await client.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (createdAuthUser.error) return actionFailure(`สร้างบัญชีเข้าสู่ระบบไม่สำเร็จ: ${createdAuthUser.error.message}`);
    const authUserId = createdAuthUser.data.user?.id ?? null;

    const { data: newProfile, error: profileError } = await client
      .from("profiles")
      .insert({ auth_user_id: authUserId, organization_id: project.organizationId, full_name: fullName, email, status: authUserId ? "active" : "invited", metadata: { source: "project_member_invite" } })
      .select("id")
      .single();
    if (profileError || !newProfile) {
      if (authUserId) await client.auth.admin.deleteUser(authUserId);
      return actionFailure(getDatabaseErrorMessage(profileError, "สร้างบัญชีผู้ใช้ไม่สำเร็จ"));
    }
    profileId = String(newProfile.id);
    created = true;
  }

  const { error: insertError } = await client.from("project_members").insert({
    project_id: parsed.data.projectId,
    profile_id: profileId,
    role_id: role.id,
    system_key: parsed.data.systemKey,
    status: "active"
  });
  if (insertError) {
    if (/duplicate key|unique/i.test(insertError.message)) {
      return actionFailure("บุคคลนี้มีบทบาทในระบบนี้ของโครงการนี้อยู่แล้ว");
    }
    return actionFailure(getDatabaseErrorMessage(insertError, "เพิ่มสมาชิกไม่สำเร็จ"));
  }

  return actionSuccess({ profileId, created, tempPassword });
}

const issueHelperSchema = z
  .object({
    projectId: z.string().uuid(),
    systemKey: z.enum(["ground_transfer", "airport_transfer"]),
    roleKey: z.string().min(1),
    fullName: z.string().trim().min(1, "กรุณาระบุชื่อ"),
    nickname: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    pin: z.string().regex(/^\d{4,6}$/, "รหัส PIN ต้องเป็นตัวเลข 4-6 หลัก")
  })
  .superRefine(roleMatchesSystem);

export async function issueProjectHelperAction(input: unknown): Promise<ActionResult<{ profileId: string; helperUrl: string }>> {
  const parsed = issueHelperSchema.safeParse(input);
  if (!parsed.success) return actionFailure("ข้อมูลไม่ครบถ้วน", parsed.error.flatten().fieldErrors);

  const permission = await canManageProjectMembers(parsed.data.projectId);
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์เพิ่มผู้ช่วยงานในโครงการนี้");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data: role, error: roleError } = await client.from("roles").select("id").eq("role_key", parsed.data.roleKey).maybeSingle();
  if (roleError || !role) return actionFailure("ไม่พบบทบาทนี้ในระบบ");

  // A project helper is a profiles row with no auth_user_id — the same shape
  // a driver's profile already has (drivers never sign in either). profiles
  // has no nickname column (that lives on drivers), so it goes into metadata.
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .insert({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      auth_user_id: null,
      metadata: parsed.data.nickname ? { nickname: parsed.data.nickname } : {}
    })
    .select("id")
    .single();
  if (profileError || !profile) return actionFailure(getDatabaseErrorMessage(profileError, "สร้างข้อมูลผู้ช่วยงานไม่สำเร็จ"));

  const { error: memberError } = await client.from("project_members").insert({
    project_id: parsed.data.projectId,
    profile_id: profile.id,
    role_id: role.id,
    system_key: parsed.data.systemKey,
    status: "active"
  });
  if (memberError) return actionFailure(getDatabaseErrorMessage(memberError, "เพิ่มสมาชิกไม่สำเร็จ"));

  const issued = await issueProjectHelperToken(parsed.data.projectId, String(profile.id), parsed.data.pin);
  if (!issued) return actionFailure("ออกลิงก์เข้าใช้งานไม่สำเร็จ");

  return actionSuccess({ profileId: String(profile.id), helperUrl: `/helper/${issued.rawToken}` });
}
