import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { buildImportTemplate } from "@/lib/airport-transfer/import/workbook";
import { getProjectByCode } from "@/lib/data/projects";

// The form a customer fills in and sends back. Built on request from
// lib/airport-transfer/import/columns.ts, so it always matches the importer.
export async function GET(_request: Request, { params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) return new Response("ไม่พบโครงการ", { status: 404 });
  const access = await getAirportTransferAccess(project.id);
  if (!access.allowed) return new Response("ไม่มีสิทธิ์", { status: 403 });

  const buffer = await buildImportTemplate({ projectCode: project.projectCode, projectName: project.projectName });
  const fileName = `TOMP-airport-transfer-${project.projectCode}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store"
    }
  });
}
