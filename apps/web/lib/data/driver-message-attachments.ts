import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface DriverMessageAttachment {
  type: "photo";
  storagePath: string;
  signedUrl?: string | null;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  placeName?: string | null;
  hasLocation?: boolean;
  stampApplied?: boolean;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function attachmentFromMetadata(metadata: Record<string, unknown>): DriverMessageAttachment | null {
  const raw = metadata.attachment;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const attachment = raw as Record<string, unknown>;
  if (attachment.type !== "photo" || typeof attachment.storagePath !== "string" || !attachment.storagePath.trim()) return null;
  return {
    type: "photo",
    storagePath: attachment.storagePath,
    capturedAt: typeof attachment.capturedAt === "string" ? attachment.capturedAt : null,
    latitude: numberOrNull(attachment.latitude),
    longitude: numberOrNull(attachment.longitude),
    accuracy: numberOrNull(attachment.accuracy),
    placeName: typeof attachment.placeName === "string" ? attachment.placeName : null,
    hasLocation: attachment.hasLocation === true,
    stampApplied: attachment.stampApplied !== false
  };
}

export async function signDriverMessageAttachments<T extends { attachment?: DriverMessageAttachment | null }>(items: T[]): Promise<T[]> {
  const paths = Array.from(new Set(items.map((item) => item.attachment?.storagePath).filter((path): path is string => Boolean(path))));
  if (!paths.length) return items;

  const { client } = getSupabaseWriteClient();
  if (!client) return items;

  const { data } = await client.storage.from("driver-evidence").createSignedUrls(paths, 3600);
  const signed = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }

  return items.map((item) =>
    item.attachment
      ? {
          ...item,
          attachment: {
            ...item.attachment,
            signedUrl: signed.get(item.attachment.storagePath) ?? null
          }
        }
      : item
  );
}
