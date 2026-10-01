"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import NewAbsenceModal, { type NewAbsencePayload } from "@/components/modals/NewAbsenceModal";
import CalendarMonth, {
  type BirthdayCalendarItem,
} from "@/components/dashboard/CalendarMonth";
import AbsenceList from "@/components/dashboard/AbsenceList";
import VacationBalanceCard from "@/components/dashboard/VacationBalanceCard";
import {
  NextAbsenceCard,
  UserDashboardSidebar,
} from "@/components/dashboard/UserDashboardOverview";
import { AppIcon } from "@/components/ui/AppIcon";
import { PageSummary, SummaryChip, SummaryIcon } from "@/components/ui/PageSummary";
import { Skeleton } from "@/components/ui/Skeleton";

import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import { toDate00, startOfTodayMs } from "@/lib/date";
import type { Absence } from "@/lib/supabase/absences";

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
import { listTeamBirthdays } from "@/lib/supabase/birthdays";

function nextBirthdayDate(birthDate: string, from: Date) {
  const [, monthText, dayText] = birthDate.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (!month || !day) return null;

  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let year = start.getFullYear(); year <= start.getFullYear() + 4; year += 1) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) continue;
    if (candidate >= start) return candidate;
  }
  return null;
}

function DashboardContentSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start"
      role="status"
      aria-label="Cargando contenido del dashboard"
    >
      <div className="space-y-4 xl:col-span-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="min-h-32 rounded-2xl border border-lll-border bg-lll-bg-soft p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-9 rounded-xl" />
              </div>
              <Skeleton className="mt-4 h-8 w-14" />
              <Skeleton className="mt-3 h-3 w-4/5" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="mt-4 h-24 w-full rounded-xl" />
        </div>

        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="mt-4 h-40 w-full rounded-xl" />
        </div>

        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-3 w-5/6" />
          <Skeleton className="mt-4 h-28 w-full rounded-xl" />
        </div>
      </div>

      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 xl:col-span-8">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {Array.from({ length: 42 }, (_, item) => (
            <Skeleton key={item} className="h-20 w-full rounded-xl" />
          ))}
        </div>
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
  const [teamBirthdays, setTeamBirthdays] = useState<BirthdayCalendarItem[]>([]);
  const [birthdaysError, setBirthdaysError] = useState<string | null>(null);

  const year = new Date().getFullYear();
const { isoSet: holidaysISO } = useHolidays(year);

  const {
    absences,
    createAbsence,
    updateAbsence,
    loadMyAbsences,
    hasLoadedMyAbsences,
    error: absError,
  } = useAbsences();

  const { userId, email, fullName, isAuthed, isLoading } = useAuth();

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

  useEffect(() => {
    if (!isAuthed || !userId) return;
    let alive = true;

    listTeamBirthdays()
      .then((birthdays) => {
        if (alive) setTeamBirthdays(birthdays);
      })
      .catch((birthdayError: unknown) => {
        if (!alive) return;
        const message =
          birthdayError &&
          typeof birthdayError === "object" &&
          "message" in birthdayError
            ? String(birthdayError.message)
            : "No se pudieron cargar los cumpleaños del equipo.";
        setBirthdaysError(message);
      });

    return () => {
      alive = false;
    };
  }, [isAuthed, userId]);

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

  const myPendingCount = useMemo(
    () => myAbsences.filter((a) => a.status === "pendiente").length,
    [myAbsences]
  );

  const nextAbsence = useMemo(() => {
    const today00 = startOfTodayMs();
    const upcoming = myAbsences
      .map((a) => ({ a, from: toDate00(a.from), to: toDate00(a.to) }))
      .filter(({ a, to }) => a.status !== "rechazado" && to.getTime() >= today00)
      .sort((x, y) => x.from.getTime() - y.from.getTime());

    return upcoming[0]?.a ?? null;
  }, [myAbsences]);

  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const horizon = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 45);

    return teamBirthdays
      .map((birthday) => ({
        ...birthday,
        nextDate: nextBirthdayDate(birthday.birthDate, start),
      }))
      .filter(
        (birthday): birthday is BirthdayCalendarItem & { nextDate: Date } =>
          birthday.nextDate !== null && birthday.nextDate <= horizon
      )
      .sort((left, right) => left.nextDate.getTime() - right.nextDate.getTime());
  }, [teamBirthdays]);

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

  useEffect(() => {
    if (!isAuthed || !userId) return;

    let alive = true;
    (async () => {
      try {
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
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthed, userId]);

  const dashboardContentReady = userId
    ? hasLoadedMyAbsences(userId) && (vacDb !== null || vacDbError !== null)
    : false;

  const vacationAvailable = Number(vacDb?.available ?? 0);
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
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-cyan-300">
              <AppIcon name="absence" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Tu espacio personal"
          subtitle="Organizá tus solicitudes, revisá tus saldos y anticipá tus próximos días fuera."
          meta={
            dashboardContentReady ? (
              <>
                <SummaryChip>
                  {myPendingCount} pendiente{myPendingCount === 1 ? "" : "s"}
                </SummaryChip>
                <SummaryChip>
                  {vacDb ? `${vacationAvailable} días disponibles` : "Saldo no disponible"}
                </SummaryChip>
                <SummaryChip>
                  {myAbsences.length} solicitud{myAbsences.length === 1 ? "" : "es"}
                </SummaryChip>
              </>
            ) : (
              <SummaryChip>Cargando tu información…</SummaryChip>
            )
          }
          actions={
            <button
              onClick={openCreate}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
              type="button"
              disabled={!dashboardContentReady}
            >
              <AppIcon name="plus" className="h-4 w-4" />
              Nueva solicitud
            </button>
          }
        />

        {absError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {absError}
          </div>
        ) : null}
        {birthdaysError ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            {birthdaysError}
          </div>
        ) : null}

        {!dashboardContentReady ? (
          <DashboardContentSkeleton />
        ) : (
          <div className="lll-fade-in space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
              <UserDashboardSidebar
                pendingCount={myPendingCount}
                vacationAvailable={vacationAvailable}
                hasVacationBalance={Boolean(vacDb)}
                birthdays={upcomingBirthdays}
              >
                <AbsenceList
                  absences={myAbsences}
                  onEdit={openEdit}
                  focusId={focusId}
                  collapsible
                  defaultOpen={false}
                />
              </UserDashboardSidebar>

              <div className="xl:col-span-8">
                <CalendarMonth
                  title="Tu calendario"
                  absences={myAbsences}
                  birthdays={teamBirthdays}
                  viewYear={viewYear}
                  viewMonth={viewMonth}
                  onPrevMonth={goPrevMonth}
                  onNextMonth={goNextMonth}
                  onToday={goToday}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
              <VacationBalanceCard
                data={vacDb}
                loading={vacDbLoading}
                error={vacDbError}
                className="h-full"
              />
              <NextAbsenceCard absence={nextAbsence} />
            </div>
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
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-72 max-w-full" />
                <Skeleton className="h-6 w-48 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>
        </section>
        <DashboardContentSkeleton />
      </div>
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
