// lib/vacations/settings.ts
import type { VacationSettings } from "@/lib/vacations/calc";

export const DEFAULT_VACATION_SETTINGS: VacationSettings = {
  countMode: "business_days",      // no descuenta sáb/dom
  carryoverEnabled: true,
  carryoverMaxCycles: 3,
};
