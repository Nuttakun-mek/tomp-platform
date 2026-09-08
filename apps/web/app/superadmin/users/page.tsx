import { PageHeader } from "@/components/page-header";
import { InviteUserForm } from "@/components/superadmin/invite-user-form";
import { UserList } from "@/components/superadmin/user-list";
import { getProjects } from "@/lib/data/projects";
import { listProfilesWithRoles } from "@/lib/superadmin/users";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export default async function SuperadminUsersPage() {
  const [rows, projects] = await Promise.all([listProfilesWithRoles(), getProjects()]);
  const client = getSupabaseServerDataClient();
  const orgResult = client ? await client.from("organizations").select("id, name").order("name") : { data: [] };
  const orgRows = (orgResult.data || []) as Array<Record<string, unknown>>;

  const organizations = orgRows.map((o) => ({ id: String(o.id), label: String(o.name) }));
  const projectOptions = projects.map((p) => ({ id: p.id, label: `${p.projectCode} · ${p.projectName}` }));

  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="ผู้ใช้และสิทธิ์"
        description="เพิ่มผู้ใช้ กำหนดบทบาทระดับองค์กรและโครงการ ผู้ใช้จะเข้าสู่ระบบด้วยอีเมลเดียวกันเพื่อเปิดใช้บัญชี"
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:items-start">
        <InviteUserForm organizations={organizations} projects={projectOptions} />
        <UserList rows={rows} />
      </div>
    </>
  );
}
