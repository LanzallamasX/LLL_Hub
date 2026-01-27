import type { AbsenceTypeId } from "@/lib/absenceTypes";

export type QuotaKind = "none" | "annual_days" | "annual_once";

export type AbsencePolicy = {
  id: AbsenceTypeId;
  quota: {
    kind: QuotaKind;
    daysPerYear?: number; // para annual_days
  };
  countsWeekends: boolean; // si cuenta sáb/dom para el cupo de este tipo
  forceSingleDay?: boolean; // para cumpleaños
};

export const ABSENCE_POLICIES: Record<AbsenceTypeId, AbsencePolicy> = {
  vacaciones: {
    id: "vacaciones",
    quota: { kind: "none" }, // vacaciones usa SU propio saldo (antigüedad/acumulación)
    countsWeekends: false,   // tu empresa no descuenta sáb/dom
  },
  home_office: {
    id: "home_office",
    quota: { kind: "annual_days", daysPerYear: 15 },
    countsWeekends: false, // recomendación: contar Lun–Vie (consistente con vacaciones)
  },
  enfermedad: {
    id: "enfermedad",
    quota: { kind: "none" },
    countsWeekends: true, // irrelevante porque no tiene cuota
  },
  cumpleanos: {
    id: "cumpleanos",
    quota: { kind: "annual_once" }, // 1 vez por año
    countsWeekends: true,           // irrelevante por ser 1 día
    forceSingleDay: true,
  },
};
