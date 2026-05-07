import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("google_integrations")
    .select("*")
    .limit(1)
    .single();

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

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: "[LLL TEST] Vacaciones - Patricio",
      description: "Test desde LLL Hub",
      start: { date: "2026-04-25" },
      end: { date: "2026-04-28" },
    },
  });

  return new Response("Event created");
}