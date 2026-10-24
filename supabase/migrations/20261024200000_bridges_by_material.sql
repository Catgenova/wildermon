/*
 * Bridges by material, one to three lanes wide.
 *
 * The wooden bridge and the stone arch give way to a bridge of each of ten
 * wall materials (`BRIDGE_MATERIALS`, `bridge_def.material`): longest its
 * storeys and `BRIDGE_REACH` tiles, carried in bays of its heft and
 * `BAY_PAST_HEFT` tiles (`bridge_bays`) on piers between them
 * (`bridge_piers`), no deeper over the ground than its storeys
 * (`bridge_def.deepest`). A span takes a solid wall's bill of its material a
 * lane, and one that carries a pier that bill again for every storey the pier
 * stands down (`span_bill`, `pier_storeys`).
 *
 * `bridge.width` lanes, `bridge.side` saying on which side of the line it was
 * set out along the second of two is laid (`bridge_lanes`): every lane's ends
 * land as the line's do and every lane's deck is asked what the line's is
 * (`bridge_reason`); `bridge_at`, `bridge_end_at` and `deck_height_at` know
 * every lane. From `wagon_width` lanes a wagon crosses (`deck_wheels`, in
 * `walk_share`); at `stall_width`, furniture goes on the outer lanes of a
 * finished deck (`bridge_furniture_refusal`, in `fire_refusal`).
 *
 * Every existing wooden bridge is a plank one and every stone arch a stone
 * brick one, one lane, standing whatever the new limits say: they are asked
 * of a bridge only when it is planned. The browser's `bridgeReason`,
 * `spanBill`, `plannedWords`, `crossWords`, `bridgeWheels`,
 * `deckFurnitureRefusal`, held to these by `supabase/test/bridgewidth.ts`.
 */
set local lock_timeout = '3s';

select private.shut('alter table bridge add column if not exists width int not null default 1');
select private.shut('alter table bridge add column if not exists side int not null default 1');

/* ---- the old kinds, as the new ------------------------------------------------------- */
update bridge set kind = 'plank', material = null where kind = 'wood';
update bridge set kind = 'stone_brick', material = null where kind = 'stone';

/* ---- lanes ------------------------------------------------------------------------------- */

/* A bridge's lanes, by how far each is off the line it was set out along, in the order they are asked about (`laneOffsets`). */
create or replace function bridge_lanes(p_width int, p_side int)
returns table (k int, o int) language sql immutable as $fn$
  select v.k, v.o from (values (1, -1), (2, 0), (3, 1)) v(k, o) where coalesce(p_width, 1) >= 3
  union all
  select v.k, v.o from (values (1, 0), (2, case when p_side < 0 then -1 else 1 end)) v(k, o) where coalesce(p_width, 1) = 2
  union all
  select 1, 0 where coalesce(p_width, 1) <= 1
$fn$;

/* A compass side across a run from (ax, ay) to (bx, by) as a step: 1 east or south, -1 west or north, 0 none (`sideStep`). */
create or replace function bridge_side_step(p_ax int, p_ay int, p_bx int, p_by int, p_side text)
returns int language sql immutable as $fn$
  select case when p_ay = p_by and p_ax <> p_bx
              then case p_side when 'n' then -1 when 's' then 1 else 0 end
              else case p_side when 'w' then -1 when 'e' then 1 else 0 end end
$fn$;

/* The lane a tile of a bridge's deck (not its ends) is in, by its offset, or null (`laneOf`, `deckTiles`). */
create or replace function bridge_deck_lane(b bridge, p_x int, p_y int)
returns int language sql stable as $fn$
  select l.o from bridge_lanes(b.width, b.side) l
   where exists (select 1 from bridge_span s where s.world_id = b.world_id and s.bridge = b.id
                   and s.x = p_x - l.o * (case when b.ay = b."by" and b.ax <> b.bx then 0 else 1 end)
                   and s.y = p_y - l.o * (case when b.ay = b."by" and b.ax <> b.bx then 1 else 0 end))
   order by l.k limit 1
$fn$;

