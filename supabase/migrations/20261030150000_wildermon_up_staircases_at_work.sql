-- Settlement workers walk up a building's staircases to work a storey up, and back down.
--
-- Asked: "allow wildermon to move up storeys when working along stairs". A worker's store, station or planned work a
-- storey up was walked to on the ground under it, and worked from there. Now a worker has a storey of its own
-- (`creature.storey`, the storey at the end of the leg it is on; `storey_from`, at its start) and a way
-- (`creature.way`, the legs still to walk, each `[x, y, storey, seconds]`), and a leg to or from a storey goes by the
-- building's stairs (`creature_way`):
--
--   * a finished flight, wide or single, as a mount takes a wide one (`Game.wideFlightUp`, `driveStorey`): onto it
--     from its foot, off it at its head, down off its foot again, never over its rails; a spiral staircase round its
--     own tile, as a person climbs one (`Game.liftRule`); never a ladder: a beast does not climb one;
--   * across a storey only on what a person stands on there (`frame_stands`), and through a wall only where a
--     person's beast goes through (`blocksAt` with `beast`: no solid wall, no hidden door, no iron-bound gate, no
--     portcullis let down): through a doorway, an arch or a gap;
--   * and on the ground as it always has: straight to the foot of the flight.
--
-- Which storey a leg goes to: a hod carrier's from its work (`hod_stand`: a wall on its own storey, beside it; a
-- floor, staircase, ladder or roof from the storey under it), and any other's from the store or piece of furniture it
-- walks to, the lowest on that tile (`worker_spot_storey`). A store a storey up with no staircase to it is not one a
-- worker puts into or takes from (`storey_reached`); planned work with none is not work a hod carrier takes; and a
-- leg with no way at all is no leg: it stands and says why (`stairs`, the storey it cannot reach). A worker with no
-- way down from where it stands, its stairs taken away under it, is let down where it stands; one whose floor goes
-- from under it is let down to what is under that (`storey_footing`); and one let off the settlement comes down with
-- it. The browser walks the way it is sent (`walkLegs`) and draws it at its storey, up a flight a share at a time
-- (`Game.creatureLift`).

set local lock_timeout = '3s';

alter table creature add column if not exists storey int not null default 0;
alter table creature add column if not exists storey_from int not null default 0;
alter table creature add column if not exists way jsonb;
create index if not exists creature_upstairs on creature (world_id) where storey > 0 or storey_from > 0;

/*
 * The way a beast walks from a tile at a storey to a tile at another, over a building's floors and up and down its
 * staircases, as the triples `x, y, storey` of the tiles it steps onto after the first, the last the tile it is going
 * to or one beside it; or null where there is none. A flight, wide or single, is taken as a mount takes a wide one
 * (`Game.wideFlightUp`, `driveStorey`): onto it from its foot, the side it is climbed from (`facing`), off it at its
 * head onto the storey it goes up to, and back down off its foot; never over its rails. A spiral staircase is
 * climbed on its own tile (`Game.liftRule`); a ladder not at all. The ground is one place: the foot of a flight is
 * walked to straight, from wherever on it a beast is, as every leg on the ground is. A breadth-first search over the
 * tiles of the buildings at the two ends, a storey at a time, a few hundred cells for a house: no table is written.
 */
create or replace function creature_way(p_world uuid, p_x0 int, p_y0 int, p_l0 int, p_x1 int, p_y1 int, p_l1 int)
returns int[] language plpgsql stable as $$
declare
  v_b int[]; bx0 int; by0 int; bx1 int; by1 int; w int; h int; wh int; top int; n int;
  -- What a cell's floor slot holds: 0 nothing, 1 something to stand on, 2 a finished flight, 3 a finished spiral
  -- staircase, 4 a finished ladder, 5 anything else (a plan, or a roof nobody walks on). And a flight's foot, the
  -- side it is climbed from, as a step `d` below: 1 east, 2 west, 3 south, 4 north.
  st int[]; ft int[]; bh boolean[]; bv boolean[]; par int[]; ex int[]; ey int[]; goal boolean[];
  q int[] := '{}'; qh int := 1; qn int := 0; k int; kn int; x int; y int; l int; nx int; ny int; d int;
  dxs int[] := array[1, -1, 0, 0]; dys int[] := array[0, 0, 1, -1]; op int[] := array[2, 1, 4, 3];
  g_seen boolean := false; g_par int := 0; g_x int; g_y int; hit int := 0; v_out int[] := '{}';
  r record; fx int; fy int; blk boolean; ok boolean;
