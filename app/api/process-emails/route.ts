import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function GET() {
  try {
    // 🔐 validar env dentro del handler
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    if (!process.env.RESEND_API_KEY)
      throw new Error("Missing RESEND_API_KEY");

    // 🧠 crear clientes dentro del handler
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: emails, error } = await supabase.rpc(
      "claim_pending_emails",
      { p_limit: 10 }
    );

    if (error) {
      console.error("Error claiming emails:", error);
      return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, total: 0 });
    }

    let processed = 0;

    for (const email of emails) {
      if (!email.to_email) continue;

      try {
        const result: any = await resend.emails.send({
          from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
          to: email.to_email,
          subject: email.subject,
          html: email.html,
        });

        const { error: markError } = await supabase.rpc("mark_email_sent", {
          p_id: email.id,
          p_provider_id: result?.data?.id || null,
        });

        if (markError) {
          console.error("mark_email_sent error:", markError);
        }

        processed++;
      } catch (err: any) {
        console.error("Send error:", err);

        await supabase.rpc("mark_email_error", {
          p_id: email.id,
          p_error: err?.message || "unknown error",
        });
      }
    }

    return NextResponse.json({ ok: true, processed, total: emails.length });
  } catch (err) {
    console.error("Fatal error:", err);
    return NextResponse.json({ error: "fatal" }, { status: 500 });
  }
}