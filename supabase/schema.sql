-- =====================================================================
-- Perfumes Tracker — schema completo para Supabase
-- Pega este archivo entero en el SQL Editor de tu proyecto y ejecútalo.
-- Es seguro volver a ejecutarlo (usa IF NOT EXISTS / CREATE OR REPLACE).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

create table if not exists tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists por_probar (
  id uuid primary key default gen_random_uuid(),
  nombre_perfume text not null,
  referencia text,
  created_at timestamptz not null default now()
);

create table if not exists por_probar_tienda (
  id uuid primary key default gen_random_uuid(),
  por_probar_id uuid not null references por_probar(id) on delete cascade,
  tienda_id uuid not null references tiendas(id),
  precio numeric,
  comentario text,
  disponibilidad text not null default 'con_probador'
    check (disponibilidad in ('con_probador', 'sin_probador')),
  modalidad text not null default 'comprar_aqui'
    check (modalidad in ('comprar_aqui', 'solo_probar')),
  created_at timestamptz not null default now(),
  unique(por_probar_id, tienda_id)
);

create table if not exists pendientes_compra (
  id uuid primary key default gen_random_uuid(),
  nombre_perfume text not null,
  referencia text,
  comentario text,
  tienda_probada_id uuid references tiendas(id),
  fecha_prueba date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists coleccion (
  id uuid primary key default gen_random_uuid(),
  nombre_perfume text not null,
  referencia text,
  comentario text,
  tienda_compra_id uuid references tiendas(id),
  canal_compra text,
  precio numeric,
  fecha_compra date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists lista_negra (
  id uuid primary key default gen_random_uuid(),
  nombre_perfume text not null,
  motivo text not null,
  tienda_probada_id uuid references tiendas(id),
  comentario text,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

-- Perfumes que estaban "por probar" pero resultaron sin stock en ninguna
-- tienda al momento de ir a buscarlos; se guardan aquí para revisar más
-- adelante si volvieron a aparecer.
create table if not exists pendientes_probar (
  id uuid primary key default gen_random_uuid(),
  nombre_perfume text not null,
  referencia text,
  comentario text,
  tienda_agotado_id uuid references tiendas(id),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

-- Snapshot de un perfume justo antes de moverlo a coleccion / lista_negra /
-- pendientes_compra, para poder deshacer el movimiento dentro de 48h.
create table if not exists historial_movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('rechazo', 'compra', 'pendiente_compra')),
  snapshot jsonb not null,
  destino_id uuid not null,
  creado_en timestamptz not null default now(),
  revertido boolean not null default false
);

create table if not exists app_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

create table if not exists app_config (
  id int primary key default 1,
  pin_hash text not null,
  constraint single_row check (id = 1)
);

-- ---------------------------------------------------------------------
-- 1b. MIGRACIONES INCREMENTALES sobre tablas que ya existían en producción
--     (create table if not exists no las toca; se agregan con alter table,
--     también idempotente).
-- ---------------------------------------------------------------------

alter table por_probar add column if not exists destacado boolean not null default false;
alter table pendientes_compra add column if not exists donde_comprar text;

-- ---------------------------------------------------------------------
-- 2. BLOQUEO DE ACCESO DIRECTO
--    RLS activado y SIN políticas para anon/authenticated en ninguna
--    tabla => la API REST de Supabase no devuelve ni acepta nada
--    directamente, ni siquiera con la anon key. Todo pasa por las
--    funciones RPC de la sección 4, que validan el token de sesión.
-- ---------------------------------------------------------------------

alter table tiendas enable row level security;
alter table por_probar enable row level security;
alter table por_probar_tienda enable row level security;
alter table pendientes_compra enable row level security;
alter table pendientes_probar enable row level security;
alter table coleccion enable row level security;
alter table lista_negra enable row level security;
alter table historial_movimientos enable row level security;
alter table app_sessions enable row level security;
alter table app_config enable row level security;

revoke all on tiendas, por_probar, por_probar_tienda, pendientes_compra,
  pendientes_probar, coleccion, lista_negra, historial_movimientos,
  app_sessions, app_config
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE SESIÓN / PIN
-- ---------------------------------------------------------------------

create or replace function public.token_valido(p_token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_sessions
    where token = p_token and expires_at > now()
  );
$$;

create or replace function public.check_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or not token_valido(p_token) then
    raise exception 'Sesión inválida o expirada' using errcode = '28000';
  end if;
end;
$$;

-- Valida el PIN de 4 dígitos y crea una sesión de 90 días.
create or replace function public.validar_pin(p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_token uuid;
begin
  select pin_hash into v_hash from app_config where id = 1;
  if v_hash is null then
    return null;
  end if;
  if v_hash = extensions.crypt(p_pin, v_hash) then
    insert into app_sessions default values returning token into v_token;
    delete from app_sessions where expires_at <= now();
    return v_token;
  else
    return null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. TIENDAS
-- ---------------------------------------------------------------------

create or replace function public.listar_tiendas(p_token uuid)
returns setof tiendas
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query select * from tiendas order by nombre;
end;
$$;

create or replace function public.crear_tienda(p_token uuid, p_nombre text)
returns tiendas
language plpgsql security definer set search_path = public
as $$
declare
  v_row tiendas;
begin
  perform check_token(p_token);
  insert into tiendas (nombre) values (trim(p_nombre)) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.set_tienda_activa(p_token uuid, p_tienda_id uuid, p_activa boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  update tiendas set activa = p_activa where id = p_tienda_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. POR PROBAR
-- ---------------------------------------------------------------------

-- drop porque cambia la forma de la tabla retornada (se agregó "destacado")
-- y create or replace no permite eso.
drop function if exists public.listar_por_probar(uuid);
create or replace function public.listar_por_probar(p_token uuid)
returns table (
  por_probar_id uuid,
  nombre_perfume text,
  referencia text,
  destacado boolean,
  por_probar_tienda_id uuid,
  tienda_id uuid,
  tienda_nombre text,
  precio numeric,
  comentario text,
  disponibilidad text,
  modalidad text,
  creado timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select pp.id, pp.nombre_perfume, pp.referencia, pp.destacado,
           ppt.id, ppt.tienda_id, t.nombre,
           ppt.precio, ppt.comentario, ppt.disponibilidad, ppt.modalidad,
           ppt.created_at
    from por_probar_tienda ppt
    join por_probar pp on pp.id = ppt.por_probar_id
    join tiendas t on t.id = ppt.tienda_id
    order by t.nombre, pp.nombre_perfume;
end;
$$;

create or replace function public.toggle_destacado(p_token uuid, p_por_probar_id uuid, p_destacado boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  update por_probar set destacado = p_destacado where id = p_por_probar_id;
end;
$$;

-- Cambia la tienda de una fila puntual cuando el usuario SABE dónde
-- reapareció el perfume (a diferencia de "Sin stock", que es para cuando
-- no sabe dónde está). Mantiene precio/comentario/modalidad; resetea
-- disponibilidad porque se asume que hay stock en la tienda nueva.
create or replace function public.cambiar_tienda_por_probar(p_token uuid, p_por_probar_tienda_id uuid, p_tienda_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
begin
  perform check_token(p_token);
  select por_probar_id into v_por_probar_id from por_probar_tienda where id = p_por_probar_tienda_id;
  if v_por_probar_id is null then
    raise exception 'No se encontró el registro';
  end if;

  if exists (
    select 1 from por_probar_tienda
    where por_probar_id = v_por_probar_id and tienda_id = p_tienda_id and id <> p_por_probar_tienda_id
  ) then
    raise exception 'Este perfume ya está listado en la tienda elegida';
  end if;

  update por_probar_tienda
    set tienda_id = p_tienda_id, disponibilidad = 'con_probador'
    where id = p_por_probar_tienda_id;
end;
$$;

create or replace function public.obtener_contadores(p_token uuid)
returns table (por_probar_count int, coleccion_count int, lista_negra_count int)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select
      (select count(*)::int from por_probar),
      (select count(*)::int from coleccion),
      (select count(*)::int from lista_negra);
end;
$$;

create or replace function public.crear_por_probar(
  p_token uuid, p_nombre text, p_referencia text, p_tienda_id uuid,
  p_precio numeric, p_comentario text, p_disponibilidad text, p_modalidad text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  perform check_token(p_token);
  insert into por_probar (nombre_perfume, referencia)
    values (trim(p_nombre), nullif(trim(p_referencia), ''))
    returning id into v_id;
  insert into por_probar_tienda (por_probar_id, tienda_id, precio, comentario, disponibilidad, modalidad)
    values (v_id, p_tienda_id, p_precio, p_comentario,
            coalesce(p_disponibilidad, 'con_probador'), coalesce(p_modalidad, 'comprar_aqui'));
  return v_id;
end;
$$;

create or replace function public.agregar_tienda_a_por_probar(
  p_token uuid, p_por_probar_id uuid, p_tienda_id uuid,
  p_precio numeric, p_comentario text, p_disponibilidad text, p_modalidad text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  perform check_token(p_token);
  insert into por_probar_tienda (por_probar_id, tienda_id, precio, comentario, disponibilidad, modalidad)
    values (p_por_probar_id, p_tienda_id, p_precio, p_comentario,
            coalesce(p_disponibilidad, 'con_probador'), coalesce(p_modalidad, 'comprar_aqui'))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.marcar_sin_probador(p_token uuid, p_por_probar_tienda_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  update por_probar_tienda set disponibilidad = 'sin_probador' where id = p_por_probar_tienda_id;
end;
$$;

-- Arma el snapshot de un perfume (fila por_probar + TODAS sus filas de
-- por_probar_tienda, no solo la que gatilló la acción) para historial_movimientos.
create or replace function public.armar_snapshot_por_probar(p_por_probar_id uuid)
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'por_probar', (
      select jsonb_build_object('nombre_perfume', pp.nombre_perfume, 'referencia', pp.referencia, 'destacado', pp.destacado)
      from por_probar pp where pp.id = p_por_probar_id
    ),
    'tiendas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tienda_id', ppt.tienda_id, 'precio', ppt.precio, 'comentario', ppt.comentario,
        'disponibilidad', ppt.disponibilidad, 'modalidad', ppt.modalidad
      )), '[]'::jsonb)
      from por_probar_tienda ppt where ppt.por_probar_id = p_por_probar_id
    )
  );
$$;

-- "Me gustó": mueve el perfume completo (todas sus tiendas) a Colección o
-- a Pendientes de Compra según la modalidad de la tarjeta que gatilló la
-- acción. Guarda un snapshot en historial_movimientos y retorna su id para
-- que el frontend pueda ofrecer "Deshacer".
drop function if exists public.me_gusto(uuid, uuid, numeric);
create or replace function public.me_gusto(
  p_token uuid, p_por_probar_tienda_id uuid, p_precio_final numeric, p_donde_comprar text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
  v_tienda_id uuid;
  v_modalidad text;
  v_nombre text;
  v_referencia text;
  v_comentario text;
  v_destino_id uuid;
  v_historial_id uuid;
  v_snapshot jsonb;
begin
  perform check_token(p_token);

  select ppt.por_probar_id, ppt.tienda_id, ppt.modalidad, pp.nombre_perfume, pp.referencia, ppt.comentario
    into v_por_probar_id, v_tienda_id, v_modalidad, v_nombre, v_referencia, v_comentario
  from por_probar_tienda ppt
  join por_probar pp on pp.id = ppt.por_probar_id
  where ppt.id = p_por_probar_tienda_id;

  if v_por_probar_id is null then
    raise exception 'No se encontró el registro';
  end if;

  v_snapshot := armar_snapshot_por_probar(v_por_probar_id);

  if v_modalidad = 'comprar_aqui' then
    insert into coleccion (nombre_perfume, referencia, comentario, tienda_compra_id, precio, fecha_compra)
      values (v_nombre, v_referencia, v_comentario, v_tienda_id, p_precio_final, current_date)
      returning id into v_destino_id;
    insert into historial_movimientos (tipo, snapshot, destino_id)
      values ('compra', v_snapshot, v_destino_id) returning id into v_historial_id;
  else
    insert into pendientes_compra (nombre_perfume, referencia, comentario, tienda_probada_id, fecha_prueba, donde_comprar)
      values (v_nombre, v_referencia, v_comentario, v_tienda_id, current_date, nullif(trim(coalesce(p_donde_comprar, '')), ''))
      returning id into v_destino_id;
    insert into historial_movimientos (tipo, snapshot, destino_id)
      values ('pendiente_compra', v_snapshot, v_destino_id) returning id into v_historial_id;
  end if;

  delete from por_probar where id = v_por_probar_id;
  return v_historial_id;
end;
$$;

drop function if exists public.no_me_gusto(uuid, uuid, text);
create or replace function public.no_me_gusto(p_token uuid, p_por_probar_tienda_id uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
  v_tienda_id uuid;
  v_nombre text;
  v_comentario text;
  v_destino_id uuid;
  v_historial_id uuid;
  v_snapshot jsonb;
begin
  perform check_token(p_token);

  select ppt.por_probar_id, ppt.tienda_id, pp.nombre_perfume, ppt.comentario
    into v_por_probar_id, v_tienda_id, v_nombre, v_comentario
  from por_probar_tienda ppt
  join por_probar pp on pp.id = ppt.por_probar_id
  where ppt.id = p_por_probar_tienda_id;

  if v_por_probar_id is null then
    raise exception 'No se encontró el registro';
  end if;

  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'El motivo es obligatorio';
  end if;

  v_snapshot := armar_snapshot_por_probar(v_por_probar_id);

  insert into lista_negra (nombre_perfume, motivo, tienda_probada_id, comentario, fecha)
    values (v_nombre, trim(p_motivo), v_tienda_id, v_comentario, current_date)
    returning id into v_destino_id;

  insert into historial_movimientos (tipo, snapshot, destino_id)
    values ('rechazo', v_snapshot, v_destino_id) returning id into v_historial_id;

  delete from por_probar where id = v_por_probar_id;
  return v_historial_id;
end;
$$;

-- Deshace un me_gusto/no_me_gusto dentro de las 48h siguientes: recrea el
-- perfume en por_probar/por_probar_tienda desde el snapshot y borra la
-- fila que se había creado en coleccion/lista_negra/pendientes_compra.
create or replace function public.deshacer_movimiento(p_token uuid, p_historial_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_hist historial_movimientos;
  v_snapshot jsonb;
  v_tienda jsonb;
  v_new_id uuid;
begin
  perform check_token(p_token);

  select * into v_hist from historial_movimientos where id = p_historial_id;
  if v_hist.id is null then
    raise exception 'No se encontró el movimiento';
  end if;
  if v_hist.revertido then
    raise exception 'Este movimiento ya fue revertido';
  end if;
  if v_hist.creado_en < now() - interval '48 hours' then
    raise exception 'Ya pasaron más de 48 horas, no se puede deshacer';
  end if;

  v_snapshot := v_hist.snapshot;

  insert into por_probar (nombre_perfume, referencia, destacado)
    values (
      v_snapshot->'por_probar'->>'nombre_perfume',
      nullif(v_snapshot->'por_probar'->>'referencia', ''),
      coalesce((v_snapshot->'por_probar'->>'destacado')::boolean, false)
    )
    returning id into v_new_id;

  for v_tienda in select * from jsonb_array_elements(v_snapshot->'tiendas') loop
    insert into por_probar_tienda (por_probar_id, tienda_id, precio, comentario, disponibilidad, modalidad)
      values (
        v_new_id,
        (v_tienda->>'tienda_id')::uuid,
        nullif(v_tienda->>'precio', '')::numeric,
        nullif(v_tienda->>'comentario', ''),
        coalesce(nullif(v_tienda->>'disponibilidad', ''), 'con_probador'),
        coalesce(nullif(v_tienda->>'modalidad', ''), 'comprar_aqui')
      );
  end loop;

  if v_hist.tipo = 'rechazo' then
    delete from lista_negra where id = v_hist.destino_id;
  elsif v_hist.tipo = 'compra' then
    delete from coleccion where id = v_hist.destino_id;
  elsif v_hist.tipo = 'pendiente_compra' then
    delete from pendientes_compra where id = v_hist.destino_id;
  end if;

  update historial_movimientos set revertido = true where id = p_historial_id;
end;
$$;

create or replace function public.listar_movimientos_recientes(p_token uuid)
returns table (id uuid, tipo text, nombre_perfume text, creado_en timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select hm.id, hm.tipo, hm.snapshot->'por_probar'->>'nombre_perfume', hm.creado_en
    from historial_movimientos hm
    where hm.revertido = false
      and hm.creado_en > now() - interval '48 hours'
    order by hm.creado_en desc;
end;
$$;

-- Edita nombre/referencia (compartidos por el perfume en todas sus tiendas)
-- y precio/comentario/disponibilidad/modalidad (propios de esta tienda).
create or replace function public.editar_por_probar(
  p_token uuid, p_por_probar_tienda_id uuid,
  p_nombre_perfume text, p_referencia text,
  p_precio numeric, p_comentario text, p_disponibilidad text, p_modalidad text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
begin
  perform check_token(p_token);
  select por_probar_id into v_por_probar_id from por_probar_tienda where id = p_por_probar_tienda_id;
  if v_por_probar_id is null then
    raise exception 'No se encontró el registro';
  end if;

  update por_probar
    set nombre_perfume = trim(p_nombre_perfume), referencia = nullif(trim(p_referencia), '')
    where id = v_por_probar_id;

  update por_probar_tienda
    set precio = p_precio, comentario = p_comentario,
        disponibilidad = coalesce(p_disponibilidad, disponibilidad),
        modalidad = coalesce(p_modalidad, modalidad)
    where id = p_por_probar_tienda_id;
end;
$$;

-- Quita el perfume de ESTA tienda puntual (no lo mueve a colección ni a
-- lista negra). Si era la única tienda donde estaba listado, borra
-- también el registro huérfano de por_probar.
create or replace function public.eliminar_por_probar_tienda(p_token uuid, p_por_probar_tienda_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
begin
  perform check_token(p_token);
  select por_probar_id into v_por_probar_id from por_probar_tienda where id = p_por_probar_tienda_id;
  if v_por_probar_id is null then
    raise exception 'No se encontró el registro';
  end if;

  delete from por_probar_tienda where id = p_por_probar_tienda_id;

  if not exists (select 1 from por_probar_tienda where por_probar_id = v_por_probar_id) then
    delete from por_probar where id = v_por_probar_id;
  end if;
end;
$$;

-- Sin stock en ninguna tienda por ahora: saca el perfume de TODAS las
-- tiendas donde estaba listado y lo guarda en pendientes_probar para
-- revisar más adelante si volvió a aparecer.
create or replace function public.marcar_agotado(p_token uuid, p_por_probar_tienda_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
  v_tienda_id uuid;
  v_nombre text;
  v_referencia text;
  v_comentario text;
begin
  perform check_token(p_token);

  select ppt.por_probar_id, ppt.tienda_id, pp.nombre_perfume, pp.referencia, ppt.comentario
    into v_por_probar_id, v_tienda_id, v_nombre, v_referencia, v_comentario
  from por_probar_tienda ppt
  join por_probar pp on pp.id = ppt.por_probar_id
  where ppt.id = p_por_probar_tienda_id;

  if v_por_probar_id is null then
    raise exception 'No se encontró el registro';
  end if;

  insert into pendientes_probar (nombre_perfume, referencia, comentario, tienda_agotado_id, fecha)
    values (v_nombre, v_referencia, v_comentario, v_tienda_id, current_date);

  delete from por_probar where id = v_por_probar_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. PENDIENTES DE COMPRA
-- ---------------------------------------------------------------------

-- drop porque cambia la forma de la tabla retornada (se agregó "donde_comprar")
drop function if exists public.listar_pendientes_compra(uuid);
create or replace function public.listar_pendientes_compra(p_token uuid)
returns table (
  id uuid, nombre_perfume text, referencia text, comentario text,
  tienda_probada_id uuid, tienda_nombre text, fecha_prueba date, donde_comprar text
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select pc.id, pc.nombre_perfume, pc.referencia, pc.comentario,
           pc.tienda_probada_id, t.nombre, pc.fecha_prueba, pc.donde_comprar
    from pendientes_compra pc
    left join tiendas t on t.id = pc.tienda_probada_id
    order by pc.fecha_prueba desc;
end;
$$;

-- Edita nombre/referencia/comentario y dónde se piensa comprar (texto
-- libre: tienda del catálogo o cualquier otro canal).
create or replace function public.editar_pendiente_compra(
  p_token uuid, p_pendiente_id uuid, p_nombre_perfume text, p_referencia text,
  p_comentario text, p_donde_comprar text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  update pendientes_compra
    set nombre_perfume = trim(p_nombre_perfume),
        referencia = nullif(trim(p_referencia), ''),
        comentario = p_comentario,
        donde_comprar = nullif(trim(coalesce(p_donde_comprar, '')), '')
    where id = p_pendiente_id;
end;
$$;

-- Elimina definitivamente (ej. decidió que ya no lo quiere comprar).
create or replace function public.eliminar_pendiente_compra(p_token uuid, p_pendiente_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  delete from pendientes_compra where id = p_pendiente_id;
end;
$$;

create or replace function public.ya_lo_compre(
  p_token uuid, p_pendiente_id uuid, p_tienda_compra_id uuid, p_canal_compra text, p_precio numeric
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row pendientes_compra;
begin
  perform check_token(p_token);
  select * into v_row from pendientes_compra where id = p_pendiente_id;
  if v_row.id is null then
    raise exception 'No se encontró el pendiente';
  end if;

  insert into coleccion (nombre_perfume, referencia, comentario, tienda_compra_id, canal_compra, precio, fecha_compra)
    values (v_row.nombre_perfume, v_row.referencia, v_row.comentario,
            p_tienda_compra_id, nullif(trim(p_canal_compra), ''), p_precio, current_date);

  delete from pendientes_compra where id = p_pendiente_id;
end;
$$;

create or replace function public.listar_pendientes_probar(p_token uuid)
returns table (
  id uuid, nombre_perfume text, referencia text, comentario text,
  tienda_agotado_id uuid, tienda_nombre text, fecha date
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select pp.id, pp.nombre_perfume, pp.referencia, pp.comentario,
           pp.tienda_agotado_id, t.nombre, pp.fecha
    from pendientes_probar pp
    left join tiendas t on t.id = pp.tienda_agotado_id
    order by pp.fecha desc;
end;
$$;

-- El perfume volvió a aparecer: lo reingresa a "por probar" en la tienda
-- indicada y borra el pendiente.
create or replace function public.volver_a_por_probar(
  p_token uuid, p_pendiente_probar_id uuid, p_tienda_id uuid,
  p_precio numeric, p_comentario text, p_disponibilidad text, p_modalidad text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row pendientes_probar;
  v_id uuid;
begin
  perform check_token(p_token);
  select * into v_row from pendientes_probar where id = p_pendiente_probar_id;
  if v_row.id is null then
    raise exception 'No se encontró el pendiente';
  end if;

  insert into por_probar (nombre_perfume, referencia)
    values (v_row.nombre_perfume, v_row.referencia)
    returning id into v_id;

  insert into por_probar_tienda (por_probar_id, tienda_id, precio, comentario, disponibilidad, modalidad)
    values (v_id, p_tienda_id, p_precio,
            coalesce(nullif(p_comentario, ''), v_row.comentario),
            coalesce(p_disponibilidad, 'con_probador'),
            coalesce(p_modalidad, 'comprar_aqui'));

  delete from pendientes_probar where id = p_pendiente_probar_id;
end;
$$;

create or replace function public.eliminar_pendiente_probar(p_token uuid, p_pendiente_probar_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  delete from pendientes_probar where id = p_pendiente_probar_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. COLECCIÓN / LISTA NEGRA
--    Mayormente de solo lectura desde la app, salvo eliminar_de_coleccion
--    (para devoluciones: producto roto/defectuoso, etc, pasadas las 48h
--    en que ya no sirve "Deshacer").
-- ---------------------------------------------------------------------

create or replace function public.listar_coleccion(p_token uuid)
returns table (
  id uuid, nombre_perfume text, referencia text, comentario text,
  tienda_compra_id uuid, tienda_nombre text, canal_compra text,
  precio numeric, fecha_compra date
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select c.id, c.nombre_perfume, c.referencia, c.comentario,
           c.tienda_compra_id, t.nombre, c.canal_compra, c.precio, c.fecha_compra
    from coleccion c
    left join tiendas t on t.id = c.tienda_compra_id
    order by c.nombre_perfume;
end;
$$;

-- Borra un perfume de la colección de forma permanente (ej. lo devolvió
-- por venir roto/defectuoso). No lo mueve a ningún otro lado.
create or replace function public.eliminar_de_coleccion(p_token uuid, p_coleccion_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  delete from coleccion where id = p_coleccion_id;
end;
$$;

create or replace function public.listar_lista_negra(p_token uuid)
returns table (
  id uuid, nombre_perfume text, motivo text, comentario text,
  tienda_probada_id uuid, tienda_nombre text, fecha date
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select ln.id, ln.nombre_perfume, ln.motivo, ln.comentario,
           ln.tienda_probada_id, t.nombre, ln.fecha
    from lista_negra ln
    left join tiendas t on t.id = ln.tienda_probada_id
    order by ln.nombre_perfume;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. CHEQUEO DE DUPLICADOS
--    Devuelve todo lo necesario para que el frontend normalice y
--    compare nombres (minúsculas / sin tildes / sin espacios extra).
-- ---------------------------------------------------------------------

create or replace function public.listar_candidatos_duplicado(p_token uuid)
returns table (
  fuente text, nombre_perfume text, fecha date, motivo text, tienda_nombre text
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select 'coleccion'::text, c.nombre_perfume, c.fecha_compra, null::text,
           coalesce(t.nombre, c.canal_compra)
    from coleccion c left join tiendas t on t.id = c.tienda_compra_id
    union all
    select 'lista_negra'::text, ln.nombre_perfume, ln.fecha, ln.motivo, t.nombre
    from lista_negra ln left join tiendas t on t.id = ln.tienda_probada_id
    union all
    select 'pendientes_compra'::text, pc.nombre_perfume, pc.fecha_prueba, null::text, t.nombre
    from pendientes_compra pc left join tiendas t on t.id = pc.tienda_probada_id
    union all
    select 'por_probar'::text, pp.nombre_perfume, pp.created_at::date, null::text, t.nombre
    from por_probar pp
    join por_probar_tienda ppt on ppt.por_probar_id = pp.id
    join tiendas t on t.id = ppt.tienda_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 8b. EXPORTAR / BACKUP
-- ---------------------------------------------------------------------

create or replace function public.exportar_datos(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform check_token(p_token);
  select jsonb_build_object(
    'generado_en', now(),
    'tiendas', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.nombre), '[]'::jsonb)
      from tiendas t
    ),
    'por_probar', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.nombre_perfume, x.tienda_nombre), '[]'::jsonb)
      from (
        select pp.id as por_probar_id, pp.nombre_perfume, pp.referencia, pp.destacado,
               ppt.id as por_probar_tienda_id, ppt.tienda_id, t.nombre as tienda_nombre,
               ppt.precio, ppt.comentario, ppt.disponibilidad, ppt.modalidad
        from por_probar pp
        join por_probar_tienda ppt on ppt.por_probar_id = pp.id
        join tiendas t on t.id = ppt.tienda_id
      ) x
    ),
    'pendientes_compra', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.fecha_prueba desc), '[]'::jsonb)
      from (
        select pc.id, pc.nombre_perfume, pc.referencia, pc.comentario, pc.fecha_prueba,
               t.nombre as tienda_nombre
        from pendientes_compra pc left join tiendas t on t.id = pc.tienda_probada_id
      ) x
    ),
    'pendientes_probar', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.fecha desc), '[]'::jsonb)
      from (
        select pp.id, pp.nombre_perfume, pp.referencia, pp.comentario, pp.fecha,
               t.nombre as tienda_nombre
        from pendientes_probar pp left join tiendas t on t.id = pp.tienda_agotado_id
      ) x
    ),
    'coleccion', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.nombre_perfume), '[]'::jsonb)
      from (
        select c.id, c.nombre_perfume, c.referencia, c.comentario, c.canal_compra,
               c.precio, c.fecha_compra, t.nombre as tienda_nombre
        from coleccion c left join tiendas t on t.id = c.tienda_compra_id
      ) x
    ),
    'lista_negra', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.nombre_perfume), '[]'::jsonb)
      from (
        select ln.id, ln.nombre_perfume, ln.motivo, ln.comentario, ln.fecha,
               t.nombre as tienda_nombre
        from lista_negra ln left join tiendas t on t.id = ln.tienda_probada_id
      ) x
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. IMPORTACIÓN MASIVA
--    Cada función recibe un jsonb array de objetos ya armados por el
--    frontend (que resuelve nombres de tienda a id llamando listar_tiendas).
-- ---------------------------------------------------------------------

create or replace function public.importar_coleccion(p_token uuid, p_items jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int := 0;
begin
  perform check_token(p_token);
  insert into coleccion (nombre_perfume, referencia, comentario, tienda_compra_id, canal_compra, precio, fecha_compra)
  select
    item->>'nombre_perfume',
    nullif(item->>'referencia', ''),
    nullif(item->>'comentario', ''),
    nullif(item->>'tienda_compra_id', '')::uuid,
    nullif(item->>'canal_compra', ''),
    nullif(item->>'precio', '')::numeric,
    coalesce(nullif(item->>'fecha_compra', '')::date, current_date)
  from jsonb_array_elements(p_items) as item;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.importar_lista_negra(p_token uuid, p_items jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int := 0;
begin
  perform check_token(p_token);
  insert into lista_negra (nombre_perfume, motivo, tienda_probada_id, comentario, fecha)
  select
    item->>'nombre_perfume',
    coalesce(nullif(item->>'motivo', ''), 'Sin especificar'),
    nullif(item->>'tienda_probada_id', '')::uuid,
    nullif(item->>'comentario', ''),
    coalesce(nullif(item->>'fecha', '')::date, current_date)
  from jsonb_array_elements(p_items) as item;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- items: [{ nombre_perfume, referencia, tiendas: [{tienda_id, precio, comentario, disponibilidad, modalidad}, ...] }]
create or replace function public.importar_por_probar(p_token uuid, p_items jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_perfume jsonb;
  v_tienda jsonb;
  v_id uuid;
  v_count int := 0;
begin
  perform check_token(p_token);
  for v_perfume in select * from jsonb_array_elements(p_items) loop
    insert into por_probar (nombre_perfume, referencia)
      values (v_perfume->>'nombre_perfume', nullif(v_perfume->>'referencia', ''))
      returning id into v_id;
    for v_tienda in select * from jsonb_array_elements(coalesce(v_perfume->'tiendas', '[]'::jsonb)) loop
      insert into por_probar_tienda (por_probar_id, tienda_id, precio, comentario, disponibilidad, modalidad)
        values (
          v_id,
          (v_tienda->>'tienda_id')::uuid,
          nullif(v_tienda->>'precio', '')::numeric,
          nullif(v_tienda->>'comentario', ''),
          coalesce(nullif(v_tienda->>'disponibilidad', ''), 'con_probador'),
          coalesce(nullif(v_tienda->>'modalidad', ''), 'comprar_aqui')
        );
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. PERMISOS: solo se puede EJECUTAR las funciones de arriba.
--     Nunca se otorga acceso directo a las tablas.
-- ---------------------------------------------------------------------

revoke all on function
  public.validar_pin, public.token_valido, public.check_token,
  public.listar_tiendas, public.crear_tienda, public.set_tienda_activa,
  public.listar_por_probar, public.crear_por_probar, public.agregar_tienda_a_por_probar,
  public.marcar_sin_probador, public.me_gusto, public.no_me_gusto,
  public.editar_por_probar, public.eliminar_por_probar_tienda, public.marcar_agotado,
  public.toggle_destacado, public.cambiar_tienda_por_probar, public.obtener_contadores,
  public.armar_snapshot_por_probar, public.deshacer_movimiento, public.listar_movimientos_recientes,
  public.listar_pendientes_compra, public.ya_lo_compre,
  public.editar_pendiente_compra, public.eliminar_pendiente_compra,
  public.listar_pendientes_probar, public.volver_a_por_probar, public.eliminar_pendiente_probar,
  public.listar_coleccion, public.eliminar_de_coleccion, public.listar_lista_negra,
  public.listar_candidatos_duplicado, public.exportar_datos,
  public.importar_coleccion, public.importar_lista_negra, public.importar_por_probar
  from public;

grant execute on function public.validar_pin(text) to anon;
grant execute on function public.token_valido(uuid) to anon;
grant execute on function public.listar_tiendas(uuid) to anon;
grant execute on function public.crear_tienda(uuid, text) to anon;
grant execute on function public.set_tienda_activa(uuid, uuid, boolean) to anon;
grant execute on function public.listar_por_probar(uuid) to anon;
grant execute on function public.crear_por_probar(uuid, text, text, uuid, numeric, text, text, text) to anon;
grant execute on function public.agregar_tienda_a_por_probar(uuid, uuid, uuid, numeric, text, text, text) to anon;
grant execute on function public.marcar_sin_probador(uuid, uuid) to anon;
grant execute on function public.me_gusto(uuid, uuid, numeric, text) to anon;
grant execute on function public.no_me_gusto(uuid, uuid, text) to anon;
grant execute on function public.editar_por_probar(uuid, uuid, text, text, numeric, text, text, text) to anon;
grant execute on function public.eliminar_por_probar_tienda(uuid, uuid) to anon;
grant execute on function public.marcar_agotado(uuid, uuid) to anon;
grant execute on function public.toggle_destacado(uuid, uuid, boolean) to anon;
grant execute on function public.cambiar_tienda_por_probar(uuid, uuid, uuid) to anon;
grant execute on function public.obtener_contadores(uuid) to anon;
grant execute on function public.deshacer_movimiento(uuid, uuid) to anon;
grant execute on function public.listar_movimientos_recientes(uuid) to anon;
grant execute on function public.exportar_datos(uuid) to anon;
grant execute on function public.listar_pendientes_compra(uuid) to anon;
grant execute on function public.editar_pendiente_compra(uuid, uuid, text, text, text, text) to anon;
grant execute on function public.eliminar_pendiente_compra(uuid, uuid) to anon;
grant execute on function public.ya_lo_compre(uuid, uuid, uuid, text, numeric) to anon;
grant execute on function public.listar_pendientes_probar(uuid) to anon;
grant execute on function public.volver_a_por_probar(uuid, uuid, uuid, numeric, text, text, text) to anon;
grant execute on function public.eliminar_pendiente_probar(uuid, uuid) to anon;
grant execute on function public.listar_coleccion(uuid) to anon;
grant execute on function public.eliminar_de_coleccion(uuid, uuid) to anon;
grant execute on function public.listar_lista_negra(uuid) to anon;
grant execute on function public.listar_candidatos_duplicado(uuid) to anon;
grant execute on function public.importar_coleccion(uuid, jsonb) to anon;
grant execute on function public.importar_lista_negra(uuid, jsonb) to anon;
grant execute on function public.importar_por_probar(uuid, jsonb) to anon;

-- check_token y armar_snapshot_por_probar se llaman solo internamente
-- desde otras funciones security definer; no necesitan ejecutarse desde
-- el cliente (armar_snapshot_por_probar ni siquiera valida token, así
-- que es importante que quede sin grant a anon).

-- =====================================================================
-- Fin del schema. Después de ejecutar este script, define tu PIN
-- siguiendo las instrucciones de SETUP.md, sección "Definir tu PIN".
-- =====================================================================
