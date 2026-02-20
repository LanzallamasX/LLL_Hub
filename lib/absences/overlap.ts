// lib/absences/overlap.ts
export type AbsenceLike = {
  id: string;
  status: "pendiente" | "aprobado" | "rechazado";
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  // strings ISO date "YYYY-MM-DD" se comparan lexicográficamente OK
  return aFrom <= bTo && bFrom <= aTo;
}

export function findOverlappingAbsence(
  absences: AbsenceLike[],
  rangeFrom: string,
  rangeTo: string,
  opts?: { ignoreId?: string; statuses?: Array<AbsenceLike["status"]> }
) {
  const ignoreId = opts?.ignoreId;
  const statuses = opts?.statuses ?? ["pendiente", "aprobado"];

  for (const a of absences) {
    if (ignoreId && a.id === ignoreId) continue;
    if (!statuses.includes(a.status)) continue;
    if (rangesOverlap(rangeFrom, rangeTo, a.from, a.to)) return a;
  }
  return null;
}