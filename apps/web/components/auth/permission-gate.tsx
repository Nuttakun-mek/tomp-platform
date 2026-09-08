import type { ReactNode } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { getViewerAccess } from "@/lib/auth/access";

interface PermissionGateProps {
  children: ReactNode;
  anyPermission?: string[];
  anyRole?: string[];
  fallback?: ReactNode;
}

export async function PermissionGate({ children, anyPermission, anyRole, fallback }: PermissionGateProps) {
  const { permissions, roleKeys } = await getViewerAccess();

  const ok =
    (!anyPermission && !anyRole) ||
    permissions.includes("*") ||
    (anyPermission?.some((p) => permissions.includes(p)) ?? false) ||
    (anyRole?.some((r) => roleKeys.includes(r)) ?? false);

  if (ok) return <>{children}</>;
  return <>{fallback ?? <AccessDenied requiredRole={anyRole?.join(", ")} />}</>;
}
