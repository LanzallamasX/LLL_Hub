"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { AppIcon } from "@/components/ui/AppIcon";
import { FormField, formControlClassName } from "@/components/ui/FormField";
import { FormSkeleton } from "@/components/ui/LoadingSkeletons";
import { PageSummary, SummaryChip, SummaryIcon } from "@/components/ui/PageSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AbsenceBlockedPeriod,
  BlockedAbsenceType,
} from "@/lib/supabase/blockedPeriods";
import { supabase } from "@/lib/supabase/client";

type FormState = {
  dateFrom: string;
  dateTo: string;
  absenceTypes: BlockedAbsenceType[];
  reason: string;
  active: boolean;
};

const emptyForm: FormState = {
  dateFrom: "",
  dateTo: "",
  absenceTypes: ["vacaciones", "home_office"],
  reason: "",
  active: true,
};

const typeLabels: Record<BlockedAbsenceType, string> = {
  vacaciones: "Vacaciones",
  home_office: "Home Office",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
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

export default function OwnerBlockedPeriodsPage() {
  const router = useRouter();
  const { isLoading, isAuthed, role } = useAuth();
  const [periods, setPeriods] = useState<AbsenceBlockedPeriod[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    if (role !== "owner") router.replace("/dashboard");
  }, [isLoading, isAuthed, role, router]);

  const authenticatedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = data.session?.access_token;
    if (!token) throw new Error("No session token");

    const response = await fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error ?? "No se pudo completar la operación.");
    return json;
  }, []);

  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await authenticatedFetch("/api/admin/blocked-periods");
      setPeriods((json.periods ?? []) as AbsenceBlockedPeriod[]);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "No se pudieron cargar los períodos."));
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    if (isLoading || !isAuthed || role !== "owner") return;
    void loadPeriods();
  }, [isLoading, isAuthed, role, loadPeriods]);

  const activeCount = useMemo(
    () => periods.filter((period) => period.active).length,
    [periods]
  );

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setSavedMessage(null);
  }

  function toggleType(type: BlockedAbsenceType) {
    setForm((current) => ({
      ...current,
      absenceTypes: current.absenceTypes.includes(type)
        ? current.absenceTypes.filter((item) => item !== type)
        : [...current.absenceTypes, type],
    }));
  }

  function editPeriod(period: AbsenceBlockedPeriod) {
    setEditingId(period.id);
    setForm({
      dateFrom: period.date_from,
      dateTo: period.date_to,
      absenceTypes: period.absence_types,
      reason: period.reason,
      active: period.active,
    });
    setError(null);
    setSavedMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function savePeriod() {
    if (!form.dateFrom || !form.dateTo || form.dateTo < form.dateFrom) {
      setError("Ingresá un rango de fechas válido.");
      return;
    }
    if (form.absenceTypes.length === 0) {
      setError("Elegí al menos un tipo de solicitud.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Ingresá el motivo del bloqueo.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSavedMessage(null);
      await authenticatedFetch("/api/admin/blocked-periods", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ...form,
          reason: form.reason.trim(),
        }),
      });
      setSavedMessage(editingId ? "Período actualizado." : "Período creado.");
      setEditingId(null);
      setForm(emptyForm);
      await loadPeriods();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "No se pudo guardar el período."));
    } finally {
      setSaving(false);
    }
  }

  async function setPeriodActive(period: AbsenceBlockedPeriod, active: boolean) {
    try {
      setError(null);
      setSavedMessage(null);
      await authenticatedFetch("/api/admin/blocked-periods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: period.id,
          dateFrom: period.date_from,
          dateTo: period.date_to,
          absenceTypes: period.absence_types,
          reason: period.reason,
          active,
        }),
      });
      setPeriods((current) =>
        current.map((item) => (item.id === period.id ? { ...item, active } : item))
      );
      setSavedMessage(active ? "Período activado." : "Período desactivado.");
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, "No se pudo cambiar el estado."));
    }
  }

  async function deletePeriod(period: AbsenceBlockedPeriod) {
    const confirmed = window.confirm(
      `¿Eliminar el período ${formatDate(period.date_from)} – ${formatDate(period.date_to)}?`
    );
    if (!confirmed) return;

    try {
      setError(null);
      setSavedMessage(null);
      await authenticatedFetch(
        `/api/admin/blocked-periods?id=${encodeURIComponent(period.id)}`,
        { method: "DELETE" }
      );
      setPeriods((current) => current.filter((item) => item.id !== period.id));
      if (editingId === period.id) resetForm();
      setSavedMessage("Período eliminado.");
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "No se pudo eliminar el período."));
    }
  }

  if (isLoading || loading || !isAuthed || role !== "owner") {
    return (
      <UserLayout mode="owner" header={{ title: "Períodos bloqueados" }}>
        <FormSkeleton sections={3} />
      </UserLayout>
    );
  }

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Períodos bloqueados",
        subtitle: "Fechas no disponibles para nuevas solicitudes.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-rose-300">
              <AppIcon name="calendar" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Períodos bloqueados"
          subtitle="Administrá las fechas en las que no se pueden solicitar vacaciones o Home Office."
          meta={
            <>
              <SummaryChip>{activeCount} activos</SummaryChip>
              <SummaryChip>{periods.length} en total</SummaryChip>
            </>
          }
          actions={
            editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-softer px-4 py-2 text-sm text-lll-text-soft transition hover:text-lll-text"
              >
                <AppIcon name="close" className="h-4 w-4" />
                Cancelar edición
              </button>
            ) : undefined
          }
        />

        {error ? (
          <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {savedMessage ? (
          <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {savedMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <SectionCard
            title={editingId ? "Editar período" : "Nuevo período"}
            description="El rango incluye tanto la fecha inicial como la final."
            icon={<AppIcon name={editingId ? "edit" : "plus"} className="h-4 w-4" />}
            className="xl:col-span-5"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Desde">
                  <input
                    type="date"
                    value={form.dateFrom}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dateFrom: event.target.value }))
                    }
                    disabled={saving}
                    className={formControlClassName}
                  />
                </FormField>
                <FormField label="Hasta">
                  <input
                    type="date"
                    min={form.dateFrom || undefined}
                    value={form.dateTo}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dateTo: event.target.value }))
                    }
                    disabled={saving}
                    className={formControlClassName}
                  />
                </FormField>
              </div>

              <FormField label="Motivo" hint="Se muestra al colaborador si intenta usar estas fechas.">
                <input
                  value={form.reason}
                  maxLength={160}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  placeholder="Ej.: Período operativo crítico"
                  disabled={saving}
                  className={formControlClassName}
                />
              </FormField>

              <fieldset>
                <legend className="text-[12px] font-medium text-lll-text-soft">
                  Solicitudes afectadas
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["vacaciones", "home_office"] as BlockedAbsenceType[]).map((type) => (
                    <label
                      key={type}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.absenceTypes.includes(type)}
                        onChange={() => toggleType(type)}
                        disabled={saving}
                        className="h-4 w-4 accent-[var(--color-lll-accent)]"
                      />
                      {typeLabels[type]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {editingId ? (
                <label className="flex items-center gap-3 rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.checked }))
                    }
                    disabled={saving}
                    className="h-4 w-4 accent-[var(--color-lll-accent)]"
                  />
                  Período activo
                </label>
              ) : null}

              <button
                type="button"
                onClick={savePeriod}
                disabled={saving}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AppIcon name={saving ? "clock" : "check"} className="h-4 w-4" />
                {saving
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Crear bloqueo"}
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Bloqueos configurados"
            description="Los bloqueos inactivos se conservan, pero no impiden solicitudes."
            icon={<AppIcon name="calendar" className="h-4 w-4" />}
            className="xl:col-span-7"
          >
            {periods.length === 0 ? (
              <div className="rounded-xl border border-dashed border-lll-border bg-lll-bg-softer px-4 py-8 text-center text-sm text-lll-text-soft">
                Todavía no hay períodos bloqueados.
              </div>
            ) : (
              <div className="space-y-3">
                {periods.map((period) => (
                  <article
                    key={period.id}
                    className={`rounded-xl border p-4 ${
                      period.active
                        ? "border-rose-400/25 bg-rose-500/[0.06]"
                        : "border-lll-border bg-lll-bg-softer opacity-75"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-lll-text">
                            {formatDate(period.date_from)} – {formatDate(period.date_to)}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${
                              period.active
                                ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                                : "border-lll-border bg-lll-bg text-lll-text-soft"
                            }`}
                          >
                            {period.active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-5 text-lll-text-soft">
                          {period.reason}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {period.absence_types.map((type) => (
                            <span
                              key={type}
                              className="rounded-full border border-lll-border bg-lll-bg px-2 py-1 text-[10px] text-lll-text-soft"
                            >
                              {typeLabels[type]}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => editPeriod(period)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-lll-border bg-lll-bg px-3 py-2 text-[11px] text-lll-text-soft transition hover:text-lll-text"
                        >
                          <AppIcon name="edit" className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodActive(period, !period.active)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-lll-border bg-lll-bg px-3 py-2 text-[11px] text-lll-text-soft transition hover:text-lll-text"
                        >
                          <AppIcon name={period.active ? "archive" : "check"} className="h-3.5 w-3.5" />
                          {period.active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePeriod(period)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-200 transition hover:bg-red-500/10"
                        >
                          <AppIcon name="trash" className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </UserLayout>
  );
}
