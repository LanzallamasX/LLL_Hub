import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  birthdayGreetingTemplate,
  birthdayReminderTemplate,
} from "@/lib/email/birthdayTemplates";

export const runtime = "nodejs";

type OwnerContext = { admin: SupabaseClient; ownerEmail: string };

function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isOwnerContext(value: OwnerContext | Response): value is OwnerContext {
  return "admin" in value;
}

async function getOwnerContext(req: Request): Promise<OwnerContext | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!url || !anonKey || !serviceKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await authClient.auth.getUser();
  if (callerError || !caller.user) {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: owner } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (!owner || owner.role !== "owner" || owner.active !== true) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const ownerEmail = caller.user.email?.trim() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
    return Response.json({ error: "Tu sesión no tiene un email válido." }, { status: 400 });
  }

  return { admin, ownerEmail };
}

function displayName(profile: {
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}) {
  return (
    profile.full_name?.trim() ||
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    profile.email?.trim() ||
    "Integrante del equipo"
  );
}

export async function POST(req: Request) {
  const ctx = await getOwnerContext(req);
  if (!isOwnerContext(ctx)) return ctx;

  try {
    const body: unknown = await req.json();
    const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const requestedEmail = typeof source.email === "string" ? source.email.trim() : "";
    const email = ctx.ownerEmail;
    const birthdayUserId =
      typeof source.birthdayUserId === "string" ? source.birthdayUserId : "";
    const eventDate = typeof source.eventDate === "string" ? source.eventDate : "";

    if (requestedEmail.toLowerCase() !== email.toLowerCase()) {
      return Response.json(
        { error: "La prueba sólo puede enviarse al email de tu sesión." },
        { status: 403 }
      );
    }
    if (!birthdayUserId) {
      return Response.json({ error: "Elegí una persona para simular." }, { status: 400 });
    }
    if (!isISODate(eventDate)) {
      return Response.json({ error: "La fecha simulada no es válida." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await ctx.admin
      .from("profiles")
      .select("id,email,full_name,first_name,last_name,birth_date,active")
      .eq("id", birthdayUserId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.active) {
      return Response.json({ error: "La persona seleccionada no está activa." }, { status: 400 });
    }
    if (!profile.birth_date || profile.birth_date.slice(5, 10) !== eventDate.slice(5, 10)) {
      return Response.json(
        { error: "La persona seleccionada no cumple años en la fecha simulada." },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("Missing RESEND_API_KEY");
    const resend = new Resend(resendKey);
    const name = displayName(profile);
    const firstName = profile.first_name?.trim() || name.split(/\s+/)[0] || "";
    const reminder = birthdayReminderTemplate(name);
    const greeting = birthdayGreetingTemplate(firstName);

    const reminderResult = await resend.emails.send({
      from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
      to: email,
      subject: `[PRUEBA] ${reminder.subject}`,
      html: reminder.html,
    });
    if (reminderResult.error) throw new Error(reminderResult.error.message);

    const greetingResult = await resend.emails.send({
      from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
      to: email,
      subject: `[PRUEBA] ${greeting.subject}`,
      html: greeting.html,
    });
    if (greetingResult.error) throw new Error(greetingResult.error.message);

    return Response.json({
      success: true,
      recipient: email,
      simulatedEmployee: name,
      sent: 2,
      messageIds: [reminderResult.data?.id, greetingResult.data?.id].filter(Boolean),
    });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "No se pudo enviar la prueba.";
    return Response.json({ error: message }, { status: 500 });
  }
}
