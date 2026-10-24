/*
 * Let down is not a lift.
 *
 * A body stored a storey up with nothing under it is let down onto the
 * storey under it that has something (`storey_footing`), and the browser,
 * having let it down the same way (`Game.footing`), sends its next word from
 * there. That word is a change of storey on one tile, which a spiral
 * staircase's rule holds back where no spiral climbs it (`spiral_move_refusal`):
 * the body still came down, but the answer said held back. Down off a storey
 * with nothing under it, on its own tile, is not a climb, and is not held.
 */
set local lock_timeout = '3s';

create or replace function spiral_move_refusal(p_world uuid, p_uid uuid, p_from int, p_to int,
                                               p_fx double precision, p_fy double precision, p_x double precision, p_y double precision)
  returns text language plpgsql stable as $$
declare v_x int := floor(p_x)::int; v_y int := floor(p_y)::int;
        v_same boolean := floor(p_x)::int = floor(p_fx)::int and floor(p_y)::int = floor(p_fy)::int;
begin
  if v_same and p_from = p_to then return null; end if;
  if p_to >= 0 and (spiral_at(p_world, v_x, v_y, p_to) or spiral_at(p_world, v_x, v_y, p_to + 1))
     and ((driving(p_world, p_uid)).id is not null or (mount_of(p_world, p_uid)).id is not null) then
    return spiral_foot_said();
  end if;
  -- Down off a storey with nothing under it there: let down, not climbed (`storey_footing`).
  if v_same and p_to >= 0 and p_to < p_from and not frame_stands(p_world, v_x, v_y, p_from) then return null; end if;
  if v_same and p_from >= 0 and p_to >= 0 and not spiral_lift_ok(p_world, v_x, v_y, p_from, p_to) then return ''; end if;
  return null;
end $$;

select private.lock_doors();
