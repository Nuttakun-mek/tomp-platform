import { AccessDenied } from "@/components/auth/access-denied";
import { getViewerAccess } from "@/lib/auth/access";

const PORTAL_ROLES = ["organizer", "customer_viewer", "super_admin"];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { roleKeys } = await getViewerAccess();
  if (!roleKeys.some((roleKey) => PORTAL_ROLES.includes(roleKey))) {
    return <AccessDenied requiredRole="ผู้จัดงาน / ฝั่งลูกค้า" reason="พื้นที่นี้สำหรับผู้จัดงานและผู้ชมฝั่งลูกค้า" />;
  }
  return <>{children}</>;
}
