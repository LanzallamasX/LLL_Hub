"use client";

import { useEffect, useMemo, useState } from "react";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  FormField as Field,
  formControlClassName as inputClassName,
} from "@/components/ui/FormField";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SectionCard as ProfileSection } from "@/components/ui/SectionCard";
import { Skeleton } from "@/components/ui/Skeleton";

import {
  fetchMyProfileFull,
  updateMyProfile,
  type Profile,
} from "@/lib/supabase/profile";

const profileCache = new Map<string, Profile>();

function splitFullName(fullName?: string | null) {
  const value = (fullName ?? "").trim();
  if (!value) return { firstName: "", lastName: "" };

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function calcAge(birthDateISO?: string | null) {
  if (!birthDateISO) return null;
  const birthDate = new Date(birthDateISO);
  if (Number.isNaN(birthDate.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDifference = now.getMonth() - birthDate.getMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && now.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-44 max-w-[55vw]" />
              <Skeleton className="h-3 w-56 max-w-[65vw]" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1].map((section) => (
          <section
            key={section}
            className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-56 max-w-full" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5 xl:col-span-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { role, userId, refreshProfile } = useAuth();
  const isOwner = role === "owner";

  const cachedProfile = userId ? profileCache.get(userId) ?? null : null;
  const cachedNames = cachedProfile
    ? cachedProfile.first_name || cachedProfile.last_name
      ? {
          firstName: (cachedProfile.first_name ?? "").trim(),
          lastName: (cachedProfile.last_name ?? "").trim(),
        }
      : splitFullName(cachedProfile.full_name)
    : { firstName: "", lastName: "" };

  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [firstName, setFirstName] = useState(cachedNames.firstName);
  const [lastName, setLastName] = useState(cachedNames.lastName);
  const [loading, setLoading] = useState(cachedProfile === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const resolvedUserId = userId;

    async function load() {
      const cached = profileCache.get(resolvedUserId) ?? null;
      if (cached) {
        setProfile(cached);
        const names =
          cached.first_name || cached.last_name
            ? {
                firstName: (cached.first_name ?? "").trim(),
                lastName: (cached.last_name ?? "").trim(),
              }
            : splitFullName(cached.full_name);
        setFirstName(names.firstName);
        setLastName(names.lastName);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const loadedProfile = await fetchMyProfileFull();
        if (loadedProfile) profileCache.set(resolvedUserId, loadedProfile);
        setProfile(loadedProfile);

        const loadedFirstName = (loadedProfile?.first_name ?? "").trim();
        const loadedLastName = (loadedProfile?.last_name ?? "").trim();

        if (loadedFirstName || loadedLastName) {
          setFirstName(loadedFirstName);
          setLastName(loadedLastName);
        } else {
          const splitName = splitFullName(loadedProfile?.full_name);
          setFirstName(splitName.firstName);
          setLastName(splitName.lastName);
        }
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Error cargando perfil."));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId]);

  const age = useMemo(
    () => calcAge(profile?.birth_date ?? null),
    [profile?.birth_date]
  );

  const computedFullName = useMemo(() => {
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || null;
  }, [firstName, lastName]);

  const initials = useMemo(() => {
    const nameInitials = [firstName, lastName]
      .filter(Boolean)
      .map((name) => name.trim()[0]?.toUpperCase())
      .join("")
      .slice(0, 2);

    return nameInitials || profile?.email?.[0]?.toUpperCase() || "U";
  }, [firstName, lastName, profile?.email]);

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateMyProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: computedFullName,
        birth_date: profile.birth_date ?? null,
        blood_type: profile.blood_type ?? null,
        emergency_contact_name: profile.emergency_contact_name ?? null,
        emergency_contact_phone: profile.emergency_contact_phone ?? null,
        address: profile.address ?? null,
        locality: profile.locality ?? null,
        province: profile.province ?? null,
        postal_code: profile.postal_code ?? null,
        country: profile.country ?? null,
        team: profile.team ?? null,
        dni: profile.dni ?? null,
        job_title: profile.job_title ?? null,
        start_date: profile.start_date ?? null,
      });

      setProfile(updated);
      if (userId) profileCache.set(userId, updated);
      setSuccess(true);
      await refreshProfile();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "Error guardando cambios."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <UserLayout mode={role} header={{ title: "Mi perfil" }}>
        <ProfileSkeleton />
      </UserLayout>
    );
  }

  if (!profile) {
    return (
      <UserLayout mode={role} header={{ title: "Mi perfil" }}>
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-red-300">
          No se pudo cargar el perfil.
        </div>
      </UserLayout>
    );
  }

  const roleLabel = isOwner ? "Owner" : "Colaborador";
  const lockedInputClassName = `${inputClassName} cursor-not-allowed opacity-60`;

  return (
    <UserLayout
      mode={role}
      header={{
        title: "Mi perfil",
        subtitle: "Datos personales y laborales.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon>
              <span className="text-lg font-bold">{initials}</span>
            </SummaryIcon>
          }
          title={computedFullName ?? "Tu perfil"}
          subtitle={profile.email ?? "Sin email registrado"}
          meta={
            <>
              <SummaryChip>{roleLabel}</SummaryChip>
              <SummaryChip>{profile.team?.trim() || "Sin equipo"}</SummaryChip>
            </>
          }
          actions={
            <>
              {success ? (
                <span
                  role="status"
                  className="text-sm font-medium text-emerald-400"
                >
                  Cambios guardados
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  saving
                    ? "cursor-wait border border-lll-border bg-lll-bg-softer text-lll-text-soft"
                    : "bg-lll-accent text-black hover:brightness-110"
                }`}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          }
        />

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ProfileSection
            title="Información básica"
            description="Cómo te identificamos dentro de LLL Hub."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input
                  value={profile.email ?? ""}
                  disabled
                  className={lockedInputClassName}
                />
              </Field>

              <Field label="Equipo">
                <input
                  value={profile.team ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, team: event.target.value })
                  }
                  placeholder="Ej: Producto"
                  className={inputClassName}
                />
              </Field>

              <Field label="Nombre">
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Ej: Patricio"
                  className={inputClassName}
                />
              </Field>

              <Field label="Apellido">
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Ej: Sine"
                  className={inputClassName}
                />
              </Field>
            </div>
          </ProfileSection>

          <ProfileSection
            title="Datos personales"
            description="Información personal y contacto ante una emergencia."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Fecha de nacimiento"
                hint={age === null ? "Edad sin calcular" : `${age} años`}
              >
                <input
                  type="date"
                  value={profile.birth_date ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, birth_date: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Grupo sanguíneo">
                <input
                  value={profile.blood_type ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, blood_type: event.target.value })
                  }
                  placeholder="Ej: O+"
                  className={inputClassName}
                />
              </Field>

              <Field label="Contacto de emergencia">
                <input
                  value={profile.emergency_contact_name ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      emergency_contact_name: event.target.value,
                    })
                  }
                  placeholder="Nombre y apellido"
                  className={inputClassName}
                />
              </Field>

              <Field label="Teléfono de emergencia">
                <input
                  type="tel"
                  value={profile.emergency_contact_phone ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      emergency_contact_phone: event.target.value,
                    })
                  }
                  placeholder="Ej: +54 11 5555-5555"
                  className={inputClassName}
                />
              </Field>
            </div>
          </ProfileSection>

          <ProfileSection
            title="Domicilio"
            description="Datos de residencia y ubicación."
            className="xl:col-span-2"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Dirección" className="sm:col-span-2">
                <input
                  value={profile.address ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, address: event.target.value })
                  }
                  placeholder="Ej: Av. Corrientes 1234, 5° B"
                  autoComplete="street-address"
                  maxLength={200}
                  className={inputClassName}
                />
              </Field>

              <Field label="Localidad / ciudad">
                <input
                  value={profile.locality ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, locality: event.target.value })
                  }
                  placeholder="Ej: Palermo"
                  autoComplete="address-level2"
                  maxLength={100}
                  className={inputClassName}
                />
              </Field>

              <Field label="Provincia">
                <input
                  value={profile.province ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, province: event.target.value })
                  }
                  placeholder="Ej: Buenos Aires"
                  autoComplete="address-level1"
                  maxLength={100}
                  className={inputClassName}
                />
              </Field>

              <Field label="Código postal">
                <input
                  value={profile.postal_code ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, postal_code: event.target.value })
                  }
                  placeholder="Ej: C1043AAZ"
                  autoComplete="postal-code"
                  maxLength={20}
                  className={inputClassName}
                />
              </Field>

              <Field label="País">
                <input
                  value={profile.country ?? ""}
                  onChange={(event) =>
                    setProfile({ ...profile, country: event.target.value })
                  }
                  placeholder="Ej: Argentina"
                  autoComplete="country-name"
                  maxLength={100}
                  className={inputClassName}
                />
              </Field>
            </div>
          </ProfileSection>

          <ProfileSection
            title="Datos laborales"
            description={
              isOwner
                ? "Información interna del colaborador."
                : "Esta información la administra RRHH."
            }
            className="xl:col-span-2"
          >
            {!isOwner ? (
              <div className="mb-3 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-[12px] text-lll-text-soft">
                Si necesitás modificar estos datos, contactá a un Owner.
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Puesto de trabajo">
                <input
                  value={profile.job_title ?? ""}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setProfile({ ...profile, job_title: event.target.value })
                  }
                  placeholder="Ej: Frontend Developer"
                  className={
                    isOwner ? inputClassName : lockedInputClassName
                  }
                />
              </Field>

              <Field label="DNI">
                <input
                  value={profile.dni ?? ""}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setProfile({ ...profile, dni: event.target.value })
                  }
                  placeholder="Ej: 12345678"
                  className={
                    isOwner ? inputClassName : lockedInputClassName
                  }
                />
              </Field>

              <Field label="Fecha de ingreso">
                <input
                  type="date"
                  value={profile.start_date ?? ""}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setProfile({ ...profile, start_date: event.target.value })
                  }
                  className={
                    isOwner ? inputClassName : lockedInputClassName
                  }
                />
              </Field>
            </div>
          </ProfileSection>
        </div>
      </div>
    </UserLayout>
  );
}
