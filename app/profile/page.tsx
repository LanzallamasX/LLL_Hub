"use client";

import { useEffect, useMemo, useState } from "react";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";

import {
  fetchMyProfileFull,
  updateMyProfile,
  type Profile,
} from "@/lib/supabase/profile";

function splitFullName(fullName?: string | null) {
  const v = (fullName ?? "").trim();
  if (!v) return { firstName: "", lastName: "" };

  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function calcAge(birthDateISO?: string | null) {
  if (!birthDateISO) return null;
  const b = new Date(birthDateISO);
  if (Number.isNaN(b.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default function ProfilePage() {
  const { role, refreshProfile } = useAuth();
  const isOwner = role === "owner";

  const [profile, setProfile] = useState<Profile | null>(null);

  // UI fields (fuente: first/last; fallback: full_name)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const p = await fetchMyProfileFull();
        setProfile(p);

        // ✅ preferimos first/last reales
        const fn = (p?.first_name ?? "").trim();
        const ln = (p?.last_name ?? "").trim();

        if (fn || ln) {
          setFirstName(fn);
          setLastName(ln);
        } else {
          // fallback legacy
          const s = splitFullName(p?.full_name);
          setFirstName(s.firstName);
          setLastName(s.lastName);
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando perfil.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const age = useMemo(
    () => calcAge(profile?.birth_date ?? null),
    [profile?.birth_date]
  );

  const computedFullName = useMemo(() => {
    const full = `${firstName} ${lastName}`.trim();
    return full || null;
  }, [firstName, lastName]);

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateMyProfile({
        // identidad
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: computedFullName, // legacy compat (AuthHeader/Aside)

        // personales
        birth_date: profile.birth_date ?? null,
        blood_type: profile.blood_type ?? null,
        emergency_contact_name: profile.emergency_contact_name ?? null,
        emergency_contact_phone: profile.emergency_contact_phone ?? null,

        // laborales
        team: profile.team ?? null,

        // RRHH (solo owner; updateMyProfile filtra igual)
        dni: profile.dni ?? null,
        job_title: profile.job_title ?? null,
        start_date: profile.start_date ?? null,
      });

      setProfile(updated);
      setSuccess(true);

      // ✅ actualiza Header/Aside (AuthContext)
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? "Error guardando cambios.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <UserLayout mode={role} header={{ title: "Mi perfil" }}>
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Cargando perfil…
        </div>
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

  return (
    <UserLayout
      mode={role}
      header={{
        title: "Mi perfil",
        subtitle: "Datos personales y laborales.",
      }}
    >
      <div className="max-w-2xl space-y-6">
        {/* Información básica */}
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 space-y-4">
          <p className="text-sm font-semibold">Información básica</p>

          <div>
            <label className="text-[12px] text-lll-text-soft">Email</label>
            <input
              value={profile.email ?? ""}
              disabled
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border text-sm text-lll-text-soft"
            />
          </div>

          {/* Nombre + Apellido (source of truth de UI) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-lll-text-soft">Nombre</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej: Patricio"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Apellido</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej: Sine"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              />
            </div>
          </div>

          <div className="text-[12px] text-lll-text-soft">
            Se mostrará como:{" "}
            <span className="text-lll-text">{computedFullName ?? "—"}</span>
          </div>

          <div>
            <label className="text-[12px] text-lll-text-soft">Equipo</label>
            <input
              value={profile.team ?? ""}
              onChange={(e) => setProfile({ ...profile, team: e.target.value })}
              placeholder="Ej: Frontend, Diseño, Producto…"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            />
          </div>
        </div>

        {/* Datos personales */}
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 space-y-4">
          <p className="text-sm font-semibold">Datos personales</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-lll-text-soft">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={profile.birth_date ?? ""}
                onChange={(e) =>
                  setProfile({ ...profile, birth_date: e.target.value })
                }
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              />
              <p className="mt-1 text-[12px] text-lll-text-soft">
                Edad:{" "}
                <span className="text-lll-text">
                  {age === null ? "—" : `${age} años`}
                </span>
              </p>
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">
                Grupo sanguíneo
              </label>
              <input
                value={profile.blood_type ?? ""}
                onChange={(e) =>
                  setProfile({ ...profile, blood_type: e.target.value })
                }
                placeholder="Ej: O+, A-, AB+…"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-lll-text-soft">
                Contacto de emergencia (Nombre)
              </label>
              <input
                value={profile.emergency_contact_name ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    emergency_contact_name: e.target.value,
                  })
                }
                placeholder="Ej: Juan Pérez"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">
                Contacto de emergencia (Teléfono)
              </label>
              <input
                value={profile.emergency_contact_phone ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    emergency_contact_phone: e.target.value,
                  })
                }
                placeholder="Ej: +54 11 5555-5555"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Datos laborales / RRHH */}
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 space-y-4">
          <p className="text-sm font-semibold">Datos laborales</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-lll-text-soft">
                Puesto de trabajo
              </label>
              <input
                value={profile.job_title ?? ""}
                disabled={!isOwner}
                onChange={(e) =>
                  setProfile({ ...profile, job_title: e.target.value })
                }
                placeholder="Ej: Frontend Developer"
                className={`mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm ${
                  !isOwner ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />
              {!isOwner && (
                <p className="mt-1 text-[12px] text-lll-text-soft">
                  El puesto lo gestiona RRHH (Owner).
                </p>
              )}
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">DNI</label>
              <input
                value={profile.dni ?? ""}
                disabled={!isOwner}
                onChange={(e) => setProfile({ ...profile, dni: e.target.value })}
                placeholder="Ej: 12345678"
                className={`mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm ${
                  !isOwner ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />
              {!isOwner && (
                <p className="mt-1 text-[12px] text-lll-text-soft">
                  El DNI lo gestiona RRHH (Owner).
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-lll-text-soft">
                Fecha de ingreso
              </label>
              <input
                type="date"
                value={profile.start_date ?? ""}
                disabled={!isOwner}
                onChange={(e) =>
                  setProfile({ ...profile, start_date: e.target.value })
                }
                className={`mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm ${
                  !isOwner ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />
              {!isOwner && (
                <p className="mt-1 text-[12px] text-lll-text-soft">
                  La fecha de ingreso la gestiona RRHH (Owner).
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-lg font-semibold ${
              saving
                ? "bg-lll-bg-softer border border-lll-border text-lll-text-soft"
                : "bg-lll-accent text-black"
            }`}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>

          {success && (
            <span className="text-sm text-emerald-400">
              Cambios guardados ✔
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </UserLayout>
  );
}
