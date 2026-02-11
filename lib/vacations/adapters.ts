// lib/vacations/adapters.ts
import type { VacationBalance } from "@/lib/supabase/vacations";

export type VacationInfoForModal = {
  entitlement: number;  // cupo anual (bucket actual)
  carryover: number;    // acumulado vivo (remanente de buckets anteriores)
  usedThisYear: number; // usado ventana (fifo)
  available: number;    // disponible ventana
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Interpreta buckets (ventana 3 años) para mostrar:
 * Cupo = granted del bucket vigente más reciente (grant_date <= hoy)
 * Acum = sum(remaining) de buckets anteriores al bucket actual
 * Usado = used total ventana
 * Disponible = available total ventana
 */
export function toVacationInfoForModalFromBuckets(
  vacDb: VacationBalance | null
): VacationInfoForModal | null {
  if (!vacDb) return null;

  const buckets = Array.isArray(vacDb.buckets) ? vacDb.buckets : [];
  const available = Number(vacDb.available ?? 0);
  const used = Number(vacDb.used ?? 0);

  if (buckets.length === 0) {
    return {
      entitlement: 0,
      carryover: 0,
      usedThisYear: used,
      available,
    };
  }

  const today = ymd(new Date());

  // bucket "actual": el más reciente por grant_date <= hoy y no expirado
  const eligible = buckets
    .filter((b) => (b.grant_date ?? "") <= today && (b.expires_at ?? "") > today)
    .sort((a, b) => String(a.grant_date).localeCompare(String(b.grant_date)));

  const currentBucket = eligible.length ? eligible[eligible.length - 1] : null;

  const entitlement = currentBucket ? Number(currentBucket.granted ?? 0) : 0;
  const currentGrantDate = currentBucket ? String(currentBucket.grant_date ?? "") : "";

  const carryover = buckets
    .filter((b) => String(b.grant_date ?? "") < currentGrantDate)
    .reduce((acc, b) => acc + Number(b.remaining ?? 0), 0);

  return {
    entitlement,
    carryover,
    usedThisYear: used,
    available,
  };
}
