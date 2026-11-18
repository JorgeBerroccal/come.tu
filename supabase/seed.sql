-- Datos iniciales de ejemplo. Reemplazar las picanterías por las aliadas reales.
insert into public.picanterias (nombre, plato, descripcion, direccion, horario, precio_min, precio_max, orden) values
  ('Picantería Warmi Wayta', 'Puca picante', 'Guiso de papa con maní y ají panca, servido con arroz y chicharrón.', 'Jr. 28 de Julio 320, Huamanga', 'Lun a sáb · 8:00 a 16:00', 15, 22, 1),
  ('Cuyería El Chactado', 'Cuy chactado', 'Cuy frito bajo piedra, crocante, con papa y ensalada.', 'Av. Mariscal Cáceres 540, Huamanga', 'Todos los días · 12:00 a 21:00', 35, 45, 2),
  ('Qapchi y Papa Nativa', 'Qapchi', 'Crema de queso fresco con ají y huacatay, para comer con papa.', 'Jr. Grau 145, Huamanga', 'Mar a dom · 9:00 a 14:00', 8, 12, 3),
  ('Mondonguería La Huamanguina', 'Mondongo ayacuchano', 'Caldo de maíz pelado con carne de res y cerdo, ideal temprano.', 'Jr. Callao 210, Huamanga', 'Sáb y dom · 7:00 a 13:00', 12, 18, 4),
  ('Sabores de Quinua', 'Chicharrón con mote', 'Chicharrón de cerdo con mote, papa y zarza criolla.', 'Plaza principal de Quinua', 'Todos los días · 10:00 a 17:00', 18, 25, 5),
  ('Patachi de la Abuela', 'Patachi', 'Sopa espesa de trigo con habas y carne seca.', 'Jr. Lima 410, Huamanga', 'Lun a vie · 11:00 a 15:00', 10, 15, 6);

-- Tres salidas de ejemplo los próximos sábados
insert into public.salidas (fecha, cupos, minimo)
select (date_trunc('week', now() at time zone 'America/Lima')::date + 5 + 7 * n), 12, 8
from generate_series(1, 3) as n
on conflict (fecha) do nothing;
