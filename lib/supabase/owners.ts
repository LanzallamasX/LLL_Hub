import { supabase } from "@/lib/supabase/client";

export type OwnerOption = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export async function listActiveOwners(): Promise<OwnerOption[]> {
  const { data, error } = await supabase.rpc("list_active_owner_notification_recipients");

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    email: row.email ?? null,
    fullName: row.full_name ?? null,
  }));
}