begin
  if p_l0 <= 0 and p_l1 <= 0 then return '{}'; end if;
  select array_agg(distinct f.building) into v_b from floor_tile f
   where f.world_id = p_world and f.level >= 1
     and ((p_l0 > 0 and f.x = p_x0 and f.y = p_y0)
          or (p_l1 > 0 and f.x between p_x1 - 1 and p_x1 + 1 and f.y between p_y1 - 1 and p_y1 + 1));
  if v_b is null then return null; end if;
  select min(f.x) - 1, min(f.y) - 1, max(f.x) + 1, max(f.y) + 1, max(f.level) into bx0, by0, bx1, by1, top
    from floor_tile f where f.world_id = p_world and f.building = any(v_b) and f.level >= 1;
  w := bx1 - bx0 + 1; h := by1 - by0 + 1; wh := w * h; n := (top + 1) * wh;
  if p_l0 > top or p_l1 > top then return null; end if;
  st := array_fill(0, array[n]); ft := array_fill(0, array[n]); par := array_fill(0, array[n]);
  ex := array_fill(0, array[n]); ey := array_fill(0, array[n]);
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
    if st[k] in (1, 2, 3) then
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
      elsif st[kn] in (1, 3) and par[kn] = 0 then
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

/* Whether a storey of a building a tile is on is one a beast gets up to at all: a finished staircase, not a ladder, on every storey under it. */
create or replace function storey_reached(p_world uuid, p_x int, p_y int, p_level int)
returns boolean language sql stable as $$
  select p_level <= 0 or coalesce((
    select count(distinct s.level) = p_level
      from floor_tile f join floor_tile s on s.world_id = f.world_id and s.building = f.building
     where f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y
       and s.level between 1 and p_level and s.kind = 'stairs' and bill_done(s.needed)), false)
$$;

/* The same of a store, a crate or a piece of furniture, by its id. */
create or replace function store_reached(p_world uuid, p_kind text, p_id bigint)
returns boolean language sql stable as $$
  select coalesce(case when p_kind = 'crate'
    then (select storey_reached(p_world, cr.x, cr.y, cr.level) from crate cr where cr.world_id = p_world and cr.id = p_id)
    else (select storey_reached(p_world, p.x, p.y, p.level) from placed p where p.id = p_id) end, true)
$$;

/*
 * The storey of what a worker walks to at a point: the lowest store or piece of furniture on that tile, the ground
 * where there is none or no storey over the tile at all. A cellar's is the ground's: no worker goes down one.
 */
create or replace function worker_spot_storey(p_world uuid, p_x double precision, p_y double precision)
returns int language plpgsql stable as $$
declare tx int := floor(p_x)::int; ty int := floor(p_y)::int; v int;
begin
  if not exists (select 1 from floor_tile f where f.world_id = p_world and f.x = tx and f.y = ty and f.level >= 1) then return 0; end if;
  select min(s.l) into v from (
    select greatest(0, cr.level) as l from crate cr where cr.world_id = p_world and cr.x = tx and cr.y = ty
    union all
    select greatest(0, p.level) from placed p
     where p.world_id = p_world and p.x between tx - 2 and tx and p.y between ty - 2 and ty and p.kind = 'furniture'
       and ((p.x = tx and p.y = ty) or (floor(p.cx)::int = tx and floor(p.cy)::int = ty))) s;
  return coalesce(v, 0);
end $$;

/*
 * The next leg of a worker's way, from where it stands, at `p_at`: to the next point of it, at that point's storey,
 * in the seconds it was given. A point a storey up with nothing to stand on any more (`frame_stands`) is a way gone
 * from under it: it goes again from where it stands to where it was going (`worker_way_leg`).
 */
create or replace function worker_way_next(p_world uuid, c creature, p_x double precision, p_y double precision,
                                           p_at timestamptz, p_pace double precision)
returns creature language plpgsql stable as $$
declare v jsonb := c.way->0; v_end jsonb; x double precision; y double precision; l int;
begin
  if v is null then c.way := null; return c; end if;
  x := (v->>0)::double precision; y := (v->>1)::double precision; l := (v->>2)::int;
  if l > 0 and not frame_stands(p_world, floor(x)::int, floor(y)::int, l) then
    v_end := c.way->-1;
    c.way := null;
    c.to_x := (v_end->>0)::double precision; c.to_y := (v_end->>1)::double precision;
    c.leg_at := p_at;
    return worker_way_leg(p_world, c, p_x, p_y, p_pace, (v_end->>2)::int);
  end if;
  c.from_x := p_x; c.from_y := p_y; c.to_x := x; c.to_y := y;
  c.storey_from := c.storey; c.storey := l;
  c.leg_at := p_at; c.leg_ends := p_at + make_interval(secs => (v->>3)::double precision);
  c.until := c.leg_ends;
  c.way := case when jsonb_array_length(c.way) > 1 then c.way - 0 end;
  return c;
