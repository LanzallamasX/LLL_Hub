import { supabase } from "@/lib/supabase/client";

const ABSENCE_MESSAGE_INSERT_SELECT = `
  id,
  absence_id,
  author_id,
  body,
  created_at
`;

const LEGACY_ABSENCE_MESSAGES_SELECT = `
  id,
  absence_id,
  author_id,
  body,
  created_at,
  author_profile:profiles!absence_messages_author_id_fkey(full_name,email,role)
`;

export type AbsenceMessageRow = {
  id: string;
  absence_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_full_name: string | null;
  author_email: string | null;
  author_role: "owner" | "user" | null;
};

type LegacyAbsenceMessageRow = {
  id: string;
  absence_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_profile?: {
    full_name: string | null;
    email: string | null;
    role: "owner" | "user" | null;
  } | null;
};

type InsertedAbsenceMessageRow = {
  id: string;
  absence_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type AbsenceMessage = {
  id: string;
  absenceId: string;
  authorId: string;
  authorName: string;
  authorRole: "owner" | "user" | null;
  body: string;
  createdAt: string;
};

function mapRowToMessage(row: AbsenceMessageRow): AbsenceMessage {
  return {
    id: row.id,
    absenceId: row.absence_id,
    authorId: row.author_id,
    authorName: row.author_full_name || row.author_email || "Usuario",
    authorRole: row.author_role ?? null,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapLegacyRowToMessage(row: LegacyAbsenceMessageRow): AbsenceMessage {
  return {
    id: row.id,
    absenceId: row.absence_id,
    authorId: row.author_id,
    authorName:
      row.author_profile?.full_name ||
      row.author_profile?.email ||
      "Usuario",
    authorRole: row.author_profile?.role ?? null,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapInsertedRowToMessage(row: InsertedAbsenceMessageRow): AbsenceMessage {
  return {
    id: row.id,
    absenceId: row.absence_id,
    authorId: row.author_id,
    authorName: "Usuario",
    authorRole: null,
    body: row.body,
    createdAt: row.created_at,
  };
}

async function getSessionToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function listAbsenceMessagesFromApi(absenceId: string): Promise<AbsenceMessage[]> {
  const token = await getSessionToken();
  if (!token) throw new Error("No session token");

  const res = await fetch(`/api/absences/messages?absenceId=${encodeURIComponent(absenceId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Error loading absence messages");

  const payload = (await res.json()) as { messages?: AbsenceMessageRow[] };
  return (payload.messages ?? []).map((row) => mapRowToMessage(row));
}

async function createAbsenceMessageFromApi(input: {
  absenceId: string;
  body: string;
}): Promise<AbsenceMessage> {
  const token = await getSessionToken();
  if (!token) throw new Error("No session token");

  const res = await fetch("/api/absences/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      absenceId: input.absenceId,
      body: input.body,
    }),
  });

  if (!res.ok) throw new Error("Error creating absence message");

  const payload = (await res.json()) as { messages?: AbsenceMessageRow[] };
  const messages = (payload.messages ?? []).map((row) => mapRowToMessage(row));
  const created = messages.findLast((message) => message.body === input.body);

  return created ?? messages[messages.length - 1];
}

async function listAbsenceMessagesLegacy(absenceId: string): Promise<AbsenceMessage[]> {
  const { data, error } = await supabase
    .from("absence_messages")
    .select(LEGACY_ABSENCE_MESSAGES_SELECT)
    .eq("absence_id", absenceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as LegacyAbsenceMessageRow[]).map((row) =>
    mapLegacyRowToMessage(row)
  );
}

export async function listAbsenceMessages(absenceId: string): Promise<AbsenceMessage[]> {
  try {
    return await listAbsenceMessagesFromApi(absenceId);
  } catch {
    // Fallback while the local API/server is not available.
  }

  const { data, error } = await supabase.rpc("list_absence_messages", {
    p_absence_id: absenceId,
  });

  if (error) return listAbsenceMessagesLegacy(absenceId);

  return ((data ?? []) as unknown as AbsenceMessageRow[]).map((row) =>
    mapRowToMessage(row)
  );
}

export async function createAbsenceMessage(input: {
  absenceId: string;
  authorId: string;
  body: string;
}): Promise<AbsenceMessage> {
  const cleanBody = input.body.trim();
  if (!cleanBody) throw new Error("El mensaje no puede estar vacio.");

  try {
    return await createAbsenceMessageFromApi({
      absenceId: input.absenceId,
      body: cleanBody,
    });
  } catch {
    // Fallback to direct insert while the local API/server is not available.
  }

  const { data, error } = await supabase
    .from("absence_messages")
    .insert({
      absence_id: input.absenceId,
      author_id: input.authorId,
      body: cleanBody,
    })
    .select(ABSENCE_MESSAGE_INSERT_SELECT)
    .single();

  if (error) throw error;

  const messages = await listAbsenceMessages(input.absenceId);
  const created = messages.findLast(
    (message) => message.authorId === input.authorId && message.body === cleanBody
  );

  return created ?? messages[messages.length - 1] ?? mapInsertedRowToMessage(data as unknown as InsertedAbsenceMessageRow);
}
