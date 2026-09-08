import { redirect } from "next/navigation";

interface VehicleProfilePageProps {
  params: Promise<{ vehicleId: string }>;
}

// Pretty URL shim. On production this route is shadowed by a vercel.json rewrite
// to /resources/vehicle?vehicleId=...; locally we redirect so both behave alike.
export default async function VehicleProfilePage({ params }: VehicleProfilePageProps) {
  const { vehicleId } = await params;
  redirect(`/resources/vehicle?vehicleId=${encodeURIComponent(vehicleId)}`);
}
