-- The clock looks for work only on the tiles that could be some.
--
-- Asked for: "streamline cpu". Measured on an island built like the live one (supabase/test/bench-stir.ts): seventy
-- per cent of the stir was `find_work_tile`, which asks `worker_gatherable` of every tile of a worker's ground, ring by
-- ring outward, until one answers. A tenth to a third of a millisecond a tile, and a guard, a hunter, or a gatherer
-- with nothing of its trade in reach asks it of every tile there is: 441 of them at a range of ten, 1681 at twenty.
--
-- `worker_gatherable` turns down nearly every tile without looking further than the tile's kind (a woodcutter wants a
-- tree, a reed cutter reed, a guard nothing at all), whether it was foraged lately, and whether another worker is at
-- it; so those are read for the whole ground in one query (`private.work_tile_may`), and `worker_gatherable` is asked
-- only of the tiles left. The search is the same: the same rings in the same order, each ring in its own random order,
-- the first tile that answers. Even the random draws are the same ones, so a test that seeds the generator sees the
-- same tile: a ring with nothing left in it is not looked through, and the draws it would have made are made and
-- thrown away.

set local lock_timeout = '3s';

/*
 * Which tiles of the square of `p_range` round (`p_cx`, `p_cy`) `worker_gatherable` could say yes to for `p_kind` and
 * the worker `p_id`, row by row from the top (index `(dy + p_range) * (2 * p_range + 1) + dx + p_range + 1`), or null
 * where only asking it will tell. A tile false here is one it says no to on what is read here alone: out of bounds,
 * claimed by another worker at it (`claimed`), the wrong kind of tile or nothing of the trade on it, or foraged for
 * the trade lately (`is_foraged`). Keep this in step with `worker_gatherable` when a trade is added there.
 */
create or replace function private.work_tile_may(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_kind text, p_id integer)
returns boolean[] language plpgsql stable as $fn$
declare v_size int; v_tiles int[]; v_flag text; v_fkind text; v_out boolean[];
        v_x0 int := p_cx - p_range; v_x1 int := p_cx + p_range; v_y0 int := p_cy - p_range; v_y1 int := p_cy + p_range;