/* The bridge whose deck or ends cover a tile: every lane's. */
create or replace function bridge_at(p_world uuid, p_x integer, p_y integer)
returns bigint language sql stable as $fn$
  select t.id from (
    select b.id, 0 as pri from bridge b
     where b.world_id = p_world
       and ((b.ax = p_x and b.ay = p_y) or (b.bx = p_x and b.by = p_y)
            or exists (select 1 from bridge_span s where s.world_id = p_world and s.bridge = b.id
                         and s.x = p_x and s.y = p_y))
    union all
    select b.id, 1 from bridge b cross join lateral bridge_lanes(b.width, b.side) l
     cross join lateral (select case when b.ay = b.by and b.ax <> b.bx then 0 else 1 end as px,
                                case when b.ay = b.by and b.ax <> b.bx then 1 else 0 end as py) p
     where b.world_id = p_world and b.width > 1 and l.o <> 0
       and ((b.ax + l.o * p.px = p_x and b.ay + l.o * p.py = p_y) or (b.bx + l.o * p.px = p_x and b.by + l.o * p.py = p_y)
            or exists (select 1 from bridge_span s where s.world_id = p_world and s.bridge = b.id
                         and s.x = p_x - l.o * p.px and s.y = p_y - l.o * p.py))
  ) t order by t.pri limit 1
$fn$;

/* Whether a bridge thrown across, not an aqueduct, has one of its ends on a tile: every lane's (`bridgeEndAt`). */
create or replace function bridge_end_at(p_world uuid, p_x integer, p_y integer)
returns boolean language sql stable as $fn$
  select exists (select 1 from bridge b cross join lateral bridge_lanes(b.width, b.side) l
                  cross join lateral (select case when b.ay = b.by and b.ax <> b.bx then 0 else 1 end as px,
                                             case when b.ay = b.by and b.ax <> b.bx then 1 else 0 end as py) p
                  where b.world_id = p_world and b.kind <> 'aqueduct'
                    and ((b.ax + l.o * p.px = p_x and b.ay + l.o * p.py = p_y) or (b.bx + l.o * p.px = p_x and b.by + l.o * p.py = p_y)))
$fn$;

/* The height of finished deck at a point, up a ramp's slope, on any lane of it. */
create or replace function deck_height_at(p_world uuid, p_x double precision, p_y double precision)
returns double precision language sql stable as $fn$
  select ramp_deck(b.height, b.rise,
                   (select count(*)::int from bridge_span s where s.world_id = b.world_id and s.bridge = b.id),
                   case when b.ay = b.by then case when b.bx > b.ax then p_x - (b.ax + 1) else b.ax - p_x end
                        else case when b.by > b.ay then p_y - (b.ay + 1) else b.ay - p_y end end)
    from bridge b
   where b.world_id = p_world and b.id = deck_at(p_world, floor(p_x)::int, floor(p_y)::int)
     and bridge_deck_lane(b, floor(p_x)::int, floor(p_y)::int) is not null
     and not exists (select 1 from bridge_span s where s.world_id = b.world_id and s.bridge = b.id and not span_done(s.needed))
$fn$;

/* ---- bays, piers and the bill ------------------------------------------------------------- */

/* The bays a deck of `p_n` tiles is carried in, end a's first: as even as they go, the longer in the middle (`bridgeBays`). */
create or replace function bridge_bays(p_n int, p_bay int)
returns int[] language plpgsql immutable as $fn$
declare k int; base int; v int[]; left_n int; r record;
begin
  if p_n is null or p_n <= 0 then return '{}'; end if;
  if p_bay is null or p_bay <= 0 then return array[p_n]; end if;
  k := ceil(p_n::numeric / p_bay)::int;
  base := p_n / k;
  v := array_fill(base, array[k]);
  left_n := p_n - base * k;
  for r in select g from generate_series(0, k - 1) g order by abs(2 * g - (k - 1)), g desc loop
    exit when left_n <= 0;
    v[r.g + 1] := v[r.g + 1] + 1;
    left_n := left_n - 1;
  end loop;
  return v;
