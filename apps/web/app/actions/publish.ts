"use server";

import { publishProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { requirePermission } from "@/lib/auth/rbac";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getOperationDaysByProjectId } from "@/lib/data/operation-days";
import { getProjectById } from "@/lib/data/projects";
import { checkProjectPublishReadiness } from "@/lib/domain/publish-readiness";
import { isProjectPublished } from "@/lib/domain/publish-locking";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

// Publish is a server-authoritative state transition, not a client-trusted
// write. The server loads the real project aggregate, runs the canonical
// readiness check, snapshots the actual rows, flips projects.status, and takes
// the lock. (Atomicity across these writes is the transactional-kernel batch;
// this at least makes each step correct and ordered.)
export async function publishProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = publishProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลการประกาศใช้แผนไม่ถูกต้อง", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(parsed.data.projectId, "project.publish");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์ประกาศใช้แผนของโครงการนี้");

  if (await isProjectPublished(parsed.data.projectId)) {
    return actionFailure("โครงการนี้ประกาศใช้แผนแล้ว การแก้ไขต้องผ่านคำขอเปลี่ยนแปลง");
  }

  const [project, operationDays, missions, assignments, callSigns] = await Promise.all([
    getProjectById(parsed.data.projectId),
    getOperationDaysByProjectId(parsed.data.projectId),
    getMissionsByProjectId(parsed.data.projectId),
    getAssignmentsByProjectId(parsed.data.projectId),
    getCallSignsByProjectId(parsed.data.projectId)
  ]);

  if (!project) return actionFailure("ไม่พบโครงการ");

  const readiness = checkProjectPublishReadiness({ project, operationDays, missions, assignments });
  if (!readiness.canPublish) {
    return actionFailure(`ยังประกาศใช้แผนไม่ได้: ${readiness.blockers.join(" · ")}`, { blockers: readiness.blockers });
  }

  // Snapshot the canonical rows — never the client payload.
  const snapshot = {
    capturedAt: new Date().toISOString(),
    project,
    operationDays,
    missions,
    assignments,
    callSigns,
    warnings: readiness.warnings
  };

  // Atomic command (migration 0026): snapshot + projects.status + publish_locks
  // + PROJECT_PUBLISHED (0025 trigger) commit together.
  const { data, error: rpcError } = await client.rpc("publish_project_command", {
    p_project_id: parsed.data.projectId,
    p_reason: parsed.data.reason,
    p_snapshot: snapshot,
    p_metadata: parsed.data.metadata
  });

  if (rpcError) {
    if (/project_already_published/.test((rpcError as { message?: string }).message || "")) {
      return actionFailure("โครงการนี้ประกาศใช้แผนแล้ว การแก้ไขต้องผ่านคำขอเปลี่ยนแปลง");
    }
    return actionFailure(`ประกาศใช้แผนไม่สำเร็จ: ${(rpcError as { message?: string }).message ?? ""}`);
  }

  const snapshotRow = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;

  return actionSuccess(
    { mode, publishSnapshot: snapshotRow },
    readiness.warnings.length ? `ประกาศแล้วแต่มีข้อควรระวัง: ${readiness.warnings.join(" · ")}` : undefined
  );
}
