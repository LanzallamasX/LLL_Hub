"use client";

import * as React from "react";
import { DayPicker, type DateRange, type Matcher } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  selectionMode?: "range" | "multiple" | "single";
  selectedDates?: Date[];
  onSelectedDatesChange?: (dates: Date[]) => void;
  maxSelectedDates?: number;
  minDate?: Date;
  label?: string;
  showLegend?: boolean;
};

function toISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inRange(date: Date, range: { from: Date; to: Date }) {
  return date >= range.from && date <= range.to;
}

function sortDates(dates: Date[]) {
  return [...dates].sort((left, right) => left.getTime() - right.getTime());
}

const calendarClassNames = {
  root: "relative w-full",
  months: "w-full",
  month: "w-full space-y-3",
  month_caption: "relative flex h-10 items-center",
  caption_label: "text-sm font-semibold capitalize text-lll-text",
  nav: "absolute right-0 top-0 z-10 flex items-center gap-2",
  button_previous:
    "flex h-9 w-9 items-center justify-center rounded-xl border border-lll-border bg-lll-bg-softer text-lll-text-soft transition hover:text-lll-text disabled:opacity-30",
  button_next:
    "flex h-9 w-9 items-center justify-center rounded-xl border border-lll-border bg-lll-bg-softer text-lll-text-soft transition hover:text-lll-text disabled:opacity-30",
  chevron: "h-4 w-4 fill-current",
  month_grid: "w-full border-separate border-spacing-1",
  weekdays: "grid grid-cols-7",
  weekday: "py-2 text-center text-[11px] font-medium uppercase text-lll-text-soft/70",
  week: "grid grid-cols-7",
  day: "relative p-0 text-center",
  day_button:
    "mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.015] text-[12px] text-lll-text outline-none transition hover:border-white/[0.12] hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-lll-accent-alt/50",
  today: "[&>button]:border-lll-accent-alt/50 [&>button]:text-lll-accent-alt",
  selected:
    "[&>button]:border-lll-accent-alt/55 [&>button]:bg-lll-accent-alt/15 [&>button]:font-semibold [&>button]:text-lll-text",
  range_start: "[&>button]:rounded-xl",
  range_middle:
    "[&>button]:rounded-lg [&>button]:border-lll-accent-alt/20 [&>button]:bg-lll-accent-alt/[0.07]",
  range_end: "[&>button]:rounded-xl",
  outside: "opacity-25",
  disabled: "opacity-25 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
  hidden: "invisible",
};

