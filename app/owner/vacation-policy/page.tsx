"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { AppIcon } from "@/components/ui/AppIcon";
import { FormField, formControlClassName } from "@/components/ui/FormField";
import { FormSkeleton } from "@/components/ui/LoadingSkeletons";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import {
  DEFAULT_VACATION_POLICY_SETTINGS,
  getCachedVacationPolicySettings,
  normalizeVacationPolicyMode,
  setCachedVacationPolicySettings,
  type VacationPolicyMode,
  type VacationPolicySettings,
} from "@/lib/supabase/vacationPolicy";

const monthOptions = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

export default function OwnerVacationPolicyPage() {
  const router = useRouter();
  const { isLoading, isAuthed, role } = useAuth();
  const cachedPolicy = getCachedVacationPolicySettings();

  const [settings, setSettings] = useState<VacationPolicySettings>(
    cachedPolicy ?? DEFAULT_VACATION_POLICY_SETTINGS
  );
  const [policyMode, setPolicyMode] = useState<VacationPolicyMode>(
    cachedPolicy?.policy_mode ?? "anniversary"
  );
  const [cycleStartMonth, setCycleStartMonth] = useState(
    cachedPolicy?.cycle_start_month ?? 10
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    cachedPolicy?.effective_from ?? todayISO()
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(cachedPolicy === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed) {
      router.replace("/login");
      return;
    }
    if (role !== "owner") {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthed, role, router]);

  useEffect(() => {
    if (isLoading || !isAuthed || role !== "owner") return;

    (async () => {
      try {
        setLoading(getCachedVacationPolicySettings() === null);
        setError(null);

        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;
        const token = session?.access_token;
        if (!token) throw new Error("No session token");

        const res = await fetch("/api/admin/vacation-policy-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "No se pudo cargar la politica.");

        const next: VacationPolicySettings = {
          ...DEFAULT_VACATION_POLICY_SETTINGS,
          ...(json.settings ?? {}),
          policy_mode: normalizeVacationPolicyMode(json.settings?.policy_mode),
          cycle_start_month: Number(json.settings?.cycle_start_month ?? 10),
        };

        setCachedVacationPolicySettings(next);
        setSettings(next);
        setPolicyMode(next.policy_mode);
        setCycleStartMonth(next.cycle_start_month);
        setEffectiveFrom(next.effective_from ?? todayISO());
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "No se pudo cargar la política."));
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, isAuthed, role]);

  const isDirty = useMemo(() => {
    return (
      policyMode !== settings.policy_mode ||
      cycleStartMonth !== settings.cycle_start_month ||
      (effectiveFrom || null) !== (settings.effective_from ?? todayISO())
    );
  }, [policyMode, cycleStartMonth, effectiveFrom, settings]);

  async function saveSettings() {
    try {
      setSaving(true);
      setError(null);
      setSavedMessage(null);

      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr) throw sessionErr;
      const token = session?.access_token;
      if (!token) throw new Error("No session token");

      const res = await fetch("/api/admin/vacation-policy-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          policyMode,
          cycleStartMonth,
          effectiveFrom: effectiveFrom || null,
          note,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo guardar la politica.");

      const next: VacationPolicySettings = {
        ...DEFAULT_VACATION_POLICY_SETTINGS,
        ...(json.settings ?? {}),
        policy_mode: normalizeVacationPolicyMode(json.settings?.policy_mode),
        cycle_start_month: Number(json.settings?.cycle_start_month ?? 10),
      };

      setCachedVacationPolicySettings(next);
      setSettings(next);
      setPolicyMode(next.policy_mode);
      setCycleStartMonth(next.cycle_start_month);
      setEffectiveFrom(next.effective_from ?? todayISO());
      setNote("");
      setSavedMessage("Politica actualizada.");
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "No se pudo guardar la política."));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || loading || !isAuthed || role !== "owner") {
    return (
      <UserLayout mode="owner" header={{ title: "Politica de vacaciones" }}>
        <FormSkeleton sections={3} />
      </UserLayout>
    );
  }

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Politica de vacaciones",
        subtitle: "Modelo global para calculo de saldos.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-amber-300">
              <AppIcon name="policy" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Política de vacaciones"
          subtitle="Define cómo se renuevan y calculan los días de toda la organización."
          meta={
            <>
              <SummaryChip>
                Actual: {settings.policy_mode === "october" ? "Octubre" : "Aniversario"}
              </SummaryChip>
              <SummaryChip>Vigente desde {settings.effective_from ?? "hoy"}</SummaryChip>
            </>
          }
          actions={
            <>
              {savedMessage ? (
                <span role="status" className="text-sm font-medium text-emerald-400">
                  Política actualizada
                </span>
              ) : null}
              <button
                type="button"
                onClick={saveSettings}
                disabled={loading || saving || !isDirty}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <AppIcon name={saving ? "clock" : "check"} className="h-4 w-4" />
                {saving ? "Guardando…" : "Guardar política"}
              </button>
            </>
          }
        />

        {error ? (
          <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <SectionCard
            title="Modelo de renovación"
            description="Elegí si cada persona renueva por antigüedad o en una fecha común."
            icon={<AppIcon name="calendar" className="h-4 w-4" />}
            className="xl:col-span-7"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Modelo">
                <select
                  value={policyMode}
                  onChange={(event) =>
                    setPolicyMode(normalizeVacationPolicyMode(event.target.value))
                  }
                  disabled={loading || saving}
                  className={formControlClassName}
                >
                  <option value="anniversary">Por fecha de ingreso</option>
                  <option value="october">Renovación global</option>
                </select>
              </FormField>

              <FormField
                label="Mes de renovación"
                hint={policyMode !== "october" ? "Disponible para renovación global" : undefined}
              >
                <select
                  value={cycleStartMonth}
                  onChange={(event) => setCycleStartMonth(Number(event.target.value))}
                  disabled={loading || saving || policyMode !== "october"}
                  className={formControlClassName}
                >
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-[12px] leading-5 text-lll-text-soft">
              {policyMode === "october"
                ? `Todos los colaboradores renovarán su ciclo en ${monthOptions.find((month) => month.value === cycleStartMonth)?.label ?? "el mes seleccionado"}.`
                : "Cada colaborador renovará su ciclo según su propia fecha de ingreso."}
            </div>
          </SectionCard>

          <SectionCard
            title="Vigencia y registro"
            description="Indicá desde cuándo aplica y dejá contexto del cambio."
            icon={<AppIcon name="note" className="h-4 w-4" />}
            className="xl:col-span-5"
          >
            <div className="space-y-3">
              <FormField label="Vigente desde">
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  disabled={loading || saving}
                  className={formControlClassName}
                />
              </FormField>

              <FormField label="Nota interna" hint="Se registra junto con el próximo cambio.">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={loading || saving}
                  placeholder="Motivo del cambio"
                  className={formControlClassName}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title="Impacto de esta política"
            description="La configuración se comparte automáticamente entre estas áreas."
            icon={<AppIcon name="info" className="h-4 w-4" />}
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { icon: "balance" as const, title: "Balances", text: "Cálculo de días otorgados y disponibles." },
                { icon: "absence" as const, title: "Ausencias", text: "Validación de solicitudes y consumos." },
                { icon: "calendar" as const, title: "Calendario", text: "Lectura consistente de cada período." },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-lll-border bg-lll-bg text-lll-accent-alt">
                    <AppIcon name={item.icon} className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-lll-text">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-lll-text-soft">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </UserLayout>
  );
}
