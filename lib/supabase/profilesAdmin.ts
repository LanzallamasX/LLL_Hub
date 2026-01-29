// lib/supabase/profilesAdmin.ts
import { supabase } from "@/lib/supabase/client";

export type ProfileRole = "user" | "owner";

export type ProfileRow = {
  id: string;
  email: string | null;

  full_name: string | null;
  first_name: string | null;
  last_name: string | null;

  dni: string | null;
  job_title: string | null;

  role: ProfileRole;
  active: boolean;

  team: string | null;
  start_date: string | null;
  annual_vacation_days: number;

  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  created_at: string;
  updated_at: string;
};

const PROFILES_SELECT = `
  id,
  email,
  full_name,
  first_name,
  last_name,
  dni,
  job_title,
  team,
  start_date,
  blood_type,
  emergency_contact_name,
  emergency_contact_phone,
  role,
  active,
  annual_vacation_days,
  created_at,
  updated_at
`.replace(/\s+/g, " ").trim();

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
      | "first_name"
      | "last_name"
      | "full_name"
      | "dni"
      | "job_title"
      | "team"
      | "start_date"
      | "blood_type"
      | "emergency_contact_name"
      | "emergency_contact_phone"
      | "role"
      | "active"
      | "annual_vacation_days"
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
