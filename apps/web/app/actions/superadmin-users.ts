"use server";

import { revalidatePath } from "next/cache";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { provisionUser, resetUserPassword, validateProvisionInput } from "@/lib/superadmin/users";

export async function provisionUserAction(input: unknown): Promise<ActionResult> {
  const permission = await requirePermission("admin.manage_users");
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์จัดการผู้ใช้");
  }

  const validated = validateProvisionInput(input);
  if (!validated.ok) return actionFailure(validated.error);

  const result = await provisionUser(validated.value);
  if (!result.ok) return actionFailure(result.error);

  revalidatePath("/superadmin/users");
  return actionSuccess({ profileId: result.profileId, tempPassword: result.tempPassword });
}

export async function resetUserPasswordAction(profileId: unknown): Promise<ActionResult> {
  const permission = await requirePermission("admin.manage_users");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์จัดการผู้ใช้");

  const id = String(profileId ?? "").trim();
  if (!id) return actionFailure("ไม่พบผู้ใช้");
  // Resetting your own account swaps the password you know for a random one
  // shown once — that is how a super admin locked themselves out. Your own
  // password is changed on /account/password, which asks you to type it.
  const viewer = await getCurrentUserProfile();
  if (viewer.id === id) return actionFailure("เปลี่ยนรหัสผ่านของตัวเองที่หน้า “เปลี่ยนรหัสผ่าน” แทน");

  const result = await resetUserPassword(id);
  if (!result.ok) return actionFailure(result.error);

  return actionSuccess({ tempPassword: result.tempPassword });
}
