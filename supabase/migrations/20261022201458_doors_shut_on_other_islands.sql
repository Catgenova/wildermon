-- Doors shut on other islands
--
-- What a signed-in browser may read straight off a table, through PostgREST,
-- without asking any `rpc_*`. The browser itself reads only `home`, `fog`,
-- `charted`, `tile_change`, `player` and `item` that way (src/net), and
-- listens for `tile_change`, `event` and its own `item` rows; everything else
-- it is shown comes out of a SECURITY DEFINER call, which reads as the owner
-- and is untouched by any policy here. So every policy below can be narrowed
-- to what a player could already see in the game without the browser noticing.
--
-- ## deal
-- Had no row level security at all: anybody holding the publishable key read
-- every offer on every island, who to whom and for how much. Now on, and read
-- only by its two sides on an island of theirs. No writes for anybody.
--
-- ## creature, and the rest of an island
-- `creature`, `crate`, `deed`, `building`, `building_tile`, `wall`,
-- `floor_tile`, `cellar_tile`, `foundation`, `bridge`, `bridge_span`, `crop`,
-- `foraged`, `land_corner` and `land_tile` were `true` for authenticated:
-- every wildermon, crate, settlement and wall on every island. Now the
-- caller's islands, as `player`, `placed` and `tile_change` already are. The
-- Field guide, a pedigree, a crate's wildermon and a deal come from definer
-- calls (rpc_guide, rpc_creatures, rpc_ground, rpc_deals, rpc_market…), every
-- one of them SECURITY DEFINER, and are unchanged.
--
-- ## event
-- `uid is null` lines (said to the whole island) were readable from every
-- island. Now from the caller's islands; one's own lines as before.
--
-- ## account
-- Any signed-in body, an anonymous sign-in included, could list every
-- username in the game: every login name. Now one's own and those of the
-- bodies on one's islands.
--
-- ## lock_doors
-- Also takes every privilege but SELECT (REFERENCES, TRIGGER, TRUNCATE, and
-- anything else) off public, anon and authenticated on every table and view in
-- `public`, and turns row level security on wherever it is off. Both guarded:
-- nothing is run unless something is to be changed.
--
-- ## rpc_name_free
-- The one call open before sign-in. 20 a minute per client IP; a refusal is
-- "Too many requests: wait N s.". Buckets are a hash of the IP into 4096
-- slots, plus one for callers with no IP header, so the table never holds more
-- than 4097 rows.
set local lock_timeout = '3s';

-- ---------------------------------------------------------------- deal
do $do$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.deal'::regclass) then
    perform private.shut('alter table public.deal enable row level security');
  end if;
  perform private.shut('drop policy if exists deal_read on public.deal');
  perform private.shut($p$create policy deal_read on public.deal for select to authenticated
    using (world_id = any (private.my_islands()) and (select auth.uid()) in (seller, buyer))$p$);
end $do$;
revoke all on table public.deal from public, anon, authenticated;
grant select on table public.deal to authenticated;

-- ---------------------------------------------------------------- an island's own
do $do$
declare t text;
begin
  foreach t in array array['creature', 'crate', 'deed', 'building', 'building_tile', 'wall', 'floor_tile',
                           'cellar_tile', 'foundation', 'bridge', 'bridge_span', 'crop', 'foraged',
                           'land_corner', 'land_tile'] loop
    if not exists (select 1 from pg_policy where polrelid = ('public.' || t)::regclass and polname = t || '_read') then
      raise exception 'no policy %_read on %', t, t;
    end if;
    perform private.shut(format('alter policy %I on public.%I using (world_id = any (private.my_islands()))',
      t || '_read', t));
  end loop;
end $do$;

select private.shut($p$alter policy event_read on public.event
  using (uid = (select auth.uid()) or (uid is null and world_id = any (private.my_islands())))$p$);

select private.shut($p$alter policy account_read on public.account
  using (uid = (select auth.uid())
         or exists (select 1 from public.player p
                     where p.uid = account.uid and p.world_id = any (private.my_islands())))$p$);

