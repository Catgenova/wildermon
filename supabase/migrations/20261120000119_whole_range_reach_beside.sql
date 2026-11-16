-- The reach of a whole work range at once (`creature_search` with a box, `storey_reach`, a hod carrier's) takes a tile
-- nothing is stood on as reached from a floor beside it, as the way to one tile does (`creature_way`'s goal: a tile with
-- nothing to stand on is gone to by a floor beside it with no wall between).
--
-- Reported: Bastiondrakes still "Idle: no stairs up to storey 4." after 20261120000114. Read off the island: the walls
-- planned on storey 4 along the north edge of an unfinished bridge's deck are fitted from that deck (`hod_stand`,
-- `frame_stands` takes any bridge's deck). An unfinished bridge is not walked (`storey_deck_cells`), so the way to that
-- deck went to the floor beside it and found it, `hod_reached` said yes; the reach of the whole range had no such tile
-- and said no, so `hod_needing_stocked` never handed the walls out and `hod_unreached` said storey 4 every round.
--
-- And a hod carrier fits a wall from a tile a worker stands on (`hod_stands`): a finished floor, or a finished bridge's
-- deck (`storey_deck_cells`), not an unfinished bridge's deck nobody walks; walked onto, it was stranded there.

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

select pg_temp.patch_fn('public.creature_search(uuid, integer, integer, integer, integer, integer, integer, integer[])'::regprocedure,
  $o$  if flood then
    for k in wh + 1 .. n loop
      continue when not (sp[k] or (par[k] <> 0 and st[k] in (1, 2, 3, 6)));$o$,
  $n$  if flood then
    -- A tile with nothing to stand on: reached from a floor beside it reached, no wall between (the goal above).
    for k in wh + 1 .. n loop
      continue when st[k] in (1, 2, 3, 6);
      l := (k - 1) / wh; x := bx0 + (k - 1) % w; y := by0 + ((k - 1) / w) % h;
      for d in 1..4 loop
        nx := x + dxs[d]; ny := y + dys[d];
        continue when nx < bx0 or nx > bx1 or ny < by0 or ny > by1;
        kn := (l * h + (ny - by0)) * w + (nx - bx0) + 1;
        continue when st[kn] not in (1, 3) or not (sp[kn] or par[kn] <> 0);
        blk := case d when 1 then bv[kn] when 2 then bv[k] when 3 then bh[kn] else bh[k] end;
        if not blk then goal[k] := true; exit; end if;
      end loop;
    end loop;
    for k in wh + 1 .. n loop
      continue when not (sp[k] or goal[k] or (par[k] <> 0 and st[k] in (1, 2, 3, 6)));$n$);

create or replace function public.hod_stands(p_world uuid, p_x integer, p_y integer, p_level integer)
returns boolean language sql stable as $f$
  select frame_stands(p_world, p_x, p_y, p_level)
     and (exists (select 1 from floor_tile f where f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y
                    and bill_done(f.needed))
          or exists (select 1 from storey_deck_cells(p_world) c where c.level = p_level and c.x = p_x and c.y = p_y))
$f$;

select pg_temp.patch_fn('public.hod_stand(uuid, text, integer, text, integer, integer)'::regprocedure,
  'frame_stands(p_world, ', 'hod_stands(p_world, ', 4);

select private.lock_doors();
