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
import { createPublishLock, isProjectPublished } from "@/lib/domain/publish-locking";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

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

  const { data: snapshotRow, error: insertError } = await client
    .from("publish_snapshots")
    .insert({
      project_id: parsed.data.projectId,
      object_type: "project",
      object_id: parsed.data.projectId,
      status: "published",
      reason: parsed.data.reason,
      snapshot_data: snapshot,
      metadata: { ...parsed.data.metadata, authoritative: true }
    })
    .select()
    .single();

  if (insertError) return actionFailure(`บันทึก snapshot ไม่สำเร็จ: ${insertError.message}`);

  const { error: statusError } = await client
    .from("projects")
    .update({ status: "published" })
    .eq("id", parsed.data.projectId)
    .in("status", ["draft", "planning"]);

  const lockResult = await createPublishLock(parsed.data.projectId, snapshotRow.id, parsed.data.reason);

  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "project",
    objectId: parsed.data.projectId,
    eventType: TIMELINE_EVENTS.PROJECT_PUBLISHED,
    source: "operation_user",
    reason: parsed.data.reason,
    afterData: { snapshotId: snapshotRow.id, status: "published" }
  });

  const warnings = [
    statusError ? `เปลี่ยนสถานะโครงการไม่สำเร็จ: ${statusError.message}` : null,
    lockResult.success ? null : `ล็อกแผนไม่สำเร็จ: ${lockResult.error}`,
    timelineResult.success ? null : `บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`,
    readiness.warnings.length ? `ประกาศแล้วแต่มีข้อควรระวัง: ${readiness.warnings.join(" · ")}` : null
  ].filter(Boolean);

  return actionSuccess(
    { mode, publishSnapshot: snapshotRow, publishLock: lockResult, timelineEvent: timelineResult.data },
    warnings.length ? warnings.join(" · ") : undefined
  );
}
