"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ProfileRole, ProfileRow } from "@/lib/supabase/profilesAdmin";

export type EditProfilePayload = {
  // identidad
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;

  // RRHH
  dni?: string | null;
  job_title?: string | null;
  team?: string | null;
  start_date?: string | null; // YYYY-MM-DD (solo si cambia)

  // salud / emergencia
  blood_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;

  // authz
  role?: ProfileRole;
  active?: boolean;

  // excepción individual a la regla por antigüedad
  vacation_days_override?: number | null;

  // ✅ migración vacaciones
  vacation_migration_date?: string | null; // YYYY-MM-DD
  vacation_available_at_migration?: number | null; // >= 0
};

function splitFullName(fullName?: string | null) {
  const v = (fullName ?? "").trim();
  if (!v) return { firstName: "", lastName: "" };

  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] text-lll-text-soft">{label}</label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-[12px] text-lll-text-soft">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="mb-3">
        <p className="text-[12px] uppercase tracking-wide text-lll-text-soft/80">{title}</p>
        {subtitle ? <p className="text-[12px] text-lll-text-soft mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function toDateInputValue(v: unknown) {
  // Supabase puede devolverte date como "YYYY-MM-DD" o timestamp.
  // Para <input type="date"> necesitamos "YYYY-MM-DD".
  const s = (v ?? "").toString().trim();
  if (!s) return "";
  // si viene "YYYY-MM-DDTHH:mm..." nos quedamos con la parte date
  return s.includes("T") ? s.slice(0, 10) : s;
}

