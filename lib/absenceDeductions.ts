// src/lib/absenceDeductions.ts
import type { Absence } from "@/lib/supabase/absences";
import { getPolicy, type AbsenceType, type LicenseSubtype } from "@/lib/absencePolicies";
import type { BalanceKey, PolicyUnit } from "@/lib/absencePolicies";

export type DeductionPayload = {
  balanceKey: BalanceKey;
  unit: PolicyUnit;
  amount: number; // días u horas
};

function daysBetweenInclusive(fromISO: string, toISO: string) {
  const s = new Date(fromISO + "T00:00:00");
  const e = new Date(toISO + "T00:00:00");

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error("Fechas inválidas (from/to).");
  }
  if (e.getTime() < s.getTime()) {
    throw new Error("Rango inválido: 'to' no puede ser anterior a 'from'.");
  }

  const ms = e.getTime() - s.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function buildDeductionFromAbsence(absence: Absence): DeductionPayload | null {
  const type = absence.type as unknown as AbsenceType;
  const subtype = ((absence as any).subtype ?? null) as LicenseSubtype | null;

  const policy = getPolicy({ type, subtype });

  if (!policy.deducts) return null;

  const amount =
    policy.unit === "day"
      ? daysBetweenInclusive(absence.from, absence.to)
      : (() => {
          const h = Number((absence as any).hours);
          if (!Number.isFinite(h) || h <= 0) {
            throw new Error("Esta licencia requiere hours > 0.");
          }
          return h;
        })();

  return {
    balanceKey: policy.deductsFrom!,
    unit: policy.unit,
    amount,
  };
}
