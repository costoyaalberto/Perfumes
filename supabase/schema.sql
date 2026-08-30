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
alter table coleccion enable row level security;
alter table lista_negra enable row level security;
alter table app_sessions enable row level security;
alter table app_config enable row level security;

revoke all on tiendas, por_probar, por_probar_tienda, pendientes_compra,
  coleccion, lista_negra, app_sessions, app_config
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

create or replace function public.listar_por_probar(p_token uuid)
returns table (
  por_probar_id uuid,
  nombre_perfume text,
  referencia text,
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
    select pp.id, pp.nombre_perfume, pp.referencia,
           ppt.id, ppt.tienda_id, t.nombre,
           ppt.precio, ppt.comentario, ppt.disponibilidad, ppt.modalidad,
           ppt.created_at
    from por_probar_tienda ppt
    join por_probar pp on pp.id = ppt.por_probar_id
    join tiendas t on t.id = ppt.tienda_id
    order by t.nombre, pp.nombre_perfume;
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

-- "Me gustó": mueve el perfume completo (todas sus tiendas) a Colección o
-- a Pendientes de Compra según la modalidad de la tarjeta que gatilló la acción.
create or replace function public.me_gusto(p_token uuid, p_por_probar_tienda_id uuid, p_precio_final numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
  v_tienda_id uuid;
  v_modalidad text;
  v_nombre text;
  v_referencia text;
  v_comentario text;
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

  if v_modalidad = 'comprar_aqui' then
    insert into coleccion (nombre_perfume, referencia, comentario, tienda_compra_id, precio, fecha_compra)
      values (v_nombre, v_referencia, v_comentario, v_tienda_id, p_precio_final, current_date);
  else
    insert into pendientes_compra (nombre_perfume, referencia, comentario, tienda_probada_id, fecha_prueba)
      values (v_nombre, v_referencia, v_comentario, v_tienda_id, current_date);
  end if;

  delete from por_probar where id = v_por_probar_id;
end;
$$;

create or replace function public.no_me_gusto(p_token uuid, p_por_probar_tienda_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_por_probar_id uuid;
  v_tienda_id uuid;
  v_nombre text;
  v_comentario text;
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

  insert into lista_negra (nombre_perfume, motivo, tienda_probada_id, comentario, fecha)
    values (v_nombre, trim(p_motivo), v_tienda_id, v_comentario, current_date);

  delete from por_probar where id = v_por_probar_id;
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

-- ---------------------------------------------------------------------
-- 6. PENDIENTES DE COMPRA
-- ---------------------------------------------------------------------

create or replace function public.listar_pendientes_compra(p_token uuid)
returns table (
  id uuid, nombre_perfume text, referencia text, comentario text,
  tienda_probada_id uuid, tienda_nombre text, fecha_prueba date
)
language plpgsql security definer set search_path = public
as $$
begin
  perform check_token(p_token);
  return query
    select pc.id, pc.nombre_perfume, pc.referencia, pc.comentario,
           pc.tienda_probada_id, t.nombre, pc.fecha_prueba
    from pendientes_compra pc
    left join tiendas t on t.id = pc.tienda_probada_id
    order by pc.fecha_prueba desc;
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

-- ---------------------------------------------------------------------
-- 7. COLECCIÓN / LISTA NEGRA (solo lectura desde la app)
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
  public.editar_por_probar, public.eliminar_por_probar_tienda,
  public.listar_pendientes_compra, public.ya_lo_compre,
  public.listar_coleccion, public.listar_lista_negra,
  public.listar_candidatos_duplicado,
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
grant execute on function public.me_gusto(uuid, uuid, numeric) to anon;
grant execute on function public.no_me_gusto(uuid, uuid, text) to anon;
grant execute on function public.editar_por_probar(uuid, uuid, text, text, numeric, text, text, text) to anon;
grant execute on function public.eliminar_por_probar_tienda(uuid, uuid) to anon;
grant execute on function public.listar_pendientes_compra(uuid) to anon;
grant execute on function public.ya_lo_compre(uuid, uuid, uuid, text, numeric) to anon;
grant execute on function public.listar_coleccion(uuid) to anon;
grant execute on function public.listar_lista_negra(uuid) to anon;
grant execute on function public.listar_candidatos_duplicado(uuid) to anon;
grant execute on function public.importar_coleccion(uuid, jsonb) to anon;
grant execute on function public.importar_lista_negra(uuid, jsonb) to anon;
grant execute on function public.importar_por_probar(uuid, jsonb) to anon;

-- check_token se llama solo internamente desde otras funciones security
-- definer; no necesita ejecutarse desde el cliente.

-- =====================================================================
-- Fin del schema. Después de ejecutar este script, define tu PIN
-- siguiendo las instrucciones de SETUP.md, sección "Definir tu PIN".
-- =====================================================================
