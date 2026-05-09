"use client";

import React, { useEffect, useMemo, useState } from "react";
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

import { DEFAULT_VACATION_SETTINGS } from "@/lib/vacations/settings";
import { findOverlappingAbsence } from "@/lib/absences/overlap";

import DateRangePickerLLL, { type BlockedRange } from "@/components/ui/DateRangePickerLLL";
import { countChargeableDays } from "@/lib/vacations/dateCount";
import { listActiveOwners, type OwnerOption } from "@/lib/supabase/owners";

export type NewAbsencePayload = {
  from: string;
  to: string;
  type: AbsenceTypeId;
  note?: string;

  subtype?: LicenseSubtype | null;
  hours?: number | null;
  notifyOwnerIds?: string[];
};

type Usage = { used: number; unit: PolicyUnit };

export type VacationInfo = {
  // compat: mantenemos nombres, pero ahora:
  // entitlement = acumulado total
  // usedThisYear = usado total
  entitlement: number;
  carryover: number;
  usedThisYear: number;
  available: number;

  accrued: number; // acumulado total (ganado)
  used: number; // pasado aprobado
  reserved: number; // futuro/en curso aprobado
  pending: number; // futuro/en curso pendiente
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewAbsencePayload) => void | Promise<void>;

  initial?: Partial<NewAbsencePayload>;
  submitLabel?: string;
  title?: string;
  subtitle?: string;

  vacationAvailable?: number;
  vacationInfo?: VacationInfo | null;
  usageByKey?: Map<BalanceKey, Usage>;

  existingAbsences?: Array<{
    id: string;
    status: "pendiente" | "aprobado" | "rechazado";
    from: string;
    to: string;
  }>;

  ignoreAbsenceId?: string | null;
  holidaysISO?: Set<string>;

  /** ✅ fecha de ingreso ISO YYYY-MM-DD (para antigüedad y otorgado anual) */
  startDateISO?: string | null;

  /** ✅ fecha simulada para testear políticas (YYYY-MM-DD) */
  asOfISO?: string | null;
};

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

function StatBar({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-blue-500/90 text-white px-4 py-3 text-[13px] leading-5">
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

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "warn";
}) {
  const cls =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-lll-border bg-lll-bg-softer text-lll-text-soft";

  return <div className={`rounded-xl border px-3 py-2 text-[13px] ${cls}`}>{children}</div>;
}

function fmt2(n: number) {
  const s = n.toFixed(2);
  return s.endsWith(".00") ? String(Math.round(n)) : s;
}

