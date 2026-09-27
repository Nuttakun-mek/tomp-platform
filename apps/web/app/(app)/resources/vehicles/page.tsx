import { redirect } from "next/navigation";

// This board repeated the control room: the same units, their jobs and a second
// live map, gathered across every project. Live work is followed in each
// project's ศูนย์ควบคุม; a vehicle's history is its own page,
// /resources/vehicles/[vehicleId]. Old links land on the resource library.
export default function VehiclesPage() {
  redirect("/resources");
}
