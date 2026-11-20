-- A worker's look for something to sort (`sort_stack`): each item kind asked of the settlement's bins once, and each store
-- whether it may be sorted from once, not every stack of every store; the same stack found.
--
-- Asked for: reduce sort_stack's cost (about 430 ms on the island's largest settlement). On a 100-crate settlement of
-- 1,500 stacks, warm: 103 ms to 22 ms, the same stack chosen (magsort.ts, hoardspeed.ts pass).

set local lock_timeout = '3s';

create or replace function public.sort_stack(p_world uuid, c creature, p_fx double precision, p_fy double precision, p_x integer default null::integer, p_y integer default null::integer)
 returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, iid bigint, n integer)
 language plpgsql
 stable
as $function$
declare dd deed; v_bins placed[]; b placed; r record; v_room jsonb := '{}'; v_counted jsonb := '{}'; v_n int; v_k int;
begin
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if dd.x is null then return; end if;
  select array_agg(bp order by bp.id) into v_bins
    from placed bp join furniture_def fd on fd.id = bp.sub
   where bp.world_id = p_world and bp.x between dd.x - dd.radius and dd.x + dd.radius
     and bp.y between dd.y - dd.radius and dd.y + dd.radius
     and bp.kind = 'furniture' and fd.takes in ('raw', 'worked') and private.hoard_items(bp.name) is null;
  -- No bin on the settlement is nothing to sort, and nothing else is looked at.
  if v_bins is null then return; end if;
  -- Each item kind asked of the bins once, and each store whether it may be sorted from once, not each stack.
  for r in
    with s as materialized (
      select s.kind, s.sid, s.x, s.y, s.cx, s.cy, (s.it).id as iid, (s.it).def as def, (s.it).count as cnt
        from deed_store_items(p_world, c.keeper) s
       where abs(s.x - dd.x) <= dd.radius and abs(s.y - dd.y) <= dd.radius
         and (p_x is null or (s.x = p_x and s.y = p_y))
         and (s.it).count > 0 and not coalesce((s.it).locked, false)),
    defs as materialized (
      select d.def from (select distinct s.def from s) d
       where exists (select 1 from unnest(v_bins) bb join furniture_def fd on fd.id = bb.sub
                      where furniture_takes(fd.takes, d.def) is null)),
    stores as materialized (
      select st.kind, st.sid from (select distinct s.kind, s.sid from s join defs on defs.def = s.def) st
       where case when st.kind = 'crate'
                  then exists (select 1 from crate cr where cr.world_id = p_world and cr.id = st.sid
                                  and cr.lock is null and cr.store_of is null and private.hoard_items(cr.name) is null)
                  else exists (select 1 from placed pl join furniture_def fd on fd.id = pl.sub
                                where pl.id = st.sid and pl.lock is null and pl.store_of is null and fd.takes is null
                                  and private.hoard_items(pl.name) is null
                                  and store_markable_refusal(pl) is null) end)
    select s.* from s join defs on defs.def = s.def join stores on stores.kind = s.kind and stores.sid = s.sid
     order by (s.cx - p_fx) ^ 2 + (s.cy - p_fy) ^ 2, s.kind, s.sid, s.iid
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
end $function$;

select private.lock_doors();
