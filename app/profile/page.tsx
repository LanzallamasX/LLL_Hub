"use client";

import { useEffect, useState } from "react";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";

/*
import {
  fetchMyProfile,
  updateMyProfile,
  type Profile,
} from "@/lib/supabase/profile";
*/


import {
  fetchMyProfileFull,
  updateMyProfile,
  type Profile,
} from "@/lib/supabase/profile";

export default function ProfilePage() {   
  const { role, refreshProfile } = useAuth();


  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  

  useEffect(() => {
    async function load() {
      try {
        //const p = await fetchMyProfile();
        const p = await fetchMyProfileFull();
        setProfile(p);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando perfil.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateMyProfile({
        full_name: profile.full_name,
        team: profile.team,
        birth_date: profile.birth_date,
        start_date: profile.start_date,
      });

      setProfile(updated);
      setSuccess(true);

      
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
        {/* Datos básicos */}
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

          <div>
            <label className="text-[12px] text-lll-text-soft">Nombre completo</label>
            <input
              value={profile.full_name ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, full_name: e.target.value })
              }
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-[12px] text-lll-text-soft">Equipo</label>
            <input
              value={profile.team ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, team: e.target.value })
              }
              placeholder="Ej: Frontend, Diseño, Producto…"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            />
          </div>
        </div>

        {/* Datos laborales */}
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 space-y-4">
          <p className="text-sm font-semibold">Datos laborales</p>

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
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">
                Fecha de ingreso
              </label>
<input
  type="date"
  value={profile.start_date ?? ""}
  disabled={role !== "owner"}
  onChange={(e) => setProfile({ ...profile, start_date: e.target.value })}
  className={`mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm ${
    role !== "owner" ? "opacity-60 cursor-not-allowed" : ""
  }`}
/>
{role !== "owner" && (
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
