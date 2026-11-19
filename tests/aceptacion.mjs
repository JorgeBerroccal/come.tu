// Pruebas de aceptación de la Iteración 1 (Tabla 2 del Laboratorio 8)
// y medición del spike SP-04 (tiempo de carga en 4G y 3G).
// Uso: node tests/aceptacion.mjs   (requiere: npm i -D playwright)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// require() encuentra Playwright tanto en node_modules del proyecto como instalado globalmente
const { chromium } = createRequire(import.meta.url)('playwright');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'web');
const CAPTURAS = path.join(RAIZ, 'docs', 'capturas');
fs.mkdirSync(CAPTURAS, { recursive: true });

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = path.join(WEB, ruta === '/' ? 'index.html' : ruta);
  if (!archivo.startsWith(WEB) || !fs.existsSync(archivo)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  // Las pruebas usan siempre el modo demostración (datos conocidos y sin tocar la base real)
  if (ruta.endsWith('/js/config.js')) {
    return res.end(fs.readFileSync(archivo, 'utf8').replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: ''").replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: ''"));
  }
  fs.createReadStream(archivo).pipe(res);
});
await new Promise(r => servidor.listen(0, r));
const BASE = `http://localhost:${servidor.address().port}`;

const resultados = [];
async function prueba(hu, criterio, fn) {
  try {
    const detalle = await fn();
    resultados.push({ hu, criterio, ok: true, detalle: detalle || '' });
    console.log(`  ✔ ${hu} · ${criterio}${detalle ? ` (${detalle})` : ''}`);
  } catch (e) {
    resultados.push({ hu, criterio, ok: false, detalle: e.message.split('\n')[0] });
    console.log(`  ✘ ${hu} · ${criterio}: ${e.message.split('\n')[0]}`);
  }
}
function afirmar(cond, msg) { if (!cond) throw new Error(msg); }

const navegador = await chromium.launch();
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-PE', timezoneId: 'America/Lima', acceptDownloads: true };
const ctx = await navegador.newContext(movil);
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', e => errores.push(e.message));

console.log('\nIteración 1 · Pruebas de aceptación\n');

// ---------- HU-01 ----------
await prueba('HU-01', 'Al elegir una picantería se ven dirección, horario, plato recomendado y precio, y la ubicación abre en Google Maps', async () => {
  await page.goto(`${BASE}/donde-comer.html`);
  await page.screenshot({ path: path.join(CAPTURAS, 'hu01-lista.png'), fullPage: true });
  await page.locator('.picanteria').first().click();
  const d = page.locator('#detalle');
  await d.waitFor({ state: 'visible' });
  for (const campo of ['direccion', 'horario', 'plato', 'precio']) {
    const t = (await d.locator(`[data-prueba="${campo}"]`).textContent()).trim();
    afirmar(t.length > 0, `falta ${campo}`);
  }
  const href = await d.locator('[data-prueba="mapa"]').getAttribute('href');
  afirmar(href.startsWith('https://www.google.com/maps/search/?api=1&query='), 'el enlace no es de Google Maps');
  await page.screenshot({ path: path.join(CAPTURAS, 'hu01-detalle.png') });
  return `${await page.locator('.picanteria').count()} picanterías`;
});

// ---------- HU-02 ----------
await prueba('HU-02', 'El paquete muestra el itinerario por día, qué incluye y qué no, y el precio total de S/ 320', async () => {
  await page.goto(`${BASE}/paquete.html`);
  const dias = await page.locator('.dia h3').allTextContents();
  afirmar(dias.length === 2, `se esperaban 2 días y hay ${dias.length}`);
  afirmar(await page.locator('#incluye li').count() > 0, 'lista "Incluye" vacía');
  afirmar(await page.locator('#no-incluye li').count() > 0, 'lista "No incluye" vacía');
  const total = (await page.locator('[data-prueba="total"]').textContent()).trim();
  afirmar(total === 'S/ 320', `total mostrado: ${total}`);
  await page.screenshot({ path: path.join(CAPTURAS, 'hu02-paquete.png'), fullPage: true });
  return `${dias.join(' / ')}; total ${total}`;
});

