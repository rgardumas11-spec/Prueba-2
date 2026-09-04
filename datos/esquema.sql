-- ═══════════════════════════════════════════════════════════════════════════
-- Almacén San Bernardo — esquema de la base compartida (Supabase / Postgres)
--
-- Se pega UNA vez en Supabase → SQL Editor → New query → Run.
-- Se puede volver a correr sin miedo: todo es "if not exists" o "replace".
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Productos: muebles (por pieza, con color y categoría) y material (por envase)
create table if not exists producto (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('mueble','material')),
  nombre       text not null,
  apodos       text[] not null default '{}',          -- hasta 3, lo vigila la app
  categoria    text not null default '',              -- Puertas pintadas, Guacal… / Laca, Fondo…
  color        text not null default '',              -- solo muebles
  marca        text not null default '',
  codigo       text not null default '',              -- código del fabricante / SKU
  barras       text not null default '',              -- código de barras
  presentacion text not null default '',              -- Cubeta, Tambo…
  litros       numeric,                                -- litros por envase (material)
  cantidad     integer not null default 0 check (cantidad >= 0),
  minimo       integer not null default 0,
  activo       boolean not null default true,
  creado       timestamptz not null default now(),
  tocado       timestamptz not null default now(),
  por_quien    text not null default ''
);
create index if not exists producto_tipo_idx   on producto (tipo, activo);
create index if not exists producto_barras_idx on producto (barras) where barras <> '';

-- ── Movimientos: cada suma, resta, alta o conteo, con quién y cuándo
create table if not exists movimiento (
  id          bigint generated always as identity primary key,
  producto_id uuid references producto(id) on delete set null,
  nombre      text not null default '',
  color       text not null default '',
  tipo        text not null default 'ajuste',   -- entrada, salida, conteo, alta, baja
  delta       integer not null default 0,
  resultado   integer,
  persona     text not null default '',
  motivo      text not null default '',
  origen      text not null default '',         -- celular, computadora, barras…
  hecho_por   text not null default '',         -- quién hizo el trabajo (pintó, armó…)
  creado      timestamptz not null default now()
);
alter table movimiento add column if not exists hecho_por text not null default '';
create index if not exists movimiento_creado_idx   on movimiento (creado desc);
create index if not exists movimiento_producto_idx on movimiento (producto_id, creado desc);

-- ── Recados
create table if not exists recado (
  id      uuid primary key default gen_random_uuid(),
  texto   text not null,
  de      text not null default '',
  para    text not null default '',
  hecho   boolean not null default false,
  urgente boolean not null default false,
  vistos  jsonb not null default '{}',           -- {"Rafael": "2026-09-04T..."}
  creado  timestamptz not null default now()
);

-- ── Pedidos: cliente, fecha y lo que pidió, en formato de ticket
create table if not exists pedido (
  id      uuid primary key default gen_random_uuid(),
  cliente text not null,
  fecha   date,
  lineas  jsonb not null default '[]',   -- [{"modelo":"","color":"","cantidad":0}]
  notas   text not null default '',
  estado  text not null default 'pendiente',   -- pendiente | entregado
  de      text not null default '',
  creado  timestamptz not null default now()
);
create index if not exists pedido_creado_idx on pedido (creado desc);

-- ── Personas que usan la app (para la lista de "¿Quién eres?")
create table if not exists persona (
  nombre text primary key,
  creado timestamptz not null default now()
);

-- ── Sumar o restar SIN que dos personas se pisen.
-- Un solo paso atómico en la base: lee, ajusta y anota el movimiento.
create or replace function ajustar_cantidad(
  p_id uuid, p_delta integer, p_persona text,
  p_motivo text default '', p_origen text default '', p_hecho_por text default ''
) returns integer
language plpgsql security invoker as $$
declare
  v_antes integer; v_nuevo integer; v_nombre text; v_color text;
begin
  select cantidad, nombre, color into v_antes, v_nombre, v_color
    from producto where id = p_id for update;
  if not found then raise exception 'producto no existe'; end if;

  v_nuevo := greatest(0, v_antes + p_delta);
  update producto set cantidad = v_nuevo, tocado = now(), por_quien = p_persona where id = p_id;

  if v_nuevo <> v_antes then
    insert into movimiento (producto_id, nombre, color, tipo, delta, resultado, persona, motivo, origen, hecho_por)
    values (p_id, v_nombre, v_color,
            case when v_nuevo > v_antes then 'entrada' else 'salida' end,
            v_nuevo - v_antes, v_nuevo, p_persona, p_motivo, p_origen, coalesce(p_hecho_por, ''));
  end if;
  return v_nuevo;
end $$;

-- ── Privacidad: solo gente con cuenta del taller lee y escribe
alter table producto   enable row level security;
alter table movimiento enable row level security;
alter table recado     enable row level security;
alter table persona    enable row level security;
alter table pedido     enable row level security;

drop policy if exists taller_producto   on producto;
drop policy if exists taller_movimiento on movimiento;
drop policy if exists taller_recado     on recado;
drop policy if exists taller_persona    on persona;
drop policy if exists taller_pedido     on pedido;
create policy taller_producto   on producto   for all to authenticated using (true) with check (true);
create policy taller_movimiento on movimiento for all to authenticated using (true) with check (true);
create policy taller_recado     on recado     for all to authenticated using (true) with check (true);
create policy taller_persona    on persona    for all to authenticated using (true) with check (true);
create policy taller_pedido     on pedido     for all to authenticated using (true) with check (true);

-- ── Cambios en vivo entre aparatos
do $$
begin
  alter publication supabase_realtime add table producto;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table movimiento;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table recado;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table pedido;
exception when duplicate_object then null; end $$;
