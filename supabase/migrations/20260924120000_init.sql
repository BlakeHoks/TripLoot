-- Trip Counter — initial schema.
--
-- Security model
--   * Every public table has RLS enabled. anon has no table access at all.
--   * authenticated gets only the table/column privileges it actually needs;
--     identity columns (owner_id, user_id, created_by, role, token) are never
--     writable by clients — they come from auth.uid() / defaults / functions.
--   * Membership checks used by policies live in the non-exposed `private`
--     schema as SECURITY DEFINER helpers (avoids RLS recursion on trip_members).
--   * Privileged operations (create trip + owner membership, join via invite,
--     invite preview) are SECURITY DEFINER functions in `private`, exposed to the
--     API only through thin SECURITY INVOKER wrappers in `public`.

-- ---------------------------------------------------------------------------
-- Private schema
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public;
-- Needed so RLS policies / public wrappers can call the helpers below.
-- The schema is NOT in the PostgREST exposed schemas, so nothing here is
-- directly reachable over the API.
grant usage on schema private to anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 50),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  emoji text not null default '✈️' check (char_length(emoji) between 1 and 16),
  description text check (description is null or char_length(description) <= 500),
  start_date date,
  end_date date,
  owner_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_check check (start_date is null or end_date is null or end_date >= start_date)
);

create index trips_owner_id_idx on public.trips (owner_id);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id),
  -- Second FK on the same column so PostgREST can embed the member's profile.
  constraint trip_members_user_profile_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade
);

-- The primary key (trip_id, user_id) already serves lookups by trip_id;
-- user_id needs its own index for "my trips" / RLS lookups.
create index trip_members_user_id_idx on public.trip_members (user_id);
create index trip_members_trip_id_idx on public.trip_members (trip_id);
-- Exactly one owner per trip.
create unique index trip_members_one_owner_idx on public.trip_members (trip_id) where role = 'owner';

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index trip_invites_trip_id_idx on public.trip_invites (trip_id);

create table public.counters (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  emoji text not null check (char_length(emoji) between 1 and 16),
  unit text check (unit is null or char_length(unit) <= 20),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  -- Target for the composite FK from events: guarantees event.trip_id = counter.trip_id.
  constraint counters_id_trip_id_key unique (id, trip_id)
);

create index counters_trip_id_idx on public.counters (trip_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  counter_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id),
  amount numeric not null default 1 check (amount > 0 and amount <= 10000),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  -- An event can only point at a counter of the same trip.
  constraint events_counter_trip_fkey
    foreign key (counter_id, trip_id) references public.counters (id, trip_id) on delete cascade,
  constraint events_user_profile_fkey
    foreign key (user_id) references public.profiles (id)
);

create index events_trip_id_created_at_idx on public.events (trip_id, created_at desc);
create index events_trip_id_idx on public.events (trip_id);
create index events_counter_id_idx on public.events (counter_id);
create index events_user_id_idx on public.events (user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile auto-creation
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '')
      ),
      50
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill for users that existed before this migration.
insert into public.profiles (id, display_name)
select u.id, left(nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''), 50)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER, private schema)
-- ---------------------------------------------------------------------------

create function private.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- True if the current user and p_user_id are in at least one common trip.
create function private.shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.is_trip_member(uuid) from public, anon;
revoke all on function private.is_trip_owner(uuid) from public, anon;
revoke all on function private.shares_trip_with(uuid) from public, anon;
grant execute on function private.is_trip_member(uuid) to authenticated;
grant execute on function private.is_trip_owner(uuid) to authenticated;
grant execute on function private.shares_trip_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges (least privilege; RLS below narrows rows further)
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.trips, public.trip_members,
  public.trip_invites, public.counters, public.events
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- trips are inserted only through create_trip(); owner_id is never updatable.
grant select, delete on public.trips to authenticated;
grant update (name, emoji, description, start_date, end_date) on public.trips to authenticated;

-- memberships are inserted only through create_trip()/accept_invite();
-- role is never updatable by clients.
grant select, delete on public.trip_members to authenticated;

