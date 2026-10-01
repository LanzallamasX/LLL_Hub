# Parámetros de URL para pruebas

Esta guía reúne los parámetros especiales que permiten simular fechas y
políticas sin modificar la fecha de la computadora ni los datos productivos.

## Reglas generales

- Las fechas deben escribirse como `AAAA-MM-DD`.
- El primer parámetro comienza con `?`.
- Los parámetros adicionales se agregan con `&`.
- Al quitar los parámetros de la URL, la pantalla vuelve al funcionamiento normal.

Ejemplo local:

```text
http://localhost:3000/dashboard?vacAt=2027-03-27
```

Ejemplo en producción:

```text
https://TU-DOMINIO/dashboard?vacAt=2027-03-27
```

## `vacAt`

Simula la fecha utilizada para calcular vacaciones, antigüedad, ciclos,
saldos y validaciones de una nueva solicitud.

Ejemplos:

```text
/dashboard?vacAt=2027-03-27
/absences?vacAt=2027-03-27
/balances?vacAt=2027-03-27
/owner/balances/employees/ID_DEL_USUARIO?vacAt=2027-03-27
```

Este parámetro no cambia el reloj del servidor, no ejecuta el cron y no envía
emails.

## `vacModel`

Permite probar un modelo específico de política de vacaciones.

Valores admitidos:

- `anniversary`: ciclo por aniversario de ingreso.
- `october`: ciclo que comienza en octubre.

Se puede combinar con `vacAt`:

```text
/dashboard?vacAt=2027-03-27&vacModel=anniversary
/balances?vacAt=2027-03-27&vacModel=october
/absences?vacAt=2027-03-27&vacModel=october
```

`vacMode` existe como alias anterior, pero conviene usar siempre `vacModel`.

## `birthdayAt`

Habilita la simulación privada de cumpleaños en el calendario del owner.

```text
/owner/calendar?birthdayAt=2027-03-27
```

Comportamiento:

- Busca empleados cuyo día y mes de nacimiento coincidan con la fecha indicada.
- Muestra el panel privado de prueba únicamente mientras el parámetro esté en la URL.
- No envía nada automáticamente al abrir la página.
- El envío ocurre solamente al presionar el botón de prueba.
- Los dos emails se envían exclusivamente al email de la sesión del owner.
- No crea notificaciones ni contacta al equipo.
- No cambia la fecha utilizada por el cron automático.

Para ocultar el panel, volver a:

```text
/owner/calendar
```

## `asOf` — alias anterior

La pantalla `/absences` todavía acepta `asOf` como alias de fecha:

```text
/absences?asOf=2027-03-27
```

Para nuevas pruebas se recomienda utilizar `vacAt`.

## Prueba del cron de cumpleaños

El cron no se controla mediante parámetros de URL. En Vercel se utilizan estas
variables de entorno:

```text
BIRTHDAY_EMAIL_MODE=test
BIRTHDAY_EMAIL_TEST_RECIPIENT=owner@empresa.com
```

En modo `test`, el cron usa la fecha real de Argentina y envía únicamente al
destinatario configurado. Para habilitar el envío real al equipo se debe cambiar
explícitamente a:

```text
BIRTHDAY_EMAIL_MODE=live
```

Después de cambiar variables en Vercel siempre es necesario realizar un nuevo
deployment de producción.

