import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";



export async function GET() {

// 🔐 Validación de variables de entorno
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}
if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY");
}

// 🧠 Clientes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);



const resend = new Resend(process.env.RESEND_API_KEY);  


  
  try {
    // 1. Claim emails (usa SKIP LOCKED desde SQL)
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
      // 🛑 Validación mínima
      if (!email.to_email) {
        console.warn("Skipping email with no recipient:", email.id);
        continue;
      }

      try {
        // ⏱️ Timeout de protección (10s)
        const result: any = await Promise.race([
          resend.emails.send({
            from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
            to: email.to_email,
            subject: email.subject,
            html: email.html,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 10000)
          ),
        ]);

        // 2. Mark sent
      const { error: markSentError } = await supabase.rpc("mark_email_sent", {
        p_id: email.id,
        p_provider_id: result?.data?.id || null,
      });

      if (markSentError) {
        console.error("Error marking as sent:", {
          emailId: email.id,
          error: markSentError,
        });
      }

        processed++;
      } catch (err: any) {
        console.error("Send error:", {
          emailId: email.id,
          to: email.to_email,
          error: err?.message || err,
        });

        // 3. Mark error (retry automático)
        const { error: markErrorError } = await supabase.rpc("mark_email_error", {
          p_id: email.id,
          p_error: err?.message || "unknown error",
        });

        if (markErrorError) {
          console.error("Error marking as error:", {
            emailId: email.id,
            error: markErrorError,
          });
        }


      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      total: emails.length,
    });

  } catch (err) {
    console.error("Fatal error:", err);
    return NextResponse.json({ error: "fatal" }, { status: 500 });
  }
}