// src/lib/balances/usage.ts
import type { Absence } from "@/lib/supabase/absences";
import type { BalanceKey, PolicyUnit } from "@/lib/absencePolicies";
import { buildDeductionFromAbsence } from "@/lib/absenceDeductions";

/**
 * MVP:
 * - Suma consumo por BalanceKey en el año indicado
 * - Cuenta SOLO ausencias aprobadas
 * - Usa absencePolicies + buildDeductionFromAbsence para decidir qué descuenta y cuánto (días u horas)
 */
export type Usage = {
  used: number;
  unit: PolicyUnit;
};

function yearOf(isoDate: string) {
  // isoDate: YYYY-MM-DD
  return Number(isoDate.slice(0, 4));
}

export function computeUsageByBalanceKey(
  absences: Absence[],
  year: number
): Map<BalanceKey, Usage> {
  const map = new Map<BalanceKey, Usage>();

  for (const a of absences) {
    if (a.status !== "aprobado") continue;

    // Filtro por año: usamos la fecha "from" como referencia de ciclo
    // (si después querés prorratear rangos que cruzan año, lo mejoramos)
    if (yearOf(a.from) !== year) continue;

    const d = buildDeductionFromAbsence(a);
    if (!d) continue;

    const prev = map.get(d.balanceKey);
    if (!prev) {
      map.set(d.balanceKey, { used: d.amount, unit: d.unit });
      continue;
    }

    // Si la unidad cambia, priorizamos la del policy actual (no debería pasar)
    map.set(d.balanceKey, { used: prev.used + d.amount, unit: d.unit });
  }

  return map;
}
