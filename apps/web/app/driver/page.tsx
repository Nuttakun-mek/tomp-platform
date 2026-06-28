import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function DriverPage() {
  return (
    <>
      <PageHeader
        eyebrow="Field access demo"
        title="Driver"
        description="QR-based driver access placeholder. Demo route only; no token validation or assignment reads are implemented."
      />
      <Link className="inline-flex rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" href="/driver/demo-token">
        Open demo driver card
      </Link>
    </>
  );
}
