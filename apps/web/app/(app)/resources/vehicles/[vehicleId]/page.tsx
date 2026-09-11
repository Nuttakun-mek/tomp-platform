import { VehicleProfileDetail } from "@/components/resources/vehicle-profile-detail";

interface VehicleProfilePageProps {
  params: Promise<{ vehicleId: string }>;
}

// This used to redirect to /resources/vehicle?vehicleId=… because the legacy
// root vercel.json served the pretty URL through a rewrite, and its builds+routes
// config could not match a nested dynamic segment. That config went with the
// move to apps/web/vercel.json, so the nested route resolves natively now and
// the hop only cost a round trip on every vehicle opened.
export default async function VehicleProfilePage({ params }: VehicleProfilePageProps) {
  const { vehicleId } = await params;
  return <VehicleProfileDetail vehicleId={vehicleId} />;
}
