#!/usr/bin/env bash
# SP-02 · Spike de concurrencia de cupos
# Simula 20 viajeros que intentan reservar al mismo tiempo el ÚLTIMO cupo de una salida.
# Se prueba dos veces:
#   A) sin bloqueo de fila (versión ingenua)  -> se espera sobreventa
#   B) con el trigger real de supabase/schema.sql (SELECT ... FOR UPDATE) -> se espera 1 sola reserva
# Para que la carrera sea visible se añade una pausa de 0,2 s dentro del trigger
# (simula un servidor lento). Uso: PGHOST=... PGPORT=... PGUSER=... ./tests/sp02_concurrencia.sh
set -euo pipefail
PSQL="psql -X -q -t -A -v ON_ERROR_STOP=1"
INTENTOS=20

preparar() {
  $PSQL <<'SQL'
delete from reservas; delete from salidas;
insert into salidas (id, fecha, cupos, minimo) overriding system value values (999, '2030-01-05', 12, 8);
insert into reservas (salida_id, nombre, telefono, personas, estado) values (999, 'Grupo base', '900000000', 11, 'pagada');
SQL
}

usar_trigger() { # $1 = "con" | "sin" bloqueo
  local lock=""; [ "$1" = "con" ] && lock="for update"
  $PSQL <<SQL
create or replace function public.validar_cupos() returns trigger language plpgsql as \$\$
declare v_cupos int; v_ocupados int;
begin
  if new.estado = 'cancelada' then return new; end if;
  select cupos into v_cupos from public.salidas where id = new.salida_id $lock;
  select coalesce(sum(personas),0) into v_ocupados from public.reservas
   where salida_id = new.salida_id and estado in ('pagada','pendiente') and id is distinct from new.id;
  perform pg_sleep(0.2);
  if v_ocupados + new.personas > v_cupos then
    raise exception 'CUPOS_INSUFICIENTES:%', greatest(v_cupos - v_ocupados, 0) using errcode = 'check_violation';
  end if;
  return new;
end; \$\$;
SQL
}

lanzar() {
  local ok=0 pids=() i
  local dir; dir=$(mktemp -d)
  for i in $(seq 1 $INTENTOS); do
    ( $PSQL -c "insert into reservas (salida_id, nombre, telefono, personas, estado) values (999, 'Viajero $i', '9000000$(printf %02d $i)', 1, 'pendiente');" >/dev/null 2>&1 && touch "$dir/ok$i" ) &
    pids+=($!)
  done
  for p in "${pids[@]}"; do wait "$p" || true; done
  ok=$(ls "$dir" | wc -l); rm -rf "$dir"
  local ocupados; ocupados=$($PSQL -c "select coalesce(sum(personas),0) from reservas where salida_id = 999 and estado <> 'cancelada';")
  echo "$1 | intentos: $INTENTOS | reservas aceptadas: $ok | ocupados: $ocupados de 12"
}

echo "== SP-02: 20 reservas simultáneas sobre 1 cupo libre =="
preparar; usar_trigger sin; lanzar "A) Sin bloqueo (ingenuo)       "
preparar; usar_trigger con; lanzar "B) Con bloqueo FOR UPDATE (real)"
# Restaurar el trigger oficial
$PSQL -f "$(dirname "$0")/../supabase/schema.sql" >/dev/null 2>&1
$PSQL -c "delete from reservas; delete from salidas;"
