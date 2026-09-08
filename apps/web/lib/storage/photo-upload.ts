import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readCleanEnv } from "@/lib/env";

export interface UploadDriverEvidenceInput {
  projectId: string;
  assignmentId: string;
  kind: "vehicle" | "plate";
  file: File;
}

// A dedicated storage client — the shared write client wraps fetch in a 4s
// timeout which is too short for a photo upload on a mobile connection.
function getStorageClient() {
  const url = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const key = readCleanEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function uploadDriverEvidencePhoto(
  input: UploadDriverEvidenceInput
): Promise<{ success: boolean; path?: string; publicUrl?: string; error?: string }> {
  const client = getStorageClient();
  if (!client) return { success: false, error: "Supabase is not configured for storage uploads." };

  const extension = (input.file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${input.projectId}/${input.assignmentId}/${input.kind}-${Date.now()}.${extension}`;

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error: uploadError } = await client.storage
    .from("driver-evidence")
    .upload(path, bytes, {
      cacheControl: "3600",
      upsert: true,
      contentType: input.file.type || "image/jpeg"
    });

  if (uploadError) return { success: false, error: uploadError.message };
  return { success: true, path };
}
