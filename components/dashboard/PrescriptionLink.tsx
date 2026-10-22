"use client";
import { useState } from "react";
import { openPrescription } from "@/lib/supabase/prescriptions";

export default function PrescriptionLink({ path }: { path: string }) {
  const [error, setError] = useState(false);
  return <div className="mt-2 text-sm">
    <button type="button" className="underline" onClick={async () => {
      setError(false);
      try { await openPrescription(path); } catch { setError(true); }
    }}>Ver prescripción médica</button>
    {error ? <p role="alert" className="text-red-300">No se pudo abrir la foto. Intentá nuevamente.</p> : null}
  </div>;
}
