import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { validatePhotoFile } from "@/lib/storage/checkin-photos";
import { uploadDriverEvidencePhoto } from "@/lib/storage/photo-upload";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const projectId = typeof form?.get("projectId") === "string" ? String(form.get("projectId")) : "";
  const assignmentId = typeof form?.get("assignmentId") === "string" ? String(form.get("assignmentId")) : "";
  const file = form?.get("file");

  if (!projectId || !assignmentId) {
    return NextResponse.json({ success: false, error: "ข้อมูลโครงการหรืองานไม่ครบ" }, { status: 400 });
  }

  const permission = await requirePermission(projectId, "assignment.update");
  if (!permission.allowed) {
    return NextResponse.json({ success: false, error: permission.reason || "คุณไม่มีสิทธิ์แนบรูปถึงคนขับในโครงการนี้" }, { status: 403 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: "ยังไม่ได้เลือกรูป" }, { status: 400 });
  }

  const validation = validatePhotoFile(file);
  if (!validation.valid) return NextResponse.json({ success: false, error: validation.error || "ไฟล์รูปไม่ถูกต้อง" }, { status: 400 });

  const upload = await uploadDriverEvidencePhoto({
    projectId,
    assignmentId,
    kind: "message",
    file
  });

  if (!upload.success || !upload.path) {
    return NextResponse.json({ success: false, error: upload.error || "อัปโหลดรูปไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      storagePath: upload.path,
      capturedAt: typeof form?.get("capturedAt") === "string" ? form.get("capturedAt") : new Date().toISOString()
    }
  });
}
