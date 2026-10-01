This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Recordatorios de cumpleaños

Las migraciones `20261001120000_birthday_notifications.sql` y
`20261001123000_team_birthdays_calendar.sql` agregan el registro idempotente,
la generación de notificaciones y el calendario seguro para todo el equipo. En Vercel se
debe configurar `CRON_SECRET` con un valor aleatorio de al menos 16 caracteres.
El cron de `vercel.json` se ejecuta todos los días a las 12:00 UTC (09:00 de
Argentina) y el endpoint vuelve a calcular la fecha usando
`America/Argentina/Buenos_Aires`.

Por seguridad, el cron queda en modo de prueba salvo que se habilite
explícitamente el envío real. Para recibir únicamente las pruebas programadas:

```text
BIRTHDAY_EMAIL_MODE=test
BIRTHDAY_EMAIL_TEST_RECIPIENT=owner@empresa.com
```

En este modo no se crean notificaciones ni emails para el equipo. Por cada
cumpleaños detectado se envían solamente el recordatorio y el saludo a la
dirección configurada. Para habilitar el flujo real se debe cambiar
`BIRTHDAY_EMAIL_MODE=live` y volver a desplegar.

También se puede simular una fecha manualmente entrando como owner a
`/owner/calendar?birthdayAt=YYYY-MM-DD`. La herramienta sólo aparece con ese
parámetro y el servidor permite enviar las plantillas exclusivamente al email
de la sesión del owner.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
