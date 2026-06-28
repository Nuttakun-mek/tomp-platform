import { PageHeader } from "@/components/page-header";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { DriverCardSummary } from "@/components/resources/driver-card-summary";
import { getDrivers } from "@/lib/data/resources";

export default async function DriversPage() {
  const drivers = await getDrivers();

  return (
    <>
      <PageHeader eyebrow="Resources" title="Drivers" description="Driver resource foundation. QR access and assignment scope come later." />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateDriverForm />
        <section className="grid gap-3">
          {drivers.map((driver) => <DriverCardSummary key={driver.id} driver={driver} />)}
        </section>
      </div>
    </>
  );
}
