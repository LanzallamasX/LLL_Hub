// lib/vacations/policy.ts
export type EntitlementRule = { min_years: number; days: number };

export const DEFAULT_ENTITLEMENT_RULES: EntitlementRule[] = [
  { min_years: 0, days: 14 },
  { min_years: 5, days: 21 },
  { min_years: 10, days: 28 },
  { min_years: 20, days: 35 },
];

export function yearsOfServiceAtYearEnd(year: number, startDateISO: string) {
  const end = new Date(`${year}-12-31T00:00:00`);
  const start = new Date(`${startDateISO}T00:00:00`);

  let years = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) years--;

  return Math.max(0, years);
}

export function entitlementDaysForYears(years: number, rules: EntitlementRule[]) {
  const sorted = [...rules].sort((a, b) => a.min_years - b.min_years);
  let result = sorted[0]?.days ?? 0;
  for (const r of sorted) {
    if (years >= r.min_years) result = r.days;
  }
  return result;
}
