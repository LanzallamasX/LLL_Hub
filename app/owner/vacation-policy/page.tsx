"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import {
  DEFAULT_VACATION_POLICY_SETTINGS,
  normalizeVacationPolicyMode,
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

export default function OwnerVacationPolicyPage() {
  const router = useRouter();
  const { isLoading, isAuthed, role } = useAuth();

  const [settings, setSettings] = useState<VacationPolicySettings>(DEFAULT_VACATION_POLICY_SETTINGS);
  const [policyMode, setPolicyMode] = useState<VacationPolicyMode>("anniversary");
  const [cycleStartMonth, setCycleStartMonth] = useState(10);
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
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
        setLoading(true);
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

        const next = {
          ...DEFAULT_VACATION_POLICY_SETTINGS,
          ...(json.settings ?? {}),
          policy_mode: normalizeVacationPolicyMode(json.settings?.policy_mode),
          cycle_start_month: Number(json.settings?.cycle_start_month ?? 10),
        };

        setSettings(next);
        setPolicyMode(next.policy_mode);
        setCycleStartMonth(next.cycle_start_month);
        setEffectiveFrom(next.effective_from ?? todayISO());
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar la politica.");
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

      const next = {
        ...DEFAULT_VACATION_POLICY_SETTINGS,
        ...(json.settings ?? {}),
        policy_mode: normalizeVacationPolicyMode(json.settings?.policy_mode),
        cycle_start_month: Number(json.settings?.cycle_start_month ?? 10),
      };

      setSettings(next);
      setPolicyMode(next.policy_mode);
      setCycleStartMonth(next.cycle_start_month);
      setEffectiveFrom(next.effective_from ?? todayISO());
      setNote("");
      setSavedMessage("Politica actualizada.");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar la politica.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !isAuthed || role !== "owner") {
    return (
      <UserLayout mode="owner" header={{ title: "Politica de vacaciones" }}>
        <div className="text-sm text-lll-text-soft">Cargando...</div>
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
      <div className="max-w-4xl space-y-4">
        <div className="rounded-lg border border-lll-border bg-lll-bg-soft p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[clamp(1.125rem,3.5vw,1.25rem)] font-semibold leading-tight text-lll-text">Politica de vacaciones</h1>
              <p className="mt-1 text-sm text-lll-text-soft">
                Esto afecta los balances, ausencias y validaciones que consultan vacaciones.
              </p>
            </div>
            <span className="mt-3 inline-flex w-fit rounded-full border border-lll-border bg-lll-bg-softer px-3 py-1 text-xs text-lll-text-soft sm:mt-0">
              Actual: {settings.policy_mode === "october" ? "Octubre" : "Aniversario"}
            </span>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {savedMessage ? (
            <div className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {savedMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-lll-text-soft">
                Modelo
              </span>
              <select
                value={policyMode}
                onChange={(e) => setPolicyMode(normalizeVacationPolicyMode(e.target.value))}
                disabled={loading || saving}
                className="mt-2 w-full rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm outline-none"
              >
                <option value="anniversary">Renovacion por fecha de ingreso</option>
                <option value="october">Renovacion global en octubre</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-lll-text-soft">
                Mes de renovacion
              </span>
              <select
                value={cycleStartMonth}
                onChange={(e) => setCycleStartMonth(Number(e.target.value))}
                disabled={loading || saving || policyMode !== "october"}
                className="mt-2 w-full rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm outline-none disabled:opacity-50"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-lll-text-soft">
                Vigente desde
              </span>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={loading || saving}
                className="mt-2 w-full rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-lll-text-soft">
                Nota interna
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={loading || saving}
                placeholder="Motivo del cambio"
                className="mt-2 w-full rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm outline-none placeholder:text-lll-text-soft"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-lll-text-soft">
              El modo por URL sigue disponible para test: <span className="text-lll-text">?vacModel=october&amp;vacAt=2026-10-01</span>
            </p>
            <button
              type="button"
              onClick={saveSettings}
              disabled={loading || saving || !isDirty}
              className="rounded-lg border border-lll-accent/60 bg-lll-accent-soft px-4 py-2 text-sm font-medium text-lll-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar politica"}
            </button>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
