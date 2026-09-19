import { AccessDenied } from "@/components/auth/access-denied";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { getViewerAccess } from "@/lib/auth/access";

// Same gate as apps/web/app/(app)/superadmin/layout.tsx (and the sibling
// apps/web/app/(app)/permission/layout.tsx). dev-tools moved out from under
// /superadmin to /ground-transfer/superadmin/dev-tools, which means it is no
// longer nested under superadmin/layout.tsx's route segment and would
// otherwise lose its super_admin-only gate entirely. This reproduces that
// gate at the new location rather than weakening it.
export default async function GroundTransferSuperadminLayout({ children }: { children: React.ReactNode }) {
  const { roleKeys } = await getViewerAccess();
  if (!roleKeys.includes("super_admin")) {
    return <AccessDenied requiredRole="ผู้ดูแลแพลตฟอร์ม" reason="ส่วนนี้สำหรับทีมแพลตฟอร์มเท่านั้น" />;
  }
  return <SuperadminShell>{children}</SuperadminShell>;
}