end $fn$;

/* The spans, by `bridge_span.n`, that carry a pier: the last of every bay but the last (`pierSpans`). */
create or replace function bridge_piers(p_n int, p_bay int)
returns int[] language plpgsql immutable as $fn$
declare v int[] := bridge_bays(p_n, p_bay); out int[] := '{}'; at int := 0; i int;
begin
  for i in 1 .. coalesce(array_length(v, 1), 0) - 1 loop
    at := at + v[i];
    out := out || at;
  end loop;
  return out;
end $fn$;

/* How many storeys of drop a pier stands down, off its deck's drop (`pierStoreys`). */
create or replace function pier_storeys(p_drop double precision)
returns int language sql immutable as $fn$
  select greatest(1, ceil(p_drop / wall_height()))::int
$fn$;

/* One span's bill: its kind's a lane, a drawbridge's winch on the first, its kind's again a storey of the pier it carries (`spanBill`). */
create or replace function span_bill(p_kind text, p_n integer, p_width integer, p_pier integer)
returns jsonb language sql stable as $fn$
  select coalesce(jsonb_object_agg(t.item, t.count), '{}'::jsonb)
  from (select b.item, sum(b.count)::int as count
          from (select item, count * (coalesce(p_width, 1) + coalesce(p_pier, 0)) as count from bridge_bill where kind = p_kind
                union all
                select item, count from bridge_winch where kind = p_kind and p_n = 1) b
         group by b.item) t
$fn$;

/* ---- what a bridge is and says ---------------------------------------------------------------- */

/* A bridge moss gathers on: one of stone, brick or earth, or an aqueduct (`mossyBridge`). */
create or replace function bridge_mossy(p_kind text)
returns boolean language sql stable as $fn$
  select p_kind = 'aqueduct' or coalesce((select d.stone from bridge_def d where d.id = p_kind), false)
$fn$;

/* What may cross a bridge, as its last span decked says (`crossWords`). */
create or replace function bridge_crosses(b bridge)
returns text language sql stable as $fn$
  select case when not coalesce((select d.carts from bridge_def d where d.id = b.kind), false) then 'Foot traffic only.'
              when b.width < wagon_width() then 'Carts may cross.'
              when b.width < stall_width() then 'Carts and wagons may cross.'
              else 'Carts and wagons may cross. Furniture on the outer lanes.' end
$fn$;

/* What is said of a bridge set out after its spans: lanes, where it goes, a span's bill, and its piers (`plannedWords`). */
create or replace function bridge_planned(p_world uuid, b bridge)
returns text language plpgsql stable as $fn$
declare d bridge_def; v_n int; v_piers int[] := '{}'; v_base jsonb; v_pier jsonb;
begin
  select * into d from bridge_def where id = b.kind;
  select count(*)::int into v_n from bridge_span s where s.world_id = p_world and s.bridge = b.id;
  v_base := span_bill(b.kind, 0, b.width, 0);
  if d.material is not null then v_piers := bridge_piers(v_n, d.bay); end if;
  select coalesce(jsonb_object_agg(t.k, t.v), '{}'::jsonb) into v_pier
    from (select e.key as k, sum((e.value)::int - coalesce((v_base->>e.key)::int, 0))::int as v
            from bridge_span s cross join lateral jsonb_each(s.total) e
           where s.world_id = p_world and s.bridge = b.id and s.n = any (v_piers)
           group by e.key) t;
  return case when b.width > 1 then ', ' || b.width || ' lanes' else '' end
      || bridge_set_out(b.level, b.level_b, b.rise)
      || '. Per span: ' || span_wants(v_base)
      || case when cardinality(v_piers) > 0 then '. Piers: ' || cardinality(v_piers) || ', ' || span_wants(v_pier) else '' end;
end $fn$;

