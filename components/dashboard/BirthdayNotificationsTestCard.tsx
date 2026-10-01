"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { FormField, formControlClassName } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatAR } from "@/lib/date";
import { supabase } from "@/lib/supabase/client";
import type { ProfileRow } from "@/lib/supabase/profilesAdmin";

function profileName(profile: ProfileRow) {
  return (
    profile.full_name?.trim() ||
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    profile.email?.trim() ||
    "Sin nombre"
  );
}

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "No se pudo enviar la prueba.";
}

export default function BirthdayNotificationsTestCard({
  profiles,
  defaultEmail,
  simulatedDate,
  defaultOpen = false,
  lockEmail = false,
}: {
  profiles: ProfileRow[];
  defaultEmail: string | null;
  simulatedDate: string;
  defaultOpen?: boolean;
  lockEmail?: boolean;
}) {
  const simulatedMonthDay = simulatedDate.slice(5, 10);
  const candidates = useMemo(
    () =>
      profiles
        .filter(
          (profile) =>
            profile.active &&
            profile.birth_date?.slice(5, 10) === simulatedMonthDay
        )
        .sort((left, right) => profileName(left).localeCompare(profileName(right))),
    [profiles, simulatedMonthDay]
  );
  const [birthdayUserId, setBirthdayUserId] = useState("");
  const [testEmail, setTestEmail] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!candidates.some((profile) => profile.id === birthdayUserId)) {
      setBirthdayUserId(candidates[0]?.id ?? "");
    }
  }, [birthdayUserId, candidates]);

  useEffect(() => {
    if (!testEmail && defaultEmail) setTestEmail(defaultEmail);
  }, [defaultEmail, testEmail]);

  const selected = candidates.find((profile) => profile.id === birthdayUserId) ?? null;
  const productionRecipients = profiles.filter(
    (profile) => profile.active && profile.email?.trim()
  ).length;

  async function sendTest() {
    if (!selected || !/^\S+@\S+\.\S+$/.test(testEmail.trim())) {
      setError("Elegí una persona e ingresá un email de prueba válido.");
      return;
    }

    try {
      setSending(true);
      setError(null);
      setResult(null);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = data.session?.access_token;
      if (!token) throw new Error("No hay una sesión activa.");

      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: testEmail.trim(),
          birthdayUserId: selected.id,
          eventDate: simulatedDate,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error ?? "No se pudo enviar la prueba.");
      setResult(`Se enviaron 2 emails de prueba a ${testEmail.trim()}.`);
    } catch (sendError: unknown) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  return (
    <SectionCard
      title="Prueba segura de cumpleaños"
      description={`Simulación del ${formatAR(simulatedDate)}. Envía las dos plantillas únicamente a tu email.`}
      icon={<AppIcon name="mail" className="h-4 w-4" />}
      className={open ? "" : "[&>div:first-child]:mb-0"}
      action={
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={sending}
          aria-expanded={open}
          aria-controls="birthday-email-test-content"
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-[11px] font-medium text-lll-text-soft transition hover:text-lll-text disabled:cursor-wait disabled:opacity-60"
        >
          {open ? "Cerrar" : "Abrir"}
          <AppIcon
            name="arrowRight"
            className={`h-3.5 w-3.5 transition-transform ${
              open ? "-rotate-90" : "rotate-90"
            }`}
          />
        </button>
      }
    >
      {open ? (
        <div id="birthday-email-test-content" className="lll-fade-in">
          {candidates.length === 0 ? (
            <p className="text-[12px] text-lll-text-soft">
              No hay cumpleaños cargados para el {formatAR(simulatedDate)}.
            </p>
          ) : (
            <div className="space-y-3">
              <FormField label="Simular el cumpleaños de">
                <select
                  value={birthdayUserId}
                  onChange={(event) => {
                    setBirthdayUserId(event.target.value);
                    setResult(null);
                    setError(null);
                  }}
                  disabled={sending}
                  className={formControlClassName}
                >
                  {candidates.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profileName(profile)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Enviar solamente a">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(event) => {
                    setTestEmail(event.target.value);
                    setResult(null);
                    setError(null);
                  }}
                  placeholder="tu-email@empresa.com"
                  disabled={sending}
                  readOnly={lockEmail}
                  className={formControlClassName}
                />
              </FormField>

              <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-[11px] leading-5 text-lll-text-soft">
                <p>La prueba envía un recordatorio general y el saludo personalizado.</p>
                <p>
                  En producción, este cumpleaños alcanzaría a {productionRecipients} email
                  {productionRecipients === 1 ? "" : "s"} activos.
                </p>
              </div>

              {error ? <p role="alert" className="text-[12px] text-red-300">{error}</p> : null}
              {result ? <p role="status" className="text-[12px] text-emerald-300">{result}</p> : null}

              <button
                type="button"
                onClick={sendTest}
                disabled={sending || !selected}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AppIcon name={sending ? "clock" : "mail"} className="h-4 w-4" />
                {sending ? "Enviando…" : "Enviar 2 emails de prueba"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
