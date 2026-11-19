// Capa de datos de Come.Tú.
// Dos implementaciones con la misma interfaz:
//  - Supabase (datos compartidos entre todos los dispositivos)
//  - Demostración (localStorage, sin servidor)
import { CONFIG } from './config.js';
import { PICANTERIAS_DEMO, datosDemo, fechaISO } from './contenido.js';

export const MODO_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
// HU-04: en modo demostración el pago con Yape siempre se puede probar (simulado)
export const PAGOS_ACTIVOS = MODO_DEMO || CONFIG.PAGOS_EN_LINEA === true;
export const CREDENCIALES_DEMO = { correo: 'equipo@cometu.pe', clave: 'cometu2026' };

const ESTADOS_QUE_OCUPAN = ['pagada', 'pendiente'];

export class ErrorCupos extends Error {
  constructor(libres) {
    super(libres > 0
      ? `No hay cupos suficientes: solo ${libres === 1 ? 'queda 1 cupo' : `quedan ${libres} cupos`} en esta salida.`
      : 'No hay cupos suficientes: la salida está agotada.');
    this.libres = libres;
  }
}

function conCupos(salida, reservas) {
  const ocupados = reservas
    .filter(r => r.salida_id === salida.id && ESTADOS_QUE_OCUPAN.includes(r.estado))
    .reduce((s, r) => s + Number(r.personas), 0);
  return { ...salida, ocupados, libres: Math.max(salida.cupos - ocupados, 0) };
}

/* ---------------- Modo demostración ---------------- */
const CLAVE = 'cometu-demo-v1';
const CLAVE_SESION = 'cometu-demo-sesion';

function leer() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (raw) return JSON.parse(raw);
  } catch { /* almacenamiento no disponible */ }
  const datos = datosDemo();
  guardar(datos);
  return datos;
}
function guardar(datos) {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
}

