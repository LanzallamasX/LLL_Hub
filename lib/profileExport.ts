import type { ProfileRow } from "@/lib/supabase/profilesAdmin";

function safeSpreadsheetValue(value: unknown) {
  const text = value == null || value === "" ? "Sin informar" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown) {
  return `"${safeSpreadsheetValue(value).replace(/"/g, '""')}"`;
}

function displayName(profile: ProfileRow) {
  const normalized = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return normalized || profile.full_name?.trim() || profile.email || "colaborador";
}

function filenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "colaborador";
}

export function downloadProfileCsv(profile: ProfileRow) {
  const rows: Array<[string, string, unknown]> = [
    ["Identidad", "Nombre", profile.first_name],
    ["Identidad", "Apellido", profile.last_name],
    ["Identidad", "Nombre completo", displayName(profile)],
    ["Identidad", "Email", profile.email],
    ["Identidad", "Fecha de nacimiento", profile.birth_date],
    ["Laboral", "DNI", profile.dni],
    ["Laboral", "Puesto", profile.job_title],
    ["Laboral", "Equipo", profile.team],
    ["Laboral", "Fecha de ingreso", profile.start_date],
    ["Domicilio", "Dirección", profile.address],
    ["Domicilio", "Localidad / ciudad", profile.locality],
    ["Domicilio", "Provincia", profile.province],
    ["Domicilio", "Código postal", profile.postal_code],
    ["Domicilio", "País", profile.country],
    ["Salud y emergencia", "Grupo sanguíneo", profile.blood_type],
    ["Salud y emergencia", "Contacto", profile.emergency_contact_name],
    ["Salud y emergencia", "Teléfono", profile.emergency_contact_phone],
    ["Acceso", "Rol", profile.role],
    ["Acceso", "Estado", profile.active ? "Activo" : "Inactivo"],
    [
      "Vacaciones",
      "Días anuales",
      profile.vacation_days_override ?? "Regla general por antigüedad",
    ],
    ["Vacaciones", "Fecha de migración", profile.vacation_migration_date],
    ["Vacaciones", "Disponible al migrar", profile.vacation_available_at_migration],
    ["Sistema", "ID", profile.id],
    ["Sistema", "Creado", profile.created_at],
    ["Sistema", "Actualizado", profile.updated_at],
  ];

  const csv = [["Sección", "Campo", "Valor"], ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ficha-${filenamePart(displayName(profile))}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