/* Whether wheels of this kind may roll onto a bridge's deck: a cart where carts cross, a wagon from `wagon_width` lanes, never a walkway up a storey (`bridgeWheels`). */
create or replace function deck_wheels(p_world uuid, p_bridge bigint, p_vehicle text)
returns boolean language sql stable as $fn$
  select coalesce((select d.carts and (p_vehicle is distinct from 'wagon' or b.width >= wagon_width())
                          and b.level = 0 and coalesce(b.level_b, 0) = 0
                     from bridge b join bridge_def d on d.id = b.kind
                    where b.world_id = p_world and b.id = p_bridge), true)
$fn$;

/* Why a piece may not be set down on a bridge's deck on this tile, or null: a finished material bridge `stall_width` lanes wide, its outer lanes (`deckFurnitureRefusal`). */
create or replace function bridge_furniture_refusal(p_world uuid, p_x int, p_y int)
returns text language plpgsql stable as $fn$
declare b bridge; d bridge_def; v_o int;
begin
  select * into b from bridge where world_id = p_world and id = bridge_at(p_world, p_x, p_y);
  if b.id is null or b.kind = 'aqueduct' then return null; end if;
  v_o := bridge_deck_lane(b, p_x, p_y);
  -- An end tile is the ground it lands on.
  if v_o is null then return null; end if;
  select * into d from bridge_def where id = b.kind;
  if d.material is null or b.width < stall_width() then
    return 'Bridge deck: furniture only on a ' || stall_width()::int || '-lane bridge''s outer lanes.';
  end if;
  if v_o = 0 then return 'Bridge deck: outer lanes only.'; end if;
  if bridge_left(p_world, b.id) > 0 then return 'Bridge deck not finished.'; end if;
  return null;
end $fn$;

/* And the lanes in the ground read, with a drawbridge's gear: only past one, as the browser's `Bridge` has them. */
create or replace function bridge_gear(b bridge)
returns jsonb language sql immutable as $fn$
  select case when b.raised then jsonb_build_object('raised', true) else '{}'::jsonb end
      || case when b.lock is null then '{}'::jsonb else jsonb_build_object('lock', b.lock) end
      || case when b.width > 1 then jsonb_build_object('width', b.width, 'side', b.side) else '{}'::jsonb end
$fn$;

/* ---- planning -------------------------------------------------------------------------------------- */

/*
 * Why a bridge of this sort, `p_width` lanes wide, cannot be thrown between
 * these two tiles, or null (`bridgeReason`): in the same order and words.
 */
create or replace function bridge_reason(p_world uuid, p_uid uuid, p_kind text, p_ax integer, p_ay integer, p_bx integer, p_by integer,
  p_width integer, p_side integer)
returns text language plpgsql stable as $fn$
declare d bridge_def; n int; ha double precision; hb double precision; h int; r record; e record; l record;
        la int; lb int; v_rise int; v_reach int; px int; py int; x int; y int; v_lvl int; v_h double precision;
        v_drop double precision; v_why text;
