// src/lib/balances/usage.ts
import type { Absence } from "@/lib/supabase/absences";
import type { BalanceKey, PolicyUnit } from "@/lib/absencePolicies";
import { buildDeductionFromAbsence } from "@/lib/absenceDeductions";
import { clampRangeToYear, countChargeableDays } from "@/lib/vacations/dateCount";

export type Usage = {
  used: number;
  reserved: number;
  unit: PolicyUnit;
};

function isoYearStart(year: number) {
  return `${year}-01-01`;
}
function isoYearEnd(year: number) {
  return `${year}-12-31`;
}

function cycleBoundsForDate(atISO: string, startMonth: number) {
  const y = Number(atISO.slice(0, 4));
  const m = Number(atISO.slice(5, 7));
  const safeStartMonth = Math.max(1, Math.min(12, startMonth || 1));
  const startYear = m >= safeStartMonth ? y : y - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = new Date(startYear + 1, safeStartMonth - 1, 0);

  return {
    fromISO: `${startYear}-${pad(safeStartMonth)}-01`,
    toISO: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function overlapsYear(fromISO: string, toISO: string, year: number) {
  const yStart = isoYearStart(year);
  const yEnd = isoYearEnd(year);
  return fromISO <= yEnd && toISO >= yStart;
}

function overlapsRange(fromISO: string, toISO: string, minISO: string, maxISO: string) {
  return fromISO <= maxISO && toISO >= minISO;
}

function clampRange(fromISO: string, toISO: string, minISO: string, maxISO: string) {
  const from = fromISO > minISO ? fromISO : minISO;
  const to = toISO < maxISO ? toISO : maxISO;
  if (to < from) return null;
  return { fromISO: from, toISO: to };
}

function daysBetweenInclusive(fromISO: string, toISO: string) {
  const s = new Date(fromISO + "T00:00:00");
  const e = new Date(toISO + "T00:00:00");
  const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(0, days);
}

/**
 * MVP:
 * - Suma consumo por BalanceKey en el año indicado
 * - Cuenta aprobadas pasadas como usado
 * - Cuenta pendientes y aprobadas futuras/en curso como reservado
 * - Usa buildDeductionFromAbsence para decidir qué descuenta y cuánto
 *
 * Fix:
 * - Si el rango cruza de año, prorratea solo la parte dentro del año.
 */
export function computeUsageByBalanceKey(
  absences: Absence[],
  year: number,
  opts?: { asOfISO?: string; homeOfficeCycleStartMonth?: number }
): Map<BalanceKey, Usage> {
  const map = new Map<BalanceKey, Usage>();
  const asOfISO = opts?.asOfISO ?? todayISO();
  const homeOfficeBounds = opts?.homeOfficeCycleStartMonth
    ? cycleBoundsForDate(asOfISO, opts.homeOfficeCycleStartMonth)
    : null;

  for (const a of absences) {
    if (a.status !== "aprobado" && a.status !== "pendiente") continue;

    const d = buildDeductionFromAbsence(a);
    if (!d) continue;

    let amount = 0;

    if (d.unit === "hour") {
      // Para horas: tomamos la fecha (from) como “día del evento”
      // y solo suma si ese día cae en el año.
      const y = Number((a.from ?? "").slice(0, 4));
      if (y !== year) continue;
      amount = d.amount;
    } else {
      // day: suma solo el tramo dentro del año
      const useHomeOfficeCycle = d.balanceKey === "HOME_OFFICE_DAYS" && homeOfficeBounds;
      if (useHomeOfficeCycle) {
        if (!overlapsRange(a.from, a.to, homeOfficeBounds.fromISO, homeOfficeBounds.toISO)) {
          continue;
        }
      } else if (!overlapsYear(a.from, a.to, year)) {
        continue;
      }

      const clamped = useHomeOfficeCycle
        ? clampRange(a.from, a.to, homeOfficeBounds.fromISO, homeOfficeBounds.toISO)
        : clampRangeToYear(a.from, a.to, year);
      if (!clamped) continue;

      // OJO: buildDeductionFromAbsence ya decide cómo contar días (vacaciones vs otros)
      // pero para prorratear por año, necesitamos recalcular el "amount" solo dentro del año.
      // Regla MVP: días inclusivos (si tu buildDeduction usa business days para vacaciones,
      // esa lógica debería vivir ahí; acá nos quedamos con lo estable: prorrateo por rango).
      amount =
        a.type === "home_office"
          ? countChargeableDays(clamped.fromISO, clamped.toISO, "business_days")
          : daysBetweenInclusive(clamped.fromISO, clamped.toISO);
    }

    const prev = map.get(d.balanceKey) ?? { used: 0, reserved: 0, unit: d.unit };
    const next =
      a.status === "pendiente" || a.to >= asOfISO
        ? { ...prev, reserved: prev.reserved + amount }
        : { ...prev, used: prev.used + amount };

    map.set(d.balanceKey, next);
  }

  return map;
}
