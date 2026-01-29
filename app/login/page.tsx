"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type Status = "idle" | "working" | "success" | "error";

function isValidEmail(e: string) {
  return e.trim().includes("@");
}

export default function LoginPage() {
  const router = useRouter();
  const { isLoading, isAuthed, signInWithPassword, resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const passOk = useMemo(() => password.trim().length >= 6, [password]);

  const canLogin = emailOk && passOk && status !== "working";

  useEffect(() => {
    if (!isLoading && isAuthed) {
      router.replace("/post-login");
    }
  }, [isLoading, isAuthed, router]);

  function resetUi() {
    setStatus("idle");
    setError(null);
    setInfo(null);
  }

  async function handleLogin() {
    if (!canLogin) return;
    setStatus("working");
    setError(null);
    setInfo(null);

    const res = await signInWithPassword(email.trim(), password);

    if (!res.ok) {
      setStatus("error");

      // Mensaje UX para migración:
      // usuarios creados por magic link no tenían password hasta que hagan reset.
      setError(
        res.error ??
          "No se pudo iniciar sesión. Si nunca configuraste una contraseña, tocá “Olvidé mi contraseña” para crearla."
      );
      return;
    }

    setStatus("success");
    // El AuthContext hidrata por onAuthStateChange y /post-login redirige.
  }

  async function handleForgot() {
    if (!emailOk || status === "working") {
      setStatus("error");
      setError("Ingresá un email válido para recuperar/crear tu contraseña.");
      setInfo(null);
      return;
    }

    setStatus("working");
    setError(null);
    setInfo(null);

    const res = await resetPassword(email.trim());

    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "No se pudo enviar el email. Probá de nuevo.");
      return;
    }

    setStatus("success");
    setInfo(
      "Listo. Te enviamos un email para crear o restablecer tu contraseña."
    );
  }

  if (!isLoading && isAuthed) return null;

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-lll-border bg-lll-bg-soft p-6">
        <h1 className="text-xl font-semibold">LLL Hub</h1>
        <p className="mt-1 text-sm text-lll-text-soft">
          Ingresá con tu email y contraseña.
        </p>

        {/* Email */}
        <div className="mt-5">
          <label className="text-[12px] text-lll-text-soft">Email</label>
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== "idle") resetUi();
            }}
            placeholder="tu@lanzallamas.com"
            type="email"
            autoComplete="email"
          />
          {!emailOk && email.length > 0 && (
            <p className="mt-2 text-[12px] text-lll-text-soft">
              Ingresá un email válido.
            </p>
          )}
        </div>

        {/* Password */}
        <div className="mt-4">
          <label className="text-[12px] text-lll-text-soft">Contraseña</label>
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (status !== "idle") resetUi();
            }}
            placeholder="Mínimo 6 caracteres"
            type="password"
            autoComplete="current-password"
          />
          {!passOk && password.length > 0 && (
            <p className="mt-2 text-[12px] text-lll-text-soft">
              La contraseña debe tener al menos 6 caracteres.
            </p>
          )}
        </div>

        {/* Messages */}
        {info && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {info}
          </div>
        )}

        {status === "error" && error && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleForgot}
            disabled={!emailOk || status === "working"}
            className="text-sm text-lll-text-soft hover:text-lll-text underline underline-offset-4 disabled:opacity-50"
          >
            Olvidé mi contraseña
          </button>

          <button
            onClick={handleLogin}
            disabled={!canLogin}
            className={
              canLogin
                ? "px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
                : "px-4 py-2 rounded-lg bg-lll-bg-softer text-lll-text-soft border border-lll-border cursor-not-allowed"
            }
            type="button"
          >
            {status === "working" ? "Ingresando…" : "Entrar"}
          </button>
        </div>

        <p className="mt-4 text-[12px] text-lll-text-soft">
          Si es tu primer ingreso, usá <span className="text-lll-text">“Olvidé mi contraseña”</span>{" "}
          para crear tu contraseña.
        </p>
      </div>
    </div>
  );
}
