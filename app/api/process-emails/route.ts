export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const resend = new Resend(process.env.RESEND_API_KEY!);

    let totalProcessed = 0;
    let loops = 0;
    const MAX_LOOPS = 5;

    while (loops < MAX_LOOPS) {
      loops++;

      const { data: emails, error } = await supabase.rpc(
        "claim_pending_emails",
        { p_limit: 10 }
      );

      if (error) {
        console.error("claim error:", error);
        break;
      }

      if (!emails || emails.length === 0) {
        break; // 🚀 no hay más
      }

      for (const email of emails) {
        try {
          // 🚨 VALIDACIÓN CLAVE
          if (!email.to_email) {
            await supabase.rpc("mark_email_error", {
              p_id: email.id,
              p_error: "missing recipient",
            });
            continue;
          }

          const result = await resend.emails.send({
            from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
            to: email.to_email,
            subject: email.subject,
            html: email.html,
          });

          await supabase.rpc("mark_email_sent", {
            p_id: email.id,
            p_provider_id: result?.data?.id || null,
          });

          totalProcessed++;
        } catch (err: any) {
          console.error("send error:", err);

          await supabase.rpc("mark_email_error", {
            p_id: email.id,
            p_error: err?.message || "unknown error",
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processed: totalProcessed,
      loops,
    });

  } catch (err) {
    console.error("fatal:", err);
    return NextResponse.json({ error: "fatal" }, { status: 500 });
  }
}