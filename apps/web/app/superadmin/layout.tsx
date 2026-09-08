import { AccessDenied } from "@/components/auth/access-denied";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { getViewerAccess } from "@/lib/auth/access";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { roleKeys } = await getViewerAccess();
  if (!roleKeys.includes("super_admin")) {
    return <AccessDenied requiredRole="ผู้ดูแลแพลตฟอร์ม" reason="ส่วนนี้สำหรับทีมแพลตฟอร์มเท่านั้น" />;
  }
  return <SuperadminShell>{children}</SuperadminShell>;
}
