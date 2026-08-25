import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import {
  POLICIES,
  type BalanceKey,
  type PolicyUnit,
} from "@/lib/absencePolicies";
import type { HistoryRow } from "@/lib/balances/stats";
import { formatAR } from "@/lib/date";

function unitLabel(unit: PolicyUnit) {
  return unit === "hour" ? "h" : "d";
}

function movementLabel(value: string) {
  const policy = POLICIES.find(
    (item) => item.type === value || item.subtype === value
  );

  if (!policy) {
    return value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase());
  }

  return getAbsenceTypeLabel(policy.type, policy.subtype ?? null);
}

function StatusPill({ status }: { status: HistoryRow["status"] }) {
  const approved = status === "aprobado";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        approved
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/25 bg-amber-400/10 text-amber-200"
      }`}
    >
      <AppIcon name={approved ? "check" : "clock"} className="h-3 w-3" />
      {approved ? "Aprobada" : "Pendiente"}
    </span>
  );
}

function DateRange({ row }: { row: HistoryRow }) {
  return (
    <div>
      <p className="font-medium text-lll-text">{formatAR(row.dateFrom)}</p>
      {row.dateTo !== row.dateFrom ? (
        <p className="mt-0.5 text-[11px] text-lll-text-soft">
          hasta {formatAR(row.dateTo)}
        </p>
      ) : null}
    </div>
  );
}

export default function BalanceHistory({
  rows,
  balanceLabels,
}: {
  rows: HistoryRow[];
  balanceLabels?: Partial<Record<BalanceKey, string>>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft">
      <header className="flex flex-col gap-3 border-b border-lll-border bg-gradient-to-r from-emerald-400/[0.06] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <AppIcon name="clock" className="h-[18px] w-[18px]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Historial de movimientos</h2>
            <p className="mt-1 text-[12px] text-lll-text-soft">
              Solicitudes aprobadas y pendientes dentro del período.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-lll-border bg-lll-bg-softer px-2.5 py-1 text-[11px] text-lll-text-soft">
          {rows.length} movimiento{rows.length === 1 ? "" : "s"}
        </span>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<AppIcon name="archive" className="h-5 w-5" />}
          title="Sin movimientos en este período"
          description="Cuando haya consumos o reservas, van a aparecer en este historial."
          className="py-10"
        />
      ) : (
        <>
          <div className="space-y-2 p-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-lll-border bg-lll-bg-softer p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {movementLabel(row.type)}
                    </p>
                    <p className="mt-1 text-[11px] text-lll-text-soft">
                      {balanceLabels?.[row.balanceKey] ?? row.balanceKey}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-200">
                    {row.amount} {unitLabel(row.unit)}
                  </p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-lll-border/70 pt-3 text-[12px]">
                  <DateRange row={row} />
                  <StatusPill status={row.status} />
                </div>
                {row.note ? (
                  <p className="mt-2 line-clamp-2 text-[11px] text-lll-text-soft">
                    {row.note}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden max-h-[440px] overflow-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-lll-bg-soft text-[11px] uppercase tracking-[0.08em] text-lll-text-soft">
                <tr className="border-b border-lll-border">
                  <th className="px-5 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Movimiento</th>
                  <th className="px-4 py-3 text-left font-medium">Política</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-5 py-3 text-right font-medium">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-lll-border/60 transition hover:bg-white/[0.025] last:border-b-0"
                  >
                    <td className="px-5 py-3.5 align-top">
                      <DateRange row={row} />
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <p className="font-medium text-lll-text">
                        {movementLabel(row.type)}
                      </p>
                      {row.note ? (
                        <p className="mt-1 max-w-56 truncate text-[11px] text-lll-text-soft">
                          {row.note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-top text-[12px] text-lll-text-soft">
                      {balanceLabels?.[row.balanceKey] ?? row.balanceKey}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right align-top font-semibold text-emerald-200">
                      {row.amount} {unitLabel(row.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
