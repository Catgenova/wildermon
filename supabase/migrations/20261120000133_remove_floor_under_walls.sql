-- Remove floor: never the roof; and a floor under walls that stand on something else comes up, for a higher ceiling.
--
-- Reported: "clicking remove floor removed the roof". A Remove floor with no storey named works on the building's work
-- storey (`frame_job_level`), whose slot on a roofed building is its roof: it took the roof off over the room. It now
-- takes up the floor under a roof it lands on (`remove_floor_level`); Remove roof is the roof's.
--
-- Asked for: "allow removing floors after walls have been constructed, to allow players to have higher ceilings." A wall
-- on a side of the floor kept it down whatever else held the wall up. Now only a wall with nothing else under it does:
-- a finished floor across that side on its storey, or a finished wall under it a storey down, holds it
-- (`wall_left_standing`).

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

create or replace function public.remove_floor_level(p_world uuid, p_building integer, p_kind text, p_target jsonb)
returns integer language sql stable as $f$
  select case when p_kind <> 'roof' and l.lvl > 0 and exists (
                select 1 from floor_tile f where f.world_id = p_world and f.level = l.lvl
                   and f.x = (p_target->>'x')::int and f.y = (p_target->>'y')::int and f.kind = 'roof')
              then l.lvl - 1 else l.lvl end
    from (select frame_floor_level(p_world, p_building, p_kind, p_target) as lvl) l
$f$;

create or replace function public.wall_left_standing(p_world uuid, p_level integer, p_x integer, p_y integer, p_side text)
returns boolean language sql stable as $f$
  select exists (select 1 from floor_tile f
                  where f.world_id = p_world and f.level = p_level and bill_done(f.needed)
                    and f.x = p_x + case p_side when 'e' then 1 when 'w' then -1 else 0 end
                    and f.y = p_y + case p_side when 's' then 1 when 'n' then -1 else 0 end)
      or (p_level > 0 and exists (select 1 from border_of(p_x, p_y, p_side) bd
                                   join wall w on w.world_id = p_world and w.level = p_level - 1
                                    and w.dir = bd.dir and w.x = bd.x and w.y = bd.y and bill_done(w.needed)))
$f$;

select pg_temp.patch_fn('public.perform_building(uuid, uuid, text, jsonb)'::regprocedure,
  $o$  elsif p_action = 'remove_floor' then
    if b.id is null then return; end if;
    kind := coalesce(p_target->>'floorKind', 'floor');
    lvl := frame_floor_level(p_world, b.id, kind, p_target);$o$,
  $n$  elsif p_action = 'remove_floor' then
    if b.id is null then return; end if;
    kind := coalesce(p_target->>'floorKind', 'floor');
    lvl := remove_floor_level(p_world, b.id, kind, p_target);$n$);

select pg_temp.patch_fn('public.build_refusal(uuid, uuid, text, jsonb)'::regprocedure,
  $o$    lvl := frame_floor_level(p_world, b.id, kind, p_target); -- cellar; Frame: on the job's storey.$o$,
  $n$    lvl := case when p_action = 'remove_floor' then remove_floor_level(p_world, b.id, kind, p_target)
                else frame_floor_level(p_world, b.id, kind, p_target) end; -- cellar; Frame: on the job's storey.$n$);

select pg_temp.patch_fn('public.build_refusal(uuid, uuid, text, jsonb)'::regprocedure,
  $o$          join wall w2 on w2.world_id = p_world and w2.level = lvl
            and w2.dir = bd.dir and w2.x = bd.x and w2.y = bd.y) then
        return 'Remove the walls on it first.';$o$,
  $n$          join wall w2 on w2.world_id = p_world and w2.level = lvl
            and w2.dir = bd.dir and w2.x = bd.x and w2.y = bd.y
          where not wall_left_standing(p_world, lvl, tx, ty, s.side)) then
        return 'Remove the walls on it first.';$n$);

select private.lock_doors();
