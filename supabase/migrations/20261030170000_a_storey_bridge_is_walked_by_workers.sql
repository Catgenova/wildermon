-- A bridge's deck up a storey is one storey with the floors its ends land on, for a worker's way too.
--
-- Reported, on Solara Manor's storey-4 bridge: "despite the completed bridge, going from one red spot to another paths
-- down the floor and back up". Up a storey a body stands on a bridge's deck, every lane of it, at the storey its ends
-- land on (`frame_stands`), and a walk on foot goes onto it from its end and off it onto its other end
-- (`Game.bridgeStepLevel`). Two ways round it did not know that:
--
--   * a rider's (`Game.rideRule`): up a storey a mount went on the building's own floors and nothing else, so from one
--     storey-4 floor to the other it rode down the wide staircases, across the ground and up again. The island lets a
--     rider along a deck at its storey as anybody (`frame_footing`); the browser now rides it too, where a cart crosses
--     the bridge (any but a rope bridge).
--   * a worker's (`creature_way`): its way was over the floors of the buildings at its two ends and their staircases,
--     so it went down and back up as well. Now a finished bridge whose two ends land on the same storey, a storey up,
--     is part of the storey: its deck, every lane, is stood on (`6` below); a beast goes onto it from one of its ends
--     or along it, and off it onto one of its ends only, as feet do; and the buildings its far ends land on are part
--     of the search, and theirs in turn. A ramp, its two ends on two storeys, is not.
--
-- And a wall on the border between a bridge's end and the floor beside it is planned as any wall of the storey is
-- (`plan_wall`, from the building's tile): nothing refused it on the island. It is the player's to plan across a
-- bridge's end, which it blocks once built, as any wall does.

set local lock_timeout = '3s';

/*
 * The tiles of every finished, lowered bridge a storey up whose two ends land on the same storey, an aqueduct's
 * never: each tile of its deck, every lane (`deck`), and each lane's two end tiles (`not deck`), at that storey.
 */
create or replace function storey_deck_cells(p_world uuid)
returns table (bridge bigint, level int, x int, y int, deck boolean) language sql stable as $$
  with b as (
    select b.*, case when b.ay = b.by and b.ax <> b.bx then 0 else 1 end as px,
                case when b.ay = b.by and b.ax <> b.bx then 1 else 0 end as py
      from bridge b
     where b.world_id = p_world and b.level >= 1 and coalesce(b.level_b, b.level) = b.level
       and not b.raised and b.kind <> 'aqueduct'
       and not exists (select 1 from bridge_span s where s.world_id = p_world and s.bridge = b.id and not bill_done(s.needed))
  )
  select b.id, b.level, s.x + l.o * b.px, s.y + l.o * b.py, true
    from b cross join lateral bridge_lanes(b.width, b.side) l
    join bridge_span s on s.world_id = p_world and s.bridge = b.id
  union all
  select b.id, b.level, e.x + l.o * b.px, e.y + l.o * b.py, false
    from b cross join lateral bridge_lanes(b.width, b.side) l
    cross join lateral (values (b.ax, b.ay), (b.bx, b.by)) e(x, y)
$$;

/*
 * The way a beast walks from a tile at a storey to a tile at another, over a building's floors and up and down its
 * staircases, as the triples `x, y, storey` of the tiles it steps onto after the first, the last the tile it is going
 * to or one beside it; or null where there is none. A flight, wide or single, is taken as a mount takes a wide one
 * (`Game.wideFlightUp`, `driveStorey`): onto it from its foot, the side it is climbed from (`facing`), off it at its
 * head onto the storey it goes up to, and back down off its foot; never over its rails. A spiral staircase is
 * climbed on its own tile (`Game.liftRule`); a ladder not at all. A bridge's deck a storey up is that storey's
 * (`storey_deck_cells`): onto it from an end, along it, off it onto an end (`Game.bridgeStepLevel`). The ground is
 * one place: the foot of a flight is walked to straight, from wherever on it a beast is, as every leg on the ground
 * is. A breadth-first search over the tiles of the buildings at the two ends and the bridges between them, a storey
 * at a time, a few hundred cells for a house: no table is written.
 */
create or replace function creature_way(p_world uuid, p_x0 int, p_y0 int, p_l0 int, p_x1 int, p_y1 int, p_l1 int)
returns int[] language plpgsql stable as $$
declare
  v_b int[]; bx0 int; by0 int; bx1 int; by1 int; w int; h int; wh int; top int; n int;
  -- What a cell's floor slot holds: 0 nothing, 1 something to stand on, 2 a finished flight, 3 a finished spiral
  -- staircase, 4 a finished ladder, 5 anything else (a plan, or a roof nobody walks on), 6 a bridge's deck. And a
  -- flight's foot, the side it is climbed from, as a step `d` below: 1 east, 2 west, 3 south, 4 north.
  st int[]; ft int[]; bh boolean[]; bv boolean[]; par int[]; ex int[]; ey int[]; goal boolean[];
  q int[] := '{}'; qh int := 1; qn int := 0; k int; kn int; x int; y int; l int; nx int; ny int; d int;
  dxs int[] := array[1, -1, 0, 0]; dys int[] := array[0, 0, 1, -1]; op int[] := array[2, 1, 4, 3];
  g_seen boolean := false; g_par int := 0; g_x int; g_y int; hit int := 0; v_out int[] := '{}';
  r record; fx int; fy int; blk boolean; ok boolean;
  -- The bridges a storey up (`storey_deck_cells`), those in the search, and per cell: whose deck it is (`dk`), whose
  -- end (`en`), by place in `v_bs`.
  cb bigint[]; cl int[]; cx int[]; cy int[]; cd boolean[]; v_bs bigint[] := '{}'; v_more bigint[]; dk int[]; en int[];
begin
  if p_l0 <= 0 and p_l1 <= 0 then return '{}'; end if;
  select array_agg(distinct f.building) into v_b from floor_tile f
   where f.world_id = p_world and f.level >= 1
     and ((p_l0 > 0 and f.x = p_x0 and f.y = p_y0)
          or (p_l1 > 0 and f.x between p_x1 - 1 and p_x1 + 1 and f.y between p_y1 - 1 and p_y1 + 1));
  -- The bridges a storey up the way starts or ends on, or whose ends land on the floors of a building in it, and the
  -- buildings at their ends in turn.
  select coalesce(array_agg(c.bridge), '{}'), coalesce(array_agg(c.level), '{}'), coalesce(array_agg(c.x), '{}'),
         coalesce(array_agg(c.y), '{}'), coalesce(array_agg(c.deck), '{}')
    into cb, cl, cx, cy, cd from storey_deck_cells(p_world) c;
  for i in 1 .. 8 loop
    exit when cardinality(cb) = 0;
    select coalesce(array_agg(distinct c.bridge), '{}') into v_more
      from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck)
     where not (c.bridge = any(v_bs))
       and ((c.deck and ((c.level = p_l0 and c.x = p_x0 and c.y = p_y0) or (c.level = p_l1 and c.x = p_x1 and c.y = p_y1)))
            or (not c.deck and exists (select 1 from floor_tile f where f.world_id = p_world and f.level = c.level
                                         and f.x = c.x and f.y = c.y and f.building = any(coalesce(v_b, '{}')))));
    exit when cardinality(v_more) = 0;
    v_bs := v_bs || v_more;
    select array_agg(distinct s.b) into v_b from (
      select unnest(coalesce(v_b, '{}')) as b
      union
      select f.building from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck)
        join floor_tile f on f.world_id = p_world and f.level = c.level and f.x = c.x and f.y = c.y
       where c.bridge = any(v_more) and not c.deck) s;
  end loop;
  if v_b is null then return null; end if;
  select min(f.x) - 1, min(f.y) - 1, max(f.x) + 1, max(f.y) + 1, max(f.level) into bx0, by0, bx1, by1, top
    from floor_tile f where f.world_id = p_world and f.building = any(v_b) and f.level >= 1;
  -- And over the decks between them.
  select least(bx0, min(c.x) - 1), least(by0, min(c.y) - 1), greatest(bx1, max(c.x) + 1), greatest(by1, max(c.y) + 1)
    into bx0, by0, bx1, by1 from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck) where c.bridge = any(v_bs);
  w := bx1 - bx0 + 1; h := by1 - by0 + 1; wh := w * h; n := (top + 1) * wh;
  if p_l0 > top or p_l1 > top then return null; end if;
  st := array_fill(0, array[n]); ft := array_fill(0, array[n]); par := array_fill(0, array[n]);
  ex := array_fill(0, array[n]); ey := array_fill(0, array[n]); dk := array_fill(0, array[n]); en := array_fill(0, array[n]);
  bh := array_fill(false, array[n]); bv := array_fill(false, array[n]); goal := array_fill(false, array[n]);

  for r in select f.level, f.x, f.y, f.kind, f.hand, f.facing, bill_done(f.needed) as done,
                  case when f.kind = 'roof' then coalesce((select rs.walkable from building b join roof_shape_def rs on rs.id = coalesce(b.roof, 'hip')
                                                            where b.world_id = p_world and b.id = f.building), false) end as deck
             from floor_tile f
            where f.world_id = p_world and f.building = any(v_b) and f.level between 0 and top loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    st[k] := case
      when not r.done then 5
      when r.kind = 'stairs' and r.hand = 's' then 3
      when r.kind = 'stairs' then 2
      when r.kind = 'ladder' then 4
      when r.kind = 'roof' and not r.deck then 5
      else 1 end;
    ft[k] := case coalesce(r.facing, 's') when 'e' then 1 when 'w' then 2 when 's' then 3 else 4 end;
  end loop;
  -- A bridge's deck a storey up, where no floor is: stood on at its storey (`frame_stands`). Its ends are its floors' tiles.
  for r in select c.* from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck) where c.bridge = any(v_bs) and c.level <= top loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if not r.deck then en[k] := array_position(v_bs, r.bridge);
    elsif st[k] = 0 then st[k] := 6; dk[k] := array_position(v_bs, r.bridge);
    end if;
  end loop;
  -- The walls a beast does not go through (`blocksAt` with `beast`): `h` on a tile's north side, `v` on its west.
  for r in select wl.level, wl.dir, wl.x, wl.y from wall wl left join wall_type_def t on t.id = wl.type
            where wl.world_id = p_world and wl.level between 0 and top
              and wl.x between bx0 and bx1 and wl.y between by0 and by1 and bill_done(wl.needed)
              and (wl.type = 'hidden_door' or not coalesce(t.passable, false) or coalesce(t.beast_proof, false) or wl.lowered) loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if r.dir = 'h' then bh[k] := true; else bv[k] := true; end if;
  end loop;

  -- Where it is going: the tile, if there is something to stand on there, and otherwise those beside it there are.
  if p_l1 > 0 then
    if p_x1 < bx0 or p_x1 > bx1 or p_y1 < by0 or p_y1 > by1 then return null; end if;
    k := (p_l1 * h + (p_y1 - by0)) * w + (p_x1 - bx0) + 1;
    if st[k] in (1, 2, 3, 6) then
      goal[k] := true;
    else
      for d in 1..4 loop
        nx := p_x1 + dxs[d]; ny := p_y1 + dys[d];
        continue when nx < bx0 or nx > bx1 or ny < by0 or ny > by1;
        kn := (p_l1 * h + (ny - by0)) * w + (nx - bx0) + 1;
        blk := case d when 1 then bv[kn] when 2 then bv[k] when 3 then bh[kn] else bh[k] end;
        if st[kn] in (1, 3) and not blk then goal[kn] := true; ok := true; end if;
      end loop;
      if not coalesce(ok, false) then return null; end if;
    end if;
  end if;

  if p_l0 > 0 then
    if p_x0 < bx0 or p_x0 > bx1 or p_y0 < by0 or p_y0 > by1 then return null; end if;
    k := (p_l0 * h + (p_y0 - by0)) * w + (p_x0 - bx0) + 1;
    if goal[k] then return '{}'; end if;
    par[k] := -1;
    qn := 1; q[1] := k;
  end if;

  <<search>>
  loop
    -- The ground, where it starts or once it is down off a flight: on up every flight of storey 2 from its foot.
    if not g_seen and (p_l0 <= 0 or g_par <> 0) then
      g_seen := true;
      if g_par <> 0 and p_l1 <= 0 then exit search; end if;
      for y in by0..by1 loop
        for x in bx0..bx1 loop
          k := (h + (y - by0)) * w + (x - bx0) + 1;
          continue when par[k] <> 0 or st[k] not in (2, 3);
          -- A spiral staircase from its own tile; a flight from its foot.
          fx := x + case when st[k] = 2 then dxs[ft[k]] else 0 end;
          fy := y + case when st[k] = 2 then dys[ft[k]] else 0 end;
          continue when fx < bx0 or fx > bx1 or fy < by0 or fy > by1;
          kn := (fy - by0) * w + (fx - bx0) + 1;
          continue when st[k] = 2 and case ft[k] when 1 then bv[kn] when 2 then bv[k - wh] when 3 then bh[kn] else bh[k - wh] end;
          continue when st[kn] in (2, 4) or (st[k] = 2 and st[kn + wh] in (2, 3, 4)) or not creature_tile_ok(p_world, fx, fy);
          ex[k] := fx; ey[k] := fy; par[k] := -2; qn := qn + 1; q[qn] := k;
          if goal[k] then hit := k; exit search; end if;
        end loop;
      end loop;
    end if;
    exit search when qh > qn;
    k := q[qh]; qh := qh + 1;
    l := (k - 1) / wh; x := bx0 + (k - 1) % w; y := by0 + ((k - 1) / w) % h;
    -- Round a spiral staircase, up it from its foot and down it from its head (`Game.liftRule`).
    if l + 1 <= top and st[k + wh] = 3 and par[k + wh] = 0 then
      par[k + wh] := k; qn := qn + 1; q[qn] := k + wh;
      if goal[k + wh] then hit := k + wh; exit search; end if;
    end if;
    if st[k] = 3 then
      if l = 1 then
        if not g_seen and g_par = 0 and st[k - wh] not in (2, 4) and creature_tile_ok(p_world, x, y) then g_par := k; g_x := x; g_y := y; end if;
      elsif st[k - wh] in (1, 2, 3) and par[k - wh] = 0 then
        par[k - wh] := k; qn := qn + 1; q[qn] := k - wh;
        if goal[k - wh] then hit := k - wh; exit search; end if;
      end if;
    end if;
    for d in 1..4 loop
      nx := x + dxs[d]; ny := y + dys[d];
      continue when nx < bx0 or nx > bx1 or ny < by0 or ny > by1;
      kn := (l * h + (ny - by0)) * w + (nx - bx0) + 1;
      if st[k] = 2 and d = ft[k] then
        -- On a flight, off its foot: down onto the storey under it.
        continue when case d when 1 then bv[kn - wh] when 2 then bv[k - wh] when 3 then bh[kn - wh] else bh[k - wh] end;
        if l = 1 then
          if not g_seen and g_par = 0 and st[kn - wh] not in (2, 4) and creature_tile_ok(p_world, nx, ny) then
            g_par := k; g_x := nx; g_y := ny;
          end if;
        elsif st[kn - wh] in (1, 3) and par[kn - wh] = 0 then
          par[kn - wh] := k; qn := qn + 1; q[qn] := kn - wh;
          if goal[kn - wh] then hit := kn - wh; exit search; end if;
        end if;
        continue;
      end if;
      -- Its rails: off a flight only at its head or its foot.
      continue when st[k] = 2 and d <> op[ft[k]];
      continue when case d when 1 then bv[kn] when 2 then bv[k] when 3 then bh[kn] else bh[k] end;
      -- A bridge's deck: onto it from one of its ends or along it, off it onto one of its ends (`Game.bridgeStepLevel`).
      continue when (st[kn] = 6 and dk[kn] <> dk[k] and en[k] <> dk[kn]) or (st[k] = 6 and st[kn] <> 6 and en[kn] <> dk[k]);
      if l + 1 <= top and st[kn + wh] in (2, 4) then
        -- Onto a flight going up from this storey, from its foot: up it. A ladder: no.
        if st[kn + wh] = 2 and ft[kn + wh] = op[d] and par[kn + wh] = 0 then
          par[kn + wh] := k; qn := qn + 1; q[qn] := kn + wh;
          if goal[kn + wh] then hit := kn + wh; exit search; end if;
        end if;
      elsif st[kn] = 2 then
        -- Onto the head of a flight up to this storey, from the storey's side: on its way down.
        if ft[kn] = d and par[kn] = 0 then
          par[kn] := k; qn := qn + 1; q[qn] := kn;
          if goal[kn] then hit := kn; exit search; end if;
        end if;
      elsif st[kn] in (1, 3, 6) and par[kn] = 0 then
        par[kn] := k; qn := qn + 1; q[qn] := kn;
        if goal[kn] then hit := kn; exit search; end if;
      end if;
    end loop;
  end loop;

  if hit = 0 and not (p_l1 <= 0 and g_par <> 0) then return null; end if;
  -- Back from where it got to, to where it started.
  if hit = 0 then
    v_out := array[g_x, g_y, 0];
    k := g_par;
  else
    k := hit;
  end if;
  loop
    exit when par[k] = -1;
    v_out := array[bx0 + (k - 1) % w, by0 + ((k - 1) / w) % h, (k - 1) / wh] || v_out;
    if par[k] = -2 then
      v_out := array[ex[k], ey[k], 0] || v_out;
      exit when p_l0 <= 0;
      v_out := array[g_x, g_y, 0] || v_out;
      k := g_par;
    else
      k := par[k];
    end if;
  end loop;
  return v_out;
end $$;

select private.lock_doors();
