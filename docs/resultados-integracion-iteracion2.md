# Prueba de integración · Iteración 2

Ejecutada el 19/11/2026, 11:14:04 a. m. · 10 de 10 aprobadas.
PostgreSQL y PostgREST reales; Mercado Pago y WhatsApp Cloud API simulados con sus respuestas documentadas.

| Historia | Prueba | Resultado | Detalle |
| --- | --- | --- | --- |
| HU-04 | Pago aprobado con Yape: la reserva queda «Pagada» con el monto del adelanto | Aprobado | reserva 1, S/ 200 |
| HU-05 | Tras el pago se envía la plantilla de WhatsApp con nombre, fecha, personas y monto | Aprobado | Lucía Ramos · sábado 28 de noviembre · 2 · S/ 200.00 |
| HU-04 | Pago rechazado: mensaje claro y el cupo NO queda ocupado | Aprobado | El código de aprobación no es correcto o ya venció. Genera uno nuevo en Yape. |
| HU-04 | Código de Yape incorrecto: no se cobra y se libera el cupo | Aprobado | Yape no aceptó el celular o el código. Genera un código nuevo e inténtalo otra vez. |
| HU-04 | Datos inválidos se rechazan antes de cobrar | Aprobado | 4 casos |
| HU-04 | Pedir más personas que cupos libres se rechaza sin cobrar | Aprobado | Solo quedan 10 cupos en esta salida. |
| SP-02 | 6 turistas pagan a la vez 3 cupos cada uno con 10 libres: nunca se sobrevende | Aprobado | 3 aprobados, 3 rechazados, ocupados 11 de 12 |
| SP-02 | Una reserva web abandonada (pendiente > 15 min) libera su cupo | Aprobado | cupo liberado |
| HU-05 | Si WhatsApp falla, el pago se mantiene y el error queda registrado | Aprobado | Recipient phone number not in allowed list |
| HU-05 | Reenviar la confirmación exige sesión del equipo | Aprobado | sin sesión 401, con sesión enviado |
