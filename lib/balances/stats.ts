// src/lib/balances/stats.ts
import type { Absence, AbsenceStatus } from "@/lib/supabase/absences";
import { POLICIES, getPolicySafe, type BalanceKey, type PolicyUnit } from "@/lib/absencePolicies";
import { countChargeableDays } from "@/lib/vacations/dateCount";
import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";
import type { VacationBalance } from "@/lib/supabase/vacations";

export type BalanceStats = {
  balanceKey: BalanceKey;
  unit: PolicyUnit;
  allowance: number | null; // cupo (si null = ilimitado)
  used: number;             // aprobado pasado
  reserved: number;         // aprobado futuro/en curso + pendiente
  available: number | null; // cupo - used - reserved
  meta?: Record<string, any>;
};

function daysBetweenInclusive(fromISO: string, toISO: string) {
  const s = new Date(fromISO + "T00:00:00");
  const e = new Date(toISO + "T00:00:00");
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / 86400000) + 1;
  return Math.max(1, days);
}

function overlapsMonth(a: Absence, year: number, month0: number) {
  const start = new Date(year, month0, 1).getTime();
  const end = new Date(year, month0 + 1, 1).getTime(); // exclusive

  const from = new Date(a.from + "T00:00:00").getTime();
  const to = new Date(a.to + "T00:00:00").getTime() + 86400000; // inclusive -> exclusive

  return from < end && to > start;
}

function overlapsYear(a: Absence, year: number) {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime(); // exclusive

  const from = new Date(a.from + "T00:00:00").getTime();
  const to = new Date(a.to + "T00:00:00").getTime() + 86400000; // inclusive -> exclusive

  return from < end && to > start;
}

function periodBounds(year: number, month0?: number) {
  if (month0 == null) {
    return { fromISO: `${year}-01-01`, toISO: `${year}-12-31` };
  }

  const from = new Date(year, month0, 1);
  const to = new Date(year, month0 + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    fromISO: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    toISO: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
  };
}

function clampRange(fromISO: string, toISO: string, minISO: string, maxISO: string) {
  const from = fromISO > minISO ? fromISO : minISO;
  const to = toISO < maxISO ? toISO : maxISO;
  if (to < from) return null;
  return { fromISO: from, toISO: to };
}

function amountForAbsence(a: Absence, unit: PolicyUnit, range?: { fromISO: string; toISO: string }) {
  if (unit === "hour") {
    const h = Number((a as any).hours);
    return Number.isFinite(h) && h > 0 ? h : 0;
  }

  const fromISO = range?.fromISO ?? a.from;
  const toISO = range?.toISO ?? a.to;

  // day
  if (a.type === "vacaciones") {
    // acá no tenemos holidaysISO en balances; si querés, se puede agregar como param
    return countChargeableDays(fromISO, toISO, DEFAULT_VACATION_SETTINGS.countMode);
  }

  if (a.type === "home_office") {
    return countChargeableDays(fromISO, toISO, "business_days");
  }

  return daysBetweenInclusive(fromISO, toISO);
}

/**
 * Fuente de verdad vacaciones (nuevo):
 * - Si pasás vacationDb (RPC), usamos eso.
 * - Si no, dejamos seed default (fallback).
 *
 * Para el resto:
 * - allowance = policy.allowance
 * - used/reserved de ausencias aprobado/pendiente
 */
