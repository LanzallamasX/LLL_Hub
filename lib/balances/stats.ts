// src/lib/balances/stats.ts
import type { Absence, AbsenceStatus } from "@/lib/supabase/absences";
import { getPolicySafe, type BalanceKey, type PolicyUnit } from "@/lib/absencePolicies";
import { countChargeableDays } from "@/lib/vacations/dateCount";
import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";

export type BalanceStats = {
  balanceKey: BalanceKey;
  unit: PolicyUnit;
  allowance: number | null; // cupo
  used: number;             // aprobado
  reserved: number;         // pendiente
  available: number | null; // cupo - used - reserved
};

function daysBetweenInclusive(fromISO: string, toISO: string) {
  const s = new Date(fromISO + "T00:00:00");
  const e = new Date(toISO + "T00:00:00");
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / 86400000) + 1;
  return Math.max(1, days);
}

function overlapsMonth(a: Absence, year: number, month0: number) {
  // month0: 0..11
  const start = new Date(year, month0, 1).getTime();
  const end = new Date(year, month0 + 1, 1).getTime(); // exclusive

  const from = new Date(a.from + "T00:00:00").getTime();
  const to = new Date(a.to + "T00:00:00").getTime() + 86400000; // inclusive -> exclusive

  return from < end && to > start;
}

function amountForAbsence(a: Absence, unit: PolicyUnit) {
  if (unit === "hour") {
    const h = Number((a as any).hours);
    return Number.isFinite(h) && h > 0 ? h : 0;
  }

  // day
  if (a.type === "vacaciones") {
    // para vacaciones mantenemos tu conteo "real" (business_days o calendario según settings)
    return countChargeableDays(a.from, a.to, DEFAULT_VACATION_SETTINGS.countMode);
  }

  return daysBetweenInclusive(a.from, a.to);
}

export function computeBalanceStatsByKey(
  absences: Absence[],
  year: number,
  month0?: number
): Map<BalanceKey, BalanceStats> {
  const map = new Map<BalanceKey, BalanceStats>();

  const relevant = absences.filter((a) => {
    if (a.status !== "aprobado" && a.status !== "pendiente") return false;
    if (month0 == null) return true;
    return overlapsMonth(a, year, month0);
  });

  for (const a of relevant) {
    const policy = a.type === "licencia"
      ? getPolicySafe({ type: "licencia" as any, subtype: (a as any).subtype ?? null })
      : getPolicySafe({ type: a.type as any, subtype: null });

    if (!policy?.deducts || !policy.deductsFrom) continue;

    const key = policy.deductsFrom;
    const unit = policy.unit;
    const allowance = policy.allowance;

    const entry = map.get(key) ?? {
      balanceKey: key,
      unit,
      allowance,
      used: 0,
      reserved: 0,
      available: allowance == null ? null : allowance,
    };

    const amt = amountForAbsence(a, unit);

    if (a.status === "aprobado") entry.used += amt;
    if (a.status === "pendiente") entry.reserved += amt;

    entry.available = entry.allowance == null ? null : Math.max(0, entry.allowance - entry.used - entry.reserved);

    map.set(key, entry);
  }

  // asegurar available aunque no haya movimientos
  for (const [k, v] of map) {
    v.available = v.allowance == null ? null : Math.max(0, v.allowance - v.used - v.reserved);
    map.set(k, v);
  }

  return map;
}

export type HistoryRow = {
  id: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  status: AbsenceStatus;
  balanceKey: BalanceKey;
  unit: PolicyUnit;
  amount: number;
  note?: string | null;
};

export function buildHistoryRows(
  absences: Absence[],
  year: number,
  month0?: number
): HistoryRow[] {
  const relevant = absences.filter((a) => {
    if (a.status !== "aprobado" && a.status !== "pendiente") return false;
    if (month0 == null) return true;
    return overlapsMonth(a, year, month0);
  });

  const rows: HistoryRow[] = [];

  for (const a of relevant) {
    const policy = a.type === "licencia"
      ? getPolicySafe({ type: "licencia" as any, subtype: (a as any).subtype ?? null })
      : getPolicySafe({ type: a.type as any, subtype: null });

    if (!policy?.deducts || !policy.deductsFrom) continue;

    const amt = amountForAbsence(a, policy.unit);

    rows.push({
      id: a.id,
      dateFrom: a.from,
      dateTo: a.to,
      type: a.type === "licencia" ? String((a as any).subtype ?? "licencia") : a.type,
      status: a.status,
      balanceKey: policy.deductsFrom,
      unit: policy.unit,
      amount: amt,
      note: a.note ?? null,
    });
  }

  return rows.sort((x, y) => (y.dateFrom + y.id).localeCompare(x.dateFrom + x.id));
}
