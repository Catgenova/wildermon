-- Where a thing came from (`item.origin`, `origin_fn`, `origin_uid`; 20261026130000) is the
-- watch's and the keepers', and no browser's: `origin_uid` is the uid of whoever made it, and a
-- thing changes hands. Kept off every way an item row reaches a browser:
--
--   * the table: authenticated reads every column of `item` but those three (`lock_doors` holds it,
--     so a column added later is readable without a grant of its own); the browser asks for the
--     columns it reads by name (`Island.refreshPack`), and Realtime sends only the columns the
--     subscriber may read;
--   * the pack over Broadcast (`private.pack_out`), the pack in an answer (`held_now`), and what is
--     lying on the ground and on cellar floors (`rpc_ground`): each row without them;
--   * `container`, a security_invoker view no browser reads, whose bags pass a whole `item` row
--     (`bag_room(b.*)`) and so cannot be read without those columns: authenticated holds no
--     SELECT on it, rather than one every read of which is refused.

set local lock_timeout = '3s';

-- ---------------------------------------------------------------- lock_doors: item's columns
do $do$
declare def text; n int;
  anchor constant text := $a$  perform set_config('lock_timeout', was, true);
end$a$;
  repl constant text := $b$  -- `item`: authenticated reads every column but where the thing came from (`origin`, `origin_fn`,
  -- `origin_uid`), which are the watch's and the keepers'.
  if exists (select 1 from pg_class c, aclexplode(c.relacl) a
              where c.oid = 'public.item'::regclass and a.privilege_type = 'SELECT'
                and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)) then
    perform private.shut('revoke select on public.item from public, anon, authenticated');
  end if;
  perform private.shut(format('grant select (%s) on public.item to authenticated', s.cols))
    from (select string_agg(quote_ident(a.attname), ', ' order by a.attnum) as cols from pg_attribute a
           where a.attrelid = 'public.item'::regclass and a.attnum > 0 and not a.attisdropped
             and a.attname not in ('origin', 'origin_fn', 'origin_uid')
             and not has_column_privilege('authenticated', a.attrelid, a.attnum, 'select')) s
   where s.cols is not null;
  if exists (select 1 from pg_attribute a, aclexplode(a.attacl) x
              where a.attrelid = 'public.item'::regclass and a.attname in ('origin', 'origin_fn', 'origin_uid')
                and x.privilege_type = 'SELECT'
                and x.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)) then
    perform private.shut('revoke select (origin, origin_fn, origin_uid) on public.item from public, anon, authenticated');
  end if;

  perform set_config('lock_timeout', was, true);
end$b$;
begin
  def := pg_get_functiondef('private.lock_doors()'::regprocedure);
  if strpos(def, repl) = 0 then
    n := (length(def) - length(replace(def, anchor, ''))) / length(anchor);
    if n <> 1 then raise exception 'lock_doors: anchor found % times', n; end if;
    execute replace(def, anchor, repl);
  end if;
end $do$;

-- ---------------------------------------------------------------- the rows a browser is sent
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'private.pack_out()'::regprocedure, 1,
     $$jsonb_agg(to_jsonb(f) order by f.id) as set$$,
     $$jsonb_agg(to_jsonb(f) - array['origin', 'origin_fn', 'origin_uid'] order by f.id) as set$$),
    (2, 'private.pack_out()'::regprocedure, 1,
     $$to_jsonb(f) as row$$,
     $$to_jsonb(f) - array['origin', 'origin_fn', 'origin_uid'] as row$$),
    (3, 'public.held_now(uuid, uuid)'::regprocedure, 1,
     $$jsonb_agg(to_jsonb(i) order by i.id)$$,
     $$jsonb_agg(to_jsonb(i) - array['origin', 'origin_fn', 'origin_uid'] order by i.id)$$),
    -- `lying` and `cellarLying`, the same words for both.
    (4, 'public.rpc_ground(uuid, double precision, boolean)'::regprocedure, 2,
     $$jsonb_agg(to_jsonb(i) - 'world_id' order by i.id)$$,
     $$jsonb_agg(to_jsonb(i) - 'world_id' - array['origin', 'origin_fn', 'origin_uid'] order by i.id)$$)
  ) as t(ord, fn, times, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    -- Run before: nothing to do.
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- ---------------------------------------------------------------- container: read by no browser
revoke select on public.container from public, anon, authenticated;

select private.lock_doors();