begin
  -- A scrubber wants old paving on its own settlement: only the whole question answers that.
  if p_kind = 'scrub' then return null; end if;
  select w.size into v_size from world w where w.id = p_world;
  v_tiles := case p_kind
    when 'bush' then array[tile_id('Bush')]
    when 'grass' then array[tile_id('Moss'), tile_id('Grass'), tile_id('Steppe'), tile_id('Lawn'), tile_id('Tundra')]
    when 'moss' then array[tile_id('Moss')]
    when 'pan' then array[tile_id('Sand')]
    when 'sprout' then array[tile_id('Tree')]
    when 'resin' then array[tile_id('Tree')]
    when 'woodcut' then array[tile_id('Tree')]
    when 'prune' then array[tile_id('Tree')]
    when 'fruit' then array[tile_id('Tree')]
    when 'flower' then array[tile_id('Grass')]
    when 'stump' then array[tile_id('Stump')]
    when 'mine' then array[tile_id('Rock')]
    when 'quarry' then array[tile_id('Rock'), tile_id('Snow')]
    when 'sand' then array[tile_id('Sand')]
    when 'clay' then array[tile_id('Clay')]
    when 'peat' then array[tile_id('Peat'), tile_id('Tar')]
    when 'reed' then array[tile_id('Reed')]
    when 'farm' then array[tile_id('Field')]
    else array[]::int[] end;
  v_flag := case p_kind when 'worm' then 'wormy' when 'seek' then 'diggable' when 'forage' then 'forage'
                        when 'botanize' then 'botanize' end;
  -- What `is_foraged` asks of the tile for the trade (a grass cutter's moss is asked as moss, below).
  v_fkind := case p_kind when 'bush' then 'forage' when 'grass' then 'grass' when 'moss' then 'moss' when 'worm' then 'worm'
                         when 'sprout' then 'sprout' when 'fruit' then 'forage' when 'reed' then 'reed' when 'seek' then 'dig'
                         when 'forage' then 'forage' when 'botanize' then 'botanize' end;
  with lt as materialized (
    select t.y, t.tiles from land_tile t where t.world_id = p_world and t.y between v_y0 and v_y1),
  lc as materialized (
    select c.y, c.heights from land_corner c where p_kind = 'fish' and c.world_id = p_world and c.y between v_y0 and v_y1 + 1),
  g as (
    select g0.dy, g0.dx, g0.gx, g0.gy, g0.inb,
           case when g0.inb and g0.gx < length(lt.tiles) then get_byte(lt.tiles, g0.gx) end as tile
      from (select dy, dx, p_cx + dx as gx, p_cy + dy as gy,
                   p_cx + dx >= 0 and p_cy + dy >= 0 and p_cx + dx < v_size and p_cy + dy < v_size as inb
              from generate_series(-p_range, p_range) dy cross join generate_series(-p_range, p_range) dx) g0
      left join lt on lt.y = g0.gy)
  select array_agg(coalesce(g.inb
           -- Another worker at it (`claimed`), which a hive is not asked.
           and (p_kind = 'hive' or cl.x is null)
           -- Foraged for the trade lately (`is_foraged`); a ripe trellis for a bush picker whatever the bush.
           and (fo.x is null or (p_kind = 'bush' and pv.x is not null))
           and (g.tile = any(v_tiles)
                or (v_flag = 'wormy' and td.wormy) or (v_flag = 'diggable' and td.diggable)
                or (v_flag = 'forage' and td.forage) or (v_flag = 'botanize' and td.botanize)
                or (p_kind = 'bush' and pv.x is not null)
                or (p_kind = 'hive' and ph.x is not null)
                or (p_kind = 'fetch' and ig.gx is not null)
                or (p_kind = 'compost' and ig.waste)
                or (p_kind = 'farm' and cr.x is not null)
                -- Water a fish could be in (`water_depth`): a spring or a pool here, or a corner under the sea or unread.
                or (p_kind = 'fish' and (wt.x is not null or wh.a is null or wh.b is null or wh.c is null or wh.d is null
                                         or least(wh.a, wh.b, wh.c, wh.d) < 0))), false) order by g.dy, g.dx)
    into v_out
    from g
    left join tile_def td on v_flag is not null and td.id = g.tile
    -- Each of these read once for the whole square.
    left join (select distinct k.work_x as x, k.work_y as y from creature k
                where k.world_id = p_world and k.mode = 'deed' and k.id <> p_id and k.phase in ('out', 'work')
                  and k.work_x between v_x0 and v_x1 and k.work_y between v_y0 and v_y1) cl
      on cl.x = g.gx and cl.y = g.gy
    left join (select f.x, f.y, f.kind from foraged f
                where v_fkind is not null and f.world_id = p_world
                  and f.x between v_x0 and v_x1 and f.y between v_y0 and v_y1
                  and f.kind in (v_fkind, case when p_kind = 'grass' then 'moss' end)
                  and now() - f.at < make_interval(secs => forage_wait(f.kind))) fo
      on fo.x = g.gx and fo.y = g.gy
     and fo.kind = case when p_kind = 'grass' and g.tile = tile_id('Moss') then 'moss' else v_fkind end
    left join (select distinct pl.x, pl.y from placed pl
                where p_kind = 'bush' and pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = vine_kind()
                  and pl.x between v_x0 and v_x1 and pl.y between v_y0 and v_y1) pv
      on pv.x = g.gx and pv.y = g.gy
    left join (select distinct pl.x, pl.y from placed pl
                where p_kind = 'hive' and pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = 'hive' and pl.crumbles_at is null
                  and pl.x between v_x0 and v_x1 and pl.y between v_y0 and v_y1) ph
      on ph.x = g.gx and ph.y = g.gy
    left join (select i.gx, i.gy, bool_or(i.def = 'corpse' or i.dmg >= 40) as waste from item i
                where p_kind in ('fetch', 'compost') and i.world_id = p_world and i.holder = 'ground'
                  and i.gx between v_x0 and v_x1 and i.gy between v_y0 and v_y1
                group by i.gx, i.gy) ig
      on ig.gx = g.gx and ig.gy = g.gy
    left join (select c.x, c.y from crop c
                where p_kind = 'farm' and c.world_id = p_world and c.x between v_x0 and v_x1 and c.y between v_y0 and v_y1) cr
      on cr.x = g.gx and cr.y = g.gy
    left join (select t.x, t.y from spring_tile t
                where p_kind = 'fish' and t.world_id = p_world and t.x between v_x0 and v_x1 and t.y between v_y0 and v_y1
               union
               select f.x, f.y from foundation f
                where p_kind = 'fish' and f.world_id = p_world and f.pool and f.x between v_x0 and v_x1 and f.y between v_y0 and v_y1) wt
      on wt.x = g.gx and wt.y = g.gy
    left join lateral (
      select case when g.gx >= 0 and (g.gx + 2) * 2 + 1 < length(c0.heights) then b_i16(c0.heights, g.gx) end as a,
             case when g.gx >= 0 and (g.gx + 2) * 2 + 1 < length(c0.heights) then b_i16(c0.heights, g.gx + 1) end as b,
             case when g.gx >= 0 and (g.gx + 2) * 2 + 1 < length(c1.heights) then b_i16(c1.heights, g.gx + 1) end as c,
             case when g.gx >= 0 and (g.gx + 2) * 2 + 1 < length(c1.heights) then b_i16(c1.heights, g.gx) end as d
        from (select 1) one left join lc c0 on c0.y = g.gy left join lc c1 on c1.y = g.gy + 1
       where p_kind = 'fish') wh on true;
  return v_out;
end $fn$;

/*
 * The first tile of its trade a worker finds, ring by ring outward from (`p_cx`, `p_cy`), each ring in a random order
 * of its own. Asked of `worker_gatherable` only where `private.work_tile_may` leaves it; a ring with nothing left in it
 * is passed over, its random draws made all the same.
 */
create or replace function public.find_work_tile(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_kind text, c creature)
 returns table(x integer, y integer)
 language plpgsql
 stable
as $function$
declare ring int; spot record; v_w int := 2 * p_range + 1; v_may boolean[]; v_has boolean[]; v_owed bigint := 0;
begin
  if p_range < 0 then return; end if;
  v_may := private.work_tile_may(p_world, p_cx, p_cy, p_range, p_kind, c.id);
  if v_may is not null then
    select array_agg(q.h order by q.r) into v_has from (
      select greatest(abs(dx), abs(dy)) as r, bool_or(v_may[(dy + p_range) * v_w + dx + p_range + 1]) as h
        from generate_series(-p_range, p_range) dy cross join generate_series(-p_range, p_range) dx group by 1) q;
  end if;
  for ring in 0..p_range loop
    if v_may is not null and not v_has[ring + 1] then
      -- The draws its order would have taken, owed until a ring is looked through or the search ends.
      v_owed := v_owed + case when ring = 0 then 1 else 8 * ring end;
      continue;
    end if;
    if v_owed > 0 then perform count(random()) from generate_series(1, v_owed); v_owed := 0; end if;
    for spot in
      select p_cx + dx as gx, p_cy + dy as gy
      from generate_series(-ring, ring) dx, generate_series(-ring, ring) dy
      where greatest(abs(dx), abs(dy)) = ring
      order by random()
    loop
      if (v_may is null or v_may[(spot.gy - p_cy + p_range) * v_w + spot.gx - p_cx + p_range + 1])
         and worker_gatherable(p_world, spot.gx, spot.gy, p_kind, c) then
        x := spot.gx; y := spot.gy;
        return next;
        return;
      end if;
    end loop;
  end loop;
  if v_owed > 0 then perform count(random()) from generate_series(1, v_owed); end if;
  return;
end $function$;

select private.lock_doors();
