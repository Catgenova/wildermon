-- A worker reaches every storey tile the player reaches, by the player's own step rule, and works what it reaches.
--
-- Reported: "my bastiondrakes keep getting caught on the same nonsensical idle error "no pathway to storey 4"
-- despite multiple fix attempts. I'm able to navigate my player to every spot of my estate." (`stairs`, storey 4:
-- "Idle: no stairs up to storey 4.")
--
-- Two rules decided where a worker goes a storey up, and neither was the player's:
--
--   * `storey_reached`, which work, stores, beds and crops a storey up count as in reach: a finished staircase on
--     every storey of the tile's own building, counted, not walked. A storey reached over a bridge from another
--     building (Solara Manor's east building, its flight to storey 4 only planned, its storey 4 reached over the
--     bridge from the west one), or from the building next door, was out of reach: the hod carrier said `stairs`,
--     storey 4, about work the player walks to. And a storey with a flight on each storey under it but no way between
--     them was in reach: it was given the work, its way there was not found, and it said `stairs` again every round.
--   * `creature_way`, the way it walks: its own step rule, patched a case at a time (the foot of a flight a storey up,
--     20261105020000; flights in a line, 20261120000013), never the player's. On a flight only at its foot and off
--     only at its head; the floors of the buildings at its two ends only; a bridge only from storey to the same
--     storey.
--
-- Now there is one search, and it is the player's step (`Game.step`), less what is spelled out for a beast:
--
--   * onto a flight from the storey under it across any side no wall stands on, up it; off it onto its own storey
--     across any side with a floor there; off it across its foot, or across a side with nothing on its own storey,
--     down to the storey under it (or the ground). A spiral staircase on its tile, as before;
--   * across the floors of any building, the building next door's too, through doors and gaps and not walls;
--   * a bridge's deck at the storey either of its ends lands on, onto it from an end and off it onto either end at
--     the storey that end lands on: storey to storey, a ramp between two storeys, and up a ramp from the ground;
--   * for a beast, as before and as the help says: no ladders, no gate bound in iron, no hidden door, no portcullis
--     let down, no hedge.
--
-- And a worker counts a tile a storey up as in reach where that search, from the ground, gets there
-- (`storey_reached`): the same search it then walks. A hod carrier asks it once for all the work round it
-- (`storey_reach`), not once a piece. A wall a storey up with no floor on either side at its storey is fitted from a
-- floor on the next tile along it (`hod_stand`). Of the ways onto a flight from the ground, its foot is tried first.
--
-- Deploy: the browser reads none of this; the card's `stairs` and `stranded` are as they were.

set local lock_timeout = '3s';

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

-- A bridge's deck and ends at the storey either end lands on: a ramp between two storeys at both, and one with an end
-- on the ground at the ground too (`Game.bridgeStepLevel`: walked at the storey it was come onto at). End a at the
-- bridge's `level`, end b at its `level_b`.
select pg_temp.patch_fn('public.storey_deck_cells(uuid)'::regprocedure,
  $o$     where b.world_id = p_world and b.level >= 1 and coalesce(b.level_b, b.level) = b.level
$o$,
  $n$     where b.world_id = p_world and greatest(b.level, coalesce(b.level_b, b.level)) >= 1
$n$);
select pg_temp.patch_fn('public.storey_deck_cells(uuid)'::regprocedure,
  $o$  select b.id, b.level, s.x + l.o * b.px, s.y + l.o * b.py, true
    from b cross join lateral bridge_lanes(b.width, b.side) l
    join bridge_span s on s.world_id = p_world and s.bridge = b.id
  union all
  select b.id, b.level, e.x + l.o * b.px, e.y + l.o * b.py, false
    from b cross join lateral bridge_lanes(b.width, b.side) l
    cross join lateral (values (b.ax, b.ay), (b.bx, b.by)) e(x, y)$o$,
  $n$  select b.id, v.lv, s.x + l.o * b.px, s.y + l.o * b.py, true
    from b cross join lateral bridge_lanes(b.width, b.side) l
    join bridge_span s on s.world_id = p_world and s.bridge = b.id
    cross join lateral (select distinct u.lv from unnest(array[b.level, coalesce(b.level_b, b.level)]) u(lv)) v
  union all
  select b.id, e.lv, e.x + l.o * b.px, e.y + l.o * b.py, false
    from b cross join lateral bridge_lanes(b.width, b.side) l
    cross join lateral (values (b.ax, b.ay, b.level), (b.bx, b.by, coalesce(b.level_b, b.level))) e(x, y, lv)$n$);

