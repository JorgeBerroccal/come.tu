// Configuración de Come.Tú
// Si SUPABASE_URL y SUPABASE_ANON_KEY quedan vacíos, la app funciona en
// MODO DEMOSTRACIÓN: los datos se guardan solo en el navegador.
export const CONFIG = {
  SUPABASE_URL: 'https://rspsixxbuutnpkntgcka.supabase.co',
  // Clave PÚBLICA (publishable): puede estar en el navegador. Nunca poner aquí la secret ni la service_role.
  SUPABASE_ANON_KEY: 'sb_publishable_PW6QX6y9pgwTmz2Kuo6L_A_TQHQgrBD',
  // Número de WhatsApp del equipo, con código de país y sin espacios (Perú = 51).
  WHATSAPP: '51967743346',
  // Iteración 2 (HU-04): pago del adelanto con Yape a través de Mercado Pago.
  // Activar solo cuando la Edge Function "come-tu" tenga sus credenciales.
  PAGOS_EN_LINEA: false,
  // true mientras se usen las credenciales de PRUEBA de Mercado Pago (no se cobra dinero real)
  PAGOS_PRUEBA: true,
  // Debe coincidir con el secreto ADELANTO_POR_PERSONA de la Edge Function
  ADELANTO_POR_PERSONA: 100,
  PRECIO_POR_PERSONA: 320,
  VERSION: '2.0.0 (Iteración 2)'
};
