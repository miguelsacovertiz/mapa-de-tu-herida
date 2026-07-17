-- Tabla de compradores validados por Hotmart.
-- No se agregan políticas de RLS para el rol "anon": esto significa que
-- SOLO las Edge Functions (que usan la service_role key, la cual se salta RLS)
-- pueden leer o escribir aquí. El navegador nunca tiene acceso directo a esta
-- tabla, para no exponer la lista de compradores.

create table compradores_pagados (
  email text primary key,
  fecha_compra timestamptz not null default now(),
  transaction_id text,
  producto text
);

alter table compradores_pagados enable row level security;

-- Sin "create policy" a propósito: RLS activado + cero políticas = nadie
-- puede acceder con la anon/publishable key. Solo service_role (Edge Functions).
