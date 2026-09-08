"use server";

import { revalidatePath } from "next/cache";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
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

  const result = await resetUserPassword(id);
  if (!result.ok) return actionFailure(result.error);

  return actionSuccess({ tempPassword: result.tempPassword });
}
