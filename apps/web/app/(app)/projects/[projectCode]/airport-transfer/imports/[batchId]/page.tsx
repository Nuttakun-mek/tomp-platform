import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ImportBatchView } from "@/components/airport-transfer/import/batch-view";
import { ImportSteps } from "@/components/airport-transfer/import/import-steps";
import { PageHeader } from "@/components/page-header";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getImportBatch } from "@/lib/airport-transfer/import/batch";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getProjectByCode } from "@/lib/data/projects";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import type { UnitOption } from "@/lib/airport-transfer/import/ops";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

// A re-check looks flights up again; an import writes one case per row.
export const maxDuration = 60;

const stamp = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });

export default async function AirportTransferImportBatchPage({ params }: { params: Promise<{ projectCode: string; batchId: string }> }) {
  const { projectCode, batchId } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const supabase = getSupabaseServerDataClient();
  const loaded = supabase ? await getImportBatch(supabase, batchId, project.id) : null;
  if (!loaded) notFound();
  const access = await getAirportTransferAccess(project.id);
  const { batch, rows } = loaded;

  // The project's Ground Transfer units, to send on these trips (none on an
  // Airport-Transfer-only project — a vehicle can still be typed in).
  const [callSigns, drivers, vehicles] = await Promise.all([getCallSignsByProjectId(project.id), getProjectDrivers(project.id), getProjectVehicles(project.id)]);
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const units: UnitOption[] = callSigns.data
    .filter((callSign) => callSign.status === "active")
    .map((callSign) => {
      const driver = callSign.driverId ? driverById.get(callSign.driverId) : undefined;
      const vehicle = callSign.vehicleId ? vehicleById.get(callSign.vehicleId) : undefined;
      return {
        id: callSign.id,
        label: callSign.callSign,
        plate: vehicle?.plateNumber ?? null,
        vehicleType: vehicle?.vehicleType ?? null,
        capacity: vehicle?.capacity ?? null,
        driverName: driver?.fullName ?? null,
        driverPhone: driver?.phone ?? null
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "th"));

  return (
    <>
      <Link href={`/projects/${projectCode}/airport-transfer/imports`} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-slate-500 hover:text-operation">
        <ArrowLeft className="h-4 w-4" /> ไฟล์ที่อัปโหลด
      </Link>
      <PageHeader
        eyebrow="นำเข้า Excel"
        title={batch.fileName}
        description={[
          batch.meta.clientName,
          batch.meta.isTemplate ? "แบบฟอร์มของระบบ" : `ไฟล์ของลูกค้า (ชีต ${batch.meta.sheetName})`,
          batch.meta.checkedAt ? `ตรวจล่าสุด ${stamp.format(new Date(batch.meta.checkedAt))}` : null
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <ImportSteps
        current={
          batch.status === "imported"
            ? 6
            : batch.status === "ready" && !rows.some((row) => row.status === "error" || row.status === "duplicate")
              ? 4
              : 3
        }
      />
      {access.canManage ? (
        <ImportBatchView projectId={project.id} projectCode={projectCode} batch={batch} rows={rows} units={units} />
      ) : (
        <p className="text-sm text-slate-500">ดูได้อย่างเดียว — นำเข้าได้เฉพาะผู้ดูแลหรือผู้จัดรถของโครงการ</p>
      )}
    </>
  );
}
