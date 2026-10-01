import type { ReactNode } from "react";

import type { BirthdayCalendarItem } from "@/components/dashboard/CalendarMonth";
import { AppIcon } from "@/components/ui/AppIcon";
import { SectionCard } from "@/components/ui/SectionCard";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { getAbsenceTimeRangeLabel } from "@/lib/absences/timeRange";
import { formatAR } from "@/lib/date";
import type { Absence } from "@/lib/supabase/absences";

export type UpcomingBirthday = BirthdayCalendarItem & { nextDate: Date };

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function UserDashboardSidebar({
  pendingCount,
  vacationAvailable,
  hasVacationBalance,
  birthdays,
  children,
}: {
  pendingCount: number;
  vacationAvailable: number;
  hasVacationBalance: boolean;
  birthdays: UpcomingBirthday[];
  children?: ReactNode;
}) {
  const today = new Date();

  return (
    <aside className="space-y-4 xl:col-span-4">
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.08] via-lll-bg-soft to-lll-bg-soft p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/80">
              Pendientes
            </p>
            <AppIcon name="clock" className="h-4 w-4 text-amber-300" />
          </div>
          <p className="mt-3 text-3xl font-semibold leading-none">{pendingCount}</p>
          <p className="mt-2 text-[11px] leading-4 text-lll-text-soft">
            {pendingCount === 0 ? "Sin aprobaciones en espera." : "Esperando aprobación."}
          </p>
        </article>

        <article className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.08] via-lll-bg-soft to-lll-bg-soft p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-200/80">
              Disponibles
            </p>
            <AppIcon name="balance" className="h-4 w-4 text-cyan-300" />
          </div>
          <p className="mt-3 text-3xl font-semibold leading-none">
            {hasVacationBalance ? vacationAvailable : "—"}
            {hasVacationBalance ? (
              <span className="ml-1 text-xs font-medium text-lll-text-soft">días</span>
            ) : null}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-lll-text-soft">
            Saldo actual de vacaciones.
          </p>
        </article>
      </div>

      <SectionCard
        title="Próximos cumpleaños"
        description="Durante los próximos 45 días."
        icon={<AppIcon name="calendar" className="h-4 w-4" />}
        action={
          <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/[0.08] px-2.5 py-1 text-[11px] text-fuchsia-200">
            {birthdays.length}
          </span>
        }
      >
        {birthdays.length > 0 ? (
          <div className="divide-y divide-lll-border/70">
            {birthdays.slice(0, 6).map((birthday) => {
              const birthdayIsToday = isSameDay(birthday.nextDate, today);
              return (
                <div
                  key={birthday.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/10 text-base">
                      🎂
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-lll-text">
                        {birthday.name}
                      </p>
                      <p className="mt-0.5 text-[11px] capitalize text-lll-text-soft">
                        {birthday.nextDate.toLocaleDateString("es-AR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  {birthdayIsToday ? (
                    <span className="shrink-0 rounded-full bg-fuchsia-500/10 px-2 py-1 text-[10px] font-medium text-fuchsia-200">
                      Hoy
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-lll-bg-softer/70 px-3 py-4">
            <span className="text-xl" aria-hidden="true">🎂</span>
            <div>
              <p className="text-sm font-medium">Sin cumpleaños cercanos</p>
              <p className="mt-0.5 text-[11px] text-lll-text-soft">
                No hay fechas cargadas en este período.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {children}
    </aside>
  );
}

export function NextAbsenceCard({ absence }: { absence: Absence | null }) {
  const timeRangeLabel = absence ? getAbsenceTimeRangeLabel(absence) : null;

  return (
    <SectionCard
      title="Próxima ausencia"
      description="Tu siguiente solicitud aprobada o pendiente."
      icon={<AppIcon name="calendar" className="h-4 w-4" />}
      className="h-full"
      action={
        absence ? (
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              absence.status === "aprobado"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200"
            }`}
          >
            {absence.status === "aprobado" ? "Aprobada" : "Pendiente"}
          </span>
        ) : null
      }
    >
      {absence ? (
        <div className="rounded-xl bg-lll-bg-softer/70 p-4">
          <p className="text-sm font-semibold">
            {getAbsenceTypeLabel(absence.type, absence.subtype ?? null)}
          </p>
          <p className="mt-2 flex items-center gap-2 text-[12px] text-lll-text-soft">
            <AppIcon name="calendar" className="h-3.5 w-3.5 shrink-0" />
            <span>
              {formatAR(absence.from)}
              {absence.to !== absence.from ? ` → ${formatAR(absence.to)}` : ""}
            </span>
          </p>
          {timeRangeLabel ? (
            <p className="mt-1.5 flex items-center gap-2 text-[12px] text-lll-text-soft">
              <AppIcon name="clock" className="h-3.5 w-3.5 shrink-0" />
              <span>{timeRangeLabel}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center rounded-xl bg-lll-bg-softer/70 px-4 text-center">
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
              <AppIcon name="check" className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">Agenda despejada</p>
            <p className="mt-1 text-[12px] text-lll-text-soft">
              No tenés ausencias próximas.
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
