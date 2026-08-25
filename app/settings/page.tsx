"use client";

import { useMemo, useState } from "react";
import UserLayout from "@/components/layout/UserLayout";
import { AppIcon } from "@/components/ui/AppIcon";
import { FormField, formControlClassName } from "@/components/ui/FormField";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";

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

function Requirement({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-emerald-300" : "text-lll-text-soft"}`}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          ok
            ? "border-emerald-400/30 bg-emerald-400/10"
            : "border-lll-border bg-lll-bg-softer"
        }`}
      >
        <AppIcon name="check" className="h-3 w-3" />
      </span>
      {children}
    </li>
  );
}

export default function SettingsPage() {
  const { role, email } = useAuth();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasMinimumLength = password.trim().length >= 6;
  const passwordsMatch = password.length > 0 && password === password2;
  const canSave = useMemo(
    () => hasMinimumLength && passwordsMatch && !saving,
    [hasMinimumLength, passwordsMatch, saving]
  );

  async function updatePassword() {
    setMessage(null);
    setError(null);

    const nextPassword = password.trim();
    if (nextPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nextPassword !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setSaving(true);
      const { error: updateError } = await supabase.auth.updateUser({
        password: nextPassword,
      });

      if (updateError) throw updateError;

      setPassword("");
      setPassword2("");
      setMessage("Contraseña actualizada correctamente.");
    } catch (updateError: unknown) {
      setError(
        getErrorMessage(updateError, "No se pudo actualizar la contraseña.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <UserLayout
      mode={role === "owner" ? "owner" : "user"}
      header={{ title: "Configuración", subtitle: "Preferencias y seguridad." }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-emerald-300">
              <AppIcon name="shield" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Seguridad de la cuenta"
          subtitle="Administrá el acceso a tu cuenta desde un solo lugar."
          meta={
            <>
              <SummaryChip>{role === "owner" ? "Owner" : "Colaborador"}</SummaryChip>
              <SummaryChip>Acceso con email</SummaryChip>
            </>
          }
          actions={
            <>
              {message ? (
                <span role="status" className="text-sm font-medium text-emerald-400">
                  Cambios guardados
                </span>
              ) : null}
              <button
                type="button"
                onClick={updatePassword}
                disabled={!canSave}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <AppIcon name={saving ? "clock" : "key"} className="h-4 w-4" />
                {saving ? "Actualizando…" : "Actualizar contraseña"}
              </button>
            </>
          }
        />

        {error ? (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <SectionCard
            title="Cambiar contraseña"
            description="Elegí una contraseña nueva y confirmala antes de guardar."
            icon={<AppIcon name="key" className="h-4 w-4" />}
            className="xl:col-span-7"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Nueva contraseña">
                <div className="relative">
                  <input
                    className={`${formControlClassName} pr-11`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                      setMessage(null);
                    }}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-lg text-lll-text-soft transition hover:bg-white/[0.05] hover:text-lll-text"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <AppIcon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
                  </button>
                </div>
              </FormField>

              <FormField label="Repetir contraseña">
                <input
                  className={formControlClassName}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password2}
                  onChange={(event) => {
                    setPassword2(event.target.value);
                    setError(null);
                    setMessage(null);
                  }}
                  placeholder="Repetí la contraseña"
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title="Tu cuenta"
            description="Información de acceso y requisitos de seguridad."
            icon={<AppIcon name="person" className="h-4 w-4" />}
            className="xl:col-span-5"
          >
            <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-lll-border bg-lll-bg text-lll-accent-alt">
                  <AppIcon name="mail" className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-lll-text-soft">Email de acceso</p>
                  <p className="truncate text-sm text-lll-text">{email ?? "Sin email"}</p>
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-[12px]">
              <Requirement ok={hasMinimumLength}>Al menos 6 caracteres</Requirement>
              <Requirement ok={passwordsMatch}>Las contraseñas coinciden</Requirement>
            </ul>
          </SectionCard>
        </div>
      </div>
    </UserLayout>
  );
}
