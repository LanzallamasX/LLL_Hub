"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import NewAbsenceModal, { type NewAbsencePayload } from "@/components/modals/NewAbsenceModal";
import CalendarMonth from "@/components/dashboard/CalendarMonth";
import AbsenceList from "@/components/dashboard/AbsenceList";
import VacationBalanceCard from "@/components/dashboard/VacationBalanceCard";

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
  normalizeVacationPolicyMode,
  type VacationPolicyMode,
} from "@/lib/supabase/vacationPolicy";
import { processPendingEmails } from "@/lib/email/processPendingEmails";



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
    isLoading: absLoading,
    error: absError,
  } = useAbsences();

  const { userId, email, fullName, isAuthed, isLoading, startDate } = useAuth();

  const [{ year: viewYear, month: viewMonth }, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Evita doble load en dev + re-ejecuciones del effect
  const hasLoadedRef = useRef(false);

  // ✅ DB balance (ventana 3 años / FIFO)
 // const { data: vacDb, loading: vacDbLoading } = useMyVacationBalance(isAuthed && !!userId);
  
  const vacAtParam = searchParams.get("vacAt");
  const vacAtISO = vacAtParam && /^\d{4}-\d{2}-\d{2}$/.test(vacAtParam) ? vacAtParam : null;
  const vacModelParam = (searchParams.get("vacModel") ?? searchParams.get("vacMode") ?? "")
    .trim()
    .toLowerCase();
  const [vacModel, setVacModel] = useState<VacationPolicyMode>("anniversary");

  useEffect(() => {
    if (!isAuthed) return;

    let alive = true;

    (async () => {
      if (vacModelParam === "october" || vacModelParam === "anniversary") {
        setVacModel(normalizeVacationPolicyMode(vacModelParam));
        return;
      }

      try {
        const policy = await fetchVacationPolicySettings();
        if (alive) setVacModel(policy.policy_mode);
      } catch (e) {
        console.error("fetchVacationPolicySettings error", e);
        if (alive) setVacModel("anniversary");
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthed, vacModelParam]);

  const { data: vacDb, loading: vacDbLoading, reload: reloadVacationBalance, } = useMyVacationBalance(
    isAuthed && !!userId,
    { pAt: vacAtISO, policyMode: vacModel, userId }
  );



  // ✅ cargar ausencias
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadMyAbsences(userId);
    }
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
      settings: DEFAULT_VACATION_SETTINGS,
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
    return computeUsageByBalanceKey(myAbsences, y);
  }, [myAbsences]);

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
      });
      

      await reloadVacationBalance(); 
      closeModal();
      return;
    }

    await createAbsence({
      userId: currentUser.userId,
      userName: currentUser.userName,
      from: payload.from,
      to: payload.to,
      type: payload.type,
      note: payload.note,
      subtype: payload.subtype ?? null,
      hours: payload.hours ?? null,
      notifyOwnerIds: payload.notifyOwnerIds ?? [],
    });

    await processPendingEmails("absence created");

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
          <p className="mt-1 text-[12px] text-lll-text-soft">
            Equipo pendientes: {pendingCount} · Mis pendientes: {myPendingCount}
          </p>

          {absLoading ? <p className="mt-1 text-[12px] text-lll-text-soft">Cargando ausencias…</p> : null}
          {absError ? <p className="mt-1 text-[12px] text-red-300">{absError}</p> : null}
          {vacDbLoading ? <p className="mt-1 text-[12px] text-lll-text-soft">Cargando vacaciones…</p> : null}
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
          type="button"
        >
          + Nueva solicitud
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <AbsenceList absences={myAbsences} onEdit={openEdit} />

            {/* Vacaciones full width */}
            <VacationBalanceCard />
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

<NewAbsenceModal
  open={isModalOpen}
  onClose={closeModal}
  onSubmit={handleSubmit}
  initial={editing ? { /* ... */ } : undefined}
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
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
        Cargando dashboard...
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
