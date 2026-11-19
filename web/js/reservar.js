// HU-04: reservar y pagar el adelanto con Yape. HU-05: confirmación por WhatsApp.
import { store, MODO_DEMO, PAGOS_ACTIVOS } from './store.js';
import { CONFIG } from './config.js';
import { iniciarPagina, esc, formatearFecha, textoCupos, claseCupos, soles, enlaceWhatsApp, mensajeReserva, $ } from './ui.js';

iniciarPagina();

const id = Number(new URLSearchParams(location.search).get('salida'));
const caja = $('#resumen-salida');
const form = $('#form-pago');
let salida = null;

function actualizarMontos() {
  const n = Number($('#p-personas').value);
  const adelanto = n * CONFIG.ADELANTO_POR_PERSONA;
  $('[data-prueba="adelanto"]').textContent = soles(adelanto);
  $('[data-prueba="saldo"]').textContent = soles(n * (CONFIG.PRECIO_POR_PERSONA - CONFIG.ADELANTO_POR_PERSONA));
  $('#pagar').textContent = `Pagar ${soles(adelanto)} con Yape`;
}

async function cargar() {
  if (!PAGOS_ACTIVOS) {
    caja.innerHTML = '<p>El pago en línea todavía no está disponible. Reserva por WhatsApp desde la página del paquete.</p><a class="boton" href="paquete.html#fechas">Ver fechas</a>';
    return;
  }
  const salidas = await store.listarSalidasPublicas();
  salida = salidas.find(s => s.id === id);
  if (!salida) {
    caja.innerHTML = '<p>Esa salida ya no está disponible.</p><a class="boton" href="paquete.html#fechas">Elegir otra fecha</a>';
    return;
  }
  caja.innerHTML = `
    <p class="eyebrow">Salida elegida</p>
    <h2 style="font-size:1.4rem">${esc(formatearFecha(salida.fecha))}</h2>
    <p style="margin:0">2 días y 1 noche · ${soles(CONFIG.PRECIO_POR_PERSONA)} por persona
      <span class="estado ${claseCupos(salida.libres)}" data-prueba="cupos" style="margin-left:6px">${textoCupos(salida.libres)}</span></p>`;
  if (salida.libres <= 0) {
    caja.insertAdjacentHTML('beforeend', '<p style="margin-top:12px">Esta salida está agotada.</p><a class="boton" href="paquete.html#fechas">Elegir otra fecha</a>');
    return;
  }
  const max = Math.min(salida.libres, 12);
  $('#p-personas').innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? 'personas' : 'persona'}</option>`).join('');
  actualizarMontos();
  if (CONFIG.PAGOS_PRUEBA || MODO_DEMO) {
    const aviso = $('#aviso-prueba');
    aviso.innerHTML = 'Modo de prueba: no se cobra dinero real. Usa el celular <strong>111111111</strong> y el código <strong>123456</strong>.';
    aviso.classList.remove('oculto');
  }
  form.classList.remove('oculto');
}

$('#p-personas').addEventListener('change', actualizarMontos);

form.addEventListener('submit', async e => {
  e.preventDefault();
  const error = $('#error-pago');
  const boton = $('#pagar');
  error.classList.add('oculto');
  boton.disabled = true;
  const textoBoton = boton.textContent;
  boton.textContent = 'Procesando el pago…';
  try {
    const r = await store.pagarConYape({
      salida_id: id,
      nombre: $('#p-nombre').value,
      telefono: $('#p-telefono').value,
      correo: $('#p-correo').value,
      personas: Number($('#p-personas').value),
      yape_celular: $('#p-yape').value,
      yape_otp: $('#p-otp').value
    });
    if (!r?.ok) throw new Error(r?.error || 'No se pudo completar el pago.');
    mostrarExito(r);
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('oculto');
    boton.disabled = false;
    boton.textContent = textoBoton;
  }
});

function mostrarExito(r) {
  const personas = Number($('#p-personas').value);
  form.classList.add('oculto');
  caja.classList.add('oculto');
  $('.datos-reserva').innerHTML = `
    <dt>Salida</dt><dd>${esc(formatearFecha(r.fecha || salida.fecha))}</dd>
    <dt>Personas</dt><dd>${personas}</dd>
    <dt>Adelanto pagado</dt><dd data-prueba="pagado">${soles(r.monto)}</dd>
    <dt>Saldo</dt><dd>${soles(personas * (CONFIG.PRECIO_POR_PERSONA - CONFIG.ADELANTO_POR_PERSONA))}, el día de la salida</dd>
    <dt>N.° de reserva</dt><dd>${r.reserva_id}</dd>`;
  const wa = $('#exito-whatsapp');
  if (r.whatsapp === 'enviado') {
    wa.textContent = 'Te enviamos la confirmación por WhatsApp con la hora y el punto de encuentro.';
  } else if (MODO_DEMO) {
    wa.textContent = 'En modo demostración no se envía WhatsApp. En la versión real llega la confirmación al instante.';
  } else {
    wa.innerHTML = `Tu pago quedó registrado. Te escribiremos por WhatsApp con la hora y el punto de encuentro. Si tienes dudas, <a href="${esc(enlaceWhatsApp(mensajeReserva(salida)))}" target="_blank" rel="noopener">escríbenos</a>.`;
  }
  $('#exito').classList.remove('oculto');
  $('#exito').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

cargar().catch(() => { caja.innerHTML = '<p class="vacio">No se pudo cargar la salida. Intenta de nuevo.</p>'; });
