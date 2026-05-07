import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const email = "pato@lanzallamas.tv"; // <-- CAMBIAR

    const data = await resend.emails.send({
      from: "LLL Hub <no-reply@updates.lanzallamas.tv>",
      to: [email],
      subject: "Test Email - LLL Hub",
      html: `
        <div style="font-family: Arial; padding: 24px;">
          <h1>✅ Email funcionando</h1>
          <p>Supabase + Resend están conectados correctamente.</p>
          <p>Hora: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    console.log("EMAIL RESPONSE:", data);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("TEST EMAIL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}