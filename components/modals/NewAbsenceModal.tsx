"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ABSENCE_TYPES,
  type AbsenceTypeId,
  getAbsenceType,
  getLicenseSubtypeLabel,
} from "@/lib/absenceTypes";

import { getPolicySafe, type LicenseSubtype } from "@/lib/absencePolicies";

import { countChargeableDays } from "@/lib/vacations/dateCount";
import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";

import type { BalanceKey, PolicyUnit } from "@/lib/absencePolicies";

export type NewAbsencePayload = {
  from: string;
  to: string;
  type: AbsenceTypeId;
  note?: string;

  subtype?: LicenseSubtype | null;
  hours?: number | null;
};

type Usage = { used: number; unit: PolicyUnit };

type VacationInfo = {
  entitlement: number;     // cupo del año
  carryover: number;       // acumulado
  usedThisYear: number;    // usado
  available: number;       // disponible
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewAbsencePayload) => void | Promise<void>;
  initial?: Partial<NewAbsencePayload>;
  submitLabel?: string;
  title?: string;
  subtitle?: string;

  /** Backward compat: si solo pasás available, sigue andando */
  vacationAvailable?: number;

  /** ✅ Recomendado: info completa de vacaciones (computeVacationBalance) */
  vacationInfo?: VacationInfo;

  /** MVP: usado por balanceKey calculado desde ausencias aprobadas */
  usageByKey?: Map<BalanceKey, Usage>;
};

const LICENSE_SUBTYPES: LicenseSubtype[] = [
  "ATENCION_GRUPO_FAMILIAR",
  "CUMPLEANIOS_LIBRE",
  "EXAMEN",
  "FALLECIMIENTO_CONYUGE_HIJO_PADRES",
  "FALLECIMIENTO_HERMANO",
  "PATERNIDAD",
  "MATERNIDAD",
  "MUDANZA",
  "RAZONES_PARTICULARES_LCT",
  "TRAMITE_PERSONAL",
  "TURNO_MEDICO",
];

