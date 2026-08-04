import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function addOneDayISO(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function createCalendarEvent(absence: {
  user_name: string;
  user_email?: string | null;
  type: string;
  date_from: string;
  date_to: string;
  eventId?: string | null;
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

  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  const employeeEmail = absence.user_email?.trim();
  const attendees = employeeEmail
    ? [{ email: employeeEmail, displayName: absence.user_name }]
    : undefined;

  const eventPayload = {
    summary: `[LLL] ${absence.type} - ${absence.user_name}`,
    description: `Desde ${absence.date_from} hasta ${absence.date_to}`,
    start: { date: absence.date_from },
    end: { date: addOneDayISO(absence.date_to) },
    attendees,
  };

  if (absence.eventId) {
    const updated = await calendar.events.update({
      calendarId,
      eventId: absence.eventId,
      sendUpdates: attendees ? "all" : "none",
      requestBody: eventPayload,
    });

    return updated.data.id;
  }

  const created = await calendar.events.insert({
    calendarId,
    sendUpdates: attendees ? "all" : "none",
    requestBody: eventPayload,
  });

  return created.data.id;
}
