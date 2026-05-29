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
  opts?: { asOfISO?: string }
): Map<BalanceKey, Usage> {
  const map = new Map<BalanceKey, Usage>();
  const asOfISO = opts?.asOfISO ?? todayISO();

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
      if (!overlapsYear(a.from, a.to, year)) continue;

      const clamped = clampRangeToYear(a.from, a.to, year);
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
