"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

function isValidDate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

declare global {
  interface Window {
    __LLL_ASOF_ISO__?: string;
  }
}

export default function AsOfDebug() {
  const sp = useSearchParams();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const asOf = sp.get("asOf");
    window.__LLL_ASOF_ISO__ = isValidDate(asOf) ? asOf : undefined;

    console.log("[AsOfDebug] asOf =", window.__LLL_ASOF_ISO__ ?? "(real time)");
  }, [sp]);

  return null;
}