const demo = {
  async listarPicanterias() { return PICANTERIAS_DEMO; },

  async listarSalidasPublicas() {
    const { salidas, reservas } = leer();
    const hoy = fechaISO();
    return salidas.filter(s => s.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(s => conCupos(s, reservas));
  },

  async sesion() {
    try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch { return null; }
  },
  async iniciarSesion(correo, clave) {
    if (correo.trim().toLowerCase() !== CREDENCIALES_DEMO.correo || clave !== CREDENCIALES_DEMO.clave) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    const usuario = { correo: CREDENCIALES_DEMO.correo };
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(usuario)); } catch { /* */ }
    return usuario;
  },
  async cerrarSesion() { try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* */ } },

  async listarSalidas() {
    const { salidas, reservas } = leer();
    return [...salidas].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(s => conCupos(s, reservas));
  },
  async crearSalida({ fecha, cupos, minimo }) {
    const datos = leer();
    if (Number(minimo) > Number(cupos)) throw new Error('El mínimo no puede ser mayor que los cupos.');
    if (datos.salidas.some(s => s.fecha === fecha)) throw new Error('Ya existe una salida en esa fecha.');
    const salida = { id: ++datos.sigId, fecha, cupos: Number(cupos), minimo: Number(minimo) };
    datos.salidas.push(salida);
    guardar(datos);
    return salida;
  },
  async eliminarSalida(id) {
    const datos = leer();
    if (datos.reservas.some(r => r.salida_id === id)) throw new Error('No se puede eliminar una salida que tiene reservas.');
    datos.salidas = datos.salidas.filter(s => s.id !== id);
    guardar(datos);
  },
  async listarReservas(salidaId) {
    return leer().reservas.filter(r => r.salida_id === salidaId);
  },
  async registrarReserva({ salida_id, nombre, telefono, personas, estado }) {
    const datos = leer();
    const salida = datos.salidas.find(s => s.id === salida_id);
    if (!salida) throw new Error('La salida no existe.');
    const { libres } = conCupos(salida, datos.reservas);
    if (ESTADOS_QUE_OCUPAN.includes(estado) && Number(personas) > libres) throw new ErrorCupos(libres);
    const reserva = { id: ++datos.sigId, salida_id, nombre, telefono, personas: Number(personas), estado };
    datos.reservas.push(reserva);
    guardar(datos);
    return reserva;
  },
  async cambiarEstado(id, estado) {
    const datos = leer();
    const r = datos.reservas.find(x => x.id === id);
    if (!r) return;
    if (!ESTADOS_QUE_OCUPAN.includes(r.estado) && ESTADOS_QUE_OCUPAN.includes(estado)) {
      const salida = datos.salidas.find(s => s.id === r.salida_id);
      const { libres } = conCupos(salida, datos.reservas);
      if (r.personas > libres) throw new ErrorCupos(libres);
    }
    r.estado = estado;
    guardar(datos);
  },
  async eliminarReserva(id) {
    const datos = leer();
    datos.reservas = datos.reservas.filter(r => r.id !== id);
    guardar(datos);
  },
  async reiniciarDemo() { guardar(datosDemo()); },

  // HU-04 simulado con los números de prueba de Mercado Pago (no se cobra nada)
  async pagarConYape(d) {
    const v = validarPago(d);
    const datos = leer();
    const salida = datos.salidas.find(s => s.id === d.salida_id);
    if (!salida || salida.fecha < fechaISO()) throw new Error('Esa salida ya no está disponible.');
    const { libres } = conCupos(salida, datos.reservas);
    if (v.personas > libres) throw new Error(libres > 0 ? `Solo quedan ${libres} cupos en esta salida.` : 'Esta salida se acaba de agotar.');
    if (v.yape_otp !== '123456') throw new Error('Yape no aceptó el celular o el código. Genera un código nuevo e inténtalo otra vez.');
    const rechazo = RECHAZOS_DEMO[v.yape_celular];
    if (rechazo || !v.yape_celular.startsWith('11111111')) throw new Error(rechazo || 'Yape rechazó el pago. Inténtalo de nuevo con un código nuevo.');
    const monto = v.personas * CONFIG.ADELANTO_POR_PERSONA;
    const reserva = { id: ++datos.sigId, salida_id: salida.id, nombre: v.nombre, telefono: v.telefono, correo: v.correo, personas: v.personas,
      estado: 'pagada', origen: 'web', monto, mp_pago_id: `demo-${datos.sigId}`, whatsapp_estado: 'no_configurado' };
    datos.reservas.push(reserva);
    guardar(datos);
    return { ok: true, reserva_id: reserva.id, monto, fecha: salida.fecha, whatsapp: 'no_configurado' };
  },
  async reenviarConfirmacion() {
    throw new Error('En modo demostración no se envían mensajes de WhatsApp.');
  }
};

const RECHAZOS_DEMO = {
  '111111112': 'Yape pidió autorizar el pago. Revisa tu app de Yape e inténtalo de nuevo.',
  '111111113': 'El monto supera tu límite diario de Yape. Puedes subirlo en la app de Yape.',
  '111111116': 'Superaste los intentos permitidos. Genera un código nuevo en Yape.',
  '111111117': 'El código de aprobación no es correcto o ya venció. Genera uno nuevo en Yape.',
  '111111118': 'Los datos de Yape no son válidos. Revisa tu número y el código.'
};

