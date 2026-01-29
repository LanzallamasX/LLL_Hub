import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isValidEmail(e: string) {
  return typeof e === "string" && e.includes("@");
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Server misconfigured (missing env vars)" },
        { status: 500 }
      );
    }

    // 1) auth del caller (bearer token)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const supaAnonCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: caller, error: callerErr } = await supaAnonCaller.auth.getUser();
    if (callerErr || !caller?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2) validar owner (server-side) + preparar admin
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ownerProfile, error: ownerErr } = await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id", caller.user.id)
      .maybeSingle();

    if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 400 });

    if (!ownerProfile || ownerProfile.role !== "owner" || ownerProfile.active !== true) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // 3) payload
    const body = await req.json().catch(() => ({}));
    const emailRaw = String(body?.email ?? "").trim().toLowerCase();

    if (!isValidEmail(emailRaw)) {
      return NextResponse.json({ error: "Missing/invalid email" }, { status: 400 });
    }

    // 4) gate allowlist (si querés que SOLO puedan los allowlisted)
    //    - si querés permitir recovery a cualquiera, podés sacar este bloque.
    const { data: allow, error: allowErr } = await admin
      .from("allowed_users")
      .select("email,is_active")
      .ilike("email", emailRaw)
      .maybeSingle();

    if (allowErr) return NextResponse.json({ error: allowErr.message }, { status: 400 });

    if (!allow) {
      return NextResponse.json(
        { error: "Este email no está en allowlist." },
        { status: 400 }
      );
    }

    if (allow.is_active !== true) {
      return NextResponse.json(
        { error: "Este email está en allowlist pero está inactivo." },
        { status: 400 }
      );
    }

    // 5) estrategia:
    //    A) intentamos INVITE (si no existe, manda email)
    //    B) si ya existe, hacemos RESET (manda email)
    //
    // redirectTo:
    // - para invite, puede ir a /auth/callback o una pantalla tuya
    // - para reset, debe ir a /auth/reset-password (tu page)
    const inviteRedirectTo = appUrl ? `${appUrl}/auth/callback` : undefined;
    const resetRedirectTo = appUrl ? `${appUrl}/auth/reset-password` : undefined;

    // A) INVITE: crea si no existe y manda email
    const inviteRes = await admin.auth.admin.inviteUserByEmail(emailRaw, {
      redirectTo: inviteRedirectTo,
    });

    if (!inviteRes.error) {
      return NextResponse.json({ ok: true, mode: "invite" });
    }

    // Si ya existe, Supabase suele devolver error del estilo "User already registered"
    // (el string exacto puede variar según versión/stack). En ese caso, mandamos RESET.
    const msg = String(inviteRes.error.message || "");

    const looksLikeAlreadyExists =
      msg.toLowerCase().includes("already") ||
      msg.toLowerCase().includes("registered") ||
      msg.toLowerCase().includes("exists");

    if (!looksLikeAlreadyExists) {
      // Si falló por otro motivo, devolvemos el error real
      return NextResponse.json({ error: inviteRes.error.message }, { status: 400 });
    }

    // B) RESET: manda recovery email si el user existe
    const supaAnon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: resetErr } = await supaAnon.auth.resetPasswordForEmail(emailRaw, {
      redirectTo: resetRedirectTo,
    });

    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mode: "reset" });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
