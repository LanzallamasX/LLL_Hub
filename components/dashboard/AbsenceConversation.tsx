"use client";

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/contexts/AuthContext";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { formatAR, formatARDateTime } from "@/lib/date";
import { getAbsenceTimeRangeLabel } from "@/lib/absences/timeRange";
import {
  createAbsenceMessage,
  listAbsenceMessages,
  listMyAbsenceMessageUnreadCounts,
  markAbsenceMessagesRead,
  type AbsenceMessage,
} from "@/lib/supabase/absenceMessages";
import type { Absence } from "@/lib/supabase/absences";
import { AppIcon } from "@/components/ui/AppIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBodyScrollLock } from "@/components/ui/useBodyScrollLock";
import { usePresence } from "@/components/ui/usePresence";

type Props = {
  absence: Absence;
  defaultOpen?: boolean;
};

const messagesCache = new Map<string, AbsenceMessage[]>();
const messagesRequests = new Map<string, Promise<AbsenceMessage[]>>();

async function loadConversation(absenceId: string) {
  const currentRequest = messagesRequests.get(absenceId);
  if (currentRequest) return currentRequest;

  const request = listAbsenceMessages(absenceId).then((messages) => {
    messagesCache.set(absenceId, messages);
    return messages;
  });

  messagesRequests.set(absenceId, request);
  try {
    return await request;
  } finally {
    messagesRequests.delete(absenceId);
  }
}

