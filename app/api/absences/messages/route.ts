import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProfileRole = "owner" | "user";

type MessageRow = {
  id: string;
  absence_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: ProfileRole | null;
};

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
}

function cleanBody(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getContext(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.active !== true) {
    return { error: Response.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return {
    user,
    profile: profile as { id: string; role: ProfileRole; active: boolean },
    supabase,
  };
}

async function assertCanAccessAbsence(
  supabase: SupabaseClient,
  absenceId: string,
  userId: string,
  role: ProfileRole
) {
  const { data: absence, error } = await supabase
    .from("absences")
    .select("id,user_id")
    .eq("id", absenceId)
    .single();

  if (error || !absence) return false;

  const row = absence as { id: string; user_id: string };
  return role === "owner" || row.user_id === userId;
}

async function listMessages(supabase: SupabaseClient, absenceId: string) {
  const { data: messages, error: messagesError } = await supabase
    .from("absence_messages")
    .select("id,absence_id,author_id,body,created_at")
    .eq("absence_id", absenceId)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  const rows = (messages ?? []) as MessageRow[];
  const authorIds = Array.from(new Set(rows.map((message) => message.author_id)));

  const profilesById = new Map<string, ProfileRow>();

  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .in("id", authorIds);

    if (profilesError) throw profilesError;

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      profilesById.set(profile.id, profile);
    }
  }

  return rows.map((message) => {
    const profile = profilesById.get(message.author_id);

    return {
      id: message.id,
      absence_id: message.absence_id,
      author_id: message.author_id,
      body: message.body,
      created_at: message.created_at,
      author_full_name: profile?.full_name ?? null,
      author_email: profile?.email ?? null,
      author_role: profile?.role ?? null,
    };
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const absenceId = url.searchParams.get("absenceId");

    if (!absenceId) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getContext(req);
    if ("error" in ctx) return ctx.error;

    const canAccess = await assertCanAccessAbsence(
      ctx.supabase,
      absenceId,
      ctx.user.id,
      ctx.profile.role
    );

    if (!canAccess) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const messages = await listMessages(ctx.supabase, absenceId);
    return Response.json({ messages });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { absenceId, body } = await req.json();
    const clean = cleanBody(body);

    if (!absenceId || typeof absenceId !== "string" || !clean) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getContext(req);
    if ("error" in ctx) return ctx.error;

    const canAccess = await assertCanAccessAbsence(
      ctx.supabase,
      absenceId,
      ctx.user.id,
      ctx.profile.role
    );

    if (!canAccess) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await ctx.supabase.from("absence_messages").insert({
      absence_id: absenceId,
      author_id: ctx.user.id,
      body: clean,
    });

    if (error) throw error;

    const messages = await listMessages(ctx.supabase, absenceId);
    return Response.json({ messages });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