// ---------- HU-03 ----------
await prueba('HU-03', 'Salida con 12 cupos y 9 reservas pagadas muestra «Quedan 3 cupos» y permite reservar', async () => {
  await page.goto(`${BASE}/paquete.html#fechas`);
  const primera = page.locator('.salida').first();
  const texto = (await primera.locator('[data-prueba="cupos"]').textContent()).trim();
  afirmar(texto === 'Quedan 3 cupos', `muestra «${texto}»`);
  afirmar(await primera.locator('[data-prueba="reservar"]').count() === 1, 'no hay botón para reservar');
  return texto;
});
await prueba('HU-03', 'Salida sin cupos aparece como «Agotado» y no deja reservar', async () => {
  const segunda = page.locator('.salida').nth(1);
  const texto = (await segunda.locator('[data-prueba="cupos"]').textContent()).trim();
  afirmar(texto === 'Agotado', `muestra «${texto}»`);
  afirmar(await segunda.locator('[data-prueba="reservar"]').count() === 0, 'todavía deja reservar');
  await page.locator('#fechas').screenshot({ path: path.join(CAPTURAS, 'hu03-cupos.png') });
  return texto;
});

// ---------- HU-06 ----------
await prueba('HU-06', 'Solo el equipo entra al panel: sin sesión no se ve y una contraseña incorrecta se rechaza', async () => {
  await page.goto(`${BASE}/admin.html`);
  await page.locator('#acceso').waitFor({ state: 'visible' });
  afirmar(!(await page.locator('#panel').isVisible()), 'el panel se ve sin sesión');
  await page.fill('#correo', 'equipo@cometu.pe');
  await page.fill('#clave', 'incorrecta');
  await page.click('#form-acceso button[type=submit]');
  await page.locator('#error-acceso').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(CAPTURAS, 'hu06-acceso.png') });
  return (await page.locator('#error-acceso').textContent()).trim();
});
await prueba('HU-06', 'El operador inicia sesión y crea una salida con fecha y cupos', async () => {
  await page.fill('#clave', 'cometu2026');
  await page.click('#form-acceso button[type=submit]');
  await page.locator('#panel').waitFor({ state: 'visible' });
  const d = new Date(); d.setDate(d.getDate() + 45);
  const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const antes = await page.locator('#tabla-salidas tbody tr').count();
  await page.fill('#s-fecha', fecha);
  await page.click('#form-salida button[type=submit]');
  await page.locator('#msg-salida.ok').waitFor();
  const despues = await page.locator('#tabla-salidas tbody tr').count();
  afirmar(despues === antes + 1, `filas antes ${antes}, después ${despues}`);
  return `salida del ${fecha} creada`;
});
await prueba('HU-06', 'Al registrar una reserva, la lista de viajeros y los cupos libres se actualizan al instante', async () => {
  await page.locator('[data-ver]').first().click();
  await page.locator('#form-reserva').waitFor();
  const libresAntes = Number(await page.locator('[data-prueba="libres"]').textContent());
  const filasAntes = await page.locator('#tabla-reservas tbody tr').count();
  await page.fill('#r-nombre', 'Prueba Automática');
  await page.fill('#r-telefono', '987654321');
  await page.fill('#r-personas', '3');
  const t0 = Date.now();
  await page.click('#form-reserva button[type=submit]');
  await page.locator('#msg-reserva.ok').waitFor();
  const ms = Date.now() - t0;
  const libresDespues = Number(await page.locator('[data-prueba="libres"]').textContent());
  const filasDespues = await page.locator('#tabla-reservas tbody tr').count();
  afirmar(libresDespues === libresAntes - 3, `libres ${libresAntes} → ${libresDespues}`);
  afirmar(filasDespues === filasAntes + 1, `viajeros ${filasAntes} → ${filasDespues}`);
  await page.screenshot({ path: path.join(CAPTURAS, 'hu06-panel.png'), fullPage: true });
  return `libres ${libresAntes} → ${libresDespues} en ${ms} ms`;
});
await prueba('HU-06', 'No se puede registrar una reserva si ya no hay cupos (sin sobreventa)', async () => {
  await page.fill('#r-nombre', 'Viajero extra');
  await page.fill('#r-telefono', '987654322');
  await page.fill('#r-personas', '1');
  await page.click('#form-reserva button[type=submit]');
  await page.locator('#msg-reserva.error').waitFor();
  const msg = (await page.locator('#msg-reserva').textContent()).trim();
  afirmar(msg.startsWith('No hay cupos suficientes'), `mensaje: ${msg}`);
  await page.addStyleTag({ content: '.encabezado{position:static}' }); // que el encabezado fijo no tape la captura
  await page.locator('#detalle-salida').screenshot({ path: path.join(CAPTURAS, 'hu06-sin-cupos.png') });
  return msg;
});
await prueba('HU-06', 'Se descarga la lista de viajeros para el hotel', async () => {
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#descargar')]);
  const contenido = fs.readFileSync(await descarga.path(), 'utf8');
  const filas = contenido.trim().split(/\r?\n/);
  afirmar(filas[0].includes('Nombre') && filas.length >= 2, 'CSV vacío');
  fs.writeFileSync(path.join(RAIZ, 'docs', 'ejemplo-lista-hotel.csv'), contenido);
  return `${descarga.suggestedFilename()} con ${filas.length - 1} viajeros`;
});
await prueba('HU-03', 'Lo registrado en el panel se refleja en la página pública (la salida pasa a «Agotado»)', async () => {
  await page.goto(`${BASE}/paquete.html#fechas`);
  const texto = (await page.locator('.salida').first().locator('[data-prueba="cupos"]').textContent()).trim();
  afirmar(texto === 'Agotado', `muestra «${texto}»`);
  return texto;
});

