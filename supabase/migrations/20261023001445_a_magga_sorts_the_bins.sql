-- A magga sorts the bins.
--
-- Asked for: "[Magga] now also sorts raw material bins and craft material bins." The magga's trade is `fetch`: carry
-- what lies on the settlement home. With nothing lying within its range, a magga working off its settlement (not a
-- work post) takes one stack out of a settlement store that is not a bin -- a crate, a chest, shelves, anything that
-- may be marked a store (`store_markable_refusal`) and takes anything (`furniture_def.takes` is null) -- that a raw
-- material bin or a craft material bin on the settlement takes (`furniture_refuses`) and has room for
-- (`furniture_room`), as many of it as the roomiest such bin holds more of, and carries it home the way it carries
-- what it picks up: a go at its trade, its stage's loads a trip (`stage_loads`), each put where `worker_store` puts it,
-- which is a bin that will take it first. Never out of a bin, a stall, a trash crate, a mailbox, anything driven or
-- sailed, a padlocked store (`lock`), a marked settlement store (`store_of`), or a locked item. With nothing to sort
-- either it says it is idle as before (`range`); the browser's card says both.
--
-- Only looked for when the ring search for something lying about came back empty, so the clock pays for it only
-- when a magga has nothing else to do; and then by one query over the settlement's stores (`deed_store_items`) and
-- its bins (`sort_stack`). The browser's `sortStack`.

set local lock_timeout = '3s';

-- The stack a magga sorts next: out of the store standing at (`p_x`, `p_y`) when given, the nearest to (`p_fx`, `p_fy`)
-- otherwise; with the store, the item and how many of it the roomiest bin that takes it has room for.
--
-- Cheap, as it runs in the clock's worker step: the bins are read once; a stack is a candidate only when a bin's door
-- (`furniture_takes`, which is all `furniture_refuses` asks of a bin, a piece that holds things and no liquid) lets
-- it in; and the room (`furniture_room`, a query of its own) is asked only of the candidates in turn, nearest first,
-- once a kind of thing, and of a bin that counts things (no `furniture_heft`) once for all kinds.
create or replace function sort_stack(p_world uuid, c creature, p_fx double precision, p_fy double precision,
                                      p_x int default null, p_y int default null)
returns table(kind text, sid bigint, x int, y int, cx double precision, cy double precision, iid bigint, n int)
language plpgsql stable as $fn$
declare dd deed; v_bins placed[]; b placed; r record; v_room jsonb := '{}'; v_counted jsonb := '{}'; v_n int; v_k int;
begin
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if dd.x is null then return; end if;
  select array_agg(bp order by bp.id) into v_bins
    from placed bp join furniture_def fd on fd.id = bp.sub
   where bp.world_id = p_world and bp.x between dd.x - dd.radius and dd.x + dd.radius
     and bp.y between dd.y - dd.radius and dd.y + dd.radius
     and bp.kind = 'furniture' and fd.takes in ('raw', 'worked');
  -- No bin on the settlement is nothing to sort, and nothing else is looked at.
  if v_bins is null then return; end if;
  for r in
    select s.kind, s.sid, s.x, s.y, s.cx, s.cy, (s.it).id as iid, (s.it).def as def, (s.it).count as cnt
      from deed_store_items(p_world, c.keeper) s
     where abs(s.x - dd.x) <= dd.radius and abs(s.y - dd.y) <= dd.radius
       and (p_x is null or (s.x = p_x and s.y = p_y))
       and (s.it).count > 0 and not coalesce((s.it).locked, false)
       and exists (select 1 from unnest(v_bins) bb join furniture_def fd on fd.id = bb.sub
                    where furniture_takes(fd.takes, (s.it).def) is null)
       and case when s.kind = 'crate'
                then exists (select 1 from crate cr where cr.world_id = p_world and cr.id = s.sid
                                and cr.lock is null and cr.store_of is null)
                else exists (select 1 from placed pl join furniture_def fd on fd.id = pl.sub
                              where pl.id = s.sid and pl.lock is null and pl.store_of is null and fd.takes is null
                                and store_markable_refusal(pl) is null) end
     order by (s.cx - p_fx) ^ 2 + (s.cy - p_fy) ^ 2, s.kind, s.sid, (s.it).id
  loop
    if not v_room ? r.def then
      v_n := 0;
      foreach b in array v_bins loop
        if (select furniture_takes(fd.takes, r.def) from furniture_def fd where fd.id = b.sub) is not null then continue; end if;
        if v_counted ? b.id::text then v_k := (v_counted->>b.id::text)::int;
        else
          v_k := furniture_room(b, r.def);
          if furniture_heft(b) <= 0 then v_counted := v_counted || jsonb_build_object(b.id::text, v_k); end if;
        end if;
        v_n := greatest(v_n, v_k);
      end loop;
      v_room := v_room || jsonb_build_object(r.def, v_n);
    end if;
    v_n := (v_room->>r.def)::int;
    if v_n > 0 then
      kind := r.kind; sid := r.sid; x := r.x; y := r.y; cx := r.cx; cy := r.cy; iid := r.iid; n := least(r.cnt, v_n);
      return next;
      return;
    end if;
  end loop;
end $fn$;

-- One stack sorted out of the store standing at (`p_x`, `p_y`): taken out of it, and what is carried away.
create or replace function sort_take(p_world uuid, c creature, p_x int, p_y int) returns jsonb
language plpgsql as $fn$
declare s record; v item;
begin
  select * into s from sort_stack(p_world, c, p_x + 0.5, p_y + 0.5, p_x, p_y);
  if s.iid is null then return null; end if;
  select * into v from item where id = s.iid for update;
  if v.id is null then return null; end if;
  if v.count > s.n then update item set count = count - s.n where id = v.id;
  else delete from item where id = v.id; end if;
  return jsonb_build_object('def', v.def, 'count', s.n, 'ql', v.ql, 'extra', v.extra);
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Nothing lying about within its range: a magga on its settlement goes to the nearest stack it can sort.
    ('worker_settle', $$v_held jsonb; v_left int; v_bed placed;$$, $$v_held jsonb; v_left int; v_bed placed; v_sort record;$$),
    ('worker_settle', $$      select * into spot from find_work_tile(p_world, v_site.x, v_site.y, v_site.radius, kind, c);
$$, $$      select * into spot from find_work_tile(p_world, v_site.x, v_site.y, v_site.radius, kind, c);
      if spot.x is null and kind = 'fetch' and v_site.post is null then
        select * into v_sort from sort_stack(p_world, c, cx, cy);
        if v_sort.iid is not null then
          c.work_x := v_sort.x; c.work_y := v_sort.y;
          c.idle_since := null; c.idle_why := null; c.idle_n := null;
          dist := sqrt((v_sort.cx - cx) ^ 2 + (v_sort.cy - cy) ^ 2);
          c.from_x := cx; c.from_y := cy; c.to_x := v_sort.cx; c.to_y := v_sort.cy;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          c.phase := 'out';
          continue;
        end if;
      end if;
$$),
    -- And there, what lies on the tile first, and failing that the stack out of the store standing on it.
    ('worker_do', $$        and gx = wx and gy = wy order by id limit 1;
      if not found then return null; end if;
      delete from item where id = lying.id;
$$, $$        and gx = wx and gy = wy order by id limit 1;
      if not found then return sort_take(p_world, c, wx, wy); end if;
      delete from item where id = lying.id;
$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the line to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
