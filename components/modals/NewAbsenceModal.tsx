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
import { AppIcon } from "@/components/ui/AppIcon";
import { usePresence } from "@/components/ui/usePresence";
import { useBodyScrollLock } from "@/components/ui/useBodyScrollLock";
import { Skeleton } from "@/components/ui/Skeleton";
import { countChargeableDays } from "@/lib/vacations/dateCount";
import { listActiveOwners, type OwnerOption } from "@/lib/supabase/owners";

export type NewAbsencePayload = {
  from: string;
  to: string;
  /** Fechas sueltas. Cada una se crea como una solicitud independiente. */
  dates?: string[];
  type: AbsenceTypeId;
  note?: string;

  subtype?: LicenseSubtype | null;
  hours?: number | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  notifyOwnerIds?: string[];
};

type Usage = { used: number; reserved?: number; unit: PolicyUnit };

export type VacationInfo = {
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
    <div className="rounded-2xl border border-lll-accent-alt/25 bg-gradient-to-r from-lll-accent-alt/15 via-lll-bg-softer to-lll-bg-soft px-4 py-3 text-[13px] leading-5 text-lll-text shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{left}</div>
        {right ? <div className="text-lll-accent-alt">{right}</div> : null}
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1.5 text-lll-text-soft/60">|</span>;
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

function toLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value?: string | null) {
  return value?.match(/^\d{2}:\d{2}/)?.[0] ?? "";
}

function timeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
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

  const [timeFrom, setTimeFrom] = useState(normalizeTime(initial?.timeFrom));
  const [timeTo, setTimeTo] = useState(normalizeTime(initial?.timeTo));
  const [selectedDates, setSelectedDates] = useState<string[]>(
    initial?.from ? [initial.from] : []
  );
  const [vacationDateMode, setVacationDateMode] = useState<"range" | "individual">(
    "range"
  );

  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>(initial?.notifyOwnerIds ?? []);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownersLoadError, setOwnersLoadError] = useState(false);
  const modalPresence = usePresence(open);
  useBodyScrollLock(modalPresence.shouldRender);

  const typeDef = useMemo(() => getAbsenceType(type), [type]);
  const isVacation = type === "vacaciones";
  const isLicense = type === "licencia";
  const showNotificationSelector = !ignoreAbsenceId;

  const policy = useMemo(() => {
    if (isLicense) {
      if (!subtype) return null;
      return getPolicySafe({ type: "licencia", subtype });
    }
    return getPolicySafe({ type, subtype: null });
  }, [type, isLicense, subtype]);

  const isHourUnit = policy?.unit === "hour";
  const timeRange = useMemo(() => {
    const start = timeToMinutes(timeFrom);
    const end = timeToMinutes(timeTo);
    const complete = start != null && end != null;
    const durationMinutes = complete && end > start ? end - start : 0;
    return {
      complete,
      valid: durationMinutes > 0,
      durationMinutes,
      durationHours: durationMinutes / 60,
    };
  }, [timeFrom, timeTo]);
  const usesIndividualDates =
    !isHourUnit &&
    (type === "home_office" ||
      (isVacation && vacationDateMode === "individual"));
  const individualSelectionMode = ignoreAbsenceId ? "single" : "multiple";
  const selectedDateObjects = useMemo(
    () =>
      selectedDates
        .map((date) => parseISODate(date))
        .filter((date): date is Date => date !== null),
    [selectedDates]
  );

  const blockedRanges: BlockedRange[] = useMemo(() => {
    return (existingAbsences ?? [])
      .filter((a) => a.status === "pendiente" || a.status === "aprobado")
      .filter((a) => (ignoreAbsenceId ? a.id !== ignoreAbsenceId : true))
      .map((a) => ({
        from: new Date(a.from + "T00:00:00"),
        to: new Date(a.to + "T00:00:00"),
        status: a.status === "aprobado" ? "aprobado" : "pendiente",
      }));
  }, [existingAbsences, ignoreAbsenceId]);

  const dateRangeOk = useMemo(() => {
    if (usesIndividualDates) return selectedDates.length > 0;
    if (!from) return false;
    if (isHourUnit) return true;
    if (!to) return false;
    return to >= from;
  }, [usesIndividualDates, selectedDates.length, from, to, isHourUnit]);

  const overlapAbsence = useMemo(() => {
    if (!existingAbsences?.length) return null;

    if (usesIndividualDates) {
      for (const date of selectedDates) {
        const overlap = findOverlappingAbsence(existingAbsences, date, date, {
          ignoreId: ignoreAbsenceId ?? undefined,
          statuses: ["pendiente", "aprobado"],
        });
        if (overlap) return overlap;
      }
      return null;
    }

    if (!from) return null;

    const rangeFrom = from;
    const rangeTo = isHourUnit ? from : to;

    if (!rangeTo) return null;
    if (rangeTo < rangeFrom) return null;

    return findOverlappingAbsence(existingAbsences, rangeFrom, rangeTo, {
      ignoreId: ignoreAbsenceId ?? undefined,
      statuses: ["pendiente", "aprobado"],
    });
  }, [
    existingAbsences,
    usesIndividualDates,
    selectedDates,
    from,
    to,
    isHourUnit,
    ignoreAbsenceId,
  ]);

  const overlapErrorMsg = useMemo(() => {
    if (!overlapAbsence) return "";
    const estado = overlapAbsence.status === "aprobado" ? "aprobada" : "pendiente";
    const subject = usesIndividualDates ? "Una fecha seleccionada" : "Ese rango";
    return `${subject} se solapa con una ausencia ${estado} (${overlapAbsence.from} → ${overlapAbsence.to}). Elegí otras fechas.`;
  }, [overlapAbsence, usesIndividualDates]);

  const usage = useMemo(() => {
    if (!policy?.deducts || !policy.deductsFrom) return null;

    const used = usageByKey?.get(policy.deductsFrom)?.used ?? 0;
    const reserved = usageByKey?.get(policy.deductsFrom)?.reserved ?? 0;
    const allowance = policy.allowance;
    const available = allowance == null ? null : Math.max(0, allowance - used - reserved);

    return { balanceKey: policy.deductsFrom, unit: policy.unit, allowance, used, reserved, available };
  }, [policy, usageByKey]);

  const exceedsPolicyAvailable = useMemo(() => {
    if (!usage || usage.allowance == null || usage.available == null) return false;

    if (usage.unit === "hour") {
      if (!timeRange.valid) return false;
      return timeRange.durationHours > usage.available;
    }

    const days = usesIndividualDates
      ? selectedDates.reduce(
          (total, date) =>
            total + countChargeableDays(date, date, "business_days", holidaysISO),
          0
        )
      : from && to && to >= from
        ? policy?.type === "home_office"
          ? countChargeableDays(from, to, "business_days", holidaysISO)
          : (() => {
              const start = new Date(from + "T00:00:00");
              const end = new Date(to + "T00:00:00");
              return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
            })()
        : 0;
    return days > usage.available;
  }, [
    usage,
    usesIndividualDates,
    selectedDates,
    policy?.type,
    from,
    to,
    timeRange,
    holidaysISO,
  ]);

  const requestedDays = useMemo(() => {
    if (!dateRangeOk) return 0;
    if (!isVacation) return 0;
    if (usesIndividualDates) {
      return selectedDates.reduce(
        (total, date) =>
          total +
          countChargeableDays(
            date,
            date,
            DEFAULT_VACATION_SETTINGS.countMode,
            holidaysISO
          ),
        0
      );
    }
    if (!from || !to) return 0;

    return countChargeableDays(from, to, DEFAULT_VACATION_SETTINGS.countMode, holidaysISO);
  }, [
    from,
    to,
    dateRangeOk,
    isVacation,
    usesIndividualDates,
    selectedDates,
    holidaysISO,
  ]);

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
    return timeRange.valid;
  }, [isHourUnit, timeRange.valid]);

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

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Opening or changing the edited request resets the modal form.
    setFrom(initial?.from ?? "");
    setTo(initial?.to ?? "");
    setType((initial?.type as AbsenceTypeId) ?? "vacaciones");
    setSelectedDates(
      initial?.dates?.length
        ? [...initial.dates].sort()
        : initial?.from
          ? [initial.from]
          : []
    );
    setVacationDateMode("range");
    setNote(initial?.note ?? "");
    setSubtype((initial?.subtype as LicenseSubtype | null | undefined) ?? "");
    setTimeFrom(normalizeTime(initial?.timeFrom));
    setTimeTo(normalizeTime(initial?.timeTo));
    setSelectedOwnerIds(initial?.notifyOwnerIds ?? []);

    setSubmitError("");
    setIsSubmitting(false);
  }, [
    open,
    initial?.from,
    initial?.to,
    initial?.dates,
    initial?.type,
    initial?.note,
    initial?.subtype,
    initial?.hours,
    initial?.timeFrom,
    initial?.timeTo,
    initial?.notifyOwnerIds,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!showNotificationSelector) return;

    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading state belongs to this external owners request.
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

    const orderedDates = usesIndividualDates
      ? [...selectedDates].sort()
      : undefined;
    const primaryDate = orderedDates?.[0] ?? from;

    const payload: NewAbsencePayload = {
      from: primaryDate,
      to: usesIndividualDates ? primaryDate : isHourUnit ? from : to,
      dates: orderedDates,
      type,
      note: note.trim() ? note.trim() : undefined,
      subtype: isLicense ? (subtype ? subtype : null) : null,
      hours: isHourUnit ? timeRange.durationHours : null,
      timeFrom: isHourUnit ? timeFrom : null,
      timeTo: isHourUnit ? timeTo : null,
      notifyOwnerIds: selectedOwnerIds,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(prettySupabaseError(err));
      setIsSubmitting(false);
    }
  }

  if (!modalPresence.shouldRender) return null;

  return (
    <div
      className="lll-presence-root fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-3 sm:p-4"
      data-state={modalPresence.state}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={title}
    >
      <button
        type="button"
        className="lll-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div
        className="lll-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
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
            <AppIcon name="close" className="mx-auto h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-4 sm:p-5">
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
                  right={<span>Acumulativo · sin vencimiento</span>}
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
                      <Skeleton className="h-3 w-32 bg-white/20" />
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
                      <Sep />
                      <span>
                        Reservado: {usage.reserved} {usage.unit === "hour" ? "h" : "d"}
                      </span>
                    </>
                  }
                  right={exceedsPolicyAvailable ? <span>Te pasás del disponible</span> : null}
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
                <label className="flex items-center gap-2 text-[12px] text-lll-text-soft">
                  <AppIcon name="absence" className="h-4 w-4 text-lll-accent-alt" />
                  Tipo de ausencia
                </label>
                <select
                  className="mt-2 w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none"
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as AbsenceTypeId;
                    setType(next);
                    setFrom("");
                    setTo("");
                    setSelectedDates([]);
                    setVacationDateMode("range");
                    setSubmitError("");

                    if (next !== "licencia") {
                      setSubtype("");
                      setTimeFrom("");
                      setTimeTo("");
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
                        setSubtype(e.target.value as LicenseSubtype);
                        setFrom("");
                        setTo("");
                        setSelectedDates([]);
                        setTimeFrom("");
                        setTimeTo("");
                        setSubmitError("");
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {LICENSE_SUBTYPES.map((s) => (
                        <option key={s} value={s}>
                          {getLicenseSubtypeLabel(s)}
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
                <div className="mb-2 flex items-center gap-2 text-[12px] text-lll-text-soft">
                  <AppIcon name="calendar" className="h-4 w-4 text-lll-accent-alt" />
                  {isHourUnit
                    ? "Día y horario"
                    : usesIndividualDates
                      ? "Días seleccionados"
                      : "Rango de fechas"}
                </div>
                {isHourUnit ? (
                  <div className="space-y-3">
                    <DateRangePickerLLL
                      holidaysISO={holidaysISO}
                      blockedRanges={blockedRanges}
                      selectionMode="single"
                      selectedDates={from ? [new Date(from + "T00:00:00")] : []}
                      onSelectedDatesChange={(dates) => {
                        const date = dates[0] ? toLocalISODate(dates[0]) : "";
                        setFrom(date);
                        setTo(date);
                        setSubmitError("");
                      }}
                      value={{
                        from: from ? new Date(from + "T00:00:00") : undefined,
                        to: from ? new Date(from + "T00:00:00") : undefined,
                      }}
                      onChange={(next) => {
                        const date = next.from ? toLocalISODate(next.from) : "";
                        setFrom(date);
                        setTo(date);
                        setSubmitError("");
                      }}
                      label="Día de la solicitud"
                    />

                    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                        <label className="text-[11px] text-lll-text-soft">
                          Desde
                          <input
                            className="mt-1.5 w-full rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2.5 text-sm text-lll-text outline-none focus:border-lll-accent-alt/50"
                            type="time"
                            step={900}
                            value={timeFrom}
                            onChange={(e) => {
                              setTimeFrom(e.target.value);
                              setSubmitError("");
                            }}
                          />
                        </label>

                        <span className="hidden pb-3 text-lll-text-soft sm:block" aria-hidden="true">
                          →
                        </span>

                        <label className="text-[11px] text-lll-text-soft">
                          Hasta
                          <input
                            className="mt-1.5 w-full rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2.5 text-sm text-lll-text outline-none focus:border-lll-accent-alt/50"
                            type="time"
                            step={900}
                            min={timeFrom || undefined}
                            value={timeTo}
                            onChange={(e) => {
                              setTimeTo(e.target.value);
                              setSubmitError("");
                            }}
                          />
                        </label>
                      </div>

                      {timeRange.valid ? (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-lll-accent-alt/20 bg-lll-accent-alt/[0.07] px-3 py-2 text-[11px]">
                          <span className="text-lll-text-soft">Duración calculada</span>
                          <span className="font-semibold text-lll-accent-alt">
                            {formatMinutes(timeRange.durationMinutes)}
                          </span>
                        </div>
                      ) : timeRange.complete ? (
                        <p className="mt-2 text-[11px] text-red-300">
                          El horario de finalización debe ser posterior al de inicio.
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-lll-text-soft">
                          Elegí el horario de inicio y finalización; las horas se calculan automáticamente.
                        </p>
                      )}

                      {!timeFrom && !timeTo && initial?.hours ? (
                        <p className="mt-2 text-[11px] text-amber-200">
                          Esta solicitud anterior tiene {initial.hours} h registradas, pero no conserva el horario exacto.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    {isVacation && !ignoreAbsenceId ? (
                      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-lll-border bg-lll-bg-soft p-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (vacationDateMode === "range") return;
                            setVacationDateMode("range");
                            setFrom("");
                            setTo("");
                            setSelectedDates([]);
                            setSubmitError("");
                          }}
                          className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                            vacationDateMode === "range"
                              ? "bg-lll-accent-alt/15 text-lll-text ring-1 ring-lll-accent-alt/35"
                              : "text-lll-text-soft hover:text-lll-text"
                          }`}
                        >
                          Período continuo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (vacationDateMode === "individual") return;
                            setVacationDateMode("individual");
                            setFrom("");
                            setTo("");
                            setSelectedDates([]);
                            setSubmitError("");
                          }}
                          className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                            vacationDateMode === "individual"
                              ? "bg-lll-accent-alt/15 text-lll-text ring-1 ring-lll-accent-alt/35"
                              : "text-lll-text-soft hover:text-lll-text"
                          }`}
                        >
                          Días sueltos
                        </button>
                      </div>
                    ) : null}

                    {type === "home_office" ? (
                      <div className="mb-3 rounded-xl border border-lll-accent-alt/20 bg-lll-accent-alt/[0.07] px-3 py-2 text-[11px] leading-5 text-lll-text-soft">
                        Elegí días sueltos. Si marcás martes y jueves, el miércoles no se incluye.
                      </div>
                    ) : null}

                    <div className="mt-2">
                      <DateRangePickerLLL
                        holidaysISO={holidaysISO}
                        blockedRanges={blockedRanges}
                        selectionMode={
                          usesIndividualDates ? individualSelectionMode : "range"
                        }
                        selectedDates={selectedDateObjects}
                        onSelectedDatesChange={(dates) => {
                          const isoDates = dates.map(toLocalISODate).sort();
                          setSelectedDates(isoDates);
                          if (ignoreAbsenceId) {
                            setFrom(isoDates[0] ?? "");
                            setTo(isoDates[0] ?? "");
                          }
                          setSubmitError("");
                        }}
                        maxSelectedDates={31}
                        value={{
                          from: from ? new Date(from + "T00:00:00") : undefined,
                          to: to ? new Date(to + "T00:00:00") : undefined,
                        }}
                        onChange={(next) => {
                          const f = next.from ? toLocalISODate(next.from) : "";
                          const t = next.to ? toLocalISODate(next.to) : "";
                          setFrom(f);
                          setTo(t);
                          setSubmitError("");
                        }}
                        label={
                          usesIndividualDates
                            ? "Selección individual"
                            : "Período continuo"
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
                <label className="flex items-center gap-2 text-[12px] text-lll-text-soft">
                  <AppIcon name="note" className="h-4 w-4 text-lll-accent-alt" />
                  Comentario
                </label>
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
                  <label className="flex items-center gap-2 text-[12px] text-lll-text-soft">
                    <AppIcon name="users" className="h-4 w-4 text-lll-accent-alt" />
                    Notificar a
                  </label>
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
                    [0, 1, 2].map((item) => (
                      <Skeleton key={item} className="h-8 w-28 rounded-full" />
                    ))
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
                    <AppIcon name="close" className="mr-1 inline h-4 w-4" />
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
                    <AppIcon name={isSubmitting ? "clock" : "check"} className="mr-1 inline h-4 w-4" />
                    {isSubmitting
                      ? "Enviando..."
                      : usesIndividualDates &&
                          selectedDates.length > 1 &&
                          !ignoreAbsenceId
                        ? `Enviar ${selectedDates.length} solicitudes`
                        : submitLabel}
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
