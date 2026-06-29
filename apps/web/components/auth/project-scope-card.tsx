import { PermissionChip } from "@/components/auth/permission-chip";
import { getUserProjectScope } from "@/lib/auth/rbac";

export async function ProjectScopeCard({ projectId }: { projectId: string }) {
  const scope = await getUserProjectScope(projectId);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-operation">ขอบเขตสิทธิ์ในโครงการ</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">{scope?.roleKey ?? "ยังไม่มีบทบาทในโครงการ"}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {scope?.isDevelopmentFallback ? "กำลังใช้สิทธิ์สำรองสำหรับการพัฒนา ต้องเปลี่ยนเป็น Supabase Auth จริงก่อน production" : "สิทธิ์ในโครงการควบคุมการเรียก server action ฝั่งระบบ"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(scope?.permissions.length ? scope.permissions.slice(0, 8) : ["project.read"]).map((permission) => (
          <PermissionChip key={permission} label={permission} allowed={Boolean(scope)} />
        ))}
      </div>
    </section>
  );
}
