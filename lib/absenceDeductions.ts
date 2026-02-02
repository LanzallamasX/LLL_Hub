// src/lib/absenceDeductions.ts
import type { Absence } from "@/lib/supabase/absences";
import { getPolicySafe, type AbsenceType } from "@/lib/absencePolicies";
import type { BalanceKey, PolicyUnit, LicenseSubtype } from "@/lib/absencePolicies";

export type DeductionPayload = {
  balanceKey: BalanceKey;
  unit: PolicyUnit;
  amount: number; // días u horas
};

function daysBetweenInclusive(fromISO: string, toISO: string) {
  const s = new Date(`${fromISO}T00:00:00`);
  const e = new Date(`${toISO}T00:00:00`);

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error("Fechas inválidas (from/to).");
  }
  if (e.getTime() < s.getTime()) {
    throw new Error("Rango inválido: 'to' no puede ser anterior a 'from'.");
  }

  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function buildDeductionFromAbsence(absence: Absence): DeductionPayload | null {
  // AbsenceTypeId es compatible con AbsenceType (mismo union),
  // este cast lo podés eliminar si hacés que Absence.type use AbsenceType directo.
  const type = absence.type as AbsenceType;

  // ✅ subtype ya está tipado fuerte en Absence
  const subtype: LicenseSubtype | null = type === "licencia" ? (absence.subtype ?? null) : null;

  const policy = getPolicySafe({ type, subtype });
  if (!policy) return null;

  if (!policy.deducts) return null;
  if (!policy.deductsFrom) return null;

  const amount =
    policy.unit === "day"
      ? daysBetweenInclusive(absence.from, absence.to)
      : (() => {
          const h = Number(absence.hours);
          if (!Number.isFinite(h) || h <= 0) {
            throw new Error("Esta licencia requiere hours > 0.");
          }
          return h;
        })();

  return {
    balanceKey: policy.deductsFrom,
    unit: policy.unit,
    amount,
  };
}
