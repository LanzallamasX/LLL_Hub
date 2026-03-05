// lib/vacations/adapters.ts
import type { VacationBalance } from "@/lib/supabase/vacations";

export type VacationInfoForModal = {
  accrued: number;   // acumuladas (granted)
  used: number;      // usadas pasadas (aprobado)
  reserved: number;  // aprobadas futuras/en curso
  pending: number;   // pendientes futuras/en curso
  available: number; // disponible real (ya neto si tu SQL resta pending)
};

const int = (n: any) => Math.floor(Number(n ?? 0));

export function toVacationInfoForModal(
  vacDb: VacationBalance | null
): VacationInfoForModal | null {
  if (!vacDb) return null;

  return {
    accrued: int(vacDb.granted),
    used: int(vacDb.used),
    reserved: int((vacDb as any).reserved),
    pending: int((vacDb as any).reserved_pending),
    available: int(vacDb.available),
  };
}