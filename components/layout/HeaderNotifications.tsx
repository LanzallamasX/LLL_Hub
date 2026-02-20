// components/layout/HeaderNotifications.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { formatARDateTime } from "@/lib/date";

function notifIcon(type: string) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("approved")) return "✅";
  if (t.includes("rejected")) return "⛔";
  if (t.includes("created")) return "🆕";
  return "🔔";
}

function routeForNotification(n: {
  type: string;
  entity_type: string | null;
  entity_id: string | null;
}) {
  if (n.entity_type === "absence" && n.entity_id) {
    if (n.type === "absence_created") return `/owner/dashboard?focus=${n.entity_id}`;
    if (n.type === "absence_approved" || n.type === "absence_rejected")
      return `/dashboard?focus=${n.entity_id}`;
  }
  return "/notifications";
}

export default function HeaderNotifications({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const { items, unreadCount, loading, error, markRead, refresh } = useNotifications({
    enabled,
    pollMs: 30000,
    limit: 8,
  });

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // close on click outside + escape
  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasUnread = unreadCount > 0;

  const title = useMemo(() => {
    if (loading) return "Cargando…";
    if (error) return "Error";
    return "Notificaciones";
  }, [loading, error]);

  async function toggle() {
    const next = !open;
    setOpen(next);

    // MVP: al abrir marcamos todas las unread como leídas
    if (next) {
      const fresh = await refresh(); // 👈 ahora refresh devuelve lista (ver hook abajo)
      const idsToMark = (fresh ?? [])
        .filter((it) => !it.readAt)
        .map((it) => it.notificationId);

      if (idsToMark.length) await markRead(idsToMark);
    }
  }

  async function onClickItem(it: any) {
    const n = it.notification;

    // marcar esa sola si estaba unread (más “real” que marcar todo)
    if (!it.readAt) {
      await markRead([it.notificationId]);
    }

    setOpen(false);
    router.push(routeForNotification(n));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative w-10 h-10 rounded-full border border-lll-border bg-lll-bg-soft hover:bg-lll-bg-softer transition flex items-center justify-center"
        aria-label="Notificaciones"
      >
        <span className="text-lg">🔔</span>

        {hasUnread ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-lll-accent text-black text-[11px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border border-lll-border bg-lll-bg-soft shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-lll-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-[12px] text-lll-text-soft">
                {hasUnread ? `${unreadCount} sin leer` : "Todo al día"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="text-[12px] px-2 py-1 rounded-lg bg-lll-bg-softer border border-lll-border text-lll-text-soft hover:text-lll-text"
            >
              Ver todas
            </button>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {error ? <div className="p-4 text-sm text-red-300">{error}</div> : null}

            {!error && items.length === 0 ? (
              <div className="p-4 text-sm text-lll-text-soft">No tenés notificaciones aún.</div>
            ) : null}

            {!error &&
              items.map((it) => {
                const n = it.notification;
                const unread = !it.readAt;

                return (
                  <button
                    key={it.notificationId}
                    type="button"
                    onClick={() => onClickItem(it)}
                    className={`w-full text-left px-4 py-3 border-b border-lll-border hover:bg-lll-bg-softer transition ${
                      unread ? "bg-lll-bg-softer" : "bg-lll-bg-soft"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{notifIcon(n.type)}</div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">{n.title}</p>
                          <p className="text-[11px] text-lll-text-soft whitespace-nowrap">
                            {formatARDateTime(n.created_at)}
                          </p>
                        </div>

                        {n.body ? <p className="mt-1 text-[12px] text-lll-text-soft">{n.body}</p> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
    </div>
  );
}