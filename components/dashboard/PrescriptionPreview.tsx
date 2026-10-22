"use client";

import { useEffect, useState } from "react";
import { getPrescriptionUrl } from "@/lib/supabase/prescriptions";
import PrescriptionLink from "./PrescriptionLink";

export default function PrescriptionPreview({ path }: { path: string }) {
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getPrescriptionUrl(path)
      .then((url) => { if (alive) setResult({ path, url }); })
      .catch(() => { if (alive) setResult({ path, url: null }); });
    return () => { alive = false; };
  }, [path, attempt]);

  const current = result?.path === path ? result : null;
  return <div className="mt-3 space-y-2">
    <p className="text-xs font-semibold text-lll-text-soft">Prescripción médica adjunta</p>
    {!current ? <p role="status" className="text-xs text-lll-text-soft">Cargando foto…</p> : current.url ? (
      // Signed private URLs must load directly from storage, without a shared image cache.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={current.url} alt="Prescripción médica adjunta a la solicitud" className="max-h-72 w-full rounded-xl border border-lll-border bg-white object-contain" onError={() => setResult({ path, url: null })} />
    ) : <div className="text-xs text-red-300" role="alert">
      No se pudo cargar la foto.
      <button type="button" className="ml-2 underline" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Reintentar</button>
    </div>}
    <PrescriptionLink path={path} />
  </div>;
}
