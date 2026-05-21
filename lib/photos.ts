// lib/photos.ts — Save/load photos via Supabase Storage + memories table

import type { DisplayPhoto } from "@/lib/agents";
import { getSupabase, isSupabaseReady } from "@/lib/supabase";

const BUCKET = "photos";
const WALL_ID_KEY = "growthbook_wall_id";

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

// Readable code: no 0/O/1/I/L confusion. 9 chars, 3 groups, ~36^9 possibilities.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const chars = Array.from({ length: 9 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");
  return `${chars.slice(0, 3)}-${chars.slice(3, 6)}-${chars.slice(6, 9)}`;
}

export function normalizeWallCode(code: string): string {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 9) return "";
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
}

export function getOrCreateWallId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(WALL_ID_KEY);
  if (!id) {
    id = generateCode();
    localStorage.setItem(WALL_ID_KEY, id);
  }
  return id;
}

export function setWallId(code: string): string {
  const normalized = normalizeWallCode(code);
  if (!normalized) throw new Error("Invalid wall code");
  localStorage.setItem(WALL_ID_KEY, normalized);
  return normalized;
}

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
  const supabase = getSupabase();
  const wid = wallId || getOrCreateWallId();

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
  const supabase = getSupabase();
  const wid = wallId || getOrCreateWallId();

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("wall_id", wid)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Load failed: ${error.message}`);
  return (data as MemoryRow[]).map(rowToPhoto);
}

export { isSupabaseReady };
