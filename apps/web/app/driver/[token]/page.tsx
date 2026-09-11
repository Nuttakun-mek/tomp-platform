import { redirect } from "next/navigation";

interface DriverTokenPageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DriverTokenPage({ params, searchParams }: DriverTokenPageProps) {
  const { token } = await params;
  const query = new URLSearchParams();
  query.set("token", token);
  const paramsRecord = searchParams ? await searchParams : {};
  for (const [key, value] of Object.entries(paramsRecord)) {
    if (key === "token" || value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else {
      query.set(key, value);
    }
  }
  redirect(`/driver?${query.toString()}`);
}
