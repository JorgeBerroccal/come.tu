# Come.Tú Experiencias · Ayacucho para comer

Web móvil de la startup **Come.Tú Experiencias**: turismo gastronómico en Huamanga, Ayacucho.
Proyecto del curso *Innovación Tecnológica, Creatividad y Emprendimiento (IS-386)* · UNSCH 2026.

**Equipo:** Jorge Luis Berrocal Yucra · Fredy Jhosmel De La Cruz Huaraca · Frank Huicho Solier · Michael Walter Pacheco Quispe · Rodrigo Gerardo Pillaca Cabrera
**Docente:** Ing. José Antonio Guerrero Hinostroza

## Iteración 1 (Release 1)

| Historia | Qué hace | Página |
| --- | --- | --- |
| HU-01 Explorar rutas gastronómicas | Picanterías con dirección, horario, plato recomendado, precio y enlace a Google Maps | `donde-comer.html` |
| HU-02 Ver detalle del paquete | Itinerario de 2 días y 1 noche, qué incluye y qué no, precio total de S/ 320 | `paquete.html` |
| HU-03 Ver cupos disponibles | «Quedan N cupos» por fecha; «Agotado» bloquea la reserva | `index.html`, `paquete.html` |
| HU-06 Gestionar salidas y reservas | Panel del equipo: crear salidas, registrar viajeros, controlar cupos y descargar la lista para el hotel | `admin.html` |

En este release el viajero reserva escribiendo por WhatsApp y el equipo registra la reserva en el panel.
El pago en línea (HU-04) y la confirmación automática (HU-05) llegan en el Release 2.

## Probarla en tu computadora

```bash
npm start            # abre http://localhost:5173
```

Sin configurar nada, la app funciona en **modo demostración**: los datos se guardan en el navegador.
Panel del equipo (`admin.html`): correo `equipo@cometu.pe`, contraseña `cometu2026`.

## Conectar la base de datos real (Supabase)

1. Crear un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor → New query**, pegar todo `supabase/instalar.sql` (esquema + datos iniciales) y presionar **Run**.
3. En **Authentication → Providers → Email**, desactivar *Allow new users to sign up*.
4. En **Authentication → Users**, crear una cuenta para cada integrante del equipo.
5. Copiar *Project URL* y *anon public key* (Project Settings → API) en `web/js/config.js`.
6. Poner el número de WhatsApp del equipo en `web/js/config.js`.

La seguridad está en la base de datos (Row Level Security): el público solo ve las picanterías y el número de cupos libres; los datos de los viajeros solo los ve el equipo.

## Pruebas

```bash
npm install
npx playwright install chromium
npm test             # pruebas de aceptación de la Tabla 2 + tiempo de carga (SP-04)
npm run test:sp02    # spike de concurrencia de cupos (necesita PostgreSQL: PGHOST, PGPORT, PGUSER)
```

Los resultados y las capturas quedan en `docs/`.

## Publicación (Small Releases)

Cada cambio que llega a la rama `main` pasa por las pruebas de aceptación y, si todas pasan, se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).
Para activarlo: **Settings → Pages → Source: GitHub Actions**.

## Estructura

```
web/                 sitio publicado (HTML, CSS y JavaScript sin frameworks)
  js/store.js        capa de datos: Supabase o modo demostración
  js/contenido.js    paquete y datos de demostración
  sw.js              service worker (abre rápido y con poca señal)
supabase/            esquema, seguridad y datos iniciales
tests/               pruebas de aceptación y spike SP-02
docs/                resultados de pruebas y capturas
```

Las picanterías de demostración tienen nombres ficticios; se reemplazan por las aliadas reales en la tabla `picanterias`.
