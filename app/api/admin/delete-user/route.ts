import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const supaAnon = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: caller, error: callerErr } = await supaAnon.auth.getUser();
    if (callerErr || !caller?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2) validar owner (server-side) + ejecutar admin
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
    const body = await req.json();
    const userId = body?.userId as string | undefined;
    const email = body?.email as string | undefined; // opcional, para limpiar allowlist

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 4) limpiar allowlist por email si viene
    if (email && typeof email === "string") {
      const { error: delAllowErr } = await admin
        .from("allowed_users")
        .delete()
        .ilike("email", email.toLowerCase());

      if (delAllowErr) {
        return NextResponse.json({ error: delAllowErr.message }, { status: 400 });
      }
    }

    // 5) BORRADO REAL: Auth (cascada profiles -> absences)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
