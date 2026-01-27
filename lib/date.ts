export function toDate00(iso: string) {
  return new Date(iso + "T00:00:00");
}

export function formatAR(iso: string) {
  const d = toDate00(iso);
  return d.toLocaleDateString("es-AR");
}

export function isDateInRange(day: Date, fromISO: string, toISO: string) {
  const from = toDate00(fromISO).getTime();
  const to = toDate00(toISO).getTime();
  const t = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return t >= from && t <= to;
}

export function startOfTodayMs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function formatARDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}