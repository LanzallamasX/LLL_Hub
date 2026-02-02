// lib/vacations/calc.ts
import type { AbsenceTypeId } from "@/lib/absenceTypes";
import {
  DEFAULT_ENTITLEMENT_RULES,
  entitlementDaysForYears,
  yearsOfServiceAtYearEnd,
} from "./policy";
import { clampRangeToYear, countChargeableDays, type CountMode } from "./dateCount";

export type AbsenceLite = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  status: "pendiente" | "aprobado" | "rechazado";
  type: AbsenceTypeId;
};

export type VacationSettings = {
  countMode: CountMode;
  carryoverEnabled: boolean;
  carryoverMaxCycles: number | null;
};

function vacationDaysInYearByStatus(
  absences: AbsenceLite[],
  year: number,
  countMode: CountMode,
  status: "aprobado" | "pendiente"
) {
  const list = absences.filter((a) => a.type === "vacaciones" && a.status === status);

  let total = 0;
  for (const a of list) {
    const clamped = clampRangeToYear(a.from, a.to, year);
    if (!clamped) continue;
    total += countChargeableDays(clamped.fromISO, clamped.toISO, countMode);
  }
  return total;
}

export function usedVacationDaysInYear(absences: AbsenceLite[], year: number, countMode: CountMode) {
  return vacationDaysInYearByStatus(absences, year, countMode, "aprobado");
}

export function reservedVacationDaysInYear(absences: AbsenceLite[], year: number, countMode: CountMode) {
  return vacationDaysInYearByStatus(absences, year, countMode, "pendiente");
}

export function entitlementForYear(params: { year: number; startDateISO: string | null }) {
  const start = params.startDateISO;

  // Si no hay start_date, asumimos 0 años (14 días) para no romper UI.
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
  const reservedThisYear = reservedVacationDaysInYear(absences, currentYear, settings.countMode);

  let carryover = 0;

  // carryover: solo consumido real (aprobado)
  if (settings.carryoverEnabled) {
    const max = settings.carryoverMaxCycles ?? 50;

    for (let i = 1; i <= max; i++) {
      const y = currentYear - i;
      const entY = entitlementForYear({ year: y, startDateISO });
      const usedY = usedVacationDaysInYear(absences, y, settings.countMode);
      carryover += Math.max(0, entY - usedY);
    }
  }

  const available = Math.max(0, entitlement + carryover - usedThisYear - reservedThisYear);

  return {
    entitlement,
    carryover,
    usedThisYear,
    reservedThisYear,
    available,
  };
}
