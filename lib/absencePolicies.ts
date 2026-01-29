// src/lib/absencePolicies.ts
export type PolicyUnit = "day" | "hour";

export type BalanceKey =
  | "VACATION_DAYS"
  | "HOME_OFFICE_DAYS"        // ✅ NUEVO
  | "BIRTHDAY_DAY"
  | "LIC_FAMILY_CARE_DAYS"
  | "LIC_EXAMS_DAYS"
  | "LIC_BEREAVEMENT_CLOSE_DAYS"
  | "LIC_BEREAVEMENT_SIBLING_DAYS"
  | "LIC_PATERNITY_DAYS"
  | "LIC_MATERNITY_DAYS"
  | "LIC_MOVING_DAYS"
  | "LIC_LCT_PERSONAL_DAYS"
  | "LIC_PERSONAL_TRAMITE_HOURS"
  | "LIC_MEDICAL_APPT_HOURS";

export type AbsenceType =
  | "vacaciones"
  | "home_office"
  | "cumple"
  | "enfermedad"
  | "licencia";

export type LicenseSubtype =
  | "ATENCION_GRUPO_FAMILIAR"
  | "CUMPLEANIOS_LIBRE"
  | "EXAMEN"
  | "FALLECIMIENTO_CONYUGE_HIJO_PADRES"
  | "FALLECIMIENTO_HERMANO"
  | "PATERNIDAD"
  | "MATERNIDAD"
  | "MUDANZA"
  | "RAZONES_PARTICULARES_LCT"
  | "TRAMITE_PERSONAL"
  | "TURNO_MEDICO";

export type Policy = {
  key: string;
  type: AbsenceType;
  subtype?: LicenseSubtype;
  unit: PolicyUnit;
  allowance: number | null;
  deducts: boolean;
  deductsFrom?: BalanceKey;
};

export const POLICIES: Policy[] = [
  // --- AUSENCIAS POR DÍAS ---
  { key: "VACACIONES", type: "vacaciones", unit: "day", allowance: null, deducts: true, deductsFrom: "VACATION_DAYS" },

  // ✅ Home Office con cupo anual
  { key: "HOME_OFFICE", type: "home_office", unit: "day", allowance: 15, deducts: true, deductsFrom: "HOME_OFFICE_DAYS" },

  { key: "CUMPLE", type: "cumple", unit: "day", allowance: 1, deducts: true, deductsFrom: "BIRTHDAY_DAY" },
  { key: "ENFERMEDAD", type: "enfermedad", unit: "day", allowance: null, deducts: false },

  // --- LICENCIAS ---
  { key: "LIC_FAMILY_CARE", type: "licencia", subtype: "ATENCION_GRUPO_FAMILIAR", unit: "day", allowance: 20, deducts: true, deductsFrom: "LIC_FAMILY_CARE_DAYS" },
  { key: "LIC_BDAY_FREE", type: "licencia", subtype: "CUMPLEANIOS_LIBRE", unit: "day", allowance: 1, deducts: true, deductsFrom: "BIRTHDAY_DAY" },
  { key: "LIC_EXAMS", type: "licencia", subtype: "EXAMEN", unit: "day", allowance: 10, deducts: true, deductsFrom: "LIC_EXAMS_DAYS" },
  { key: "LIC_BEREAV_CLOSE", type: "licencia", subtype: "FALLECIMIENTO_CONYUGE_HIJO_PADRES", unit: "day", allowance: 3, deducts: true, deductsFrom: "LIC_BEREAVEMENT_CLOSE_DAYS" },
  { key: "LIC_BEREAV_SIB", type: "licencia", subtype: "FALLECIMIENTO_HERMANO", unit: "day", allowance: 1, deducts: true, deductsFrom: "LIC_BEREAVEMENT_SIBLING_DAYS" },
  { key: "LIC_PATERNITY", type: "licencia", subtype: "PATERNIDAD", unit: "day", allowance: 2, deducts: true, deductsFrom: "LIC_PATERNITY_DAYS" },
  { key: "LIC_MATERNITY", type: "licencia", subtype: "MATERNIDAD", unit: "day", allowance: 90, deducts: true, deductsFrom: "LIC_MATERNITY_DAYS" },
  { key: "LIC_MOVING", type: "licencia", subtype: "MUDANZA", unit: "day", allowance: 1, deducts: true, deductsFrom: "LIC_MOVING_DAYS" },
  { key: "LIC_LCT", type: "licencia", subtype: "RAZONES_PARTICULARES_LCT", unit: "day", allowance: 6, deducts: true, deductsFrom: "LIC_LCT_PERSONAL_DAYS" },
  { key: "LIC_TRAMITE", type: "licencia", subtype: "TRAMITE_PERSONAL", unit: "hour", allowance: 12, deducts: true, deductsFrom: "LIC_PERSONAL_TRAMITE_HOURS" },
  { key: "LIC_MEDICAL", type: "licencia", subtype: "TURNO_MEDICO", unit: "hour", allowance: 6, deducts: true, deductsFrom: "LIC_MEDICAL_APPT_HOURS" },
];

export function getPolicySafe(input: { type: AbsenceType; subtype?: LicenseSubtype | null }) {
  return POLICIES.find(
    (x) => x.type === input.type && (input.type !== "licencia" ? true : x.subtype === input.subtype)
  ) ?? null;
}


export const getPolicy = getPolicySafe;