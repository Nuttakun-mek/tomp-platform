import { VehicleProfileDetail } from "@/components/resources/vehicle-profile-detail";

interface VehicleProfilePageProps {
  searchParams?: Promise<{ vehicleId?: string }>;
}

// Production serves the pretty URL /resources/vehicles/<id> through a vercel.json
// rewrite to /resources/vehicle?vehicleId=<id> (the legacy builds+routes config
// can't match nested dynamic segments on its own). The [vehicleId] route redirects
// here so local dev matches.
export default async function VehicleProfilePage({ searchParams }: VehicleProfilePageProps) {
  const params = searchParams ? await searchParams : {};
  return <VehicleProfileDetail vehicleId={params.vehicleId ?? ""} />;
}