-- token and created_by always come from defaults.
grant select on public.trip_invites to authenticated;
grant insert (trip_id, expires_at) on public.trip_invites to authenticated;
grant update (revoked_at) on public.trip_invites to authenticated;

grant select, delete on public.counters to authenticated;
grant insert (trip_id, name, emoji, unit) on public.counters to authenticated;
grant update (name, emoji, unit) on public.counters to authenticated;

-- events are append-only for clients (no update); user_id comes from auth.uid().
grant select, delete on public.events to authenticated;
grant insert (trip_id, counter_id, amount, note) on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.counters enable row level security;
alter table public.events enable row level security;

-- profiles
create policy "profiles: read self and trip mates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_trip_with(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- trips
create policy "trips: members read"
  on public.trips for select to authenticated
  using (private.is_trip_member(id));

create policy "trips: owner updates"
  on public.trips for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "trips: owner deletes"
  on public.trips for delete to authenticated
  using (owner_id = (select auth.uid()));

-- trip_members
create policy "trip_members: members read"
  on public.trip_members for select to authenticated
  using (private.is_trip_member(trip_id));

-- A member may leave; the owner may remove members. The owner row itself can
-- never be deleted by a client (the owner deletes the whole trip instead).
create policy "trip_members: leave or owner removes"
  on public.trip_members for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or private.is_trip_owner(trip_id))
  );

-- trip_invites
create policy "trip_invites: members read"
  on public.trip_invites for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "trip_invites: members create"
  on public.trip_invites for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_trip_member(trip_id));

create policy "trip_invites: creator or owner revokes"
  on public.trip_invites for update to authenticated
  using (created_by = (select auth.uid()) or private.is_trip_owner(trip_id))
  with check (created_by = (select auth.uid()) or private.is_trip_owner(trip_id));

-- counters
create policy "counters: members read"
  on public.counters for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "counters: members create"
  on public.counters for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_trip_member(trip_id));

create policy "counters: creator or owner updates"
  on public.counters for update to authenticated
  using (created_by = (select auth.uid()) or private.is_trip_owner(trip_id))
  with check (private.is_trip_member(trip_id));

create policy "counters: creator or owner deletes"
  on public.counters for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_trip_owner(trip_id));

-- events
create policy "events: members read"
  on public.events for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "events: members add own"
  on public.events for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_trip_member(trip_id));

create policy "events: author or owner deletes"
  on public.events for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_trip_owner(trip_id));

-- ---------------------------------------------------------------------------
-- Counter totals (computed from events, never stored)
-- ---------------------------------------------------------------------------

create view public.counters_with_totals
with (security_invoker = true)
as
select
  c.id,
  c.trip_id,
  c.name,
  c.emoji,
  c.unit,
  c.created_by,
  c.created_at,
  coalesce(sum(e.amount), 0)::numeric as total,
  count(e.id)::int as event_count,
  max(e.created_at) as last_event_at
from public.counters c
left join public.events e on e.counter_id = c.id
group by c.id;

revoke all on public.counters_with_totals from anon, authenticated;
grant select on public.counters_with_totals to authenticated;

