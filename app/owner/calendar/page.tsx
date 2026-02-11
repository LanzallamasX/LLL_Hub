"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import CalendarMonth from "@/components/dashboard/CalendarMonth";

import { useAuth } from "@/contexts/AuthContext";
import { useAbsences } from "@/contexts/AbsencesContext";
import { toDate00 } from "@/lib/date";

function isDateInRange(day: Date, fromISO: string, toISO: string) {
  const from = toDate00(fromISO).getTime();
  const to = toDate00(toISO).getTime();
  const t = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return t >= from && t <= to;
}

export default function OwnerCalendarPage() {
  const router = useRouter();

  const { userId, isAuthed, role, isLoading } = useAuth();
  const {
    absences,
    loadAllAbsences,
    isLoading: absencesLoading,
    error,
  } = useAbsences();

  const [{ year: viewYear, month: viewMonth }, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  function goPrevMonth() {
    setViewDate((d) => (d.month === 0 ? { year: d.year - 1, month: 11 } : { year: d.year, month: d.month - 1 }));
  }
  function goNextMonth() {
    setViewDate((d) => (d.month === 11 ? { year: d.year + 1, month: 0 } : { year: d.year, month: d.month + 1 }));
  }
  function goToday() {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
  }

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }

    if (role !== "owner") {
      router.replace("/dashboard");
      return;
    }

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadAllAbsences();
    }
  }, [isLoading, isAuthed, userId, role, router, loadAllAbsences]);

  const teamAbsences = useMemo(() => absences, [absences]);

  // Side panel computed data
  const today = useMemo(() => new Date(), []);
  const pending = useMemo(
    () => (teamAbsences ?? []).filter((a) => a.status === "pendiente"),
    [teamAbsences]
  );
  const outToday = useMemo(
    () => (teamAbsences ?? []).filter((a) => a.status !== "rechazado" && isDateInRange(today, a.from, a.to)),
    [teamAbsences, today]
  );

  const outTomorrow = useMemo(() => {
  const t = new Date(today);
  t.setDate(t.getDate() + 1);

  return (teamAbsences ?? []).filter(
    (a) => a.status !== "rechazado" && isDateInRange(t, a.from, a.to)
  );
}, [teamAbsences, today]);



  const next7 = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });

    return days.map((d) => {
      const hits = (teamAbsences ?? []).filter(
        (a) => a.status !== "rechazado" && isDateInRange(d, a.from, a.to)
      );
      const pendingCount = hits.filter((h) => h.status === "pendiente").length;
      return {
        date: d,
        total: hits.length,
        pending: pendingCount,
      };
    });
  }, [teamAbsences, today]);

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CalendarMonth
            title="Calendario del equipo"
            absences={teamAbsences}
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onToday={goToday}
            mode="owner"
          />
        </div>

        <aside className="lg:col-span-1 space-y-4">
          {/* Pendientes */}
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-lll-text">Pendientes</div>
              <span className="text-xs px-2 py-0.5 rounded-full border border-lll-border bg-lll-bg text-lll-text">
                {pending.length}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {pending.slice(0, 5).map((a) => (
                <div key={a.id} className="rounded-xl border border-lll-border bg-lll-bg-softer p-3">
                  <div className="text-sm font-medium text-lll-text truncate">{a.userName ?? "Sin nombre"}</div>
                  <div className="text-xs text-lll-text-soft mt-0.5">
                    {a.type} · {a.from} → {a.to}
                  </div>
                </div>
              ))}
              {pending.length === 0 ? (
                <div className="text-sm text-lll-text-soft">No hay solicitudes pendientes.</div>
              ) : null}
            </div>
          </div>

          {/* Hoy */}
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-lll-text">Hoy</div>
              <span className="text-xs px-2 py-0.5 rounded-full border border-lll-border bg-lll-bg text-lll-text">
                {outToday.length} out
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {outToday.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-lll-border bg-lll-bg-softer p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-lll-text truncate">{a.userName ?? "Sin nombre"}</div>
                    <div className="text-xs text-lll-text-soft truncate">{a.type}</div>
                  </div>
                  <span className="text-[11px] text-lll-text-soft">{a.status}</span>
                </div>
              ))}
              {outToday.length === 0 ? (
                <div className="text-sm text-lll-text-soft">Nadie está fuera hoy.</div>
              ) : null}
            </div>
          </div>

          {/* Mañana */}
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-lll-text">Mañana</div>
              <span className="text-xs px-2 py-0.5 rounded-full border border-lll-border bg-lll-bg text-lll-text">
                {outTomorrow.length} out
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {outTomorrow.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-lll-border bg-lll-bg-softer p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-lll-text truncate">{a.userName ?? "Sin nombre"}</div>
                    <div className="text-xs text-lll-text-soft truncate">{a.type}</div>
                  </div>
                  <span className="text-[11px] text-lll-text-soft">{a.status}</span>
                </div>
              ))}
              {outTomorrow.length === 0 ? (
                <div className="text-sm text-lll-text-soft">Nadie está fuera mañana.</div>
              ) : null}
            </div>
          </div>          

          {/* Próximos 7 días */}
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="text-sm font-semibold text-lll-text">Próximos 7 días</div>
            <div className="mt-3 space-y-2">
              {next7.map((x) => (
                <div
                  key={x.date.toISOString()}
                  className="flex items-center justify-between rounded-xl border border-lll-border bg-lll-bg-softer p-3"
                >
                  <div className="text-sm text-lll-text">
                    {x.date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
                  </div>
                  <div className="flex items-center gap-2">
                    {x.pending > 0 ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-700/30 bg-amber-900/20 text-amber-200">
                        {x.pending}P
                      </span>
                    ) : null}
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-lll-border bg-lll-bg text-lll-text">
                      {x.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </UserLayout>
  );
}
