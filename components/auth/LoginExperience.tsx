"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./LoginExperience.module.css";

type Status = "idle" | "working" | "success" | "error";

const INTRO_WORDMARK = Array.from("LANZALLAMAS");

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 6.75h16v10.5H4V6.75Z" />
      <path d="m4.75 7.5 7.25 5 7.25-5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M2.75 12s3.25-5 9.25-5 9.25 5 9.25 5-3.25 5-9.25 5-9.25-5-9.25-5Z" />
      <circle cx="12" cy="12" r="2.25" />
      {crossed && <path d="m4 4 16 16" />}
    </svg>
  );
}

export default function LoginExperience() {
  const router = useRouter();
  const { isLoading, isAuthed, signInWithPassword, resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const passOk = useMemo(() => password.trim().length >= 6, [password]);
  const canLogin = emailOk && passOk && status !== "working" && !isLoading;

  useEffect(() => {
    if (!isLoading && isAuthed) router.replace("/post-login");
  }, [isLoading, isAuthed, router]);

  function resetUi() {
    setStatus("idle");
    setError(null);
    setInfo(null);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canLogin) return;

    setStatus("working");
    setError(null);
    setInfo(null);

    const result = await signInWithPassword(email.trim(), password);

    if (!result.ok) {
      setStatus("error");
      setError(
        result.error ??
          "No pudimos iniciar tu sesión. Revisá tus datos o restablecé tu contraseña."
      );
      return;
    }

    setStatus("success");
  }

  async function handleForgot() {
    if (!emailOk || status === "working") {
      setStatus("error");
      setError("Ingresá un email válido para recuperar tu contraseña.");
      setInfo(null);
      return;
    }

    setStatus("working");
    setError(null);
    setInfo(null);

    const result = await resetPassword(email.trim());

    if (!result.ok) {
      setStatus("error");
      setError(result.error ?? "No pudimos enviar el email. Probá de nuevo.");
      return;
    }

    setStatus("success");
    setInfo("Listo. Te enviamos un email para crear o restablecer tu contraseña.");
  }

  if (!isLoading && isAuthed) {
    return (
      <main className={styles.redirecting}>
        <span className={styles.spinner} />
        <p>Preparando tu espacio…</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.introSequence} aria-hidden="true">
        <div className={styles.introMark}>
          <div className={styles.introWordmark}>
            {INTRO_WORDMARK.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className={styles.introLetter}
                style={{ animationDelay: `${100 + index * 52}ms` }}
              >
                {letter}
              </span>
            ))}
          </div>
          <span className={styles.introHub}>HUB</span>
        </div>
      </div>

      <section className={styles.loginPane} aria-labelledby="login-title">
        <header className={styles.brand}>
          <Image src="/images/logo.svg" alt="Lanzallamas" width={150} height={16} priority />
          <span>HUB</span>
        </header>

        <div className={styles.formContainer}>
          <div className={styles.eyebrow}>
            <span /> Portal interno
          </div>
          <h1 id="login-title">Tu tiempo, en un solo lugar.</h1>
          <p className={styles.intro}>
            Ingresá para gestionar tus vacaciones, ausencias y días disponibles.
          </p>

          <form className={styles.form} onSubmit={handleLogin} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="login-email">Email</label>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><MailIcon /></span>
                <input
                  id="login-email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (status !== "idle") resetUi();
                  }}
                  placeholder="tu@lanzallamas.com"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={email.length > 0 && !emailOk}
                />
              </div>
              {!emailOk && email.length > 0 && (
                <p className={styles.fieldError}>Ingresá un email válido.</p>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="login-password">Contraseña</label>
                <button type="button" onClick={handleForgot} disabled={status === "working"}>
                  ¿La olvidaste?
                </button>
              </div>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><LockIcon /></span>
                <input
                  id="login-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (status !== "idle") resetUi();
                  }}
                  placeholder="Ingresá tu contraseña"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={password.length > 0 && !passOk}
                />
                <button
                  className={styles.passwordToggle}
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
              {!passOk && password.length > 0 && (
                <p className={styles.fieldError}>Usá al menos 6 caracteres.</p>
              )}
            </div>

            {info && <div className={`${styles.notice} ${styles.success}`} role="status">{info}</div>}
            {status === "error" && error && (
              <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div>
            )}

            <button className={styles.submitButton} type="submit" disabled={!canLogin}>
              <span>{status === "working" ? "Ingresando…" : "Ingresar al Hub"}</span>
              {status === "working" ? (
                <span className={styles.buttonSpinner} />
              ) : (
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" />
                </svg>
              )}
            </button>
          </form>

          <div className={styles.firstAccess}>
            <span><LockIcon /></span>
            <p>
              <strong>¿Es tu primer ingreso?</strong>
              Escribí tu email y elegí “¿La olvidaste?” para crear tu contraseña.
            </p>
          </div>
        </div>

        <footer className={styles.loginFooter}>
          <span>© {new Date().getFullYear()} Lanzallamas</span>
          <span className={styles.secure}><LockIcon /> Acceso seguro</span>
        </footer>
      </section>

      <aside className={styles.visualPane} aria-label="Vista previa de LLL Hub">
        <div className={styles.gradientCanvas} aria-hidden="true">
          <span className={`${styles.gradientOrb} ${styles.gradientOrange}`} />
          <span className={`${styles.gradientOrb} ${styles.gradientRed}`} />
          <span className={`${styles.gradientOrb} ${styles.gradientMagenta}`} />
          <span className={`${styles.gradientOrb} ${styles.gradientPurple}`} />
        </div>
        <div className={styles.visualOverlay} />

        <div className={styles.visualTopline}>
          <span className={styles.liveDot} />
          Tu espacio de trabajo
        </div>

        {/*
        <div className={styles.productPreview}>
          <div className={styles.previewGlow} />
          <Image
            src="/images/notebook.png"
            alt="Vista del panel de ausencias de LLL Hub"
            width={1509}
            height={1080}
            priority
          />
        </div>

        */}

        <div className={styles.visualCopy}>
          <p className={styles.kicker}>Simple. Claro. A tiempo.</p>
          <h2>Menos vueltas.<br />Más tiempo para lo importante.</h2>
          <p>Solicitá, revisá y organizá tus días desde un mismo lugar.</p>
        </div>
      </aside>
    </main>
  );
}
