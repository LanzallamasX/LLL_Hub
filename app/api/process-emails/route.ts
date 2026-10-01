export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { processEmailOutbox } from "@/lib/server/processEmailOutbox";

async function isAuthorized(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey || !serviceKey) return false;

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return false;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("active")
    .eq("id", data.user.id)
    .maybeSingle();

  return profile?.active === true;
}

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const result = await processEmailOutbox();
    return Response.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Email worker failed";
    console.error("Email worker failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