-- The search, both ways it is asked: a way from one tile and storey to another (`creature_way`), and with `p_box`
-- (x0, y0, x1, y1) every tile a storey up it reaches from the ground round the buildings there, as triples
-- (`storey_reach`).
create or replace function public.creature_search(p_world uuid, p_x0 integer, p_y0 integer, p_l0 integer, p_x1 integer, p_y1 integer, p_l1 integer,
                                                  p_box integer[] default null)
 returns integer[]
 language plpgsql
 stable
as $function$
declare
  v_b int[]; v_bn int[]; bx0 int; by0 int; bx1 int; by1 int; w int; h int; wh int; top int; n int; flood boolean := p_box is not null; sp boolean[];
  -- What a cell's floor slot holds: 0 nothing, 1 something to stand on, 2 a finished flight, 3 a finished spiral
  -- staircase, 4 a finished ladder, 5 anything else (a plan, or a roof nobody walks on), 6 a bridge's deck. And a
  -- flight's foot, the side it is climbed from, as a step `d` below: 1 east, 2 west, 3 south, 4 north.
  st int[]; ft int[]; bh boolean[]; bv boolean[]; par int[]; ex int[]; ey int[]; goal boolean[];
  q int[] := '{}'; qh int := 1; qn int := 0; k int; kn int; ko int; x int; y int; l int; nx int; ny int; d int; lv int; e int;
  dxs int[] := array[1, -1, 0, 0]; dys int[] := array[0, 0, 1, -1]; op int[] := array[2, 1, 4, 3];
  g_seen boolean := false; g_par int := 0; g_x int; g_y int; hit int := 0; v_out int[] := '{}';
  r record; fx int; fy int; blk boolean; ok boolean; to_ int; wl int;
  -- The bridges (`storey_deck_cells`), those in the search, and per cell: whose deck it is (`dk`), whose end (`en`),
  -- by place in `v_bs`.
  cb bigint[]; cl int[]; cx int[]; cy int[]; cd boolean[]; v_bs bigint[] := '{}'; v_more bigint[]; dk int[]; en int[];
