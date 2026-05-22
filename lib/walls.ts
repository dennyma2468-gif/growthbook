// lib/walls.ts — Walls tied to logged-in parent accounts

import { createClient, isSupabaseReady } from "@/lib/supabase/client";

const WALL_ID_KEY = "growthbook_wall_id";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type Wall = {
  id: string;
  child_name: string | null;
  created_at: string;
};

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

export function setActiveWallId(code: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WALL_ID_KEY, code);
}

export function getCachedWallId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WALL_ID_KEY);
}

/** List all walls owned by the logged-in user. */
export async function getUserWalls(): Promise<Wall[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("walls")
    .select("id, child_name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Wall[];
}

/** Create a new wall for this user. */
export async function createWallForUser(childName?: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const id = generateCode();
  const { error } = await supabase.from("walls").insert({
    id,
    user_id: user.id,
    child_name: childName || null,
  });
  if (error) throw new Error(error.message);

  setActiveWallId(id);
  return id;
}

/**
 * Ensure user has at least one wall. Returns active wall id.
 * Uses cached localStorage id if it belongs to user, else first wall, else creates new.
 */
export async function ensureUserWall(childName?: string): Promise<{
  wallId: string;
  isNew: boolean;
}> {
  const walls = await getUserWalls();
  const cached = getCachedWallId();

  if (cached && walls.some((w) => w.id === cached)) {
    return { wallId: cached, isNew: false };
  }

  if (walls.length > 0) {
    const id = walls[0].id;
    setActiveWallId(id);
    return { wallId: id, isNew: false };
  }

  const id = await createWallForUser(childName);
  return { wallId: id, isNew: true };
}

/**
 * Switch to a wall the user owns, or claim an orphan wall (photos exist but no owner row).
 */
export async function switchToWall(code: string): Promise<string> {
  const normalized = normalizeWallCode(code);
  if (!normalized) throw new Error("Invalid wall code");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: existing } = await supabase
    .from("walls")
    .select("user_id")
    .eq("id", normalized)
    .maybeSingle();

  if (existing) {
    if (existing.user_id !== user.id) {
      throw new Error("This wall belongs to another account");
    }
    setActiveWallId(normalized);
    return normalized;
  }

  // Claim orphan wall (photos uploaded before auth)
  const { error } = await supabase.from("walls").insert({
    id: normalized,
    user_id: user.id,
  });
  if (error) throw new Error(error.message);

  setActiveWallId(normalized);
  return normalized;
}

export { isSupabaseReady };
