"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/ui/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { useAuth } from "@/contexts/AuthContext";
import HeaderNotifications from "@/components/layout/HeaderNotifications";
import { usePresence } from "@/components/ui/usePresence";

type LayoutMode = "user" | "owner";

function getInitials(name: string, isLoading: boolean) {
  if (isLoading) return "…";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((w) => w[0]?.toUpperCase()).join("");
  return initials || "U";
}

type NavIconName =
  | "requests"
  | "dashboard"
  | "balances"
  | "teamBalance"
  | "absences"
  | "calendar"
  | "users"
  | "profile"
  | "settings"
  | "policy";

function NavIcon({ name, tone }: { name: NavIconName; tone: string }) {
  const icon = (() => {
    switch (name) {
      case "requests":
        return (
          <>
            <path d="M9 5.5h6" />
            <path d="M9.5 3.5h5a1 1 0 0 1 1 1v2h-7v-2a1 1 0 0 1 1-1Z" />
            <path d="M7 5.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-11a2 2 0 0 0-2-2h-1" />
            <path d="m8 14 2.2 2.2L16 10.5" />
          </>
        );
      case "dashboard":
        return (
          <>
            <rect x="4" y="4" width="6" height="6" rx="1.5" />
            <rect x="14" y="4" width="6" height="6" rx="1.5" />
            <rect x="4" y="14" width="6" height="6" rx="1.5" />
            <rect x="14" y="14" width="6" height="6" rx="1.5" />
          </>
        );
      case "balances":
        return (
          <>
            <path d="M4 18.5V14" />
            <path d="M10 18.5V10" />
            <path d="M16 18.5V6" />
            <path d="M3 20h18" />
            <path d="m4 10 5-4 5 1 6-4" />
          </>
        );
      case "teamBalance":
        return (
          <>
            <circle cx="8" cy="8" r="2.5" />
            <path d="M3.5 18c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5" />
            <path d="M15 11h5" />
            <path d="M15 15h5" />
            <path d="M15 19h5" />
          </>
        );
      case "absences":
        return (
          <>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 9h17" />
            <path d="M8.5 14h7" />
          </>
        );
      case "calendar":
        return (
          <>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 9h17" />
            <path d="m8 14 2.2 2.2L16 12" />
          </>
        );
      case "users":
        return (
          <>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.5-3.6 2.4-5.5 5.5-5.5s5 1.9 5.5 5.5" />
            <path d="M15.5 6.2a2.7 2.7 0 0 1 0 5.3" />
            <path d="M17 13.8c2 .7 3.1 2.4 3.5 5.2" />
          </>
        );
      case "profile":
        return (
          <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.5 20c.6-4.2 2.8-6.3 6.5-6.3s5.9 2.1 6.5 6.3" />
          </>
        );
      case "settings":
        return (
          <>
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </>
        );
      case "policy":
        return (
          <>
            <path d="M7 3.5h8l4 4V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
            <path d="M15 3.5V8h4" />
            <path d="m9 14 2 2 4-4" />
          </>
        );
    }
  })();

  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-white/[0.13] group-hover:bg-white/[0.07] ${tone}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
    </span>
  );
}

