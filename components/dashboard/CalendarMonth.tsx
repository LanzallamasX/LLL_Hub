"use client";

import { useMemo, useState } from "react";
import type { Absence } from "@/lib/supabase/absences";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { formatAR, toDate00 } from "@/lib/date";
import { usePresence } from "@/components/ui/usePresence";
import { AppIcon } from "@/components/ui/AppIcon";
import { getAbsenceTimeRangeLabel } from "@/lib/absences/timeRange";

type CalendarMode = "owner" | "user";

type Props = {
  absences: Absence[];
  viewYear: number;
  viewMonth: number; // 0..11
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  title?: string;
  mode?: CalendarMode;
};

function mondayFirstIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

function monthLabelES(monthIndex: number) {
  const months = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
  return months[monthIndex] ?? "";
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayBaseClass({
  outside,
  weekend,
  today,
}: {
  outside: boolean;
  weekend: boolean;
  today: boolean;
}) {
  return [
    "relative min-h-[76px] w-full rounded-xl border p-2 text-left transition sm:min-h-[82px] lg:min-h-[86px]",
    "border-lll-border bg-lll-bg-soft hover:border-white/15 hover:bg-lll-bg-softer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lll-accent-alt/50",
    outside ? "opacity-30" : "",
    weekend && !outside ? "bg-white/[0.018]" : "",
    today ? "ring-1 ring-lll-accent-alt/70" : "",
  ].join(" ");
}

function dayToneClass(hits: Absence[]) {
  const hasPending = hits.some((h) => h.status === "pendiente");
  const hasApproved = hits.some((h) => h.status === "aprobado");

  if (hasPending) return "border-amber-400/45 bg-amber-400/[0.045]";
  if (hasApproved) return "border-emerald-400/35 bg-emerald-400/[0.035]";
  if (hits.length > 0) return "border-red-400/30 bg-red-400/[0.025]";
  return "";
}

function StatusChip({ status }: { status: Absence["status"] }) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4";
  if (status === "aprobado") {
    return (
      <span className={`${base} border-emerald-700/30 bg-emerald-900/20 text-emerald-200`}>
        Aprobada
      </span>
    );
  }
  if (status === "pendiente") {
    return (
      <span className={`${base} border-amber-700/30 bg-amber-900/20 text-amber-200`}>
        Pendiente
      </span>
    );
  }
  return (
    <span className={`${base} border-red-700/30 bg-red-900/20 text-red-200`}>
      Rechazada
    </span>
  );
}

// ✅ Hardcode MVP: luego lo pasamos a DB (absence_types.is_sensitive)
const SENSITIVE_TYPES = new Set<string>([
  "enfermedad",
  "turno_medico",
  "medico",
  "salud",
  "sick",
  "medical",
]);

function isSensitiveType(type: string) {
  return SENSITIVE_TYPES.has(String(type).toLowerCase());
}

