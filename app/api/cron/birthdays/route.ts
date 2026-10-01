import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  birthdayGreetingTemplate,
  birthdayReminderTemplate,
} from "@/lib/email/birthdayTemplates";
import { processEmailOutbox } from "@/lib/server/processEmailOutbox";

export const runtime = "nodejs";

function argentinaDateISO() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function birthdayName(profile: {
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

async function runBirthdayTestDelivery(
  admin: SupabaseClient,
  eventDate: string,
  testRecipient: string
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("Missing RESEND_API_KEY");

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id,email,full_name,first_name,last_name,birth_date")
    .eq("active", true)
    .not("birth_date", "is", null);
  if (profilesError) throw profilesError;

  const monthDay = eventDate.slice(5, 10);
  const birthdays = (profiles ?? []).filter(
    (profile) => profile.birth_date?.slice(5, 10) === monthDay
  );
  if (birthdays.length === 0) {
    return { birthdays: 0, processed: 0, failed: 0 };
  }

  const { data: existingRuns, error: runsError } = await admin
    .from("birthday_notification_runs")
    .select("birthday_user_id")
    .eq("event_date", eventDate)
    .in("birthday_user_id", birthdays.map((profile) => profile.id));
  if (runsError) throw runsError;

  const alreadyProcessed = new Set(
    (existingRuns ?? []).map((run) => run.birthday_user_id)
  );
  const resend = new Resend(resendKey);
  let processed = 0;
  let failed = 0;

  for (const birthday of birthdays) {
    if (alreadyProcessed.has(birthday.id)) continue;

    try {
      const name = birthdayName(birthday);
      const firstName = birthday.first_name?.trim() || name.split(/\s+/)[0] || "";
      const reminder = birthdayReminderTemplate(name);
      const greeting = birthdayGreetingTemplate(firstName);

      const reminderResult = await resend.emails.send(
        {
          from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
          to: testRecipient,
          subject: `[PRUEBA PROGRAMADA] ${reminder.subject}`,
          html: reminder.html,
        },
        { idempotencyKey: `birthday-test/${eventDate}/${birthday.id}/reminder` }
      );
      if (reminderResult.error) throw new Error(reminderResult.error.message);

      const greetingResult = await resend.emails.send(
        {
          from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
          to: testRecipient,
          subject: `[PRUEBA PROGRAMADA] ${greeting.subject}`,
          html: greeting.html,
        },
        { idempotencyKey: `birthday-test/${eventDate}/${birthday.id}/greeting` }
      );
      if (greetingResult.error) throw new Error(greetingResult.error.message);

      const { error: runError } = await admin
        .from("birthday_notification_runs")
        .insert({ birthday_user_id: birthday.id, event_date: eventDate });
      if (runError && runError.code !== "23505") throw runError;

      processed += 2;
    } catch (error: unknown) {
      failed += 1;
      console.error(
        `Birthday test delivery failed for ${birthday.id}:`,
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "unknown error"
      );
    }
  }

  return { birthdays: birthdays.length, processed, failed };
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    req.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const eventDate = argentinaDateISO();
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const deliveryMode =
      process.env.BIRTHDAY_EMAIL_MODE?.trim().toLowerCase() === "live"
        ? "live"
        : "test";

    if (deliveryMode === "test") {
      const testRecipient =
        process.env.BIRTHDAY_EMAIL_TEST_RECIPIENT?.trim() ?? "";
      if (!/^\S+@\S+\.\S+$/.test(testRecipient)) {
        throw new Error(
          "BIRTHDAY_EMAIL_TEST_RECIPIENT is required while BIRTHDAY_EMAIL_MODE is not live"
        );
      }

      const testDelivery = await runBirthdayTestDelivery(
        admin,
        eventDate,
        testRecipient
      );
      return Response.json({
        ok: testDelivery.failed === 0,
        eventDate,
        mode: "test",
        recipient: testRecipient,
        birthdays: testDelivery.birthdays,
        queued: testDelivery.processed,
        delivery: {
          processed: testDelivery.processed,
          failed: testDelivery.failed,
          loops: 1,
        },
      });
    }

    const { data, error } = await admin.rpc(
      "enqueue_daily_birthday_notifications",
      { p_event_date: eventDate }
    );
    if (error) throw error;

    const delivery = await processEmailOutbox({ batchSize: 25, maxLoops: 20 });
    const birthdays = Array.isArray(data) ? data : [];

    return Response.json({
      ok: true,
      eventDate,
      mode: "live",
      birthdays: birthdays.length,
      queued: birthdays.reduce(
        (total, item) => total + Number(item.email_count ?? 0),
        0
      ),
      delivery,
    });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Birthday notification job failed";
    console.error("Birthday notification job failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
