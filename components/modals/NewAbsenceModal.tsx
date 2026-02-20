"use client";

import { useEffect, useMemo, useState } from "react";
import { prettySupabaseError } from "@/lib/supabase/errors";

import {
  ABSENCE_TYPES,
  type AbsenceTypeId,
  getAbsenceType,
  getLicenseSubtypeLabel,
} from "@/lib/absenceTypes";

import {
  getPolicySafe,
  type LicenseSubtype,
  type BalanceKey,
  type PolicyUnit,
} from "@/lib/absencePolicies";

import { countChargeableDays } from "@/lib/vacations/dateCount";
import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";

import { findOverlappingAbsence, type AbsenceLike } from "@/lib/absences/overlap";

export type NewAbsencePayload = {
  from: string;
  to: string;
  type: AbsenceTypeId;
  note?: string;

  subtype?: LicenseSubtype | null;
  hours?: number | null;
};

type Usage = { used: number; unit: PolicyUnit };

export type VacationInfo = {
  entitlement: number; // cupo anual (bucket actual)
  carryover: number;   // acumulado (remanente buckets anteriores vivos)
  usedThisYear: number;// usado (ventana 3 años / fifo)
  available: number;   // disponible (ventana 3 años / fifo)
};

type Props = {
  open: boolean;
  onClose: () => void;

  /**
   * onSubmit debería lanzar (throw) si falla.
   * Ej: si Supabase devuelve error, throw error.
   */
  onSubmit: (payload: NewAbsencePayload) => void | Promise<void>;

  initial?: Partial<NewAbsencePayload>;
  submitLabel?: string;
  title?: string;
  subtitle?: string;

  /** Backward compat: si solo pasás available, sigue andando */
  vacationAvailable?: number;

  /** ✅ Recomendado: info completa (cupo/acum/usado/disponible) */
  vacationInfo?: VacationInfo | null;

  /** MVP: usado por balanceKey calculado desde ausencias aprobadas */
  usageByKey?: Map<BalanceKey, Usage>;

  /** ✅ NUEVO: para bloquear solapamientos en UI */
  existingAbsences?: AbsenceLike[]; // típicamente tus myAbsences mapeadas
  ignoreAbsenceId?: string;         // cuando editás
};

// ✅ Tipamos la lista con el LicenseSubtype REAL (importado)
const LICENSE_SUBTYPES: readonly LicenseSubtype[] = [
  "TURNO_MEDICO",
  "CUMPLEANIOS_LIBRE",
  "TRAMITE_PERSONAL",
  "ATENCION_GRUPO_FAMILIAR",
  "MUDANZA",
  "RAZONES_PARTICULARES_LCT",
  "EXAMEN",
  "PATERNIDAD",
  "MATERNIDAD",
  "FALLECIMIENTO_CONYUGE_HIJO_PADRES",
  "FALLECIMIENTO_HERMANO",
];

