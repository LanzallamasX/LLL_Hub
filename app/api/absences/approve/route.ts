import { createClient } from "@supabase/supabase-js";
import { createCalendarEvent } from "@/lib/google/createCalendarEvent";
import { deleteCalendarEvent } from "@/lib/google/deleteCalendarEvent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔥 1. Actualizar estado
    const { data, error } = await supabase.rpc("set_absence_status", {
      p_absence_id: id,
      p_status: status,
    });

    if (error) throw error;

    const absence = Array.isArray(data) ? data[0] : data;

    if (!absence) {
      throw new Error("Absence not found after update");
    }

    // 🔥 2. SI APRUEBAN → crear evento (si no existe)
    if (status === "aprobado" && !absence.google_event_id) {
      try {
        const eventId = await createCalendarEvent({
          user_name: absence.user_name,
          type: absence.type,
          date_from: absence.date_from,
          date_to: absence.date_to,
          eventId: absence.google_event_id, // 👈 clave
        });

        if (eventId) {
          await supabase
            .from("absences")
            .update({ google_event_id: eventId })
            .eq("id", absence.id);

          // 👉 sincronizamos objeto en memoria
          absence.google_event_id = eventId;
        }
      } catch (err) {
        console.error("Calendar create error:", err);
      }
    }

    // 🗑 3. SI RECHAZAN → borrar evento (si existe)
    if ((status === "rechazado" || status === "pendiente") && absence.google_event_id) {
      try {
        await deleteCalendarEvent(absence.google_event_id);

        await supabase
          .from("absences")
          .update({ google_event_id: null })
          .eq("id", absence.id);

        // 👉 sincronizamos objeto en memoria
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