function statusMeta(status: Absence["status"]) {
  if (status === "aprobado") {
    return {
      label: "Aprobada",
      icon: "check" as const,
      className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (status === "rechazado") {
    return {
      label: "Rechazada",
      icon: "close" as const,
      className: "border-red-400/30 bg-red-500/10 text-red-200",
    };
  }

  return {
    label: "Pendiente",
    icon: "clock" as const,
    className: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  };
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export default function AbsenceConversation({ absence, defaultOpen = false }: Props) {
  const { userId, role, fullName, email } = useAuth();
  const cachedMessages = messagesCache.get(absence.id) ?? null;
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<AbsenceMessage[]>(cachedMessages ?? []);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(defaultOpen && cachedMessages === null);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalPresence = usePresence(open);
  useBodyScrollLock(modalPresence.shouldRender);

  const canReply = Boolean(userId);
  const initialIsMine = absence.userId === userId;
  const currentUserName = useMemo(
    () => fullName || email || "Usuario",
    [fullName, email]
  );
  const visibleCount = messages.length + (absence.note ? 1 : 0);
  const typeLabel = getAbsenceTypeLabel(absence.type, absence.subtype ?? null);
  const timeRangeLabel = getAbsenceTimeRangeLabel(absence);
  const status = statusMeta(absence.status);
  const titleId = `conversation-title-${absence.id}`;

  function getMessageAuthorName(message: AbsenceMessage) {
    if (message.authorId === absence.userId) return absence.userName;
    if (message.authorId === userId) return currentUserName;
    if (message.authorName !== "Usuario") return message.authorName;
    return message.authorRole === "owner" ? "Owner" : "Usuario";
  }

  function closeConversation() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 240);
  }

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (!userId || open) return;

    let alive = true;
    listMyAbsenceMessageUnreadCounts(userId)
      .then((counts) => {
        if (alive) setUnreadCount(counts.get(absence.id) ?? 0);
      })
      .catch(() => {
        if (alive) setUnreadCount(0);
      });

    return () => {
      alive = false;
    };
  }, [userId, absence.id, open]);

  useEffect(() => {
    if (!open || !userId) return;

    let alive = true;
    const cached = messagesCache.get(absence.id) ?? null;
    if (cached) {
      setMessages(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    loadConversation(absence.id)
      .then(async (data) => {
        if (!alive) return;
        setMessages(data);

        try {
          await markAbsenceMessagesRead(absence.id, userId);
          if (alive) setUnreadCount(0);
        } catch {
          // El historial sigue disponible aunque falle la confirmación de lectura.
        }
      })
      .catch(() => {
        if (alive) setError("No se pudo cargar la conversación.");
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [open, absence.id, userId]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: messages.length > 0 ? "smooth" : "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, messages.length]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closeConversation();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
      setMessages((current) => {
        const next = [...current, created];
        messagesCache.set(absence.id, next);
        return next;
      });
      setDraft("");
    } catch {
      setError("No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendMessage();
  }

  const trigger = (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-lll-accent-alt/25 bg-lll-accent-alt/10 text-lll-accent-alt">
          <AppIcon name="note" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-lll-text">Conversación</p>
          <p className="truncate text-[11px] text-lll-text-soft">
            {visibleCount > 0
              ? `${visibleCount} ${visibleCount === 1 ? "mensaje" : "mensajes"}`
              : "Abrí el historial o agregá contexto"}
          </p>
        </div>
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-lll-border bg-lll-bg-soft px-3 py-2 text-[12px] font-semibold text-lll-text transition hover:border-lll-accent/40 hover:bg-lll-accent-soft sm:w-auto"
        aria-haspopup="dialog"
      >
        {unreadCount > 0 ? (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lll-accent px-1 text-[10px] font-bold text-black"
            aria-label={`${unreadCount} sin leer`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : (
          <AppIcon name="note" className="h-3.5 w-3.5 text-lll-accent-alt" />
        )}
        Ver conversación
        <AppIcon name="arrowRight" className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const modal =
    modalPresence.shouldRender && typeof document !== "undefined"
      ? createPortal(
          <div
            className="lll-presence-root fixed inset-0 z-[70] flex items-end justify-center overflow-hidden sm:items-center sm:p-4"
            data-state={modalPresence.state}
            role="dialog"
            aria-modal="true"
            aria-hidden={!open}
            aria-labelledby={titleId}
          >
            <button
              type="button"
              className="lll-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-[3px]"
              onClick={closeConversation}
              aria-label="Cerrar conversación"
            />

            <section className="lll-modal-panel relative flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-lll-border bg-lll-bg-soft shadow-2xl sm:h-[min(78dvh,760px)] sm:rounded-3xl">
              <header className="shrink-0 border-b border-lll-border bg-lll-bg-soft/95 px-4 py-4 backdrop-blur sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-lll-accent-alt/25 bg-lll-accent-alt/10 text-lll-accent-alt">
                      <AppIcon name="note" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id={titleId} className="text-base font-semibold text-lll-text">
                          Conversación
                        </h2>
                        {refreshing ? (
                          <span className="text-[10px] text-lll-text-soft">Actualizando…</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-lll-text-soft">
                        {absence.userName} · {typeLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-lll-text-soft">
                        {formatAR(absence.from)} → {formatAR(absence.to)}
                        {timeRangeLabel ? ` · ${timeRangeLabel}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${status.className}`}
                    >
                      <AppIcon name={status.icon} className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                    <button
                      type="button"
                      onClick={closeConversation}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft transition hover:text-lll-text"
                      aria-label="Cerrar"
                    >
                      <AppIcon name="close" className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.className}`}
                  >
                    <AppIcon name={status.icon} className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                  <span className="text-[11px] text-lll-text-soft">
                    {visibleCount} {visibleCount === 1 ? "mensaje" : "mensajes"}
                  </span>
                </div>
              </header>

              <div
                ref={listRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-lll-bg/55 px-4 py-5 overscroll-contain sm:px-5"
                aria-live="polite"
              >
                {absence.note ? (
                  <div className={`flex ${initialIsMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl border px-3.5 py-3 sm:max-w-[78%] ${
                        initialIsMine
                          ? "rounded-br-md border-lll-accent-alt/30 bg-lll-accent-alt/10"
                          : "rounded-bl-md border-lll-border bg-lll-bg-soft"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-lll-text-soft">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-lll-border bg-lll-bg-softer text-[9px] font-bold text-lll-text">
                          {initials(absence.userName)}
                        </span>
                        <span className="font-semibold text-lll-text">{absence.userName}</span>
                        <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px]">
                          Solicitud original
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-lll-text">
                        {absence.note}
                      </p>
                      <p className="mt-2 text-right text-[10px] text-lll-text-soft">
                        {formatARDateTime(absence.createdAt)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {loading ? (
                  <div className="space-y-3" role="status" aria-label="Cargando mensajes">
                    <div className="w-3/4 rounded-2xl border border-lll-border bg-lll-bg-soft p-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="mt-2 h-4 w-full" />
                      <Skeleton className="mt-2 h-2.5 w-20" />
                    </div>
                    <div className="ml-auto w-2/3 rounded-2xl border border-lll-border bg-lll-bg-soft p-3">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="mt-2 h-4 w-full" />
                    </div>
                  </div>
                ) : null}

                {!loading && !absence.note && messages.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lll-border bg-lll-bg-soft text-lll-accent-alt">
                      <AppIcon name="note" className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-lll-text">Todavía no hay mensajes</p>
                    <p className="mt-1 max-w-sm text-[12px] text-lll-text-soft">
                      Podés iniciar la conversación para pedir información o agregar contexto.
                    </p>
                  </div>
                ) : null}

                {!loading &&
                  messages.map((message) => {
                    const mine = message.authorId === userId;
                    const authorName = getMessageAuthorName(message);

                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl border px-3.5 py-3 sm:max-w-[78%] ${
                            mine
                              ? "rounded-br-md border-lll-accent-alt/30 bg-lll-accent-alt/10"
                              : "rounded-bl-md border-lll-border bg-lll-bg-soft"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-[11px] text-lll-text-soft">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-lll-border bg-lll-bg-softer text-[9px] font-bold text-lll-text">
                              {initials(authorName)}
                            </span>
                            <span className="font-semibold text-lll-text">{authorName}</span>
                            {message.authorRole === "owner" ? (
                              <span className="rounded-full border border-lll-accent-alt/20 bg-lll-accent-alt/10 px-1.5 py-0.5 text-[9px] text-lll-accent-alt">
                                Owner
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-lll-text">
                            {message.body}
                          </p>
                          <p className="mt-2 text-right text-[10px] text-lll-text-soft">
                            {formatARDateTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <footer className="shrink-0 border-t border-lll-border bg-lll-bg-soft px-3 py-3 sm:px-5 sm:py-4">
                {error ? (
                  <div className="mb-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-end gap-2 rounded-2xl border border-lll-border bg-lll-bg-softer p-2 transition focus-within:border-lll-accent/40">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-lll-text outline-none placeholder:text-lll-text-soft"
                    placeholder={
                      role === "owner"
                        ? "Escribí una pregunta o respuesta…"
                        : "Respondé o agregá contexto…"
                    }
                    rows={2}
                    maxLength={2000}
                    disabled={!canReply || sending}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!canReply || sending || !draft.trim()}
                    className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition sm:px-4 ${
                      canReply && draft.trim() && !sending
                        ? "bg-lll-accent text-black hover:brightness-110"
                        : "cursor-not-allowed bg-lll-bg-soft text-lll-text-soft"
                    }`}
                  >
                    <AppIcon
                      name={sending ? "clock" : "arrowRight"}
                      className="h-4 w-4"
                    />
                    <span className="hidden sm:inline">{sending ? "Enviando…" : "Enviar"}</span>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-lll-text-soft">
                  <span>Enter para enviar · Shift + Enter para nueva línea</span>
                  <span>{draft.length}/2000</span>
                </div>
              </footer>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {modal}
    </>
  );
}
