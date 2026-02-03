import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createStubClient(): SupabaseClient {
  // Proxy: cualquier uso de supabase.* tira un error claro en runtime
  // pero NO rompe el build/prerender por falta de envs.
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Supabase client not configured: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      },
    }
  ) as unknown as SupabaseClient;
}

export const supabase: SupabaseClient =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createStubClient();
