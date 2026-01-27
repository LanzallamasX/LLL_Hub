"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    if (password.trim().length < 6) return false;
    if (password !== password2) return false;
    return true;
  }, [password, password2]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Supabase v2: al entrar desde el link de reset, la sesión se establece en el cliente
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session?.user) {
          setHasSession(false);
        } else {
          setHasSession(true);
        }
      } catch {
        setHasSession(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!canSave) return;
    setStatus("saving");
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        setStatus("error");
        setError(error.message);
        return;
      }

      setStatus("success");

      // Opcional: redirigir post-login para que caiga al dashboard correcto
      setTimeout(() => {
        router.replace("/post-login");
      }, 600);
    } catch {
      setStatus("error");
      setError("No se pudo actualizar la contraseña. Probá de nuevo.");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center p-4">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Validando enlace…
        </div>
      </div>
    );
  }

  // Si llega sin sesión, es que el link expiró o ya se usó (o abrió en otro browser)
  if (!hasSession) {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-lll-border bg-lll-bg-soft p-6">
          <h1 className="text-xl font-semibold">Restablecer contraseña</h1>
          <p className="mt-2 text-sm text-lll-text-soft">
            Este enlace no es válido o ya expiró. Volvé a solicitarlo desde{" "}
            <span className="text-lll-text">Login</span>.
          </p>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => router.replace("/login")}
              className="px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
              type="button"
            >
              Ir a Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-lll-border bg-lll-bg-soft p-6">
        <h1 className="text-xl font-semibold">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-lll-text-soft">
          Elegí una contraseña nueva (mínimo 6 caracteres).
        </p>

        <div className="mt-5">
          <label className="text-[12px] text-lll-text-soft">
            Nueva contraseña
          </label>
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (status !== "idle") {
                setStatus("idle");
                setError(null);
              }
            }}
            placeholder="••••••••"
            type="password"
            autoComplete="new-password"
          />
        </div>

        <div className="mt-4">
          <label className="text-[12px] text-lll-text-soft">
            Repetir contraseña
          </label>
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            value={password2}
            onChange={(e) => {
              setPassword2(e.target.value);
              if (status !== "idle") {
                setStatus("idle");
                setError(null);
              }
            }}
            placeholder="••••••••"
            type="password"
            autoComplete="new-password"
          />
        </div>

        {!canSave && (
          <p className="mt-3 text-[12px] text-lll-text-soft">
            La contraseña debe tener al menos 6 caracteres y coincidir.
          </p>
        )}

        {status === "success" && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            Contraseña actualizada. Redirigiendo…
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => router.replace("/login")}
            type="button"
            className="px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
            disabled={status === "saving"}
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave || status === "saving"}
            className={
              canSave && status !== "saving"
                ? "px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
                : "px-4 py-2 rounded-lg bg-lll-bg-softer text-lll-text-soft border border-lll-border cursor-not-allowed"
            }
            type="button"
          >
            {status === "saving" ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
