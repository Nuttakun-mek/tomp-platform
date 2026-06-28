import { PageHeader } from "@/components/page-header";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ResourceListPlaceholder } from "@/components/resources/resource-list-placeholder";

export default function VehiclesPage() {
  return (
    <>
      <PageHeader eyebrow="Resources" title="Vehicles" description="Vehicle resource foundation. No fleet maintenance workflow is implemented." />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateVehicleForm />
        <ResourceListPlaceholder title="Vehicle List" items={[{ name: "DEMO-1001", detail: "Van / 8 seats", status: "Available" }]} />
      </div>
    </>
  );
}
