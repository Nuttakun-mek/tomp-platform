import { PageHeader } from "@/components/page-header";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { VehicleCardSummary } from "@/components/resources/vehicle-card-summary";
import { getVehicles } from "@/lib/data/resources";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();

  return (
    <>
      <PageHeader eyebrow="Resources" title="Vehicles" description="Vehicle resource foundation for assignment readiness and operational coordination." />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateVehicleForm />
        <section className="grid gap-3">
          {vehicles.map((vehicle) => <VehicleCardSummary key={vehicle.id} vehicle={vehicle} />)}
        </section>
      </div>
    </>
  );
}
