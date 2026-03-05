"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

function isValidDate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Dev-only: si viene ?asOf=YYYY-MM-DD, overridea Date.now()
 * para que toda la app “crea” que hoy es esa fecha.
 */
export default function DevTimeTravel() {
  const sp = useSearchParams();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const asOfParam = sp.get("asOf"); // <-- mejor nombre que vacAt si lo usás global
    if (!isValidDate(asOfParam)) return;

    const originalNow = Date.now.bind(Date);

    // OJO: "YYYY-MM-DD" solo se parsea como UTC en algunos casos,
    // por eso lo forzamos a local con "T00:00:00".
    const simulatedBase = new Date(`${asOfParam}T00:00:00`).getTime();
    const realBase = originalNow();

    // Mantiene el “paso del tiempo” desde esa base simulada
    Date.now = () => simulatedBase + (originalNow() - realBase);

    // Log visible en consola para no olvidarte que está activo
    // eslint-disable-next-line no-console
    console.log(`[DevTimeTravel] Simulando fecha: ${asOfParam}`);

    return () => {
      Date.now = originalNow;
      // eslint-disable-next-line no-console
      console.log("[DevTimeTravel] Restaurado Date.now()");
    };
  }, [sp]);

  return null;
}