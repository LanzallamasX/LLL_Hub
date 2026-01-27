// lib/supabase/absences.ts
import { supabase } from "@/lib/supabase/client";
import type { AbsenceTypeId } from "@/lib/absenceTypes";

export type AbsenceStatus = "pendiente" | "aprobado" | "rechazado";

const ABSENCE_SELECT_WITH_DECIDER = `
  *,
  decided_by_profile:profiles!absences_decided_by_fkey(full_name,email)
`;

export type AbsenceRow = {
  id: string;

  user_id: string;
  user_name: string;

  type: AbsenceTypeId;
  status: AbsenceStatus;

  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD

  note: string | null;

  created_at: string; // ISO
  updated_at: string; // ISO

  decided_by: string | null;
  decided_at: string | null;

  
};

// Tu modelo “frontend”
export type Absence = {
  id: string;
  userId: string;
  userName: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  type: AbsenceTypeId;
  status: AbsenceStatus;
  note?: string | null;
  createdAt: string; // ISO

  updatedAt?: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decidedByProfile?: { fullName: string | null; email: string | null } | null;

};

export type CreateAbsenceInput = {
  userId: string;
  userName: string;
  from: string;
  to: string;
  type: AbsenceTypeId;
  note?: string;
};

export type UpdateAbsenceInput = {
  from: string;
  to: string;
  type: AbsenceTypeId;
  note?: string;
};

export function mapRowToAbsence(r: AbsenceRow & { decided_by_profile?: ProfileLite | null }): Absence {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    type: r.type,
    status: r.status,
    from: r.date_from,
    to: r.date_to,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    decidedByProfile: r.decided_by_profile
      ? { fullName: r.decided_by_profile.full_name, email: r.decided_by_profile.email }
      : null,
  };
}

export async function listMyAbsences(userId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("absences")
    .select(`
      *,
      decided_by_profile:profiles!absences_decided_by_fkey(full_name,email)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any[]).map((row) => mapRowToAbsence(row));
}

export async function listAllAbsencesForOwner(): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("absences")
    .select(`
      *,
      decided_by_profile:profiles!absences_decided_by_fkey(full_name,email)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any[]).map((row) => mapRowToAbsence(row));
}


export async function createAbsence(input: CreateAbsenceInput): Promise<Absence> {
  const payload = {
    user_id: input.userId,
    user_name: input.userName,
    type: input.type,
    status: "pendiente" as const,
    date_from: input.from,
    date_to: input.to,
    note: input.note ?? null,
  };

  const { data, error } = await supabase
    .from("absences")
    .insert(payload)
    .select(ABSENCE_SELECT_WITH_DECIDER)
    .single();

  if (error) throw error;
  return mapRowToAbsence(data as any);
}

export async function updateAbsenceStatus(
  id: string,
  status: AbsenceStatus
): Promise<Absence> {
  const { data, error } = await supabase
    .from("absences")
    .update({ status })
    .eq("id", id)
    .select(ABSENCE_SELECT_WITH_DECIDER)
    .single();

  if (error) throw error;
  return mapRowToAbsence(data as any);
}

export async function approveAbsence(id: string) {
  return updateAbsenceStatus(id, "aprobado");
}

export async function rejectAbsence(id: string) {
  return updateAbsenceStatus(id, "rechazado");
}


export async function updateAbsence(
  id: string,
  input: UpdateAbsenceInput
): Promise<Absence> {
  const { data, error } = await supabase
    .from("absences")
    .update({
      date_from: input.from,
      date_to: input.to,
      type: input.type,
      note: input.note?.trim() ? input.note.trim() : null,
    })
    .eq("id", id)
    .select(ABSENCE_SELECT_WITH_DECIDER)
    .single();

  if (error) throw error;
  return mapRowToAbsence(data as any);
}

export async function deleteAbsence(id: string) {
  const { data, error } = await supabase
    .from("absences")
    .delete()
    .eq("id", id)
    .select("id"); // confirma qué borró

  if (error) throw error;

  // Si no devolvió filas, casi siempre es:
  // - RLS/policy impide borrar
  // - o el ID no existe
  if (!data || data.length === 0) {
    throw new Error("No se pudo eliminar (sin permisos o solicitud inexistente).");
  }

  return true;
}


export type ProfileLite = {
  full_name: string | null;
  email: string | null;
};