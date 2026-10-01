function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailShell(emoji: string, heading: string, content: string) {
  return `
    <html>
      <body style="background:#f3f4f6;padding:30px 10px;font-family:Arial,sans-serif;margin:0">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden">
              <tr><td style="background:#111827;padding:32px;text-align:center;color:#ffffff">
                <div style="font-size:48px;line-height:1">${emoji}</div>
                <h1 style="margin:14px 0 0;font-size:28px">${heading}</h1>
              </td></tr>
              <tr><td style="padding:30px;text-align:center;color:#374151">
                ${content}
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;
}

export function birthdayReminderTemplate(employeeName: string) {
  const safeName = escapeHtml(employeeName);
  return {
    subject: `Hoy es el cumpleaños de ${employeeName} 🎂`,
    html: emailShell(
      "🎂",
      `Hoy cumple años ${safeName}`,
      `<p style="margin:0;font-size:16px;line-height:1.6">¡Acordate de saludar a <b>${safeName}</b> en su día!</p>
       <p style="margin:18px 0 0;color:#6b7280;font-size:13px">Este recordatorio fue enviado por LLL Hub.</p>`
    ),
  };
}

export function birthdayGreetingTemplate(firstName: string) {
  const safeName = escapeHtml(firstName);
  return {
    subject: `¡Feliz cumpleaños, ${firstName}! 🎉`,
    html: emailShell(
      "🎉",
      `¡Feliz cumpleaños, ${safeName}!`,
      `<p style="margin:0;font-size:17px;line-height:1.6">Todo el equipo de Lanzallamas te desea un gran día.</p>
       <p style="margin:18px 0 0;color:#6b7280;font-size:13px">¡Que lo disfrutes mucho! 🔥</p>`
    ),
  };
}
