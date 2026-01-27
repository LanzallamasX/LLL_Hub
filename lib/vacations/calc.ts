// lib/vacations/calc.ts
import type { AbsenceTypeId } from "@/lib/absenceTypes";
import { DEFAULT_ENTITLEMENT_RULES, entitlementDaysForYears, yearsOfServiceAtYearEnd } from "./policy";
import { clampRangeToYear, countChargeableDays, type CountMode } from "./dateCount";

export type AbsenceLite = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  status: "pendiente" | "aprobado" | "rechazado";
  type: AbsenceTypeId;
};

export type VacationSettings = {
  countMode: CountMode;              // business_days (no sab/dom) o calendar_days
  carryoverEnabled: boolean;
  carryoverMaxCycles: number | null; // ej 3
};

export function usedVacationDaysInYear(
  absences: AbsenceLite[],
  year: number,
  countMode: CountMode
) {
  const vacationsApproved = absences.filter(
    (a) => a.status === "aprobado" && a.type === "vacaciones"
  );

  let total = 0;

  for (const a of vacationsApproved) {
    const clamped = clampRangeToYear(a.from, a.to, year);
    if (!clamped) continue;
    total += countChargeableDays(clamped.fromISO, clamped.toISO, countMode);
  }

  return total;
}

export function entitlementForYear(params: {
  year: number;
  startDateISO: string | null; // profile.start_date
}) {
  // Si no hay start_date, asumimos 0 años (14 días) para no romper UI.
  // Podés cambiar a 0 si preferís bloquear.
  const start = params.startDateISO;
  const years = start ? yearsOfServiceAtYearEnd(params.year, start) : 0;
  return entitlementDaysForYears(years, DEFAULT_ENTITLEMENT_RULES);
}

export function computeVacationBalance(params: {
  absences: AbsenceLite[];
  currentYear: number;
  startDateISO: string | null;
  settings: VacationSettings;
}) {
  const { absences, currentYear, startDateISO, settings } = params;

  const entitlement = entitlementForYear({ year: currentYear, startDateISO });
  const usedThisYear = usedVacationDaysInYear(absences, currentYear, settings.countMode);

  let carryover = 0;
  if (settings.carryoverEnabled) {
    const max = settings.carryoverMaxCycles ?? 50;

    for (let i = 1; i <= max; i++) {
      const y = currentYear - i;
      const entY = entitlementForYear({ year: y, startDateISO });
      const usedY = usedVacationDaysInYear(absences, y, settings.countMode);
      carryover += Math.max(0, entY - usedY);
    }
  }

  const available = Math.max(0, entitlement + carryover - usedThisYear);

  return {
    entitlement,
    carryover,
    usedThisYear,
    available,
  };
}
