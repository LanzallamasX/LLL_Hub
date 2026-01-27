"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAbsences } from "@/contexts/AbsencesContext";



export default function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { isLoading, isAuthed, fullName, email, role, signOut } = useAuth();

  const { reset } = useAbsences();


  async function handleLogout() {
    await signOut();
    reset();
    router.replace("/login");
  }


  
return (
  <div className="flex items-center justify-end gap-4">
    <div className="flex items-center gap-3">
      <div className="hidden md:flex flex-col items-end leading-tight">
        <span className="text-sm">
          {isLoading ? "…" : fullName ?? email ?? "Usuario"}
        </span>
        <span className="text-[12px] text-lll-text-soft capitalize">
          {isAuthed ? role : "no-auth"}
        </span>
      </div>

      <button
        onClick={handleLogout}
        type="button"
        className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
      >
        Salir
      </button>
    </div>
  </div>
);
}
