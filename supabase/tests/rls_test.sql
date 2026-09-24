-- RLS / security test-suite. Runs in one transaction and rolls back.
-- Usage: see scripts/test-db.sh  (pnpm test:db)
--
-- Actors:
--   alice   — creates the trip (owner)
--   bob     — joins via invite (member)
--   mallory — unrelated user with her own trip

\set ON_ERROR_STOP 1
set client_min_messages = notice;

begin;

\set alice   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bob     '''bbbbbbbb-0000-0000-0000-000000000002'''
\set mallory '''cccccccc-0000-0000-0000-000000000003'''

insert into auth.users (id, email) values
  (:alice, 'alice@example.com'),
  (:bob, 'bob@example.com'),
  (:mallory, 'mallory@example.com');

-- Helper: become a user (role + JWT claims), transaction-local.
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.ok(p_msg text) returns void language plpgsql as $$
begin raise notice 'ok - %', p_msg; end $$;

grant execute on function pg_temp.login(uuid) to anon, authenticated;
grant execute on function pg_temp.ok(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profile trigger creates one profile per user';
  assert (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'alice',
    'display_name defaults to email prefix';
end $$;
select pg_temp.ok('profiles auto-created by trigger with email-prefix display_name');

-- ---------------------------------------------------------------------------
-- alice creates a trip (with default counters) and mallory her own
set local role authenticated;

select pg_temp.login(:alice);
select set_config('test.trip', (public.create_trip('Georgia 2026', '🇬🇪')).id::text, true);
select set_config('test.alice_counter', (select id::text from public.counters where name = 'Хинкали'), true);

select pg_temp.login(:mallory);
select set_config('test.mallory_trip', (public.create_trip('Mallory trip', '🏴‍☠️', null, null, null, false)).id::text, true);
insert into public.counters (trip_id, name, emoji) values (current_setting('test.mallory_trip')::uuid, 'Stuff', '🧪');
select set_config('test.mallory_counter', (select id::text from public.counters where trip_id = current_setting('test.mallory_trip')::uuid), true);

-- ---------------------------------------------------------------------------
select pg_temp.login(:alice);
do $$
declare v_trip uuid := current_setting('test.trip')::uuid;
begin
  assert (select count(*) from public.trips where id = v_trip) = 1, 'owner reads own trip';
  assert (select role from public.trip_members where trip_id = v_trip and user_id = auth.uid()) = 'owner',
    'creator is owner';
  assert (select owner_id from public.trips where id = v_trip) = auth.uid(), 'owner_id = creator';
  assert (select count(*) from public.counters where trip_id = v_trip) = 6, 'default counters created';
  assert (select count(*) from public.trips) = 1, 'alice sees only her trip';
end $$;
select pg_temp.ok('create_trip: trip + owner membership + default counters, atomically');

-- ---------------------------------------------------------------------------
-- Unrelated user (mallory) cannot see / touch alice's trip
select pg_temp.login(:mallory);
do $$
declare
  v_trip uuid := current_setting('test.trip')::uuid;
  v_counter uuid := current_setting('test.alice_counter')::uuid;
  v_n int;
  v_denied boolean;
begin
  assert (select count(*) from public.trips where id = v_trip) = 0, 'unrelated user cannot read trip';
  assert (select count(*) from public.trip_members where trip_id = v_trip) = 0, 'unrelated user cannot read members';
  assert (select count(*) from public.counters where trip_id = v_trip) = 0, 'unrelated user cannot read counters';
  assert (select count(*) from public.counters_with_totals where trip_id = v_trip) = 0, 'unrelated user cannot read totals';
  assert (select count(*) from public.events where trip_id = v_trip) = 0, 'unrelated user cannot read events';
  assert (select count(*) from public.trip_invites where trip_id = v_trip) = 0, 'unrelated user cannot read invites';
  assert (select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
    'unrelated user cannot read profiles of strangers';

  -- create event in foreign trip
  v_denied := false;
  begin
    insert into public.events (trip_id, counter_id) values (v_trip, v_counter);
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'unrelated user cannot create event in foreign trip';

  -- add counter to foreign trip
  v_denied := false;
  begin
    insert into public.counters (trip_id, name, emoji) values (v_trip, 'Hack', '💀');
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'unrelated user cannot create counter in foreign trip';

  -- join without invite
  v_denied := false;
  begin
    insert into public.trip_members (trip_id, user_id, role) values (v_trip, auth.uid(), 'member');
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'cannot insert membership directly';

  -- create invite for foreign trip (to then use it)
  v_denied := false;
  begin
    perform public.get_or_create_invite(v_trip);
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'unrelated user cannot create invite for foreign trip';

  -- update / delete foreign trip & counters: rows are invisible → 0 rows affected
  update public.trips set name = 'pwned' where id = v_trip;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'unrelated user cannot update trip';

  delete from public.trips where id = v_trip;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'unrelated user cannot delete trip';

  update public.counters set name = 'pwned' where id = v_counter;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'unrelated user cannot update counter';

  delete from public.counters where id = v_counter;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'unrelated user cannot delete counter';
end $$;
select pg_temp.ok('unrelated user: no read, no write, no self-join');

-- ---------------------------------------------------------------------------
-- Invites
select pg_temp.login(:alice);
select set_config('test.token', (public.get_or_create_invite(current_setting('test.trip')::uuid)).token::text, true);
do $$
declare v_again uuid;
begin
  v_again := (public.get_or_create_invite(current_setting('test.trip')::uuid)).token;
  assert v_again = current_setting('test.token')::uuid, 'get_or_create_invite reuses the active invite';
end $$;
select pg_temp.ok('invite created and reused');

-- a revoked and an expired invite (created as superuser for setup)
reset role;
insert into public.trip_invites (trip_id, created_by, token, revoked_at)
values (current_setting('test.trip')::uuid, :alice, 'dddddddd-0000-0000-0000-0000000000a1', now());
insert into public.trip_invites (trip_id, created_by, token, expires_at)
values (current_setting('test.trip')::uuid, :alice, 'dddddddd-0000-0000-0000-0000000000e1', now() - interval '1 minute');
set local role authenticated;

select pg_temp.login(:bob);
do $$
declare
  v_trip uuid := current_setting('test.trip')::uuid;
  v_denied boolean;
  v_bad uuid;
begin
  foreach v_bad in array array[
    gen_random_uuid(),                                  -- unknown
    'dddddddd-0000-0000-0000-0000000000a1'::uuid,       -- revoked
    'dddddddd-0000-0000-0000-0000000000e1'::uuid        -- expired
  ] loop
    v_denied := false;
    begin
      perform public.accept_invite(v_bad);
    exception when raise_exception then
      v_denied := sqlerrm = 'invite_invalid';
    end;
    assert v_denied, format('invalid invite %s must be rejected', v_bad);
  end loop;

  assert (select count(*) from public.trips where id = v_trip) = 0, 'still not a member after invalid invites';

  assert (select status from public.get_invite_preview('dddddddd-0000-0000-0000-0000000000a1')) = 'revoked', 'preview: revoked';
  assert (select status from public.get_invite_preview('dddddddd-0000-0000-0000-0000000000e1')) = 'expired', 'preview: expired';
  assert (select trip_name from public.get_invite_preview('dddddddd-0000-0000-0000-0000000000e1')) is null,
    'preview of invalid invite leaks nothing';
end $$;
select pg_temp.ok('invalid / revoked / expired invites cannot be used');

-- anon can preview a valid invite but cannot read tables
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare v_denied boolean := false;
begin
  assert (select status from public.get_invite_preview(current_setting('test.token')::uuid)) = 'valid', 'anon preview: valid';
  assert (select trip_name from public.get_invite_preview(current_setting('test.token')::uuid)) = 'Georgia 2026', 'anon preview: name';
  assert (select member_count from public.get_invite_preview(current_setting('test.token')::uuid)) = 1, 'anon preview: count';
  begin
    perform 1 from public.trips;
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'anon cannot select trips';
  v_denied := false;
  begin
    perform public.accept_invite(current_setting('test.token')::uuid);
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'anon cannot accept invite';
end $$;
select pg_temp.ok('anon: invite preview only');
set local role authenticated;

-- bob joins with the valid invite — twice
select pg_temp.login(:bob);
do $$
declare
  v_trip uuid := current_setting('test.trip')::uuid;
  v_joined uuid;
begin
  assert (select is_member from public.get_invite_preview(current_setting('test.token')::uuid)) = false, 'not yet member';
  v_joined := public.accept_invite(current_setting('test.token')::uuid);
  assert v_joined = v_trip, 'accept_invite returns trip id';
  v_joined := public.accept_invite(current_setting('test.token')::uuid);
  assert (select count(*) from public.trip_members where trip_id = v_trip and user_id = auth.uid()) = 1,
    'joining twice does not duplicate membership';
  assert (select role from public.trip_members where trip_id = v_trip and user_id = auth.uid()) = 'member',
    'joined as member';
  assert (select is_member from public.get_invite_preview(current_setting('test.token')::uuid)) = true, 'preview: is_member';
end $$;
select pg_temp.ok('valid invite adds membership; idempotent');

-- ---------------------------------------------------------------------------
-- Member capabilities & limits (bob)
do $$
declare
  v_trip uuid := current_setting('test.trip')::uuid;
  v_counter uuid := current_setting('test.alice_counter')::uuid;
  v_n int;
  v_denied boolean;
  v_event public.events;
begin
  assert (select count(*) from public.trips where id = v_trip) = 1, 'member can read trip';
  assert (select count(*) from public.trip_members where trip_id = v_trip) = 2, 'member reads all members';
  assert (select count(*) from public.profiles) = 2, 'member reads trip mates profiles (not strangers)';
  assert (select count(*) from public.trips) = 1, 'member does not see mallory''s trip';

  -- own event
  insert into public.events (trip_id, counter_id, amount) values (v_trip, v_counter, 4) returning * into v_event;
  assert v_event.user_id = auth.uid(), 'event user_id defaults to auth.uid()';

  -- spoof user_id
  v_denied := false;
  begin
    insert into public.events (trip_id, counter_id, user_id) values (v_trip, v_counter, 'aaaaaaaa-0000-0000-0000-000000000001');
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'member cannot create event on behalf of someone else';

  -- counter from another trip
  v_denied := false;
  begin
    insert into public.events (trip_id, counter_id) values (v_trip, current_setting('test.mallory_counter')::uuid);
  exception when foreign_key_violation then v_denied := true;
  end;
  assert v_denied, 'event.trip_id must match counter.trip_id';

  -- make himself owner
  v_denied := false;
  begin
    update public.trip_members set role = 'owner' where trip_id = v_trip and user_id = auth.uid();
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'member cannot change own role';

  v_denied := false;
  begin
    update public.trips set owner_id = auth.uid() where id = v_trip;
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'member cannot take over trip ownership';

  -- non-owner cannot update trip details or delete trip
  update public.trips set name = 'bob trip' where id = v_trip;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'member cannot update trip';
  delete from public.trips where id = v_trip;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'member cannot delete trip';

  -- cannot remove the owner
  delete from public.trip_members where trip_id = v_trip and role = 'owner';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'member cannot remove owner';

  -- counters: can create own, cannot change alice's
  insert into public.counters (trip_id, name, emoji, unit) values (v_trip, 'Чача', '🥃', 'рюмок');
  update public.counters set name = 'x' where id = v_counter;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'member cannot edit someone else''s counter';
  delete from public.counters where id = v_counter;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'member cannot delete someone else''s counter';

  -- counter created_by spoof
  v_denied := false;
  begin
    insert into public.counters (trip_id, name, emoji, created_by) values (v_trip, 'x', 'x', 'aaaaaaaa-0000-0000-0000-000000000001');
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'member cannot spoof counter.created_by';

  -- no event updates (append-only)
  v_denied := false;
  begin
    update public.events set amount = 1000 where id = v_event.id;
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'events cannot be updated';

  -- members can see/create invites
  assert (public.get_or_create_invite(v_trip)).token = current_setting('test.token')::uuid, 'member gets same invite';
end $$;
select pg_temp.ok('member: reads trip, adds own events/counters, cannot escalate');

-- ---------------------------------------------------------------------------
-- Owner capabilities & totals (alice)
select pg_temp.login(:alice);
do $$
declare
  v_trip uuid := current_setting('test.trip')::uuid;
  v_counter uuid := current_setting('test.alice_counter')::uuid;
  v_n int;
begin
  insert into public.events (trip_id, counter_id) values (v_trip, v_counter);
  insert into public.events (trip_id, counter_id, amount) values (v_trip, v_counter, 2.5);
  assert (select total from public.counters_with_totals where id = v_counter) = 7.5, 'totals = sum(events.amount)';
  assert (select event_count from public.counters_with_totals where id = v_counter) = 3, 'event_count';

  assert (select count(*) from public.profiles) = 2, 'owner sees member profile';

  delete from public.counters where trip_id = v_trip and name = 'Чача';
  get diagnostics v_n = row_count;
  assert v_n = 1, 'owner can delete member''s counter';

  update public.trips set name = 'Georgia 2026!' where id = v_trip;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'owner can update trip';

  -- owner cannot leave / remove own owner row
  delete from public.trip_members where trip_id = v_trip and user_id = auth.uid();
  get diagnostics v_n = row_count;
  assert v_n = 0, 'owner row cannot be deleted';

  -- owner revokes invite → it stops working
  update public.trip_invites set revoked_at = now() where token = current_setting('test.token')::uuid;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'owner can revoke invite';
end $$;
select pg_temp.ok('owner: totals, moderation, revoke');

select pg_temp.login(:mallory);
do $$
declare v_denied boolean := false;
begin
  begin
    perform public.accept_invite(current_setting('test.token')::uuid);
  exception when raise_exception then v_denied := true;
  end;
  assert v_denied, 'revoked invite cannot be used';
end $$;
select pg_temp.ok('revoked invite rejected');

-- ---------------------------------------------------------------------------
-- bob leaves → loses access
select pg_temp.login(:bob);
do $$
declare
  v_trip uuid := current_setting('test.trip')::uuid;
  v_n int;
begin
  delete from public.trip_members where trip_id = v_trip and user_id = auth.uid();
  get diagnostics v_n = row_count;
  assert v_n = 1, 'member can leave';
  assert (select count(*) from public.trips where id = v_trip) = 0, 'after leaving, trip is hidden';
  assert (select count(*) from public.events where trip_id = v_trip) = 0, 'after leaving, events are hidden';
end $$;
select pg_temp.ok('member can leave and loses access');

-- owner deletes trip → cascade
select pg_temp.login(:alice);
do $$
declare v_n int;
begin
  delete from public.trips where id = current_setting('test.trip')::uuid;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'owner can delete trip';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.events where trip_id = current_setting('test.trip')::uuid) = 0, 'events cascade';
  assert (select count(*) from public.trip_members where trip_id = current_setting('test.trip')::uuid) = 0, 'members cascade';
end $$;
select pg_temp.ok('owner deletes trip; data cascades');

do $$ begin raise notice 'ALL RLS TESTS PASSED'; end $$;
rollback;
