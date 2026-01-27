import type { AbsenceType, LicenseSubtype } from "./absencePolicies";

export type AbsenceTypeId =
  | "vacaciones"
  | "home_office"
  | "enfermedad"
  | "cumple"
  | "licencia";

export type AbsenceTypeDef = {
  id: AbsenceTypeId;
  label: string;
  tone: "accent" | "alt" | "neutral";
  requiresApproval: boolean;
  active: boolean;
};

export const ABSENCE_TYPES: AbsenceTypeDef[] = [
  { id: "vacaciones", label: "Vacaciones", tone: "accent", requiresApproval: true, active: true },
  { id: "home_office", label: "Home Office", tone: "alt", requiresApproval: true, active: true },
  { id: "cumple", label: "Cumpleaños", tone: "alt", requiresApproval: true, active: true },
  { id: "licencia", label: "Licencia", tone: "neutral", requiresApproval: true, active: true },
  { id: "enfermedad", label: "Enfermedad", tone: "neutral", requiresApproval: false, active: true },
];


export function getAbsenceType(id: AbsenceTypeId) {
  return ABSENCE_TYPES.find((t) => t.id === id) ?? null;
}


/*
export function getAbsenceTypeLabel(id: AbsenceTypeId) {
  return getAbsenceType(id)?.label ?? id;
}
*/
export function getAbsenceTypeLabel(type: AbsenceTypeId, subtype?: LicenseSubtype | null) {
  if (type === "licencia") {
    return subtype ? getLicenseSubtypeLabel(subtype) : "Licencia";
  }
  return getAbsenceType(type)?.label ?? type;
}


export function getLicenseSubtypeLabel(subtype: LicenseSubtype) {
  switch (subtype) {
    case "ATENCION_GRUPO_FAMILIAR": return "Licencia atención del grupo familiar";
    case "CUMPLEANIOS_LIBRE": return "Día de cumpleaños libre";
    case "EXAMEN": return "Examen (Enseñanza Media o Universitaria)";
    case "FALLECIMIENTO_CONYUGE_HIJO_PADRES": return "Fallecimiento cónyuge/unión convivencial, hijo o padres";
    case "FALLECIMIENTO_HERMANO": return "Fallecimiento hermano/a";
    case "PATERNIDAD": return "Paternidad";
    case "MATERNIDAD": return "Maternidad";
    case "MUDANZA": return "Mudanza";
    case "RAZONES_PARTICULARES_LCT": return "Razones particulares (LCT)";
    case "TRAMITE_PERSONAL": return "Trámite personal";
    case "TURNO_MEDICO": return "Turno médico";
    default: return subtype;
  }
}

/**
 * Clases de estilo para “marcas” en calendario/listas.
 * Si mañana cambiás la paleta, cambiás esto en un solo lugar.
 */
export function getAbsenceTypeToneClasses(tone: AbsenceTypeDef["tone"]) {
  if (tone === "accent") {
    return {
      // fondo + borde para rangos aprobados (o tipo base)
      range: "bg-lll-accent-soft border-lll-accent/60 text-lll-text",
      dot: "bg-lll-accent",
    };
  }

  if (tone === "alt") {
    return {
      range: "bg-lll-bg-soft border-lll-accent-alt/60 text-lll-text",
      dot: "bg-lll-accent-alt",
    };
  }

  return {
    range: "bg-lll-bg-softer border-lll-border text-lll-text-soft",
    dot: "bg-lll-border",
  };
}
