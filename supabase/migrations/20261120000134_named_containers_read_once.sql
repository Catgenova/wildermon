-- A container's name read against the item list by index, and a Chestkit asking each kind of item once whether a
-- container named for it has room.
--
-- Reported: players' frames and actions lagging, more each day for a week. Read off the island: the clock's round at
-- 800 ms on average, with one of about 12 s every half minute, while the clock holds the rows players' moves and acts
-- write (those waited up to 7.8 s). The 12 s was one think of one Hoardback (fetch, idle "namedfull") on a settlement
-- with 949 stacks in its stores: `sort_stack` 12.1 s, of which its query of the stores 11.6 s, and `hoard_move` 0.7 s.
--
-- `private.hoard_items` reads a name against every item's id and name, singular and plural (`hoard_plural`, a function
-- call each, never inlined for its search_path): 2,576 calls, about 12 ms, for any name at all that is not empty.
-- `sort_stack` asks it of the box of every stack in the stores, `hoard_boxes` of every box. The four forms are
-- indexed now and each looked up apart, so a name costs four index probes.
--
-- And with every container named for what lay in the unnamed boxes full, `hoard_move` asked each named container's
-- room (`hoard_room`, a count of its contents) and whether it refuses for every stack, one after another, finding no
-- room each time. What a kind of item finds is the same for every stack of it, so it is asked once.

set local lock_timeout = '3s';

create index if not exists item_def_hoard_id on item_def (lower(id));
create index if not exists item_def_hoard_id_plural on item_def (private.hoard_plural(id));
create index if not exists item_def_hoard_name on item_def (lower(name));
create index if not exists item_def_hoard_name_plural on item_def (private.hoard_plural(name));

create or replace function private.hoard_items(p_name text)
returns text[] language sql stable set search_path = public as $f$
  select case when coalesce(q.v, '') = '' then null else
    (select array_agg(distinct m.id collate "C" order by m.id collate "C") from (
       select d.id from item_def d where lower(d.id) = q.v
       union all select d.id from item_def d where private.hoard_plural(d.id) = q.v
       union all select d.id from item_def d where lower(d.name) = q.v
       union all select d.id from item_def d where private.hoard_plural(d.name) = q.v) m) end
  from (select private.hoard_fold(p_name) as v) q
$f$;

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

select pg_temp.patch_fn('private.hoard_move(uuid, creature, double precision, double precision, integer, integer)'::regprocedure,
  $o$        v_into int; v_refuse boolean; v_first text; v_refused text[];$o$,
  $n$        v_into int; v_refuse boolean; v_first text; v_refused text[]; v_asked jsonb := '{}';$n$);

select pg_temp.patch_fn('private.hoard_move(uuid, creature, double precision, double precision, integer, integer)'::regprocedure,
  $o$    v_seen := true;
    v_into := 0; v_refuse := true; v_first := null;$o$,
  $n$    v_seen := true;
    -- A kind already found no room for: the same for this stack of it.
    if v_asked ? r.def then continue; end if;
    v_asked := v_asked || jsonb_build_object(r.def, true);
    v_into := 0; v_refuse := true; v_first := null;$n$);

select private.lock_doors();
