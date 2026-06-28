import { PageHeader } from "@/components/page-header";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { ResourceListPlaceholder } from "@/components/resources/resource-list-placeholder";

export default function DriversPage() {
  return (
    <>
      <PageHeader eyebrow="Resources" title="Drivers" description="Driver resource foundation. QR access and assignment scope come later." />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateDriverForm />
        <ResourceListPlaceholder title="Driver List" items={[{ name: "Demo Driver", detail: "+66111111111 / TH, EN", status: "Available" }]} />
      </div>
    </>
  );
}
