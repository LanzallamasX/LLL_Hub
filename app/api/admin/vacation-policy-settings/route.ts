import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PolicyMode = "anniversary" | "october";

function isPolicyMode(value: unknown): value is PolicyMode {
  return value === "anniversary" || value === "october";
}

function isISODateOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

async function getOwnerAdmin(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !anonKey || !serviceKey) {
    return {
      error: NextResponse.json({ error: "Server misconfigured (missing env vars)" }, { status: 500 }),
    };
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) {
    return { error: NextResponse.json({ error: "Missing bearer token" }, { status: 401 }) };
  }

  const supaAnon = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: caller, error: callerErr } = await supaAnon.auth.getUser();
  if (callerErr || !caller?.user) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ownerProfile, error: ownerErr } = await admin
    .from("profiles")
    .select("id,role,active")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (ownerErr) {
    return { error: NextResponse.json({ error: ownerErr.message }, { status: 400 }) };
  }

  if (!ownerProfile || ownerProfile.role !== "owner" || ownerProfile.active !== true) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return { admin, callerId: caller.user.id };
}

export async function GET(req: Request) {
  try {
    const ctx = await getOwnerAdmin(req);
    if (ctx.error) return ctx.error;

    const { data, error } = await ctx.admin
      .from("vacation_policy_settings")
      .select("policy_mode,cycle_start_month,effective_from,preview_enabled,updated_at")
      .eq("id", true)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      settings: data ?? {
        policy_mode: "anniversary",
        cycle_start_month: 10,
        effective_from: null,
        preview_enabled: true,
        updated_at: null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getOwnerAdmin(req);
    if (ctx.error) return ctx.error;

    const body = await req.json();
    const policyMode = body?.policyMode;
    const cycleStartMonth = Number(body?.cycleStartMonth ?? 10);
    const effectiveFrom = body?.effectiveFrom ?? null;
    const note = typeof body?.note === "string" ? body.note.trim() : null;

    if (!isPolicyMode(policyMode)) {
      return NextResponse.json({ error: "Invalid policyMode" }, { status: 400 });
    }
    if (!Number.isInteger(cycleStartMonth) || cycleStartMonth < 1 || cycleStartMonth > 12) {
      return NextResponse.json({ error: "Invalid cycleStartMonth" }, { status: 400 });
    }
    if (!isISODateOrNull(effectiveFrom)) {
      return NextResponse.json({ error: "Invalid effectiveFrom" }, { status: 400 });
    }

    const { data: oldSettings, error: oldErr } = await ctx.admin
      .from("vacation_policy_settings")
      .select("policy_mode,cycle_start_month,effective_from")
      .eq("id", true)
      .maybeSingle();

    if (oldErr) return NextResponse.json({ error: oldErr.message }, { status: 400 });

    const { data: settings, error: updateErr } = await ctx.admin
      .from("vacation_policy_settings")
      .upsert(
        {
          id: true,
          policy_mode: policyMode,
          cycle_start_month: cycleStartMonth,
          effective_from: effectiveFrom,
          preview_enabled: true,
          updated_by: ctx.callerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("policy_mode,cycle_start_month,effective_from,preview_enabled,updated_at")
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    const { error: auditErr } = await ctx.admin.from("vacation_policy_changes").insert({
      changed_by: ctx.callerId,
      old_mode: oldSettings?.policy_mode ?? null,
      new_mode: policyMode,
      old_effective_from: oldSettings?.effective_from ?? null,
      new_effective_from: effectiveFrom,
      old_cycle_start_month: oldSettings?.cycle_start_month ?? null,
      new_cycle_start_month: cycleStartMonth,
      note,
    });

    if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 400 });

    return NextResponse.json({ settings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