begin
  if not flood and p_l0 <= 0 and p_l1 <= 0 then return '{}'; end if;
  select array_agg(distinct f.building) into v_b from floor_tile f
   where f.world_id = p_world and f.level >= 1
     and case when flood then f.x between p_box[1] and p_box[3] and f.y between p_box[2] and p_box[4]
              else (p_l0 > 0 and f.x = p_x0 and f.y = p_y0)
                   or (p_l1 > 0 and f.x between p_x1 - 1 and p_x1 + 1 and f.y between p_y1 - 1 and p_y1 + 1) end;
  v_b := coalesce(v_b, '{}');
  -- The bridges the way starts or ends on, or whose ends land on the floors of a building in it; and the buildings
  -- with a floor a storey up on or beside the box of those so far, the bridges' and the building next door's, walked
  -- from one onto the other as any floor (`Game.standable`: a floor, whoever's). Until no more.
  select coalesce(array_agg(c.bridge), '{}'), coalesce(array_agg(c.level), '{}'), coalesce(array_agg(c.x), '{}'),
         coalesce(array_agg(c.y), '{}'), coalesce(array_agg(c.deck), '{}')
    into cb, cl, cx, cy, cd from storey_deck_cells(p_world) c;
  for i in 1 .. 32 loop
    select coalesce(array_agg(distinct c.bridge), '{}') into v_more
      from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck)
     where not (c.bridge = any(v_bs))
       and ((c.deck and ((c.level = p_l0 and c.x = p_x0 and c.y = p_y0) or (c.level = p_l1 and c.x = p_x1 and c.y = p_y1)))
            or (not c.deck and exists (select 1 from floor_tile f where f.world_id = p_world and f.level = c.level
                                         and f.x = c.x and f.y = c.y and f.building = any(v_b))));
    v_bs := v_bs || v_more;
    select min(f.x), min(f.y), max(f.x), max(f.y) into bx0, by0, bx1, by1
      from floor_tile f where f.world_id = p_world and f.building = any(v_b) and f.level >= 1;
    select least(bx0, min(c.x)), least(by0, min(c.y)), greatest(bx1, max(c.x)), greatest(by1, max(c.y))
      into bx0, by0, bx1, by1 from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck) where c.bridge = any(v_bs);
    exit when bx0 is null;
    select coalesce(array_agg(distinct f.building), '{}') into v_bn from floor_tile f
     where f.world_id = p_world and f.level >= 1 and f.x between bx0 - 1 and bx1 + 1 and f.y between by0 - 1 and by1 + 1
       and not (f.building = any(v_b));
    exit when cardinality(v_more) = 0 and cardinality(v_bn) = 0;
    v_b := v_b || v_bn;
  end loop;
  if cardinality(v_b) = 0 and cardinality(v_bs) = 0 then return case when flood then '{}'::int[] end; end if;
  select min(f.x) - 1, min(f.y) - 1, max(f.x) + 1, max(f.y) + 1, max(f.level) into bx0, by0, bx1, by1, top
    from floor_tile f where f.world_id = p_world and f.building = any(v_b) and f.level >= 1;
  -- And over the decks between them.
  select least(bx0, min(c.x) - 1), least(by0, min(c.y) - 1), greatest(bx1, max(c.x) + 1), greatest(by1, max(c.y) + 1),
         greatest(top, max(c.level))
    into bx0, by0, bx1, by1, top from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck) where c.bridge = any(v_bs);
  if top is null then return null; end if;
  w := bx1 - bx0 + 1; h := by1 - by0 + 1; wh := w * h; n := (top + 1) * wh;
  if not flood and (p_l0 > top or p_l1 > top) then return null; end if;
  st := array_fill(0, array[n]); ft := array_fill(0, array[n]); par := array_fill(0, array[n]);
  ex := array_fill(0, array[n]); ey := array_fill(0, array[n]); dk := array_fill(0, array[n]); en := array_fill(0, array[n]);
  bh := array_fill(false, array[n]); bv := array_fill(false, array[n]); goal := array_fill(false, array[n]);
  sp := case when flood then array_fill(false, array[n]) end;

  for r in select f.level, f.x, f.y, f.kind, f.hand, f.facing, bill_done(f.needed) as done,
                  case when f.kind = 'roof' then coalesce((select rs.walkable from building b join roof_shape_def rs on rs.id = coalesce(b.roof, 'hip')
                                                            where b.world_id = p_world and b.id = f.building), false) end as deck
             from floor_tile f
            where f.world_id = p_world and f.level between 0 and top
              and f.x between bx0 and bx1 and f.y between by0 and by1 loop
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
  -- A bridge's deck where no floor is: stood on at the storey either end lands on (`frame_stands`). Its ends are its
  -- floors' tiles, or the ground's; an end a storey up with no floor is stood on all the same.
  for r in select c.* from unnest(cb, cl, cx, cy, cd) c(bridge, level, x, y, deck)
            where c.bridge = any(v_bs) and c.level <= top and c.x between bx0 and bx1 and c.y between by0 and by1 loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if not r.deck then
      en[k] := array_position(v_bs, r.bridge);
      if r.level >= 1 and st[k] = 0 then st[k] := 1; end if;
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
  -- And the borders a hedge stands along, on the ground, as a fence's (`hedge_between`, `garden.ts`).
  for r in select 0 as level, bd.dir, bd.x, bd.y from placed pl join furniture_def f on f.id = pl.sub and f.hedge
             cross join lateral border_of(pl.x, pl.y, pl.facing) bd
            where pl.world_id = p_world and pl.kind = 'furniture' and coalesce(pl.level, 0) = 0
              and bd.x between bx0 and bx1 and bd.y between by0 and by1 loop
    k := (r.level * h + (r.y - by0)) * w + (r.x - bx0) + 1;
    if r.dir = 'h' then bh[k] := true; else bv[k] := true; end if;
  end loop;

  -- Where it is going: the tile, if there is something to stand on there, and otherwise those beside it there are.
  if not flood and p_l1 > 0 then
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

  if not flood and p_l0 > 0 then
    if p_x0 < bx0 or p_x0 > bx1 or p_y0 < by0 or p_y0 > by1 then return null; end if;
    k := (p_l0 * h + (p_y0 - by0)) * w + (p_x0 - bx0) + 1;
    if goal[k] then return '{}'; end if;
    par[k] := -1;
    qn := 1; q[1] := k;
  end if;

  <<search>>
  loop
    -- The ground, where it starts or once it is down: up every flight of storey 2 from any side of it no wall stands
    -- on (`Game.step`), a spiral staircase from its own tile, and onto a bridge's deck from its end on the ground.
    if not g_seen and (flood or p_l0 <= 0 or g_par <> 0) then
      g_seen := true;
      if g_par <> 0 and p_l1 <= 0 then exit search; end if;
      for y in by0..by1 loop
        for x in bx0..bx1 loop
          k := (h + (y - by0)) * w + (x - bx0) + 1;
          continue when par[k] <> 0 or st[k] not in (2, 3) or top < 1;
          for e in 0..3 loop
            -- A spiral staircase from its own tile; a flight from a tile beside it, its foot first.
            exit when st[k] = 3 and e > 0;
            d := (ft[k] - 1 + e) % 4 + 1;
            fx := x + case when st[k] = 2 then dxs[d] else 0 end;
            fy := y + case when st[k] = 2 then dys[d] else 0 end;
            continue when fx < bx0 or fx > bx1 or fy < by0 or fy > by1;
            kn := (fy - by0) * w + (fx - bx0) + 1;
            continue when st[k] = 2 and case d when 1 then bv[kn] when 2 then bv[k - wh] when 3 then bh[kn] else bh[k - wh] end;
            continue when st[kn] in (2, 4) or (st[k] = 2 and st[kn + wh] in (2, 3, 4)) or not creature_tile_ok(p_world, fx, fy);
            ex[k] := fx; ey[k] := fy; par[k] := -2; qn := qn + 1; q[qn] := k;
            if goal[k] then hit := k; exit search; end if;
            exit;
          end loop;
        end loop;
      end loop;
      for y in by0..by1 loop
        for x in bx0..bx1 loop
          k := (y - by0) * w + (x - bx0) + 1;
          continue when en[k] = 0 or not creature_tile_ok(p_world, x, y);
          for d in 1..4 loop
            nx := x + dxs[d]; ny := y + dys[d];
            continue when nx < bx0 or nx > bx1 or ny < by0 or ny > by1;
            kn := (ny - by0) * w + (nx - bx0) + 1;
            continue when st[kn] <> 6 or dk[kn] <> en[k] or par[kn] <> 0
                       or case d when 1 then bv[kn] when 2 then bv[k] when 3 then bh[kn] else bh[k] end;
            ex[kn] := x; ey[kn] := y; par[kn] := -2; qn := qn + 1; q[qn] := kn;
            if goal[kn] then hit := kn; exit search; end if;
          end loop;
        end loop;
      end loop;
    end if;
    exit search when qh > qn;
    k := q[qh]; qh := qh + 1;
    l := (k - 1) / wh; x := bx0 + (k - 1) % w; y := by0 + ((k - 1) / w) % h;
    -- Round a spiral staircase, up it from its foot and down it from its head (`Game.liftRule`).
    if l >= 1 and l + 1 <= top and st[k + wh] = 3 and par[k + wh] = 0 then
      par[k + wh] := k; qn := qn + 1; q[qn] := k + wh;
      if goal[k + wh] then hit := k + wh; exit search; end if;
    end if;
    if st[k] = 3 and l >= 1 then
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
      -- Where the step lands (`to_`) and at what storey (`lv`); the walls asked at the storey it lands on, or up a
      -- flight at the storey it is climbed from (`wl`).
      to_ := 0; lv := l; wl := null;
      if st[k] = 6 then
        -- On a bridge's deck (`Game.bridgeStepLevel`): along it; off it onto either of its ends, at the storey that end
        -- lands on; off its side onto a floor of the storey it is walked at.
        if st[kn] = 6 and dk[kn] = dk[k] then
          to_ := kn;
        else
          for e in 0..top loop
            ko := kn + (e - l) * wh;
            if en[ko] = dk[k] then to_ := ko; lv := e; exit; end if;
          end loop;
          if to_ = 0 and (st[kn] in (1, 2, 3) or l = 0) then to_ := kn; end if;
        end if;
      elsif st[kn] = 6 then
        -- Onto a deck, from one of its ends at the storey it is walked at.
        if en[k] = dk[kn] then to_ := kn; end if;
      elsif l + 1 <= top and (st[kn + wh] in (2, 4) or (st[kn + wh] = 3 and st[kn] not in (1, 2, 3))) then
        -- Onto the tile of a flight up from this storey, from any side: up it. A ladder: no (`stairs`, the help).
        -- Where it is going, the tile at the foot of a flight up (a wall on its side is fitted from there,
        -- `hod_stand`): it stops there rather than going on up.
        if st[kn + wh] <> 4 then
          if goal[kn] and par[kn] = 0 then to_ := kn; else to_ := kn + wh; lv := l + 1; wl := l; end if;
        end if;
      elsif l >= 1 and st[k] = 2 and d = ft[k] then
        -- Off a flight across its foot: down onto the storey under it, or the ground.
        to_ := kn - wh; lv := l - 1;
      elsif st[kn] in (1, 2, 3) then
        -- Onto a floor of this storey, or a flight's tile at it, from any side (`Game.standable`).
        to_ := kn;
      elsif l >= 1 and st[k] = 2 then
        -- Off a flight's side with nothing there on its storey: down onto the storey under it, or the ground.
        to_ := kn - wh; lv := l - 1;
      end if;
      continue when to_ = 0;
      wl := coalesce(wl, lv);
      ko := k + (wl - l) * wh; kn := (wl * h + (ny - by0)) * w + (nx - bx0) + 1;
      continue when case d when 1 then bv[kn] when 2 then bv[ko] when 3 then bh[kn] else bh[ko] end;
      -- Every tile it reaches, and the tile at the foot of a flight up it stops on where it is going (above).
      if flood and lv = l + 1 and wl = l and st[to_ - wh] in (1, 3) then sp[to_ - wh] := true; end if;
      if lv = 0 and st[to_] <> 6 then
        -- Down on the ground.
        if not g_seen and g_par = 0 and st[to_] not in (2, 4) and creature_tile_ok(p_world, nx, ny) then
          g_par := k; g_x := nx; g_y := ny;
        end if;
        continue;
      end if;
      continue when lv < l and st[to_] not in (1, 2, 3, 6);
      continue when par[to_] <> 0;
      par[to_] := k; qn := qn + 1; q[qn] := to_;
      if goal[to_] then hit := to_; exit search; end if;
    end loop;
  end loop;

  if flood then
    for k in wh + 1 .. n loop
      continue when not (sp[k] or (par[k] <> 0 and st[k] in (1, 2, 3, 6)));
      qn := cardinality(v_out);
      v_out[qn + 1] := bx0 + (k - 1) % w; v_out[qn + 2] := by0 + ((k - 1) / w) % h; v_out[qn + 3] := (k - 1) / wh;
    end loop;
    return v_out;
  end if;
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
end $function$;

