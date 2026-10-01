"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import CalendarMonth, {
  type BirthdayCalendarItem,
} from "@/components/dashboard/CalendarMonth";
import CalendarSkeleton from "@/components/dashboard/CalendarSkeleton";
import BirthdayNotificationsTestCard from "@/components/dashboard/BirthdayNotificationsTestCard";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { useAbsences } from "@/contexts/AbsencesContext";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { getAbsenceTimeRangeLabel } from "@/lib/absences/timeRange";
import { formatAR, toDate00 } from "@/lib/date";
import type { Absence } from "@/lib/supabase/absences";
import { listProfiles, type ProfileRow } from "@/lib/supabase/profilesAdmin";

function isDateInRange(day: Date, fromISO: string, toISO: string) {
  const from = toDate00(fromISO).getTime();
  const to = toDate00(toISO).getTime();
  const timestamp = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate()
  ).getTime();
  return timestamp >= from && timestamp <= to;
}

function isISODate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getInitials(name?: string | null) {
  return (name?.trim() || "Usuario")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getProfileName(profile: ProfileRow) {
  return (
    profile.full_name?.trim() ||
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    profile.email?.trim() ||
    "Sin nombre"
  );
}

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

function AbsenceMiniRow({
  absence,
  showRange = false,
}: {
  absence: Absence;
  showRange?: boolean;
}) {
  const timeRangeLabel = getAbsenceTimeRangeLabel(absence);

  return (
    <Link
      href={`/owner/requests?focus=${absence.id}`}
      className="group flex items-center justify-between gap-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3 transition hover:bg-white/[0.05]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-lll-border bg-lll-bg text-[11px] font-semibold text-lll-accent-alt">
          {getInitials(absence.userName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-lll-text">
            {absence.userName ?? "Sin nombre"}
          </p>
          <p className="truncate text-[11px] text-lll-text-soft">
            {getAbsenceTypeLabel(absence.type, absence.subtype ?? null)}
            {showRange ? ` · ${formatAR(absence.from)} → ${formatAR(absence.to)}` : ""}
            {timeRangeLabel ? ` · ${timeRangeLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] ${
            absence.status === "pendiente"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {absence.status === "pendiente" ? "Pendiente" : "Aprobada"}
        </span>
        <AppIcon
          name="arrowRight"
          className="h-3.5 w-3.5 text-lll-text-soft transition-transform group-hover:translate-x-0.5 group-hover:text-lll-text"
        />
      </div>
    </Link>
  );
}

function OperationalOverview({
  outToday,
  outTomorrow,
  next7,
  wide = false,
}: {
  outToday: Absence[];
  outTomorrow: Absence[];
  next7: Array<{ date: Date; total: number; pending: number }>;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start"
          : "space-y-4"
      }
    >
      <SectionCard
        title="Hoy"
        description="Personas ausentes durante el día."
        icon={<AppIcon name="person" className="h-4 w-4" />}
        action={<SummaryChip>{outToday.length} fuera</SummaryChip>}
      >
        <div className="space-y-2">
          {outToday.slice(0, 6).map((absence) => (
            <AbsenceMiniRow key={absence.id} absence={absence} />
          ))}
          {outToday.length === 0 ? (
            <EmptyState
              icon={<AppIcon name="calendar" className="h-5 w-5" />}
              title="Equipo completo"
              description="No hay ausencias registradas para hoy."
              className="py-6"
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Mañana"
        description="Una vista rápida del próximo día."
        icon={<AppIcon name="arrowRight" className="h-4 w-4" />}
        action={<SummaryChip>{outTomorrow.length} fuera</SummaryChip>}
      >
        <div className="space-y-2">
          {outTomorrow.slice(0, 6).map((absence) => (
            <AbsenceMiniRow key={absence.id} absence={absence} />
          ))}
          {outTomorrow.length === 0 ? (
            <EmptyState
              icon={<AppIcon name="calendar" className="h-5 w-5" />}
              title="Sin ausencias"
              description="No hay personas fuera mañana."
              className="py-6"
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Próximos 7 días"
        description="Cantidad de personas fuera por jornada."
        icon={<AppIcon name="calendar" className="h-4 w-4" />}
        className={wide ? "md:col-span-2" : ""}
      >
        <div className={wide ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "space-y-2"}>
          {next7.map((day) => (
            <div
              key={day.date.toISOString()}
              className="flex items-center justify-between rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2.5"
            >
              <span className="text-[12px] capitalize text-lll-text">
                {day.date.toLocaleDateString("es-AR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              <div className="flex items-center gap-2">
                {day.pending > 0 ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
                    {day.pending} pendientes
                  </span>
                ) : null}
                <span className="min-w-6 rounded-full border border-lll-border bg-lll-bg px-2 py-0.5 text-center text-[10px] text-lll-text-soft">
                  {day.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function OwnerCalendarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/owner/dashboard");
  const { userId, email, isAuthed, role, isLoading } = useAuth();
  const { absences, loadAllAbsences, hasLoadedAllAbsences, error } = useAbsences();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [birthdayAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const requestedDate = new URLSearchParams(window.location.search).get("birthdayAt");
    return isISODate(requestedDate) ? requestedDate : null;
  });

  const [{ year: viewYear, month: viewMonth }, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  function goPrevMonth() {
    setViewDate((date) =>
      date.month === 0
        ? { year: date.year - 1, month: 11 }
        : { year: date.year, month: date.month - 1 }
    );
  }

  function goNextMonth() {
    setViewDate((date) =>
      date.month === 11
        ? { year: date.year + 1, month: 0 }
        : { year: date.year, month: date.month + 1 }
    );
  }

  function goToday() {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
  }

  const calendarLoaded = hasLoadedAllAbsences && !profilesLoading;

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

    void loadAllAbsences();
    let active = true;
    listProfiles()
      .then((rows) => {
        if (active) setProfiles(rows);
      })
      .catch((profileError: unknown) => {
        if (!active) return;
        const message =
          profileError &&
          typeof profileError === "object" &&
          "message" in profileError
            ? String(profileError.message)
            : "No se pudieron cargar los cumpleaños.";
        setProfilesError(message);
      })
      .finally(() => {
        if (active) setProfilesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLoading, isAuthed, userId, role, router, loadAllAbsences]);

  const teamAbsences = useMemo(() => absences, [absences]);
  const today = useMemo(() => new Date(), []);

  const birthdays = useMemo<BirthdayCalendarItem[]>(
    () =>
      profiles
        .filter((profile) => profile.active && profile.birth_date)
        .map((profile) => ({
          id: profile.id,
          name: getProfileName(profile),
          birthDate: profile.birth_date as string,
        })),
    [profiles]
  );

  const upcomingBirthdays = useMemo(() => {
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45);
    return birthdays
      .map((birthday) => ({
        ...birthday,
        nextDate: nextBirthdayDate(birthday.birthDate, today),
      }))
      .filter(
        (birthday): birthday is BirthdayCalendarItem & { nextDate: Date } =>
          birthday.nextDate !== null && birthday.nextDate <= horizon
      )
      .sort((left, right) => left.nextDate.getTime() - right.nextDate.getTime());
  }, [birthdays, today]);

  const pending = useMemo(
    () => teamAbsences.filter((absence) => absence.status === "pendiente"),
    [teamAbsences]
  );

  const outToday = useMemo(
    () =>
      teamAbsences.filter(
        (absence) =>
          absence.status !== "rechazado" &&
          isDateInRange(today, absence.from, absence.to)
      ),
    [teamAbsences, today]
  );

  const outTomorrow = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return teamAbsences.filter(
      (absence) =>
        absence.status !== "rechazado" &&
        isDateInRange(tomorrow, absence.from, absence.to)
    );
  }, [teamAbsences, today]);

  const next7 = useMemo(() => {
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return date;
    });

    return days.map((date) => {
      const hits = teamAbsences.filter(
        (absence) =>
          absence.status !== "rechazado" &&
          isDateInRange(date, absence.from, absence.to)
      );
      return {
        date,
        total: hits.length,
        pending: hits.filter((absence) => absence.status === "pendiente").length,
      };
    });
  }, [teamAbsences, today]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lll-bg text-lll-text">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Cargando sesión…
        </div>
      </div>
    );
  }

  if (!isAuthed || !userId || role !== "owner") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lll-bg text-lll-text">
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
        title: isDashboard ? "Dashboard" : "Calendario",
        subtitle: isDashboard
          ? "Resumen operativo del equipo."
          : "Vista mensual de ausencias del equipo.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone={isDashboard ? "text-cyan-300" : "text-orange-300"}>
              <AppIcon name={isDashboard ? "users" : "calendar"} className="h-7 w-7" />
            </SummaryIcon>
          }
          title={isDashboard ? "Panel del equipo" : "Calendario del equipo"}
          subtitle={
            isDashboard
              ? "Revisá pendientes, disponibilidad y próximos movimientos desde una sola vista."
              : "Anticipá ausencias, pendientes y disponibilidad de los próximos días."
          }
          meta={
            calendarLoaded ? (
              <>
                <SummaryChip>{outToday.length} fuera hoy</SummaryChip>
                <SummaryChip>{outTomorrow.length} fuera mañana</SummaryChip>
                <SummaryChip>{pending.length} pendientes</SummaryChip>
                <SummaryChip>{upcomingBirthdays.length} cumpleaños próximos</SummaryChip>
              </>
            ) : (
              <SummaryChip>Cargando calendario…</SummaryChip>
            )
          }
          actions={
            <Link
              href="/owner/requests"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text-soft transition hover:text-lll-text"
            >
              <AppIcon name="absence" className="h-4 w-4" />
              Ver solicitudes
            </Link>
          }
        />

        {error ? (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {profilesError ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {profilesError}
          </div>
        ) : null}

        {!calendarLoaded ? (
          <CalendarSkeleton calendarRight={isDashboard} />
        ) : (
          <div className="lll-fade-in grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={`space-y-4 lg:col-span-2 ${isDashboard ? "order-2" : "order-1"}`}>
              <CalendarMonth
                title="Calendario del equipo"
                absences={teamAbsences}
                birthdays={birthdays}
                viewYear={viewYear}
                viewMonth={viewMonth}
                onPrevMonth={goPrevMonth}
                onNextMonth={goNextMonth}
                onToday={goToday}
                mode="owner"
              />

              {!isDashboard ? (
                <OperationalOverview
                  outToday={outToday}
                  outTomorrow={outTomorrow}
                  next7={next7}
                  wide
                />
              ) : null}
            </div>

            <aside className={`space-y-4 lg:col-span-1 ${isDashboard ? "order-1" : "order-2"}`}>
              <SectionCard
                title="Próximos cumpleaños"
                description="Cumpleaños del equipo durante los próximos 45 días."
                icon={<AppIcon name="calendar" className="h-4 w-4" />}
                action={<SummaryChip>{upcomingBirthdays.length}</SummaryChip>}
              >
                <div className="space-y-2">
                  {upcomingBirthdays.slice(0, 6).map((birthday) => (
                    <div
                      key={birthday.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.055] p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 text-lg">
                          🎂
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-lll-text">
                            {birthday.name}
                          </p>
                          <p className="text-[11px] capitalize text-lll-text-soft">
                            {birthday.nextDate.toLocaleDateString("es-AR", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {upcomingBirthdays.length === 0 ? (
                    <EmptyState
                      icon={<AppIcon name="calendar" className="h-5 w-5" />}
                      title="Sin cumpleaños cercanos"
                      description="No hay cumpleaños cargados para los próximos 45 días."
                      className="py-6"
                    />
                  ) : null}
                </div>
              </SectionCard>

              {!isDashboard && birthdayAt ? (
                <BirthdayNotificationsTestCard
                  profiles={profiles}
                  defaultEmail={email}
                  simulatedDate={birthdayAt}
                  defaultOpen
                  lockEmail
                />
              ) : null}

              <SectionCard
                title="Pendientes"
                description="Solicitudes que todavía requieren una decisión."
                icon={<AppIcon name="clock" className="h-4 w-4" />}
                action={
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                    {pending.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {pending.slice(0, 5).map((absence) => (
                    <AbsenceMiniRow key={absence.id} absence={absence} showRange />
                  ))}
                  {pending.length === 0 ? (
                    <EmptyState
                      icon={<AppIcon name="check" className="h-5 w-5" />}
                      title="Todo al día"
                      description="No hay solicitudes pendientes."
                      className="py-6"
                    />
                  ) : null}
                </div>
              </SectionCard>

              {isDashboard ? (
                <OperationalOverview
                  outToday={outToday}
                  outTomorrow={outTomorrow}
                  next7={next7}
                />
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
