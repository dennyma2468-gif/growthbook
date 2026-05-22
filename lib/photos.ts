// lib/photos.ts — Save/load photos via Supabase Storage + memories table

import type { DisplayPhoto } from "@/lib/agents";
import { createClient, isSupabaseReady } from "@/lib/supabase/client";
import { getCachedWallId } from "@/lib/walls";

const BUCKET = "photos";

// Re-export wall helpers for components
export {
  normalizeWallCode,
  setActiveWallId as setWallId,
  getCachedWallId,
  getUserWalls,
  ensureUserWall,
  switchToWall,
  createWallForUser,
} from "@/lib/walls";

export type WallPhoto = DisplayPhoto & {
  imageUrl?: string;
};

type MemoryRow = {
  id: string;
  wall_id: string;
  storage_path: string;
  image_url: string;
  caption: string | null;
  tags: string[] | null;
  mime_type: string | null;
  keep: boolean;
  display_size: string;
  is_highlight: boolean;
  display_order: number;
};

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function rowToPhoto(row: MemoryRow): WallPhoto {
  return {
    id: row.id,
    base64: "",
    mimeType: row.mime_type || "image/jpeg",
    keep: row.keep,
    caption: row.caption || undefined,
    tags: row.tags || [],
    displaySize: row.display_size as "large" | "medium" | "small",
    isHighlight: row.is_highlight,
    displayOrder: row.display_order,
    imageUrl: row.image_url,
  };
}

/** Upload images to Storage and upsert rows (append — does not delete old photos). */
export async function savePhotosToSupabase(
  photos: WallPhoto[],
  wallId?: string
): Promise<void> {
  const supabase = createClient();
  const wid = wallId || getCachedWallId();
  if (!wid) throw new Error("No wall selected");

  for (const photo of photos) {
    if (!photo.base64) continue;

    const path = `${wid}/${photo.id}.jpg`;
    const blob = base64ToBlob(photo.base64, photo.mimeType || "image/jpeg");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: dbError } = await supabase.from("memories").upsert({
      id: photo.id,
      wall_id: wid,
      storage_path: path,
      image_url: urlData.publicUrl,
      caption: photo.caption || null,
      tags: photo.tags || [],
      mime_type: photo.mimeType || "image/jpeg",
      keep: photo.keep ?? true,
      display_size: photo.displaySize || "medium",
      is_highlight: photo.isHighlight ?? false,
      display_order: photo.displayOrder ?? 0,
    });

    if (dbError) throw new Error(`Database save failed: ${dbError.message}`);
  }
}

/** Load all photos for this device's wall. */
export async function loadPhotosFromSupabase(wallId?: string): Promise<WallPhoto[]> {
  const supabase = createClient();
  const wid = wallId || getCachedWallId();
  if (!wid) throw new Error("No wall selected");

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("wall_id", wid)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Load failed: ${error.message}`);
  return (data as MemoryRow[]).map(rowToPhoto);
}

export { isSupabaseReady };
