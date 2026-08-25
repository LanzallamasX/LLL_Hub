"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeletons";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";
import AbsenceConversation from "@/components/dashboard/AbsenceConversation";
import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { getAbsenceTimeRangeLabel } from "@/lib/absences/timeRange";
import { formatAR, formatARDateTime } from "@/lib/date";

type AbsenceStatus = "pendiente" | "aprobado" | "rechazado";

function statusUI(status: AbsenceStatus) {
  switch (status) {
    case "pendiente":
      return {
        label: "Pendiente",
        badge: "bg-amber-500/15 text-amber-200 border-amber-400/30",
      };
    case "aprobado":
      return {
        label: "Aprobado",
        badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
      };
    case "rechazado":
      return {
        label: "Rechazado",
        badge: "bg-red-500/15 text-red-200 border-red-400/30",
      };
  }
}

export default function OwnerDashboardPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, isAuthed, role, isLoading } = useAuth();
  const {
    absences,
    pendingCount,
    loadAllAbsences,
    hasLoadedAllAbsences,
    setAbsenceStatus,
  } = useAbsences();

  const [filter, setFilter] = useState<"pendiente" | "todas">("pendiente");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const contentLoaded = hasLoadedAllAbsences;

  const focusId = searchParams.get("focus");
  const vacAtParam = searchParams.get("vacAt"); // YYYY-MM-DD

  useEffect(() => {
    if (focusId) setFilter("todas");
  }, [focusId]);

  function isValidDate(v: string | null): v is string {
    return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  const vacAt = isValidDate(vacAtParam) ? vacAtParam : null;

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
  }, [isLoading, isAuthed, userId, role, router]);

  useEffect(() => {
    if (!isLoading && isAuthed && userId && role === "owner") {
      void loadAllAbsences();
    }
  }, [isLoading, isAuthed, userId, role, loadAllAbsences]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    let items =
      filter === "todas"
        ? absences
        : absences.filter((a) => a.status === "pendiente");

    if (q) {
      items = items.filter((a) => {
        const name = (a.userName ?? "").toLowerCase();
        return name.includes(q);
      });
    }

    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [absences, filter, query]);

  const statusCounts = useMemo(
    () => ({
      approved: absences.filter((absence) => absence.status === "aprobado").length,
      rejected: absences.filter((absence) => absence.status === "rechazado").length,
    }),
    [absences]
  );

  useEffect(() => {
    if (!focusId) return;
    if (visibleItems.length === 0) return;

    const el = document.getElementById(`absence-${focusId}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, visibleItems.length]);

  async function changeStatus(
    id: string,
    next: AbsenceStatus,
    current: AbsenceStatus
  ) {
    if (next === "rechazado" && current === "pendiente") {
      const ok = window.confirm(
        "¿Confirmás que querés rechazar esta solicitud?"
      );
      if (!ok) return;
    }

    try {
      setBusyId(id);
      await Promise.resolve(setAbsenceStatus(id, next));
    } finally {
      setBusyId(null);
    }
  }

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
        title: "Solicitudes",
        subtitle: "Revisión y gestión de ausencias del equipo.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-orange-300">
              <AppIcon name="absence" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Solicitudes del equipo"
          subtitle="Revisá, aprobá y acompañá cada solicitud desde una sola vista."
          meta={
            contentLoaded ? (
              <>
                <SummaryChip>{pendingCount} pendientes</SummaryChip>
                <SummaryChip>{statusCounts.approved} aprobadas</SummaryChip>
                <SummaryChip>{statusCounts.rejected} rechazadas</SummaryChip>
              </>
            ) : (
              <SummaryChip>Cargando solicitudes…</SummaryChip>
            )
          }
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("pendiente")}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  filter === "pendiente"
                    ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                    : "border-lll-border bg-lll-bg-softer text-lll-text-soft hover:text-lll-text"
                }`}
                type="button"
              >
                <AppIcon name="clock" className="h-4 w-4" />
                Pendientes
              </button>

              <button
                onClick={() => setFilter("todas")}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  filter === "todas"
                    ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                    : "border-lll-border bg-lll-bg-softer text-lll-text-soft hover:text-lll-text"
                }`}
                type="button"
              >
                <AppIcon name="filter" className="h-4 w-4" />
                Todas
              </button>
            </div>
          }
        />

        {vacAt ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-200">
            <AppIcon name="info" className="h-4 w-4 shrink-0" />
            Modo test activo: simulando vacaciones al {vacAt}
          </div>
        ) : null}

        <SectionCard
          title="Buscar colaborador"
          description={`${visibleItems.length} solicitud${visibleItems.length === 1 ? "" : "es"} visible${visibleItems.length === 1 ? "" : "s"}.`}
          icon={<AppIcon name="search" className="h-4 w-4" />}
          action={
            <SearchField
              className="w-[min(380px,42vw)] max-w-full"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre…"
            />
          }
        >
          <p className="text-[12px] text-lll-text-soft">
            El filtro se aplica sobre las solicitudes del estado seleccionado.
          </p>
        </SectionCard>

        <div className="space-y-4">
        {!contentLoaded ? (
          <div className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft">
            <ListSkeleton rows={6} />
          </div>
        ) : null}

        {contentLoaded && visibleItems.length === 0 && (
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft">
            <EmptyState
              icon={<AppIcon name="absence" className="h-5 w-5" />}
              title="No hay solicitudes para mostrar"
              description="Probá cambiando el filtro o la búsqueda seleccionada."
            />
          </div>
        )}

        {contentLoaded && visibleItems.map((a) => {
          const s = statusUI(a.status as AbsenceStatus);
          const isBusy = busyId === a.id;
          const timeRangeLabel = getAbsenceTimeRangeLabel(a);
          const initials = (a.userName || "Usuario")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("");

          return (
            <div
              key={a.id}
              id={`absence-${a.id}`}
              className={`rounded-2xl border bg-lll-bg-soft p-4 transition ${
                focusId === a.id
                  ? "border-lll-accent shadow-[0_0_0_2px_rgba(255,200,0,0.15)]"
                  : "border-lll-border"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lll-border bg-lll-bg-softer text-xs font-semibold text-lll-accent-alt">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-3">
                      <p className="truncate font-semibold">{a.userName}</p>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${s.badge}`}
                      >
                        <AppIcon
                          name={
                            a.status === "pendiente"
                              ? "clock"
                              : a.status === "aprobado"
                                ? "check"
                                : "close"
                          }
                          className="h-3.5 w-3.5"
                        />
                        {s.label}
                      </span>
                    </div>

                    <p className="mt-1 flex items-center gap-2 text-sm text-lll-text-soft">
                      <AppIcon name="calendar" className="h-4 w-4 shrink-0" />
                      {getAbsenceTypeLabel(a.type, a.subtype ?? null)} · {formatAR(a.from)} →{" "}
                      {formatAR(a.to)}
                    </p>

                    {timeRangeLabel ? (
                      <p className="mt-1 flex items-center gap-2 text-[12px] text-lll-text-soft">
                        <AppIcon name="clock" className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-lll-text">{timeRangeLabel}</span>
                      </p>
                    ) : null}

                    {a.note && (
                      <p className="mt-1 flex items-start gap-2 text-[12px] text-lll-text-soft">
                        <AppIcon name="note" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        “{a.note}”
                      </p>
                    )}

                    <p className="mt-2 flex items-center gap-2 text-[12px] text-lll-text-soft">
                      <AppIcon name="clock" className="h-3.5 w-3.5 shrink-0" />
                      Creada: <span className="text-lll-text">{formatARDateTime(a.createdAt)}</span>
                    </p>

                    {a.status !== "pendiente" && a.decidedAt ? (
                      <p className="mt-1 text-[12px] text-lll-text-soft">
                        Resuelto{" "}
                        {a.decidedByProfile?.fullName || a.decidedByProfile?.email ? (
                          <>
                            por{" "}
                            <span className="text-lll-text">
                              {a.decidedByProfile.fullName ?? a.decidedByProfile.email}
                            </span>{" "}
                          </>
                        ) : null}
                        el <span className="text-lll-text">{formatARDateTime(a.decidedAt)}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {a.status === "pendiente" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          changeStatus(a.id, "aprobado", "pendiente")
                        }
                        disabled={isBusy}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                          isBusy
                            ? "bg-lll-bg-softer border border-lll-border text-lll-text-soft cursor-not-allowed"
                            : "bg-emerald-500 text-black"
                        }`}
                        type="button"
                      >
                        <AppIcon name="check" className="mr-1 inline h-4 w-4" />
                        Aprobar
                      </button>

                      <button
                        onClick={() =>
                          changeStatus(a.id, "rechazado", "pendiente")
                        }
                        disabled={isBusy}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          isBusy
                            ? "bg-lll-bg-softer border-lll-border text-lll-text-soft cursor-not-allowed"
                            : "bg-lll-bg-softer border-lll-border text-lll-text"
                        }`}
                        type="button"
                      >
                        <AppIcon name="close" className="mr-1 inline h-4 w-4" />
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-lll-text-soft">
                        Acción tomada
                      </span>

                      <button
                        onClick={() =>
                          changeStatus(
                            a.id,
                            "pendiente",
                            a.status as AbsenceStatus
                          )
                        }
                        disabled={isBusy}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          isBusy
                            ? "bg-lll-bg-softer border-lll-border text-lll-text-soft cursor-not-allowed"
                            : "bg-lll-bg-softer border-lll-border text-lll-text"
                        }`}
                        type="button"
                      >
                        <AppIcon name="clock" className="mr-1 inline h-4 w-4" />
                        Marcar pendiente
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <AbsenceConversation absence={a} defaultOpen={focusId === a.id} />
            </div>
          );
        })}
        </div>
      </div>
    </UserLayout>
  );
}