-- A way from one tile and storey to another, as a beast walks it: triples from the first step to the last, empty for
-- none needed, null for no way.
create or replace function public.creature_way(p_world uuid, p_x0 integer, p_y0 integer, p_l0 integer, p_x1 integer, p_y1 integer, p_l1 integer)
 returns integer[]
 language sql
 stable
as $function$
  select creature_search(p_world, p_x0, p_y0, p_l0, p_x1, p_y1, p_l1, null)
$function$;

-- Every tile a storey up a worker reaches from the ground round a box, keyed 'x,y,storey' (`creature_search` with a
-- box): asked once for all the work a hod carrier has in reach rather than once for each piece (`hod_reached`).
create or replace function public.storey_reach(p_world uuid, p_x0 integer, p_y0 integer, p_x1 integer, p_y1 integer)
 returns jsonb
 language plpgsql
 stable
as $function$
declare c int[] := creature_search(p_world, 0, 0, 0, null, null, null, array[p_x0, p_y0, p_x1, p_y1]); v jsonb;
begin
  select coalesce(jsonb_object_agg(c[i] || ',' || c[i + 1] || ',' || c[i + 2], true), '{}') into v
    from generate_series(1, coalesce(cardinality(c), 0), 3) i;
  return v;
end $function$;

-- In reach a storey up: where the worker's own way from the ground gets to (`creature_way`), not a count of the
-- finished staircases in the tile's building.
create or replace function public.storey_reached(p_world uuid, p_x integer, p_y integer, p_level integer)
 returns boolean
 language plpgsql
 stable
