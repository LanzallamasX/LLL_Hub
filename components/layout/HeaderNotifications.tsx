// components/layout/HeaderNotifications.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/notifications/useNotifications";
import type { NotificationInboxItem } from "@/lib/supabase/notifications";
import { formatARDateTime } from "@/lib/date";
import { usePresence } from "@/components/ui/usePresence";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

function notifIcon(type: string) {
  const t = (type ?? "").toLowerCase();
  let name: AppIconName = "bell";
  let tone = "text-lll-accent-alt";
  if (t.includes("approved")) {
    name = "check";
    tone = "text-emerald-300";
  } else if (t.includes("rejected")) {
    name = "close";
    tone = "text-red-300";
  } else if (t.includes("created")) {
    name = "plus";
    tone = "text-lll-accent";
  }
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-lg border border-lll-border bg-lll-bg ${tone}`}>
      <AppIcon name={name} className="h-4 w-4" />
    </span>
  );
}

function routeForNotification(n: { type: string; entity_type: string | null; entity_id: string | null }) {
  if (n.entity_type === "absence" && n.entity_id) {
    if (n.type === "absence_created") return `/owner/dashboard?focus=${n.entity_id}`;
    if (n.type === "absence_approved" || n.type === "absence_rejected") return `/dashboard?focus=${n.entity_id}`;
  }
  return "/notifications";
}

export default function HeaderNotifications({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const { items, unreadCount, loading, error, markRead, markAllRead } = useNotifications({
    enabled,
    pollMs: 30000,
    limit: 8,
  });

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelPresence = usePresence(open, 200);

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
    if (error) return "Error";
    return "Notificaciones";
  }, [error]);

async function toggle() {
  setOpen((v) => !v);
}

  async function onClickItem(it: NotificationInboxItem) {
    const n = it.notification;

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
        <AppIcon name="bell" className="h-5 w-5 text-lll-text-soft" />

        {hasUnread ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-lll-accent text-black text-[11px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {panelPresence.shouldRender ? (
        <div
          className="lll-popover absolute right-0 mt-2 w-[360px] rounded-2xl border border-lll-border bg-lll-bg-soft shadow-xl overflow-hidden z-50"
          data-state={panelPresence.state}
          aria-hidden={!open}
        >
          <div className="px-4 py-3 border-b border-lll-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              {loading ? (
                <Skeleton className="mt-2 h-3 w-20" />
              ) : (
                <p className="text-[12px] text-lll-text-soft">
                  {hasUnread ? `${unreadCount} sin leer` : "Todo al día"}
                </p>
              )}
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
            <button
  type="button"
  onClick={async () => { 
    await markAllRead();
  }}
  className="text-[12px] px-2 py-1 rounded-lg bg-lll-bg-softer border border-lll-border text-lll-text-soft hover:text-lll-text"
>
  Marcar como leídas
</button>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {error ? <div className="p-4 text-sm text-red-300">{error}</div> : null}

            {loading ? (
              <div className="space-y-px">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="border-b border-lll-border p-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <EmptyState
                icon={<AppIcon name="bell" className="h-5 w-5" />}
                title="No tenés notificaciones"
                description="Los nuevos avisos van a aparecer acá."
                className="py-8"
              />
            ) : null}

            {!loading && !error &&
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
