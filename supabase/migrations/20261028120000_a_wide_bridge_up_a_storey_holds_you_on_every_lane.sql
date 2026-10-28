-- A bridge up a storey holds a body on every lane of its deck, as the browser has it.
--
-- Reported: "Bridge is completed, but walking on it is bugged. Impossible to walk on or under, seems to be an odd mixture
-- of the two." A body a storey up stands only where something is under it at that storey (`frame_stands`, behind
-- `storey_footing` and `frame_footing` in `rpc_move`). For a bridge that was its two end tiles and the tiles of its
-- spans, which are its middle lane: on a bridge two or three lanes wide, a step onto an outer lane up a storey was let
-- down to the ground under the deck, while the browser (`standsUp`: `bridgeAt`, `bridgeEndAt`) kept you on the deck --
-- drawn on it, put back under it, over and over. Now every lane of a bridge's deck (`bridge_at`) and every lane's end
-- tile counts, at the storeys its two ends land on.

set local lock_timeout = '3s';

create or replace function frame_stands(p_world uuid, p_x integer, p_y integer, p_level integer)
 returns boolean
 language plpgsql
 stable
as $function$
declare f floor_tile;
begin
  select * into f from floor_tile where world_id = p_world and level = p_level and x = p_x and y = p_y;
  if found and bill_done(f.needed) then
    if f.kind <> 'roof' then return true; end if;
    return coalesce((select r.walkable from building b join roof_shape_def r on r.id = coalesce(b.roof, 'hip')
                      where b.world_id = p_world and b.id = f.building), false);
  end if;
  -- A bridge's deck, any lane of it, or any lane's end, at the storey either end lands on (`standsUp`).
  return exists (select 1 from bridge b where b.world_id = p_world and p_level in (b.level, coalesce(b.level_b, b.level))
                   and (b.id = bridge_at(p_world, p_x, p_y)
                        or exists (select 1 from bridge_lanes(b.width, b.side) l
                                    cross join lateral (select case when b.ay = b.by and b.ax <> b.bx then 0 else 1 end as px,
                                                               case when b.ay = b.by and b.ax <> b.bx then 1 else 0 end as py) p
                                    where (b.ax + l.o * p.px = p_x and b.ay + l.o * p.py = p_y)
                                       or (b.bx + l.o * p.px = p_x and b.by + l.o * p.py = p_y))));
end $function$;

select private.lock_doors();
