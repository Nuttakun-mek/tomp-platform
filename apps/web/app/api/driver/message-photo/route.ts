import { NextResponse } from "next/server";
import { resolveDriverSession } from "@/lib/api/driver-token";
import { validatePhotoFile } from "@/lib/storage/checkin-photos";
import { uploadDriverEvidencePhoto } from "@/lib/storage/photo-upload";

export async function POST(request: Request) {
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: "ยังไม่ได้เลือกรูป" }, { status: 400 });
  }

  const validation = validatePhotoFile(file);
  if (!validation.valid) return NextResponse.json({ success: false, error: validation.error || "ไฟล์รูปไม่ถูกต้อง" }, { status: 400 });

  const upload = await uploadDriverEvidencePhoto({
    projectId: auth.context.projectId,
    assignmentId: auth.context.assignmentId,
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
      capturedAt: typeof form?.get("capturedAt") === "string" ? form.get("capturedAt") : null
    }
  });
}
