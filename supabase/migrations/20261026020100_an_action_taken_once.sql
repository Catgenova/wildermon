-- An action taken once, however many times it is sent.
--
-- A browser that loses the answer to a call does not know whether the island did the thing, and a call
-- sent again after a dropped connection could do it twice: two gathers for one click, a trade accepted
-- twice. So every call the browser makes to a door carries a key of its own, in the `x-wurm-once` header
-- (`src/net/supabase.ts`), and a retry carries the same key. The island keeps the keys it has taken, by
-- account, for `private.once_window()`; a key it has already taken is refused with SQLSTATE `WK409` and
-- the whole call rolls back, and the browser says nothing about it.
--
-- `private.once()` is the first statement of every door of the `act`, `deal` and `land` classes
-- (`private.pace_class`); the `look` and `move` doors, which read or say where you are, do not keep keys.
-- A call with no key (the tools, the tests, an older page) is not counted. A key is taken when the call
-- that took it commits: a call refused by a rule raises, rolls back, and leaves the key free to try again.
-- One call that runs another door (`rpc_plan_hidden_wall` runs `rpc_act`) takes its key once.

set local lock_timeout = '3s';

create unlogged table if not exists private.once_key (
  uid uuid not null,
  key uuid not null,
  at timestamptz not null default now(),
  primary key (uid, key)
);
create index if not exists once_key_at on private.once_key (at);
alter table private.once_key enable row level security;
revoke all on table private.once_key from public, anon, authenticated;

/** How long a key is kept: a retry comes within seconds, and this is ten minutes. */
create or replace function private.once_window() returns interval language sql immutable as $fn$ select interval '10 minutes' $fn$;
/** The header a key comes in, as PostgREST hands headers on (lower case). */
create or replace function private.once_header() returns text language sql immutable as $fn$ select 'x-wurm-once'::text $fn$;

/**
 * This call's key, taken: through, or refused when the same account already took it inside the window.
 *
 * The key is read from `request.headers`, which PostgREST sets on every request. Taken in this transaction
 * already (a door run from inside another): through.
 */
create or replace function private.once() returns void language plpgsql as $fn$
declare v_uid uuid := auth.uid(); v_h text; v_k text; v_key uuid;
begin
  if v_uid is null then return; end if;
  v_h := nullif(current_setting('request.headers', true), '');
  if v_h is null or position(private.once_header() in v_h) = 0 then return; end if;
  v_k := v_h::json ->> private.once_header();
  if v_k is null then return; end if;
  if v_k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Bad request: % is not a key.', private.once_header() using errcode = '22023';
  end if;
  v_key := v_k::uuid;
  if current_setting('wurm.once', true) = v_key::text then return; end if;
  insert into private.once_key as o (uid, key, at) values (v_uid, v_key, now())
  on conflict (uid, key) do update set at = now() where o.at < now() - private.once_window();
  if not found then
    raise exception 'once: already taken' using errcode = 'WK409';
  end if;
  perform set_config('wurm.once', v_key::text, true);
end $fn$;

/** Keys past the window, let go. On the clock every five minutes; returns how many. */
create or replace function private.once_sweep() returns int language plpgsql security definer set search_path = public as $fn$
declare v_n int;
begin
  delete from private.once_key where at < now() - private.once_window();
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

revoke all on function private.once(), private.once_sweep(), private.once_window(), private.once_header()
  from public, anon, authenticated;

/** Which doors keep keys: every door that changes something, which is every class but `look` and `move`. */
create or replace function private.once_doors() returns int language plpgsql as $fn$
declare v_n int;
begin
  insert into private.door_guard (door, ord, line)
  select distinct p.proname, 20, 'perform private.once();'
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace and ns.nspname = 'public'
   where p.proname like 'rpc\_%' and p.prokind = 'f'
     and private.pace_class(p.proname) in ('act', 'deal', 'land')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  -- And none on a door that has since become a look or a move.
  delete from private.door_guard g
   where g.line = 'perform private.once();' and private.pace_class(g.door) not in ('act', 'deal', 'land');
  return v_n;
end $fn$;
revoke all on function private.once_doors() from public, anon, authenticated;

-- Run with the guards, so a door added by a later migration keeps keys too.
do $do$
declare v_def text; v_old text := E'  perform private.guard_doors();\n';
begin
  v_def := pg_get_functiondef('private.lock_doors()'::regprocedure);
  if position('perform private.once_doors();' in v_def) > 0 then return; end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'lock_doors: guard_doors anchor not once';
  end if;
  execute replace(v_def, v_old, E'  perform private.once_doors();\n' || v_old);
end $do$;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  -- `cron.schedule` is an upsert on the name, so a second deploy re-times the job rather than winding another.
  perform cron.schedule('once-sweep', '*/5 * * * *', 'select private.once_sweep()');
exception when others then
  raise notice 'could not wind the key sweep (%)', sqlerrm;
end $$;

select private.lock_doors();
