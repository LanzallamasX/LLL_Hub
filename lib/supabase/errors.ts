export function prettySupabaseError(err: unknown) {
  const source = err && typeof err === "object" ? err as Record<string, unknown> : {};
  const msg = String(source.message ?? "");

  if (msg.includes("ABSENCE_BLOCKED_PERIOD")) {
    const [, dateFrom, dateTo, reason] = msg.split("|");
    if (dateFrom && dateTo) {
      return `Esas fechas no están disponibles (${dateFrom} → ${dateTo})${
        reason ? `: ${reason}` : "."
      }`;
    }
    return "Las fechas elegidas pertenecen a un período bloqueado.";
  }

  // Exclusion constraint violation (Postgres)
  if (source.code === "23P01" || msg.includes("absences_no_overlap_active")) {
    return "Ese rango se solapa con una ausencia pendiente o aprobada. Elegí otras fechas.";
  }

  return msg || "Ocurrió un error. Probá de nuevo.";
}