// ---------- Iteración 2 · HU-04 (pago simulado con los números de prueba de Mercado Pago) ----------
await prueba('HU-04', 'Desde el paquete se entra a «Reservar y pagar con Yape» y el adelanto se calcula por persona', async () => {
  await page.goto(`${BASE}/paquete.html#fechas`);
  await page.locator('.salida').nth(2).locator('[data-prueba="reservar"]').click();
  await page.waitForURL(/reservar\.html\?salida=3/);
  await page.locator('#form-pago').waitFor({ state: 'visible' });
  const opciones = await page.locator('#p-personas option').count();
  afirmar(opciones === 8, `se ofrecen ${opciones} opciones de personas, quedan 8 cupos`);
  await page.selectOption('#p-personas', '2');
  const adelanto = (await page.locator('[data-prueba="adelanto"]').textContent()).trim();
  const saldo = (await page.locator('[data-prueba="saldo"]').textContent()).trim();
  afirmar(adelanto === 'S/ 200' && saldo === 'S/ 440', `adelanto ${adelanto}, saldo ${saldo}`);
  await page.fill('#p-nombre', 'Rosa Prueba');
  await page.fill('#p-telefono', '987123456');
  await page.fill('#p-correo', 'rosa@example.com');
  await page.screenshot({ path: path.join(CAPTURAS, 'hu04-formulario.png'), fullPage: true });
  return `adelanto ${adelanto}, saldo ${saldo}`;
});
await prueba('HU-04', 'Si Yape rechaza el pago se muestra el motivo y no se ocupa el cupo', async () => {
  await page.fill('#p-yape', '111111117');
  await page.fill('#p-otp', '123456');
  await page.click('#pagar');
  await page.locator('#error-pago').waitFor({ state: 'visible' });
  const msg = (await page.locator('#error-pago').textContent()).trim();
  afirmar(/código de aprobación/.test(msg), msg);
  afirmar(await page.locator('#form-pago').isVisible(), 'el formulario desapareció');
  return msg;
});
await prueba('HU-04', 'Pago aprobado: se confirma la reserva con el monto pagado y los cupos bajan', async () => {
  await page.fill('#p-yape', '111111111');
  await page.fill('#p-otp', '123456');
  await page.click('#pagar');
  await page.locator('#exito').waitFor({ state: 'visible' });
  const pagado = (await page.locator('[data-prueba="pagado"]').textContent()).trim();
  afirmar(pagado === 'S/ 200', `pagado ${pagado}`);
  await page.screenshot({ path: path.join(CAPTURAS, 'hu04-confirmado.png'), fullPage: true });
  await page.goto(`${BASE}/paquete.html#fechas`);
  const texto = (await page.locator('.salida').nth(2).locator('[data-prueba="cupos"]').textContent()).trim();
  afirmar(texto === 'Quedan 6 cupos', `muestra «${texto}»`);
  return `pagado ${pagado}; ${texto}`;
});
await prueba('HU-04', 'Una salida agotada no permite pagar', async () => {
  await page.goto(`${BASE}/reservar.html?salida=2`);
  await page.locator('#resumen-salida').getByText('agotada').waitFor();
  afirmar(!(await page.locator('#form-pago').isVisible()), 'se muestra el formulario de pago');
  return 'sin formulario';
});
await prueba('HU-05', 'El panel muestra la reserva pagada por Yape y su estado de confirmación', async () => {
  await page.goto(`${BASE}/admin.html`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  await page.locator('[data-ver="3"]').click();
  const fila = page.locator('#tabla-reservas tr', { hasText: 'Rosa Prueba' });
  await fila.waitFor();
  const origen = (await fila.locator('.origen').textContent()).trim();
  const wa = (await fila.locator('.wa-estado').textContent()).trim();
  afirmar(origen === 'Web · Yape S/ 200', `origen «${origen}»`);
  await page.addStyleTag({ content: '.encabezado{position:static}' });
  await page.locator('#detalle-salida').screenshot({ path: path.join(CAPTURAS, 'hu05-panel.png') });
  return `${origen}; WhatsApp: ${wa}`;
});

// Capturas de presentación
await page.goto(`${BASE}/index.html`);
await page.evaluate(() => localStorage.removeItem('cometu-demo-v1'));
await page.reload();
await page.screenshot({ path: path.join(CAPTURAS, 'inicio-movil.png'), fullPage: true });
const escritorio = await navegador.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-PE', timezoneId: 'America/Lima' });
const pe = await escritorio.newPage();
await pe.goto(`${BASE}/index.html`);
await pe.screenshot({ path: path.join(CAPTURAS, 'inicio-escritorio.png') });
await pe.goto(`${BASE}/admin.html`);
await pe.fill('#correo', 'equipo@cometu.pe'); await pe.fill('#clave', 'cometu2026');
await pe.click('#form-acceso button[type=submit]');
await pe.locator('[data-ver]').first().click();
await pe.locator('#form-reserva').waitFor();
await pe.screenshot({ path: path.join(CAPTURAS, 'hu06-panel-escritorio.png'), fullPage: true });
await escritorio.close();

await prueba('General', 'Sin errores de JavaScript en las páginas', async () => {
  afirmar(errores.length === 0, errores.join(' | '));
  return 'ninguno';
});

// ---------- SP-04: carga en redes móviles ----------
console.log('\nSP-04 · Tiempo de carga (primera visita, sin caché)\n');
const REDES = {
  '4G (lenta)': { latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 },
  '3G (rápida)': { latency: 563, downloadThroughput: 1.44 * 1024 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 }
};
const medidas = [];
for (const [red, cond] of Object.entries(REDES)) {
  for (const pagina of ['index.html', 'paquete.html', 'donde-comer.html']) {
    const c = await navegador.newContext({ ...movil, serviceWorkers: 'block' });
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...cond });
    let bytes = 0;
    p.on('response', async r => { try { bytes += (await r.body()).length; } catch { /* */ } });
    const t0 = Date.now();
    await p.goto(`${BASE}/${pagina}`, { waitUntil: 'load' });
    const ms = Date.now() - t0;
    medidas.push({ red, pagina, ms, kb: Math.round(bytes / 1024) });
    console.log(`  ${red.padEnd(12)} ${pagina.padEnd(18)} ${(ms / 1000).toFixed(2)} s  ${Math.round(bytes / 1024)} KB`);
    await c.close();
  }
}
const max4g = Math.max(...medidas.filter(m => m.red.startsWith('4G')).map(m => m.ms));
await prueba('SP-04', 'Cada página carga en menos de 3 s con 4G', async () => {
  afirmar(max4g < 3000, `la más lenta tardó ${(max4g / 1000).toFixed(2)} s`);
  return `la más lenta: ${(max4g / 1000).toFixed(2)} s`;
});

