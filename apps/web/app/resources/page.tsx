import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Prepare"
        title="Resources"
        description="Drivers, vehicles, and call signs are prepared here as Sprint 2 foundation pages."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation" href="/resources/drivers">
          <h2 className="text-lg font-semibold text-ink">Drivers</h2>
          <p className="mt-2 text-sm text-slate-600">Driver records and readiness placeholders.</p>
        </Link>
        <Link className="rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation" href="/resources/vehicles">
          <h2 className="text-lg font-semibold text-ink">Vehicles</h2>
          <p className="mt-2 text-sm text-slate-600">Vehicle records and check-in placeholders.</p>
        </Link>
      </div>
    </>
  );
}
