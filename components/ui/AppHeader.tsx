"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAbsences } from "@/contexts/AbsencesContext";
import { AppIcon } from "@/components/ui/AppIcon";

export default function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { isLoading, isAuthed, displayName, role, signOut } = useAuth();
  const { reset } = useAbsences();

  async function handleLogout() {
    await signOut();
    reset();
    router.replace("/login");
  }

  const name = isLoading ? "…" : displayName; // ✅ displayName siempre string

  return (
    <div
      data-title={title || undefined}
      data-subtitle={subtitle || undefined}
      className="flex items-center justify-end gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="text-sm">{name}</span>
          <span className="text-[12px] text-lll-text-soft capitalize">
            {isAuthed ? role : "no-auth"}
          </span>
        </div>

        <button
          onClick={handleLogout}
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text-soft hover:text-lll-text"
        >
          <AppIcon name="arrowRight" className="h-4 w-4" />
          Salir
        </button>
      </div>
    </div>
  );
}
