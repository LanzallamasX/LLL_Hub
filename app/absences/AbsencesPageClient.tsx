// app/absences/AbsencesPageClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import AbsenceList from "@/components/dashboard/AbsenceList";
import AbsencesSkeleton from "@/components/dashboard/AbsencesSkeleton";
import NewAbsenceModal, { NewAbsencePayload } from "@/components/modals/NewAbsenceModal";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";

import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import type { Absence } from "@/lib/supabase/absences";

// para mostrar ausencias usadas
import { computeUsageByBalanceKey } from "@/lib/balances/usage";

// ✅ balance vacaciones desde DB
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";

// ✅ adapter shared con Dashboard (evita duplicar lógica)
import { toVacationInfoForModal } from "@/lib/vacations/adapters";

import { useHolidays } from "@/lib/holidays/useHolidays";
import { supabase } from "@/lib/supabase/client";
import {
  fetchVacationPolicySettings,
  getCachedVacationPolicySettings,
  normalizeVacationPolicyMode,
  type VacationPolicyMode,
} from "@/lib/supabase/vacationPolicy";
import { processPendingEmails } from "@/lib/email/processPendingEmails";

type Filter = "todas" | "pendiente" | "aprobado" | "rechazado";

function isValidDate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function yearFromISO(iso?: string | null) {
  if (!iso) return new Date().getFullYear();
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export default function AbsencesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, email, fullName, isAuthed, isLoading } = useAuth();
  const {
    absences,
    loadMyAbsences,
    createAbsence,
    updateAbsence,
    isLoading: absLoading,
    isRefreshing: absRefreshing,
    hasLoadedMyAbsences,
    error: absError,
  } = useAbsences();

  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);

  // ✅ Param global para testear políticas (YYYY-MM-DD)
  const asOfParam = searchParams.get("asOf");
  const vacAtParam = searchParams.get("vacAt");
  const asOfISO = isValidDate(vacAtParam) ? vacAtParam : isValidDate(asOfParam) ? asOfParam : null;
  const vacModelParam = (searchParams.get("vacModel") ?? searchParams.get("vacMode") ?? "")
    .trim()
    .toLowerCase();
  const cachedVacationPolicy = getCachedVacationPolicySettings();
  const hasExplicitVacModel =
    vacModelParam === "october" || vacModelParam === "anniversary";
  const [vacModel, setVacModel] = useState<VacationPolicyMode>(() =>
    hasExplicitVacModel
      ? normalizeVacationPolicyMode(vacModelParam)
      : cachedVacationPolicy?.policy_mode ?? "anniversary"
  );
  const [vacModelReady, setVacModelReady] = useState(
    hasExplicitVacModel || cachedVacationPolicy !== null
  );

  useEffect(() => {
    if (!isAuthed) return;

    let alive = true;

    (async () => {
      if (vacModelParam === "october" || vacModelParam === "anniversary") {
        if (alive) {
          setVacModel(normalizeVacationPolicyMode(vacModelParam));
          setVacModelReady(true);
        }
        return;
      }

      try {
        const policy = await fetchVacationPolicySettings();
        if (alive) {
          setVacModel(policy.policy_mode);
          setVacModelReady(true);
        }
      } catch (e) {
        console.error("fetchVacationPolicySettings error", e);
        if (alive) {
          setVacModel("anniversary");
          setVacModelReady(true);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthed, vacModelParam]);

  // ✅ Año “simulado” para feriados y cálculos por año
  const year = useMemo(() => yearFromISO(asOfISO), [asOfISO]);
  const { isoSet: holidaysISO } = useHolidays(year);

  const refreshKeyRef = useRef<string | null>(null);

  // ✅ Vacaciones DB
  const [vacDb, setVacDb] = useState<VacationBalance | null>(null);
  const [vacDbLoading, setVacDbLoading] = useState(false);

  // ✅ Start date desde profile
  const [startDateISO, setStartDateISO] = useState<string | null>(null);
  const [startDateLoading, setStartDateLoading] = useState(false);

  const currentUser = useMemo(
    () => ({
      userId: userId ?? "",
      userName: fullName ?? email ?? "Usuario",
    }),
    [userId, fullName, email]
  );

  const myAbsences = useMemo(() => {
    if (!userId) return [];
    return absences.filter((a) => a.userId === userId);
  }, [absences, userId]);

  const statusCounts = useMemo(
    () => ({
      total: myAbsences.length,
      pending: myAbsences.filter((absence) => absence.status === "pendiente").length,
      approved: myAbsences.filter((absence) => absence.status === "aprobado").length,
      rejected: myAbsences.filter((absence) => absence.status === "rechazado").length,
    }),
    [myAbsences]
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    let items = myAbsences;
    if (filter !== "todas") items = items.filter((a) => a.status === filter);

    if (q) {
      items = items.filter((a) => {
        const note = (a.note ?? "").toLowerCase();
        const type = (a.type ?? "").toLowerCase();
        return note.includes(q) || type.includes(q);
      });
    }

    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [myAbsences, filter, query]);

  // ✅ ausencias usadas (si tu helper usa “año”, lo hacemos con el año simulado)
  const usageByKey = useMemo(() => {
    return computeUsageByBalanceKey(myAbsences, year, {
      asOfISO: asOfISO ?? undefined,
      homeOfficeCycleStartMonth: vacModel === "october" ? 10 : undefined,
    });
  }, [myAbsences, year, asOfISO, vacModel]);

  // ✅ MISMO criterio que Dashboard, sin duplicación
  const vacationInfoForModal = useMemo(() => {
    return toVacationInfoForModal(vacDb);
  }, [vacDb]);

  // ---------------------------------------------
  // ✅ Refresh centralizado (se re-ejecuta al cambiar asOfISO)
  // ---------------------------------------------
  const refreshAll = useCallback(
    async (opts?: { forceAbsences?: boolean }) => {
      if (!isAuthed || !userId) return;

      setStartDateLoading(true);
      setVacDbLoading(true);

      const shouldLoadAbsences =
        opts?.forceAbsences || !hasLoadedMyAbsences(userId);

      const absencesPromise = shouldLoadAbsences
        ? loadMyAbsences(userId)
        : Promise.resolve();

      const profilePromise = (async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("start_date")
            .eq("id", userId)
            .maybeSingle();

          if (error) throw error;
          setStartDateISO(data?.start_date ?? null);
        } catch {
          setStartDateISO(null);
        } finally {
          setStartDateLoading(false);
        }
      })();

      const vacationPromise = (async () => {
        try {
          const b =
            vacModel === "october"
              ? await supabase
                  .rpc("get_vacation_balance_october_preview_for_user_at", {
                    p_user_id: userId,
                    p_at: asOfISO ?? undefined,
                  })
                  .then(({ data, error }) => {
                    if (error) throw error;
                    return data as VacationBalance;
                  })
              : await fetchMyVacationBalance(asOfISO ?? undefined);
          setVacDb(b);
        } catch {
          setVacDb(null);
        } finally {
          setVacDbLoading(false);
        }
      })();

      await Promise.all([absencesPromise, profilePromise, vacationPromise]);
    },
    [isAuthed, userId, loadMyAbsences, hasLoadedMyAbsences, asOfISO, vacModel]
  );

  // Gate de auth + redirect
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }
  }, [isLoading, isAuthed, userId, router]);

  // ✅ Cargar/refresh cuando entra o cambia asOfISO
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed || !userId) return;
    if (!vacModelReady) return;

    const refreshKey = `${userId}:${asOfISO ?? "today"}:${vacModel}`;
    if (refreshKeyRef.current === refreshKey) return;
    refreshKeyRef.current = refreshKey;

    void refreshAll({ forceAbsences: true });
  }, [isLoading, isAuthed, userId, asOfISO, vacModel, vacModelReady, refreshAll]);

  function openCreate() {
    setEditing(null);
    setIsModalOpen(true);
  }

  function openEdit(a: Absence) {
    setEditing(a);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditing(null);
  }

  
