-- Bridges: each end on the storey planned at it.
--
-- Reported: "this bridge was planned from storey 4 > 4, but planned and built 4 > 5". Storey 4 pinned, the player on
-- storey 4, the far end picked on storey 4 of another building. The storey picked was never sent, and each end landed
-- on the highest finished floor of its tile (`top_deck`): a far tile with a finished storey 5 floor made a ramp up to
-- storey 5, and a storey 5 floor over the player one down from it.
--
-- Now the near end lands on the storey the player stands on, and the far end on the storey picked (the target's
-- `level`, sent while a storey is pinned; the browser's `bridgeUpTo`): that storey's finished floor, else the highest
-- under it, the ground at the least (`deck_level`). With no storey picked (Auto), the far end is the highest there is,
-- as before. `bridge_reason` takes the two storeys; its nine-argument form asks with none, as it did.

set local lock_timeout = '3s';

-- The storey a bridge's end at a tile lands on: the highest finished floor no higher than `p_upto` (any, when null),
-- not a roof, else the ground (0). `top_deck` with no bound; the browser's `Game.topDeck`.
create or replace function deck_level(p_world uuid, p_x int, p_y int, p_upto int) returns integer language sql stable as $fn$
  select coalesce((
    select max(f.level) from floor_tile f
     where f.world_id = p_world and f.x = p_x and f.y = p_y and f.level >= 1
       and (p_upto is null or f.level <= p_upto)
       and bill_done(f.needed) and f.kind <> 'roof'), 0)
$fn$;

-- The storey picked at a bridge's far end: the target's `level`, nought at the least; null when none was sent.
-- The browser's `bridgeUpTo`.
create or replace function bridge_storey_asked(p_target jsonb) returns integer language sql immutable as $fn$
  select case when jsonb_typeof(p_target->'level') = 'number'
              then greatest(0, floor((p_target->>'level')::numeric))::int end
$fn$;

CREATE OR REPLACE FUNCTION public.bridge_reason(p_world uuid, p_uid uuid, p_kind text, p_ax integer, p_ay integer, p_bx integer, p_by integer, p_width integer, p_side integer, p_la integer, p_lb integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
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
   * `end_slop` of it. Each end on the storey `p_la` and `p_lb` name, else the highest finished floor under it;
   * none named, the highest there is (`deck_level`).
   */
  la := deck_level(p_world, p_ax, p_ay, p_la);
  lb := deck_level(p_world, p_bx, p_by, p_lb);
  ha := surface_height(p_world, p_ax, p_ay) + la * wall_height();
  hb := surface_height(p_world, p_bx, p_by) + lb * wall_height();
  for l in select * from bridge_lanes(p_width, p_side) order by k loop
    for e in select * from (values (0, p_ax, p_ay, la, ha, p_la), (1, p_bx, p_by, lb, hb, p_lb)) v(i, x0, y0, lvl, h0, upto) order by i loop
      x := e.x0 + l.o * px;
      y := e.y0 + l.o * py;
      if not in_bounds(p_world, x, y) then return 'Not there.'; end if;
      v_lvl := case when l.o = 0 then e.lvl else deck_level(p_world, x, y, e.upto) end;
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
        v_h := surface_height(p_world, x, y) + v_lvl * wall_height();
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
end $function$;

-- As it was asked before the storeys: each end on the highest finished floor of its tile.
create or replace function bridge_reason(p_world uuid, p_uid uuid, p_kind text, p_ax integer, p_ay integer, p_bx integer,
    p_by integer, p_width integer, p_side integer) returns text language sql stable as $fn$
  select bridge_reason(p_world, p_uid, p_kind, p_ax, p_ay, p_bx, p_by, p_width, p_side, null::int, null::int)
$fn$;

-- perform_last and last_refusal: patched on the body in force, which the home pieces (20261120000053) also changed.
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

select pg_temp.patch_fn('public.last_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$      coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1));

  elsif p_action in ('build_bridge', 'demolish_bridge') then$o$,
  $n$      coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1),
      greatest(coalesce(p.level, 0), 0), bridge_storey_asked(p_target));

  elsif p_action in ('build_bridge', 'demolish_bridge') then$n$);

select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
  $o$        v_care double precision; v_one bigint; v_stock item; v_ql double precision;
$o$,
  $n$        v_care double precision; v_one bigint; v_stock item; v_ql double precision;
        v_la int; v_lb int; v_ha double precision; v_hb double precision;
$n$);

select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
  $o$         coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1))
         is not null then return; end if;
    select * into d from bridge_def where id = v_kind;
    v_h := round((deck_height(p_world, floor(p.x)::int, floor(p.y)::int)
                + deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)) / 2);$o$,
  $n$         coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1),
         greatest(coalesce(p.level, 0), 0), bridge_storey_asked(p_target))
         is not null then return; end if;
    select * into d from bridge_def where id = v_kind;
    -- Each end on the storey stood on and the storey picked, else the highest finished floor under it (`deck_level`).
    v_la := deck_level(p_world, floor(p.x)::int, floor(p.y)::int, greatest(coalesce(p.level, 0), 0));
    v_lb := deck_level(p_world, (p_target->>'x')::int, (p_target->>'y')::int, bridge_storey_asked(p_target));
    v_ha := surface_height(p_world, floor(p.x)::int, floor(p.y)::int) + v_la * wall_height();
    v_hb := surface_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int) + v_lb * wall_height();
    v_h := round((v_ha + v_hb) / 2);$n$);

select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
  $o$            top_deck(p_world, floor(p.x)::int, floor(p.y)::int),
            nullif(top_deck(p_world, (p_target->>'x')::int, (p_target->>'y')::int),
                   top_deck(p_world, floor(p.x)::int, floor(p.y)::int)),
            ramp_rise(deck_height(p_world, floor(p.x)::int, floor(p.y)::int),
                      deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)),$o$,
  $n$            v_la, nullif(v_lb, v_la), ramp_rise(v_ha, v_hb),$n$);

select private.lock_doors();
