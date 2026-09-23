"use server";

import { z } from "zod";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    path: ["confirmPassword"]
  });

// Self-service password change for the SIGNED-IN account only — never takes a
// target profile id. A project-helper or driver profile (auth_user_id null,
// docs/11-codex/984's "lightweight" grant path) never reaches this page
// through normal navigation, but the action itself still refuses defensively
// rather than trusting the caller.
export async function changeOwnPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return actionFailure(parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง", parsed.error.flatten().fieldErrors);

  const profile = await getCurrentUserProfile();
  if (!profile.authUserId) return actionFailure("บัญชีนี้ไม่มีการเข้าสู่ระบบด้วยรหัสผ่าน");

  const client = getSupabaseServerDataClient();
  if (!client) return actionFailure("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล");

  const { error } = await client.auth.admin.updateUserById(profile.authUserId, { password: parsed.data.newPassword });
  if (error) return actionFailure(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}`);

  return actionSuccess({});
}
