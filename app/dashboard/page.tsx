"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import NewAbsenceModal, { type NewAbsencePayload } from "@/components/modals/NewAbsenceModal";
import CalendarMonth from "@/components/dashboard/CalendarMonth";
import AbsenceList from "@/components/dashboard/AbsenceList";
import VacationBalanceCard from "@/components/dashboard/VacationBalanceCard";
import { AppIcon } from "@/components/ui/AppIcon";
import { Skeleton } from "@/components/ui/Skeleton";

import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { toDate00, formatAR, startOfTodayMs } from "@/lib/date";
import type { Absence } from "@/lib/supabase/absences";

import { computeVacationBalance } from "@/lib/vacations/calc";
import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";

import { computeUsageByBalanceKey } from "@/lib/balances/usage";

import { useMyVacationBalance } from "@/lib/vacations/useMyVacationBalance";
//import { toVacationInfoForModalAccumulated } from "@/lib/vacations/adapters";
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

function DashboardContentSkeleton() {
  return (
    <div
      className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3"
      role="status"
      aria-label="Cargando contenido del dashboard"
    >
      <div className="space-y-4 lg:col-span-1">
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-8 w-12" />
              <Skeleton className="mt-3 h-3 w-4/5" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
        </div>

        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-3 w-5/6" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="mt-5 h-[480px] w-full" />
      </div>

      <span className="sr-only">Cargando dashboard...</span>
    </div>
  );
}



function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);

  const year = new Date().getFullYear();
const { isoSet: holidaysISO } = useHolidays(year);

  const {
    absences,
    createAbsence,
    updateAbsence,
    pendingCount,
    loadMyAbsences,
    hasLoadedMyAbsences,
    error: absError,
  } = useAbsences();

  const { userId, email, fullName, isAuthed, isLoading, startDate } = useAuth();

  const [{ year: viewYear, month: viewMonth }, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // ✅ DB balance (ventana 3 años / FIFO)
 // const { data: vacDb, loading: vacDbLoading } = useMyVacationBalance(isAuthed && !!userId);
  
  const vacAtParam = searchParams.get("vacAt");
  const focusId = searchParams.get("focus");
  const vacAtISO = vacAtParam && /^\d{4}-\d{2}-\d{2}$/.test(vacAtParam) ? vacAtParam : null;
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

  const {
    data: vacDb,
    loading: vacDbLoading,
    error: vacDbError,
    reload: reloadVacationBalance,
  } = useMyVacationBalance(
    isAuthed && !!userId && vacModelReady,
    { pAt: vacAtISO, policyMode: vacModel, userId }
  );



  // ✅ cargar ausencias
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }

    // Si ya hay datos, el contexto los conserva y esta llamada revalida en background.
    void loadMyAbsences(userId);
  }, [isLoading, isAuthed, userId, router, loadMyAbsences]);

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

  // ✅ Fallback client-side (por si aún no cargó el RPC)
  const vacationBalanceFallback = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return computeVacationBalance({
      absences: myAbsences,
      currentYear,
      startDateISO: startDate,
      settings: {
        countMode: DEFAULT_VACATION_SETTINGS.countMode,
        carryoverEnabled: DEFAULT_VACATION_SETTINGS.carryover.enabled,
        carryoverMaxCycles: DEFAULT_VACATION_SETTINGS.carryover.maxCycles,
      },
    });
  }, [myAbsences, startDate]);

  // se puede borrar

  const myPendingCount = useMemo(
    () => myAbsences.filter((a) => a.status === "pendiente").length,
    [myAbsences]
  );

  const nextAbsence = useMemo(() => {
    const today00 = startOfTodayMs();
    const upcoming = myAbsences
      .map((a) => ({ a, from: toDate00(a.from) }))
      .filter(({ from }) => from.getTime() >= today00)
      .sort((x, y) => x.from.getTime() - y.from.getTime());

    return upcoming[0]?.a ?? null;
  }, [myAbsences]);

  const usageByKey = useMemo(() => {
    const y = new Date().getFullYear();
    return computeUsageByBalanceKey(myAbsences, y, {
      asOfISO: vacAtISO ?? undefined,
      homeOfficeCycleStartMonth: vacModel === "october" ? 10 : undefined,
    });
  }, [myAbsences, vacAtISO, vacModel]);

  // ✅ Modal: Cupo (bucket actual) + Acum (remaining buckets previos) + Usado/Disponible (ventana)
const vacationInfoForModal = useMemo(() => {
  return toVacationInfoForModal(vacDb);
}, [vacDb]);

