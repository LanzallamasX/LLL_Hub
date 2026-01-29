// src/lib/absenceDeductions.ts
import type { Absence } from "@/lib/supabase/absences";
import { getPolicySafe, type AbsenceType, type LicenseSubtype } from "@/lib/absencePolicies";
import type { BalanceKey, PolicyUnit } from "@/lib/absencePolicies";

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

  const ms = e.getTime() - s.getTime();
  return Math.floor(ms / 86400000) + 1; // 1000*60*60*24
}

function parseSubtype(absence: Absence): LicenseSubtype | null {
  // si en tu Absence ya tipás subtype como LicenseSubtype | null, esto se simplifica
  const v = (absence as { subtype?: unknown }).subtype;
  return typeof v === "string" ? (v as LicenseSubtype) : null;
}

export function buildDeductionFromAbsence(absence: Absence): DeductionPayload | null {
  const type = absence.type as unknown as AbsenceType;
  const subtype = type === "licencia" ? parseSubtype(absence) : null;

  const policy = getPolicySafe({ type, subtype });
  if (!policy) return null;

  if (!policy.deducts) return null;
  if (!policy.deductsFrom) return null; // evita non-null assertion

  let amount = 0;

  if (policy.unit === "day") {
    amount = daysBetweenInclusive(absence.from, absence.to);
  } else {
    const h = Number(absence.hours);
    if (!Number.isFinite(h) || h <= 0) {
      throw new Error("Esta licencia requiere hours > 0.");
    }
    amount = h;
  }

  return {
    balanceKey: policy.deductsFrom,
    unit: policy.unit,
    amount,
  };
}

