// lib/vacations/entitlement.ts
export function vacationDaysBySeniority(years: number) {
  if (years < 5) return 14;
  if (years < 10) return 21;
  if (years < 20) return 28;
  return 35;
}

export function yearsOfService(startDate: string, asOfISO: string) {
  const start = new Date(startDate + "T00:00:00");
  const asOf = new Date(asOfISO + "T00:00:00");
  let years = asOf.getFullYear() - start.getFullYear();

  const m = asOf.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < start.getDate())) years--;

  return Math.max(0, years);
}
