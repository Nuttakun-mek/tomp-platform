"use server";

import { revalidatePath } from "next/cache";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getViewerAccess } from "@/lib/auth/access";
import { purgeSmokeTestRows } from "@/lib/superadmin/purge-test-data";

const CONFIRM_PHRASE = "ล้างข้อมูลทดสอบ";

export async function purgeTestDataAction(input: unknown): Promise<ActionResult> {
  const { roleKeys } = await getViewerAccess();
  if (!roleKeys.includes("super_admin")) return actionFailure("เฉพาะทีมแพลตฟอร์มเท่านั้น");

  const confirm = String((input as { confirm?: string })?.confirm ?? "").trim();
  if (confirm !== CONFIRM_PHRASE) return actionFailure(`พิมพ์ "${CONFIRM_PHRASE}" เพื่อยืนยัน`);

  const result = await purgeSmokeTestRows();
  if (!result.ok) return actionFailure(result.error);

  revalidatePath("/superadmin/dev-tools/purge-test-data");
  return actionSuccess({ deleted: result.deleted });
}
