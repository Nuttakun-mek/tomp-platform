import { redirect } from "next/navigation";

interface DriverTokenPageProps {
  params: Promise<{ token: string }>;
}

export default async function DriverTokenPage({ params }: DriverTokenPageProps) {
  const { token } = await params;
  redirect(`/driver?token=${encodeURIComponent(token)}`);
}
