import Link from "next/link";
import { redirect } from "next/navigation";
import { CarFront, PlaneTakeoff, Plus } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getViewerAccess } from "@/lib/auth/access";
import { canCreateProject } from "@/lib/auth/rbac";
import { getViewerSystemKeys } from "@/lib/data/project-systems";

const ICONS: Record<string, typeof CarFront> = { CarFront, PlaneTakeoff };
const SYSTEM_COPY: Record<string, { label: string; description: string }> = {
  ground_transfer: { label: "ระบบจัดการรถรับส่ง", description: "จัดงานรถ คนขับ QR และศูนย์ควบคุม" },
  airport_transfer: { label: "ระบบรับส่งสนามบิน", description: "จัดเคสรับส่งผู้โดยสารตามเที่ยวบิน" }
};

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
    { key: "ground_transfer", labelTh: SYSTEM_COPY.ground_transfer.label, icon: "CarFront", route: "ground-transfer" },
    { key: "airport_transfer", labelTh: SYSTEM_COPY.airport_transfer.label, icon: "PlaneTakeoff", route: "airport-transfer" }
  ];
  const { data } = await client.from("systems").select("key, label_th, icon, route").eq("is_active", true).order("sort_order");
  return (data ?? []).map((row) => ({ key: String(row.key), labelTh: String(row.label_th), icon: String(row.icon), route: String(row.route) }));
}

export default async function RootPage() {
  const [systems, profile, { roleKeys }] = await Promise.all([getActiveSystems(), getCurrentUserProfile(), getViewerAccess()]);
  const isSuperAdmin = roleKeys.includes("super_admin");
  const viewerSystems = isSuperAdmin ? systems.map((s) => s.key) : await getViewerSystemKeys(profile.id);

  const unlockedSystems = systems.filter((system) => viewerSystems.includes(system.key));
  if (unlockedSystems.length === 1) {
    redirect(`/${unlockedSystems[0]!.route}`);
  }

  // A freshly provisioned global project_manager has zero project_members
  // rows at first login (nothing to unlock yet) — but their entire purpose
  // is to create their own first project. Don't leave that account staring
  // at an all-locked tile view; point it at /projects instead. Additive
  // only: accounts with no create permission keep the unchanged locked-tile
  // view below.
  const canCreate = unlockedSystems.length === 0 ? await canCreateProject() : false;

  return (
    <div className="grid min-h-[70vh] content-center gap-6 px-4">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-operation">TOMP</p>
        <h1 className="mt-1 text-xl font-bold text-ink">ศูนย์ปฏิบัติการขนส่ง</h1>
        <p className="mt-1 text-sm text-slate-500">เลือกระบบงานที่ต้องการเข้าใช้งาน</p>
      </div>
      <div className="mx-auto flex flex-wrap justify-center gap-4">
        {systems.map((system) => {
          const Icon = ICONS[system.icon] ?? CarFront;
          const unlocked = viewerSystems.includes(system.key);
          const copy = SYSTEM_COPY[system.key] ?? { label: system.labelTh, description: "เข้าใช้งานระบบ" };
          if (!unlocked) {
            return (
              <div key={system.key} className="grid w-48 place-items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center opacity-60">
                <Icon className="h-8 w-8 text-slate-400" />
                <p className="font-semibold text-slate-500">{copy.label}</p>
                <p className="text-xs leading-5 text-slate-400">{copy.description}</p>
                <p className="text-xs text-slate-400">🔒 ติดต่อผู้ดูแลระบบ</p>
              </div>
            );
          }
          return (
            <Link key={system.key} href={`/${system.route}`} className="grid w-48 place-items-center gap-2 rounded-2xl border border-border bg-white p-6 text-center shadow-sm transition hover:border-operation hover:shadow-md">
              <Icon className="h-8 w-8 text-operation" />
              <p className="font-semibold text-ink">{copy.label}</p>
              <p className="text-xs leading-5 text-slate-500">{copy.description}</p>
              <p className="text-xs font-semibold text-operation">เข้าใช้งาน</p>
            </Link>
          );
        })}
      </div>
      {unlockedSystems.length === 0 && canCreate ? (
        <div className="text-center">
          <Link
            href="/projects"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-operation px-4 py-2.5 text-sm font-semibold text-white hover:bg-operation-deep"
          >
            <Plus className="h-4 w-4" /> สร้างโครงการแรกของคุณ
          </Link>
        </div>
      ) : null}
    </div>
  );
}