-- ---------------------------------------------------------------------------
-- Privileged operations (private, SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create function private.create_trip(
  p_name text,
  p_emoji text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_with_default_counters boolean
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.trips (name, emoji, description, start_date, end_date, owner_id)
  values (
    btrim(p_name),
    coalesce(nullif(btrim(p_emoji), ''), '✈️'),
    nullif(btrim(p_description), ''),
    p_start_date,
    p_end_date,
    v_uid
  )
  returning * into v_trip;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip.id, v_uid, 'owner');

  if coalesce(p_with_default_counters, false) then
    insert into public.counters (trip_id, name, emoji, unit, created_by, created_at)
    select v_trip.id, d.name, d.emoji, d.unit, v_uid, now() + (d.ord * interval '1 millisecond')
    from (values
      (1, 'Хинкали', '🥟', 'шт.'),
      (2, 'Вино', '🍷', 'бокалов'),
      (3, 'Ночное пиво', '🍺', 'бутылок'),
      (4, 'Коты', '🐈', 'шт.'),
      (5, 'Bolt', '🚕', 'поездок'),
      (6, 'Кофе', '☕', 'чашек')
    ) as d (ord, name, emoji, unit);
  end if;

  return v_trip;
end;
$$;

-- Public, unauthenticated-safe preview of an invite. Reveals trip details only
-- for a valid (not revoked, not expired) token; the token is an unguessable uuid.
create function private.get_invite_preview(p_token uuid)
returns table (
  status text,
  trip_id uuid,
  trip_name text,
  trip_emoji text,
  member_count int,
  is_member boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.trip_invites;
begin
  select * into v_invite from public.trip_invites i where i.token = p_token;

  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::text, null::int, false;
    return;
  end if;

  if v_invite.revoked_at is not null then
    return query select 'revoked'::text, null::uuid, null::text, null::text, null::int, false;
    return;
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::text, null::text, null::int, false;
    return;
  end if;

  return query
  select
    'valid'::text,
    t.id,
    t.name,
    t.emoji,
    (select count(*)::int from public.trip_members m where m.trip_id = t.id),
    exists (
      select 1 from public.trip_members m
      where m.trip_id = t.id and m.user_id = auth.uid()
    )
  from public.trips t
  where t.id = v_invite.trip_id;
end;
$$;

create function private.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.trip_invites;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_invite from public.trip_invites i where i.token = p_token;

  if not found
     or v_invite.revoked_at is not null
     or (v_invite.expires_at is not null and v_invite.expires_at <= now()) then
    raise exception 'invite_invalid' using errcode = 'P0001', hint = 'The invite link is invalid, revoked or expired.';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, v_uid, 'member')
  on conflict (trip_id, user_id) do nothing;

  return v_invite.trip_id;
end;
$$;

revoke all on function private.create_trip(text, text, text, date, date, boolean) from public, anon;
revoke all on function private.get_invite_preview(uuid) from public;
revoke all on function private.accept_invite(uuid) from public, anon;
grant execute on function private.create_trip(text, text, text, date, date, boolean) to authenticated;
grant execute on function private.get_invite_preview(uuid) to anon, authenticated;
grant execute on function private.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public RPC surface (SECURITY INVOKER wrappers)
-- ---------------------------------------------------------------------------

create function public.create_trip(
  p_name text,
  p_emoji text default '✈️',
  p_description text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_with_default_counters boolean default true
)
returns public.trips
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_trip(p_name, p_emoji, p_description, p_start_date, p_end_date, p_with_default_counters);
$$;

create function public.get_invite_preview(p_token uuid)
returns table (
  status text,
  trip_id uuid,
  trip_name text,
  trip_emoji text,
  member_count int,
  is_member boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_invite_preview(p_token);
$$;

create function public.accept_invite(p_token uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_invite(p_token);
$$;

-- Returns the trip's current active invite, creating one if needed.
-- Runs with the caller's privileges, so RLS decides who may read/create invites.
create function public.get_or_create_invite(p_trip_id uuid)
returns public.trip_invites
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.trip_invites;
begin
  select * into v_invite
  from public.trip_invites i
  where i.trip_id = p_trip_id
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc
  limit 1;

  if found then
    return v_invite;
  end if;

  insert into public.trip_invites (trip_id)
  values (p_trip_id)
  returning * into v_invite;

  return v_invite;
end;
$$;

revoke all on function public.create_trip(text, text, text, date, date, boolean) from public, anon;
revoke all on function public.get_invite_preview(uuid) from public;
revoke all on function public.accept_invite(uuid) from public, anon;
revoke all on function public.get_or_create_invite(uuid) from public, anon;
grant execute on function public.create_trip(text, text, text, date, date, boolean) to authenticated;
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.get_or_create_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (postgres_changes respects RLS)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.events, public.counters, public.trip_members;
  end if;
end;
$$;
