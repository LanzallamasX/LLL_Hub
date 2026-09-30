import { supabase } from "@/lib/supabase/client";

export type BlockedAbsenceType = "vacaciones" | "home_office";

export type AbsenceBlockedPeriod = {
  id: string;
  date_from: string;
  date_to: string;
  absence_types: BlockedAbsenceType[];
  reason: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listActiveBlockedPeriods(): Promise<AbsenceBlockedPeriod[]> {
  const { data, error } = await supabase
    .from("absence_blocked_periods")
    .select(
      "id,date_from,date_to,absence_types,reason,active,created_by,created_at,updated_at"
    )
    .eq("active", true)
    .order("date_from", { ascending: true });

  if (error) {
    // Keep requests usable before the additive migration reaches an environment.
    if (error.code === "42P01" || error.message.includes("absence_blocked_periods")) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as AbsenceBlockedPeriod[];
}

export function blockedPeriodAppliesTo(
  period: AbsenceBlockedPeriod,
  type: string
) {
  return period.active && period.absence_types.some((item) => item === type);
}
