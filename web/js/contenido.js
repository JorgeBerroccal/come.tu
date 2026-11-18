// Contenido fijo del paquete (HU-02) y datos de demostración.
// El itinerario es una propuesta: se confirma con los proveedores (OE2).

export const PAQUETE = {
  id: 'ayacucho-para-comer',
  nombre: 'Ayacucho para comer',
  duracion: '2 días y 1 noche',
  precio: 320,
  resumen: 'Picanterías de Huamanga, el complejo Wari y Quinua en un solo pago, con hotel y traslados.',
  dias: [
    {
      titulo: 'Día 1 · Huamanga se come',
      paradas: [
        { hora: '08:00', titulo: 'Recojo en el terminal o el aeropuerto', texto: 'Traslado al hotel y entrega de la ruta del viaje.' },
        { hora: '09:00', titulo: 'Desayuno con qapchi', texto: 'Queso fresco, ají y papa nativa para empezar.' },
        { hora: '10:30', titulo: 'Centro histórico de Huamanga', texto: 'Plaza de Armas, portales e iglesias coloniales con un integrante del equipo como guía.' },
        { hora: '13:00', titulo: 'Almuerzo: puca picante', texto: 'El guiso rojo de papa, maní y ají panca en una picantería aliada.' },
        { hora: '16:00', titulo: 'Mercado y barrio de Santa Ana', texto: 'Dulces, panes y talleres de artesanía.' },
        { hora: '19:30', titulo: 'Cena: cuy chactado', texto: 'Cuy crocante con papa sancochada y ensalada.' }
      ]
    },
    {
      titulo: 'Día 2 · Wari y Quinua',
      paradas: [
        { hora: '07:30', titulo: 'Desayuno en el hotel', texto: 'Salida en movilidad privada.' },
        { hora: '08:30', titulo: 'Complejo arqueológico Wari', texto: 'La capital del primer imperio andino.' },
        { hora: '11:00', titulo: 'Pampa de Ayacucho y Quinua', texto: 'Obelisco de la Batalla de Ayacucho y taller de cerámica.' },
        { hora: '13:30', titulo: 'Almuerzo campestre en Quinua', texto: 'Comida típica de la zona.' },
        { hora: '16:00', titulo: 'Retorno y traslado', texto: 'Llevamos al viajero al terminal o al aeropuerto.' }
      ]
    }
  ],
  incluye: [
    '1 noche de hotel en Huamanga',
    '4 comidas en picanterías aliadas (2 almuerzos, 1 cena y 1 desayuno típico) y desayuno en el hotel',
    'Tour al complejo Wari, la Pampa de Ayacucho y Quinua con entradas',
    'Todos los traslados durante el viaje',
    'Guía del equipo Come.Tú en toda la salida',
    'Fichas «Qué hay aquí» de cada lugar'
  ],
  noIncluye: [
    'Pasaje de ida y vuelta a Ayacucho',
    'Bebidas alcohólicas',
    'Compras de artesanía y gastos personales'
  ]
};

// Picanterías de DEMOSTRACIÓN: nombres ficticios.
// Se reemplazan por las picanterías aliadas reales (tabla picanterias en Supabase).
export const PICANTERIAS_DEMO = [
  { id: 1, nombre: 'Picantería Warmi Wayta', plato: 'Puca picante', descripcion: 'Guiso de papa con maní y ají panca, servido con arroz y chicharrón.', direccion: 'Jr. 28 de Julio 320, Huamanga', horario: 'Lun a sáb · 8:00 a 16:00', precio_min: 15, precio_max: 22 },
  { id: 2, nombre: 'Cuyería El Chactado', plato: 'Cuy chactado', descripcion: 'Cuy frito bajo piedra, crocante, con papa y ensalada.', direccion: 'Av. Mariscal Cáceres 540, Huamanga', horario: 'Todos los días · 12:00 a 21:00', precio_min: 35, precio_max: 45 },
  { id: 3, nombre: 'Qapchi y Papa Nativa', plato: 'Qapchi', descripcion: 'Crema de queso fresco con ají y huacatay, para comer con papa.', direccion: 'Jr. Grau 145, Huamanga', horario: 'Mar a dom · 9:00 a 14:00', precio_min: 8, precio_max: 12 },
  { id: 4, nombre: 'Mondonguería La Huamanguina', plato: 'Mondongo ayacuchano', descripcion: 'Caldo de maíz pelado con carne de res y cerdo, ideal temprano.', direccion: 'Jr. Callao 210, Huamanga', horario: 'Sáb y dom · 7:00 a 13:00', precio_min: 12, precio_max: 18 },
  { id: 5, nombre: 'Sabores de Quinua', plato: 'Chicharrón con mote', descripcion: 'Chicharrón de cerdo con mote, papa y zarza criolla.', direccion: 'Plaza principal de Quinua', horario: 'Todos los días · 10:00 a 17:00', precio_min: 18, precio_max: 25 },
  { id: 6, nombre: 'Patachi de la Abuela', plato: 'Patachi', descripcion: 'Sopa espesa de trigo con habas y carne seca.', direccion: 'Jr. Lima 410, Huamanga', horario: 'Lun a vie · 11:00 a 15:00', precio_min: 10, precio_max: 15 }
];

// Fechas relativas a hoy para que la demostración siempre muestre salidas futuras.
function sabadoDentroDe(semanas) {
  const d = new Date();
  const hastaSabado = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + hastaSabado + 7 * semanas);
  return fechaISO(d);
}

// AAAA-MM-DD en hora local (toISOString usaría UTC y podría cambiar el día).
export function fechaISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function datosDemo() {
  const s1 = sabadoDentroDe(0), s2 = sabadoDentroDe(1), s3 = sabadoDentroDe(2);
  return {
    sigId: 100,
    salidas: [
      { id: 1, fecha: s1, cupos: 12, minimo: 8 },
      { id: 2, fecha: s2, cupos: 12, minimo: 8 },
      { id: 3, fecha: s3, cupos: 12, minimo: 8 }
    ],
    reservas: [
      // Salida 1: 9 personas pagadas, quedan 3 cupos
      { id: 11, salida_id: 1, nombre: 'Lucía Ramos', telefono: '900000001', personas: 3, estado: 'pagada' },
      { id: 12, salida_id: 1, nombre: 'Carlos Medina', telefono: '900000002', personas: 2, estado: 'pagada' },
      { id: 13, salida_id: 1, nombre: 'Andrea Quispe', telefono: '900000003', personas: 2, estado: 'pagada' },
      { id: 14, salida_id: 1, nombre: 'Miguel Torres', telefono: '900000004', personas: 2, estado: 'pagada' },
      // Salida 2: agotada (12 de 12)
      { id: 21, salida_id: 2, nombre: 'Familia Huamán', telefono: '900000005', personas: 4, estado: 'pagada' },
      { id: 22, salida_id: 2, nombre: 'Promoción Ing. 2026', telefono: '900000006', personas: 4, estado: 'pagada' },
      { id: 23, salida_id: 2, nombre: 'Rosa Paredes', telefono: '900000007', personas: 2, estado: 'pagada' },
      { id: 24, salida_id: 2, nombre: 'Jorge Vargas', telefono: '900000008', personas: 2, estado: 'pendiente' },
      // Salida 3: 4 de 12
      { id: 31, salida_id: 3, nombre: 'Elena Soto', telefono: '900000009', personas: 2, estado: 'pagada' },
      { id: 32, salida_id: 3, nombre: 'Diego Flores', telefono: '900000010', personas: 2, estado: 'pendiente' }
    ]
  };
}
