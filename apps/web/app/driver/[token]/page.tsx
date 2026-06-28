import { DriverCard } from "@/components/driver/driver-card";
import { PageHeader } from "@/components/page-header";

interface DriverTokenPageProps {
  params: Promise<{ token: string }>;
}

export default async function DriverTokenPage({ params }: DriverTokenPageProps) {
  const { token } = await params;

  return (
    <>
      <PageHeader
        eyebrow="Driver Card"
        title="Assignment Access"
        description={`Token placeholder: ${token}. Validation is deliberately deferred.`}
      />
      <DriverCard />
    </>
  );
}
