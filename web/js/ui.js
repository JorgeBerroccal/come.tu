// Utilidades compartidas por todas las páginas.
import { CONFIG } from './config.js';
import { MODO_DEMO } from './store.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);

export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatearFecha(iso, opciones = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [a, m, d] = iso.split('-').map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString('es-PE', opciones);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function soles(n) { return `S/ ${Number(n).toLocaleString('es-PE')}`; }

// HU-03: texto del estado de cupos
export function textoCupos(libres) {
  if (libres <= 0) return 'Agotado';
  return libres === 1 ? 'Queda 1 cupo' : `Quedan ${libres} cupos`;
}
export function claseCupos(libres) {
  if (libres <= 0) return 'agotado';
  return libres <= 3 ? 'pocos' : 'disponible';
}

export function enlaceWhatsApp(mensaje) {
  return `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export function mensajeReserva(salida) {
  return `Hola Come.Tú, quiero reservar el paquete «Ayacucho para comer» para la salida del ${formatearFecha(salida.fecha).toLowerCase()}. ¿Cuántas personas pueden ir y cómo pago el adelanto?`;
}

// Tarjeta de una salida para el viajero (HU-03)
export function htmlSalida(s) {
  const lleno = s.libres <= 0;
  const pct = Math.min(100, Math.round((s.ocupados / s.cupos) * 100));
  return `
    <li class="salida" data-salida="${esc(s.fecha)}">
      <div>
        <div class="fecha">${esc(formatearFecha(s.fecha))}</div>
        <div class="detalle">${s.ocupados} de ${s.cupos} cupos reservados</div>
      </div>
      <span class="estado ${claseCupos(s.libres)}" data-prueba="cupos">${textoCupos(s.libres)}</span>
      <div class="acciones">
        ${lleno
          ? '<button class="boton pequeno" disabled aria-disabled="true">Sin cupos</button>'
          : `<a class="boton pequeno whatsapp" data-prueba="reservar" href="${esc(enlaceWhatsApp(mensajeReserva(s)))}" target="_blank" rel="noopener">Reservar por WhatsApp</a>`}
      </div>
      <div class="barra" aria-hidden="true"><span style="width:${pct}%"></span></div>
    </li>`;
}

export function iniciarPagina() {
  if (MODO_DEMO) {
    const aviso = document.createElement('div');
    aviso.className = 'aviso-demo';
    aviso.textContent = 'Modo demostración: los datos se guardan solo en este navegador.';
    document.body.prepend(aviso);
  }
  const version = $('[data-version]');
  if (version) version.textContent = `Versión ${CONFIG.VERSION}`;
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