as $function$
begin
  return (
select case when p_level <= 0 then true else creature_way(p_world, p_x, p_y, 0, p_x, p_y, p_level) is not null end
  );
end $function$;

-- A hod carrier's work a storey up: in reach where it stands for it on a tile its way from the ground reaches, the reach
-- found once for all the work round it (`storey_reach`), not once a piece.
create or replace function public.hod_reached(p_world uuid, p_kind text, p_level integer, p_dir text, p_x integer, p_y integer, p_reach jsonb)
 returns boolean
 language plpgsql
 stable
as $function$
declare s record;
begin
  if p_level <= 0 or p_kind in ('span', 'foundation') then return true; end if;
  if p_kind <> 'wall' and p_kind <> 'column' and p_level = 1 then return true; end if;
  select * into s from hod_stand(p_world, p_kind, p_level, p_dir, p_x, p_y);
  return s.l is not null and (s.l <= 0 or coalesce(p_reach ? (s.x || ',' || s.y || ',' || s.l), false));
end $function$;

select pg_temp.patch_fn('public.hod_needing(uuid,int,int,int,text,uuid)'::regprocedure, $o$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$o$, $n$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y,
                    (select storey_reach(p_world, p_cx - p_range - 1, p_cy - p_range - 1, p_cx + p_range + 1, p_cy + p_range + 1)))$n$);
