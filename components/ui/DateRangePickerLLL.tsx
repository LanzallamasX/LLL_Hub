"use client";

import * as React from "react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";

export type BlockedRange = {
  from: Date;
  to: Date;
  status: "pendiente" | "aprobado";
};

type Props = {
  holidaysISO?: Set<string>;
  blockedRanges?: BlockedRange[];

  value: { from?: Date; to?: Date };
  onChange: (next: { from?: Date; to?: Date }) => void;

  minDate?: Date;
  label?: string;

  /** opcional: si querés ocultar la leyenda */
  showLegend?: boolean;
};

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function inRange(d: Date, r: { from: Date; to: Date }) {
  return d >= r.from && d <= r.to;
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function DateRangePickerLLL({
  holidaysISO,
  blockedRanges = [],
  value,
  onChange,
  minDate,
  label = "",
  showLegend = true,
}: Props) {
  const selected: DateRange | undefined = value.from
    ? { from: value.from, to: value.to }
    : undefined;

  // Disabled: rangos ocupados + minDate (NO feriados)
  const disabled = React.useMemo(() => {
    const arr: any[] = [];
    for (const r of blockedRanges) arr.push({ from: r.from, to: r.to });
    if (minDate) arr.push({ before: minDate });
    return arr;
  }, [blockedRanges, minDate]);

  const modifiers = React.useMemo(() => {
    return {
      holiday: (date: Date) => (holidaysISO ? holidaysISO.has(toISO(date)) : false),
      pending: (date: Date) =>
        blockedRanges.some((r) => r.status === "pendiente" && inRange(date, r)),
      approved: (date: Date) =>
        blockedRanges.some((r) => r.status === "aprobado" && inRange(date, r)),
    };
  }, [holidaysISO, blockedRanges]);

  const hasHolidaySelected = React.useMemo(() => {
    if (!holidaysISO || !value.from || !value.to) return false;
    const d = new Date(value.from.getTime());
    while (d <= value.to) {
      if (holidaysISO.has(toISO(d))) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  }, [holidaysISO, value.from, value.to]);

  const hasBlockedSelected = React.useMemo(() => {
    if (!value.from) return false;
    const from = value.from;
    const to = value.to ?? value.from;
    return blockedRanges.some((r) => !(to < r.from || from > r.to));
  }, [value.from, value.to, blockedRanges]);

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-3">
      {/* Styles “LLL” */}
      <style>{`
        /* Layout general */
        .rdp { margin: 0; color: inherit; }
        .rdp-months { display: flex; justify-content: center; }
        .rdp-month { width: 100%; }

        /* Header */
        .rdp-caption { display:flex; align-items:center; justify-content:space-between; margin-bottom: 10px; }
        .rdp-caption_label { font-size: 14px; font-weight: 600; color: rgba(255,255,255,.90); }
        .rdp-nav { display:flex; gap: 10px; }
        .rdp-nav_button {
          width: 34px; height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.04);
          color: rgba(255,255,255,.85);
        }
        .rdp-nav_button:hover { background: rgba(255,255,255,.08); }

        /* Weekdays */
        .rdp-head_row { }
        .rdp-head_cell {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,.45);
          text-transform: lowercase;
          padding: 8px 0;
        }

        /* Days grid */
        .rdp-table { width: 100%; border-collapse: separate; border-spacing: 6px; }
        .rdp-cell { padding: 0; }

        .rdp-day {
          width: 40px; height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.06);
          background: rgba(255,255,255,.02);
          color: rgba(255,255,255,.90);
          font-size: 13px;
        }
        .rdp-day:hover {
          background: rgba(255,255,255,.06);
        }

        /* Outside */
        .rdp-day_outside { opacity: .25; }

        /* Disabled (ocupado / minDate) */
        .rdp-day_disabled {
          opacity: .28;
          cursor: not-allowed;
          background: rgba(255,255,255,.015);
        }

        /* Range selection: fondo “acento” suave */
        .rdp-day_range_middle:not(.rdp-day_disabled) {
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.10);
        }

        /* Start/End más marcado */
        .rdp-day_range_start:not(.rdp-day_disabled),
        .rdp-day_range_end:not(.rdp-day_disabled),
        .rdp-day_selected:not(.rdp-day_disabled) {
          background: rgba(255,255,255,.10);
          border-color: rgba(255,255,255,.18);
          outline: 1px solid rgba(255,255,255,.14);
        }

        /* === Modifiers === */

        /* Feriado: azul clarito sutil */
        .lll-holiday:not(.rdp-day_disabled) {
          box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
          background: rgba(56, 189, 248, 0.08);
        }

        /* Aprobado: verde sutil */
        .lll-approved:not(.rdp-day_disabled) {
          box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.30);
          background: rgba(34, 197, 94, 0.06);
        }

        /* Pendiente: ámbar sutil */
        .lll-pending:not(.rdp-day_disabled) {
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.30);
          background: rgba(245, 158, 11, 0.06);
        }

        /* Si además está seleccionado, que se note el borde */
        .lll-approved.rdp-day_range_start:not(.rdp-day_disabled),
        .lll-approved.rdp-day_range_end:not(.rdp-day_disabled),
        .lll-pending.rdp-day_range_start:not(.rdp-day_disabled),
        .lll-pending.rdp-day_range_end:not(.rdp-day_disabled) {
          outline: 2px solid rgba(255,255,255,.14);
        }
      `}</style>

      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-lll-text-soft">{label}</p>
          <p className="mt-1 text-[12px] text-lll-text-soft">
            {value.from ? (
              <>
                <span className="text-lll-text font-semibold">
                  {format(value.from, "dd/MM/yyyy")}
                </span>
                {value.to ? (
                  <>
                    {" "}
                    <span className="opacity-50">→</span>{" "}
                    <span className="text-lll-text font-semibold">
                      {format(value.to, "dd/MM/yyyy")}
                    </span>
                  </>
                ) : (
                  <span className="opacity-50"> (seleccioná fin)</span>
                )}
              </>
            ) : (
              "Seleccioná un rango"
            )}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {hasHolidaySelected ? (
            <span className="text-[11px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
              Feriado en el rango
            </span>
          ) : null}

          {hasBlockedSelected ? (
            <span className="text-[11px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
              Se solapa con ocupado
            </span>
          ) : null}
        </div>
      </div>

      <DayPicker
        mode="range"
        selected={selected}
        onSelect={(next) => onChange({ from: next?.from, to: next?.to })}
        disabled={disabled}
        modifiers={modifiers}
        modifiersClassNames={{
          holiday: "lll-holiday",
          approved: "lll-approved",
          pending: "lll-pending",
        }}
        showOutsideDays
        fixedWeeks
        components={{
          DayContent: (props) => {
            const iso = toISO(props.date);
            const isHoliday = holidaysISO ? holidaysISO.has(iso) : false;
            const isApproved = blockedRanges.some(
              (r) => r.status === "aprobado" && inRange(props.date, r)
            );
            const isPending = blockedRanges.some(
              (r) => r.status === "pendiente" && inRange(props.date, r)
            );

            const title = isApproved
              ? "Aprobado"
              : isPending
              ? "Pendiente"
              : isHoliday
              ? "Feriado (no descuenta)"
              : "";

            return (
              <span
                title={title}
                className={cx(
                  "inline-flex items-center justify-center w-full h-full",
                  isHoliday && "font-semibold"
                )}
              >
                {props.date.getDate()}
              </span>
            );
          },
        }}
      />

      {showLegend ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[11px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
            🟩 Aprobado
          </span>
          <span className="text-[11px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
            🟧 Pendiente
          </span>
          <span className="text-[11px] px-2 py-1 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
            🏷️ Feriado (no descuenta)
          </span>
        </div>
      ) : null}
    </div>
  );
}