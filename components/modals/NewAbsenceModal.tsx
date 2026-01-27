"use client";

import { useEffect, useMemo, useState } from "react";
import { ABSENCE_TYPES, AbsenceTypeId, getAbsenceType } from "@/lib/absenceTypes";

import { countChargeableDays } from "@/lib/vacations/dateCount";
import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";

export type NewAbsencePayload = {
  from: string;
  to: string;
  type: AbsenceTypeId;
  note?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewAbsencePayload) => void;
  initial?: Partial<NewAbsencePayload>;
  submitLabel?: string;
  title?: string;
  subtitle?: string;

  /** Días disponibles (vacaciones) calculados en dashboard */
  vacationAvailable?: number;
};

export default function NewAbsenceModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitLabel = "Enviar",
  title = "Nueva solicitud",
  subtitle = "MVP visual. Luego lo conectamos al backend.",
  vacationAvailable,
}: Props) {
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [type, setType] = useState<AbsenceTypeId>(initial?.type ?? "vacaciones");
  const [note, setNote] = useState(initial?.note ?? "");

  const typeDef = useMemo(() => getAbsenceType(type), [type]);
  const isVacation = type === "vacaciones";

  const dateRangeOk = useMemo(() => {
    if (!from || !to) return false;
    return to >= from; // YYYY-MM-DD compara bien
  }, [from, to]);

  const requestedDays = useMemo(() => {
    if (!dateRangeOk) return 0;

    // Por ahora solo contamos “consumo” para vacaciones.
    // Si más adelante HO también consume, lo cambiás acá.
    if (!isVacation) return 0;

    return countChargeableDays(from, to, DEFAULT_VACATION_SETTINGS.countMode);
  }, [from, to, dateRangeOk, isVacation]);

  const hasBalanceInfo = typeof vacationAvailable === "number";

  const exceedsAvailable = useMemo(() => {
    if (!isVacation) return false;
    if (!hasBalanceInfo) return false; // si no viene el dato, no bloqueamos
    return requestedDays > (vacationAvailable ?? 0);
  }, [isVacation, hasBalanceInfo, requestedDays, vacationAvailable]);

  const canSubmit = useMemo(() => {
    if (!dateRangeOk) return false;

    // Si el tipo requiere aprobación, igual “puede enviar”.
    // La validación de balance solo aplica a vacaciones.
    if (exceedsAvailable) return false;

    return true;
  }, [dateRangeOk, exceedsAvailable]);

  // Resetear valores cada vez que se ABRE el modal (o cambia initial mientras está abierto)
  useEffect(() => {
    if (!open) return;

    setFrom(initial?.from ?? "");
    setTo(initial?.to ?? "");
    setType(initial?.type ?? "vacaciones");
    setNote(initial?.note ?? "");
  }, [open, initial?.from, initial?.to, initial?.type, initial?.note]);

  // Cerrar con Escape (solo cuando está abierto)
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleSubmit() {
    if (!canSubmit) return;

    onSubmit({
      from,
      to,
      type,
      note: note.trim() ? note.trim() : undefined,
    });

    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay: click para cerrar */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-lll-border bg-lll-bg-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-lll-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-[12px] text-lll-text-soft">{subtitle}</p>
          </div>

          <button
            className="w-9 h-9 rounded-full bg-lll-bg-softer border border-lll-border"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-lll-text-soft">Desde</label>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Hasta</label>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-lll-text-soft">Tipo</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
              value={type}
              onChange={(e) => setType(e.target.value as AbsenceTypeId)}
            >
              {ABSENCE_TYPES.filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Info dinámica (solo vacaciones) */}
          {isVacation && dateRangeOk && (
            <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lll-text-soft">Solicitado</span>
                <span className="font-semibold">{requestedDays} día(s)</span>
              </div>

              {hasBalanceInfo && (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-lll-text-soft">Disponibles</span>
                  <span className="font-semibold">{vacationAvailable}</span>
                </div>
              )}

              {exceedsAvailable && (
                <p className="mt-2 text-[12px] text-red-300">
                  Te faltan {requestedDays - (vacationAvailable ?? 0)} día(s) para cubrir esta solicitud.
                </p>
              )}

              <p className="mt-2 text-[12px] text-lll-text-soft">
                Conteo:{" "}
                {DEFAULT_VACATION_SETTINGS.countMode === "business_days"
                  ? "Lun–Vie (no descuenta sáb/dom)"
                  : "Calendario (incluye sáb/dom)"}
              </p>
            </div>
          )}

          <div>
            <label className="text-[12px] text-lll-text-soft">Comentario</label>
            <textarea
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none min-h-[90px]"
              placeholder="Opcional..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text"
              type="button"
            >
              Cancelar
            </button>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-lg font-semibold ${
                canSubmit
                  ? "bg-lll-accent text-black"
                  : "bg-lll-bg-softer text-lll-text-soft border border-lll-border cursor-not-allowed"
              }`}
              type="button"
            >
              {submitLabel}
            </button>
          </div>

          {/* Nota opcional: mostrar si el tipo no requiere approval */}
          {typeDef && typeDef.requiresApproval === false && (
            <p className="text-[12px] text-lll-text-soft">
              Este tipo no requiere aprobación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
