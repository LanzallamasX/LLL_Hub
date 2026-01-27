// lib/vacations/dateCount.ts
export type CountMode = "business_days" | "calendar_days";

function toDate00(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function countChargeableDays(fromISO: string, toISO: string, mode: CountMode) {
  const from = toDate00(fromISO);
  const to = toDate00(toISO);
  if (to < from) return 0;

  let days = 0;
  const d = new Date(from);

  while (d <= to) {
    const day = d.getDay(); // 0 dom, 6 sab
    const isWeekend = day === 0 || day === 6;

    if (mode === "calendar_days") days++;
    else if (!isWeekend) days++;

    d.setDate(d.getDate() + 1);
  }

  return days;
}

export function clampRangeToYear(fromISO: string, toISO: string, year: number) {
  const from = toDate00(fromISO);
  const to = toDate00(toISO);

  const yStart = new Date(`${year}-01-01T00:00:00`);
  const yEnd = new Date(`${year}-12-31T00:00:00`);

  const a = from > yStart ? from : yStart;
  const b = to < yEnd ? to : yEnd;

  if (b < a) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const isoA = `${a.getFullYear()}-${pad(a.getMonth() + 1)}-${pad(a.getDate())}`;
  const isoB = `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}`;
  return { fromISO: isoA, toISO: isoB };
}
