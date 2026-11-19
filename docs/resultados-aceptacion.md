# Resultados de las pruebas de aceptación · Iteración 1

Ejecutado el 19/11/2026, 11:16:19 a. m. · 17 de 17 pruebas aprobadas.

| Historia | Criterio | Resultado | Detalle |
| --- | --- | --- | --- |
| HU-01 | Al elegir una picantería se ven dirección, horario, plato recomendado y precio, y la ubicación abre en Google Maps | Aprobado | 6 picanterías |
| HU-02 | El paquete muestra el itinerario por día, qué incluye y qué no, y el precio total de S/ 320 | Aprobado | Día 1 · Huamanga se come / Día 2 · Wari y Quinua; total S/ 320 |
| HU-03 | Salida con 12 cupos y 9 reservas pagadas muestra «Quedan 3 cupos» y permite reservar | Aprobado | Quedan 3 cupos |
| HU-03 | Salida sin cupos aparece como «Agotado» y no deja reservar | Aprobado | Agotado |
| HU-06 | Solo el equipo entra al panel: sin sesión no se ve y una contraseña incorrecta se rechaza | Aprobado | Correo o contraseña incorrectos. |
| HU-06 | El operador inicia sesión y crea una salida con fecha y cupos | Aprobado | salida del 2027-01-03 creada |
| HU-06 | Al registrar una reserva, la lista de viajeros y los cupos libres se actualizan al instante | Aprobado | libres 3 → 0 en 62 ms |
| HU-06 | No se puede registrar una reserva si ya no hay cupos (sin sobreventa) | Aprobado | No hay cupos suficientes: la salida está agotada. |
| HU-06 | Se descarga la lista de viajeros para el hotel | Aprobado | cometu-salida-2026-11-21.csv con 5 viajeros |
| HU-03 | Lo registrado en el panel se refleja en la página pública (la salida pasa a «Agotado») | Aprobado | Agotado |
| HU-04 | Desde el paquete se entra a «Reservar y pagar con Yape» y el adelanto se calcula por persona | Aprobado | adelanto S/ 200, saldo S/ 440 |
| HU-04 | Si Yape rechaza el pago se muestra el motivo y no se ocupa el cupo | Aprobado | El código de aprobación no es correcto o ya venció. Genera uno nuevo en Yape. |
| HU-04 | Pago aprobado: se confirma la reserva con el monto pagado y los cupos bajan | Aprobado | pagado S/ 200; Quedan 6 cupos |
| HU-04 | Una salida agotada no permite pagar | Aprobado | sin formulario |
| HU-05 | El panel muestra la reserva pagada por Yape y su estado de confirmación | Aprobado | Web · Yape S/ 200; WhatsApp: Sin configurar |
| General | Sin errores de JavaScript en las páginas | Aprobado | ninguno |
| SP-04 | Cada página carga en menos de 3 s con 4G | Aprobado | la más lenta: 1.08 s |

## SP-04 · Tiempo de carga (primera visita, sin caché)

| Red | Página | Tiempo | Peso |
| --- | --- | --- | --- |
| 4G (lenta) | index.html | 1.06 s | 82 KB |
| 4G (lenta) | paquete.html | 1.08 s | 87 KB |
| 4G (lenta) | donde-comer.html | 1.06 s | 82 KB |
| 3G (rápida) | index.html | 2.37 s | 82 KB |
| 3G (rápida) | paquete.html | 2.37 s | 87 KB |
| 3G (rápida) | donde-comer.html | 2.37 s | 93 KB |
