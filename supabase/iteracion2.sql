-- Come.Tú · Iteración 2 (HU-04 pago con Yape, HU-05 confirmación por WhatsApp)
-- Ejecutar en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

alter table public.reservas add column if not exists correo     text;
alter table public.reservas add column if not exists origen     text not null default 'panel';
alter table public.reservas add column if not exists monto      numeric(8,2);
alter table public.reservas add column if not exists mp_pago_id text;
alter table public.reservas add column if not exists whatsapp_estado  text;
alter table public.reservas add column if not exists whatsapp_detalle text;

alter table public.reservas drop constraint if exists reservas_origen_check;
alter table public.reservas add constraint reservas_origen_check check (origen in ('panel', 'web'));

alter table public.reservas drop constraint if exists reservas_whatsapp_estado_check;
alter table public.reservas add constraint reservas_whatsapp_estado_check
  check (whatsapp_estado is null or whatsapp_estado in ('enviado', 'error', 'no_configurado'));

-- Un pago de Mercado Pago solo puede quedar ligado a una reserva
create unique index if not exists reservas_mp_pago_idx on public.reservas (mp_pago_id) where mp_pago_id is not null;

-- Las reservas web que quedaron "pendiente" más de 15 minutos (pago abandonado) liberan su cupo.
-- La Edge Function llama a esta limpieza antes de cada nueva reserva (SP-02: bloqueo temporal).
create or replace function public.liberar_reservas_vencidas()
returns int
language sql
security definer
set search_path = public
as $$
  with borradas as (
    delete from public.reservas
    where origen = 'web' and estado = 'pendiente' and creado_en < now() - interval '15 minutes'
    returning 1
  )
  select count(*)::int from borradas;
$$;
revoke all on function public.liberar_reservas_vencidas() from public, anon, authenticated;
grant execute on function public.liberar_reservas_vencidas() to service_role;