select pg_temp.patch_fn('public.hod_needing(uuid,int,int,int,text,uuid,creature)'::regprocedure, $o$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$o$, $n$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y,
                    (select storey_reach(p_world, p_cx - p_range - 1, p_cy - p_range - 1, p_cx + p_range + 1, p_cy + p_range + 1)))$n$);
select pg_temp.patch_fn('public.hod_needing_stocked(uuid,uuid,int,int,int)'::regprocedure, $o$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$o$, $n$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y,
                    (select storey_reach(p_world, p_cx - p_range - 1, p_cy - p_range - 1, p_cx + p_range + 1, p_cy + p_range + 1)))$n$);
select pg_temp.patch_fn('public.hod_needing_stocked(uuid,uuid,int,int,int,creature)'::regprocedure, $o$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$o$, $n$and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y,
                    (select storey_reach(p_world, p_cx - p_range - 1, p_cy - p_range - 1, p_cx + p_range + 1, p_cy + p_range + 1)))$n$);
select pg_temp.patch_fn('public.hod_unreached(uuid,uuid,int,int,int)'::regprocedure,
  $o$not hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$o$,
  $n$not hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y,
                       (select storey_reach(p_world, p_cx - p_range - 1, p_cy - p_range - 1, p_cx + p_range + 1, p_cy + p_range + 1)))$n$);

-- A wall a storey up with no floor on either side of it at its storey (over a stairwell, an open well, a flight only
-- planned): fitted from a floor a tile along it, on either side, where there is one (`hod_stand`), rather than out of
-- reach and said to want a staircase.
select pg_temp.patch_fn('public.hod_stand(uuid,text,int,text,int,int)'::regprocedure,
  $o$    if frame_stands(p_world, x, y, p_level) then l := p_level; return next; end if;
    return;$o$,
  $n$    if frame_stands(p_world, x, y, p_level) then l := p_level; return next; return; end if;
    for d in 1..4 loop
      x := p_x + case when p_dir = 'h' then (array[-1, 1, -1, 1])[d] else (array[0, 0, -1, -1])[d] end;
      y := p_y + case when p_dir = 'h' then (array[0, 0, -1, -1])[d] else (array[-1, 1, -1, 1])[d] end;
      if frame_stands(p_world, x, y, p_level) then l := p_level; return next; return; end if;
    end loop;
    return;$n$);

select private.lock_doors();