end $$;

/*
 * A leg a worker has just been given, from `p_x, p_y` at its storey to `to_x, to_y` at `p_lv` (or the storey of
 * what is there, `worker_spot_storey`, for a leg home, out, to fetch or to a bed): straight on the ground, as ever;
 * to or from a storey, by the stairs (`creature_way`), its first leg now and the rest its way. No way: it stands, and
 * says the storey it cannot get to (`stairs`). No way down at all from where it stands: it stays there (`stranded`).
 */
create or replace function worker_way_leg(p_world uuid, c creature, p_x double precision, p_y double precision,
                                          p_pace double precision, p_lv int)
returns creature language plpgsql stable as $$
declare s int := greatest(0, c.storey); t int; v_way int[]; v_pts jsonb := '[]'; i int; m int;
        px double precision := p_x; py double precision := p_y; x double precision; y double precision; l int;
        v_d double precision; v_pace double precision := greatest(0.1, p_pace);
begin
  t := greatest(0, coalesce(p_lv, case when c.phase in ('home', 'fetch', 'out', 'bed')
                                       then worker_spot_storey(p_world, c.to_x, c.to_y) else 0 end));
  if s = 0 and t = 0 then return c; end if;
  v_way := creature_way(p_world, floor(p_x)::int, floor(p_y)::int, s, floor(c.to_x)::int, floor(c.to_y)::int, t);
  if v_way is null then
    c.from_x := p_x; c.from_y := p_y; c.to_x := p_x; c.to_y := p_y; c.way := null;
    c.leg_ends := c.leg_at; c.until := c.leg_at + interval '4 seconds';
    c.phase := 'idle'; c.idle_what := null;
    -- Its stairs gone from under it: it stays up there, and says so, until a staircase down is built. Asked for:
    -- "Leave it stuck upstairs until stairs are built".
    if s > 0 and creature_way(p_world, floor(p_x)::int, floor(p_y)::int, s, floor(p_x)::int, floor(p_y)::int, 0) is null then
      c.idle_why := 'stranded'; c.idle_n := s + 1;
    else
      c.idle_why := 'stairs'; c.idle_n := greatest(s, t) + 1;
    end if;
    return c;
  end if;
  m := coalesce(array_length(v_way, 1), 0) / 3;
  for i in 0 .. m - 1 loop
    x := v_way[i * 3 + 1] + 0.5; y := v_way[i * 3 + 2] + 0.5; l := v_way[i * 3 + 3];
    -- The last, the tile it is going to: the point itself.
    if i = m - 1 and l = t and floor(x) = floor(c.to_x) and floor(y) = floor(c.to_y) then continue; end if;
    -- A straight run across a storey is one leg.
    if i > 0 and i < m - 1 and l > 0 and l = v_way[i * 3] and l = v_way[i * 3 + 6]
       and sign(v_way[i * 3 + 1] - v_way[i * 3 - 2]) = sign(v_way[i * 3 + 4] - v_way[i * 3 + 1])
       and sign(v_way[i * 3 + 2] - v_way[i * 3 - 1]) = sign(v_way[i * 3 + 5] - v_way[i * 3 + 2]) then
      continue;
    end if;
    v_d := sqrt((x - px) ^ 2 + (y - py) ^ 2);
    -- Round a spiral staircase, a storey up or down on its tile: as long as a tile's walk (`FLIGHT_TILES`).
    v_pts := v_pts || jsonb_build_array(jsonb_build_array(x, y, l, greatest(0.2, greatest(v_d, case when v_d < 0.01 then 1 else 0 end) / v_pace)));
    px := x; py := y;
  end loop;
  v_d := sqrt((c.to_x - px) ^ 2 + (c.to_y - py) ^ 2);
  v_pts := v_pts || jsonb_build_array(jsonb_build_array(c.to_x, c.to_y, t, greatest(0.2, v_d / v_pace)));
  c.way := v_pts;
  return worker_way_next(p_world, c, p_x, p_y, c.leg_at, p_pace);
end $$;