function StatBar({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-blue-500/90 text-white px-4 py-3 text-[13px] leading-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{left}</div>
        {right ? <div className="text-white/90">{right}</div> : null}
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1.5 text-white/70">|</span>;
}

export default function NewAbsenceModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitLabel = "Enviar",
  title = "Nueva solicitud",
  subtitle = "Completá los datos y enviá la solicitud.",
  vacationAvailable,
  vacationInfo,
  usageByKey,
  existingAbsences,
  ignoreAbsenceId,
}: Props) {
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [type, setType] = useState<AbsenceTypeId>(
    (initial?.type as AbsenceTypeId) ?? "vacaciones"
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const [subtype, setSubtype] = useState<LicenseSubtype | "">(
    (initial?.subtype as LicenseSubtype | null | undefined) ?? ""
  );

  const [hours, setHours] = useState<string>(
    initial?.hours != null && Number.isFinite(Number(initial?.hours))
      ? String(initial?.hours)
      : ""
  );

  // ✅ Error visible y estado de envío
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeDef = useMemo(() => getAbsenceType(type), [type]);
  const isVacation = type === "vacaciones";
  const isLicense = type === "licencia";

  const policy = useMemo(() => {
    if (isLicense) {
      if (!subtype) return null;
      return getPolicySafe({ type: "licencia" as any, subtype: subtype as any });
    }
    return getPolicySafe({ type: type as any, subtype: null });
  }, [type, isLicense, subtype]);

  const isHourUnit = policy?.unit === "hour";

  const dateRangeOk = useMemo(() => {
    if (!from) return false;
    if (isHourUnit) return true;
    if (!to) return false;
    return to >= from;
  }, [from, to, isHourUnit]);

  // Si es por horas, to = from
  useEffect(() => {
    if (!open) return;
    if (!isHourUnit) return;
    if (!from) return;
    if (to !== from) setTo(from);
  }, [open, isHourUnit, from, to]);

  // ✅ NUEVO: detectar solapamiento (solo para rangos válidos)
  const overlapAbsence = useMemo(() => {
    if (!existingAbsences?.length) return null;
    if (!from) return null;

    // rango efectivo
    const rangeFrom = from;
    const rangeTo = isHourUnit ? from : to;

    if (!rangeTo) return null;
    if (rangeTo < rangeFrom) return null;

    return findOverlappingAbsence(existingAbsences, rangeFrom, rangeTo, {
      ignoreId: ignoreAbsenceId,
      statuses: ["pendiente", "aprobado"], // ✅ solo estas bloquean
    });
  }, [existingAbsences, from, to, isHourUnit, ignoreAbsenceId]);

  const overlapErrorMsg = useMemo(() => {
    if (!overlapAbsence) return "";
    const estado = overlapAbsence.status === "aprobado" ? "aprobada" : "pendiente";
    return `Ese rango se solapa con una ausencia ${estado} (${overlapAbsence.from} → ${overlapAbsence.to}). Elegí otras fechas.`;
  }, [overlapAbsence]);

  // Uso por política (no vacaciones)
  const usage = useMemo(() => {
    if (!policy?.deducts || !policy.deductsFrom) return null;

    const used = usageByKey?.get(policy.deductsFrom)?.used ?? 0;
    const allowance = policy.allowance;
    const available = allowance == null ? null : Math.max(0, allowance - used);

    return {
      balanceKey: policy.deductsFrom,
      unit: policy.unit,
      allowance,
      used,
      available,
    };
  }, [policy, usageByKey]);

  const exceedsPolicyAvailable = useMemo(() => {
    if (!usage || usage.allowance == null || usage.available == null) return false;

    if (usage.unit === "hour") {
      const h = Number(hours);
      if (!Number.isFinite(h) || h <= 0) return false;
      return h > usage.available;
    }

    if (!from || !to || to < from) return false;

    // Para políticas por días: diferencia calendario
    const s = new Date(from + "T00:00:00");
    const e = new Date(to + "T00:00:00");
    const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
    return days > usage.available;
  }, [usage, from, to, hours]);

  const requestedDays = useMemo(() => {
    if (!dateRangeOk) return 0;
    if (!isVacation) return 0;
    if (!from || !to) return 0;
    return countChargeableDays(from, to, DEFAULT_VACATION_SETTINGS.countMode);
  }, [from, to, dateRangeOk, isVacation]);

  const vacationAvail = useMemo(() => {
    if (typeof vacationInfo?.available === "number") return vacationInfo.available;
    if (typeof vacationAvailable === "number") return vacationAvailable;
    return null;
  }, [vacationInfo, vacationAvailable]);

  const exceedsAvailable = useMemo(() => {
    if (!isVacation) return false;
    if (vacationAvail == null) return false;
    return requestedDays > vacationAvail;
  }, [isVacation, requestedDays, vacationAvail]);

  const hoursOk = useMemo(() => {
    if (!isHourUnit) return true;
    const h = Number(hours);
    return Number.isFinite(h) && h > 0;
  }, [isHourUnit, hours]);

  const licenseSubtypeOk = useMemo(() => {
    if (!isLicense) return true;
    return Boolean(subtype);
  }, [isLicense, subtype]);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false; // ✅ no doble submit
    if (!dateRangeOk) return false;
    if (overlapAbsence) return false; // ✅ BLOQUEO POR SOLAPAMIENTO
    if (isVacation && exceedsAvailable) return false;
    if (!licenseSubtypeOk) return false;
    if (!hoursOk) return false;
    if (!isVacation && exceedsPolicyAvailable) return false;
    return true;
  }, [
    isSubmitting,
    dateRangeOk,
    overlapAbsence,
    isVacation,
    exceedsAvailable,
    licenseSubtypeOk,
    hoursOk,
    exceedsPolicyAvailable,
  ]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;

    setFrom(initial?.from ?? "");
    setTo(initial?.to ?? "");
    setType((initial?.type as AbsenceTypeId) ?? "vacaciones");
    setNote(initial?.note ?? "");

    setSubtype((initial?.subtype as LicenseSubtype | null | undefined) ?? "");
    setHours(
      initial?.hours != null && Number.isFinite(Number(initial?.hours))
        ? String(initial?.hours)
        : ""
    );

    // ✅ limpia error al abrir
    setSubmitError("");
    setIsSubmitting(false);
  }, [
    open,
    initial?.from,
    initial?.to,
    initial?.type,
    initial?.note,
    initial?.subtype,
    initial?.hours,
  ]);

  // ESC
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitError("");
    setIsSubmitting(true);

    const payload: NewAbsencePayload = {
      from,
      to: isHourUnit ? from : to,
      type,
      note: note.trim() ? note.trim() : undefined,
      subtype: isLicense ? (subtype ? subtype : null) : null,
      hours: isHourUnit ? Number(hours) : null,
    };

    try {
      await onSubmit(payload);
      onClose(); // ✅ solo cierra si fue OK
    } catch (err: any) {
      setSubmitError(prettySupabaseError(err));
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
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
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* ✅ Error global */}
          {submitError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
              {submitError}
            </div>
          ) : null}

          {/* ✅ Error preventivo de solapamiento */}
          {!submitError && overlapErrorMsg ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
              {overlapErrorMsg}
            </div>
          ) : null}

          {/* Tipo */}
          <div>
            <label className="text-[12px] text-lll-text-soft">Tipo</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
              value={type}
              onChange={(e) => {
                const next = e.target.value as AbsenceTypeId;
                setType(next);
                setSubmitError("");

                if (next !== "licencia") {
                  setSubtype("");
                  setHours("");
                }
              }}
            >
              {ABSENCE_TYPES.filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subtipo */}
          {isLicense && (
            <div>
              <label className="text-[12px] text-lll-text-soft">Subtipo</label>
              <select
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                value={subtype}
                onChange={(e) => {
                  setSubtype(e.target.value as any);
                  setHours("");
                  setSubmitError("");
                }}
              >
                <option value="">Seleccionar…</option>
                {LICENSE_SUBTYPES.map((s) => (
                  <option key={s} value={s}>
                    {getLicenseSubtypeLabel(s as any)}
                  </option>
                ))}
              </select>

              {!licenseSubtypeOk && (
                <p className="mt-1 text-[12px] text-red-300">Elegí un subtipo para continuar.</p>
              )}
            </div>
          )}

          {/* ✅ Barra Vacaciones */}
          {isVacation ? (
            vacationInfo ? (
              <StatBar
                left={
                  <>
                    <span className="font-semibold">Cupo: {vacationInfo.entitlement} d</span>
                    <Sep />
                    <span>Acum: {vacationInfo.carryover} d</span>
                    <Sep />
                    <span>Usado: {vacationInfo.usedThisYear} d</span>
                    <Sep />
                    <span className="font-semibold">Disponible: {vacationInfo.available} d</span>
                  </>
                }
                right={<span className="text-white/90">Ventana 3 años · FIFO</span>}
              />
            ) : vacationAvail != null ? (
              <StatBar
                left={
                  <>
                    <span className="font-semibold">Disponible: {vacationAvail} d</span>
                    <Sep />
                    <span className="text-white/90">Cargando detalle de cupo/acum…</span>
                  </>
                }
              />
            ) : null
          ) : null}

          {/* ✅ Barra Políticas (no vacaciones) */}
          {!isVacation && usage && usage.allowance != null ? (
            <StatBar
              left={
                <>
                  <span className="font-semibold">
                    Por política: {usage.allowance} {usage.unit === "hour" ? "horas" : "días"}
                  </span>
                  <Sep />
                  <span>
                    Disponible: {usage.available} {usage.unit === "hour" ? "h" : "d"}
                  </span>
                  <Sep />
                  <span>
                    Usado: {usage.used} {usage.unit === "hour" ? "h" : "d"}
                  </span>
                </>
              }
              right={exceedsPolicyAvailable ? <span className="text-white/90">Te pasás del disponible</span> : null}
            />
          ) : null}

          {/* Fechas / Horas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-lll-text-soft">{isHourUnit ? "Fecha" : "Desde"}</label>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setSubmitError("");
                }}
              />
            </div>

            {isHourUnit ? (
              <div>
                <label className="text-[12px] text-lll-text-soft">Horas</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                  type="number"
                  min={0}
                  step={0.5}
                  value={hours}
                  onChange={(e) => {
                    setHours(e.target.value);
                    setSubmitError("");
                  }}
                  placeholder="Ej: 6"
                />
                {!hoursOk ? (
                  <p className="mt-1 text-[12px] text-red-300">Ingresá horas válidas (mayor a 0).</p>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="text-[12px] text-lll-text-soft">Hasta</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setSubmitError("");
                  }}
                />
              </div>
            )}
          </div>

          {/* Info dinámica (vacaciones) */}
          {isVacation && dateRangeOk ? (
            <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lll-text-soft">Solicitado</span>
                <span className="font-semibold">{requestedDays} día(s)</span>
              </div>

              {vacationAvail != null ? (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-lll-text-soft">Disponible</span>
                  <span className="font-semibold">{vacationAvail}</span>
                </div>
              ) : null}

              {exceedsAvailable ? (
                <p className="mt-2 text-[12px] text-red-300">
                  Te faltan {requestedDays - (vacationAvail ?? 0)} día(s) para cubrir esta solicitud.
                </p>
              ) : null}

              <p className="mt-2 text-[12px] text-lll-text-soft">
                Conteo:{" "}
                {DEFAULT_VACATION_SETTINGS.countMode === "business_days"
                  ? "Lun–Vie (no descuenta sáb/dom)"
                  : "Calendario (incluye sáb/dom)"}
              </p>
            </div>
          ) : null}

          {/* Comentario */}
          <div>
            <label className="text-[12px] text-lll-text-soft">Comentario</label>
            <textarea
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none min-h-[90px]"
              placeholder="Opcional..."
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setSubmitError("");
              }}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text"
              type="button"
              disabled={isSubmitting}
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
              {isSubmitting ? "Enviando..." : submitLabel}
            </button>
          </div>

          {typeDef && typeDef.requiresApproval === false ? (
            <p className="text-[12px] text-lll-text-soft">Este tipo no requiere aprobación.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}