"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import CalendarMonth from "@/components/dashboard/CalendarMonth";

import { useAuth } from "@/contexts/AuthContext";
import { useAbsences } from "@/contexts/AbsencesContext";

export default function OwnerCalendarPage() {
  const router = useRouter();

  const { userId, isAuthed, role, isLoading } = useAuth();
  const {
    absences,
    loadAllAbsences,
    isLoading: absencesLoading,
    error,
  } = useAbsences();

  // Mes visible (owner calendar)
  const [{ year: viewYear, month: viewMonth }, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  function goPrevMonth() {
    setViewDate((d) => {
      if (d.month === 0) return { year: d.year - 1, month: 11 };
      return { year: d.year, month: d.month - 1 };
    });
  }

  function goNextMonth() {
    setViewDate((d) => {
      if (d.month === 11) return { year: d.year + 1, month: 0 };
      return { year: d.year, month: d.month + 1 };
    });
  }

  function goToday() {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
  }

  // Evita doble load en dev (StrictMode) + evita recargas si el effect re-ejecuta
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    // 1) No authed => login
    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }

    // 2) Authed pero no owner => dashboard
    if (role !== "owner") {
      router.replace("/dashboard");
      return;
    }

    // 3) Owner => cargar datos una sola vez
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadAllAbsences();
    }
  }, [isLoading, isAuthed, userId, role, router, loadAllAbsences]);

  const teamAbsences = useMemo(() => absences, [absences]);

  // Pantallas de estado (opcional mantenerlas)
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

  if (role !== "owner") {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Redirigiendo…
        </div>
      </div>
    );
  }

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Calendario (equipo)",
        subtitle: "Vista de ausencias del equipo.",
      }}
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-sm text-lll-text-soft">
          {error}
        </div>
      ) : null}

      {absencesLoading ? (
        <div className="mb-4 rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-sm text-lll-text-soft">
          Cargando ausencias…
        </div>
      ) : null}

      <CalendarMonth
        title="Calendario del equipo"
        absences={teamAbsences}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onPrevMonth={goPrevMonth}
        onNextMonth={goNextMonth}
        onToday={goToday}
      />
    </UserLayout>
  );
}