export default function NewAbsenceModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitLabel = "Enviar",
  title = "Nueva solicitud",
  subtitle = "MVP visual. Luego lo conectamos al backend.",
  vacationAvailable,
  vacationInfo,
  usageByKey,
}: Props) {
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [type, setType] = useState<AbsenceTypeId>(
    (initial?.type as AbsenceTypeId) ?? "vacaciones"
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const [subtype, setSubtype] = useState<LicenseSubtype | "">(
    (initial?.subtype as any) ?? ""
  );
  const [hours, setHours] = useState<string>(
    initial?.hours != null && Number.isFinite(Number(initial?.hours))
      ? String(initial?.hours)
      : ""
  );

  const typeDef = useMemo(() => getAbsenceType(type), [type]);
  const isVacation = type === "vacaciones";
  const isLicense = type === "licencia";

  // Policy safe
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
    if (isHourUnit) return true; // por horas: una sola fecha
    if (!to) return false;
    return to >= from;
  }, [from, to, isHourUnit]);

  // ✅ Barra NALOO (licencias / home office / cumple...) si policy deduce y tiene allowance
  const usage = useMemo(() => {
    if (!policy?.deducts || !policy.deductsFrom) return null;

    const used = usageByKey?.get(policy.deductsFrom)?.used ?? 0;
    const allowance = policy.allowance; // number | null
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

    // day (calendario inclusive)
    if (!from || !to || to < from) return false;
    const s = new Date(from + "T00:00:00");
    const e = new Date(to + "T00:00:00");
    const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
    return days > usage.available;
  }, [usage, from, to, hours]);

  // si es por horas, mantenemos to=from
  useEffect(() => {
    if (!open) return;
    if (!isHourUnit) return;
    if (!from) return;
    if (to !== from) setTo(from);
  }, [open, isHourUnit, from, to]);

  // vacaciones: conteo + balance
  const requestedDays = useMemo(() => {
    if (!dateRangeOk) return 0;
    if (!isVacation) return 0;
    if (!from || !to) return 0;
    return countChargeableDays(from, to, DEFAULT_VACATION_SETTINGS.countMode);
  }, [from, to, dateRangeOk, isVacation]);

  // Para validación de vacaciones preferimos vacationInfo.available; fallback a vacationAvailable
  const vacationAvail = vacationInfo?.available ?? vacationAvailable;
  const hasVacationAvail = typeof vacationAvail === "number";

  const exceedsAvailable = useMemo(() => {
    if (!isVacation) return false;
    if (!hasVacationAvail) return false;
    return requestedDays > (vacationAvail ?? 0);
  }, [isVacation, hasVacationAvail, requestedDays, vacationAvail]);

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
    if (!dateRangeOk) return false;
    if (exceedsAvailable) return false;
    if (!licenseSubtypeOk) return false;
    if (!hoursOk) return false;

    // Para políticas con cupo (home office / licencias por cupo), bloqueamos si excede
    if (!isVacation && exceedsPolicyAvailable) return false;

    return true;
  }, [dateRangeOk, exceedsAvailable, licenseSubtypeOk, hoursOk, exceedsPolicyAvailable, isVacation]);

  // reset al abrir
  useEffect(() => {
    if (!open) return;

    setFrom(initial?.from ?? "");
    setTo(initial?.to ?? "");
    setType((initial?.type as AbsenceTypeId) ?? "vacaciones");
    setNote(initial?.note ?? "");

    setSubtype((initial?.subtype as any) ?? "");
    setHours(
      initial?.hours != null && Number.isFinite(Number(initial?.hours))
        ? String(initial?.hours)
        : ""
    );
  }, [
    open,
    initial?.from,
    initial?.to,
    initial?.type,
    initial?.note,
    initial?.subtype,
    initial?.hours,
  ]);

  // escape
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

    const payload: NewAbsencePayload = {
      from,
      to: isHourUnit ? from : to,
      type,
      note: note.trim() ? note.trim() : undefined,
      subtype: isLicense ? ((subtype || null) as any) : null,
      hours: isHourUnit ? Number(hours) : null,
    };

    await onSubmit(payload);
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
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Tipo */}
          <div>
            <label className="text-[12px] text-lll-text-soft">Tipo</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
              value={type}
              onChange={(e) => {
                const next = e.target.value as AbsenceTypeId;
                setType(next);

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
                }}
              >
                <option value="">Seleccionar…</option>
                {LICENSE_SUBTYPES.map((s) => (
                  <option key={s} value={s}>
                    {getLicenseSubtypeLabel(s)}
                  </option>
                ))}
              </select>

              {!licenseSubtypeOk && (
                <p className="mt-1 text-[12px] text-red-300">
                  Elegí un subtipo para continuar.
                </p>
              )}
            </div>
          )}

          {/* ✅ Barra VACACIONES con computeVacationBalance (cupo/acum/usado/disponible) */}
          {isVacation && vacationInfo && (
            <div className="rounded-xl bg-blue-500/90 text-white px-4 py-3 text-sm">
              <span className="font-semibold">
                Cupo: {vacationInfo.entitlement} d
              </span>
              <span className="mx-2 opacity-80">|</span>
              <span>Acum: {vacationInfo.carryover} d</span>
              <span className="mx-2 opacity-80">|</span>
              <span>Usado: {vacationInfo.usedThisYear} d</span>
              <span className="mx-2 opacity-80">|</span>
              <span>Disponible: {vacationInfo.available} d</span>
            </div>
          )}

          {/* ✅ Barra NALOO genérica (NO vacaciones, para home office/licencias/cumple) */}
          {!isVacation && usage && usage.allowance != null && (
            <div className="rounded-xl bg-blue-500/90 text-white px-4 py-3 text-sm">
              <span className="font-semibold">
                Por política: {usage.allowance} {usage.unit === "hour" ? "horas" : "días"}
              </span>
              <span className="mx-2 opacity-80">|</span>
              <span>
                Disponible: {usage.available} {usage.unit === "hour" ? "h" : "d"}
              </span>
              <span className="mx-2 opacity-80">|</span>
              <span>
                Usado en este ciclo: {usage.used} {usage.unit === "hour" ? "h" : "d"}
              </span>

              {exceedsPolicyAvailable && (
                <p className="mt-2 text-[12px] text-white/90">
                  Te pasás del disponible para esta política.
                </p>
              )}
            </div>
          )}

          {/* Fechas / Horas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-lll-text-soft">
                {isHourUnit ? "Fecha" : "Desde"}
              </label>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
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
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="Ej: 6"
                />
                {!hoursOk && (
                  <p className="mt-1 text-[12px] text-red-300">
                    Ingresá horas válidas (mayor a 0).
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-[12px] text-lll-text-soft">Hasta</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Info dinámica (vacaciones) */}
          {isVacation && dateRangeOk && (
            <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lll-text-soft">Solicitado</span>
                <span className="font-semibold">{requestedDays} día(s)</span>
              </div>

              {hasVacationAvail && (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-lll-text-soft">Disponibles</span>
                  <span className="font-semibold">{vacationAvail}</span>
                </div>
              )}

              {exceedsAvailable && (
                <p className="mt-2 text-[12px] text-red-300">
                  Te faltan {requestedDays - (vacationAvail ?? 0)} día(s) para cubrir esta solicitud.
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

          {/* Comentario */}
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
