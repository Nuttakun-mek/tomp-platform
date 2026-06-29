import { PageHeader } from "@/components/page-header";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { VehicleCardSummary } from "@/components/resources/vehicle-card-summary";
import { getVehicles } from "@/lib/data/resources";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();

  return (
    <>
      <PageHeader eyebrow="ทรัพยากร" title="รถ" description="จัดการข้อมูลรถสำหรับการจัดสรรงาน ความพร้อม และการประสานงานปฏิบัติการ" />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateVehicleForm />
        <section className="grid gap-3">
          {vehicles.length ? vehicles.map((vehicle) => <VehicleCardSummary key={vehicle.id} vehicle={vehicle} />) : <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">ยังไม่มีข้อมูลรถ</p>}
        </section>
      </div>
    </>
  );
}