export default function UserLayout({
  children,
  mode,
  header,
}: {
  children: React.ReactNode;
  mode: LayoutMode; // lo dejamos por compatibilidad
  header?: {
    title: string;
    subtitle?: string;
  };
}) {
  const pathname = usePathname();
  const { isLoading, isAuthed, displayName, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuPresence = usePresence(mobileOpen);

  // ✅ El menú no depende del pathname ni del prop, depende del rol real
  const effectiveMode: LayoutMode = role === "owner" ? "owner" : "user";

  const name = isLoading ? "…" : displayName;
  const initials = getInitials(name, isLoading);

  function navLinkClass(active: boolean) {
    return active
      ? "group flex items-center gap-2 px-3 py-2 rounded-lg border border-lll-accent/60 bg-lll-accent-soft text-lll-text"
      : "group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-lll-bg-softer text-lll-text";
  }

  // ====== ROUTES ======
  const dashboardHref = effectiveMode === "owner" ? "/owner/dashboard" : "/dashboard";
  const ownerRequestsHref = "/owner/requests";
  const calendarHref = "/owner/calendar";
  const usersHref = "/owner/users";
  const ownerVacationPolicyHref = "/owner/vacation-policy";

  const myAbsencesHref = "/absences";
  const profileHref = "/profile";
  const settingsHref = "/settings";

  // Balances
  const myBalancesHref = "/balances";
  const ownerBalancesEmployeesHref = "/owner/balances/employees";

  // ====== ACTIVE STATES ======
  const isDashboardActive =
    effectiveMode === "owner"
      ? pathname === "/owner" || pathname.startsWith("/owner/dashboard")
      : pathname === "/dashboard" || pathname.startsWith("/dashboard");

  const isOwnerRequestsActive =
    effectiveMode === "owner" && pathname.startsWith("/owner/requests");
  const isCalendarActive = effectiveMode === "owner" && pathname.startsWith("/owner/calendar");
  const isUsersActive = effectiveMode === "owner" && pathname.startsWith("/owner/users");
  const isOwnerVacationPolicyActive =
    effectiveMode === "owner" && pathname.startsWith("/owner/vacation-policy");

  // ✅ ahora aplica para ambos roles (user + owner)
  const isMyAbsencesActive = pathname === "/absences" || pathname.startsWith("/absences");

  const isProfileActive = pathname === "/profile" || pathname.startsWith("/profile");
  const isSettingsActive = pathname === "/settings" || pathname.startsWith("/settings");

  const isMyBalancesActive = pathname === "/balances" || pathname.startsWith("/balances");
  const isOwnerBalancesEmployeesActive =
    effectiveMode === "owner" && pathname.startsWith("/owner/balances/employees");

  return (
    <div data-layout-mode={mode} className="min-h-screen bg-lll-bg text-lll-text">
      {/* ASIDE */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-64 flex-col gap-6 overflow-hidden border-r border-lll-border bg-lll-bg-soft px-4 py-6 md:flex">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-lll-bg-softer border border-lll-border flex items-center justify-center text-xs font-black">
            L
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">LANZALLAMAS</p>
            <p className="text-[12px] text-lll-text-soft leading-tight">LLL Hub</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm scrollbar-thin">
          <p className="text-[11px] uppercase tracking-wide text-lll-text-soft/80 mb-2">
            Principal
          </p>

          {/* DASHBOARD */}
          <Link href={dashboardHref} className={navLinkClass(isDashboardActive)}>
            <NavIcon name="dashboard" tone="text-lll-accent" />
            Dashboard
          </Link>

          {effectiveMode === "owner" ? (
            <Link
              href={ownerRequestsHref}
              className={navLinkClass(isOwnerRequestsActive)}
            >
              <NavIcon name="requests" tone="text-orange-400" />
              Solicitudes
            </Link>
          ) : null}

          {/* BALANCES */}
          {effectiveMode === "owner" ? (
            <>
              <Link href={myBalancesHref} className={navLinkClass(isMyBalancesActive)}>
                <NavIcon name="balances" tone="text-emerald-400" />
                Mis balances
              </Link>

              <Link
                href={ownerBalancesEmployeesHref}
                className={navLinkClass(isOwnerBalancesEmployeesActive)}
              >
                <NavIcon name="teamBalance" tone="text-sky-400" />
                Balance anual por colaborador
              </Link>
            </>
          ) : (
            <Link href={myBalancesHref} className={navLinkClass(isMyBalancesActive)}>
              <NavIcon name="balances" tone="text-emerald-400" />
              Balance anual
            </Link>
          )}

          {/* ✅ Mis ausencias (ahora también para owner) */}
          <Link href={myAbsencesHref} className={navLinkClass(isMyAbsencesActive)}>
            <NavIcon name="absences" tone="text-lll-accent-alt" />
            Mis ausencias
          </Link>

          {/* OWNER: Calendario + Usuarios */}
          {effectiveMode === "owner" && (
            <>
              <div className="mt-2">
                <Link href={calendarHref} className={navLinkClass(isCalendarActive)}>
                  <NavIcon name="calendar" tone="text-lll-accent" />
                  Calendario
                </Link>
              </div>

              <Link href={usersHref} className={navLinkClass(isUsersActive)}>
                <NavIcon name="users" tone="text-lll-accent-alt" />
                Usuarios
              </Link>
            </>
          )}

          <p className="mt-6 text-[11px] uppercase tracking-wide text-lll-text-soft/80 mb-2">
            Personal
          </p>

          <Link href={profileHref} className={navLinkClass(isProfileActive)}>
            <NavIcon name="profile" tone="text-lll-accent-alt" />
            Mi perfil
          </Link>

          <Link href={settingsHref} className={navLinkClass(isSettingsActive)}>
            <NavIcon name="settings" tone="text-lll-accent-alt" />
            Configuración
          </Link>
          {effectiveMode === "owner" ? (
            <Link
              href={ownerVacationPolicyHref}
              className={navLinkClass(isOwnerVacationPolicyActive)}
            >
              <NavIcon name="policy" tone="text-amber-400" />
              Politica de vacaciones
            </Link>
          ) : null}
        </nav>

        {/* Bottom user */}
        <div className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-lll-border bg-lll-bg-soft pt-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-[12px] text-lll-text-soft capitalize">
              {isAuthed ? role : "no-auth"}
            </p>
          </div>

          <div className="w-9 h-9 rounded-full bg-lll-bg-softer border border-lll-border flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        </div>
      </aside>

      {mobileMenuPresence.shouldRender ? (
        <div
          className="lll-presence-root fixed inset-0 z-50 md:hidden"
          data-state={mobileMenuPresence.state}
          aria-hidden={!mobileOpen}
        >
          <button
            type="button"
            aria-label="Cerrar menu"
            className="lll-drawer-backdrop absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="lll-drawer-panel relative flex h-dvh w-[min(82vw,320px)] flex-col gap-5 overflow-hidden border-r border-lll-border bg-lll-bg-soft px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-2xl bg-lll-bg-softer border border-lll-border flex items-center justify-center text-xs font-black">
                  L
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">LANZALLAMAS</p>
                  <p className="text-[12px] text-lll-text-soft leading-tight">LLL Hub</p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Cerrar menu"
                onClick={() => setMobileOpen(false)}
                className="min-h-10 min-w-10 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text-soft hover:text-lll-text"
              >
                <AppIcon name="close" className="mx-auto h-4 w-4" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm scrollbar-thin">
              <p className="text-[11px] uppercase tracking-wide text-lll-text-soft/80 mb-2">
                Principal
              </p>

              <Link
                href={dashboardHref}
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(isDashboardActive)}
              >
                <NavIcon name="dashboard" tone="text-lll-accent" />
                Dashboard
              </Link>

              {effectiveMode === "owner" ? (
                <Link
                  href={ownerRequestsHref}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass(isOwnerRequestsActive)}
                >
                  <NavIcon name="requests" tone="text-orange-400" />
                  Solicitudes
                </Link>
              ) : null}

              {effectiveMode === "owner" ? (
                <>
                  <Link
                    href={myBalancesHref}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(isMyBalancesActive)}
                  >
                    <NavIcon name="balances" tone="text-emerald-400" />
                    Mis balances
                  </Link>

                  <Link
                    href={ownerBalancesEmployeesHref}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(isOwnerBalancesEmployeesActive)}
                  >
                    <NavIcon name="teamBalance" tone="text-sky-400" />
                    Balance anual por colaborador
                  </Link>
                </>
              ) : (
                <Link
                  href={myBalancesHref}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass(isMyBalancesActive)}
                >
                  <NavIcon name="balances" tone="text-emerald-400" />
                  Balance anual
                </Link>
              )}

              <Link
                href={myAbsencesHref}
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(isMyAbsencesActive)}
              >
                <NavIcon name="absences" tone="text-lll-accent-alt" />
                Mis ausencias
              </Link>

              {effectiveMode === "owner" ? (
                <>
                  <Link
                    href={calendarHref}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(isCalendarActive)}
                  >
                    <NavIcon name="calendar" tone="text-lll-accent" />
                    Calendario
                  </Link>

                  <Link
                    href={usersHref}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(isUsersActive)}
                  >
                    <NavIcon name="users" tone="text-lll-accent-alt" />
                    Usuarios
                  </Link>


                </>
              ) : null}

              <p className="mt-6 text-[11px] uppercase tracking-wide text-lll-text-soft/80 mb-2">
                Personal
              </p>

              <Link
                href={profileHref}
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(isProfileActive)}
              >
                <NavIcon name="profile" tone="text-lll-accent-alt" />
                Mi perfil
              </Link>

              <Link
                href={settingsHref}
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(isSettingsActive)}
              >
                <NavIcon name="settings" tone="text-lll-accent-alt" />
                Configuracion
              </Link>

              {effectiveMode === "owner" ? (
                <Link
                  href={ownerVacationPolicyHref}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass(isOwnerVacationPolicyActive)}
                >
                  <NavIcon name="policy" tone="text-amber-400" />
                  Politica de vacaciones
                </Link>
              ) : null}

            </nav>

            <div className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-lll-border bg-lll-bg-soft pt-4">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <p className="text-[12px] text-lll-text-soft capitalize">
                  {isAuthed ? role : "no-auth"}
                </p>
              </div>

              <div className="w-9 h-9 shrink-0 rounded-full bg-lll-bg-softer border border-lll-border flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* CONTENT */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 shrink-0 border-b border-lll-border bg-lll-bg-soft/95 backdrop-blur-xl md:fixed md:left-64 md:right-0 md:top-0">
          <div className="flex h-full items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setMobileOpen(true)}
                className="md:hidden min-h-10 min-w-10 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-lll-text-soft hover:text-lll-text"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              </button>
              <p className="text-sm text-lll-text-soft whitespace-nowrap">LLL HUB</p>
              <span className="text-lll-text-soft/60">·</span>
              <p className="text-sm truncate">{header?.title ?? "LLL Hub"}</p>

              <span className="ml-2 text-[12px] px-2 py-1 rounded-full bg-lll-bg-softer border border-lll-border">
                {effectiveMode === "owner" ? "Owner" : "Usuario"}
              </span>
            </div>




            <div className="flex items-center gap-3">
              {effectiveMode === "owner" && (
                <label className="relative hidden w-[340px] lg:block">
                  <span className="sr-only">Buscar colaborador o equipo</span>
                  <AppIcon
                    name="search"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-lll-text-soft"
                  />
                  <input
                    className="w-full rounded-full border border-lll-border bg-lll-bg-softer py-2 pl-10 pr-3 text-sm outline-none placeholder:text-lll-text-soft"
                    placeholder="Buscar colaborador o equipo..."
                  />
                </label>
              )}


              <div className="flex items-center gap-3">
                {/* ...tu search */}
                <HeaderNotifications enabled />
                {/* ...tu user menu / salir */}
              </div>
              <AppHeader title="" subtitle="" />



            </div>



          </div>
          
        </header>

        <main className="min-w-0 flex-1 md:pt-16">
          <div key={pathname} className="lll-page-enter p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
