"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        console.log("CALLBACK URL:", window.location.href);

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code"); // <- NO dependemos de useSearchParams

        console.log("CODE:", code);

        if (!code) {
          router.replace("/login?reason=missing_code");
          return;
        }

        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        console.log("EXCHANGE ERR:", exErr);

        if (exErr) {
          router.replace("/login?reason=exchange_failed");
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        console.log("SESSION EMAIL:", session?.user?.email);

        if (!session?.user) {
          router.replace("/login?reason=no_session");
          return;
        }

        const { error: ensureErr } = await supabase.rpc("ensure_my_profile");
        console.log("ENSURE ERR:", ensureErr);

        if (ensureErr) {
          await supabase.auth.signOut();
          router.replace("/login?reason=not_allowed");
          return;
        }

        if (!cancelled) router.replace("/post-login");
      } catch (e) {
        console.log("CALLBACK ERROR:", e);
        await supabase.auth.signOut();
        router.replace("/login?reason=auth_error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
        Validando sesión…
      </div>
    </div>
  );
}
