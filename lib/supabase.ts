// Re-export browser client (use this in client components)
export { createClient, isSupabaseReady } from "@/lib/supabase/client";

// Back-compat alias
import { createClient } from "@/lib/supabase/client";
export function getSupabase() {
  return createClient();
}