/*
 * A worker is on a storey only where there is something to stand on there, at either end of its leg: let down to
 * what is under it where there is not (`storey_footing`). One let off the settlement comes down with it.
 */
create or replace function creature_storey_trigger() returns trigger language plpgsql as $$
begin
  if new.mode <> 'deed' then
    new.storey := 0; new.storey_from := 0; new.way := null;
    return new;
  end if;
  if new.storey > 0 then new.storey := storey_footing(new.world_id, floor(new.to_x)::int, floor(new.to_y)::int, new.storey, -1); end if;
  if new.storey_from > 0 then
    new.storey_from := storey_footing(new.world_id, floor(new.from_x)::int, floor(new.from_y)::int, new.storey_from, -1);
  end if;
  return new;
end $$;
drop trigger if exists creature_storey on creature;
create trigger creature_storey before update on creature for each row
  when (new.storey <> 0 or new.storey_from <> 0 or new.way is not null) execute function creature_storey_trigger();

/* A floor taken away from under a worker standing on it: let down (`creature_storey_trigger`). */
create or replace function floor_gone_creature_trigger() returns trigger language plpgsql as $$
begin
  update creature c set storey = c.storey
   where c.world_id = old.world_id and (c.storey > 0 or c.storey_from > 0)
     and ((floor(c.to_x)::int = old.x and floor(c.to_y)::int = old.y and c.storey >= old.level)
          or (floor(c.from_x)::int = old.x and floor(c.from_y)::int = old.y and c.storey_from >= old.level));
  return null;
end $$;
drop trigger if exists floor_gone_creature on floor_tile;
create trigger floor_gone_creature after delete on floor_tile for each row
  when (old.level >= 1) execute function floor_gone_creature_trigger();

/*
 * Where a hod carrier stands to fit a piece of planned work: a wall on its own storey, on the tile either side of it
 * there is something to stand on; a floor, staircase, ladder or roof from the storey under it, under it or beside it;
 * a column on its own storey; the ground for anything on the ground. None: nowhere to stand.
 */
create or replace function hod_stand(p_world uuid, p_kind text, p_level int, p_dir text, p_x int, p_y int)
returns table(x int, y int, l int) language plpgsql stable as $$
declare v_l int; d int; dxs int[] := array[0, 1, -1, 0, 0]; dys int[] := array[0, 0, 0, 1, -1];
begin
  if p_level <= 0 or p_kind in ('span', 'foundation') then
    x := p_x; y := p_y; l := 0; return next; return;
  end if;
  if p_kind = 'wall' then
    if frame_stands(p_world, p_x, p_y, p_level) then x := p_x; y := p_y; l := p_level; return next; return; end if;
    x := p_x - case when p_dir = 'v' then 1 else 0 end; y := p_y - case when p_dir = 'h' then 1 else 0 end;
    if frame_stands(p_world, x, y, p_level) then l := p_level; return next; end if;
    return;
  end if;
  v_l := case when p_kind = 'column' then p_level else p_level - 1 end;
  if v_l <= 0 then x := p_x; y := p_y; l := 0; return next; return; end if;
  for d in 1..5 loop
    if frame_stands(p_world, p_x + dxs[d], p_y + dys[d], v_l) then
      x := p_x + dxs[d]; y := p_y + dys[d]; l := v_l; return next; return;
    end if;
  end loop;
end $$;

/* Whether a hod carrier gets to where it stands to fit a piece of work: on the ground, or a storey up a staircase goes to. */
create or replace function hod_reached(p_world uuid, p_kind text, p_level int, p_dir text, p_x int, p_y int)
returns boolean language plpgsql stable as $$
declare s record;
begin
  if p_level <= 0 or p_kind in ('span', 'foundation') then return true; end if;
  if p_kind <> 'wall' and p_kind <> 'column' and p_level = 1 then return true; end if;
  select * into s from hod_stand(p_world, p_kind, p_level, p_dir, p_x, p_y);
  return s.l is not null and storey_reached(p_world, s.x, s.y, s.l);
end $$;

/*
 * The lowest storey, counted from 1 for the ground, that work in range wanting something the stores hold is fitted
 * from and no staircase goes up to (`stairs`); null where there is none.
 */
