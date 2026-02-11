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
  granted: number;
  used: number;
  next_expiration: string | null; // YYYY-MM-DD
  buckets: VacationBucket[];
};

export async function fetchMyVacationBalance(): Promise<VacationBalance> {
  const { data, error } = await supabase.rpc("get_my_vacation_balance");
  if (error) throw error;
  return data as VacationBalance;
}