begin
  select * into d from bridge_def where id = p_kind;
  if not found then return 'Choose a material.'; end if;
  if not in_bounds(p_world, p_ax, p_ay) or not in_bounds(p_world, p_bx, p_by) then return 'Not there.'; end if;
  if p_ax <> p_bx and p_ay <> p_by then
    return 'Bridges run straight: pick an end due north, south, east or west.';
  end if;
  select count(*)::int into n from span_tiles(p_ax, p_ay, p_bx, p_by);
  if n = 0 then return 'No gap between those tiles.'; end if;
  -- Lanes: a material bridge one to `bridge_widest`, anything else one.
  if p_width is null or p_width < 1 or p_width > (case when d.material is not null then bridge_widest()::int else 1 end) then
    return case when d.material is not null then 'Width: 1 to ' || bridge_widest()::int || ' lanes.' else d.name || ': 1 lane only.' end;
  end if;
  -- A Mason's Bridge Mason and a Carpenter's Bridge Wright: a material bridge so many tiles past its own, a rope one to so many.
  v_reach := case when d.material is not null
                  then d.span + pk(p_world, p_uid, 'span:bridge_' || case when d.stone then 'stone' else 'wood' end, 0)::int
                  else pk(p_world, p_uid, 'span:' || ('bridge_' || p_kind), d.span)::int end;
  if n > v_reach then
    return d.name || ': max span ' || v_reach || ' tiles; this is ' || n || '.';
  end if;
  px := case when p_ay = p_by and p_ax <> p_bx then 0 else 1 end;
  py := 1 - px;
  /*
   * And what each end lands on: a bank, a poured slab, or a finished floor of
   * a building -- every lane's, on the storey the line's lands on and within
   * `end_slop` of it.
   */
  la := top_deck(p_world, p_ax, p_ay);
  lb := top_deck(p_world, p_bx, p_by);
  ha := deck_height(p_world, p_ax, p_ay);
  hb := deck_height(p_world, p_bx, p_by);
  for l in select * from bridge_lanes(p_width, p_side) order by k loop
    for e in select * from (values (0, p_ax, p_ay, la, ha), (1, p_bx, p_by, lb, hb)) v(i, x0, y0, lvl, h0) order by i loop
      x := e.x0 + l.o * px;
      y := e.y0 + l.o * py;
      if not in_bounds(p_world, x, y) then return 'Not there.'; end if;
      v_lvl := case when l.o = 0 then e.lvl else top_deck(p_world, x, y) end;
      -- Piers: a deck on piers is landed on once it is built, and is dry, solid ground whatever is under it (`deck_surface`).
      if on_piers(p_world, x, y) and deck_surface(p_world, x, y) is null then
        return 'Needs a finished deck at that end.';
      end if;
      if v_lvl = 0 and slab_at(p_world, x, y) is null
         and deck_surface(p_world, x, y) is null
         and (not passable(p_world, x, y) or centre_height(p_world, x, y) < 0) then
        return 'Both ends need dry, solid ground.';
      end if;
      if bridge_at(p_world, x, y) is not null then return 'An end is already under a bridge.'; end if;
      if l.o <> 0 and v_lvl <> e.lvl then return 'Lane ends on different storeys.'; end if;
      if l.o <> 0 then
        v_h := deck_height(p_world, x, y);
        if abs(v_h - e.h0) > end_slop() then
          return 'Lane ends ' || metres(abs(v_h - e.h0)) || ' m apart in height; max ' || metres(end_slop()) || ' m.';
        end if;
      end if;
    end loop;
  end loop;
  -- gates: not from inside a ground floor nor through a wall, and a drawbridge outside at both ends: every lane's.
  for l in select * from bridge_lanes(p_width, p_side) order by k loop
    v_why := bridge_end_refusal(p_world, p_uid, p_kind, p_ax + l.o * px, p_ay + l.o * py, p_bx + l.o * px, p_by + l.o * py, la, lb);
    if v_why is not null then return v_why; end if;
  end loop;
  -- gates: a drawbridge goes from bank to bank: its hinge and its winch stand on the ground.
  if d.grounded and (la <> 0 or lb <> 0) then
    return d.name || ': ground to ground only, not to a storey.';
  end if;
  -- Past `end_slop` a deck is a ramp, from one storey to another or from bank to bank, at `ramp_slope` a tile at most.
  if abs(ha - hb) > end_slop() and d.grounded then
    return 'Ends ' || metres(abs(ha - hb))
      || ' m apart in height; max ' || metres(end_slop()) || ' m. Level one.';
  end if;
  if abs(ha - hb) > end_slop() and abs(ha - hb) > ramp_slope() * n then
    return ramp_refusal(la, lb, abs(ha - hb), n);
  end if;
  h := round((ha + hb) / 2);
  v_rise := ramp_rise(ha, hb);
  for l in select * from bridge_lanes(p_width, p_side) order by k loop
    for r in select * from span_tiles(p_ax, p_ay, p_bx, p_by) loop
      x := r.x + l.o * px;
      y := r.y + l.o * py;
      if not in_bounds(p_world, x, y) then return 'Not there.'; end if;
      if bridge_at(p_world, x, y) is not null then return 'Already bridged there.'; end if;
      if building_at(p_world, x, y) is not null then return 'Not over a building.'; end if;
      -- Frame: nor through a jetty, a balcony and its railings (`frame_jetty_of`).
      if frame_jetty_of(p_world, x, y) is not null then return 'Not over a building''s jetty.'; end if;
      v_drop := ramp_deck(h, v_rise, n, r.n - 0.5) - surface_height(p_world, x, y);
      if v_drop < clearance() then return 'Ground under the span: needs ' || metres(clearance()) || ' m clearance.'; end if;
      -- And no deeper than its material stands.
      if d.deepest is not null and v_drop > d.deepest then
        return 'Drop under the span ' || metres(v_drop) || ' m; max ' || metres(d.deepest) || ' m (' || d.storeys || ' storeys).';
      end if;
    end loop;
  end loop;
  return null;
