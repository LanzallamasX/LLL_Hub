import { createClient } from "@supabase/supabase-js";
import { createCalendarEvent } from "@/lib/google/createCalendarEvent";
import { deleteCalendarEvent } from "@/lib/google/deleteCalendarEvent";

export const runtime = "nodejs";

const ABSENCE_STATUSES = new Set(["pendiente", "aprobado", "rechazado"]);

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
}

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || typeof id !== "string" || !ABSENCE_STATUSES.has(status)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const token = getBearerToken(req);
    if (!token) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

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
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "owner" || profile.active !== true) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const updatePayload =
      status === "pendiente"
        ? { status, decided_by: null, decided_at: null }
        : { status, decided_by: user.id, decided_at: new Date().toISOString() };

    const { data: absence, error } = await supabase
      .from("absences")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    if (!absence) {
      throw new Error("Absence not found after update");
    }

    if (status === "aprobado" && !absence.google_event_id) {
      try {
        const { data: employeeProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", absence.user_id)
          .maybeSingle();

        const eventId = await createCalendarEvent({
          user_name: absence.user_name,
          user_email: employeeProfile?.email ?? null,
          type: absence.type,
          date_from: absence.date_from,
          date_to: absence.date_to,
          eventId: absence.google_event_id,
        });

        if (eventId) {
          await supabase
            .from("absences")
            .update({ google_event_id: eventId })
            .eq("id", absence.id);

          absence.google_event_id = eventId;
        }
      } catch (err) {
        console.error("Calendar create error:", err);
      }
    }

    if ((status === "rechazado" || status === "pendiente") && absence.google_event_id) {
      try {
        await deleteCalendarEvent(absence.google_event_id);

        await supabase
          .from("absences")
          .update({ google_event_id: null })
          .eq("id", absence.id);

        absence.google_event_id = null;
      } catch (err) {
        console.error("Calendar delete error:", err);
      }
    }

    return Response.json({ absence });
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
