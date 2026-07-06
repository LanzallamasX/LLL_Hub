"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { formatARDateTime } from "@/lib/date";
import {
  createAbsenceMessage,
  listAbsenceMessages,
  type AbsenceMessage,
} from "@/lib/supabase/absenceMessages";
import type { Absence } from "@/lib/supabase/absences";

type Props = {
  absence: Absence;
  defaultOpen?: boolean;
};

export default function AbsenceConversation({ absence, defaultOpen = false }: Props) {
  const { userId, role, fullName, email } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<AbsenceMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didLoad = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const visibleCount = messages.length + (absence.note ? 1 : 0);

  const canReply = Boolean(userId);
  const initialIsMine = absence.userId === userId;
  const currentUserName = useMemo(() => fullName || email || "Usuario", [fullName, email]);

  function getMessageAuthorName(message: AbsenceMessage) {
    if (message.authorId === absence.userId) return absence.userName;
    if (message.authorId === userId) return currentUserName;
    if (message.authorName !== "Usuario") return message.authorName;
    return message.authorRole === "owner" ? "Owner" : "Usuario";
  }

  useEffect(() => {
    if (!open || didLoad.current) return;

    let alive = true;
    didLoad.current = true;
    setLoading(true);
    setError(null);

    listAbsenceMessages(absence.id)
      .then((data) => {
        if (alive) setMessages(data);
      })
      .catch(() => {
        if (alive) setError("No se pudo cargar la conversacion.");
        didLoad.current = false;
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, absence.id]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages.length]);

  async function sendMessage() {
    if (!userId || sending) return;

    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);

    try {
      const created = await createAbsenceMessage({
        absenceId: absence.id,
        authorId: userId,
        body,
      });
      setMessages((current) => [...current, created]);
      setDraft("");
    } catch {
      setError("No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[12px] font-semibold text-lll-text">
          Conversacion
        </span>
        <span className="shrink-0 rounded-full border border-lll-border bg-lll-bg-soft px-2 py-1 text-[11px] text-lll-text-soft">
          {visibleCount} {visibleCount === 1 ? "mensaje" : "mensajes"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <div
            ref={listRef}
            className="max-h-[260px] space-y-2 overflow-y-auto pr-1"
          >
            {absence.note ? (
              <div className={`flex ${initialIsMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] rounded-xl border px-3 py-2 ${
                    initialIsMine
                      ? "border-lll-accent/30 bg-lll-accent-soft"
                      : "border-lll-border bg-lll-bg-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-lll-text-soft">
                    <span className="font-semibold text-lll-text">{absence.userName}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-lll-text">{absence.note}</p>
                  <p className="mt-1 text-[10px] text-lll-text-soft">
                    {formatARDateTime(absence.createdAt)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                Sin motivo inicial. Usen esta conversacion para pedir y sumar contexto.
              </div>
            )}

            {loading ? (
              <p className="text-[12px] text-lll-text-soft">Cargando mensajes...</p>
            ) : null}

            {!loading &&
              messages.map((message) => {
                const mine = message.authorId === userId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-xl border px-3 py-2 ${
                        mine
                          ? "border-lll-accent/30 bg-lll-accent-soft"
                          : "border-lll-border bg-lll-bg-soft"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-lll-text-soft">
                        <span className="font-semibold text-lll-text">
                          {getMessageAuthorName(message)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-lll-text">{message.body}</p>
                      <p className="mt-1 text-[10px] text-lll-text-soft">
                        {formatARDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>

          {error ? <p className="text-[12px] text-red-300">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[42px] flex-1 resize-y rounded-lg border border-lll-border bg-lll-bg-soft px-3 py-2 text-sm outline-none"
              placeholder={
                role === "owner"
                  ? "Escribi una pregunta o respuesta..."
                  : "Responde o agrega contexto..."
              }
              maxLength={2000}
              disabled={!canReply || sending}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canReply || sending || !draft.trim()}
              className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold ${
                canReply && draft.trim() && !sending
                  ? "bg-lll-accent text-black"
                  : "cursor-not-allowed border border-lll-border bg-lll-bg-soft text-lll-text-soft"
              }`}
            >
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
