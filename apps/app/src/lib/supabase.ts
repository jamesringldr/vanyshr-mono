import { createClient } from "@supabase/supabase-js";
import { isDisconnectedMode } from "./env";
import { createMockSupabaseClient } from "./mockSupabase";

function createSupabaseClient() {
  if (isDisconnectedMode()) return createMockSupabaseClient();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSupabaseClient();
