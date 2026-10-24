/*
 * No body left a storey up with nothing under it.
 *
 * A word that changes storey and is held short of the tile it changes on
 * kept the new storey: pulled back to its pace (or stopped by what it ran
 * into) on the tile at a wide staircase's foot, a driver going up it was
 * stored a storey up on the ground's tile, where there is no floor. No path
 * leads off such a tile, and nobody gets down there (`MOUNT_STOREY_SAID`), so
 * the rider, the seat and the team were stuck. `frame_footing` asks every
 * tile a walk goes into, never the one it starts on, and the pull-back moves
 * the body without asking anything.
 *
 * Now the storey a word ends on is asked where it ends (`storey_footing`):
 * where nothing stands there at that storey, the body stays on the storey it
 * was on if that has something under it, and otherwise is let down onto the
 * highest storey under it that has, the ground at the least -- which lets a
 * body already stuck out on its next word. Its wagon and its mount go with it
 * (`drag_along`). The browser lets a body down by the same rule (`Game.footing`).
 */
set local lock_timeout = '3s';

/* The storey a word to a tile at `p_level` ends on, for a body that was on `p_was` (`Game.footing`). */
create or replace function storey_footing(p_world uuid, p_x int, p_y int, p_level int, p_was int) returns int
language plpgsql stable as $$
declare l int;
begin
  if p_level <= 0 or frame_stands(p_world, p_x, p_y, p_level) then return p_level; end if;
  -- Held short of the tile the storey changes on: still on the one it was on.
  if p_was >= 0 and p_was <> p_level and (p_was = 0 or frame_stands(p_world, p_x, p_y, p_was)) then return p_was; end if;
  -- Nothing under it on either: the highest storey under it there is something to stand on, the ground at the least.
  for l in reverse p_level - 1 .. 1 loop
    if frame_stands(p_world, p_x, p_y, l) then return l; end if;
  end loop;
  return 0;
end $$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('rpc_move'::regproc);
  v_old := $$  -- A word without turns is the straight line from where the body was to wherever it is now.$$;
  v_new := $$  -- And a storey up, on a tile with something under it at that storey (`storey_footing`).
  if p_level > 0 then
    p_level := storey_footing(p_world, floor(p_x)::int, floor(p_y)::int, p_level, p.level);
  end if;

$$ || v_old;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_move has % of the straight line, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
