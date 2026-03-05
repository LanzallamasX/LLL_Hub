"use client";

import { useEffect, useMemo, useState } from "react";

type ApiHoliday = { date: string; localName?: string; name?: string };

export function useHolidays(year: number) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ApiHoliday[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/holidays?year=${year}`);
        const json = await res.json();
        if (!alive) return;
        setItems(Array.isArray(json?.holidays) ? json.holidays : []);
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [year]);

  const isoSet = useMemo(() => new Set(items.map((h) => h.date)), [items]);

  return { loading, items, isoSet };
}