// Come.Tú · Edge Function "come-tu" (Iteración 2)
//
// accion "pagar"    (público)        HU-04: separa el cupo, cobra el adelanto con Yape (Mercado Pago)
//                                     y, si se aprueba, envía la confirmación por WhatsApp (HU-05).
// accion "reenviar" (solo el equipo) HU-05: vuelve a enviar la confirmación de una reserva pagada.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN, MP_PUBLIC_KEY               credenciales de PRUEBA de Mercado Pago
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID            WhatsApp Cloud API (Meta for Developers)
//   WHATSAPP_TEMPLATE (confirmacion_reserva), WHATSAPP_TEMPLATE_LANG (es), WHATSAPP_API_VERSION (v23.0)
//   ADELANTO_POR_PERSONA (100)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const ADELANTO = Number(env('ADELANTO_POR_PERSONA', '100'));
// Solo para pruebas locales: permiten apuntar a servidores simulados
const MP_API = env('MP_API_BASE', 'https://api.mercadopago.com');
const WA_API = env('WHATSAPP_API_BASE', 'https://graph.facebook.com');
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[f.getUTCDay()]} ${d} de ${MESES[m - 1]}`;
}
function hoyLima() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10); // Perú: UTC-5 todo el año
}

// Mensajes claros para los rechazos de Yape (Mercado Pago, status_detail)
const RECHAZOS: Record<string, string> = {
  cc_rejected_call_for_authorize: 'Yape pidió autorizar el pago. Revisa tu app de Yape e inténtalo de nuevo.',
  cc_amount_rate_limit_exceeded: 'El monto supera tu límite diario de Yape. Puedes subirlo en la app de Yape.',
  cc_rejected_max_attempts: 'Superaste los intentos permitidos. Genera un código nuevo en Yape.',
  cc_rejected_bad_filled_security_code: 'El código de aprobación no es correcto o ya venció. Genera uno nuevo en Yape.',
  cc_rejected_form_error: 'Los datos de Yape no son válidos. Revisa tu número y el código.',
  cc_rejected_card_type_not_allowed: 'Este Yape no puede usarse para este pago.',
  cc_unsupported_unsupported: 'Este Yape no puede usarse para este pago.'
};

// ---------------- WhatsApp (HU-05) ----------------
async function enviarConfirmacion(reservaId: number) {
  const { data: r } = await db.from('reservas').select('*, salidas(fecha)').eq('id', reservaId).single();
  if (!r) return { estado: 'error', detalle: 'Reserva no encontrada' };
  const token = env('WHATSAPP_TOKEN'), telefonoId = env('WHATSAPP_PHONE_ID');
  let estado = 'no_configurado', detalle = 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID';
  if (token && telefonoId) {
    const resp = await fetch(`${WA_API}/${env('WHATSAPP_API_VERSION', 'v23.0')}/${telefonoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `51${r.telefono}`,
        type: 'template',
        template: {
          name: env('WHATSAPP_TEMPLATE', 'confirmacion_reserva'),
          language: { code: env('WHATSAPP_TEMPLATE_LANG', 'es') },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: r.nombre },
              { type: 'text', text: fechaLarga(r.salidas.fecha) },
              { type: 'text', text: String(r.personas) },
              { type: 'text', text: `S/ ${Number(r.monto ?? 0).toFixed(2)}` }
            ]
          }]
        }
      })
    });
    const json = await resp.json().catch(() => ({}));
    if (resp.ok) { estado = 'enviado'; detalle = json?.messages?.[0]?.id ?? ''; }
    else { estado = 'error'; detalle = json?.error?.message ?? `HTTP ${resp.status}`; }
  }
  await db.from('reservas').update({ whatsapp_estado: estado, whatsapp_detalle: detalle.slice(0, 300) }).eq('id', reservaId);
  return { estado, detalle };
}

