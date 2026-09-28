import { requirePermission } from "@/lib/auth/rbac";
import { getDayClose } from "@/lib/data/day-close";
import { getProjectByCode } from "@/lib/data/projects";
import { buildDayCloseWorkbook } from "@/lib/export/day-close-workbook";

export async function GET(request: Request, { params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) return new Response("ไม่พบโครงการ", { status: 404 });
  const permission = await requirePermission(project.id, "assignment.read");
  if (!permission.allowed) return new Response(permission.reason || "ไม่มีสิทธิ์", { status: 403 });

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("ระบุวันที่ในรูปแบบ YYYY-MM-DD", { status: 400 });

  const { rows, totals } = await getDayClose(project.id, date);
  const buffer = await buildDayCloseWorkbook({ projectCode: project.projectCode, projectName: project.projectName, date, rows, totals });
  const fileName = `TOMP-day-close-${project.projectCode}-${date}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store"
    }
  });
}