export default function CalendarMonth({
  absences,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  title = "Calendario",
  mode = "owner",
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const drawerPresence = usePresence(drawerOpen);

  const daysGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = mondayFirstIndex(first.getDay()); // 0..6
    const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        date,
        outside: date.getMonth() !== viewMonth,
      };
    });
  }, [viewYear, viewMonth]);

  const absencesByDay = useMemo(() => {
    const map = new Map<string, Absence[]>();

    // Regla calendario owner: rechazadas NO van al calendario
    const list =
      mode === "owner"
        ? (absences ?? []).filter((a) => a.status !== "rechazado")
        : (absences ?? []);

    for (const a of list) {
      const from = toDate00(a.from);
      const to = toDate00(a.to);

      // guard anti-loop: 1 año max
      for (let i = 0, cur = new Date(from); i < 370; i++, cur.setDate(cur.getDate() + 1)) {
        if (cur.getTime() > to.getTime()) break;
        const key = dayKey(cur);
        const arr = map.get(key) ?? [];
        arr.push(a);
        map.set(key, arr);
      }
    }

    // Orden: pendientes arriba, luego aprobados
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        if (a.status === b.status) {
          const an = (a.userName ?? "").toLowerCase();
          const bn = (b.userName ?? "").toLowerCase();
          return an.localeCompare(bn);
        }
        if (a.status === "pendiente") return -1;
        if (b.status === "pendiente") return 1;
        return 0;
      });
      map.set(k, arr);
    }

    return map;
  }, [absences, mode]);

  const selectedKey = useMemo(() => {
    if (!selectedDate) return null;
    return dayKey(selectedDate);
  }, [selectedDate]);

  const selectedHits = useMemo(() => {
    if (!selectedKey) return [];
    return absencesByDay.get(selectedKey) ?? [];
  }, [absencesByDay, selectedKey]);

  function openDay(date: Date) {
    setSelectedDate(date);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="rounded-2xl lg:col-span-2 border border-lll-border bg-lll-bg-soft p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[12px] text-lll-text-soft">
            Seleccioná un día para ver el detalle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text-soft transition hover:text-lll-text"
            onClick={onPrevMonth}
            type="button"
            aria-label="Mes anterior"
          >
            <AppIcon name="arrowRight" className="h-4 w-4 rotate-180" />
          </button>

          <span className="min-h-10 inline-flex items-center text-[12px] px-3 py-2 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
            {monthLabelES(viewMonth)} {viewYear}
          </span>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text-soft transition hover:text-lll-text"
            onClick={onNextMonth}
            type="button"
            aria-label="Mes siguiente"
          >
            <AppIcon name="arrowRight" className="h-4 w-4" />
          </button>

          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text-soft transition hover:text-lll-text"
            onClick={onToday}
            type="button"
          >
            <AppIcon name="calendar" className="h-4 w-4" />
            Hoy
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-lll-border bg-lll-bg-softer p-2 sm:p-3">
        <div className="min-w-[600px]">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-lll-text-soft/75">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>

        <div
          key={`${viewYear}-${viewMonth}`}
          className="lll-fade-in mt-1.5 grid grid-cols-7 gap-1.5"
        >
          {daysGrid.map((cell) => {
            const key = dayKey(cell.date);
            const hits = absencesByDay.get(key) ?? [];
            const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
            const isToday = key === dayKey(new Date());

            const total = hits.length;
            const pendingCount = hits.filter((h) => h.status === "pendiente").length;
            const approvedCount = hits.filter((h) => h.status === "aprobado").length;
            const rejectedCount = hits.filter((h) => h.status === "rechazado").length;

            const tooltip =
              total === 0
                ? cell.date.toLocaleDateString("es-AR")
                : [
                    cell.date.toLocaleDateString("es-AR"),
                    "",
                    ...hits.map((absence) => {
                      const sensitive =
                        absence.type === "enfermedad" ||
                        absence.subtype === "TURNO_MEDICO";
                      const typeLabel =
                        mode === "owner" && sensitive
                          ? "Ausencia"
                          : getAbsenceTypeLabel(absence.type, absence.subtype ?? null);
                      const who =
                        mode === "owner" && absence.userName
                          ? `${absence.userName} · `
                          : "";
                      return `• ${who}${typeLabel} (${absence.status})`;
                    }),
                  ].join("\n");

            const firstHit = hits[0];
            const firstLabel = firstHit
              ? mode === "owner"
                ? firstHit.userName || "Sin nombre"
                : getAbsenceTypeLabel(firstHit.type, firstHit.subtype ?? null)
              : "";
            const summaryLine =
              total <= 1 ? firstLabel : `${firstLabel} +${total - 1}`;

            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                className={[
                  dayBaseClass({
                    outside: cell.outside,
                    weekend: isWeekend,
                    today: isToday,
                  }),
                  total ? dayToneClass(hits) : "",
                ].join(" ")}
                title={tooltip}
                aria-label={`${cell.date.toLocaleDateString("es-AR")}: ${total} ausencia${total === 1 ? "" : "s"}`}
                onClick={() => openDay(cell.date)}
              >
                <div
                  className={`absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] ${
                    isToday
                      ? "bg-lll-accent-alt text-black font-semibold"
                      : "text-lll-text-soft"
                  }`}
                >
                  {cell.date.getDate()}
                </div>

                {total > 0 ? (
                  <div className="absolute left-2 top-2 flex items-center gap-1.5">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-lll-border bg-lll-bg px-1.5 text-[10px] font-medium text-lll-text">
                      {total}
                    </span>
                    {pendingCount > 0 ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-400"
                        title={`${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`}
                      />
                    ) : null}
                  </div>
                ) : null}

                {total > 0 ? (
                  <div className="mt-7 pr-1">
                    <div className="truncate text-[11px] font-medium text-lll-text">
                      {summaryLine}
                    </div>
                    <div className="mt-0.5 text-[10px] text-lll-text-soft/70">
                      {total} ausencia{total === 1 ? "" : "s"}
                    </div>
                  </div>
                ) : null}

                {total > 0 ? (
                  <div className="absolute bottom-2 left-2 right-2 flex h-1 overflow-hidden rounded-full bg-lll-bg">
                    <div
                      className="lll-progress-fill h-full bg-amber-400/80"
                      style={{ width: `${Math.round((pendingCount / total) * 100)}%` }}
                    />
                    <div
                      className="lll-progress-fill h-full bg-emerald-400/80"
                      style={{ width: `${Math.round((approvedCount / total) * 100)}%` }}
                    />
                    {rejectedCount > 0 ? (
                      <div
                        className="lll-progress-fill h-full bg-red-400/70"
                        style={{ width: `${Math.round((rejectedCount / total) * 100)}%` }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-lll-border/70 pt-3 text-[11px] text-lll-text-soft">
          <div className="flex items-center gap-2">
            <span className="h-2 w-8 rounded-full overflow-hidden border border-lll-border bg-lll-bg">
              <span className="block h-full w-full bg-emerald-500/70" />
            </span>
            <span>Aprobado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-8 rounded-full overflow-hidden border border-lll-border bg-lll-bg">
              <span className="block h-full w-full bg-amber-500/70" />
            </span>
            <span>Pendiente</span>
          </div>
          {mode !== "owner" ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-8 overflow-hidden rounded-full border border-lll-border bg-red-400/70" />
              <span>Rechazado</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-lll-accent-alt" />
            <span>Hoy</span>
          </div>
        </div>
        </div>
      </div>

      {/* Detalle del día */}
{drawerPresence.shouldRender ? (
  <div
    className="lll-presence-root fixed inset-0 z-50 flex items-center justify-center p-4"
    data-state={drawerPresence.state}
    role="dialog"
    aria-modal="true"
    aria-hidden={!drawerOpen}
  >
    {/* overlay */}
    <button
      aria-label="Cerrar"
      className="lll-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      onClick={closeDrawer}
      type="button"
    />

    {/* panel */}
    <div className="lll-modal-panel relative w-full max-w-lg rounded-2xl border border-lll-border bg-lll-bg shadow-2xl">
      {/* header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-lll-border">
        <div>
          <div className="text-sm font-semibold text-lll-text">
            {selectedDate
              ? selectedDate.toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "Día"}
          </div>
          <div className="text-xs text-lll-text-soft">
            {selectedHits.length} ausencia{selectedHits.length === 1 ? "" : "s"}
          </div>
        </div>

        <button
          onClick={closeDrawer}
          className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-1.5 text-xs text-lll-text hover:bg-lll-bg-soft"
          type="button"
        >
          Cerrar
        </button>
      </div>

      {/* body */}
      <div className="p-4">
        {selectedHits.length === 0 ? (
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-sm text-lll-text-soft">
            No hay ausencias para este día.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
            {selectedHits.map((a) => {
              const rawLabel = getAbsenceTypeLabel(
                a.type,
                a.subtype ?? null,
              );
              const sensitive =
                isSensitiveType(String(a.type)) || a.subtype === "TURNO_MEDICO";
              const safeLabel = mode === "owner" && sensitive ? "Ausencia" : rawLabel;
              const timeRangeLabel = getAbsenceTimeRangeLabel(a);

              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-lll-border bg-lll-bg-soft p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-lll-text truncate">
                        {a.userName ?? "Sin nombre"}
                      </div>
                      <div className="mt-0.5 text-xs text-lll-text-soft truncate">
                        {safeLabel}
                      </div>
                    </div>

                    <StatusChip status={a.status} />
                  </div>

                  <div className="mt-2 text-[11px] text-lll-text-soft">
                    {formatAR(a.from)} → {formatAR(a.to)}
                  </div>
                  {timeRangeLabel ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-lll-text-soft">
                      <AppIcon name="clock" className="h-3.5 w-3.5" />
                      {timeRangeLabel}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* footer (opcional) */}
      <div className="flex items-center justify-between gap-2 p-4 border-t border-lll-border">
        <div className="text-[11px] text-lll-text-soft">
          {mode === "owner"
            ? "Las solicitudes rechazadas no se muestran en este calendario."
            : "Acá podés consultar el estado y horario de cada solicitud."}
        </div>
        {/* Si querés CTA real, lo conectamos después */}
        {/* <button className="rounded-xl bg-lll-accent px-3 py-2 text-xs text-black">Ver solicitudes</button> */}
      </div>
    </div>
  </div>
) : null}

    </div>
  );
}
