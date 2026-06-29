import "server-only";

import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface UploadDriverEvidenceInput {
  projectId: string;
  assignmentId: string;
  kind: "vehicle" | "plate";
  file: File;
}

export async function uploadDriverEvidencePhoto(input: UploadDriverEvidenceInput): Promise<{ success: boolean; path?: string; publicUrl?: string; error?: string }> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return { success: false, error: error || "Supabase is not configured for storage uploads." };

  const extension = input.file.name.split(".").pop() || "jpg";
  const path = `${input.projectId}/${input.assignmentId}/${input.kind}-${Date.now()}.${extension}`;
  const { error: uploadError } = await client.storage
    .from("driver-evidence")
    .upload(path, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || "image/jpeg"
    });

  if (uploadError) return { success: false, error: uploadError.message };

  return { success: true, path };
}

