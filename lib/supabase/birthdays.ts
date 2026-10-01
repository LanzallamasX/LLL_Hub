import type { BirthdayCalendarItem } from "@/components/dashboard/CalendarMonth";
import { supabase } from "@/lib/supabase/client";

type BirthdayRow = {
  id: string;
  display_name: string;
  birth_month: number;
  birth_day: number;
};

export async function listTeamBirthdays(): Promise<BirthdayCalendarItem[]> {
  const { data, error } = await supabase.rpc("list_team_birthdays");
  if (error) {
    // Allows a staggered frontend/database deployment without breaking dashboards.
    if (error.code === "42883" || error.message.includes("list_team_birthdays")) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as BirthdayRow[]).map((row) => ({
    id: row.id,
    name: row.display_name,
    birthDate: `2000-${String(row.birth_month).padStart(2, "0")}-${String(
      row.birth_day
    ).padStart(2, "0")}`,
  }));
}