create or replace function hod_unreached(p_world uuid, p_uid uuid, p_cx int, p_cy int, p_range int)
returns int language sql stable as $$
  with work as materialized (
    select * from hod_work(p_world, p_cx, p_cy, p_range) w
     where w.level >= 1 and not hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)
       and hod_work_mine(p_world, p_uid, w.dir, w.x, w.y)
  ),
  have as materialized (
    select distinct (s.it).def as def from deed_store_items(p_world, p_uid) s
     where (s.it).count > 0 and not coalesce((s.it).locked, false) and exists (select 1 from work)
  )
  select min(case when w.kind in ('wall', 'column') then w.level else w.level - 1 end) + 1
    from work w
   where exists (select 1 from jsonb_each_text(w.needed) e where e.value::int > 0 and e.key in (select def from have))
$$;

-- A hod carrier takes on only the work it gets to (`hod_reached`): carrying, and empty-handed.
do $do$
declare v text; v_n int; v_old text; v_new text;
begin
  v := pg_get_functiondef('hod_needing'::regproc);
  v_old := $o$    and (p_keeper is null or hod_work_mine(p_world, p_keeper, w.dir, w.x, w.y))$o$;
  v_new := v_old || $n$
    -- One it gets to: on the ground, or a storey up a staircase goes to (`hod_reached`).
    and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'hod_needing has % of the deed check, not 1', v_n; end if;
  execute replace(v, v_old, v_new);

  v := pg_get_functiondef('hod_needing_stocked'::regproc);
  v_old := $o$    where e.value::int > 0 and hod_work_mine(p_world, p_uid, w.dir, w.x, w.y)$o$;
  v_new := v_old || $n$
      and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'hod_needing_stocked has % of the deed check, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

-- And a store a worker puts into or takes from is one it gets to (`storey_reached`).
do $do$
declare v text; v_n int; v_old text; v_new text;
begin
  v := pg_get_functiondef('worker_store'::regproc);
  v_old := $o$crate_units(p_world, cr.id) + p_count <= crate_capacity(cr)$o$;
  v_new := v_old || $n$ and (cr.level <= 0 or storey_reached(p_world, cr.x, cr.y, cr.level))$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 2 then raise exception 'worker_store has % of the crate room checks, not 2', v_n; end if;
  v := replace(v, v_old, v_new);
  v_old := $o$and p_count <= furniture_room(p, p_def))$o$;
  v_new := $n$and p_count <= furniture_room(p, p_def) and (p.level <= 0 or storey_reached(p_world, p.x, p.y, p.level)))$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 2 then raise exception 'worker_store has % of the furniture room checks, not 2', v_n; end if;
  execute replace(v, v_old, v_new);

  v := pg_get_functiondef('store_holding'::regproc);
  v_old := $o$and not coalesce((s.it).locked, false)$o$;
  v_new := v_old || $n$ and store_reached(p_world, s.kind, s.sid)$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'store_holding has % of the lock check, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

-- A hod carrier's step: where it stands to fit the work, and that storey (`gl`); and `stairs`, for work the stores
-- have for that no staircase goes up to.
do $do$
declare v text; v_n int; v_old text; v_new text;
begin
  v := pg_get_functiondef('errand_step(uuid,integer,text)'::regprocedure);
  v_old := $o$why_n double precision, why_what text[])$o$;
  v_new := $n$why_n double precision, why_what text[], gl integer)$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'errand_step has % of its columns, not 1', v_n; end if;
  v := replace(v, v_old, v_new);

  v_old := $o$    else
      gx := v_job.x + 0.5; gy := v_job.y + 0.5;
      want := null; wx := v_job.x; wy := v_job.y;
    end if;$o$;
  v_new := $n$    else
      -- Where it stands to fit it, on the storey it fits it from (`hod_stand`).
      select * into v_spot from hod_stand(p_world, v_job.kind, v_job.level, v_job.dir, v_job.x, v_job.y);
      gx := v_spot.x + 0.5; gy := v_spot.y + 0.5; gl := v_spot.l;
      want := null; wx := v_job.x; wy := v_job.y;
    end if;$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'errand_step has % of the hod work leg, not 1', v_n; end if;
  v := replace(v, v_old, v_new);

  v_old := $o$        -- Work within reach wanting only what the stores do not hold: `stock`, and what it wants. None: `range`.$o$;
  v_new := $n$        -- Work the stores have for a storey up no staircase goes to: `stairs`, and that storey (`hod_unreached`).
        why_n := hod_unreached(p_world, c.keeper, dd.x, dd.y, rng);
        if why_n is not null then why := 'stairs'; return next; return; end if;
$n$ || v_old;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'errand_step has % of the stock reason, not 1', v_n; end if;
  v := replace(v, v_old, v_new);
  drop function errand_step(uuid, integer, text);
  execute v;
