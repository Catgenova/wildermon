-- The doors, shut tighter: what a browser's roles hold, as reviewed against
-- `supabase/test/permissions.allow.ts`.
--
-- Found open, and shut here and in `private.lock_doors()` so that it stays so:
--
--   * `world` was readable by anybody, signed in or not: every island's id
--     (which is its invitation), its seed and the uid of whoever founded it.
--     The browser never reads it (`rpc_join` hands over the island it is on),
--     and the smoke test reads the front door's (`home`). Now: a signed-in body
--     reads the islands it is on and the front door's, and nobody else reads
--     any. The rulebook loop in `lock_doors` used to put `using (true)` back on
--     it, since it has no `world_id` column; it leaves it alone now.
--   * anon held SELECT on every table with an island or a body on it. No row
--     came back (no policy names anon but three that compare to `auth.uid()`,
--     which anon has none of), but a policy written `to public` one day would
--     have handed over the lot. anon reads the rulebook and `home` and nothing
--     else now, and the three policies name authenticated alone.
--   * anon and authenticated held USAGE, SELECT and UPDATE on every sequence in
--     public: `nextval` and `setval` on the island's own counters, through any
--     door that reaches SQL. The doors run as their owner and need none of it.
--   * the trigger functions in private (`bag_contents_follow`, `land_out`,
--     `pack_out`, `presence_said`, `said_out`) were executable by PUBLIC, as
--     every new function is. Nothing in private is executable by anon or PUBLIC
--     now, and authenticated keeps what a policy calls (`on_island`,
--     `my_islands`, `hears`).

set local lock_timeout = '3s';

-- ---------------------------------------------------------------- lock_doors, the new rules in it
do $do$
declare r record; def text; n int;
begin
  for r in select * from (values
    -- The rulebook loop: not `world`.
    ($a$    where n.nspname = 'public' and c.relkind = 'r'
      and not exists ($a$,
     $b$    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'world'  -- an island's own row: `world_read`
      and not exists ($b$),
    -- And at the end: sequences, anon on an island's tables, private's functions.
    ($a$  perform set_config('lock_timeout', was, true);
end$a$,
     $b$  -- Every sequence in public: nothing for anon, authenticated or PUBLIC. The doors run as their owner.
  for t in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
      and exists (select 1 from aclexplode(c.relacl) a
                  where a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid))
  loop
    perform private.shut(format('revoke all on sequence public.%I from public, anon, authenticated', t.relname));
  end loop;
  -- anon reads the rulebook and nothing with an island or a body on it.
  for t in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (c.relname = 'world' or exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname in ('world_id', 'uid') and a.attnum > 0 and not a.attisdropped))
      and exists (select 1 from aclexplode(c.relacl) a
                  where a.grantee in (0, 'anon'::regrole::oid) and a.privilege_type = 'SELECT')
  loop
    perform private.shut(format('revoke select on public.%I from public, anon', t.relname));
  end loop;
  -- Nothing in private is executable by anon or PUBLIC; authenticated only what was granted by name.
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p
    where p.pronamespace = 'private'::regnamespace
      and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee in (0, 'anon'::regrole::oid))
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;

  perform set_config('lock_timeout', was, true);
end$b$)
  ) v(anchor, repl)
  loop
    def := pg_get_functiondef('private.lock_doors()'::regprocedure);
    if strpos(def, r.repl) > 0 then continue; end if;
    n := (length(def) - length(replace(def, r.anchor, ''))) / length(r.anchor);
    if n <> 1 then raise exception 'lock_doors: anchor found % times: %', n, left(r.anchor, 80); end if;
    execute replace(def, r.anchor, r.repl);
  end loop;
end $do$;

-- ---------------------------------------------------------------- world: the islands you are on
drop policy if exists world_read on public.world;
create policy world_read on public.world for select to authenticated
  using (id = any (private.my_islands()) or id in (select h.island from public.home h));
revoke select on public.world from public, anon;
grant select on public.world to authenticated;

-- ---------------------------------------------------------------- three policies that named anon
do $do$
declare t text;
begin
  foreach t in array array['path_taken', 'player_node', 'player_spell'] loop
    if exists (select 1 from pg_policy p where p.polrelid = ('public.' || t)::regclass and p.polname = t || '_read'
                and 'anon'::regrole::oid = any (p.polroles)) then
      execute format('alter policy %I on public.%I to authenticated', t || '_read', t);
    end if;
  end loop;
end $do$;

select private.lock_doors();
