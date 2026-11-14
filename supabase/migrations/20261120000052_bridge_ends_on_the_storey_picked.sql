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

CREATE OR REPLACE FUNCTION public.perform_last(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_took boolean; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        dam creature; sire creature; it item; dye item; bd brew_def; dd dye_def; v_from text;
        v_kind text; v_id bigint; v_h int; v_n int; v_left int; v_want text; v_back jsonb;
        v_parts text[]; v_half int; e record; r record; v_skill double precision;
        v_care double precision; v_one bigint; v_stock item; v_ql double precision;
        v_la int; v_lb int; v_ha double precision; v_hb double precision;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    perform perform_bauble(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'scrub_dye' then
    perform private.perform_scrub(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'set_brew_spring' then
    perform private.perform_brew_spring(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'sacrifice' then
    perform perform_sacrifice(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'absorb_soul' then
    perform perform_absorb(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = enchant_action() then
    perform perform_enchant(p_world, p_uid, p_target);
    return;
  end if;
  if memorial_action(p_action) then
    perform perform_memorial(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if vine_action(p_action) then
    perform perform_vine(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
  if bee_action(p_action) then
    perform perform_skep(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- A dye written down, and boiled again (`dyes.ts`).
  if dye_recipe_action(p_action) then
    perform perform_dye_recipe(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The garden pieces' jobs (`garden.ts`).
  if garden_action(p_action) then
    perform perform_garden(p_world, p_uid, p_action, p_target);
    return;
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    if bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
         (p_target->>'x')::int, (p_target->>'y')::int, bridge_width_asked(p_target),
         coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1),
         greatest(coalesce(p.level, 0), 0), bridge_storey_asked(p_target))
         is not null then return; end if;
    select * into d from bridge_def where id = v_kind;
    -- Each end on the storey stood on and the storey picked, else the highest finished floor under it (`deck_level`).
    v_la := deck_level(p_world, floor(p.x)::int, floor(p.y)::int, greatest(coalesce(p.level, 0), 0));
    v_lb := deck_level(p_world, (p_target->>'x')::int, (p_target->>'y')::int, bridge_storey_asked(p_target));
    v_ha := surface_height(p_world, floor(p.x)::int, floor(p.y)::int) + v_la * wall_height();
    v_hb := surface_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int) + v_lb * wall_height();
    v_h := round((v_ha + v_hb) / 2);
    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by, level, level_b, rise, width, side)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when d.material is not null then null else 'Oak' end, p_uid,
            v_la, nullif(v_lb, v_la), ramp_rise(v_ha, v_hb),
            bridge_width_asked(p_target),
            coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1))
    returning * into b;
    v_id := b.id;
    -- gates: the first span, beside the end it is set out from, also takes a drawbridge's winch.
    -- A material bridge's piers, each billed by the storeys it stands down from the deck there (`pier_storeys`).
    select count(*)::int into v_n from span_tiles(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int);
    insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select p_world, v_id, t.n, t.x, t.y, t.bill, t.bill
    from (select st.n, st.x, st.y,
                 span_bill(v_kind, st.n, b.width,
                   case when d.material is not null and st.n = any (bridge_piers(v_n, d.bay))
                        then pier_storeys(ramp_deck(b.height, b.rise, v_n, st.n - 0.5) - surface_height(p_world, st.x, st.y)) else 0 end) as bill
            from span_tiles(floor(p.x)::int, floor(p.y)::int,
                            (p_target->>'x')::int, (p_target->>'y')::int) st) t;
    select count(*)::int into v_n from bridge_span sp where sp.world_id = p_world and sp.bridge = v_id;
    perform journal_note(p_world, p_uid, 'planned_bridge');
    perform skill_raise(p_world, p_uid, d.skill, 0.4);
    perform tell(p_world, p_uid, 'Planned: ' || lower(d.name) || ', ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || bridge_planned(p_world, b) || '. ' || d.note, 'system');

  elsif p_action = 'build_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into d from bridge_def where id = b.kind;
    select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
      and not span_done(sp.needed) order by sp.n limit 1;
    if not found then return; end if;
    -- One unit of one thing per go, as with a wall.
    select e2.key into v_want from jsonb_each(s.needed) e2
      where (e2.value)::int > 0 and build_to_hand(p_world, p_uid, e2.key, s.x, s.y, null) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    -- Out of the pack, a crate on the span or the stores within reach, as a wall's is.
    if not take_material(p_world, p_uid, v_want, s.x, s.y, null) then return; end if;
    update bridge_span sp set needed = jsonb_set(sp.needed, array[v_want],
        to_jsonb(greatest(0, (sp.needed->>v_want)::int - 1)))
      where sp.world_id = p_world and sp.bridge = b.id and sp.n = s.n
      returning * into s;
    perform skill_raise(p_world, p_uid, d.skill, 0.5);
    perform wear_tool((select i.id from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = d.tool
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1), 0.4);
    if span_done(s.needed) then
      v_left := bridge_left(p_world, b.id);
      if v_left > 0 then
        perform tell(p_world, p_uid, 'Span decked. ' || v_left || ' open.', 'event');
      else
        perform journal_note(p_world, p_uid, 'bridged');
        perform journal_note(p_world, p_uid, 'bridged:' || b.kind);
        perform tell(p_world, p_uid, 'Last span decked: ' || lower(bridge_name(b))
          || ' open. ' || bridge_crosses(b), 'system');
      end if;
    else
      perform tell(p_world, p_uid, 'Added: '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || '. Span needs ' || span_wants(s.needed) || '.', 'event');
    end if;

  elsif p_action = 'demolish_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    -- Half of what went into it comes back, which is what pulling a thing down
    -- is worth anywhere else in the world.
    v_parts := '{}';
    for e in
      select k.key as item, sum((k.value)::int - coalesce((sp.needed->>k.key)::int, 0))::int as used
      from bridge_span sp cross join lateral jsonb_each(sp.total) k
      where sp.world_id = p_world and sp.bridge = b.id
      group by k.key order by k.key
    loop
      v_half := floor(e.used / 2.0)::int;
      if v_half > 0 then
        perform give(p_world, p_uid, e.item, v_half, 20);
        v_parts := v_parts || (v_half || ' ' ||
          lower((select coalesce(name, e.item) from item_def where id = e.item)));
      end if;
    end loop;
    delete from bridge_span where world_id = p_world and bridge = b.id;
    delete from bridge where world_id = p_world and id = b.id;
    perform tell(p_world, p_uid, case when array_length(v_parts, 1) > 0
      then 'Removed: ' || lower(bridge_name(b)) || '. Salvaged: '
           || array_to_string(v_parts, ', ') || '.'
      else 'Removed: ' || lower(bridge_name(b)) || '.' end, 'event');

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into p from player where world_id = p_world and uid = p_uid;
    r := deed_at(p_world, pc.x, pc.y);
    if r.world_id is null then return; end if;
    v_n := 0;
    -- Every wildermon working the deed drops what it is doing and walks to
    -- whoever rang: a leg to the ringer, and a while standing there before
    -- the work takes it back.
    for e in select cr.*, coalesce(sp.speed, 1) as pace
             from creature cr join species_def sp on sp.id = cr.species
             where cr.world_id = p_world and cr.mode = 'deed' and cr.hitched_to is null
               -- Within hearing of the bell (`bell_heard_by`).
               and sqrt(power(cr.to_x - pc.cx, 2) + power(cr.to_y - pc.cy, 2)) <= bell_heard_by(p_world, p_uid)
               and cr.keeper in (select m.uid from deed_member m
                                 where m.world_id = p_world and m.founder = r.founded_by
                                 union select r.founded_by)
    loop
      v_ql := greatest(0.5, sqrt(power(p.x - e.to_x, 2) + power(p.y - e.to_y, 2)) / greatest(0.4, e.pace));
      update creature set phase = 'idle', work_x = null, work_y = null, enemy = null,
          from_x = e.to_x, from_y = e.to_y, to_x = p.x, to_y = p.y,
          leg_at = now(), leg_ends = now() + make_interval(secs => v_ql),
          until = now() + make_interval(secs => v_ql + 20)
        where world_id = p_world and id = e.id;
      v_n := v_n + 1;
    end loop;
    -- And every citizen hears where it hangs.
    for e in select m.uid from deed_member m where m.world_id = p_world and m.founder = r.founded_by
             union select r.founded_by
    loop
      if e.uid <> p_uid and exists (select 1 from player q where q.world_id = p_world and q.uid = e.uid
                                      and sqrt(power(q.x - pc.cx, 2) + power(q.y - pc.cy, 2)) <= bell_heard_by(p_world, p_uid)) then
        perform tell(p_world, e.uid, 'The bell rings out over ' || r.name || ' from ' || pc.x || ', ' || pc.y || '.', 'system');
      end if;
    end loop;
    perform journal_note(p_world, p_uid, 'rang');
    perform tell(p_world, p_uid, 'Rang: ' || lower(placed_name(pc)) || ' at ' || pc.x || ', ' || pc.y || '. Heard within '
      || floor(bell_heard_by(p_world, p_uid) + 0.5)::int || ' tiles. Settlement workers called: '
      || v_n || '. Citizens of ' || r.name || ' in hearing notified.', 'event');

  elsif p_action = 'sleep' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    /*
     * A well-made bed is a better night than a cot with a thin mattress — and
     * a bed under a roof, in a room with walls all round it, is a better night
     * again than the same bed standing in a field in the weather.
     */
    perform journal_note(p_world, p_uid, 'slept');
    -- In a bed you built, for the journal.
    if pc.made_by = p_uid then perform journal_note(p_world, p_uid, 'slept:own'); end if;
    -- Lain down in it and logged off, asleep until the next join (`sleep_fall`, `private.sleep_wake`).
    perform sleep_fall(p_world, p_uid, pc);

  elsif p_action = 'set_home' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    update player set home_x = pc.x, home_y = pc.y where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'Home set: ' || lower(placed_name(pc))
      || '. You respawn here.', 'event');

  elsif p_action = 'pair_creature' then
    c := target_creature(p_world, p_target);
    mate := mate_for(p_world, c);
    if c.world_id is null or mate.id is null or pair_refuses(p_world, c, mate) is not null
       or cross_refuses(p_world, p_uid, c, mate) is not null then return; end if;
    if c.sex = 'female' then dam := c; sire := mate; else dam := mate; sire := c; end if;
    v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
    v_care := (dam.care + sire.care) / 2;
    v_took := random() < pair_chance(v_skill, v_care, cross_of(dam.species, sire.species) is not null);
    perform skill_raise(p_world, p_uid, 'animal_husbandry', try_gain(v_took, breed_gain()));
    if not v_took then
      -- A failed pairing costs both of them a rest, but only half of one.
      -- Half a shorter one for the breeder's Short Rest.
      update creature set bred_at = now() - make_interval(secs => breed_rest() * (1 - pk(p_world, p_uid, 'breed:rest', 1) / 2))
        where world_id = p_world and id in (dam.id, sire.id);
      perform tell(p_world, p_uid, 'Pairing failed: ' || dam.name || ' and ' || sire.name || '.', 'error');
      return;
    end if;
    perform pair_them(p_world, dam.id, sire.id, v_skill, p_uid, p_target->>'sex');
    perform journal_note(p_world, p_uid, 'paired');
    perform wtell(p_world, p_uid, 'Paired: ' || sire.name || ' with ' || dam.name
      || coalesce(' (cross: ' || (select x.name from species_def x where x.id = cross_of(dam.species, sire.species)) || ')', '')
      || '. Due in ' || clock_left(gestation_of(pk(p_world, p_uid, 'breed:gestation', 1), dam))
      || '. Traits between them: '
      || trait_names((select array_agg(distinct t) from unnest(sire.traits || dam.traits) t))
      || '.', 'event');

  elsif p_action = 'read_blood' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    perform wtell(p_world, p_uid, blood_read(p_world, p_uid, c), 'event');

  elsif p_action = 'dye_item' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    -- The litres the thing takes, out of the bucket or barrel chosen (`pickDye`), and exactly its colour.
    v_n := dye_litres_for(it.def);
    v_from := dye_pick(p_world, p_uid, v_n, p_target);
    if v_from is null then return; end if;
    v_want := dye_source_hex(p_world, p_uid, v_from);
    if not dye_spend(v_from, v_n) then return; end if;
    -- A stack is split so the rest stays as it was.
    if it.count > 1 then
      update item set count = count - 1 where id = it.id;
      insert into item (world_id, holder, holder_uid, def, ql, dmg, count, extra, rare, dye)
      values (p_world, it.holder, it.holder_uid, it.def, it.ql, it.dmg, 1, it.extra, it.rare, v_want);
    else
      update item set dye = v_want where id = it.id;
    end if;
    perform journal_note(p_world, p_uid, 'dyed');
    perform journal_note(p_world, p_uid, 'dyed:' || it.def);
    perform skill_raise(p_world, p_uid, 'alchemy', 0.3);
    perform tell(p_world, p_uid, 'Dyed: ' || colour_word(v_want)
      || ' (' || v_want || '). Dye used: ' || litres_word(v_n) || '.', 'event');

  elsif p_action = 'strip_dye' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    select * into dye from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = 'lye_bucket' order by i.id limit 1;
    if dye.id is null or not take_litres(p_world, p_uid, 'lye_bucket', lye_use(), false) then return; end if;
    update item set dye = null where id = it.id;
    perform skill_raise(p_world, p_uid, 'alchemy', 0.2);
    perform tell(p_world, p_uid, 'Dye removed: plain '
      || lower((select coalesce(name, it.def) from item_def where id = it.def)) || '.', 'event');

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if bd.id is null or pc.id is null
       or brew_reason(p_world, p_uid, pc, bd) is not null then return; end if;
    -- What goes in decides most of what comes out; the hand only decides how
    -- much of it survives the working.
    select i.* into v_stock from craft_stock(p_world, p_uid) h join item i on i.id = h.id
      where h.def = bd.input order by h.draw limit 1;
    v_ql := coalesce(v_stock.ql, 20);
    if not skill_check(skill_of(p_world, p_uid, 'brewing'), bd.difficulty, 0) then
      v_parts := craft_fail_damage(p_world, p_uid, bd.input, bd.count)
        || fail_litres_said((select l.name from liquid_def l where l.id = 'water'), bd.litres,
                            least(placed_litres(pc), fail_litres_of(bd.litres, pc.ql)));
      update placed set litres = placed_litres(pc) - least(placed_litres(pc), fail_litres_of(bd.litres, pc.ql)), since = now()
        where id = pc.id;
      update placed set liquid = null where id = pc.id and litres <= 0;
      perform skill_raise(p_world, p_uid, 'brewing', try_gain(false, brew_gain()));
      perform tell(p_world, p_uid, fail_damaged_said('Failed: ' || lower(bd.name) || '.', v_parts), 'event');
      return;
    end if;
    if not craft_consume(p_world, p_uid, bd.input, bd.count) then return; end if;
    update placed set litres = bd.litres, liquid = bd.id, ferment = private.brew_seconds(pc, bd), since = now(),
        ql = greatest(1, least(100, (v_ql + skill_of(p_world, p_uid, 'brewing')) / 2)),
        -- Its brewer's hand in it, which goes into every bucket drawn off it (a Cook's Strong Brew).
        knack = nullif(pk(p_world, p_uid, 'brewed:' || bd.id, 1), 1)
      where id = pc.id;
    perform journal_note(p_world, p_uid, 'brew');
    perform journal_note(p_world, p_uid, 'brew:' || bd.id);
    perform skill_raise(p_world, p_uid, 'brewing', try_gain(true, brew_gain()));
    -- Rounded half up, as the browser's `Math.round` does: a wine's 112.5 minutes said 112 here and 113 there.
    perform tell(p_world, p_uid, bd.done || ' Ready in about ' || floor(private.brew_seconds(pc, bd) / 60 + 0.5)::bigint || ' minutes.', 'event');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.last_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_rank text; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        it item; dye item; bd brew_def; v_kind text; v_short text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    return bauble_refusal(p_world, p_uid, p_target);
  end if;
  -- Scrub off dye: a brush, no lye (`private.scrub_refusal`).
  if p_action = 'scrub_dye' then
    return private.scrub_refusal(p_world, p_uid, p_target);
  end if;
  -- A brewer's spring: a water mote into a barrel (`private.brew_spring_refusal`).
  if p_action = 'set_brew_spring' then
    return private.brew_spring_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'sacrifice' then
    return sacrifice_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'absorb_soul' then
    return absorb_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = enchant_action() then
    return enchant_refusal(p_world, p_uid, p_target);
  end if;
  if memorial_action(p_action) then
    return memorial_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if vine_action(p_action) then
    return vine_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
  if bee_action(p_action) then
    return skep_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A dye written down, and boiled again (`dyes.ts`).
  if dye_recipe_action(p_action) then
    return dye_recipe_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The garden pieces' jobs (`garden.ts`).
  if garden_action(p_action) then
    return garden_refusal(p_world, p_uid, p_action, p_target);
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    return bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
      (p_target->>'x')::int, (p_target->>'y')::int, bridge_width_asked(p_target),
      coalesce(nullif(bridge_side_step(floor(p.x)::int, floor(p.y)::int, (p_target->>'x')::int, (p_target->>'y')::int, p_target->>'side'), 0), 1),
      greatest(coalesce(p.level, 0), 0), bridge_storey_asked(p_target));

  elsif p_action in ('build_bridge', 'demolish_bridge') then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return 'It is gone.'; end if;
    select * into d from bridge_def where id = b.kind;
    if p_action = 'build_bridge' then
      select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
        and not span_done(sp.needed) order by sp.n limit 1;
      if not found then return 'Finished.'; end if;
      if tool_ql(p_world, p_uid, d.tool) <= 0 then
        return 'Need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';
      end if;
      if sqrt((s.x + 0.5 - p.x) ^ 2 + (s.y + 0.5 - p.y) ^ 2) > 4.5 then
        return 'Stand by the open span.';
      end if;
      select e.key into v_short from jsonb_each(s.needed) e
        where (e.value)::int > 0 and not exists (select 1 from jsonb_each(s.needed) e3
          where (e3.value)::int > 0 and build_to_hand(p_world, p_uid, e3.key, s.x, s.y, null) > 0) order by e.key limit 1;
      -- Piece by piece, as a wall: refused only when nothing it wants is to hand.
      if v_short is not null then
        return 'Span needs ' || span_wants(s.needed) || '; none to hand.';
      end if;
    else
      -- gates: the far end's row, quoted: a record's field named by a reserved word is not found unquoted, so
      -- this refused nothing and raised "record b has no field by" instead, and nobody could pull a bridge down;
      -- and the reach, written once (`bridge_pull_reach`, `PULL_REACH`).
      if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
         and sqrt((b.bx + 0.5 - p.x) ^ 2 + (b."by" + 0.5 - p.y) ^ 2) > bridge_pull_reach() then
        return 'Stand at one end of it.';
      end if;
      -- gates: where either end stands on a settlement, only its builders pull a bridge down, as only they take
      -- down a building's wall there (`may_shape`); anywhere else anybody may (`pullDownRefusal`).
      select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_short, v_rank
        from (values (1, b.ax, b.ay), (2, b.bx, b."by")) v(o, x, y)
        cross join lateral deed_covering(p_world, v.x, v.y) dd
       where not may_shape(p_world, p_uid, v.x, v.y)
       order by v.o, dd.founded_at limit 1;
      if v_short is not null then
        return coalesce(v_rank, 'Part of ' || v_short || ': only builders may '
            || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
      end if;
      -- gates: a padlock on a drawbridge's winch keeps it from being pulled down as from being worked.
      v_short := lock_refusal(p_world, p_uid, b.lock, b.ax, b.ay);
      if v_short is not null then return v_short; end if;
    end if;
    return null;

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not coalesce((select f.bell from furniture_def f where f.id = pc.sub), false) then
      return 'Not a bell.';
    end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if not on_my_deed(p_world, p_uid, pc.x, pc.y) then
      return 'Only on your settlement.';
    end if;
    -- Rung on a bell rope (`ropework.ts`).
    if pack_count(p_world, p_uid, bell_rope_item()) < 1 then return no_bell_rope_said(); end if;
    return null;

  elsif p_action in ('sleep', 'set_home') then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not is_bed(pc) then return 'Not a bed.'; end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if p_action = 'sleep' then
      if not coalesce(pc.made_by = p_uid, false) and not on_my_deed(p_world, p_uid, pc.x, pc.y) then
        return sleep_not_yours(placed_name_in_line(pc));
      end if;
      if p.act is not null and p.act <> 'sleep' then return sleep_said('busy'); end if;
      if is_fight(p.act) or exists (select 1 from creature cr where cr.world_id = p_world and cr.hunting = p_uid
                                       and cr.mode = 'wild' and cr.health > 0) then
        return sleep_said('fight');
      end if;
      if exists (select 1 from creature cr where cr.world_id = p_world and cr.rider = p_uid) then return sleep_said('mounted'); end if;
    end if;
    if p_action = 'set_home' and p.home_x = pc.x and p.home_y = pc.y then
      return 'Already your home.';
    end if;
    return null;

  elsif p_action in ('pair_creature', 'read_blood') then
    perform creature_settle(p_world, (p_target->>'id')::int);
    perform herd_settle(p_world);
    c := target_creature(p_world, p_target);
    if c.world_id is null then return 'It is gone.'; end if;
    if p_action = 'read_blood' then return null; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'Need a settlement: the young go to its totem.';
    end if;
    if not creature_in_reach(p_world, p_uid, c, 2.4) then return 'Stand next to ' || c.name || '.'; end if;
    if c.due is not null then return c.name || ' is already pregnant.'; end if;
    if hybrid_kind(c.species) then return infertile_said(c.name); end if;
    mate := mate_for(p_world, c);
    if mate.id is null then
      return 'No ' || lower((select name from species_def where id = c.species))
        || ' of the other sex within ' || round(pair_range()) || ' tiles. ' || c.name
        || ' is ' || c.sex || '.';
    end if;
    return coalesce(pair_refuses(p_world, c, mate), cross_refuses(p_world, p_uid, c, mate));

  elsif p_action in ('dye_item', 'strip_dye') then
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid;
    if p_action = 'dye_item' then
      if not found then return 'It is gone.'; end if;
      if not takes_dye(it.def) then return 'Cannot be dyed.'; end if;
      -- Out of the bucket or barrel chosen (`dyeFrom`), or the only one that holds enough (`dyeReason`).
      return dye_reason(p_world, p_uid, dye_litres_for(it.def), p_target, it.dye);
    else
      if not found or it.dye is null or not takes_dye(it.def) then return 'No colour to remove.'; end if;
      if litres_at_hand(p_world, p_uid, 'lye_bucket', false) < lye_use() then
        return 'Need ' || lye_use() || ' L lye.';
      end if;
    end if;
    return null;

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    if not found then return 'Choose what to brew.'; end if;
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    return brew_reason(p_world, p_uid, pc, bd);
  end if;
  return null;
end $function$;

select private.lock_doors();