export default function DateRangePickerLLL({
  holidaysISO,
  blockedRanges = [],
  value,
  onChange,
  selectionMode = "range",
  selectedDates = [],
  onSelectedDatesChange,
  maxSelectedDates,
  minDate,
  label = "",
  showLegend = true,
}: Props) {
  const selectedRange: DateRange | undefined = value.from
    ? { from: value.from, to: value.to }
    : undefined;
  const orderedSelectedDates = React.useMemo(
    () => sortDates(selectedDates),
    [selectedDates]
  );
  const isDiscrete = selectionMode !== "range";

  const disabled = React.useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = blockedRanges.map((range) => ({
      from: range.from,
      to: range.to,
    }));
    if (minDate) matchers.push({ before: minDate });
    return matchers;
  }, [blockedRanges, minDate]);

  const modifiers = React.useMemo(
    () => ({
      holiday: (date: Date) => Boolean(holidaysISO?.has(toISO(date))),
      pending: (date: Date) =>
        blockedRanges.some(
          (range) => range.status === "pendiente" && inRange(date, range)
        ),
      approved: (date: Date) =>
        blockedRanges.some(
          (range) => range.status === "aprobado" && inRange(date, range)
        ),
    }),
    [holidaysISO, blockedRanges]
  );

  const selectedDaysForChecks = React.useMemo(() => {
    if (isDiscrete) return orderedSelectedDates;
    if (!value.from) return [];

    const dates: Date[] = [];
    const end = value.to ?? value.from;
    const cursor = new Date(value.from.getTime());
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [isDiscrete, orderedSelectedDates, value.from, value.to]);

  const hasHolidaySelected = selectedDaysForChecks.some((date) =>
    holidaysISO?.has(toISO(date))
  );
  const hasBlockedSelected = selectedDaysForChecks.some((date) =>
    blockedRanges.some((range) => inRange(date, range))
  );

  function updateDiscreteDates(next: Date[] | undefined) {
    onSelectedDatesChange?.(sortDates(next ?? []));
  }

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-lll-border pb-3">
        <div className="min-w-0">
          {label ? <p className="text-[11px] text-lll-text-soft">{label}</p> : null}
          {isDiscrete ? (
            <>
              <p className="mt-1 text-sm font-semibold text-lll-text">
                {orderedSelectedDates.length > 0
                  ? `${orderedSelectedDates.length} ${
                      orderedSelectedDates.length === 1
                        ? "día seleccionado"
                        : "días seleccionados"
                    }`
                  : selectionMode === "single"
                    ? "Seleccioná un día"
                    : "Seleccioná uno o más días"}
              </p>
              <p className="mt-1 text-[11px] text-lll-text-soft">
                {selectionMode === "single"
                  ? "La solicitud se aplicará solamente a esta fecha."
                  : "Los días intermedios no se incluyen automáticamente."}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-lll-text-soft">
              {value.from ? (
                <>
                  <span className="font-semibold text-lll-text">
                    {format(value.from, "d MMM yyyy", { locale: es })}
                  </span>
                  {value.to ? (
                    <>
                      <span className="mx-2 opacity-50">→</span>
                      <span className="font-semibold text-lll-text">
                        {format(value.to, "d MMM yyyy", { locale: es })}
                      </span>
                    </>
                  ) : (
                    <span className="ml-2 opacity-60">Elegí la fecha final</span>
                  )}
                </>
              ) : (
                "Seleccioná el inicio y el final"
              )}
            </p>
          )}
        </div>

        {(isDiscrete ? orderedSelectedDates.length > 0 : value.from) ? (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-lll-border bg-lll-bg-softer px-2.5 py-1.5 text-[11px] text-lll-text-soft transition hover:text-lll-text"
            onClick={() => {
              if (isDiscrete) updateDiscreteDates([]);
              else onChange({});
            }}
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {selectionMode === "range" ? (
        <DayPicker
          mode="range"
          selected={selectedRange}
          onSelect={(next) => onChange({ from: next?.from, to: next?.to })}
          disabled={disabled}
          excludeDisabled
          modifiers={modifiers}
          modifiersClassNames={{
            holiday:
              "[&>button]:border-sky-400/30 [&>button]:bg-sky-400/[0.07]",
            approved:
              "[&>button]:border-emerald-400/30 [&>button]:bg-emerald-400/[0.06]",
            pending:
              "[&>button]:border-amber-400/30 [&>button]:bg-amber-400/[0.06]",
          }}
          classNames={calendarClassNames}
          locale={es}
          showOutsideDays
          fixedWeeks
        />
      ) : selectionMode === "single" ? (
        <DayPicker
          mode="single"
          selected={orderedSelectedDates[0]}
          onSelect={(next) => updateDiscreteDates(next ? [next] : [])}
          disabled={disabled}
          modifiers={modifiers}
          modifiersClassNames={{
            holiday:
              "[&>button]:border-sky-400/30 [&>button]:bg-sky-400/[0.07]",
            approved:
              "[&>button]:border-emerald-400/30 [&>button]:bg-emerald-400/[0.06]",
            pending:
              "[&>button]:border-amber-400/30 [&>button]:bg-amber-400/[0.06]",
          }}
          classNames={calendarClassNames}
          locale={es}
          showOutsideDays
          fixedWeeks
        />
      ) : (
        <DayPicker
          mode="multiple"
          selected={orderedSelectedDates}
          onSelect={updateDiscreteDates}
          max={maxSelectedDates}
          disabled={disabled}
          modifiers={modifiers}
          modifiersClassNames={{
            holiday:
              "[&>button]:border-sky-400/30 [&>button]:bg-sky-400/[0.07]",
            approved:
              "[&>button]:border-emerald-400/30 [&>button]:bg-emerald-400/[0.06]",
            pending:
              "[&>button]:border-amber-400/30 [&>button]:bg-amber-400/[0.06]",
          }}
          classNames={calendarClassNames}
          locale={es}
          showOutsideDays
          fixedWeeks
        />
      )}

      {isDiscrete && orderedSelectedDates.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-lll-border pt-3">
          {orderedSelectedDates.slice(0, 6).map((date) => (
            <button
              type="button"
              key={toISO(date)}
              onClick={() =>
                updateDiscreteDates(
                  orderedSelectedDates.filter(
                    (selectedDate) => toISO(selectedDate) !== toISO(date)
                  )
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-lll-accent-alt/25 bg-lll-accent-alt/10 px-2.5 py-1 text-[10px] font-medium text-lll-text transition hover:border-red-400/30 hover:bg-red-500/10"
              title="Quitar día"
            >
              {format(date, "EEE d MMM", { locale: es })}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          {orderedSelectedDates.length > 6 ? (
            <span className="rounded-full border border-lll-border bg-lll-bg-softer px-2.5 py-1 text-[10px] text-lll-text-soft">
              +{orderedSelectedDates.length - 6} más
            </span>
          ) : null}
        </div>
      ) : null}

      {hasHolidaySelected || hasBlockedSelected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {hasHolidaySelected ? (
            <span className="rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-2.5 py-1 text-[10px] text-sky-200">
              Incluye feriado
            </span>
          ) : null}
          {hasBlockedSelected ? (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] text-amber-200">
              Se solapa con una solicitud
            </span>
          ) : null}
        </div>
      ) : null}

      {showLegend ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 border-t border-lll-border pt-3 text-[10px] text-lll-text-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Aprobado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Pendiente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Feriado
          </span>
        </div>
      ) : null}
    </div>
  );
}