end $do$;

-- The settle: each leg it is given goes by the stairs to or from a storey (`worker_way_leg`), and the way it is on
-- is walked a leg at a time before anything else, its phase kept for the end of it.
do $do$
declare v text; v_n int; v_old text; v_new text;
begin
  v := pg_get_functiondef('worker_settle'::regproc);

  v_old := $o$v_did jsonb; v_tire int; v_put jsonb; -- made log$o$;
  v_new := v_old || $n$
        v_lv int; v_once int; v_routed boolean := true; -- storeys$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_settle has % of its last declarations, not 1', v_n; end if;
  v := replace(v, v_old, v_new);

  v_old := $o$  while c.until <= now() and guard < 120 loop
    guard := guard + 1;
    cx := c.to_x; cy := c.to_y;
$o$;
  v_new := $n$  <<settle>>
  while c.until <= now() and guard < 120 loop
    guard := guard + 1;
    cx := c.to_x; cy := c.to_y;
    c.storey_from := c.storey;
    -- Along the way it was given (`worker_way_leg`): its next leg, and its phase kept for the end of the way.
    if c.way is not null then
      c := worker_way_next(p_world, c, cx, cy, c.until, pace);
      continue;
    end if;
    v_lv := null; v_routed := false;
    for v_once in 1..1 loop
$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_settle has % of the loop head, not 1', v_n; end if;
  v := replace(v, v_old, v_new);

  v_old := $o$  end loop;

  if c.until <= now() then
    c.from_x := c.to_x; c.from_y := c.to_y;$o$;
  v_new := $n$    end loop;
    -- A leg made this pass, to or from a storey by the stairs (`worker_way_leg`).
    if c.to_x is distinct from cx or c.to_y is distinct from cy then c := worker_way_leg(p_world, c, cx, cy, pace, v_lv); end if;
    v_routed := true;
  end loop;
  -- And one made on the way out of the loop.
  if not v_routed and (c.to_x is distinct from cx or c.to_y is distinct from cy) then
    c := worker_way_leg(p_world, c, cx, cy, pace, v_lv);
  end if;

  if c.until <= now() then
    c.from_x := c.to_x; c.from_y := c.to_y; c.storey_from := c.storey;$n$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_settle has % of the loop end, not 1', v_n; end if;
  v := replace(v, v_old, v_new);

  -- Every way out of a pass that ends the settle ends the loop round the pass, not the pass.
  v_old := $o$exit;$o$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 14 then raise exception 'worker_settle has % exits, not 14', v_n; end if;
  v := replace(v, v_old, $n$exit settle;$n$);

  -- Its storey and its way go down with the row whenever the row does, so nothing it calls reads it stale.
  v_old := $o$settled_at = now()$o$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 5 then raise exception 'worker_settle has % row writes, not 5', v_n; end if;
  v := replace(v, v_old, $n$storey = c.storey, storey_from = c.storey_from, way = c.way, settled_at = now()$n$);

  -- A hod carrier's leg to the work: to the storey it fits it from.
  v_old := $o$        c.fetching := step.want;
$o$;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_settle has % of the errand leg, not 1', v_n; end if;
  v := replace(v, v_old, v_old || $n$        v_lv := step.gl;
$n$);
  execute v;
end $do$;

-- Mounted from the ground floor only, the mount's too: a worker gone up a staircase is not mounted up there.
do $do$
declare v text; v_n int;
  v_old text := $o$         or (select level from player where world_id = p_world and uid = p_uid) <> 0 then$o$;
begin
  v := pg_get_functiondef('ride_refusal'::regproc);
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ride_refusal has % of the ground floor check, not 1', v_n; end if;
  execute replace(v, v_old, $n$         or (select level from player where world_id = p_world and uid = p_uid) <> 0 or c.storey <> 0 then$n$);
end $do$;

-- And the storey a worker is on, and the way it is walking, for whoever draws it (`Creature.storey`, `walkLegs`).
do $do$
declare v text; v_n int;
  v_old text := $o$      || case when c.rider is null then '{}'::jsonb$o$;
  v_new text := $n$      || case when c.rider is null and c.storey = 0 and c.storey_from = 0 and c.way is null then '{}'::jsonb
              when c.rider is null then jsonb_build_object('storey', c.storey, 'storeyFrom', c.storey_from, 'way', c.way)$n$;
begin
  v := pg_get_functiondef('rpc_creatures'::regproc);
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of the rider storey, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

select private.lock_doors();
