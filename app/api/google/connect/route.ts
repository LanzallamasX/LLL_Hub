// app/api/google/connect/route.ts

import { google } from "googleapis";

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // 🔑 importante para refresh_token
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent", // 🔑 fuerza refresh_token
  });

  return Response.redirect(url);
}