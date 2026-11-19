// Prueba de integración de la Edge Function "come-tu" (Iteración 2: HU-04 y HU-05)
//
// Levanta todo en local: PostgreSQL con el esquema real, PostgREST (la API que usa Supabase),
// la función con Deno, y servidores SIMULADOS de Mercado Pago y WhatsApp Cloud API.
// Así se prueba el flujo completo sin dinero real ni mensajes reales.
//
// Requisitos: PostgreSQL (PGHOST, PGPORT, PGUSER), POSTGREST_BIN y DENO_BIN.
// Uso: PGHOST=... PGPORT=... PGUSER=postgres POSTGREST_BIN=... DENO_BIN=... node tests/integracion/pago_whatsapp.mjs
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { PGHOST, PGPORT = '5432', PGUSER = 'postgres', POSTGREST_BIN, DENO_BIN } = process.env;
if (!PGHOST || !POSTGREST_BIN || !DENO_BIN) { console.error('Faltan PGHOST, POSTGREST_BIN o DENO_BIN'); process.exit(2); }

const psql = (sql) => execFileSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: process.env, encoding: 'utf8' }).trim();
const psqlArchivo = (f) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// ---------- Base de datos limpia, como en Supabase ----------
psql(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
drop table if exists reservas, salidas, picanterias cascade;`);
psqlArchivo(path.join(RAIZ, 'supabase', 'instalar.sql'));
psqlArchivo(path.join(RAIZ, 'supabase', 'iteracion2.sql'));
psql(`grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role, authenticated;
grant execute on all functions in schema public to service_role;`);
const salidaId = Number(psql(`select id from salidas order by fecha limit 1`));

// ---------- PostgREST ----------
const SECRETO = crypto.randomBytes(32).toString('hex');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => { const c = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`; return `${c}.${crypto.createHmac('sha256', SECRETO).update(c).digest('base64url')}`; };
const SERVICE_KEY = jwt({ role: 'service_role', iss: 'supabase', exp: Math.floor(Date.now() / 1000) + 3600 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cometu-'));
const conf = path.join(tmp, 'postgrest.conf');
fs.writeFileSync(conf, [
  `db-uri = "postgres://authenticator@/${process.env.PGDATABASE || 'postgres'}?host=${PGHOST}&port=${PGPORT}"`,
  `db-schemas = "public"`, `db-anon-role = "anon"`, `jwt-secret = "${SECRETO}"`, `server-port = 3501`, `log-level = "crit"`
].join('\n'));
const procesos = [];
procesos.push(spawn(POSTGREST_BIN, [conf], { stdio: 'ignore' }));

// ---------- Simuladores: puerta de Supabase, Mercado Pago y WhatsApp ----------
const whatsappRecibidos = [];
const RESULTADO_YAPE = { // números de prueba documentados por Mercado Pago
  '111111111': ['approved', 'accredited'], '111111112': ['rejected', 'cc_rejected_call_for_authorize'],
  '111111113': ['rejected', 'cc_amount_rate_limit_exceeded'], '111111116': ['rejected', 'cc_rejected_max_attempts'],
  '111111117': ['rejected', 'cc_rejected_bad_filled_security_code']
};
let pagosCreados = 0;
const leer = (req) => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
const enviarJSON = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const simulador = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/rest/v1/')) { // → PostgREST
    const cuerpo = await leer(req);
    const p = http.request({ host: '127.0.0.1', port: 3501, method: req.method, path: url.pathname.slice(8) + url.search, headers: { ...req.headers, host: '127.0.0.1:3501' } }, r2 => { res.writeHead(r2.statusCode, r2.headers); r2.pipe(res); });
    return p.end(cuerpo);
  }
  if (url.pathname === '/auth/v1/user') {
    return req.headers.authorization === 'Bearer token-del-equipo'
      ? enviarJSON(res, 200, { id: '00000000-0000-0000-0000-000000000001', email: 'equipo@cometu.pe', aud: 'authenticated', role: 'authenticated' })
      : enviarJSON(res, 401, { message: 'invalid JWT' });
  }
  if (url.pathname === '/mp/platforms/pci/yape/v1/payment') {
    const b = JSON.parse(await leer(req));
    if (url.searchParams.get('public_key') !== 'TEST-public' || b.otp !== '123456' || !b.requestId) return enviarJSON(res, 400, { message: 'invalid otp' });
    return enviarJSON(res, 200, { id: `tok-${b.phoneNumber}` });
  }
  if (url.pathname === '/mp/v1/payments') {
    const b = JSON.parse(await leer(req));
    if (req.headers.authorization !== 'Bearer TEST-access' || !req.headers['x-idempotency-key']) return enviarJSON(res, 401, { message: 'unauthorized' });
    pagosCreados++;
    const [status, status_detail] = RESULTADO_YAPE[b.token.slice(4)] ?? ['rejected', 'cc_rejected_form_error'];
    await new Promise(r => setTimeout(r, 150)); // latencia de red
    return enviarJSON(res, 201, { id: 9000 + pagosCreados, status, status_detail, transaction_amount: b.transaction_amount });
  }
  if (/^\/wa\/v[\d.]+\/PHONE123\/messages$/.test(url.pathname)) {
    const b = JSON.parse(await leer(req));
    whatsappRecibidos.push(b);
    if (b.to === '51999000999') return enviarJSON(res, 400, { error: { message: 'Recipient phone number not in allowed list' } });
    return enviarJSON(res, 200, { messages: [{ id: `wamid.${whatsappRecibidos.length}` }] });
  }
  enviarJSON(res, 404, { message: 'no simulado' });
});
await new Promise(r => simulador.listen(3500, r));

