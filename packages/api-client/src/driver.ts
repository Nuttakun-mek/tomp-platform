import type { DriverAssignmentPacket, DriverEvidencePhoto, DriverIssueReport } from "@tomp/types/domain";

function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented. Use apps/web server actions until the shared API is wired.`);
}

export async function fetchDriverAssignmentByToken(_token: string): Promise<DriverAssignmentPacket> {
  return notImplemented("fetchDriverAssignmentByToken");
}

export async function submitDriverReadiness(_input: unknown): Promise<void> {
  return notImplemented("submitDriverReadiness");
}

export async function submitDriverStatusUpdate(_input: unknown): Promise<void> {
  return notImplemented("submitDriverStatusUpdate");
}

export async function submitDriverIssueReport(_input: DriverIssueReport): Promise<void> {
  return notImplemented("submitDriverIssueReport");
}

export async function submitDriverPhotoEvidence(_input: DriverEvidencePhoto): Promise<void> {
  return notImplemented("submitDriverPhotoEvidence");
}
