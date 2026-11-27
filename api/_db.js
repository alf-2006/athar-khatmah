import pg from 'pg';

const { Pool } = pg;

/* ------------------------------------------------------------------ */
/* V1: المخطط الأصلي (ختمة واحدة) — بلا تغيير، idempotent.             */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* V2: مجالس (groups) + ختمات (rounds) + قائمة انتظار.                 */
/* إضافية ومتوافقة مع القديم: الإدراجات القديمة تذهب إلى مجلس athar.   */
/* hash توكن مالك مجلس athar مُولَّد محلياً؛ التوكن نفسه ليس في الكود.  */
/* ------------------------------------------------------------------ */
const MEMORIAL_OWNER_HASH = 'eec6688e62f30cb853c067d0e62db9cbec997dafdf6a53ec76a7584695961de0';

const V2_SQL = `
create table if not exists public.schema_meta (
  key text primary key,
  value text not null
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,32}$'),
  title text not null check (char_length(title) between 1 and 80),
  kind text not null default 'general'
    check (kind in ('martyrs','deceased_m','deceased_f','deceased_p','general')),
  message text check (message is null or char_length(message) <= 200),
  rounds integer not null default 1 check (rounds between 1 and 100),
  closed boolean not null default false,
  owner_token_hash text not null,
  creator_ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists groups_creator_idx on public.groups (creator_ip_hash, created_at);

create table if not exists public.waitlist (
  group_id uuid not null references public.groups(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, token_hash)
);

create or replace function public.bookings_default_group()
returns trigger language plpgsql as $$
begin
  if new.group_id is null then
    new.group_id := (select id from public.groups where slug = 'athar');
  end if;
  return new;
end;
$$;

do $migrate$
declare ver integer;
begin
  select coalesce((select value::integer from public.schema_meta where key = 'version'), 1) into ver;
  if ver < 2 then
    alter table public.bookings add column if not exists group_id uuid references public.groups(id) on delete cascade;
    alter table public.bookings add column if not exists round_no integer not null default 1 check (round_no between 1 and 100);
    alter table public.bookings add column if not exists device_hash text;

    insert into public.groups (slug, title, kind, rounds, owner_token_hash)
    values ('athar', 'شهداء الحادث', 'martyrs', 1, '${MEMORIAL_OWNER_HASH}')
    on conflict (slug) do nothing;

    update public.bookings set group_id = (select id from public.groups where slug = 'athar') where group_id is null;
    alter table public.bookings alter column group_id set not null;

    alter table public.bookings drop constraint if exists bookings_part_number_key;
    create unique index if not exists bookings_group_round_part_uidx on public.bookings (group_id, round_no, part_number);
    create index if not exists bookings_group_device_idx on public.bookings (group_id, device_hash);

    drop trigger if exists bookings_default_group_trg on public.bookings;
    create trigger bookings_default_group_trg before insert on public.bookings
      for each row execute function public.bookings_default_group();

    insert into public.schema_meta (key, value) values ('version', '2')
    on conflict (key) do update set value = excluded.value;
  end if;
end
$migrate$;

create or replace function public.reserve_part_in(
  p_group uuid, p_round integer, p_part integer, p_name text, p_token_hash text, p_device text
) returns uuid language plpgsql security definer set search_path=public as $$
declare g record; new_id uuid; held integer;
begin
  if p_part is null or p_part < 1 or p_part > 30 then raise exception 'INVALID_PART'; end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 40 then raise exception 'INVALID_NAME'; end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'INVALID_TOKEN'; end if;
  perform pg_advisory_xact_lock(hashtext(p_group::text));
  select rounds, closed into g from public.groups where id = p_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if g.closed then raise exception 'GROUP_CLOSED'; end if;
  if p_round is null or p_round < 1 or p_round > g.rounds then raise exception 'INVALID_ROUND'; end if;
  if p_device is not null then
    select count(*) into held from public.bookings
      where group_id = p_group and device_hash = p_device and completed = false;
    if held >= 5 then raise exception 'LIMIT_REACHED'; end if;
  end if;
  insert into public.bookings (group_id, round_no, part_number, display_name, token_hash, device_hash)
  values (p_group, p_round, p_part, trim(p_name), p_token_hash, p_device) returning id into new_id;
  return new_id;
exception when unique_violation then raise exception 'PART_TAKEN';
end;
$$;

create or replace function public.reserve_next_part(
  p_group uuid, p_name text, p_token_hash text, p_device text,
  out o_round integer, out o_part integer, out o_id uuid
) language plpgsql security definer set search_path=public as $$
declare g record; held integer;
begin
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 40 then raise exception 'INVALID_NAME'; end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'INVALID_TOKEN'; end if;
  perform pg_advisory_xact_lock(hashtext(p_group::text));
  select rounds, closed into g from public.groups where id = p_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if g.closed then raise exception 'GROUP_CLOSED'; end if;
  if p_device is not null then
    select count(*) into held from public.bookings
      where group_id = p_group and device_hash = p_device and completed = false;
    if held >= 5 then raise exception 'LIMIT_REACHED'; end if;
  end if;
  select s.r, s.p into o_round, o_part from (
    select rr.r, pp.p
    from generate_series(1, g.rounds) as rr(r)
    cross join generate_series(1, 30) as pp(p)
    where not exists (
      select 1 from public.bookings b
      where b.group_id = p_group and b.round_no = rr.r and b.part_number = pp.p
    )
    order by rr.r, pp.p
    limit 1
  ) s;
  if o_round is null then raise exception 'GROUP_FULL'; end if;
  insert into public.bookings (group_id, round_no, part_number, display_name, token_hash, device_hash)
  values (p_group, o_round, o_part, trim(p_name), p_token_hash, p_device) returning id into o_id;
end;
$$;

create or replace function public.complete_part_in(
  p_group uuid, p_round integer, p_part integer, p_token_hash text
) returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.bookings set completed = true, completed_at = now()
  where group_id = p_group and round_no = p_round and part_number = p_part
    and token_hash = p_token_hash and completed = false;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on public.groups from public;
revoke all on public.waitlist from public;
revoke all on function public.reserve_part_in(uuid,integer,integer,text,text,text) from public;
revoke all on function public.reserve_next_part(uuid,text,text,text) from public;
revoke all on function public.complete_part_in(uuid,integer,integer,text) from public;
`;

export function getPool() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!globalThis.__atharPool) {
    globalThis.__atharPool = new Pool({
      connectionString,
      // PGSSL=off للاختبار المحلي فقط؛ الإنتاج (Neon) يبقى على SSL.
      ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX) || 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  return globalThis.__atharPool;
}

async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // قفل واحد يسلسل الهجرة بين عدة cold starts متزامنة.
    await client.query('select pg_advisory_xact_lock(7240017)');
    await client.query(INIT_SQL);
    await client.query(V2_SQL);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  const pool = getPool();
  if (!globalThis.__atharSchemaReady) {
    globalThis.__atharSchemaReady = migrate(pool).catch((err) => {
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
