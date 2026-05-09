import { supabase } from "@/lib/supabase/client";

export type VacationPolicyMode = "anniversary" | "october";

export type VacationPolicySettings = {
  policy_mode: VacationPolicyMode;
  cycle_start_month: number;
  effective_from: string | null;
  preview_enabled: boolean;
  updated_at: string | null;
};

export const DEFAULT_VACATION_POLICY_SETTINGS: VacationPolicySettings = {
  policy_mode: "anniversary",
  cycle_start_month: 10,
  effective_from: null,
  preview_enabled: true,
  updated_at: null,
};

export function normalizeVacationPolicyMode(value: unknown): VacationPolicyMode {
  return value === "october" ? "october" : "anniversary";
}

export async function fetchVacationPolicySettings(): Promise<VacationPolicySettings> {
  const { data, error } = await supabase
    .from("vacation_policy_settings")
    .select("policy_mode,cycle_start_month,effective_from,preview_enabled,updated_at")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    // If the additive migration is not installed yet, keep the existing model alive.
    if (error.code === "42P01" || error.message.includes("vacation_policy_settings")) {
      return DEFAULT_VACATION_POLICY_SETTINGS;
    }
    throw error;
  }

  if (!data) return DEFAULT_VACATION_POLICY_SETTINGS;

  return {
    policy_mode: normalizeVacationPolicyMode(data.policy_mode),
    cycle_start_month: Number(data.cycle_start_month ?? 10),
    effective_from: data.effective_from ?? null,
    preview_enabled: Boolean(data.preview_enabled ?? true),
    updated_at: data.updated_at ?? null,
  };
}
