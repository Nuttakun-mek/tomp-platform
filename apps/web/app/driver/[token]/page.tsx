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
        description={driverAccess.tokenValidated ? "Assignment-scoped access verified for this driver card." : "Demo or invalid token access. Production QR tokens must be generated from assignment planning."}
      />
      {!driverAccess.tokenValidated && token.startsWith("tomp_") ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-900">
          This driver access link is invalid, expired, or revoked. Please contact operations for a new QR link.
        </section>
      ) : (
        <>
          {!driverAccess.tokenValidated ? (
            <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              Demo token mode is active. Generate an assignment-scoped QR token before pilot use.
            </div>
          ) : null}
          <DriverCard driverAccess={driverAccess} />
        </>
      )}
    </>
  );
}