-- ---------------------------------------------------------------- lock_doors
do $do$
declare
  v_def text := pg_get_functiondef('private.lock_doors()'::regprocedure);
  v_anchor text := E'  perform set_config(''lock_timeout'', was, true);\nend';
  v_add text := $add$
  -- Every table and view in public, the rulebook or not: row security on, and
  -- nothing for a browser's roles but SELECT, column grants included.
  for t in
    select c.oid, c.relname, c.relkind, c.relrowsecurity,
           (select string_agg(distinct a.privilege_type, ', ')
              from (select x.privilege_type, x.grantee from aclexplode(c.relacl) x
                    union all
                    select y.privilege_type, y.grantee
                      from pg_attribute att, aclexplode(att.attacl) y
                     where att.attrelid = c.oid and att.attnum > 0 and att.attacl is not null) a
             where a.privilege_type <> 'SELECT'
               and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)) as extra
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    if t.relkind in ('r', 'p') and not t.relrowsecurity then
      perform private.shut(format('alter table public.%I enable row level security', t.relname));
    end if;
    if t.extra is not null then
      perform private.shut(format('revoke %s on public.%I from public, anon, authenticated', t.extra, t.relname));
    end if;
  end loop;

$add$;
begin
  if position('aclexplode(c.relacl)' in v_def) > 0 then
    raise exception 'lock_doors already takes every privilege but SELECT';
  end if;
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'lock_doors: the anchor is not there exactly once';
  end if;
  execute replace(v_def, v_anchor, v_add || v_anchor);
end $do$;

-- ---------------------------------------------------------------- rpc_name_free
/** rpc_name_free: calls a minute per client IP. */
create or replace function private.name_free_most() returns int language sql immutable as $$ select 20 $$;
/** rpc_name_free: the window the count is kept over. */
create or replace function private.name_free_window() returns interval language sql immutable as $$ select interval '1 minute' $$;
/** rpc_name_free: IPs are hashed into this many buckets; -1 is for a call with no IP. */
create or replace function private.name_free_slots() returns int language sql immutable as $$ select 4096 $$;

create table if not exists private.name_free_ask (
  slot int primary key,
  since timestamptz not null,
  n int not null
);
alter table private.name_free_ask enable row level security;
revoke all on table private.name_free_ask from public, anon, authenticated;

/**
 * The caller's bucket: Cloudflare's own header when there is one (a client
 * cannot set it), else the first entry of `x-forwarded-for`; -1 with neither.
 */
create or replace function private.name_free_slot() returns int
  language sql stable set search_path = '' as $$
  select case when ip is null or ip = '' then -1
              else (hashtext(ip) & 2147483647) % private.name_free_slots() end
    from (select trim(coalesce(nullif(h ->> 'cf-connecting-ip', ''),
                               split_part(h ->> 'x-forwarded-for', ',', 1))) as ip
            from (select nullif(current_setting('request.headers', true), '')::json as h) s) s2
$$;
revoke all on function private.name_free_most() from public, anon, authenticated;
revoke all on function private.name_free_window() from public, anon, authenticated;
revoke all on function private.name_free_slots() from public, anon, authenticated;
revoke all on function private.name_free_slot() from public, anon, authenticated;

create or replace function rpc_name_free(p_name text) returns boolean
  language plpgsql volatile security definer set search_path = public as $$
declare v_name text := lower(trim(coalesce(p_name, '')));
        v_since timestamptz; v_n int;
begin
  insert into private.name_free_ask as a (slot, since, n) values (private.name_free_slot(), now(), 1)
  on conflict (slot) do update
     set since = case when a.since <= now() - private.name_free_window() then now() else a.since end,
         n = case when a.since <= now() - private.name_free_window() then 1 else a.n + 1 end
  returning a.since, a.n into v_since, v_n;
  if v_n > private.name_free_most() then
    raise exception 'Too many requests: wait % s.',
      greatest(1, ceil(extract(epoch from v_since + private.name_free_window() - now())))::int;
  end if;
  if not name_ok(v_name) then return false; end if;
  return not exists (
    select 1 from auth.users u, unnest(name_domains()) as d
     where lower(u.email) = v_name || d);
end $$;

select private.lock_doors();
