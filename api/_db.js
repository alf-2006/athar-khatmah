import pg from 'pg';

const { Pool } = pg;

const INIT_SQL = `
create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  part_number integer not null unique check (part_number between 1 and 30),
  display_name text not null check (char_length(display_name) between 1 and 40),
  token_hash text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.reserve_part(p_part_number integer,p_display_name text,p_token_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
  if p_part_number < 1 or p_part_number > 30 then raise exception 'INVALID_PART'; end if;
  if p_display_name is null or char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 40 then raise exception 'INVALID_NAME'; end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'INVALID_TOKEN'; end if;
  insert into public.bookings(part_number,display_name,token_hash)
  values(p_part_number,trim(p_display_name),p_token_hash) returning id into new_id;
  return new_id;
exception when unique_violation then raise exception 'PART_TAKEN';
end;
$$;

create or replace function public.complete_part(p_part_number integer,p_token_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.bookings set completed=true,completed_at=now()
  where part_number=p_part_number and token_hash=p_token_hash and completed=false;
  get diagnostics affected=row_count;
  return affected=1;
end;
$$;

revoke all on public.bookings from public;
revoke all on function public.reserve_part(integer,text,text) from public;
revoke all on function public.complete_part(integer,text) from public;
`;

export function getPool() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!globalThis.__atharPool) {
    globalThis.__atharPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  return globalThis.__atharPool;
}

export async function ensureSchema() {
  const pool = getPool();
  if (!globalThis.__atharSchemaReady) {
    globalThis.__atharSchemaReady = pool.query(INIT_SQL).catch((err) => {
      globalThis.__atharSchemaReady = null;
      throw err;
    });
  }
  await globalThis.__atharSchemaReady;
  return pool;
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}
