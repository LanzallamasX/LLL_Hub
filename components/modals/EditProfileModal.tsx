"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import {
  FormField,
  formControlClassName,
} from "@/components/ui/FormField";
import { usePresence } from "@/components/ui/usePresence";
import { downloadProfileCsv } from "@/lib/profileExport";
import type { ProfileRole, ProfileRow } from "@/lib/supabase/profilesAdmin";

export type EditProfilePayload = Partial<
  Pick<
    ProfileRow,
    | "first_name"
    | "last_name"
    | "full_name"
    | "birth_date"
    | "dni"
    | "job_title"
    | "team"
    | "start_date"
    | "blood_type"
    | "emergency_contact_name"
    | "emergency_contact_phone"
    | "address"
    | "locality"
    | "province"
    | "postal_code"
    | "country"
    | "role"
    | "active"
    | "vacation_days_override"
    | "vacation_migration_date"
    | "vacation_available_at_migration"
  >
>;

type TabId = "profile" | "address" | "vacations";

const tabs: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: AppIconName;
}> = [
  {
    id: "profile",
    label: "Datos personales",
    shortLabel: "Datos",
    icon: "person",
  },
  {
    id: "address",
    label: "Domicilio",
    shortLabel: "Domicilio",
    icon: "location",
  },
  {
    id: "vacations",
    label: "Vacaciones y acceso",
    shortLabel: "Acceso",
    icon: "policy",
  },
];

