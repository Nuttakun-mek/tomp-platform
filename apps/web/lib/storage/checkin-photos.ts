import "server-only";

import { uploadDriverEvidencePhoto } from "@/lib/storage/photo-upload";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) return { valid: false, error: "Only JPEG, PNG, and WebP images are allowed." };
  if (file.size > maxBytes) return { valid: false, error: "Photo must be 5 MB or smaller." };
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

