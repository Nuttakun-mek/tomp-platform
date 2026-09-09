import { NextResponse } from "next/server";
import { resolveDriverSession } from "@/lib/api/driver-token";
import { uploadPlatePhoto, uploadVehiclePhoto } from "@/lib/storage/checkin-photos";

export const maxDuration = 30;

// Token-authed evidence upload for the QR driver page. Project/assignment come
// from the token, never the client. Photos are compressed client-side first.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
  }

  const kind = String(form.get("kind") || "");
  const file = form.get("file");

  if (kind !== "vehicle" && kind !== "plate") return NextResponse.json({ success: false, error: "ประเภทรูปไม่ถูกต้อง" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ success: false, error: "ยังไม่ได้เลือกรูป" }, { status: 400 });

  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const upload =
    kind === "vehicle"
      ? await uploadVehiclePhoto(auth.context.projectId, auth.context.assignmentId, file)
      : await uploadPlatePhoto(auth.context.projectId, auth.context.assignmentId, file);

  if (!upload.success) {
    return NextResponse.json({ success: false, error: upload.error || "อัปโหลดรูปไม่สำเร็จ" }, { status: 500 });
  }
  return NextResponse.json({ success: true, kind, path: upload.path });
}
