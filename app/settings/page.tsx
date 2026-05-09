"use client";

import { useMemo, useState } from "react";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { role, email } = useAuth();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    return password.trim().length >= 6 && password === password2 && !saving;
  }, [password, password2, saving]);

  async function updatePassword() {
    setMessage(null);
    setError(null);

    const nextPassword = password.trim();
    if (nextPassword.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (nextPassword !== password2) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    try {
      setSaving(true);
      const { error: updateErr } = await supabase.auth.updateUser({
        password: nextPassword,
      });

      if (updateErr) throw updateErr;

      setPassword("");
      setPassword2("");
      setMessage("Contrasena actualizada correctamente.");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar la contrasena.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <UserLayout
      mode={role === "owner" ? "owner" : "user"}
      header={{ title: "Configuracion", subtitle: "Preferencias y seguridad." }}
    >
      <div className="max-w-2xl rounded-2xl border border-lll-border bg-lll-bg-soft p-5">
        <div>
          <h1 className="text-[clamp(1.125rem,3.5vw,1.25rem)] font-semibold leading-tight">
            Seguridad
          </h1>
          <p className="mt-1 text-sm text-lll-text-soft">
            Cambia la contrasena de tu cuenta.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[12px] text-lll-text-soft">Email</label>
            <div className="mt-1 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text-soft">
              {email ?? "Sin email"}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-lll-text-soft">Nueva contrasena</label>
            <div className="mt-1 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm outline-none"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="min-h-10 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-[clamp(0.75rem,2.2vw,0.875rem)] text-lll-text-soft hover:text-lll-text"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-lll-text-soft">Repetir contrasena</label>
            <input
              className="mt-1 w-full rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm outline-none"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Repeti la contrasena"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={updatePassword}
              disabled={!canSave}
              className="min-h-10 rounded-lg bg-lll-accent px-4 py-2 text-[clamp(0.75rem,2.2vw,0.875rem)] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Actualizando..." : "Actualizar contrasena"}
            </button>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