await navegador.close();
servidor.close();

// ---------- Informe ----------
const ok = resultados.filter(r => r.ok).length;
const md = [
  `# Resultados de las pruebas de aceptación · Iteración 1`,
  ``,
  `Ejecutado el ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })} · ${ok} de ${resultados.length} pruebas aprobadas.`,
  ``,
  `| Historia | Criterio | Resultado | Detalle |`,
  `| --- | --- | --- | --- |`,
  ...resultados.map(r => `| ${r.hu} | ${r.criterio} | ${r.ok ? 'Aprobado' : 'Falló'} | ${r.detalle.replace(/\|/g, '/')} |`),
  ``,
  `## SP-04 · Tiempo de carga (primera visita, sin caché)`,
  ``,
  `| Red | Página | Tiempo | Peso |`,
  `| --- | --- | --- | --- |`,
  ...medidas.map(m => `| ${m.red} | ${m.pagina} | ${(m.ms / 1000).toFixed(2)} s | ${m.kb} KB |`),
  ``
].join('\n');
fs.writeFileSync(path.join(RAIZ, 'docs', 'resultados-aceptacion.md'), md);
fs.writeFileSync(path.join(RAIZ, 'docs', 'resultados-aceptacion.json'), JSON.stringify({ resultados, medidas }, null, 2));
console.log(`\n${ok} de ${resultados.length} pruebas aprobadas.\n`);
process.exit(ok === resultados.length ? 0 : 1);
