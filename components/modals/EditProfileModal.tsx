"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileRole, ProfileRow } from "@/lib/supabase/profilesAdmin";

export type EditProfilePayload = {
  // identidad
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null; // legacy compat

  // RRHH
  dni?: string | null;
  job_title?: string | null;
  team?: string | null;
  start_date?: string | null; // YYYY-MM-DD

  // salud / emergencia
  blood_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;

  // authz
  role?: ProfileRole;
  active?: boolean;

  // legacy (lo vamos a deprecar)
  annual_vacation_days?: number;
};

function splitFullName(fullName?: string | null) {
  const v = (fullName ?? "").trim();
  if (!v) return { firstName: "", lastName: "" };

  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export default function EditProfileModal({
  open,
  user,
  onClose,
  onSave,
}: {
  open: boolean;
  user: ProfileRow | null;
  onClose: () => void;
  onSave: (id: string, payload: EditProfilePayload) => Promise<void>;
}) {
  // ✅ Identidad
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // ✅ RRHH
  const [dni, setDni] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [team, setTeam] = useState("");
  const [startDate, setStartDate] = useState("");

  // ✅ Salud / emergencia
  const [bloodType, setBloodType] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // ✅ authz
  const [role, setRole] = useState<ProfileRole>("user");
  const [active, setActive] = useState(true);

  // legacy
  const [annualDays, setAnnualDays] = useState<number>(10);

  const canSave = useMemo(() => !!user, [user]);

  const computedFullName = useMemo(() => {
    const v = `${firstName} ${lastName}`.trim();
    return v ? v : null;
  }, [firstName, lastName]);

  useEffect(() => {
    if (!open || !user) return;

    // ✅ Preferimos first/last reales si existen
    const fn = (user.first_name ?? "").trim();
    const ln = (user.last_name ?? "").trim();

    if (fn || ln) {
      setFirstName(fn);
      setLastName(ln);
    } else {
      // fallback legacy
      const s = splitFullName(user.full_name);
      setFirstName(s.firstName);
      setLastName(s.lastName);
    }

    setDni(user.dni ?? "");
    setJobTitle(user.job_title ?? "");
    setTeam(user.team ?? "");
    setStartDate(user.start_date ?? "");

    setBloodType(user.blood_type ?? "");
    setEmergencyName(user.emergency_contact_name ?? "");
    setEmergencyPhone(user.emergency_contact_phone ?? "");

    setRole(user.role);
    setActive(user.active);

    setAnnualDays(Number(user.annual_vacation_days ?? 10));
  }, [open, user]);

  if (!open) return null;

  async function handleSave() {
    if (!user) return;

    await onSave(user.id, {
      // identidad
      first_name: firstName.trim() ? firstName.trim() : null,
      last_name: lastName.trim() ? lastName.trim() : null,
      full_name: computedFullName, // legacy compat

      // RRHH
      dni: dni.trim() ? dni.trim() : null,
      job_title: jobTitle.trim() ? jobTitle.trim() : null,
      team: team.trim() ? team.trim() : null,
      start_date: startDate || null,

      // salud / emergencia
      blood_type: bloodType.trim() ? bloodType.trim() : null,
      emergency_contact_name: emergencyName.trim() ? emergencyName.trim() : null,
      emergency_contact_phone: emergencyPhone.trim() ? emergencyPhone.trim() : null,

      // authz
      role,
      active,

      // legacy
      annual_vacation_days: Number.isFinite(annualDays) ? annualDays : 10,
    });

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
        <div className="p-4 border-b border-lll-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Editar empleado</p>
            <p className="text-[12px] text-lll-text-soft">{user?.email ?? "—"}</p>
          </div>

          <button
            className="w-9 h-9 rounded-full bg-lll-bg-softer border border-lll-border"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Identidad */}
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-wide text-lll-text-soft/80">
              Identidad
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-lll-text-soft">Nombre</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Patricio"
                />
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">Apellido</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Sine"
                />
              </div>

              <div className="md:col-span-2 text-[12px] text-lll-text-soft">
                Se mostrará como:{" "}
                <span className="text-lll-text">{computedFullName ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* RRHH */}
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-wide text-lll-text-soft/80">
              RRHH
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-lll-text-soft">DNI</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Ej: 12345678"
                />
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">Puesto</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ej: Frontend Developer"
                />
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">Equipo</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="Ej: Frontend, Diseño…"
                />
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">Fecha de ingreso</label>
                <input
                  type="date"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Salud / Emergencia */}
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-wide text-lll-text-soft/80">
              Salud y emergencia
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-lll-text-soft">Grupo sanguíneo</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  placeholder="Ej: O+, A-, AB+…"
                />
              </div>

              <div />

              <div>
                <label className="text-[12px] text-lll-text-soft">
                  Contacto emergencia (Nombre)
                </label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">
                  Contacto emergencia (Teléfono)
                </label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Ej: +54 11 5555-5555"
                />
              </div>
            </div>
          </div>

          {/* Authz + legacy */}
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-wide text-lll-text-soft/80">
              Acceso
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-lll-text-soft">Rol</label>
                <select
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as ProfileRole)}
                >
                  <option value="user">user</option>
                  <option value="owner">owner</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">Activo</label>
                <select
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={active ? "active" : "inactive"}
                  onChange={(e) => setActive(e.target.value === "active")}
                >
                  <option value="active">activo</option>
                  <option value="inactive">inactivo</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">
                  Vacaciones / año (legacy)
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                  value={annualDays}
                  onChange={(e) => setAnnualDays(Number(e.target.value))}
                />
                <p className="mt-1 text-[12px] text-lll-text-soft">
                  Luego lo pasamos a cálculo por políticas usando fecha de ingreso.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text"
              type="button"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg font-semibold bg-lll-accent text-black disabled:opacity-50"
              type="button"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
