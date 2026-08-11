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
  vacation_days_override: number | null;

  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  // ✅ migración vacaciones
  vacation_migration_date: string | null; // date (YYYY-MM-DD)
  vacation_available_at_migration: number; // int >= 0

  created_at: string;
  updated_at: string;
};

const PROFILES_SELECT_LEGACY = `
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
  vacation_migration_date,
  vacation_available_at_migration,
  created_at,
  updated_at
`
  .replace(/\s+/g, " ")
  .trim();

const PROFILES_SELECT = `${PROFILES_SELECT_LEGACY}, vacation_days_override`;

function isMissingVacationOverride(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42703" ||
    error?.message?.toLowerCase().includes("vacation_days_override") === true
  );
}

function withDefaultVacationOverride(rows: unknown[] | null): ProfileRow[] {
  return (rows ?? []).map((row) => ({
    ...(row as Omit<ProfileRow, "vacation_days_override">),
    vacation_days_override: null,
  }));
}

export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILES_SELECT)
    .order("created_at", { ascending: false })
    .order("email", { ascending: true });

  if (isMissingVacationOverride(error)) {
    const legacy = await supabase
      .from("profiles")
      .select(PROFILES_SELECT_LEGACY)
      .order("created_at", { ascending: false })
      .order("email", { ascending: true });

    if (legacy.error) throw new Error(legacy.error.message);
    return withDefaultVacationOverride(legacy.data as unknown[] | null);
  }

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProfileRow[];
}

export type UpdateProfilePatch = Partial<
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
    | "vacation_days_override"
    | "vacation_migration_date"
    | "vacation_available_at_migration"
  >
>;

function hasOwn<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
}

export async function updateProfile(id: string, patch: UpdateProfilePatch): Promise<ProfileRow> {
  // ✅ Copia y sanitización sin “inventar” campos
  const safePatch: UpdateProfilePatch = { ...patch };

  // ✅ Normaliza: "" -> null (solo si el campo vino en el patch)
  if (hasOwn(safePatch, "vacation_migration_date")) {
    const v = (safePatch.vacation_migration_date ?? "").toString().trim();
    safePatch.vacation_migration_date = v ? v : null;
  }

  // ✅ Normaliza número (solo si vino en el patch)
  if (hasOwn(safePatch, "vacation_available_at_migration")) {
    const raw = safePatch.vacation_available_at_migration;
    const n = typeof raw === "number" ? raw : Number(raw);
    safePatch.vacation_available_at_migration = Number.isFinite(n)
      ? Math.max(0, Math.trunc(n))
      : 0;
  }

  if (hasOwn(safePatch, "vacation_days_override")) {
    const raw = safePatch.vacation_days_override;
    const n = raw == null ? null : Number(raw);

    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 366)) {
      throw new Error("La excepción de vacaciones debe ser un número entero entre 1 y 366.");
    }

    safePatch.vacation_days_override = n;
  }

  // ✅ Normaliza: "" -> null para start_date si vino
  if (hasOwn(safePatch, "start_date")) {
    const v = (safePatch.start_date ?? "").toString().trim();
    safePatch.start_date = v ? v : null;
  }

  const updatesVacationOverride = hasOwn(safePatch, "vacation_days_override");

  const { data, error } = await supabase
    .from("profiles")
    .update(safePatch)
    .eq("id", id)
    .select(PROFILES_SELECT)
    .single();

  if (isMissingVacationOverride(error)) {
    if (updatesVacationOverride) {
      throw new Error(
        "Para guardar la excepción de vacaciones primero hay que aplicar la migración de Supabase."
      );
    }

    const legacy = await supabase
      .from("profiles")
      .update(safePatch)
      .eq("id", id)
      .select(PROFILES_SELECT_LEGACY)
      .single();

    if (legacy.error) throw new Error(legacy.error.message);
    return withDefaultVacationOverride([legacy.data] as unknown[])[0];
  }

  if (error) throw new Error(error.message);
  return data as unknown as ProfileRow;
}