export function computeBalanceStatsByKey(
  absences: Absence[],
  year: number,
  month0: number | undefined,
  opts?: {
    vacationDb?: VacationBalance | null;
    asOfISO?: string;
  }
): Map<BalanceKey, BalanceStats> {
  const map = new Map<BalanceKey, BalanceStats>();
  const asOfISO = opts?.asOfISO ?? new Date().toISOString().slice(0, 10);

  // 1) Seed: todas las policies que deducen (para que aparezcan aunque estén en 0)
  for (const p of POLICIES) {
    if (!p.deducts || !p.deductsFrom) continue;

    map.set(p.deductsFrom, {
      balanceKey: p.deductsFrom,
      unit: p.unit,
      allowance: p.allowance,
      used: 0,
      reserved: 0,
      available: p.allowance == null ? null : p.allowance,
    });
  }

  // 2) Vacaciones: si hay RPC, lo usamos como “balance final”
  const vacKey: BalanceKey = "VACATION_DAYS";
  const vacDb = opts?.vacationDb ?? null;

  if (vacDb && map.has(vacKey)) {
    const accrued = Math.floor(Number(vacDb.granted ?? 0));
    const usedPast = Math.floor(Number(vacDb.used ?? 0));
    const reservedApproved = Math.floor(Number((vacDb as any).reserved ?? 0));
    const pending = Math.floor(Number((vacDb as any).reserved_pending ?? 0));
    const available = Math.floor(Number(vacDb.available ?? 0));

    // En Balances, "Reservado" es todo lo comprometido no usado:
    // aprobadas futuras/en curso + pendientes.
    map.set(vacKey, {
      balanceKey: vacKey,
      unit: "day",
      allowance: accrued, // “cupo” para balances = acumulado total
      used: usedPast,
      reserved: reservedApproved + pending,
      available,
      meta: {
        accrued,
        used_past: usedPast,
        reserved_approved: reservedApproved,
        pending,
      },
    });
  }

  // 3) Movimientos (aprobado + pendiente) para NO-vacaciones (si no hay vacDb)
  const relevant = absences.filter((a) => {
    if (a.status !== "aprobado" && a.status !== "pendiente") return false;
    if (month0 == null) return overlapsYear(a, year);
    return overlapsMonth(a, year, month0);
  });

  for (const a of relevant) {
    const policy =
      a.type === "licencia"
        ? getPolicySafe({ type: "licencia" as any, subtype: (a as any).subtype ?? null })
        : getPolicySafe({ type: a.type as any, subtype: null });

    if (!policy?.deducts || !policy.deductsFrom) continue;

    // Si VACATION_DAYS está “cerrado” por RPC, no recalculamos por ausencias acá
    if (policy.deductsFrom === vacKey && vacDb) continue;

    const entry = map.get(policy.deductsFrom);
    if (!entry) continue;

    const bounds = periodBounds(year, month0);
    const range = clampRange(a.from, a.to, bounds.fromISO, bounds.toISO);
    if (!range) continue;

    const amt = amountForAbsence(a, policy.unit, range);

    if (a.status === "aprobado" && a.to < asOfISO) entry.used += amt;
    if (a.status === "aprobado" && a.to >= asOfISO) entry.reserved += amt;
    if (a.status === "pendiente") entry.reserved += amt;

    entry.available =
      entry.allowance == null ? null : Math.max(0, entry.allowance - entry.used - entry.reserved);

    map.set(policy.deductsFrom, entry);
  }

  // 4) Recalcular available al final (por las dudas)
  for (const [k, v] of map) {
    if (k === vacKey && vacDb) continue; // ya viene cerrado
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

export function buildHistoryRows(absences: Absence[], year: number, month0?: number): HistoryRow[] {
  const relevant = absences.filter((a) => {
    if (a.status !== "aprobado" && a.status !== "pendiente") return false;
    if (month0 == null) return overlapsYear(a, year);
    return overlapsMonth(a, year, month0);
  });

  const rows: HistoryRow[] = [];

  for (const a of relevant) {
    const policy =
      a.type === "licencia"
        ? getPolicySafe({ type: "licencia" as any, subtype: (a as any).subtype ?? null })
        : getPolicySafe({ type: a.type as any, subtype: null });

    if (!policy?.deducts || !policy.deductsFrom) continue;

    const bounds = periodBounds(year, month0);
    const range = clampRange(a.from, a.to, bounds.fromISO, bounds.toISO);
    if (!range) continue;

    const amt = amountForAbsence(a, policy.unit, range);

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
