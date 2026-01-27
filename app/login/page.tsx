"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { isLoading, isAuthed, signInWithMagicLink } = useAuth();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => email.trim().includes("@"), [email]);

  useEffect(() => {
    if (!isLoading && isAuthed) {
      router.replace("/post-login");
    }
  }, [isLoading, isAuthed, router]);

  async function handleSend() {
    if (!canSend) return;
    setStatus("sending");
    setError(null);

    const res = await signInWithMagicLink(email.trim());
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "Error enviando link.");
      return;
    }
    setStatus("sent");
  }

  // Opcional (recomendado): si ya está authed, no muestres el form mientras redirige
  if (!isLoading && isAuthed) return null;

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-lll-border bg-lll-bg-soft p-6">
        <h1 className="text-xl font-semibold">LLL Hub</h1>
        <p className="mt-1 text-sm text-lll-text-soft">
          Ingresá con tu email. Te enviamos un link para acceder.
        </p>

        <div className="mt-5">
          <label className="text-[12px] text-lll-text-soft">Email</label>
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@lanzallamas.com"
            type="email"
          />
        </div>

        {status === "sent" && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            Link enviado. Revisá tu correo.
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSend}
            disabled={!canSend || status === "sending"}
            className={
              canSend && status !== "sending"
                ? "px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
                : "px-4 py-2 rounded-lg bg-lll-bg-softer text-lll-text-soft border border-lll-border cursor-not-allowed"
            }
            type="button"
          >
            {status === "sending" ? "Enviando…" : "Enviar link"}
          </button>
        </div>
      </div>
    </div>
  );
}