async function handleSubmit(payload: NewAbsencePayload) {
  if (editing) {
    if (editing.status !== "pendiente") {
      closeModal();
      return;
    }

    await updateAbsence(editing.id, {
      from: payload.from,
      to: payload.to,
      type: payload.type,
      note: payload.note,
      subtype: payload.subtype ?? null,
      hours: payload.hours ?? null,
      timeFrom: payload.timeFrom ?? null,
      timeTo: payload.timeTo ?? null,
    });

    await refreshAll({ forceAbsences: true });
    closeModal();
    return;
  }

  // 👉 CREACIÓN
  const requestDates = payload.dates?.length
    ? payload.dates
    : [payload.from];

  for (const requestDate of requestDates) {
    await createAbsence({
      userId: currentUser.userId,
      userName: currentUser.userName,
      from: requestDate,
      to: payload.dates?.length ? requestDate : payload.to,
      type: payload.type,
      note: payload.note,
      subtype: payload.subtype ?? null,
      hours: payload.hours ?? null,
      timeFrom: payload.timeFrom ?? null,
      timeTo: payload.timeTo ?? null,
      notifyOwnerIds: payload.notifyOwnerIds ?? [],
    });
  }

  // 🚀 DISPARA EMAIL (no bloquea)
  await processPendingEmails(
    requestDates.length > 1
      ? `${requestDates.length} absences created`
      : "absence created"
  );

  await refreshAll({ forceAbsences: true });
  closeModal();
}

  const contentReady = userId ? hasLoadedMyAbsences(userId) : false;
  const isRefreshing =
    absLoading || absRefreshing || vacDbLoading || startDateLoading;

  // Gates
  if (isLoading) {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Cargando sesión…
        </div>
      </div>
    );
  }

  if (!isAuthed || !userId) {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Redirigiendo a login…
        </div>
      </div>
    );
  }

  return (
    <UserLayout
      mode="user"
      header={{
        title: "Mis ausencias",
        subtitle: "Historial y gestión de tus solicitudes.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon>
              <AppIcon name="absence" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Mis ausencias"
          subtitle="Creá solicitudes, revisá estados y editá mientras estén pendientes."
          meta={
            contentReady ? (
              <>
                <SummaryChip>{statusCounts.total} solicitudes</SummaryChip>
                <SummaryChip>{statusCounts.pending} pendientes</SummaryChip>
                <SummaryChip>{statusCounts.approved} aprobadas</SummaryChip>
                {statusCounts.rejected > 0 ? (
                  <SummaryChip>{statusCounts.rejected} rechazadas</SummaryChip>
                ) : null}
              </>
            ) : (
              <SummaryChip>Cargando solicitudes…</SummaryChip>
            )
          }
          actions={
            <button
              onClick={openCreate}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
              type="button"
              disabled={!contentReady || isRefreshing}
            >
              <AppIcon name="plus" className="h-4 w-4" />
              Nueva solicitud
            </button>
          }
        />

        {absError ? (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {absError}
          </div>
        ) : null}

        {asOfISO ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-200">
            <AppIcon name="info" className="h-4 w-4 shrink-0" />
            Modo test activo: simulando fecha {asOfISO}
            {vacModel === "october" ? " · preview octubre" : ""}
          </div>
        ) : null}

        {!contentReady ? (
          <AbsencesSkeleton />
        ) : (
          <div className="lll-fade-in space-y-4">
            <SectionCard
              title="Buscar y filtrar"
              description={`${visibleItems.length} solicitud${visibleItems.length === 1 ? "" : "es"} visible${visibleItems.length === 1 ? "" : "s"}.`}
              icon={<AppIcon name="filter" className="h-4 w-4" />}
              action={
                <SearchField
                  className="w-[min(360px,42vw)] max-w-full"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por tipo o nota…"
                />
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {(["todas", "pendiente", "aprobado", "rechazado"] as Filter[]).map((filterOption) => (
                  <button
                    key={filterOption}
                    type="button"
                    onClick={() => setFilter(filterOption)}
                    className={`rounded-full border px-3 py-2 text-[12px] transition ${
                      filter === filterOption
                        ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                        : "border-lll-border bg-lll-bg-softer text-lll-text-soft hover:text-lll-text"
                    }`}
                  >
                    {filterOption === "todas"
                      ? "Todas"
                      : filterOption[0].toUpperCase() + filterOption.slice(1)}
                  </button>
                ))}
              </div>
            </SectionCard>

            <AbsenceList absences={visibleItems} onEdit={openEdit} />
          </div>
        )}
      </div>

      <NewAbsenceModal
        open={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initial={
          editing
            ? {
                from: editing.from,
                to: editing.to,
                type: editing.type,
                note: editing.note ?? undefined,
                subtype: editing.subtype ?? null,
                hours: editing.hours ?? null,
                timeFrom: editing.timeFrom ?? null,
                timeTo: editing.timeTo ?? null,
              }
            : undefined
        }
        submitLabel={editing ? "Guardar cambios" : "Enviar"}
        title={editing ? "Editar solicitud" : "Nueva solicitud"}
        subtitle={
          editing
            ? "Podés editar mientras esté pendiente."
            : "Completá los datos y enviá la solicitud."
        }
        usageByKey={usageByKey}
        vacationInfo={vacationInfoForModal ?? undefined}
        vacationAvailable={vacationInfoForModal?.available ?? undefined}
        existingAbsences={myAbsences.map((a) => ({
          id: a.id,
          status: a.status,
          from: a.from,
          to: a.to,
        }))}
        ignoreAbsenceId={editing?.id ?? null}
        holidaysISO={holidaysISO}
        startDateISO={startDateISO}
        asOfISO={asOfISO}
      />
    </UserLayout>
  );
}