// Las mismas reglas que valida la Edge Function, para avisar antes de enviar
export function validarPago(d) {
  const v = {
    nombre: String(d.nombre ?? '').trim(),
    telefono: String(d.telefono ?? '').replace(/\D/g, ''),
    correo: String(d.correo ?? '').trim().toLowerCase(),
    personas: Number(d.personas),
    yape_celular: String(d.yape_celular ?? '').replace(/\D/g, ''),
    yape_otp: String(d.yape_otp ?? '').replace(/\D/g, '')
  };
  if (!v.nombre) throw new Error('Escribe tu nombre.');
  if (!/^9\d{8}$/.test(v.telefono)) throw new Error('Escribe un WhatsApp peruano de 9 dígitos que empiece con 9.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo)) throw new Error('Escribe un correo válido.');
  if (!Number.isInteger(v.personas) || v.personas < 1 || v.personas > 12) throw new Error('Elige entre 1 y 12 personas.');
  if (!/^\d{9}$/.test(v.yape_celular)) throw new Error('Escribe el celular de tu Yape (9 dígitos).');
  if (!/^\d{6}$/.test(v.yape_otp)) throw new Error('Escribe el código de aprobación de Yape (6 dígitos).');
  return v;
}

/* ---------------- Supabase ---------------- */
let clientePromesa = null;
function cliente() {
  if (!clientePromesa) {
    clientePromesa = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm')
      .then(({ createClient }) => createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY));
  }
  return clientePromesa;
}
function revisar({ data, error }) {
  if (error) {
    const m = error.message || '';
    const cupos = m.match(/CUPOS_INSUFICIENTES:(\d+)/);
    if (cupos) throw new ErrorCupos(Number(cupos[1]));
    if (m.includes('salidas_fecha_key')) throw new Error('Ya existe una salida en esa fecha.');
    if (m.includes('salidas_minimo_check')) throw new Error('El mínimo no puede ser mayor que los cupos.');
    if (m.includes('violates foreign key')) throw new Error('No se puede eliminar una salida que tiene reservas.');
    throw new Error(m || 'Error de conexión con la base de datos.');
  }
  return data;
}

const nube = {
  async listarPicanterias() {
    const sb = await cliente();
    return revisar(await sb.from('picanterias').select('*').order('orden'));
  },
  async listarSalidasPublicas() {
    const sb = await cliente();
    return revisar(await sb.rpc('salidas_disponibles'));
  },
  async sesion() {
    const sb = await cliente();
    const { data } = await sb.auth.getSession();
    return data.session ? { correo: data.session.user.email } : null;
  },
  async iniciarSesion(correo, clave) {
    const sb = await cliente();
    const { data, error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error) throw new Error('Correo o contraseña incorrectos.');
    return { correo: data.user.email };
  },
  async cerrarSesion() { const sb = await cliente(); await sb.auth.signOut(); },
  async listarSalidas() {
    const sb = await cliente();
    const salidas = revisar(await sb.from('salidas').select('*').order('fecha'));
    const reservas = revisar(await sb.from('reservas').select('salida_id, personas, estado'));
    return salidas.map(s => conCupos(s, reservas));
  },
  async crearSalida({ fecha, cupos, minimo }) {
    const sb = await cliente();
    return revisar(await sb.from('salidas').insert({ fecha, cupos: Number(cupos), minimo: Number(minimo) }).select().single());
  },
  async eliminarSalida(id) {
    const sb = await cliente();
    revisar(await sb.from('salidas').delete().eq('id', id));
  },
  async listarReservas(salidaId) {
    const sb = await cliente();
    return revisar(await sb.from('reservas').select('*').eq('salida_id', salidaId).order('creado_en'));
  },
  async registrarReserva(reserva) {
    const sb = await cliente();
    return revisar(await sb.from('reservas').insert({ ...reserva, personas: Number(reserva.personas) }).select().single());
  },
  async cambiarEstado(id, estado) {
    const sb = await cliente();
    revisar(await sb.from('reservas').update({ estado }).eq('id', id));
  },
  async eliminarReserva(id) {
    const sb = await cliente();
    revisar(await sb.from('reservas').delete().eq('id', id));
  },
  async reiniciarDemo() {},

  async pagarConYape(d) {
    const v = validarPago(d);
    return invocarFuncion({ accion: 'pagar', salida_id: d.salida_id, ...v });
  },
  async reenviarConfirmacion(reservaId) {
    return invocarFuncion({ accion: 'reenviar', reserva_id: reservaId });
  }
};

// Llama a la Edge Function "come-tu" y devuelve su mensaje de error tal cual
async function invocarFuncion(cuerpo) {
  const sb = await cliente();
  const { data, error } = await sb.functions.invoke('come-tu', { body: cuerpo });
  if (error) {
    let mensaje = 'No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.';
    try { const j = await error.context.json(); if (j?.error) mensaje = j.error; } catch { /* sin cuerpo */ }
    throw new Error(mensaje);
  }
  return data;
}

export const store = MODO_DEMO ? demo : nube;
