import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type BlockedAbsenceType = "vacaciones" | "home_office";
type OwnerContext = { admin: SupabaseClient; callerId: string };

const allowedTypes = new Set<BlockedAbsenceType>(["vacaciones", "home_office"]);

function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTypes(value: unknown): BlockedAbsenceType[] | null {
  if (!Array.isArray(value)) return null;
  const types = Array.from(new Set(value));
  if (
    types.length === 0 ||
    !types.every(
      (item): item is BlockedAbsenceType =>
        typeof item === "string" && allowedTypes.has(item as BlockedAbsenceType)
    )
  ) {
    return null;
  }
  return types;
}

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unknown error";
}

async function getOwnerAdmin(req: Request): Promise<OwnerContext | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured (missing env vars)" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await authClient.auth.getUser();

  if (callerError || !caller.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role,active")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  if (!profile || profile.role !== "owner" || profile.active !== true) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return { admin, callerId: caller.user.id };
}

function parsePayload(body: unknown) {
  const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const dateFrom = source.dateFrom;
  const dateTo = source.dateTo;
  const absenceTypes = normalizeTypes(source.absenceTypes);
  const reason = typeof source.reason === "string" ? source.reason.trim() : "";
  const active = source.active === undefined ? true : source.active;

  if (!isISODate(dateFrom) || !isISODate(dateTo) || dateTo < dateFrom) {
    return { error: "El rango de fechas no es válido." } as const;
  }
  if (!absenceTypes) {
    return { error: "Elegí al menos un tipo de solicitud." } as const;
  }
  if (!reason || reason.length > 160) {
    return { error: "El motivo es obligatorio y admite hasta 160 caracteres." } as const;
  }
  if (typeof active !== "boolean") {
    return { error: "El estado no es válido." } as const;
  }

  return { dateFrom, dateTo, absenceTypes, reason, active } as const;
}

function isOwnerContext(value: OwnerContext | NextResponse): value is OwnerContext {
  return "admin" in value;
}

const selectFields =
  "id,date_from,date_to,absence_types,reason,active,created_by,created_at,updated_at";

export async function GET(req: Request) {
  const ctx = await getOwnerAdmin(req);
  if (!isOwnerContext(ctx)) return ctx;

  const { data, error } = await ctx.admin
    .from("absence_blocked_periods")
    .select(selectFields)
    .order("date_from", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ periods: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const ctx = await getOwnerAdmin(req);
    if (!isOwnerContext(ctx)) return ctx;

    const parsed = parsePayload(await req.json());
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data, error } = await ctx.admin
      .from("absence_blocked_periods")
      .insert({
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
        absence_types: parsed.absenceTypes,
        reason: parsed.reason,
        active: parsed.active,
        created_by: ctx.callerId,
      })
      .select(selectFields)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ period: data }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getOwnerAdmin(req);
    if (!isOwnerContext(ctx)) return ctx;

    const body: unknown = await req.json();
    const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const id = typeof source.id === "string" ? source.id : "";
    if (!id) return NextResponse.json({ error: "Falta el período." }, { status: 400 });

    const parsed = parsePayload(source);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data, error } = await ctx.admin
      .from("absence_blocked_periods")
      .update({
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
        absence_types: parsed.absenceTypes,
        reason: parsed.reason,
        active: parsed.active,
      })
      .eq("id", id)
      .select(selectFields)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ period: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ctx = await getOwnerAdmin(req);
  if (!isOwnerContext(ctx)) return ctx;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el período." }, { status: 400 });

  const { error } = await ctx.admin.from("absence_blocked_periods").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
