function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function fullYearsAndMonthsBetween(startISO: string, atISO: string) {
  const start = parseISODate(startISO);
  const at = parseISODate(atISO);

  let years = at.getFullYear() - start.getFullYear();
  let months = at.getMonth() - start.getMonth();

  if (at.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function formatSeniority(startISO: string | null | undefined, atISO: string) {
  if (!startISO) return null;
  const { years, months } = fullYearsAndMonthsBetween(startISO, atISO);
  return `${years}a ${months}m`;
}
