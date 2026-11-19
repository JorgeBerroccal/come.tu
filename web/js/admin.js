// HU-06: panel del operador para gestionar salidas y reservas.
import { store, MODO_DEMO, CREDENCIALES_DEMO } from './store.js';
import { iniciarPagina, esc, formatearFecha, textoCupos, claseCupos, $ } from './ui.js';
import { fechaISO } from './contenido.js';

iniciarPagina();

let salidas = [];
let seleccionada = null;

function mostrarMensaje(el, texto, tipo) {
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

async function verificarSesion() {
  const usuario = await store.sesion();
  $('#acceso').classList.toggle('oculto', !!usuario);
  $('#panel').classList.toggle('oculto', !usuario);
  if (!usuario) {
    if (MODO_DEMO) {
      const pista = $('#pista-demo');
      pista.classList.remove('oculto');
      pista.innerHTML = `Modo demostración: entra con <strong>${CREDENCIALES_DEMO.correo}</strong> y la contraseña <strong>${CREDENCIALES_DEMO.clave}</strong>.`;
    }
    return;
  }
  $('#usuario').textContent = usuario.correo;
  $('#reiniciar').hidden = !MODO_DEMO;
  $('#s-fecha').min = fechaISO();
  await cargarSalidas();
}

async function cargarSalidas() {
  salidas = await store.listarSalidas();
  const cuerpo = $('#tabla-salidas tbody');
  cuerpo.innerHTML = salidas.length ? salidas.map(s => `
    <tr data-id="${s.id}" class="${seleccionada === s.id ? 'seleccionada' : ''}">
      <td>${esc(formatearFecha(s.fecha, { weekday: 'short', day: 'numeric', month: 'short' }))}</td>
      <td>${s.cupos}</td>
      <td>${s.ocupados}</td>
      <td><span class="estado ${claseCupos(s.libres)}">${s.libres > 0 ? s.libres : 'Agotado'}</span></td>
      <td><button class="boton pequeno secundario" data-ver="${s.id}">Ver</button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="pista">Aún no hay salidas.</td></tr>';
  if (seleccionada) await mostrarDetalle(seleccionada);
}

async function mostrarDetalle(id) {
  seleccionada = id;
  const s = salidas.find(x => x.id === id);
  const caja = $('#detalle-salida');
  if (!s) { caja.innerHTML = '<p class="vacio">Elige una salida para ver y registrar viajeros.</p>'; return; }
  document.querySelectorAll('#tabla-salidas tbody tr').forEach(tr => tr.classList.toggle('seleccionada', Number(tr.dataset.id) === id));
  const reservas = await store.listarReservas(id);
  caja.innerHTML = `
    <p class="eyebrow">Salida seleccionada</p>
    <h2 style="font-size:1.3rem">${esc(formatearFecha(s.fecha))}</h2>
    <div class="resumen">
      <div><strong>${s.cupos}</strong><span>cupos</span></div>
      <div><strong data-prueba="ocupados">${s.ocupados}</strong><span>reservados</span></div>
      <div><strong data-prueba="libres">${s.libres}</strong><span>libres</span></div>
    </div>
    <p><span class="estado ${claseCupos(s.libres)}">${textoCupos(s.libres)}</span>
      ${s.ocupados >= s.minimo ? '<span class="estado disponible">Mínimo alcanzado</span>' : `<span class="pista">Faltan ${s.minimo - s.ocupados} para el mínimo de ${s.minimo}</span>`}</p>

    <h3>Registrar reserva</h3>
    <form id="form-reserva">
      <div class="campo"><label for="r-nombre">Nombre del viajero o grupo</label><input id="r-nombre" required maxlength="80"></div>
      <div class="fila-campos">
        <div class="campo"><label for="r-telefono">WhatsApp</label><input id="r-telefono" type="tel" inputmode="numeric" pattern="[0-9 ]{9,15}" required placeholder="9xx xxx xxx"></div>
        <div class="campo"><label for="r-personas">Personas</label><input id="r-personas" type="number" min="1" max="12" value="1" required></div>
        <div class="campo"><label for="r-estado">Estado</label>
          <select id="r-estado"><option value="pagada">Pagada</option><option value="pendiente">Pendiente de pago</option></select></div>
      </div>
      <button class="boton" type="submit">Registrar</button>
      <p class="mensaje oculto" id="msg-reserva" role="status"></p>
    </form>

    <h3 style="margin-top:1.5rem">Viajeros (${reservas.length})</h3>
    <div class="tabla-envoltura">
      <table id="tabla-reservas">
        <thead><tr><th>Nombre</th><th>WhatsApp</th><th>Pers.</th><th>Estado</th><th>Confirmación</th><th></th></tr></thead>
        <tbody>
          ${reservas.length ? reservas.map(r => `
            <tr data-reserva="${r.id}">
              <td>${esc(r.nombre)}<span class="origen">${r.origen === 'web' ? `Web · Yape ${r.monto ? `S/ ${Number(r.monto).toFixed(0)}` : ''}` : 'Panel'}</span></td>
              <td>${esc(r.telefono)}</td>
              <td>${r.personas}</td>
              <td><select data-estado="${r.id}" aria-label="Estado de ${esc(r.nombre)}">
                ${['pagada', 'pendiente', 'cancelada'].map(e => `<option value="${e}" ${r.estado === e ? 'selected' : ''}>${e[0].toUpperCase() + e.slice(1)}</option>`).join('')}
              </select></td>
              <td>${celdaConfirmacion(r)}</td>
              <td><button class="boton pequeno peligro" data-borrar="${r.id}" aria-label="Eliminar reserva de ${esc(r.nombre)}">Quitar</button></td>
            </tr>`).join('') : '<tr><td colspan="6" class="pista">Sin viajeros todavía.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div class="botones">
      <button class="boton secundario pequeno" id="descargar" ${reservas.length ? '' : 'disabled'}>Descargar lista para el hotel (CSV)</button>
      <button class="boton peligro pequeno" id="eliminar-salida">Eliminar salida</button>
    </div>
    <p class="mensaje oculto" id="msg-detalle" role="status"></p>`;

  $('#form-reserva').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#msg-reserva');
    try {
      await store.registrarReserva({
        salida_id: id,
        nombre: $('#r-nombre').value.trim(),
        telefono: $('#r-telefono').value.replace(/\s/g, ''),
        personas: Number($('#r-personas').value),
        estado: $('#r-estado').value
      });
      await cargarSalidas();
      mostrarMensaje($('#msg-reserva'), 'Reserva registrada.', 'ok');
    } catch (err) {
      mostrarMensaje(msg, err.message, 'error');
    }
  });

  $('#tabla-reservas').addEventListener('change', async e => {
    const sel = e.target.closest('[data-estado]');
    if (!sel) return;
    try {
      await store.cambiarEstado(Number(sel.dataset.estado), sel.value);
      await cargarSalidas();
    } catch (err) {
      await cargarSalidas();
      mostrarMensaje($('#msg-detalle'), err.message, 'error');
    }
  });

  $('#tabla-reservas').addEventListener('click', async e => {
    const env = e.target.closest('[data-reenviar]');
    if (env) {
      env.disabled = true;
      env.textContent = 'Enviando…';
      try {
        await store.reenviarConfirmacion(Number(env.dataset.reenviar));
        await cargarSalidas();
        mostrarMensaje($('#msg-detalle'), 'Confirmación enviada por WhatsApp.', 'ok');
      } catch (err) {
        await cargarSalidas();
        mostrarMensaje($('#msg-detalle'), err.message, 'error');
      }
      return;
    }
    const b = e.target.closest('[data-borrar]');
    if (!b) return;
    await store.eliminarReserva(Number(b.dataset.borrar));
    await cargarSalidas();
  });

  $('#descargar').addEventListener('click', () => descargarCSV(s, reservas));

  $('#eliminar-salida').addEventListener('click', async () => {
    try {
      await store.eliminarSalida(id);
      seleccionada = null;
      $('#detalle-salida').innerHTML = '<p class="vacio">Elige una salida para ver y registrar viajeros.</p>';
      await cargarSalidas();
    } catch (err) {
      mostrarMensaje($('#msg-detalle'), err.message, 'error');
    }
  });
}

// HU-05: estado del WhatsApp de confirmación y botón para (re)enviarlo
const TEXTO_WA = { enviado: 'Enviado', error: 'Error', no_configurado: 'Sin configurar' };
function celdaConfirmacion(r) {
  if (r.estado !== 'pagada') return '<span class="pista">—</span>';
  const estado = r.whatsapp_estado || 'ninguno';
  const insignia = `<span class="wa-estado ${estado}" title="${esc(r.whatsapp_detalle || '')}">${TEXTO_WA[estado] || 'No enviado'}</span>`;
  const boton = MODO_DEMO ? '' : `<button class="boton pequeno secundario" data-reenviar="${r.id}">${estado === 'enviado' ? 'Reenviar' : 'Enviar'}</button>`;
  return `${insignia} ${boton}`;
}

// Lista para el hotel: solo reservas activas
function descargarCSV(salida, reservas) {
  const filas = [['Salida', 'Nombre', 'WhatsApp', 'Personas', 'Estado']];
  reservas.filter(r => r.estado !== 'cancelada')
    .forEach(r => filas.push([salida.fecha, r.nombre, r.telefono, r.personas, r.estado]));
  const csv = '﻿' + filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `cometu-salida-${salida.fecha}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#form-acceso').addEventListener('submit', async e => {
  e.preventDefault();
  const error = $('#error-acceso');
  error.classList.add('oculto');
  try {
    await store.iniciarSesion($('#correo').value, $('#clave').value);
    await verificarSesion();
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('oculto');
  }
});

$('#form-salida').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#msg-salida');
  try {
    const nueva = await store.crearSalida({ fecha: $('#s-fecha').value, cupos: $('#s-cupos').value, minimo: $('#s-minimo').value });
    mostrarMensaje(msg, `Salida del ${formatearFecha(nueva.fecha).toLowerCase()} creada.`, 'ok');
    seleccionada = nueva.id;
    await cargarSalidas();
  } catch (err) {
    mostrarMensaje(msg, err.message, 'error');
  }
});

$('#tabla-salidas').addEventListener('click', e => {
  const b = e.target.closest('[data-ver]');
  if (b) mostrarDetalle(Number(b.dataset.ver));
});

$('#salir').addEventListener('click', async () => { await store.cerrarSesion(); seleccionada = null; await verificarSesion(); });
$('#reiniciar').addEventListener('click', async () => { await store.reiniciarDemo(); seleccionada = null; $('#detalle-salida').innerHTML = '<p class="vacio">Elige una salida para ver y registrar viajeros.</p>'; await cargarSalidas(); });

verificarSesion();
