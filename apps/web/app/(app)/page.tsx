import Link from "next/link";
import { CarFront, PlaneTakeoff } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getViewerAccess } from "@/lib/auth/access";
import { getViewerSystemKeys } from "@/lib/data/project-systems";

const ICONS: Record<string, typeof CarFront> = { CarFront, PlaneTakeoff };

interface SystemRow {
  key: string;
  labelTh: string;
  icon: string;
  route: string;
}

async function getActiveSystems(): Promise<SystemRow[]> {
  const { resolveReadClient } = await import("@/lib/supabase/scoped-client");
  const { client } = await resolveReadClient();
  if (!client) return [
    { key: "ground_transfer", labelTh: "Ground Transfer", icon: "CarFront", route: "ground-transfer" },
    { key: "airport_transfer", labelTh: "Airport Transfer", icon: "PlaneTakeoff", route: "airport-transfer" }
  ];
  const { data } = await client.from("systems").select("key, label_th, icon, route").eq("is_active", true).order("sort_order");
  return (data ?? []).map((row) => ({ key: String(row.key), labelTh: String(row.label_th), icon: String(row.icon), route: String(row.route) }));
}

export default async function RootPage() {
  const [systems, profile, { roleKeys }] = await Promise.all([getActiveSystems(), getCurrentUserProfile(), getViewerAccess()]);
  const isSuperAdmin = roleKeys.includes("super_admin");
  const viewerSystems = isSuperAdmin ? systems.map((s) => s.key) : await getViewerSystemKeys(profile.id);

  return (
    <div className="grid min-h-[70vh] content-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">Transportation Operations Management Platform</h1>
        <p className="mt-1 text-sm text-slate-500">เลือกระบบที่ต้องการเข้าใช้งาน</p>
      </div>
      <div className="mx-auto flex flex-wrap justify-center gap-4">
        {systems.map((system) => {
          const Icon = ICONS[system.icon] ?? CarFront;
          const unlocked = viewerSystems.includes(system.key);
          if (!unlocked) {
            return (
              <div key={system.key} className="grid w-48 place-items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center opacity-60">
                <Icon className="h-8 w-8 text-slate-400" />
                <p className="font-semibold text-slate-500">{system.labelTh}</p>
                <p className="text-xs text-slate-400">🔒 ติดต่อผู้ดูแลระบบ</p>
              </div>
            );
          }
          return (
            <Link key={system.key} href={`/${system.route}`} className="grid w-48 place-items-center gap-2 rounded-2xl border border-border bg-white p-6 text-center shadow-sm transition hover:border-operation hover:shadow-md">
              <Icon className="h-8 w-8 text-operation" />
              <p className="font-semibold text-ink">{system.labelTh}</p>
              <p className="text-xs text-slate-500">เข้าใช้งาน</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
