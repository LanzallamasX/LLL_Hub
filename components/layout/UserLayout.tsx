"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/ui/AppHeader";
import { useAuth } from "@/contexts/AuthContext";

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

export default function UserLayout({
  children,
  mode,
  header,
}: {
  children: React.ReactNode;
  mode: LayoutMode;
  header?: {
    title: string;
    subtitle?: string;
  };
}) {
  const pathname = usePathname();

  const { isLoading, isAuthed, displayName, role } = useAuth();

const name = isLoading ? "…" : displayName;
const initials = getInitials(name, isLoading);

  function navLinkClass(active: boolean) {
    return active
      ? "flex items-center gap-2 px-3 py-2 rounded-lg border border-lll-accent/60 bg-lll-accent-soft text-lll-text"
      : "flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-lll-bg-softer text-lll-text";
  }

  // ====== ROUTES ======
  const dashboardHref = mode === "owner" ? "/owner/dashboard" : "/dashboard";
  const calendarHref = "/owner/calendar";
  const usersHref = "/owner/users";
  const myAbsencesHref = "/absences";
  const profileHref = "/profile";
  const settingsHref = "/settings";

  // ====== ACTIVE STATES ======
  const isDashboardActive =
    mode === "owner"
      ? pathname === "/owner" || pathname.startsWith("/owner/dashboard")
      : pathname === "/dashboard" || pathname.startsWith("/dashboard");

  const isCalendarActive =
    mode === "owner" && pathname.startsWith("/owner/calendar");
  const isUsersActive = mode === "owner" && pathname.startsWith("/owner/users");
  const isMyAbsencesActive =
    mode === "user" &&
    (pathname === "/absences" || pathname.startsWith("/absences"));

  const isProfileActive = pathname === "/profile" || pathname.startsWith("/profile");
  const isSettingsActive =
    pathname === "/settings" || pathname.startsWith("/settings");

  return (
    <div className="min-h-screen flex bg-lll-bg text-lll-text">
      {/* ASIDE */}
      <aside className="hidden md:flex w-64 flex-col border-r border-lll-border bg-lll-bg-soft px-4 py-6 gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-lll-bg-softer border border-lll-border flex items-center justify-center text-xs font-black">
            L
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">LANZALLAMAS</p>
            <p className="text-[12px] text-lll-text-soft leading-tight">LLL Hub</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 text-sm space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-lll-text-soft/80 mb-2">
            Principal
          </p>

          {/* DASHBOARD / SOLICITUDES */}
          <Link href={dashboardHref} className={navLinkClass(isDashboardActive)}>
            <span className="w-2 h-2 rounded bg-lll-accent" />
            {mode === "owner" ? "Solicitudes" : "Dashboard"}
          </Link>

          {/* USER: Mis ausencias */}
          {mode === "user" && (
            <Link
              href={myAbsencesHref}
              className={navLinkClass(isMyAbsencesActive)}
            >
              <span className="w-2 h-2 rounded bg-lll-accent-alt" />
              Mis ausencias
            </Link>
          )}

          {/* OWNER: Calendario + Usuarios */}
          {mode === "owner" && (
            <>
              <div className="mt-2">
                <Link
                  href={calendarHref}
                  className={navLinkClass(isCalendarActive)}
                >
                  <span className="w-2 h-2 rounded bg-lll-accent" />
                  Calendario
                </Link>
              </div>

              <Link href={usersHref} className={navLinkClass(isUsersActive)}>
                <span className="w-2 h-2 rounded bg-lll-accent-alt" />
                Usuarios
              </Link>
            </>
          )}

          <p className="mt-6 text-[11px] uppercase tracking-wide text-lll-text-soft/80 mb-2">
            Personal
          </p>

          <Link href={profileHref} className={navLinkClass(isProfileActive)}>
            <span className="w-2 h-2 rounded bg-lll-accent-alt" />
            Mi perfil
          </Link>

          <Link href={settingsHref} className={navLinkClass(isSettingsActive)}>
            <span className="w-2 h-2 rounded bg-lll-accent-alt" />
            Configuración
          </Link>
        </nav>

        {/* Bottom user conectado a AuthContext */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-lll-border pt-4">
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

      {/* CONTENT */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="border-b border-lll-border bg-lll-bg-soft">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            {/* Left label / breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-sm text-lll-text-soft whitespace-nowrap">LLL HUB</p>
              <span className="text-lll-text-soft/60">·</span>
              <p className="text-sm truncate">{header?.title ?? "LLL Hub"}</p>

              <span className="ml-2 text-[12px] px-2 py-1 rounded-full bg-lll-bg-softer border border-lll-border">
                {mode === "owner" ? "Owner" : "Usuario"}
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {mode === "owner" && (
                <input
                  className="hidden lg:block w-[340px] px-3 py-2 rounded-full bg-lll-bg-softer border border-lll-border text-sm placeholder:text-lll-text-soft outline-none"
                  placeholder="Buscar empleado o equipo..."
                />
              )}

              <AppHeader title="" subtitle="" />
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