// obtener fecha desde el profile (start_date) para usarla en el modal 
const [startDateISO, setStartDateISO] = useState<string | null>(null);
  const [startDateLoading, setStartDateLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed || !userId) return;

    let alive = true;
    (async () => {
      try {
        setStartDateLoading(true);

        const { data, error } = await supabase
          .from("profiles")
          .select("start_date")
          .eq("id", userId)
          .maybeSingle();

        if (!alive) return;
        if (error) throw error;

        // start_date debería venir como "YYYY-MM-DD"
        setStartDateISO(data?.start_date ?? null);
      } catch {
        if (!alive) return;
        setStartDateISO(null);
      } finally {
        if (alive) setStartDateLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthed, userId]);

  const dashboardContentReady = userId
    ? hasLoadedMyAbsences(userId) && (vacDb !== null || vacDbError !== null)
    : false;


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

  // UI helpers
  function goPrevMonth() {
    setViewDate((d) =>
      d.month === 0 ? { year: d.year - 1, month: 11 } : { year: d.year, month: d.month - 1 }
    );
  }
  function goNextMonth() {
    setViewDate((d) =>
      d.month === 11 ? { year: d.year + 1, month: 0 } : { year: d.year, month: d.month + 1 }
    );
  }
  function goToday() {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
  }

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
      

      await reloadVacationBalance(); 
      closeModal();
      return;
    }

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

    await processPendingEmails(
      requestDates.length > 1
        ? `${requestDates.length} absences created`
        : "absence created"
    );

    await reloadVacationBalance(); 
    closeModal();
  }

  return (
    <UserLayout mode="user" header={{ title: "Dashboard", subtitle: "Solicitudes, calendario e historial." }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-lll-text-soft">
            Tu vista personal: solicitudes, calendario y historial.
          </p>
          {dashboardContentReady ? (
            <p className="lll-fade-in mt-1 text-[12px] text-lll-text-soft">
              Equipo pendientes: {pendingCount} · Mis pendientes: {myPendingCount}
            </p>
          ) : (
            <Skeleton className="mt-2 h-3 w-52" />
          )}

          {absError ? <p className="mt-1 text-[12px] text-red-300">{absError}</p> : null}
        </div>

        <button
          onClick={openCreate}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          type="button"
          disabled={!dashboardContentReady}
        >
          <AppIcon name="plus" className="h-4 w-4" />
          Nueva solicitud
        </button>
      </div>

      {!dashboardContentReady ? (
        <DashboardContentSkeleton />
      ) : (
      <div className="lll-fade-in mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-4">
            {/* Row 1: Cards chicas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
                <p className="text-[12px] text-lll-text-soft">Pendientes</p>
                <p className="mt-2 text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">{myPendingCount}</p>
                <p className="mt-1 text-[12px] text-lll-text-soft">A la espera de aprobación.</p>
              </div>

              <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Próxima ausencia</p>
                  <span className="text-[12px] px-2 py-1 rounded-full bg-lll-bg-softer border border-lll-border text-lll-text-soft">
                    {nextAbsence ? getAbsenceTypeLabel(nextAbsence.type) : "—"}
                  </span>
                </div>

                {nextAbsence ? (
                  <>
                    <p className="mt-3 text-sm">
                      {formatAR(nextAbsence.from)} → {formatAR(nextAbsence.to)}
                    </p>
                    <p className="mt-1 text-[12px] text-lll-text-soft">
                      Estado: <span className="text-lll-text">{nextAbsence.status}</span>
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-lll-text-soft">No tenés ausencias próximas.</p>
                )}
              </div>
            </div>

            {/* List */}
            <AbsenceList absences={myAbsences} onEdit={openEdit} focusId={focusId} />

            {/* Vacaciones full width */}
            <VacationBalanceCard
              data={vacDb}
              loading={vacDbLoading}
              error={vacDbError}
            />
          </div>
        </div>

        <CalendarMonth
          absences={myAbsences}
          viewYear={viewYear}
          viewMonth={viewMonth}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onToday={goToday}
        />
      </div>
      )}

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
  subtitle={editing ? "Podés editar mientras esté pendiente." : "Completá los datos y enviá la solicitud."}
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
      asOfISO={vacAtISO}


/>
    </UserLayout>
  );
}

function DashboardLoading() {
  return (
    <UserLayout
      mode="user"
      header={{
        title: "Dashboard",
        subtitle: "Tu vista personal de solicitudes, calendario y saldos.",
      }}
    >
      <DashboardContentSkeleton />
    </UserLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageContent />
    </Suspense>
  );
}
