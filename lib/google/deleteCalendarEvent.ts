import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export async function deleteCalendarEvent(eventId: string) {
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

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}