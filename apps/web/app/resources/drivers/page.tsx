import { PageHeader } from "@/components/page-header";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { DriverCardSummary } from "@/components/resources/driver-card-summary";
import { getDrivers } from "@/lib/data/resources";

export default async function DriversPage() {
  const drivers = await getDrivers();

  return (
    <>
      <PageHeader eyebrow="ทรัพยากร" title="คนขับ" description="จัดการข้อมูลคนขับสำหรับการมอบหมายงานและการเข้าถึงผ่าน QR" />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateDriverForm />
        <section className="grid gap-3">
          {drivers.length ? drivers.map((driver) => <DriverCardSummary key={driver.id} driver={driver} />) : <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">ยังไม่มีข้อมูลคนขับ</p>}
        </section>
      </div>
    </>
  );
}
