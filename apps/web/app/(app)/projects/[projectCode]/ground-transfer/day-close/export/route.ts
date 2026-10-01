import { requirePermission } from "@/lib/auth/rbac";
import { bangkokToday, getDayClose, getDayCloseRange } from "@/lib/data/day-close";
import { getProjectByCode } from "@/lib/data/projects";
import { filterDayCloseDays, summarizeByUnit } from "@/lib/domain/day-close";
import { describeDayCloseFilter, parseDayCloseFilter } from "@/lib/domain/day-close-filter";
import { buildDayCloseRangeWorkbook, buildDayCloseWorkbook } from "@/lib/export/day-close-workbook";

function xlsx(buffer: Buffer, fileName: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store"
    }
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) return new Response("ไม่พบโครงการ", { status: 404 });
  const permission = await requirePermission(project.id, "assignment.read");
  if (!permission.allowed) return new Response(permission.reason || "ไม่มีสิทธิ์", { status: 403 });

  const search = new URL(request.url).searchParams;

  // The project view: every day in the range, as filtered on screen — a
  // summary sheet, a per-Call-Sign sheet, then one sheet per day.
  if (search.get("view") === "range") {
    const params: Record<string, string | string[]> = {};
    for (const key of new Set(search.keys())) {
      const values = search.getAll(key);
      params[key] = values.length > 1 ? values : values[0];
    }
    const today = bangkokToday();
    const filter = parseDayCloseFilter(params, { from: project.startDate || today, to: project.endDate || today });
    const range = await getDayCloseRange(project.id, filter.from, filter.to);
    const days = filterDayCloseDays(range.days, filter);
    const labelById = new Map(range.units.map((unit) => [unit.id, unit.label]));
    const buffer = await buildDayCloseRangeWorkbook({
      projectCode: project.projectCode,
      projectName: project.projectName,
      from: filter.from,
      to: filter.to,
      days,
      units: summarizeByUnit(days),
      filterNote: describeDayCloseFilter(filter, (id) => labelById.get(id) ?? id.slice(0, 8))
    });
    return xlsx(buffer, `TOMP-day-close-${project.projectCode}-${filter.from}_${filter.to}.xlsx`);
  }

  const date = search.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("ระบุวันที่ในรูปแบบ YYYY-MM-DD", { status: 400 });
  const { rows, totals } = await getDayClose(project.id, date);
  const buffer = await buildDayCloseWorkbook({ projectCode: project.projectCode, projectName: project.projectName, date, rows, totals });
  return xlsx(buffer, `TOMP-day-close-${project.projectCode}-${date}.xlsx`);
}