// ---------- La función ----------
const funcion = spawn(DENO_BIN, ['run', '--allow-net', '--allow-env', '--quiet', '--node-modules-dir=none', path.join(RAIZ, 'supabase', 'functions', 'come-tu', 'index.ts')], {
  cwd: tmp,
  env: { ...process.env, DENO_DIR: path.join(os.homedir(), '.cache', 'deno'), PORT: '3502',
    SUPABASE_URL: 'http://127.0.0.1:3500', SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    MP_API_BASE: 'http://127.0.0.1:3500/mp', MP_PUBLIC_KEY: 'TEST-public', MP_ACCESS_TOKEN: 'TEST-access',
    WHATSAPP_API_BASE: 'http://127.0.0.1:3500/wa', WHATSAPP_TOKEN: 'EAAG-prueba', WHATSAPP_PHONE_ID: 'PHONE123',
    ADELANTO_POR_PERSONA: '100' },
  stdio: ['ignore', 'ignore', 'inherit']
});
procesos.push(funcion);

async function esperar(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { await fetch(url, { method: 'OPTIONS' }); return; } catch { await new Promise(r => setTimeout(r, 300)); } }
  throw new Error(`No respondió ${url}`);
}
await esperar('http://127.0.0.1:8000/');
await esperar('http://127.0.0.1:3501/');

