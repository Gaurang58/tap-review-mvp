import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPrivilegedSupabaseConfig } from "./privileged-env";

export function createPrivilegedSupabaseClient() {
  const { url, secretKey } = getPrivilegedSupabaseConfig();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
