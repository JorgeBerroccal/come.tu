# Configurar la Iteración 2: pago con Yape y confirmación por WhatsApp

Esta guía deja funcionando en la web publicada el pago del adelanto con Yape (HU-04) y la confirmación automática por WhatsApp (HU-05), **en modo de prueba**: no se cobra dinero real y WhatsApp usa el número de prueba gratuito de Meta.

Hay que hacer cuatro partes. Las partes 2 y 3 dan las claves que se guardan en la parte 4.

---

## Parte 1 · Base de datos (Supabase, 2 minutos)

1. En Supabase, abre el proyecto `come-tu` → **SQL Editor** → **New query**.
2. Pega todo el archivo [`supabase/iteracion2.sql`](../supabase/iteracion2.sql) y presiona **Run**.

Agrega a las reservas el correo, el origen (web o panel), el monto, el código del pago y el estado del WhatsApp.

---

## Parte 2 · Mercado Pago, credenciales de prueba (10 minutos)

1. Entra a [mercadopago.com.pe/developers](https://www.mercadopago.com.pe/developers) con una cuenta de Mercado Pago (si no tienes, créala; es gratis).
2. **Tus integraciones** → **Crear aplicación**.
   - Nombre: `Come.Tu`
   - Tipo de pago: **Pagos online** · ¿Plataforma de e-commerce?: **No** · Producto: **Checkout API** (o *Checkout Transparente*).
3. Entra a la aplicación → **Credenciales de prueba**. Copia:
   - **Public Key** (empieza con `TEST-`)
   - **Access Token** (empieza con `TEST-`)

> El **Access Token es secreto**: no lo pegues en la web ni en el chat. Solo va en los *Secrets* de Supabase (parte 4).

Para probar, la web acepta los celulares de prueba de Mercado Pago con el código `123456`:

| Celular de Yape | Resultado |
| --- | --- |
| 111111111 | Aprobado |
| 111111117 | Rechazado: código incorrecto |
| 111111113 | Rechazado: supera el límite de Yape |
| 111111116 | Rechazado: demasiados intentos |

---

## Parte 3 · WhatsApp Cloud API de Meta, número de prueba (20 minutos + revisión de la plantilla)

1. Entra a [developers.facebook.com](https://developers.facebook.com) con tu cuenta de Facebook → **Mis apps** → **Crear app**.
   - Caso de uso: **Conectar con clientes por WhatsApp**.
   - Nombre: `Come.Tu`. Si pide un portafolio comercial, crea uno con el nombre del equipo.
2. En la app → **WhatsApp** → **Configuración de la API** (*API Setup*):
   - Meta te asigna un **número de prueba** gratuito.
   - Copia el **Identificador del número de teléfono** (*Phone number ID*).
   - En **Para** (*To*), agrega tu número **+51 9xx xxx xxx** y confírmalo con el código que te llega. Solo los números agregados aquí reciben mensajes del número de prueba (agrega a tus compañeros para la demo).
3. **Crear la plantilla** de confirmación: **WhatsApp Manager** → **Plantillas de mensajes** → **Crear plantilla**.
   - Categoría: **Utilidad** · Nombre: `confirmacion_reserva` · Idioma: **Español**
   - Cuerpo (copia exacto, con las 4 variables):

     ```
     Hola {{1}}, tu reserva en Come.Tú Experiencias está confirmada.
     Salida: {{2}}
     Personas: {{3}}
     Adelanto recibido: {{4}}
     Te recogemos a las 08:00 en el terminal o el aeropuerto de Huamanga. Un día antes te escribiremos para coordinar. ¡Gracias por viajar con nosotros!
     ```
   - Ejemplos de las variables: `Lucía`, `sábado 28 de noviembre`, `2`, `S/ 200.00`.
   - Envía a revisión. Suele aprobarse en minutos; Meta indica que puede tardar hasta 24 horas.
4. **Token de acceso**:
   - Para probar hoy: en *API Setup*, **Generar token de acceso** (dura 24 horas).
   - Para la exposición (no vence): **Configuración del negocio** → **Usuarios del sistema** → **Agregar** (rol Administrador) → **Generar token** para la app `Come.Tu` con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.

> El token también es **secreto**: solo va en Supabase.

---

## Parte 4 · Edge Function y secretos (Supabase, 10 minutos)

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: `come-tu` (exacto). Borra el código de ejemplo y pega todo [`supabase/functions/come-tu/index.ts`](../supabase/functions/come-tu/index.ts). **Deploy**.
3. En la función → **Details** (o *Settings*): desactiva **Verify JWT** / *Enforce JWT verification* y guarda. La función revisa por su cuenta quién puede reenviar mensajes.
4. **Edge Functions** → **Secrets** → agrega:

| Nombre | Valor |
| --- | --- |
| `MP_PUBLIC_KEY` | Public Key de prueba de Mercado Pago |
| `MP_ACCESS_TOKEN` | Access Token de prueba de Mercado Pago |
| `WHATSAPP_TOKEN` | Token de Meta |
| `WHATSAPP_PHONE_ID` | Identificador del número de prueba |
| `WHATSAPP_TEMPLATE` | `confirmacion_reserva` |
| `WHATSAPP_TEMPLATE_LANG` | `es` |
| `ADELANTO_POR_PERSONA` | `100` |

5. Avisa al equipo de desarrollo para activar `PAGOS_EN_LINEA: true` en `web/js/config.js`.

---

## Probar de punta a punta

1. Abre `https://jorgeberroccal.github.io/come.tu/paquete.html`, elige una fecha → **Reservar y pagar con Yape**.
2. Escribe tu nombre, **tu WhatsApp agregado en Meta** y un correo.
3. Celular de Yape `111111111`, código `123456` → **Pagar**.
4. Debe aparecer «¡Tu cupo está confirmado!», llegar el WhatsApp desde el número de prueba y, en el panel, la reserva con «Web · Yape» y Confirmación «Enviado».

Si la confirmación sale con **Error**, pasa el mouse sobre la etiqueta para ver el motivo que dio Meta (por ejemplo, número no agregado en *To* o plantilla sin aprobar) y usa **Enviar** en el panel para reintentar.

## Pasar a producción (después del curso)

- Mercado Pago: usar las **credenciales de producción**, que piden cuenta verificada, y cambiar `PAGOS_PRUEBA` a `false`.
- WhatsApp: registrar un **número propio** para la API (no puede ser uno que ya use la app de WhatsApp, salvo con un proveedor de *coexistencia*) y verificar el negocio en Meta.
- Meta cobra cada mensaje de plantilla de utilidad enviado en Perú; revisar la tarifa vigente antes de lanzar.
