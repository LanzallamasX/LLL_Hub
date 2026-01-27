import { supabase } from "@/lib/supabase/client";

export type AllowedUserRole = "user" | "owner";

export type AllowedUser = {
  id: number;
  email: string;
  full_name: string | null;
  role: AllowedUserRole;
  is_active: boolean;

  team: string | null;
  start_date: string | null; // YYYY-MM-DD
  annual_vacation_days: number;

  created_at: string;
  created_by: string | null;
};

export type CreateAllowedUserInput = {
  email: string;
  full_name?: string;
  role?: AllowedUserRole;
  is_active?: boolean;

  team?: string | null;
  start_date?: string | null; // YYYY-MM-DD
  annual_vacation_days?: number;
};

const ALLOWED_USERS_SELECT =
  "id,email,full_name,role,is_active,team,start_date,annual_vacation_days,created_at,created_by";

export async function listAllowedUsers(): Promise<AllowedUser[]> {
  const { data, error } = await supabase
    .from("allowed_users")
    .select(ALLOWED_USERS_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AllowedUser[];
}

export async function createAllowedUser(
  input: CreateAllowedUserInput
): Promise<AllowedUser> {
  const payload = {
    email: input.email.toLowerCase().trim(),
    full_name: input.full_name?.trim() || null,
    role: input.role ?? "user",
    is_active: input.is_active ?? true,

    team: input.team ?? null,
    start_date: input.start_date ?? null,
    annual_vacation_days:
      typeof input.annual_vacation_days === "number"
        ? input.annual_vacation_days
        : 10,
  };

  const { data, error } = await supabase
    .from("allowed_users")
    .insert(payload)
    .select(ALLOWED_USERS_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as AllowedUser;
}

export async function updateAllowedUser(
  id: number,
  patch: Partial<
    Pick<
      AllowedUser,
      "full_name" | "role" | "is_active" | "team" | "start_date" | "annual_vacation_days"
    >
  >
): Promise<AllowedUser> {
  const { data, error } = await supabase
    .from("allowed_users")
    .update(patch)
    .eq("id", id)
    .select(ALLOWED_USERS_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as AllowedUser;
}

export async function deleteAllowedUser(id: number): Promise<void> {
  const { error } = await supabase.from("allowed_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