end $fn$;

/* One lane, its second side the east or the south, as every bridge was. */
create or replace function bridge_reason(p_world uuid, p_uid uuid, p_kind text, p_ax integer, p_ay integer, p_bx integer, p_by integer)
returns text language sql stable as $fn$
  select bridge_reason(p_world, p_uid, p_kind, p_ax, p_ay, p_bx, p_by, 1, 1)
$fn$;

/* The lanes a plan asks for, off its target: one unsaid, nought for anything but a whole number (`Target.width`). */
create or replace function bridge_width_asked(p_target jsonb)
returns int language sql immutable as $fn$
  select case when p_target->>'width' is null then 1
              when p_target->>'width' ~ '^[0-9]{1,3}$' then (p_target->>'width')::int
              else 0 end
$fn$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- last_refusal: the lanes asked for.
  v_def := pg_get_functiondef('last_refusal'::regproc);
  v_old := $$    return bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
      (p_target->>'x')::int, (p_target->>'y')::int);$$;
  v_new := $$    return bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
      (p_target->>'x')::int, (p_target->>'y')::int, bridge_width_asked(p_target),
      coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1));$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'last_refusal has % of the plan_bridge reason, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- perform_last: set out with its lanes and its piers, and say so; and what crosses it once it is open.
  v_def := pg_get_functiondef('perform_last'::regproc);
  v_old := $$  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    if bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
         (p_target->>'x')::int, (p_target->>'y')::int) is not null then return; end if;
    select * into d from bridge_def where id = v_kind;$$;
  v_new := $$  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    if bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
         (p_target->>'x')::int, (p_target->>'y')::int, bridge_width_asked(p_target),
         coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1))
         is not null then return; end if;
    select * into d from bridge_def where id = v_kind;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_last has % of the plan_bridge head, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by, level, level_b, rise)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when v_kind = 'stone' then null else 'Oak' end, p_uid,$$;
  v_new := $$    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by, level, level_b, rise, width, side)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when d.material is not null then null else 'Oak' end, p_uid,$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_last has % of the bridge insert, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$            ramp_rise(deck_height(p_world, floor(p.x)::int, floor(p.y)::int),
                      deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)))
    returning * into b;$$;
  v_new := $$            ramp_rise(deck_height(p_world, floor(p.x)::int, floor(p.y)::int),
                      deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)),
            bridge_width_asked(p_target),
            coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1))
    returning * into b;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_last has % of the bridge insert tail, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$    insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select p_world, v_id, t.n, t.x, t.y, span_bill(v_kind, t.n), span_bill(v_kind, t.n)
    from span_tiles(floor(p.x)::int, floor(p.y)::int,
                    (p_target->>'x')::int, (p_target->>'y')::int) t;$$;
  v_new := $$    -- A material bridge's piers, each billed by the storeys it stands down from the deck there (`pier_storeys`).
    select count(*)::int into v_n from span_tiles(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int);
    insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select p_world, v_id, t.n, t.x, t.y, t.bill, t.bill
    from (select st.n, st.x, st.y,
                 span_bill(v_kind, st.n, b.width,
                   case when d.material is not null and st.n = any (bridge_piers(v_n, d.bay))
                        then pier_storeys(ramp_deck(b.height, b.rise, v_n, st.n - 0.5) - surface_height(p_world, st.x, st.y)) else 0 end) as bill
            from span_tiles(floor(p.x)::int, floor(p.y)::int,
                            (p_target->>'x')::int, (p_target->>'y')::int) st) t;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_last has % of the span insert, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$    perform tell(p_world, p_uid, 'Planned: ' || lower(d.name) || ', ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || bridge_set_out(b.level, b.level_b, b.rise) || '. Per span: '
      || span_wants(span_bill(v_kind)) || '. ' || d.note, 'system');$$;
  v_new := $$    perform tell(p_world, p_uid, 'Planned: ' || lower(d.name) || ', ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || bridge_planned(p_world, b) || '. ' || d.note, 'system');$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_last has % of the planned tell, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$          || ' open. ' || case when d.carts then 'Carts may cross.'
                                  else 'Foot traffic only.' end, 'system');$$;
  v_new := $$          || ' open. ' || bridge_crosses(b), 'system');$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_last has % of the open tell, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- walk_share: wheels onto a bridge's deck only where they may cross it.
  v_def := pg_get_functiondef('walk_share'::regproc);
  v_old := $$      -- A flight of garden steps is climbed, not driven: no wheel takes one.
      if cart.id is not null and not afloat and there_tile = steps_tile() then
        return (i - 1)::double precision / n;
      end if;$$;
  v_new := $$      -- A flight of garden steps is climbed, not driven: no wheel takes one.
      if cart.id is not null and not afloat and there_tile = steps_tile() then
        return (i - 1)::double precision / n;
      end if;
      -- Onto a bridge's deck, a cart where carts cross and a wagon from `wagon_width` lanes (`deck_wheels`).
      if cart.id is not null and not afloat and spans and deck_at(p_world, tx, ty) is not null
         and not deck_wheels(p_world, deck_at(p_world, tx, ty), cart.sub) then
        return (i - 1)::double precision / n;
      end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'walk_share has % of the garden steps wheel check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- fire_refusal: a piece on a bridge's deck, a wide one's outer lanes only. Not a hull, which goes in the water under it.
  v_def := pg_get_functiondef('fire_refusal'::regproc);
  v_old := $$      if not exists (select 1 from furniture_def where id = sub) then return 'That is not something you can set down.'; end if;$$;
  v_new := $$      if not exists (select 1 from furniture_def where id = sub) then return 'That is not something you can set down.'; end if;
      if not exists (select 1 from boat_def bd where bd.id = sub) then
        v_shut := bridge_furniture_refusal(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
        if v_shut is not null then return v_shut; end if;
      end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'fire_refusal has % of the set-down check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- rpc_ground: moss on any stone bridge.
  v_def := pg_get_functiondef('rpc_ground'::regproc);
  v_old := $$'greenAgo', case when b.kind in ('stone', 'aqueduct') and not exists$$;
  v_new := $$'greenAgo', case when bridge_mossy(b.kind) and not exists$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_ground has % of the bridge moss, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- green_refusal, and the moss starting on a bridge finished.
  v_def := pg_get_functiondef('green_refusal'::regproc);
  v_old := $$if br.id is null or br.kind not in ('stone', 'aqueduct')$$;
  v_new := $$if br.id is null or not bridge_mossy(br.kind)$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'green_refusal has % of the bridge moss, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('green_span_trigger'::regproc);
  v_old := $$if b.kind in ('stone', 'aqueduct') then$$;
  v_new := $$if bridge_mossy(b.kind) then$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'green_span_trigger has % of the bridge moss, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- work_kind: a material bridge is worked as its family, stone or timber, for a perk's time (`time:bridge_stone`, `time:bridge_wood`).
  v_def := pg_get_functiondef('work_kind'::regproc);
  v_old := $$    return (select 'bridge_' || b.kind from bridge b where b.world_id = p_world and b.id = (p_target->>'id')::bigint);$$;
  v_new := $$    return (select 'bridge_' || case when d.material is null then b.kind when d.stone then 'stone' else 'wood' end
              from bridge b left join bridge_def d on d.id = b.kind
             where b.world_id = p_world and b.id = (p_target->>'id')::bigint);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'work_kind has % of the bridge work, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
