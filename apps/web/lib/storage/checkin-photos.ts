import "server-only";

import { uploadDriverEvidencePhoto } from "@/lib/storage/photo-upload";

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const maxBytes = 10 * 1024 * 1024;

export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  // Photos are compressed client-side before upload; this is the safety ceiling.
  if (file.type && !allowedTypes.includes(file.type)) return { valid: false, error: "รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP)" };
  if (file.size > maxBytes) return { valid: false, error: "รูปต้องไม่เกิน 10 MB" };
  return { valid: true };
}

export function getCheckinPhotoPath(projectId: string, assignmentId: string, kind: "vehicle" | "plate", extension = "jpg"): string {
  return `project/${projectId}/assignment/${assignmentId}/${kind}-${Date.now()}.${extension}`;
}

export async function uploadVehiclePhoto(projectId: string, assignmentId: string, file: File) {
  const validation = validatePhotoFile(file);
  if (!validation.valid) return { success: false, error: validation.error };
  return uploadDriverEvidencePhoto({ projectId, assignmentId, kind: "vehicle", file });
}

export async function uploadPlatePhoto(projectId: string, assignmentId: string, file: File) {
  const validation = validatePhotoFile(file);
  if (!validation.valid) return { success: false, error: validation.error };
  return uploadDriverEvidencePhoto({ projectId, assignmentId, kind: "plate", file });
}

