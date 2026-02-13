"use client";

import UserLayout from "@/components/layout/UserLayout";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { formatARDateTime } from "@/lib/date";

export default function NotificationsPage() {
  const { items, loading, error } = useNotifications({ enabled: true, pollMs: 30000, limit: 50 });

  return (
    <UserLayout mode="user" header={{ title: "Notificaciones", subtitle: "Historial de avisos y eventos." }}>
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
        <div className="p-4 border-b border-lll-border">
          <p className="text-sm font-semibold">Todas</p>
          <p className="text-[12px] text-lll-text-soft">Últimos eventos del sistema.</p>
        </div>

        {loading ? <div className="p-4 text-sm text-lll-text-soft">Cargando…</div> : null}
        {error ? <div className="p-4 text-sm text-red-300">{error}</div> : null}

        {!loading && !error && items.length === 0 ? (
          <div className="p-4 text-sm text-lll-text-soft">No hay notificaciones.</div>
        ) : null}

        {!loading && !error ? (
          <div>
            {items.map((it) => (
              <div key={it.notificationId} className="p-4 border-t border-lll-border">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{it.notification.title}</p>
                  <p className="text-[11px] text-lll-text-soft">{formatARDateTime(it.notification.created_at)}</p>
                </div>
                {it.notification.body ? (
                  <p className="mt-1 text-[12px] text-lll-text-soft">{it.notification.body}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </UserLayout>
  );
}
