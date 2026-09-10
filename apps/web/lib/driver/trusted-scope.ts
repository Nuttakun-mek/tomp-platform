import "server-only";

import type { DriverSessionContext } from "@/lib/api/driver-token";

const DRIVER_SCOPE_BRAND: unique symbol = Symbol("trusted-driver-scope");

export type DriverScope = Pick<DriverSessionContext, "projectId" | "assignmentId" | "driverId" | "callSignId">;
export type TrustedDriverScope = DriverScope & { [DRIVER_SCOPE_BRAND]: true };

export function trustedDriverScope(context: DriverSessionContext): TrustedDriverScope {
  return {
    projectId: context.projectId,
    assignmentId: context.assignmentId,
    driverId: context.driverId,
    callSignId: context.callSignId || null,
    [DRIVER_SCOPE_BRAND]: true
  };
}

export function isTrustedDriverScope(value: TrustedDriverScope | undefined): value is TrustedDriverScope {
  return Boolean(value?.[DRIVER_SCOPE_BRAND]);
}
