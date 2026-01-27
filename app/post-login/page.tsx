"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function PostLoginPage() {
  const router = useRouter();
  const { isLoading, isAuthed, role } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed) {
      router.replace("/login");
      return;
    }
    router.replace(role === "owner" ? "/owner/dashboard" : "/dashboard");
  }, [isLoading, isAuthed, role, router]);

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
        Redirigiendo…
      </div>
    </div>
  );
}
