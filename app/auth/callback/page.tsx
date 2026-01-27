"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {

    // Con OTP, Supabase maneja el session exchange automáticamente en el cliente.
    // Solo redirigimos a una ruta “post-login”.
    supabase.auth.getSession().then(() => {
      router.replace("/post-login");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
        Validando sesión…
      </div>
    </div>
  );
}
