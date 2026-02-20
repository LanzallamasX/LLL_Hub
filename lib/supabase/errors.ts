export function prettySupabaseError(err: any) {
  const msg = String(err?.message ?? "");

  // Exclusion constraint violation (Postgres)
  if (err?.code === "23P01" || msg.includes("absences_no_overlap_active")) {
    return "Ese rango se solapa con una ausencia pendiente o aprobada. Elegí otras fechas.";
  }

  return msg || "Ocurrió un error. Probá de nuevo.";
}