function toNumberSafe(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
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
  // Identidad
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // RRHH
  const [dni, setDni] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [team, setTeam] = useState("");
  const [startDate, setStartDate] = useState("");
  const [initialStartDate, setInitialStartDate] = useState("");

  // Salud / emergencia
  const [bloodType, setBloodType] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // authz
  const [role, setRole] = useState<ProfileRole>("user");
  const [active, setActive] = useState(true);

  // Vacaciones: vacío = política general por antigüedad
  const [vacationDaysOverride, setVacationDaysOverride] = useState("");

  // ✅ migración vacaciones
  const [vacMigrationDate, setVacMigrationDate] = useState("");
  const [vacAvailableAtMigration, setVacAvailableAtMigration] = useState<number>(0);

  // UI state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const computedFullName = useMemo(() => {
    const v = `${firstName} ${lastName}`.trim();
    return v ? v : null;
  }, [firstName, lastName]);

  const canSave = useMemo(() => !!user && !saving, [user, saving]);

  const isDirty = useMemo(() => {
    if (!user) return false;

    const uStart = toDateInputValue(user.start_date);
    const uMig = toDateInputValue((user as any).vacation_migration_date);
    const uAvail = toNumberSafe((user as any).vacation_available_at_migration, 0);
    const uOverride =
      user.vacation_days_override == null ? "" : String(user.vacation_days_override);

    return (
      (user.first_name ?? "") !== firstName ||
      (user.last_name ?? "") !== lastName ||
      (user.dni ?? "") !== dni ||
      (user.job_title ?? "") !== jobTitle ||
      (user.team ?? "") !== team ||
      uStart !== startDate ||
      (user.blood_type ?? "") !== bloodType ||
      (user.emergency_contact_name ?? "") !== emergencyName ||
      (user.emergency_contact_phone ?? "") !== emergencyPhone ||
      user.role !== role ||
      user.active !== active ||
      uOverride !== vacationDaysOverride.trim() ||
      uMig !== vacMigrationDate ||
      uAvail !== toNumberSafe(vacAvailableAtMigration, 0)
    );
  }, [
    user,
    firstName,
    lastName,
    dni,
    jobTitle,
    team,
    startDate,
    bloodType,
    emergencyName,
    emergencyPhone,
    role,
    active,
    vacationDaysOverride,
    vacMigrationDate,
    vacAvailableAtMigration,
  ]);

  useEffect(() => {
    if (!open || !user) return;

    setErrorMsg(null);

    const fn = (user.first_name ?? "").trim();
    const ln = (user.last_name ?? "").trim();
    if (fn || ln) {
      setFirstName(fn);
      setLastName(ln);
    } else {
      const s = splitFullName(user.full_name);
      setFirstName(s.firstName);
      setLastName(s.lastName);
    }

    setDni(user.dni ?? "");
    setJobTitle(user.job_title ?? "");
    setTeam(user.team ?? "");

    const sd = toDateInputValue(user.start_date);
    setStartDate(sd);
    setInitialStartDate(sd);

    // OJO: estos campos están en la DB; si tu ProfileRow no los tiene tipados, por TS
    // podés extender el tipo en profilesAdmin.ts. Acá lo leemos de forma segura.
    setVacMigrationDate(toDateInputValue((user as any).vacation_migration_date));
    setVacAvailableAtMigration(toNumberSafe((user as any).vacation_available_at_migration, 0));

    setBloodType(user.blood_type ?? "");
    setEmergencyName(user.emergency_contact_name ?? "");
    setEmergencyPhone(user.emergency_contact_phone ?? "");

    setRole(user.role);
    setActive(user.active);

    setVacationDaysOverride(
      user.vacation_days_override == null ? "" : String(user.vacation_days_override)
    );
  }, [open, user]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canSave) void handleSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    canSave,
    firstName,
    lastName,
    dni,
    jobTitle,
    team,
    startDate,
    bloodType,
    emergencyName,
    emergencyPhone,
    role,
    active,
    vacationDaysOverride,
    vacMigrationDate,
    vacAvailableAtMigration,
  ]);

  if (!open) return null;

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const overrideText = vacationDaysOverride.trim();
      const overrideValue = overrideText ? Number(overrideText) : null;

      if (
        overrideValue !== null &&
        (!Number.isInteger(overrideValue) || overrideValue < 1 || overrideValue > 366)
      ) {
        setErrorMsg("La excepción de vacaciones debe ser un número entero entre 1 y 366.");
        return;
      }

      const payload: EditProfilePayload = {
        first_name: firstName.trim() ? firstName.trim() : null,
        last_name: lastName.trim() ? lastName.trim() : null,
        full_name: computedFullName,

        dni: dni.trim() ? dni.trim() : null,
        job_title: jobTitle.trim() ? jobTitle.trim() : null,
        team: team.trim() ? team.trim() : null,

        blood_type: bloodType.trim() ? bloodType.trim() : null,
        emergency_contact_name: emergencyName.trim() ? emergencyName.trim() : null,
        emergency_contact_phone: emergencyPhone.trim() ? emergencyPhone.trim() : null,

        role,
        active,

        // ✅ migración vacaciones
        vacation_migration_date: vacMigrationDate.trim() ? vacMigrationDate.trim() : null,
        vacation_available_at_migration: Number.isFinite(vacAvailableAtMigration)
          ? Math.max(0, vacAvailableAtMigration)
          : 0,
      };

      // ✅ solo si cambió start_date
      if (startDate !== initialStartDate) {
        payload.start_date = startDate.trim() ? startDate.trim() : null;
      }

      const initialOverride = user.vacation_days_override ?? null;
      if (overrideValue !== initialOverride) {
        payload.vacation_days_override = overrideValue;
      }

      // guardrail: si seteás disponible pero no fecha, es fácil olvidarse.
      // podés cambiar esta regla si querés.
      if (!payload.vacation_migration_date && (payload.vacation_available_at_migration ?? 0) > 0) {
        setErrorMsg("Para usar 'Disponible al migrar', seteá también la fecha de migración.");
        return;
      }

      await onSave(user.id, payload);
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Error guardando cambios");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm focus:border-lll-accent/70 focus:ring-2 focus:ring-lll-accent/20";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-lll-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Editar colaborador</p>
            <p className="text-[12px] text-lll-text-soft truncate">{user?.email ?? "—"}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer">
                {computedFullName ?? "—"}
              </span>

              <span
                className={clsx(
                  "text-[12px] px-2 py-1 rounded-full border",
                  active
                    ? "border-lll-border bg-lll-bg-softer text-lll-text"
                    : "border-lll-border bg-black/10 text-lll-text-soft"
                )}
              >
                {active ? "Activo" : "Inactivo"}
              </span>

              <span className="text-[12px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer">
                Rol: {role}
              </span>
            </div>
          </div>

          <button
            className="w-9 h-9 rounded-full bg-lll-bg-softer border border-lll-border hover:opacity-90"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[75vh] overflow-auto space-y-4">
          {errorMsg ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {errorMsg}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Identidad" subtitle="Nombre y apellido usados para mostrar en la app.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nombre">
                  <input
                    className={inputClass}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej: Patricio"
                  />
                </Field>

                <Field label="Apellido">
                  <input
                    className={inputClass}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej: Sine"
                  />
                </Field>

                <div className="md:col-span-2 text-[12px] text-lll-text-soft">
                  Se mostrará como: <span className="text-lll-text">{computedFullName ?? "—"}</span>
                </div>
              </div>
            </Section>

            <Section title="RRHH" subtitle="Datos laborales para políticas y reportes.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="DNI">
                  <input
                    className={inputClass}
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej: 12345678"
                  />
                </Field>

                <Field label="Puesto">
                  <input
                    className={inputClass}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ej: Frontend Developer"
                  />
                </Field>

                <Field label="Equipo">
                  <input
                    className={inputClass}
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="Ej: Frontend, Diseño…"
                  />
                </Field>

                <Field label="Fecha de ingreso">
                  <input
                    type="date"
                    className={inputClass}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Salud y emergencia" subtitle="Opcional. Visible para RRHH.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Grupo sanguíneo">
                  <input
                    className={inputClass}
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    placeholder="Ej: O+, A-, AB+…"
                  />
                </Field>

                <div />

                <Field label="Contacto emergencia (Nombre)">
                  <input
                    className={inputClass}
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                  />
                </Field>

                <Field label="Contacto emergencia (Teléfono)">
                  <input
                    className={inputClass}
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="Ej: +54 11 5555-5555"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Acceso" subtitle="Permisos y estado de la cuenta.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Rol">
                  <select
                    className={inputClass}
                    value={role}
                    onChange={(e) => setRole(e.target.value as ProfileRole)}
                  >
                    <option value="user">user</option>
                    <option value="owner">owner</option>
                  </select>
                </Field>

                <Field label="Estado">
                  <select
                    className={inputClass}
                    value={active ? "active" : "inactive"}
                    onChange={(e) => setActive(e.target.value === "active")}
                  >
                    <option value="active">activo</option>
                    <option value="inactive">inactivo</option>
                  </select>
                </Field>

              </div>
            </Section>
          </div>

          <Section
            title="Política de vacaciones"
            subtitle="Sin una excepción se aplica automáticamente la regla general por antigüedad (14, 21, 28 o 35 días)."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Días por año (excepción individual)"
                hint="Dejalo vacío para usar la regla general. Por ejemplo, cargá 20 si la persona acordó 20 días hábiles desde su ingreso."
              >
                <input
                  type="number"
                  min={1}
                  max={366}
                  step={1}
                  inputMode="numeric"
                  className={inputClass}
                  value={vacationDaysOverride}
                  onChange={(e) => setVacationDaysOverride(e.target.value)}
                  placeholder="Regla general"
                />
              </Field>

              <div className="flex items-end">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-[12px]"
                  onClick={() => setVacationDaysOverride("")}
                  disabled={!vacationDaysOverride}
                >
                  Usar regla general
                </button>
              </div>
            </div>
          </Section>

          <Section
            title="Migración (vacaciones)"
            subtitle="Usalo si venís de Naloo u otra fuente y querés arrancar con saldo inicial."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Fecha de migración (desde cuándo cuenta LLL Hub)"
                hint="Si está seteada, el saldo arranca desde esta fecha usando el disponible inicial."
              >
                <input
                  type="date"
                  className={inputClass}
                  value={vacMigrationDate}
                  onChange={(e) => setVacMigrationDate(e.target.value)}
                />
              </Field>

              <Field label="Disponible al migrar" hint="Ej: si en Naloo le quedaban 20, ponés 20.">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={vacAvailableAtMigration}
                  onChange={(e) => setVacAvailableAtMigration(Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-[12px]"
                onClick={() => {
                  setVacMigrationDate("");
                  setVacAvailableAtMigration(0);
                }}
              >
                Limpiar migración
              </button>

              <div className="text-[12px] text-lll-text-soft flex items-center">
                Tip: podés guardar con{" "}
                <span className="mx-1 px-1 rounded bg-black/10">Ctrl</span>+
                <span className="px-1 rounded bg-black/10">S</span>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-lll-border flex items-center justify-between gap-2">
          <div className="text-[12px] text-lll-text-soft">
            {saving ? "Guardando…" : isDirty ? "Hay cambios sin guardar" : "Sin cambios"}
          </div>

          <div className="flex gap-2">
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
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
