"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMyVacationBalance,
  type VacationBalance,
} from "@/lib/supabase/vacations";
import { formatAR } from "@/lib/date";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return formatAR(iso);
}

function todayISO() {
  // ISO YYYY-MM-DD (sin hora) para comparar string-date safe
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function VacationBalanceCard() {
  const [data, setData] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchMyVacationBalance();
        if (!alive) return;
        setData(res);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error cargando balance de vacaciones.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const nextBucket = useMemo(() => {
    if (!data?.next_expiration) return null;
    return (
      data.buckets.find(
        (b) => b.expires_at === data.next_expiration && b.remaining > 0
      ) ?? null
    );
  }, [data]);

  // ✅ Bucket “actual” = el último grant_date ya ocurrido (cupo anual vigente)
  const currentBucket = useMemo(() => {
    if (!data?.buckets?.length) return null;
    const t = todayISO();

    const eligible = data.buckets
      .filter((b) => b.grant_date <= t && b.expires_at > t)
      .sort((a, b) => (a.grant_date < b.grant_date ? 1 : -1)); // más nuevo primero

    return eligible[0] ?? null;
  }, [data]);

  // ✅ Métricas para la barra
  const summary = useMemo(() => {
    if (!data) return null;

    const available = Number(data.available ?? 0);
    const used = Number(data.used ?? 0);

    const cupo = currentBucket ? Number(currentBucket.granted ?? 0) : 0;

    // Acum = disponible de ciclos anteriores (excluye lo que queda del ciclo actual)
    const currentRemaining = currentBucket ? Number(currentBucket.remaining ?? 0) : 0;
    const acum = Math.max(0, available - currentRemaining);

    return { cupo, acum, used, available };
  }, [data, currentBucket]);

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Vacaciones</p>
          <p className="mt-1 text-[12px] text-lll-text-soft">
            Acumulación por 3 años (aniversario). FIFO por vencimiento.
          </p>
        </div>

        <div className="text-right">
          <div className="text-[12px] text-lll-text-soft">Próximo vencimiento</div>
          <div className="text-[12px] text-lll-text">{fmt(data?.next_expiration)}</div>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
          Cargando balance…
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {!loading && data ? (
        <>    

          {/*
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Disponibles</p>
              <p className="mt-2 text-3xl font-semibold">{data.available}
            </div>

            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Otorgadas (ventana)</p>
              <p className="mt-2 text-3xl font-semibold">{data.granted}</p>
            </div>

            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Usadas (ventana)</p>
              <p className="mt-2 text-3xl font-semibold">{data.used}</p>
            </div>
          </div>
          */}
          {summary ? (
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Cupo</p>
              <p className="mt-2 text-3xl font-semibold">{summary.cupo}</p> 
            </div>

            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Acumulado</p>
              <p className="mt-2 text-3xl font-semibold">{summary.acum}</p>
            </div>

            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Usadas</p>
              <p className="mt-2 text-3xl font-semibold">{summary.used}</p>
            </div>
            <div className="rounded-2xl border border-lll-border bg-lll-bg p-4">
              <p className="text-[12px] text-lll-text-soft">Disponibles</p>
              <p className="mt-2 text-3xl font-semibold">{summary.available}</p>
            </div>            
          </div>      
          ) : null}              

          {nextBucket ? (
            <div className="mt-3 rounded-2xl border border-lll-border bg-lll-bg-softer p-3 text-[12px] text-lll-text-soft">
              Te vencen{" "}
              <span className="text-lll-text font-semibold">{nextBucket.remaining}</span>{" "}
              día(s) el{" "}
              <span className="text-lll-text font-semibold">{fmt(nextBucket.expires_at)}</span>.
            </div>
          ) : null}

          {/* Buckets compact */}
          <div className="mt-4 rounded-2xl border border-lll-border bg-lll-bg-softer p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] text-lll-text-soft">Detalle por ciclo</p>
              <p className="text-[12px] text-lll-text-soft">
                {data.buckets.length} ciclo(s)
              </p>
            </div>

            <div className="space-y-2">
              {data.buckets.length === 0 ? (
                <div className="text-[12px] text-lll-text-soft">
                  No hay ciclos generados. Revisá que tu perfil tenga <b>start_date</b>.
                </div>
              ) : (
                data.buckets.slice(0, 4).map((b) => (
                  <div
                    key={`${b.grant_date}-${b.expires_at}`}
                    className="rounded-xl border border-lll-border bg-lll-bg p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[12px] text-lll-text-soft">
                        Otorgado: <span className="text-lll-text">{fmt(b.grant_date)}</span>
                        {" · "}
                        Vence: <span className="text-lll-text">{fmt(b.expires_at)}</span>
                      </div>
                      <div className="text-[12px] text-lll-text-soft">
                        Restan{" "}
                        <span className="text-lll-text font-semibold">{b.remaining}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-[12px] text-lll-text-soft">
                      Otorgadas {b.granted} · Usadas {b.used}
                    </div>
                  </div>
                ))
              )}
            </div>

            {data.buckets.length > 4 ? (
              <div className="mt-2 text-[12px] text-lll-text-soft">
                +{data.buckets.length - 4} ciclo(s) más…
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
