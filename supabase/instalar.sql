-- Come.Tú · instalación completa en Supabase (esquema + datos iniciales)
-- Pegar TODO este archivo en Supabase → SQL Editor → New query y presionar Run.

-- Come.Tú Experiencias · Base de datos (Supabase / PostgreSQL)
-- Iteración 1: HU-01 (picanterías), HU-03 (cupos) y HU-06 (panel del operador).
-- Ejecutar completo en Supabase → SQL Editor.

-- =========================================================
-- Tablas
-- =========================================================
create table if not exists public.picanterias (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  plato       text not null,
  descripcion text not null default '',
  direccion   text not null,
  horario     text not null,
  precio_min  numeric(6,2) not null check (precio_min >= 0),
  precio_max  numeric(6,2) not null,
  orden       int not null default 0,
  constraint picanterias_precio_check check (precio_max >= precio_min)
);

create table if not exists public.salidas (
  id      bigint generated always as identity primary key,
  fecha   date not null unique,               -- una salida por fecha (salidas_fecha_key)
  cupos   int  not null default 12 check (cupos between 1 and 60),
  minimo  int  not null default 8,
  constraint salidas_minimo_check check (minimo between 1 and cupos)
);

create table if not exists public.reservas (
  id         bigint generated always as identity primary key,
  salida_id  bigint not null references public.salidas(id) on delete restrict,
  nombre     text not null check (length(trim(nombre)) > 0),
  telefono   text not null check (telefono ~ '^[0-9]{9,15}$'),
  personas   int  not null check (personas between 1 and 12),
  estado     text not null default 'pendiente' check (estado in ('pagada', 'pendiente', 'cancelada')),
  creado_en  timestamptz not null default now()
);
create index if not exists reservas_salida_idx on public.reservas (salida_id);

-- =========================================================
-- SP-02: nunca vender más cupos de los que hay
-- El trigger bloquea la fila de la salida (FOR UPDATE), así dos reservas
-- simultáneas se atienden una después de otra y la segunda ve el cupo ocupado.
-- =========================================================
create or replace function public.validar_cupos()
returns trigger
language plpgsql
as $$
declare
  v_cupos    int;
  v_ocupados int;
begin
  if new.estado = 'cancelada' then
    return new;
  end if;

  select cupos into v_cupos from public.salidas where id = new.salida_id for update;

  select coalesce(sum(personas), 0) into v_ocupados
  from public.reservas
  where salida_id = new.salida_id
    and estado in ('pagada', 'pendiente')
    and id is distinct from new.id;

  if v_ocupados + new.personas > v_cupos then
    raise exception 'CUPOS_INSUFICIENTES:%', greatest(v_cupos - v_ocupados, 0)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists reservas_validar_cupos on public.reservas;
create trigger reservas_validar_cupos
  before insert or update of personas, estado, salida_id on public.reservas
  for each row execute function public.validar_cupos();

-- No permitir bajar los cupos por debajo de lo ya reservado
create or replace function public.validar_reduccion_cupos()
returns trigger
language plpgsql
as $$
declare v_ocupados int;
begin
  select coalesce(sum(personas), 0) into v_ocupados
  from public.reservas where salida_id = new.id and estado in ('pagada', 'pendiente');
  if new.cupos < v_ocupados then
    raise exception 'CUPOS_INSUFICIENTES:%', 0 using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists salidas_validar_cupos on public.salidas;
create trigger salidas_validar_cupos
  before update of cupos on public.salidas
  for each row execute function public.validar_reduccion_cupos();

-- =========================================================
-- HU-03: cupos visibles para el público SIN exponer datos de viajeros
-- =========================================================
create or replace function public.salidas_disponibles()
returns table (id bigint, fecha date, cupos int, minimo int, ocupados int, libres int)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.fecha, s.cupos, s.minimo,
         coalesce(sum(r.personas) filter (where r.estado in ('pagada', 'pendiente')), 0)::int as ocupados,
         greatest(s.cupos - coalesce(sum(r.personas) filter (where r.estado in ('pagada', 'pendiente')), 0), 0)::int as libres
  from public.salidas s
  left join public.reservas r on r.salida_id = s.id
  where s.fecha >= (now() at time zone 'America/Lima')::date
  group by s.id
  order by s.fecha;
$$;

revoke all on function public.salidas_disponibles() from public;
grant execute on function public.salidas_disponibles() to anon, authenticated;

-- =========================================================
-- Seguridad (Row Level Security)
--  - Público (anon): solo lee picanterías y la función de cupos.
--  - Equipo (authenticated): administra salidas y reservas.
--  IMPORTANTE: en Authentication → Providers → Email, desactivar
--  "Allow new users to sign up" y crear a mano las cuentas del equipo.
-- =========================================================
alter table public.picanterias enable row level security;
alter table public.salidas     enable row level security;
alter table public.reservas    enable row level security;

drop policy if exists "picanterias lectura publica" on public.picanterias;
create policy "picanterias lectura publica" on public.picanterias for select to anon, authenticated using (true);
drop policy if exists "picanterias equipo" on public.picanterias;
create policy "picanterias equipo" on public.picanterias for all to authenticated using (true) with check (true);

drop policy if exists "salidas equipo" on public.salidas;
create policy "salidas equipo" on public.salidas for all to authenticated using (true) with check (true);

drop policy if exists "reservas equipo" on public.reservas;
create policy "reservas equipo" on public.reservas for all to authenticated using (true) with check (true);

grant select on public.picanterias to anon;
grant select, insert, update, delete on public.picanterias, public.salidas, public.reservas to authenticated;

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
