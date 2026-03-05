// lib/supabase/vacations.ts
import { supabase } from "@/lib/supabase/client";

export type VacationBucket = {
  grant_date: string;   // YYYY-MM-DD
  expires_at: string;   // YYYY-MM-DD
  granted: number;
  used: number;
  remaining: number;
};

export type VacationBalance = {
  available: number;
  granted: number; // acumulado total (earned_total)
  used: number;    // usado pasado (aprobado)

  reserved?: number;          // ✅ aprobado futuro/en curso
  reserved_pending?: number;  // ✅ pendiente futuro/en curso

  next_expiration: string | null; // (en tu esquema acumulativo sin vencimiento = null)
  buckets: VacationBucket[];      // (en tu esquema acumulativo = [])
};


/*
export async function fetchMyVacationBalance(): Promise<VacationBalance> {
  const { data, error } = await supabase.rpc("get_my_vacation_balance");
  if (error) throw error;
  return data as VacationBalance;
}

*/

export async function fetchMyVacationBalance(p_at?: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc(
    "get_my_vacation_balance_at",
    {
      p_at: p_at ?? today,
    }
  );

  if (error) throw error;
  return data;
}