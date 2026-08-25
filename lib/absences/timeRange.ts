type AbsenceTimeRange = {
  timeFrom?: string | null;
  timeTo?: string | null;
  hours?: number | null;
};

function clock(value?: string | null) {
  return value?.match(/^\d{2}:\d{2}/)?.[0] ?? null;
}

function durationLabel(hours?: number | null) {
  if (hours == null || !Number.isFinite(Number(hours)) || Number(hours) <= 0) {
    return null;
  }

  const totalMinutes = Math.round(Number(hours) * 60);
  const fullHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!fullHours) return `${minutes} min`;
  if (!minutes) return `${fullHours} h`;
  return `${fullHours} h ${minutes} min`;
}

export function getAbsenceTimeRangeLabel(absence: AbsenceTimeRange) {
  const from = clock(absence.timeFrom);
  const to = clock(absence.timeTo);
  const duration = durationLabel(absence.hours);

  if (from && to) {
    return `${from}–${to}${duration ? ` · ${duration}` : ""}`;
  }

  return duration ? `${duration} · sin horario exacto` : null;
}
