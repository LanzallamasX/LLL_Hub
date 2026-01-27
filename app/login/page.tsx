"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const {
    isLoading,
    isAuthed,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [status, setStatus] = useState<
    "idle" | "working" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const eOk = email.trim().includes("@");
    const pOk = password.trim().length >= 6; // mínimo razonable
    if (mode === "login") return eOk && pOk;
    // signup
    return eOk && pOk;
  }, [email, password, mode]);

  useEffect(() => {
    if (!isLoading && isAuthed) {
      router.replace("/post-login");
    }
  }, [isLoading, isAuthed, router]);

  function resetUi() {
    setStatus("idle");
    setError(null);
  }

  async function handleLogin() {
    if (!canSubmit) return;
    setStatus("working");
    setError(null);

    const res = await signInWithPassword(email.trim(), password);
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "No se pudo iniciar sesión.");
      return;
    }

    setStatus("success");
    // el AuthContext hidrata por onAuthStateChange y /post-login redirige
  }

  async function handleSignup() {
    if (!canSubmit) return;
    setStatus("working");
    setError(null);

    const res = await signUpWithPassword(
      email.trim(),
      password,
      fullName.trim() || undefined
    );

    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "No se pudo crear la cuenta.");
      return;
    }

    setStatus("success");
    // Si tu proyecto requiere confirmación de email, acá avisa que revise el correo.
    // Si no requiere confirmación, quedará logueado y redirige solo.
  }

  async function handleResetPassword() {
    const eOk = email.trim().includes("@");
    if (!eOk) {
      setStatus("error");
      setError("Ingresá un email válido para recuperar la contraseña.");
      return;
    }

    setStatus("working");
    setError(null);

    const res = await resetPassword(email.trim());
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "No se pudo enviar el email de recuperación.");
      return;
    }

    setStatus("success");
  }

  // si ya está authed, no muestres el form mientras redirige
  if (!isLoading && isAuthed) return null;

  const isWorking = status === "working";

  return (
    <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-lll-border bg-lll-bg-soft p-6">
        <h1 className="text-xl font-semibold">LLL Hub</h1>
        <p className="mt-1 text-sm text-lll-text-soft">
          Ingresá con email y contraseña.
        </p>

        {/* Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              resetUi();
            }}
            className={`px-3 py-2 rounded-lg border text-sm ${
              mode === "login"
                ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                : "border-lll-border bg-lll-bg-softer text-lll-text-soft"
            }`}
          >
            Iniciar sesión
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              resetUi();
            }}
            className={`px-3 py-2 rounded-lg border text-sm ${
              mode === "signup"
                ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                : "border-lll-border bg-lll-bg-softer text-lll-text-soft"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {/* Form */}
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
        </div>

        {mode === "signup" && (
          <div className="mt-4">
            <label className="text-[12px] text-lll-text-soft">
              Nombre (opcional)
            </label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (status !== "idle") resetUi();
              }}
              placeholder="Nombre Apellido"
              type="text"
              autoComplete="name"
            />
          </div>
        )}

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
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {/* Feedback */}
        {status === "success" && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {mode === "signup"
              ? "Cuenta creada. Si tu email requiere confirmación, revisá tu correo."
              : "Sesión iniciada. Redirigiendo…"}
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={isWorking}
            className="text-sm text-lll-text-soft hover:text-lll-text underline underline-offset-4 disabled:opacity-50"
          >
            Olvidé mi contraseña
          </button>

          <button
            onClick={mode === "login" ? handleLogin : handleSignup}
            disabled={!canSubmit || isWorking}
            className={
              canSubmit && !isWorking
                ? "px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
                : "px-4 py-2 rounded-lg bg-lll-bg-softer text-lll-text-soft border border-lll-border cursor-not-allowed"
            }
            type="button"
          >
            {isWorking
              ? "Procesando…"
              : mode === "login"
              ? "Entrar"
              : "Crear cuenta"}
          </button>
        </div>

        <p className="mt-4 text-[12px] text-lll-text-soft">
          Tip: si tu cuenta no está en la allowlist, la creación de cuenta será
          rechazada.
        </p>
      </div>
    </div>
  );
}
