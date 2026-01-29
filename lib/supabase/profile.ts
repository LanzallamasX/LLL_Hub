// lib/supabase/profile.ts
import { supabase } from "@/lib/supabase/client";

export type Role = "owner" | "user";

export type ProfileLite = {
  id?: string;
  email?: string | null;

  role?: Role | string | null;

  // legacy + nuevo
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;

  // RRHH mínimo
  start_date?: string | null;
  annual_vacation_days?: number | null;
};

export async function ensureMyProfileForAuth(): Promise<ProfileLite | null> {
  const { data, error } = await supabase.rpc("ensure_my_profile");
  if (error) throw error;
  return (data ?? null) as ProfileLite | null;
}

/** Helpers */
function normStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

export function buildDisplayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}): string {
  const first = normStr(p.first_name);
  const last = normStr(p.last_name);

  if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();

  const full = normStr(p.full_name);
  if (full) return full;

  return p.email ?? "Usuario";
}

/**
 * full_name legacy:
 * - si hay first/last => usar eso
 * - si hay full_name real => usarlo
 * - si no hay nada => null (NO guardar "Usuario" ni email)
 */
export function buildLegacyFullName(input: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}): string | null {
  const first = normStr(input.first_name);
  const last = normStr(input.last_name);
  const full = normStr(input.full_name);

  if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
  if (full) return full;

  return null;
}

/** Para AuthContext */
export type ProfileForAuth = {
  role: Role;
  full_name: string | null; // compat
  first_name: string | null;
  last_name: string | null;

  start_date: string | null;

  // recomiendo number (no null) para evitar checks
  annual_vacation_days: number;
};

/** Perfil completo para /profile */
export type Profile = {
  id: string;
  email: string | null;

  // legacy + nuevo
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;

  // RRHH
  dni: string | null;
  team: string | null;
  job_title: string | null;

  // fechas
  birth_date: string | null; // YYYY-MM-DD
  start_date: string | null; // YYYY-MM-DD

  // salud/emergencia
  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  // auth
  role: Role;
  annual_vacation_days: number;
  active: boolean;

  created_at: string;
  updated_at: string;

  // derivado (no DB)
  display_name: string;
};

export type UpdateMyProfileInput = {
  // identidad
  first_name: string | null;
  last_name: string | null;
  full_name: string | null; // compat

  // user editable
  birth_date: string | null;
  team: string | null;

  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  // RRHH (solo owner)
  dni: string | null;
  job_title: string | null;
  start_date: string | null;
};

const PROFILE_FOR_AUTH_SELECT =
  "role,full_name,first_name,last_name,start_date,annual_vacation_days";

const PROFILE_FULL_SELECT =
  "id,email,full_name,first_name,last_name,dni,team,job_title,birth_date,start_date,blood_type,emergency_contact_name,emergency_contact_phone,role,annual_vacation_days,active,created_at,updated_at";

async function getAuthedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

/**
 * ✅ Perfil mínimo (legacy) - mantenemos por compat
 */
export async function fetchMyProfile(): Promise<{
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
} | null> {
  const uid = await getAuthedUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const p: any = data;

  return {
    id: p.id,
    email: p.email ?? null,
    full_name: p.full_name ?? null,
    role: (p.role as Role) ?? "user",
  };
}

/**
 * ✅ Para AuthContext
 */
export async function fetchMyProfileForAuth(): Promise<ProfileForAuth | null> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userRes.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FOR_AUTH_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const p: any = data;

  return {
    role: (p.role as Role) ?? "user",
    full_name: p.full_name ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    start_date: p.start_date ?? null,
    annual_vacation_days:
      typeof p.annual_vacation_days === "number" ? p.annual_vacation_days : 10,
  };
}

/**
 * ✅ Para /profile (pantalla completa)
 */
export async function fetchMyProfileFull(): Promise<Profile | null> {
  const uid = await getAuthedUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FULL_SELECT)
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const p: any = data;
  const email = p.email ?? null;

  return {
    id: p.id,
    email,

    full_name: p.full_name ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,

    dni: p.dni ?? null,
    team: p.team ?? null,
    job_title: p.job_title ?? null,

    birth_date: p.birth_date ?? null,
    start_date: p.start_date ?? null,

    blood_type: p.blood_type ?? null,
    emergency_contact_name: p.emergency_contact_name ?? null,
    emergency_contact_phone: p.emergency_contact_phone ?? null,

    role: (p.role as Role) ?? "user",

    annual_vacation_days:
      typeof p.annual_vacation_days === "number" ? p.annual_vacation_days : 10,
    active: typeof p.active === "boolean" ? p.active : true,

    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),

    display_name: buildDisplayName({
      first_name: p.first_name,
      last_name: p.last_name,
      full_name: p.full_name,
      email,
    }),
  };
}

/**
 * ✅ Update del perfil propio
 * - User: identidad + personal + emergencia
 * - Owner: además RRHH (dni, job_title, start_date)
 */
export async function updateMyProfile(
  input: UpdateMyProfileInput
): Promise<Profile> {
  const uid = await getAuthedUserId();
  if (!uid) throw new Error("No hay sesión activa.");

  const me = await fetchMyProfile();
  const isOwner = me?.role === "owner";
  const myEmail = me?.email ?? null;

  const payload: Record<string, any> = {
    first_name: normStr(input.first_name),
    last_name: normStr(input.last_name),

    // legacy compat: NO meter "Usuario" ni email
    full_name: buildLegacyFullName({
      first_name: input.first_name,
      last_name: input.last_name,
      full_name: input.full_name,
      email: myEmail,
    }),

    team: normStr(input.team),
    birth_date: input.birth_date || null,

    blood_type: normStr(input.blood_type),
    emergency_contact_name: normStr(input.emergency_contact_name),
    emergency_contact_phone: normStr(input.emergency_contact_phone),
  };

  if (isOwner) {
    payload.dni = normStr(input.dni);
    payload.job_title = normStr(input.job_title);
    payload.start_date = input.start_date || null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", uid)
    .select(PROFILE_FULL_SELECT)
    .single();

  if (error) throw error;

  const p: any = data;
  const email = p.email ?? null;

  return {
    id: p.id,
    email,

    full_name: p.full_name ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,

    dni: p.dni ?? null,
    team: p.team ?? null,
    job_title: p.job_title ?? null,

    birth_date: p.birth_date ?? null,
    start_date: p.start_date ?? null,

    blood_type: p.blood_type ?? null,
    emergency_contact_name: p.emergency_contact_name ?? null,
    emergency_contact_phone: p.emergency_contact_phone ?? null,

    role: (p.role as Role) ?? "user",

    annual_vacation_days:
      typeof p.annual_vacation_days === "number" ? p.annual_vacation_days : 10,
    active: typeof p.active === "boolean" ? p.active : true,

    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),

    display_name: buildDisplayName({
      first_name: p.first_name,
      last_name: p.last_name,
      full_name: p.full_name,
      email,
    }),
  };
}
