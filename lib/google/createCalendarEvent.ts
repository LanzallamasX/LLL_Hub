import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export async function createCalendarEvent(absence: {
  user_name: string;
  type: string;
  date_from: string;
  date_to: string;
  eventId?: string | null; // 👈 clave para update
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("google_integrations")
    .select("*")
    .limit(1)
    .single();

  if (!data) {
    throw new Error("No Google tokens found");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client,
  });

  const eventPayload = {
    summary: `[LLL] ${absence.type} - ${absence.user_name}`,
    description: `Desde ${absence.date_from} hasta ${absence.date_to}`,
    start: { date: absence.date_from },
    end: { date: absence.date_to },
  };

  // ✏️ UPDATE si ya existe
  if (absence.eventId) {
    const updated = await calendar.events.update({
      calendarId: "primary",
      eventId: absence.eventId,
      requestBody: eventPayload,
    });

    return updated.data.id;
  }

  // 🆕 CREATE si no existe
  const created = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventPayload,
  });

  return created.data.id;
}