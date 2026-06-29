import { DriverCard } from "@/components/driver/driver-card";
import { PageHeader } from "@/components/page-header";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";

interface DriverTokenPageProps {
  params: Promise<{ token: string }>;
}

export default async function DriverTokenPage({ params }: DriverTokenPageProps) {
  const { token } = await params;
  const driverAccess = await getDriverAssignmentByToken(token);

  return (
    <>
      <PageHeader
        eyebrow="Driver Card"
        title="Assignment Access"
        description={`Token placeholder: ${token}. Validation is deliberately deferred.`}
      />
      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
        Sprint 7 placeholder: this token is not validated yet and must not be treated as production access control.
      </div>
      <DriverCard driverAccess={driverAccess} />
    </>
  );
}