function splitFullName(fullName?: string | null) {
  const value = (fullName ?? "").trim();
  if (!value) return { firstName: "", lastName: "" };

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function toDateInputValue(value: unknown) {
  const normalized = (value ?? "").toString().trim();
  if (!normalized) return "";
  return normalized.includes("T") ? normalized.slice(0, 10) : normalized;
}

function toNumberSafe(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullable(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function ProfileSection({
  title,
  description,
  icon,
  children,
  className = "",
}: {
  title: string;
  description: string;
  icon: AppIconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-lll-border bg-lll-bg-softer/45 p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-lll-accent-alt/25 bg-lll-accent-alt/10 text-lll-accent-alt">
          <AppIcon name={icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-lll-text">{title}</h3>
          <p className="mt-0.5 text-[12px] leading-5 text-lll-text-soft">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
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
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [dni, setDni] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [team, setTeam] = useState("");
  const [startDate, setStartDate] = useState("");

  const [bloodType, setBloodType] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  const [role, setRole] = useState<ProfileRole>("user");
  const [active, setActive] = useState(true);
  const [vacationDaysOverride, setVacationDaysOverride] = useState("");
  const [vacMigrationDate, setVacMigrationDate] = useState("");
  const [vacAvailableAtMigration, setVacAvailableAtMigration] = useState(0);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const modalPresence = usePresence(open);

  const computedFullName = useMemo(() => {
    const value = `${firstName} ${lastName}`.trim();
    return value || null;
  }, [firstName, lastName]);

  const initials = useMemo(() => {
    const value = [firstName, lastName]
      .filter(Boolean)
      .map((part) => part.trim()[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
    return value || user?.email?.[0]?.toUpperCase() || "U";
  }, [firstName, lastName, user?.email]);

  const addressProgress = useMemo(
    () =>
      [address, locality, province, postalCode, country].filter(
        (value) => value.trim().length > 0
      ).length,
    [address, locality, province, postalCode, country]
  );

  const isDirty = useMemo(() => {
    if (!user) return false;

    const initialOverride =
      user.vacation_days_override == null
        ? ""
        : String(user.vacation_days_override);

    return (
      (user.first_name ?? "") !== firstName ||
      (user.last_name ?? "") !== lastName ||
      toDateInputValue(user.birth_date) !== birthDate ||
      (user.dni ?? "") !== dni ||
      (user.job_title ?? "") !== jobTitle ||
      (user.team ?? "") !== team ||
      toDateInputValue(user.start_date) !== startDate ||
      (user.blood_type ?? "") !== bloodType ||
      (user.emergency_contact_name ?? "") !== emergencyName ||
      (user.emergency_contact_phone ?? "") !== emergencyPhone ||
      (user.address ?? "") !== address ||
      (user.locality ?? "") !== locality ||
      (user.province ?? "") !== province ||
      (user.postal_code ?? "") !== postalCode ||
      (user.country ?? "") !== country ||
      user.role !== role ||
      user.active !== active ||
      initialOverride !== vacationDaysOverride.trim() ||
      toDateInputValue(user.vacation_migration_date) !== vacMigrationDate ||
      toNumberSafe(user.vacation_available_at_migration) !==
        toNumberSafe(vacAvailableAtMigration)
    );
  }, [
    user,
    firstName,
    lastName,
    birthDate,
    dni,
    jobTitle,
    team,
    startDate,
    bloodType,
    emergencyName,
    emergencyPhone,
    address,
    locality,
    province,
    postalCode,
    country,
    role,
    active,
    vacationDaysOverride,
    vacMigrationDate,
    vacAvailableAtMigration,
  ]);

  const canSave = Boolean(user && isDirty && !saving);

  useEffect(() => {
    if (!open || !user) return;

    setActiveTab("profile");
    setErrorMsg(null);

    const normalizedFirstName = (user.first_name ?? "").trim();
    const normalizedLastName = (user.last_name ?? "").trim();
    const fallbackName = splitFullName(user.full_name);

    setFirstName(normalizedFirstName || fallbackName.firstName);
    setLastName(normalizedLastName || fallbackName.lastName);
    setBirthDate(toDateInputValue(user.birth_date));

    setDni(user.dni ?? "");
    setJobTitle(user.job_title ?? "");
    setTeam(user.team ?? "");
    setStartDate(toDateInputValue(user.start_date));

    setBloodType(user.blood_type ?? "");
    setEmergencyName(user.emergency_contact_name ?? "");
    setEmergencyPhone(user.emergency_contact_phone ?? "");

    setAddress(user.address ?? "");
    setLocality(user.locality ?? "");
    setProvince(user.province ?? "");
    setPostalCode(user.postal_code ?? "");
    setCountry(user.country ?? "");

    setRole(user.role);
    setActive(user.active);
    setVacationDaysOverride(
      user.vacation_days_override == null
        ? ""
        : String(user.vacation_days_override)
    );
    setVacMigrationDate(toDateInputValue(user.vacation_migration_date));
    setVacAvailableAtMigration(
      toNumberSafe(user.vacation_available_at_migration)
    );
  }, [open, user]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSave() {
    if (!user || !canSave) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const overrideText = vacationDaysOverride.trim();
      const overrideValue = overrideText ? Number(overrideText) : null;

      if (
        overrideValue !== null &&
        (!Number.isInteger(overrideValue) ||
          overrideValue < 1 ||
          overrideValue > 366)
      ) {
        setActiveTab("vacations");
        setErrorMsg(
          "La excepción de vacaciones debe ser un número entero entre 1 y 366."
        );
        return;
      }

      if (!vacMigrationDate && vacAvailableAtMigration > 0) {
        setActiveTab("vacations");
        setErrorMsg(
          "Para usar el disponible al migrar, indicá también la fecha de migración."
        );
        return;
      }

      const payload: EditProfilePayload = {
        first_name: nullable(firstName),
        last_name: nullable(lastName),
        full_name: computedFullName,
        birth_date: nullable(birthDate),
        dni: nullable(dni),
        job_title: nullable(jobTitle),
        team: nullable(team),
        start_date: nullable(startDate),
        blood_type: nullable(bloodType),
        emergency_contact_name: nullable(emergencyName),
        emergency_contact_phone: nullable(emergencyPhone),
        address: nullable(address),
        locality: nullable(locality),
        province: nullable(province),
        postal_code: nullable(postalCode),
        country: nullable(country),
        role,
        active,
        vacation_days_override: overrideValue,
        vacation_migration_date: nullable(vacMigrationDate),
        vacation_available_at_migration: Math.max(
          0,
          Math.trunc(toNumberSafe(vacAvailableAtMigration))
        ),
      };

      await onSave(user.id, payload);
      onClose();
    } catch (error: unknown) {
      setErrorMsg(
        error instanceof Error ? error.message : "Error guardando cambios."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!modalPresence.shouldRender) return null;

  return (
    <div
      className="lll-presence-root fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-3 sm:p-5"
      data-state={modalPresence.state}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label="Editar ficha del colaborador"
    >
      <button
        type="button"
        className="lll-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div className="lll-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-lll-border bg-lll-bg-soft shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
        <header className="shrink-0 border-b border-lll-border bg-[linear-gradient(135deg,rgba(38,198,218,0.08),transparent_48%,rgba(255,107,61,0.08))] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lll-accent-alt/30 bg-lll-accent-alt/10 text-base font-bold text-lll-accent-alt sm:h-14 sm:w-14">
                {initials}
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lll-accent-alt">
                  Ficha del colaborador
                </p>
                <h2 className="mt-1 truncate text-base font-semibold text-lll-text sm:text-lg">
                  {computedFullName ?? "Sin nombre informado"}
                </h2>
                <p className="truncate text-[12px] text-lll-text-soft sm:text-[13px]">
                  {user?.email ?? "Sin email"}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      active
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {active ? "Activo" : "Inactivo"}
                  </span>
                  <span className="rounded-full border border-lll-border bg-lll-bg-softer px-2 py-0.5 text-[11px] text-lll-text-soft">
                    {role === "owner" ? "Owner" : "Colaborador"}
                  </span>
                  <span className="hidden rounded-full border border-lll-border bg-lll-bg-softer px-2 py-0.5 text-[11px] text-lll-text-soft sm:inline-flex">
                    {team.trim() || "Sin equipo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => user && downloadProfileCsv(user)}
                disabled={!user}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-lll-border bg-lll-bg-softer px-3 text-[12px] font-semibold text-lll-text transition hover:border-lll-accent-alt/40 hover:text-lll-accent-alt disabled:opacity-50"
              >
                <AppIcon name="download" className="h-4 w-4" />
                <span className="hidden sm:inline">Descargar ficha</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-lll-border bg-lll-bg-softer text-lll-text-soft transition hover:text-lll-text"
                aria-label="Cerrar"
              >
                <AppIcon name="close" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <nav
          className="grid shrink-0 grid-cols-3 border-b border-lll-border bg-lll-bg-soft px-2 sm:flex sm:px-5"
          aria-label="Secciones de la ficha"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex min-h-12 items-center justify-center gap-2 px-2 text-[12px] font-medium transition sm:px-4 ${
                  selected
                    ? "text-lll-text"
                    : "text-lll-text-soft hover:text-lll-text"
                }`}
                aria-current={selected ? "page" : undefined}
              >
                <AppIcon
                  name={tab.icon}
                  className={`h-4 w-4 ${selected ? "text-lll-accent" : ""}`}
                />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {selected ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-lll-accent sm:inset-x-4" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto bg-lll-bg px-3 py-4 sm:px-5 sm:py-5">
          {errorMsg ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-[12px] text-red-200"
            >
              {errorMsg}
            </div>
          ) : null}

          {activeTab === "profile" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ProfileSection
                title="Identidad"
                description="Datos usados para identificar a la persona dentro del Hub."
                icon="person"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Nombre">
                    <input
                      className={formControlClassName}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Ej: Patricio"
                    />
                  </FormField>
                  <FormField label="Apellido">
                    <input
                      className={formControlClassName}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Ej: Sine"
                    />
                  </FormField>
                  <FormField label="Email">
                    <input
                      className={`${formControlClassName} cursor-not-allowed opacity-60`}
                      value={user?.email ?? ""}
                      disabled
                    />
                  </FormField>
                  <FormField label="Fecha de nacimiento">
                    <input
                      type="date"
                      className={formControlClassName}
                      value={birthDate}
                      onChange={(event) => setBirthDate(event.target.value)}
                    />
                  </FormField>
                </div>
              </ProfileSection>

              <ProfileSection
                title="Datos laborales"
                description="Información interna utilizada por RRHH y reportes."
                icon="users"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="DNI">
                    <input
                      className={formControlClassName}
                      value={dni}
                      onChange={(event) => setDni(event.target.value)}
                      placeholder="Ej: 12345678"
                    />
                  </FormField>
                  <FormField label="Puesto">
                    <input
                      className={formControlClassName}
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      placeholder="Ej: Frontend Developer"
                    />
                  </FormField>
                  <FormField label="Equipo">
                    <input
                      className={formControlClassName}
                      value={team}
                      onChange={(event) => setTeam(event.target.value)}
                      placeholder="Ej: Producto"
                    />
                  </FormField>
                  <FormField label="Fecha de ingreso">
                    <input
                      type="date"
                      className={formControlClassName}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </FormField>
                </div>
              </ProfileSection>

              <ProfileSection
                title="Salud y emergencia"
                description="Información opcional y sensible, visible para RRHH."
                icon="shield"
                className="lg:col-span-2"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <FormField label="Grupo sanguíneo">
                    <input
                      className={formControlClassName}
                      value={bloodType}
                      onChange={(event) => setBloodType(event.target.value)}
                      placeholder="Ej: O+"
                    />
                  </FormField>
                  <FormField label="Contacto de emergencia">
                    <input
                      className={formControlClassName}
                      value={emergencyName}
                      onChange={(event) => setEmergencyName(event.target.value)}
                      placeholder="Nombre y apellido"
                    />
                  </FormField>
                  <FormField label="Teléfono de emergencia">
                    <input
                      type="tel"
                      className={formControlClassName}
                      value={emergencyPhone}
                      onChange={(event) => setEmergencyPhone(event.target.value)}
                      placeholder="Ej: +54 11 5555-5555"
                    />
                  </FormField>
                </div>
              </ProfileSection>
            </div>
          ) : null}

          {activeTab === "address" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
              <ProfileSection
                title="Domicilio"
                description="Información de residencia cargada por el colaborador."
                icon="location"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Dirección" className="sm:col-span-2">
                    <input
                      className={formControlClassName}
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Ej: Av. Corrientes 1234, 5° B"
                      autoComplete="street-address"
                      maxLength={200}
                    />
                  </FormField>
                  <FormField label="Localidad / ciudad">
                    <input
                      className={formControlClassName}
                      value={locality}
                      onChange={(event) => setLocality(event.target.value)}
                      placeholder="Ej: Palermo"
                      maxLength={100}
                    />
                  </FormField>
                  <FormField label="Provincia">
                    <input
                      className={formControlClassName}
                      value={province}
                      onChange={(event) => setProvince(event.target.value)}
                      placeholder="Ej: Buenos Aires"
                      maxLength={100}
                    />
                  </FormField>
                  <FormField label="Código postal">
                    <input
                      className={formControlClassName}
                      value={postalCode}
                      onChange={(event) => setPostalCode(event.target.value)}
                      placeholder="Ej: C1043AAZ"
                      maxLength={20}
                    />
                  </FormField>
                  <FormField label="País">
                    <input
                      className={formControlClassName}
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="Ej: Argentina"
                      maxLength={100}
                    />
                  </FormField>
                </div>
              </ProfileSection>

              <aside className="rounded-2xl border border-lll-border bg-lll-bg-softer/45 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lll-accent-soft text-lll-accent">
                  <AppIcon name="info" className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold text-lll-text">
                  Perfil de domicilio
                </p>
                <p className="mt-1 text-[12px] leading-5 text-lll-text-soft">
                  {addressProgress === 5
                    ? "La información de domicilio está completa."
                    : `Hay ${addressProgress} de 5 campos informados.`}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-lll-bg">
                  <div
                    className="h-full rounded-full bg-lll-accent transition-[width] duration-300"
                    style={{ width: `${addressProgress * 20}%` }}
                  />
                </div>
                <p className="mt-2 text-right text-[11px] font-medium text-lll-text-soft">
                  {addressProgress * 20}% completo
                </p>
              </aside>
            </div>
          ) : null}

          {activeTab === "vacations" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ProfileSection
                title="Política de vacaciones"
                description="Una excepción reemplaza la regla general por antigüedad."
                icon="calendar"
              >
                <FormField
                  label="Días por año (excepción individual)"
                  hint="Dejalo vacío para aplicar automáticamente la regla general."
                >
                  <input
                    type="number"
                    min={1}
                    max={366}
                    step={1}
                    inputMode="numeric"
                    className={formControlClassName}
                    value={vacationDaysOverride}
                    onChange={(event) =>
                      setVacationDaysOverride(event.target.value)
                    }
                    placeholder="Regla general"
                  />
                </FormField>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-soft px-3 text-[12px] text-lll-text-soft transition hover:text-lll-text disabled:opacity-40"
                  onClick={() => setVacationDaysOverride("")}
                  disabled={!vacationDaysOverride}
                >
                  <AppIcon name="check" className="h-4 w-4" />
                  Usar regla general
                </button>
              </ProfileSection>

              <ProfileSection
                title="Acceso"
                description="Permisos y estado actual de la cuenta."
                icon="key"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Rol">
                    <select
                      className={formControlClassName}
                      value={role}
                      onChange={(event) =>
                        setRole(event.target.value as ProfileRole)
                      }
                    >
                      <option value="user">Colaborador</option>
                      <option value="owner">Owner</option>
                    </select>
                  </FormField>
                  <FormField label="Estado">
                    <select
                      className={formControlClassName}
                      value={active ? "active" : "inactive"}
                      onChange={(event) =>
                        setActive(event.target.value === "active")
                      }
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </FormField>
                </div>
              </ProfileSection>

              <ProfileSection
                title="Migración de vacaciones"
                description="Saldo inicial importado desde Naloo u otra fuente."
                icon="balance"
                className="lg:col-span-2"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    label="Fecha de migración"
                    hint="Desde esta fecha comienza a calcular LLL Hub."
                  >
                    <input
                      type="date"
                      className={formControlClassName}
                      value={vacMigrationDate}
                      onChange={(event) =>
                        setVacMigrationDate(event.target.value)
                      }
                    />
                  </FormField>
                  <FormField
                    label="Disponible al migrar"
                    hint="Saldo disponible que tenía la persona en el sistema anterior."
                  >
                    <input
                      type="number"
                      min={0}
                      className={formControlClassName}
                      value={vacAvailableAtMigration}
                      onChange={(event) =>
                        setVacAvailableAtMigration(Number(event.target.value))
                      }
                    />
                  </FormField>
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-soft px-3 text-[12px] text-lll-text-soft transition hover:text-lll-text"
                  onClick={() => {
                    setVacMigrationDate("");
                    setVacAvailableAtMigration(0);
                  }}
                >
                  <AppIcon name="trash" className="h-4 w-4" />
                  Limpiar migración
                </button>
              </ProfileSection>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-lll-border bg-lll-bg-soft px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-[12px]">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                isDirty ? "bg-amber-300" : "bg-emerald-400"
              }`}
            />
            <span className="truncate text-lll-text-soft">
              {saving
                ? "Guardando cambios…"
                : isDirty
                  ? "Hay cambios sin guardar"
                  : "Ficha actualizada"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl border border-lll-border bg-lll-bg-softer px-4 text-sm font-medium text-lll-text transition hover:border-lll-text-soft/40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-lll-accent px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <AppIcon name="check" className="h-4 w-4" />
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