function parseISODate(iso?: string | null) {
  if (!iso) return null;
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function parseAsOfDate(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  // ✅ forzar local (no UTC) para que no “corran” los días por timezone
  return new Date(y, m - 1, d);
}

function diffYM(fromISO?: string | null, to = new Date()) {
  const from = parseISODate(fromISO);
  if (!from) return null;

  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();

  if (to.getDate() < from.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };

  return { years, months };
}

// ✅ “otorgado anual” según antigüedad (ajustalo a tu esquema real si cambia)
function annualEntitlementByYears(years: number) {
  // ejemplo típico (modificá si tu org_settings es distinto)
  if (years >= 20) return 35;
  if (years >= 10) return 28;
  if (years >= 5) return 21;
  return 14;
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
  holidaysISO,
  startDateISO,
  asOfISO,
}: Props) {
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [type, setType] = useState<AbsenceTypeId>((initial?.type as AbsenceTypeId) ?? "vacaciones");
  const [note, setNote] = useState(initial?.note ?? "");

  const [subtype, setSubtype] = useState<LicenseSubtype | "">(
    (initial?.subtype as LicenseSubtype | null | undefined) ?? ""
  );

  const [hours, setHours] = useState<string>(
    initial?.hours != null && Number.isFinite(Number(initial?.hours)) ? String(initial?.hours) : ""
  );

  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>(initial?.notifyOwnerIds ?? []);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownersLoadError, setOwnersLoadError] = useState(false);

  const typeDef = useMemo(() => getAbsenceType(type), [type]);
  const isVacation = type === "vacaciones";
  const isLicense = type === "licencia";
  const showNotificationSelector = !ignoreAbsenceId;

  const policy = useMemo(() => {
    if (isLicense) {
      if (!subtype) return null;
      return getPolicySafe({ type: "licencia" as any, subtype: subtype as any });
    }
    return getPolicySafe({ type: type as any, subtype: null });
  }, [type, isLicense, subtype]);

  const isHourUnit = policy?.unit === "hour";

  const blockedRanges: BlockedRange[] = useMemo(() => {
    return (existingAbsences ?? [])
      .filter((a) => a.status === "pendiente" || a.status === "aprobado")
      .filter((a) => (ignoreAbsenceId ? a.id !== ignoreAbsenceId : true))
      .map((a) => ({
        from: new Date(a.from + "T00:00:00"),
        to: new Date(a.to + "T00:00:00"),
        status: a.status,
      }));
  }, [existingAbsences, ignoreAbsenceId]);

  const dateRangeOk = useMemo(() => {
    if (!from) return false;
    if (isHourUnit) return true;
    if (!to) return false;
    return to >= from;
  }, [from, to, isHourUnit]);

  useEffect(() => {
    if (!open) return;
    if (!isHourUnit) return;
    if (!from) return;
    if (to !== from) setTo(from);
  }, [open, isHourUnit, from, to]);

  const overlapAbsence = useMemo(() => {
    if (!existingAbsences?.length) return null;
    if (!from) return null;

    const rangeFrom = from;
    const rangeTo = isHourUnit ? from : to;

    if (!rangeTo) return null;
    if (rangeTo < rangeFrom) return null;

    return findOverlappingAbsence(existingAbsences, rangeFrom, rangeTo, {
      ignoreId: ignoreAbsenceId ?? undefined,
      statuses: ["pendiente", "aprobado"],
    });
  }, [existingAbsences, from, to, isHourUnit, ignoreAbsenceId]);

  const overlapErrorMsg = useMemo(() => {
    if (!overlapAbsence) return "";
    const estado = overlapAbsence.status === "aprobado" ? "aprobada" : "pendiente";
    return `Ese rango se solapa con una ausencia ${estado} (${overlapAbsence.from} → ${overlapAbsence.to}). Elegí otras fechas.`;
  }, [overlapAbsence]);

  const usage = useMemo(() => {
    if (!policy?.deducts || !policy.deductsFrom) return null;

    const used = usageByKey?.get(policy.deductsFrom)?.used ?? 0;
    const allowance = policy.allowance;
    const available = allowance == null ? null : Math.max(0, allowance - used);

    return { balanceKey: policy.deductsFrom, unit: policy.unit, allowance, used, available };
  }, [policy, usageByKey]);

  const exceedsPolicyAvailable = useMemo(() => {
    if (!usage || usage.allowance == null || usage.available == null) return false;

    if (usage.unit === "hour") {
      const h = Number(hours);
      if (!Number.isFinite(h) || h <= 0) return false;
      return h > usage.available;
    }

    if (!from || !to || to < from) return false;
    const days =
      policy?.type === "home_office"
        ? countChargeableDays(from, to, "business_days", holidaysISO)
        : (() => {
            const s = new Date(from + "T00:00:00");
            const e = new Date(to + "T00:00:00");
            return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
          })();
    return days > usage.available;
  }, [usage, policy?.type, from, to, hours, holidaysISO]);

  const requestedDays = useMemo(() => {
    if (!dateRangeOk) return 0;
    if (!isVacation) return 0;
    if (!from || !to) return 0;

    return countChargeableDays(from, to, DEFAULT_VACATION_SETTINGS.countMode, holidaysISO);
  }, [from, to, dateRangeOk, isVacation, holidaysISO]);

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

  const notificationRecipientsOk = useMemo(() => {
    if (!showNotificationSelector) return true;
    if (ownersLoading || ownersLoadError) return false;
    return selectedOwnerIds.length > 0;
  }, [showNotificationSelector, ownersLoading, ownersLoadError, selectedOwnerIds.length]);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!dateRangeOk) return false;
    if (overlapAbsence) return false;
    if (isVacation && exceedsAvailable) return false;
    if (!licenseSubtypeOk) return false;
    if (!hoursOk) return false;
    if (!isVacation && exceedsPolicyAvailable) return false;
    if (!notificationRecipientsOk) return false;
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
    notificationRecipientsOk,
  ]);

  useEffect(() => {
    if (!open) return;

    setFrom(initial?.from ?? "");
    setTo(initial?.to ?? "");
    setType((initial?.type as AbsenceTypeId) ?? "vacaciones");
    setNote(initial?.note ?? "");
    setSubtype((initial?.subtype as LicenseSubtype | null | undefined) ?? "");
    setHours(initial?.hours != null && Number.isFinite(Number(initial?.hours)) ? String(initial?.hours) : "");
    setSelectedOwnerIds(initial?.notifyOwnerIds ?? []);

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
    initial?.notifyOwnerIds,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!showNotificationSelector) return;

    let alive = true;
    setOwnersLoading(true);
    setOwnersLoadError(false);

    listActiveOwners()
      .then((owners) => {
        if (alive) setOwnerOptions(owners);
      })
      .catch((err) => {
        console.warn("listActiveOwners warning", err);
        if (alive) {
          setOwnerOptions([]);
          setOwnersLoadError(true);
        }
      })
      .finally(() => {
        if (alive) setOwnersLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, showNotificationSelector]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // ✅ ahora la antigüedad/otorgado se calcula con “asOf” si existe
  const nowForPolicy = useMemo(() => {
    return parseAsOfDate(asOfISO) ?? new Date();
  }, [asOfISO]);

  const tenure = useMemo(() => diffYM(startDateISO ?? null, nowForPolicy), [startDateISO, nowForPolicy]);

  const annualEntitlement = useMemo(() => {
    if (!tenure) return null;
    return annualEntitlementByYears(tenure.years);
  }, [tenure]);

  function toggleOwner(ownerId: string) {
    setSelectedOwnerIds((current) =>
      current.includes(ownerId) ? current.filter((id) => id !== ownerId) : [...current, ownerId]
    );
  }

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
      notifyOwnerIds: selectedOwnerIds,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setSubmitError(prettySupabaseError(err));
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div
        className="relative my-4 flex w-full max-w-4xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-b border-lll-border flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-6">{title}</p>
            <p className="mt-0.5 text-[13px] text-lll-text-soft">{subtitle}</p>

            <div className="mt-3 space-y-2">
              {submitError ? <Pill tone="danger">{submitError}</Pill> : null}
              {!submitError && overlapErrorMsg ? <Pill tone="warn">{overlapErrorMsg}</Pill> : null}
            </div>

            {/* ✅ indicator opcional de simulación */}
            {asOfISO ? (
              <div className="mt-2">
                <Pill tone="warn">
                  Modo test: simulando fecha <span className="font-semibold">{asOfISO}</span>
                </Pill>
              </div>
            ) : null}
          </div>

          <button
            className="w-10 h-10 shrink-0 rounded-full bg-lll-bg-softer border border-lll-border text-lll-text"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4">
            {isVacation ? (
              vacationInfo ? (
                <StatBar
                  left={
                    <>
                      {tenure ? (
                        <>
                          <span>
                            Antigüedad: {tenure.years}a {tenure.months}m
                          </span>
                        </>
                      ) : null}

                      {annualEntitlement != null ? (
                        <>
                          <Sep />
                          <span>Otorgado anual: {annualEntitlement} d</span>
                        </>
                      ) : null}

                      <Sep />
                      <span className="font-semibold">Saldo : {vacationInfo.available} d</span>
                      <Sep />
                      <span>Usado: {fmt2(vacationInfo.used)} d</span>
                      <Sep />
                      <span>Reservado: {fmt2(vacationInfo.reserved)} d</span>
                      <Sep />
                      <span>Pendiente: {fmt2(vacationInfo.pending)} d</span>
                    </>
                  }
                  right={<span className="text-white/90">Acumulativo · sin vencimiento</span>}
                />
              ) : vacationAvail != null ? (
                <StatBar
                  left={
                    <>
                      <span className="font-semibold">Disponible: {fmt2(vacationAvail)} d</span>

                      {tenure ? (
                        <>
                          <Sep />
                          <span>
                            Antigüedad: {tenure.years}a {tenure.months}m
                          </span>
                        </>
                      ) : null}

                      {annualEntitlement != null ? (
                        <>
                          <Sep />
                          <span>Otorgado anual: {annualEntitlement} d</span>
                        </>
                      ) : null}

                      <Sep />
                      <span className="text-white/90">Cargando detalle…</span>
                    </>
                  }
                />
              ) : null
            ) : null}

            {!isVacation && usage && usage.allowance != null ? (
              <div className="mt-3">
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
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
                <label className="text-[12px] text-lll-text-soft">Tipo</label>
                <select
                  className="mt-2 w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none"
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

                {isLicense ? (
                  <div className="mt-4">
                    <label className="text-[12px] text-lll-text-soft">Subtipo</label>
                    <select
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none"
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

                    {!licenseSubtypeOk ? (
                      <p className="mt-2 text-[12px] text-red-300">Elegí un subtipo para continuar.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
                {isHourUnit ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] text-lll-text-soft">Fecha</label>
                      <input
                        className="mt-2 w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none"
                        type="date"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setSubmitError("");
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[12px] text-lll-text-soft">Horas</label>
                      <input
                        className="mt-2 w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none"
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
                        <p className="mt-2 text-[12px] text-red-300">Ingresá horas válidas (mayor a 0).</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mt-2">
                      <DateRangePickerLLL
                        holidaysISO={holidaysISO}
                        blockedRanges={blockedRanges}
                        value={{
                          from: from ? new Date(from + "T00:00:00") : undefined,
                          to: to ? new Date(to + "T00:00:00") : undefined,
                        }}
                        onChange={(next) => {
                          const f = next.from ? next.from.toISOString().slice(0, 10) : "";
                          const t = next.to ? next.to.toISOString().slice(0, 10) : "";
                          setFrom(f);
                          setTo(t);
                          setSubmitError("");
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
                <label className="text-[12px] text-lll-text-soft">Comentario</label>
                <textarea
                  className="mt-2 w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none min-h-[120px] lg:min-h-[160px] xl:min-h-[220px] resize-y"
                  placeholder="Opcional..."
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setSubmitError("");
                  }}
                />
                <p className="mt-2 text-[12px] text-lll-text-soft">Tip: agregá contexto si necesitás aprobación rápida.</p>
              </div>

              {showNotificationSelector ? (
              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[12px] text-lll-text-soft">Notificar a</label>
                  {selectedOwnerIds.length > 0 ? (
                    <button
                      type="button"
                      className="text-[12px] text-lll-text-soft hover:text-lll-text"
                      onClick={() => setSelectedOwnerIds([])}
                      disabled={isSubmitting}
                    >
                      Todos
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {ownersLoading ? (
                    <span className="text-[12px] text-lll-text-soft">Cargando...</span>
                  ) : ownersLoadError ? (
                    <span className="text-[12px] text-amber-300">No se pudieron cargar owners.</span>
                  ) : ownerOptions.length === 0 ? (
                    <span className="text-[12px] text-lll-text-soft">Todos los owners activos</span>
                  ) : (
                    ownerOptions.map((owner) => {
                      const selected = selectedOwnerIds.includes(owner.id);
                      const label = owner.fullName || owner.email || "Owner";

                      return (
                        <button
                          key={owner.id}
                          type="button"
                          onClick={() => toggleOwner(owner.id)}
                          disabled={isSubmitting}
                          className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                            selected
                              ? "border-lll-accent bg-lll-accent text-black"
                              : "border-lll-border bg-lll-bg-soft text-lll-text-soft hover:text-lll-text"
                          }`}
                          title={owner.email ?? label}
                        >
                          {label}
                        </button>
                      );
                    })
                  )}
                </div>

                <p className="mt-2 text-[12px] text-lll-text-soft">
                  {ownersLoadError
                    ? "No se puede enviar hasta cargar owners"
                    : selectedOwnerIds.length > 0
                    ? `${selectedOwnerIds.length} owner(s) seleccionado(s)`
                    : "Selecciona al menos un owner para enviar"}
                </p>
              </div>
              ) : null}

              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-[12px] text-lll-text-soft">
                  {typeDef && typeDef.requiresApproval === false ? "Este tipo no requiere aprobación." : " "}
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-soft text-lll-text"
                    type="button"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full sm:w-auto px-4 py-2 rounded-lg font-semibold ${
                      canSubmit
                        ? "bg-lll-accent text-black"
                        : "bg-lll-bg-soft text-lll-text-soft border border-lll-border cursor-not-allowed"
                    }`}
                    type="button"
                  >
                    {isSubmitting ? "Enviando..." : submitLabel}
                  </button>
                </div>
              </div>

              {isVacation && dateRangeOk ? (
                <div className="rounded-xl border border-lll-border bg-lll-bg-soft p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lll-text-soft">Solicitado</span>
                    <span className="font-semibold">{fmt2(requestedDays)} día(s)</span>
                  </div>

                  {vacationAvail != null ? (
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-lll-text-soft">Disponible después</span>
                      <span className="font-semibold">{fmt2(Math.max(0, vacationAvail - requestedDays))}</span>
                    </div>
                  ) : null}

                  {exceedsAvailable ? (
                    <p className="mt-2 text-[12px] text-red-300">
                      Te faltan {fmt2(requestedDays - (vacationAvail ?? 0))} día(s) para cubrir esta solicitud.
                    </p>
                  ) : null}

                  <p className="mt-2 text-[12px] text-lll-text-soft">
                    Conteo:{" "}
                    {DEFAULT_VACATION_SETTINGS.countMode === "business_days"
                      ? "Lun–Vie (no descuenta sáb/dom ni feriados)"
                      : "Calendario (incluye sáb/dom y feriados)"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
