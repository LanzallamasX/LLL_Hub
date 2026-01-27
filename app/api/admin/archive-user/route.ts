import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function formatDateYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function buildArchivedEmail(oldEmail: string, userId: string) {
  const lower = (oldEmail ?? "").toLowerCase();
  const at = lower.indexOf("@");
  if (at === -1) return `archived-${userId}@invalid.local`;

  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  const stamp = formatDateYYYYMMDD(new Date());
  const short = userId.slice(0, 8);

  // ej: agustin+archived-20260127-1a2b3c4d@lanzallamas.tv
  return `${local}+archived-${stamp}-${short}@${domain}`;
}

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

    // 2) validar owner (server-side)
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ownerProfile, error: ownerErr } = await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id", caller.user.id)
      .maybeSingle();

    if (ownerErr) {
      return NextResponse.json({ error: ownerErr.message }, { status: 400 });
    }

    if (!ownerProfile || ownerProfile.role !== "owner" || ownerProfile.active !== true) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // 3) payload
    const body = await req.json();
    const userId = body?.userId as string | undefined;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 4) buscar profile target (para obtener email actual)
    const { data: targetProfile, error: targetErr } = await admin
      .from("profiles")
      .select("id,email,active")
      .eq("id", userId)
      .maybeSingle();

    if (targetErr) {
      return NextResponse.json({ error: targetErr.message }, { status: 400 });
    }
    if (!targetProfile?.email) {
      return NextResponse.json({ error: "Target profile has no email" }, { status: 400 });
    }

    const oldEmail = String(targetProfile.email).toLowerCase();
    const archivedEmail = buildArchivedEmail(oldEmail, userId);

    // 5) eliminar allowlist del email viejo (libera el mail)
    // (si existía pre-alta)
    const { error: delAllowErr } = await admin
      .from("allowed_users")
      .delete()
      .ilike("email", oldEmail);

    if (delAllowErr) {
      return NextResponse.json({ error: delAllowErr.message }, { status: 400 });
    }

    // 6) actualizar profiles.email -> archived + desactivar
    const { error: updProfileErr } = await admin
      .from("profiles")
      .update({ email: archivedEmail, active: false })
      .eq("id", userId);

    if (updProfileErr) {
      return NextResponse.json({ error: updProfileErr.message }, { status: 400 });
    }

    // 7) actualizar auth.users email -> archived
    // Nota: Supabase puede disparar confirmación según settings del proyecto.
    const { error: updAuthErr } = await admin.auth.admin.updateUserById(userId, {
      email: archivedEmail,
      // Si tu proyecto lo soporta, podés forzar confirmado:
      // email_confirm: true,
    });

    if (updAuthErr) {
      return NextResponse.json({ error: updAuthErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      oldEmail,
      archivedEmail,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
