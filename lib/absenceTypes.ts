export type AbsenceTypeId = "vacaciones" | "home_office" | "enfermedad";


export type AbsenceTypeDef = {
  id: AbsenceTypeId;
  label: string;
  // token de estilo para UI (sin acoplar a Tailwind específico)
  tone: "accent" | "alt" | "neutral";
  requiresApproval: boolean;
  active: boolean;
};

export const ABSENCE_TYPES: AbsenceTypeDef[] = [
  {
    id: "vacaciones",
    label: "Vacaciones",
    tone: "accent",
    requiresApproval: true,
    active: true,
  },
  {
    id: "home_office",
    label: "Home Office",
    tone: "alt",
    requiresApproval: true,
    active: true,
  },
  {
    id: "enfermedad",
    label: "Enfermedad",
    tone: "neutral",
    requiresApproval: false,
    active: true,
  },
];

export function getAbsenceType(id: AbsenceTypeId) {
  return ABSENCE_TYPES.find((t) => t.id === id) ?? null;
}

export function getAbsenceTypeLabel(id: AbsenceTypeId) {
  return getAbsenceType(id)?.label ?? id;
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