const llamar = async (cuerpo, headers = {}) => {
  const r = await fetch('http://127.0.0.1:8000/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(cuerpo) });
  return { status: r.status, body: await r.json() };
};
const reserva = (extra = {}) => ({ accion: 'pagar', salida_id: salidaId, nombre: 'Lucía Ramos', telefono: '987654321', correo: 'lucia@example.com', personas: 2, yape_celular: '111111111', yape_otp: '123456', ...extra });
const ocupados = () => Number(psql(`select coalesce(sum(personas),0) from reservas where salida_id = ${salidaId} and estado in ('pagada','pendiente')`));

const resultados = [];
async function prueba(hu, nombre, fn) {
  try { const d = await fn(); resultados.push({ hu, nombre, ok: true, d }); console.log(`  ✔ ${hu} · ${nombre}${d ? ` (${d})` : ''}`); }
  catch (e) { resultados.push({ hu, nombre, ok: false, d: e.message }); console.log(`  ✘ ${hu} · ${nombre}: ${e.message}`); }
}
const afirmar = (c, m) => { if (!c) throw new Error(m); };

console.log('\nIteración 2 · Prueba de integración (Mercado Pago y WhatsApp simulados)\n');

await prueba('HU-04', 'Pago aprobado con Yape: la reserva queda «Pagada» con el monto del adelanto', async () => {
  const r = await llamar(reserva());
  afirmar(r.status === 200 && r.body.ok, JSON.stringify(r.body));
  const fila = psql(`select estado || '|' || monto || '|' || origen || '|' || (mp_pago_id is not null) from reservas where id = ${r.body.reserva_id}`);
  afirmar(fila === 'pagada|200.00|web|true', fila);
  return `reserva ${r.body.reserva_id}, S/ ${r.body.monto}`;
});
await prueba('HU-05', 'Tras el pago se envía la plantilla de WhatsApp con nombre, fecha, personas y monto', async () => {
  const m = whatsappRecibidos.at(-1);
  afirmar(m && m.to === '51987654321' && m.template.name === 'confirmacion_reserva', JSON.stringify(m));
  const p = m.template.components[0].parameters.map(x => x.text);
  afirmar(p[0] === 'Lucía Ramos' && p[2] === '2' && p[3] === 'S/ 200.00' && /de (noviembre|diciembre)/.test(p[1]), p.join(' | '));
  const estado = psql(`select whatsapp_estado from reservas order by id desc limit 1`);
  afirmar(estado === 'enviado', estado);
  return p.join(' · ');
});
await prueba('HU-04', 'Pago rechazado: mensaje claro y el cupo NO queda ocupado', async () => {
  const antes = ocupados();
  const r = await llamar(reserva({ yape_celular: '111111117' }));
  afirmar(r.status === 402 && /código de aprobación/.test(r.body.error), JSON.stringify(r.body));
  afirmar(ocupados() === antes, 'quedó un cupo ocupado');
  return r.body.error;
});
await prueba('HU-04', 'Código de Yape incorrecto: no se cobra y se libera el cupo', async () => {
  const antes = ocupados(), pagos = pagosCreados;
  const r = await llamar(reserva({ yape_otp: '000000' }));
  afirmar(r.status === 402 && pagosCreados === pagos && ocupados() === antes, JSON.stringify(r.body));
  return r.body.error;
});
await prueba('HU-04', 'Datos inválidos se rechazan antes de cobrar', async () => {
  const pagos = pagosCreados;
  for (const extra of [{ telefono: '12345' }, { correo: 'sin-arroba' }, { personas: 0 }, { yape_otp: '12' }]) {
    const r = await llamar(reserva(extra));
    afirmar(r.status === 400, `${JSON.stringify(extra)} → ${r.status}`);
  }
  afirmar(pagosCreados === pagos, 'se llamó a Mercado Pago');
  return '4 casos';
});
await prueba('HU-04', 'Pedir más personas que cupos libres se rechaza sin cobrar', async () => {
  const libres = 12 - ocupados(), pagos = pagosCreados;
  const r = await llamar(reserva({ personas: libres + 1 }));
  afirmar(r.status === 409 && pagosCreados === pagos, JSON.stringify(r.body));
  return r.body.error;
});
await prueba('SP-02', '6 turistas pagan a la vez 3 cupos cada uno con 10 libres: nunca se sobrevende', async () => {
  const libres = 12 - ocupados();
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => llamar(reserva({ nombre: `Turista ${i + 1}`, telefono: `98700000${i}`, personas: 3 }))));
  const aprobados = rs.filter(r => r.status === 200).length;
  afirmar(ocupados() <= 12, `ocupados ${ocupados()} de 12`);
  afirmar(aprobados === Math.floor(libres / 3), `aprobados ${aprobados}, se esperaban ${Math.floor(libres / 3)}`);
  return `${aprobados} aprobados, ${rs.length - aprobados} rechazados, ocupados ${ocupados()} de 12`;
});
await prueba('SP-02', 'Una reserva web abandonada (pendiente > 15 min) libera su cupo', async () => {
  const otra = Number(psql(`select id from salidas order by fecha offset 1 limit 1`));
  psql(`insert into reservas (salida_id, nombre, telefono, personas, estado, origen, monto, creado_en) values (${otra}, 'Abandonó', '987111222', 4, 'pendiente', 'web', 400, now() - interval '20 minutes')`);
  const r = await llamar(reserva({ salida_id: otra, personas: 1 }));
  const quedan = Number(psql(`select count(*) from reservas where nombre = 'Abandonó'`));
  afirmar(r.status === 200 && quedan === 0, `status ${r.status}, abandonadas ${quedan}`);
  return 'cupo liberado';
});
await prueba('HU-05', 'Si WhatsApp falla, el pago se mantiene y el error queda registrado', async () => {
  const otra = Number(psql(`select id from salidas order by fecha offset 2 limit 1`));
  const r = await llamar(reserva({ salida_id: otra, telefono: '999000999', personas: 1 }));
  afirmar(r.status === 200 && r.body.whatsapp === 'error', JSON.stringify(r.body));
  const fila = psql(`select estado || '|' || whatsapp_estado from reservas where id = ${r.body.reserva_id}`);
  afirmar(fila === 'pagada|error', fila);
  return psql(`select whatsapp_detalle from reservas where id = ${r.body.reserva_id}`);
});
await prueba('HU-05', 'Reenviar la confirmación exige sesión del equipo', async () => {
  const id = Number(psql(`select id from reservas where estado = 'pagada' order by id limit 1`));
  const sin = await llamar({ accion: 'reenviar', reserva_id: id });
  const con = await llamar({ accion: 'reenviar', reserva_id: id }, { Authorization: 'Bearer token-del-equipo' });
  afirmar(sin.status === 401 && con.status === 200 && con.body.whatsapp === 'enviado', `${sin.status} / ${con.status}`);
  return 'sin sesión 401, con sesión enviado';
});

procesos.forEach(p => p.kill());
simulador.close();
const ok = resultados.filter(r => r.ok).length;
fs.writeFileSync(path.join(RAIZ, 'docs', 'resultados-integracion-iteracion2.md'), [
  '# Prueba de integración · Iteración 2', '',
  `Ejecutada el ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })} · ${ok} de ${resultados.length} aprobadas.`,
  'PostgreSQL y PostgREST reales; Mercado Pago y WhatsApp Cloud API simulados con sus respuestas documentadas.', '',
  '| Historia | Prueba | Resultado | Detalle |', '| --- | --- | --- | --- |',
  ...resultados.map(r => `| ${r.hu} | ${r.nombre} | ${r.ok ? 'Aprobado' : 'Falló'} | ${String(r.d ?? '').replace(/\|/g, '/')} |`), ''
].join('\n'));
console.log(`\n${ok} de ${resultados.length} pruebas aprobadas.\n`);
process.exit(ok === resultados.length ? 0 : 1);
