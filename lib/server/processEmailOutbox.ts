import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "unknown error";
}

export async function processEmailOutbox(options?: {
  batchSize?: number;
  maxLoops?: number;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!url || !serviceKey || !resendKey) {
    throw new Error("Email worker is missing required environment variables.");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const resend = new Resend(resendKey);
  const batchSize = options?.batchSize ?? 10;
  const maxLoops = options?.maxLoops ?? 5;

  let processed = 0;
  let failed = 0;
  let loops = 0;

  while (loops < maxLoops) {
    loops += 1;
    const { data: emails, error: claimError } = await admin.rpc(
      "claim_pending_emails",
      { p_limit: batchSize }
    );

    if (claimError) throw claimError;
    if (!emails?.length) break;

    for (const email of emails) {
      try {
        if (!email.to_email) throw new Error("missing recipient");

        const result = await resend.emails.send(
          {
            from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
            to: email.to_email,
            subject: email.subject,
            html: email.html,
          },
          { idempotencyKey: `email-outbox/${email.id}` }
        );

        if (result.error) throw new Error(result.error.message);

        const { error: sentError } = await admin.rpc("mark_email_sent", {
          p_id: email.id,
          p_provider_id: result.data?.id ?? null,
        });
        if (sentError) throw sentError;
        processed += 1;
      } catch (sendError: unknown) {
        failed += 1;
        const { error: markError } = await admin.rpc("mark_email_error", {
          p_id: email.id,
          p_error: getErrorMessage(sendError),
        });
        if (markError) {
          console.error("Could not mark email error:", markError.message);
        }
      }
    }
  }

  return { processed, failed, loops };
}