// ---------------- Pago con Yape (HU-04) ----------------
async function pagar(b: Record<string, unknown>) {
  const nombre = String(b.nombre ?? '').trim();
  const telefono = String(b.telefono ?? '').replace(/\D/g, '');
  const correo = String(b.correo ?? '').trim().toLowerCase();
  const personas = Number(b.personas);
  const salidaId = Number(b.salida_id);
  const yapeCelular = String(b.yape_celular ?? '').replace(/\D/g, '');
  const yapeOtp = String(b.yape_otp ?? '').replace(/\D/g, '');

  if (!nombre || nombre.length > 80) return responder({ error: 'Escribe tu nombre.' }, 400);
  if (!/^9\d{8}$/.test(telefono)) return responder({ error: 'Escribe un WhatsApp peruano de 9 dígitos que empiece con 9.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return responder({ error: 'Escribe un correo válido.' }, 400);
  if (!Number.isInteger(personas) || personas < 1 || personas > 12) return responder({ error: 'Elige entre 1 y 12 personas.' }, 400);
  if (!/^\d{9}$/.test(yapeCelular)) return responder({ error: 'Escribe el celular de tu Yape (9 dígitos).' }, 400);
  if (!/^\d{6}$/.test(yapeOtp)) return responder({ error: 'Escribe el código de aprobación de Yape (6 dígitos).' }, 400);
  if (!env('MP_ACCESS_TOKEN') || !env('MP_PUBLIC_KEY')) return responder({ error: 'El pago en línea aún no está configurado.' }, 503);

  const { data: salida, error: errSalida } = await db.from('salidas').select('id, fecha').eq('id', salidaId).single();
  if (errSalida) console.error('salida', salidaId, errSalida.message);
  if (!salida || salida.fecha < hoyLima()) return responder({ error: 'Esa salida ya no está disponible.' }, 404);

  await db.rpc('liberar_reservas_vencidas');
  const monto = personas * ADELANTO;

  // 1. Separar el cupo: el trigger de la base de datos impide la sobreventa (SP-02)
  const { data: reserva, error: errReserva } = await db.from('reservas')
    .insert({ salida_id: salidaId, nombre, telefono, correo, personas, estado: 'pendiente', origen: 'web', monto })
    .select().single();
  if (errReserva) {
    const libres = errReserva.message.match(/CUPOS_INSUFICIENTES:(\d+)/);
    if (libres) {
      const n = Number(libres[1]);
      return responder({ error: n > 0 ? `Solo quedan ${n} cupos en esta salida.` : 'Esta salida se acaba de agotar.' }, 409);
    }
    return responder({ error: 'No se pudo separar el cupo. Intenta de nuevo.' }, 500);
  }
  const anular = () => db.from('reservas').delete().eq('id', reserva.id);

  // 2. Token de Yape con el celular y el código de aprobación
  const tokenResp = await fetch(`${MP_API}/platforms/pci/yape/v1/payment?public_key=${env('MP_PUBLIC_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: yapeCelular, otp: yapeOtp, requestId: crypto.randomUUID() })
  });
  const tokenJson = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokenJson.id) {
    await anular();
    return responder({ error: 'Yape no aceptó el celular o el código. Genera un código nuevo e inténtalo otra vez.' }, 402);
  }

  // 3. Cobro del adelanto
  const pagoResp = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `cometu-reserva-${reserva.id}`
    },
    body: JSON.stringify({
      token: tokenJson.id,
      transaction_amount: monto,
      installments: 1,
      payment_method_id: 'yape',
      description: `Adelanto Come.Tú · salida ${salida.fecha} · ${personas} persona(s)`,
      external_reference: String(reserva.id),
      payer: { email: correo }
    })
  });
  const pago = await pagoResp.json().catch(() => ({}));

  if (pago.status === 'approved') {
    await db.from('reservas').update({ estado: 'pagada', mp_pago_id: String(pago.id) }).eq('id', reserva.id);
    const whatsapp = await enviarConfirmacion(reserva.id);
    return responder({ ok: true, reserva_id: reserva.id, monto, fecha: salida.fecha, whatsapp: whatsapp.estado });
  }
  if (pago.status === 'in_process' || pago.status === 'pending') {
    await db.from('reservas').update({ mp_pago_id: String(pago.id) }).eq('id', reserva.id);
    return responder({ ok: false, pendiente: true, error: 'Tu pago está en revisión. Te avisaremos por WhatsApp cuando se confirme.' }, 202);
  }
  await anular();
  const motivo = RECHAZOS[pago.status_detail] ?? 'Yape rechazó el pago. Inténtalo de nuevo con un código nuevo.';
  return responder({ error: motivo, detalle: pago.status_detail ?? pago.message ?? null }, 402);
}

// ---------------- Reenvío desde el panel (solo el equipo) ----------------
async function reenviar(req: Request, b: Record<string, unknown>) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data } = await db.auth.getUser(jwt);
  if (!data?.user) return responder({ error: 'Inicia sesión en el panel.' }, 401);
  const { data: r } = await db.from('reservas').select('id, estado').eq('id', Number(b.reserva_id)).single();
  if (!r) return responder({ error: 'Reserva no encontrada.' }, 404);
  if (r.estado !== 'pagada') return responder({ error: 'Solo se confirma una reserva pagada.' }, 409);
  const res = await enviarConfirmacion(r.id);
  return responder({ ok: res.estado === 'enviado', whatsapp: res.estado, detalle: res.detalle }, res.estado === 'enviado' ? 200 : 502);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);
  try {
    const b = await req.json();
    if (b.accion === 'pagar') return await pagar(b);
    if (b.accion === 'reenviar') return await reenviar(req, b);
    if (b.accion === 'config') return responder({ adelanto_por_persona: ADELANTO, pagos: !!env('MP_ACCESS_TOKEN'), whatsapp: !!env('WHATSAPP_TOKEN') });
    return responder({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    console.error(e);
    return responder({ error: 'Error inesperado. Intenta de nuevo.' }, 500);
  }
});
