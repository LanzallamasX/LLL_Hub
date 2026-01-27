// lib/supabase/profilesAdmin.ts
import { supabase } from "@/lib/supabase/client";

export type ProfileRole = "user" | "owner";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: ProfileRole;

  active: boolean;

  team: string | null;
  start_date: string | null; // YYYY-MM-DD
  annual_vacation_days: number;

  created_at: string;
  updated_at: string;
};

const PROFILES_SELECT =
  "id,email,full_name,role,active,team,start_date,annual_vacation_days,created_at,updated_at";

export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILES_SELECT)
    .order("created_at", { ascending: false })
    .order("email", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

export async function updateProfile(
  id: string,
  patch: Partial<
    Pick<
      ProfileRow,
      "full_name" | "role" | "active" | "team" | "start_date" | "annual_vacation_days"
    >
  >
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select(PROFILES_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as ProfileRow;
}
