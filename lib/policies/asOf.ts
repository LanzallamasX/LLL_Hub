export function getAsOfDate(): Date {
  if (typeof window !== "undefined") {
    const iso = (window as any).__LLL_ASOF_ISO__ as string | undefined;
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + "T00:00:00");
  }
  return new Date();
}