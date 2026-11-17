-- A worker's search for its next tile, asked over the square it needs and no more.
--
-- Read off the island (2026-11-17, a Look with the Snout's think in its parts): Snout #8286 seeks over its settlement,
-- radius 126, a square of 64,009 tiles. Every search for its next dig asked `private.work_tile_may` of the whole square
-- first (1,030 ms), then walked the rings out from the middle and found a tile in the first few (26,157 tiles of the
-- square to be had). That was its think of 1.1 to 1.3 s every minute or two, and the clock's round with it.
--
-- The square is asked in bands now, 16 tiles out, then 32, 64 and the whole radius, each band only once the rings
-- inside it have found nothing. What a tile may be is worked out tile by tile, whatever the square it is asked in,
-- and the rings are walked in the same order with the same draws of `random()`, so the same tile is found.

set local lock_timeout = '3s';

create or replace function public.find_work_tile(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_kind text, c creature)
 returns table(x integer, y integer)
 language plpgsql
 stable
as $function$
declare ring int; spot record; v_w int; v_may boolean[]; v_has boolean[]; v_owed bigint := 0; v_band int := 0; v_from int := 0; v_none boolean;
begin
  if p_range < 0 then return; end if;
  ring := 0;
  while ring <= p_range loop
    -- The next band of the square: what each tile in it may be, and which of its rings have any.
    if ring > v_band or v_from = 0 then
      v_band := case when v_from = 0 then least(p_range, 16) else least(p_range, v_band * 2) end;
      v_from := 1;
      v_w := 2 * v_band + 1;
      v_may := private.work_tile_may(p_world, p_cx, p_cy, v_band, p_kind, c.id);
      v_none := v_may is null;
      if not v_none then
        select array_agg(q.h order by q.r) into v_has from (
          select greatest(abs(dx), abs(dy)) as r, bool_or(v_may[(dy + v_band) * v_w + dx + v_band + 1]) as h
            from generate_series(-v_band, v_band) dy cross join generate_series(-v_band, v_band) dx group by 1) q;
      end if;
    end if;
    if not v_none and not v_has[ring + 1] then
      v_owed := v_owed + case when ring = 0 then 1 else 8 * ring end;
      ring := ring + 1;
      continue;
    end if;
    if v_owed > 0 then perform count(random()) from generate_series(1, v_owed); v_owed := 0; end if;
    for spot in
      select p_cx + dx as gx, p_cy + dy as gy
      from generate_series(-ring, ring) dx, generate_series(-ring, ring) dy
      where greatest(abs(dx), abs(dy)) = ring
      order by random()
    loop
      if (v_none or v_may[(spot.gy - p_cy + v_band) * v_w + spot.gx - p_cx + v_band + 1])
         and worker_gatherable(p_world, spot.gx, spot.gy, p_kind, c) then
        x := spot.gx; y := spot.gy;
        return next;
        return;
      end if;
    end loop;
    ring := ring + 1;
  end loop;
  if v_owed > 0 then perform count(random()) from generate_series(1, v_owed); end if;
  return;
end $function$;

select private.lock_doors();
