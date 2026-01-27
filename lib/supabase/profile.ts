// lib/supabase/profile.ts
import { supabase } from "@/lib/supabase/client";


export type Role = "owner" | "user";

export async function ensureMyProfileForAuth() {
  const { data, error } = await supabase.rpc("ensure_my_profile");
  if (error) throw error;
  return data; // row de profiles
}

/** Lo que AuthContext necesita para hidratar sesión */
export type ProfileAuth = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
};

/** Perfil completo para pantallas de RRHH / Perfil */
export type Profile = ProfileAuth & {
  team: string | null;
  birth_date: string | null; // YYYY-MM-DD
  start_date: string | null; // YYYY-MM-DD

  annual_vacation_days: number; // ✅ not null en DB
  active: boolean; // ✅ not null en DB

  created_at: string;
  updated_at: string;
};

export type UpdateMyProfileInput = {
  full_name: string | null;
  team: string | null;
  birth_date: string | null;

  // Solo owner debería poder setearlo (lo manejamos en código)
  start_date: string | null;
};

const PROFILE_AUTH_SELECT = "id,email,full_name,role";

const PROFILE_FULL_SELECT =
  "id,email,full_name,role,team,birth_date,start_date,annual_vacation_days,active,created_at,updated_at";

async function getAuthedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

/**
 * ✅ Mantener ESTE nombre para no romper AuthContext:
 * Retorna el perfil mínimo (id,email,full_name,role)
 */
export async function fetchMyProfile(): Promise<ProfileAuth | null> {
  const uid = await getAuthedUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_AUTH_SELECT)
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileAuth | null;
}

export type ProfileForAuth = {
  role: Role;
  full_name: string | null;
  start_date: string | null;
  annual_vacation_days: number | null;
};

export async function fetchMyProfileForAuth(): Promise<ProfileForAuth | null> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userRes.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role,full_name,start_date,annual_vacation_days")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileForAuth;
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

  // Defaults seguros (por si hay filas viejas)
  const p = data as any;

  return {
    id: p.id,
    email: p.email ?? null,
    full_name: p.full_name ?? null,
    role: (p.role as Role) ?? "user",

    team: p.team ?? null,
    birth_date: p.birth_date ?? null,
    start_date: p.start_date ?? null,

    annual_vacation_days: typeof p.annual_vacation_days === "number" ? p.annual_vacation_days : 10,
    active: typeof p.active === "boolean" ? p.active : true,

    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),
  };
}

/**
 * ✅ Update del perfil propio
 * - Siempre puede editar: full_name, team, birth_date
 * - start_date: SOLO si role=owner (lo filtramos acá)
 */
export async function updateMyProfile(input: UpdateMyProfileInput): Promise<Profile> {
  const uid = await getAuthedUserId();
  if (!uid) throw new Error("No hay sesión activa.");

  // Importante: determinar rol real desde profiles (source of truth)
  const me = await fetchMyProfile();
  const isOwner = me?.role === "owner";

  const payload: Record<string, any> = {
    full_name: input.full_name?.trim() || null,
    team: input.team?.trim() || null,
    birth_date: input.birth_date || null,
  };

  // ✅ start_date solo si owner (si no, ni lo mandamos)
  if (isOwner) {
    payload.start_date = input.start_date || null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", uid)
    .select(PROFILE_FULL_SELECT)
    .single();

  if (error) throw error;

  const p = data as any;

  return {
    id: p.id,
    email: p.email ?? null,
    full_name: p.full_name ?? null,
    role: (p.role as Role) ?? "user",

    team: p.team ?? null,
    birth_date: p.birth_date ?? null,
    start_date: p.start_date ?? null,

    annual_vacation_days: typeof p.annual_vacation_days === "number" ? p.annual_vacation_days : 10,
    active: typeof p.active === "boolean" ? p.active : true,

    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),
  };
}

