import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET() {
  const { data: emails, error } = await supabase.rpc(
    "claim_pending_emails",
    { p_limit: 10 }
  );

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "claim_failed" });
  }

  for (const email of emails ?? []) {
    try {
      const res = await resend.emails.send({
        from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
        to: email.to_email,
        subject: email.subject,
        html: email.html,
      });

      await supabase.rpc("mark_email_sent", {
        p_id: email.id,
        p_provider_id: res.data?.id,
      });

    } catch (err: any) {
      await supabase.rpc("mark_email_error", {
        p_id: email.id,
        p_error: err.message,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

/*
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // IMPORTANTE
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET() {
  try {
    // 1. Claim emails (los bloquea con SKIP LOCKED)
    const { data: emails, error } = await supabase.rpc(
      "claim_pending_emails",
      { p_limit: 10 }
    );

    if (error) {
      console.error("Error claiming emails:", error);
      return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const email of emails) {
      try {
        const result = await resend.emails.send({
          from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
          to: email.to_email,
          subject: email.subject,
          html: email.html,
        });

        // 2. Mark sent
        await supabase.rpc("mark_email_sent", {
          p_id: email.id,
          p_provider_id: result?.data?.id || null,
        });

        processed++;
      } catch (err: any) {
        console.error("Send error:", err);

        // 3. Mark error (retry automático)
        await supabase.rpc("mark_email_error", {
          p_id: email.id,
          p_error: err.message || "unknown error",
        });
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("Fatal error:", err);
    return NextResponse.json({ error: "fatal" }, { status: 500 });
  }
}


*/