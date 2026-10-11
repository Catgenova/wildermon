-- Enchanting part 3: things standing where they were set down, and the first two enchantments that go on them.
--
-- A scroll goes into a piece of furniture, a smelter, a kiln, an anvil or a
-- trap where it stands, from within reach, with the scroll in the pack, when
-- the thing is yours to use past any padlock. It takes as it takes in the
-- pack, at the thing's QL. A go that does not take leaves the scroll's harm on
-- it but never breaks it: the harm stops a point short of broken, and there is
-- no break roll (placed_harm). The enchantment and the wear ride on the placed
-- row and go back on the item when it is picked up, and come down off the item
-- when it is set down again.
--
-- Ember Heart (2 fire, a smelter or a kiln): it burns QL/2 % less fuel for the
-- same work (placed_burn_rate, furnace_settle). Masterwork (fire + light, an
-- anvil or a loom): a thing made at it comes out QL/20 points of quality
-- higher, never past 100 (perform_forge, perform_craft, station_master).
--
-- Rewritten from their newest definitions:
--   perform_fire     20261002115207_shop_counters_and_lantern_posts.sql
--   perform_forge    20261011023246_lanterns_grace.sql
--   perform_trap     20260927121838_the_mender_moved_onto_perks.sql
--   enchant_refusal  20261010230740_enchanting.sql
--   perform_enchant  20261010230740_enchanting.sql
--   perform_craft    20261010230740_enchanting.sql
--   furnace_settle   20260918164655_what_a_furnace_finishes_waits_as_a_stack.sql
--   placed_burn_rate 20260916370000_a_fire_where_you_want_one.sql
--   enchant_figure   20261011025047_a_pack_a_coat_and_a_hat.sql

select private.shut('alter table placed add column if not exists enchant jsonb');

CREATE OR REPLACE FUNCTION public.perform_fire(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p placed; it item; sz int[]; ax int; ay int; per double precision; room double precision;
        fits int; whole int; sub text; made bigint; back text;
begin
  if p_action = 'build_campfire' then
    ax := least(subtiles() - 2, greatest(0, (p_target->>'sx')::int));
    ay := least(subtiles() - 2, greatest(0, (p_target->>'sy')::int));
    if not consume(p_world, p_uid, 'shaft', 2) then return; end if;
    insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by)
    values (p_world, 'campfire', (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + 1.0) / subtiles(), (p_target->>'y')::int + (ay + 1.0) / subtiles(),
            120, p_uid);
    perform tell(p_world, p_uid, 'You lay a campfire from 2 shafts. Light it, or feed it more wood first.', 'event');
    perform land_announce(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
    return;
  end if;

  if p_action in ('place_smelter', 'place_furniture', 'place_kiln') then
    select * into it from item where id = target_item(p_target);
    -- A piece stands there as whatever it was in the pack. This read the def
    -- through replace(it.def, 'furniture_', '') for as long as the pick-up put
    -- that prefix on, which meant the two halves disagreed about what an item
    -- is called and only one of them ever said so. Neither does now.
    sub := case when p_action = 'place_furniture' then it.def end;
    -- Which way it faces, which is the browser's to say and south when it says nothing.
    back := case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end;
    sz := placed_size(case p_action when 'place_smelter' then 'smelter'
                                    when 'place_kiln' then 'kiln' else 'furniture' end, sub, back);
    ax := least(subtiles() - sz[1], greatest(0, coalesce((p_target->>'sx')::int, 0)));
    ay := least(subtiles() - sz[2], greatest(0, coalesce((p_target->>'sy')::int, 0)));
    /*
     * The quality, and -- new here -- the rarity and the wood.
     *
     * A piece set down used to reach the ground with nothing but its quality.
     * Its rarity went in the bin, so a rare chest was a rare chest right up
     * until somebody put it in a room and then it was a chest; and its wood
     * went with it, so an oak chest and a pine one were the same chest the
     * moment they were standing. Both are on the item being consumed here,
     * and both come across now.
     */
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, rare, material, creature, mark, dye, enchant, dmg)
    values (p_world, case p_action when 'place_smelter' then 'smelter'
                                   when 'place_kiln' then 'kiln' else 'furniture' end, sub,
            (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + sz[1] / 2.0) / subtiles(),
            (p_target->>'y')::int + (ay + sz[2] / 2.0) / subtiles(),
            it.ql, p_uid, back, it.rare, it.extra,
            case when p_action = 'place_furniture' then it.creature end,
            -- And its maker's mark, which it carries wherever it stands.
            it.mark,
            -- And its colour: a banner, a flag or a sail dyed in the pack stands dyed.
            it.dye,
            -- And its enchantment and its wear, which it keeps standing and takes up again (`enchanting.ts`).
            it.enchant, it.dmg)
    returning id into made;
    delete from item where id = it.id;
    -- And whoever is shut in it stands where it stands, and is seen in it.
    if p_action = 'place_furniture' and it.creature is not null then
      update creature c set from_x = pl.cx, from_y = pl.cy, to_x = pl.cx, to_y = pl.cy,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        from placed pl where pl.id = made and c.world_id = p_world and c.id = it.creature;
    end if;
    perform tell(p_world, p_uid, 'You set the ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end)) || ' down'
      || coalesce(' with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature) || ' in it', '')
      || '.', 'event');
    perform land_announce(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
    return;
  end if;

  perform placed_settle(nullif(p_target->>'id', '')::bigint);
  p := target_placed(p_world, p_target);
  if p.id is null then return; end if;

  if p_action in ('light_campfire', 'light_smelter', 'light_kiln') then
    update placed set lit = true, since = now() where id = p.id;
    if p_action = 'light_campfire' then perform journal_note(p_world, p_uid, 'fire'); end if;
    perform tell(p_world, p_uid, 'The kindling catches and the ' || p.kind || ' burns. It has '
      || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel.', 'event');
  elsif p_action in ('put_out_campfire', 'damp_smelter', 'damp_kiln') then
    update placed set lit = false, since = now() where id = p.id;
    perform tell(p_world, p_uid, 'You smother the fire. The wood is saved for later.', 'event');
  elsif p_action in ('fuel_campfire', 'fuel_smelter', 'fuel_kiln') then
    -- From what is at hand: the pack, a bag, or a store within reach.
    select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
      where (s.id = target_item(p_target) or fuel_value(s.def) is not null)
      order by (s.id = target_item(p_target)) desc, s.draw limit 1;
    per := fuel_value(it.def);
    room := greatest(0, fire_capacity() - p.fuel);
    /*
     * How many you asked for, which this never read.
     *
     * Reported as "attempting to feed one coal to a smelter puts four coal
     * in". The menu offers one or all and sends the count either way; this
     * fed as much as would fit whatever it was told, so a firebox with room
     * in it swallowed the whole pile on a single "one". The browser has read
     * the count since fuelling was written.
     */
    fits := greatest(1, least(least(coalesce((p_target->>'count')::int, 1), it.count),
                              ceil(room / per)::int));
    if not spend_stack(p_world, p_uid, it.id, fits) then return; end if;
    update placed set fuel = least(fire_capacity(), p.fuel + per * fits), since = now() where id = p.id;
    perform tell(p_world, p_uid, 'You feed ' || case when fits > 1 then fits || ' × ' else 'a ' end
      || lower((select name from item_def where id = it.def)) || ' to the fire. '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || ' of fuel.', 'event');
  elsif p_action in ('take_ashes_fire', 'take_ashes_smelter', 'take_ashes_kiln') then
    whole := floor(p.ash)::int;
    update placed set ash = p.ash - whole, since = now() where id = p.id;
    perform give(p_world, p_uid, 'ash', whole, 20);
    perform tell(p_world, p_uid, 'You rake ' || whole || case when whole = 1 then ' lot' else ' lots' end
      || ' of ashes out of the ' || p.kind || '. (QL 20)', 'event');
  elsif p_action = 'take_apart_campfire' then
    -- Coal burns but is never got back, so a pile of logs cannot be turned
    -- into coal by rebuilding the fire.
    delete from placed where id = p.id;
    perform give(p_world, p_uid, 'shaft', 2, 20);
    perform tell(p_world, p_uid, 'You take the campfire apart and save what will burn again.', 'event');
    perform land_announce(p_world, p.x, p.y);
  elsif p_action = 'turn_furniture' then
    -- A quarter turn to the right, walked to the nearest spot the turned block fits.
    back := lamp_turns_to(p_world, p);  -- on round past a facing a post's arm would go into a wall (`lamps.ts`)
    sz := placed_size(p.kind, p.sub, back);
    ax := least(subtiles() - sz[1], greatest(0, p.sx));
    ay := least(subtiles() - sz[2], greatest(0, p.sy));
    update placed set facing = back, sx = ax, sy = ay,
        cx = p.x + (ax + sz[1] / 2.0) / subtiles(), cy = p.y + (ay + sz[2] / 2.0) / subtiles()
      where id = p.id;
    perform tell(p_world, p_uid, 'You turn the ' || lower(placed_name(p)) || ' to face ' || side_name(back) || '.', 'event');
    perform land_announce(p_world, p.x, p.y);

  elsif p_action in ('pick_up_smelter', 'pick_up_furniture', 'pick_up_kiln') then
    /*
     * What goes back in the pack is the thing's own definition, which for a
     * piece of furniture is its `sub` and nothing else.
     *
     * It used to be 'furniture_' || p.sub. There is no such item: the
     * catalogue calls a wagon a wagon, so picking one up put a row in your
     * pack with a definition nothing has ever heard of. It showed as its own
     * id under OTHER, weighed whatever the fallback weighs, and could not be
     * set down again, because the browser asks `isFurniture` of the id it is
     * holding and the answer was no. The wagon was not lost, but it was not a
     * wagon either.
     *
     * The other half of the pair hid it: `place_furniture` reads its `sub`
     * with replace(it.def, 'furniture_', ''), so it would have accepted the
     * broken id perfectly well and nothing on this side ever complained.
     */
    back := case p.kind when 'smelter' then 'smelter' when 'kiln' then 'kiln'
                        else p.sub end;
    -- And back the same way: what it stood there as is what goes in the pack.
    -- `give` has taken a material and a rarity since the day it was written.
    -- Given before the piece comes up, so a crate's wildermon is never in no crate at all.
    made := give(p_world, p_uid, back, 1, p.ql, p.material, p.rare);
    if p.mark is not null then update item set mark = p.mark where id = made; end if;
    -- And its colour, back on the thing in the pack.
    if p.dye is not null then update item set dye = p.dye where id = made; end if;
    -- And its enchantment and its wear, back on the thing in the pack.
    update item set enchant = p.enchant, dmg = p.dmg where id = made;
    if p.creature is not null then
      update item set creature = p.creature where id = made;
      update creature c set from_x = py.x, from_y = py.y, to_x = py.x, to_y = py.y,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        from player py where py.world_id = p_world and py.uid = p_uid
          and c.world_id = p_world and c.id = p.creature;
    end if;
    delete from placed where id = p.id;
    perform tell(p_world, p_uid, 'You take up the '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(' with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature) || ' in it', '')
      || '.', 'event');
    perform land_announce(p_world, p.x, p.y);
  end if;
end $function$;;

CREATE OR REPLACE FUNCTION public.perform_forge(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_struck boolean; v_pure boolean; p placed; it item; v_mould item; d mould_def; v_lump item; m metal_def; v_cast item;
        v_per double precision; v_room double precision; v_fits int; v_whole int;
        v_ql double precision; v_mould_ql double precision; v_hard double precision;
        v_rare text; v_made bigint; v_broke boolean; v_sz int[]; v_sx int; v_sy int; v_left double precision;
        v_count int; v_kept boolean;
begin
  if p_action in ('fuel_oven', 'light_oven', 'put_out_oven', 'take_ashes_oven') then
    perform placed_settle((p_target->>'id')::bigint);
    select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;

    if p_action = 'fuel_oven' then
      select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
        where fuel_value(s.def) is not null
          and (target_item(p_target) is null or s.id = target_item(p_target))
        order by s.draw limit 1;
      if not found then return; end if;
      v_per := fuel_value(it.def);
      v_room := greatest(0, hearth_capacity(p) - p.fuel);
      v_fits := greatest(1, least(least(coalesce((p_target->>'count')::int, 1), it.count),
                                  ceil(v_room / v_per)::int));
      if not spend_stack(p_world, p_uid, it.id, v_fits) then return; end if;
      update placed set fuel = least(hearth_capacity(p), p.fuel + v_per * v_fits), since = now()
        where id = p.id;
      perform tell(p_world, p_uid, 'You feed '
        || case when v_fits > 1 then v_fits || ' × ' else 'a ' end
        || lower((select name from item_def where id = it.def)) || ' into the oven. '
        || oven_burns_for(least(hearth_capacity(p), p.fuel + v_per * v_fits) / placed_burn_rate(p)) || ' of fuel.', 'event');

    elsif p_action = 'light_oven' then
      update placed set lit = true, since = now() where id = p.id;
      perform tell(p_world, p_uid, 'The oven draws and the fire takes hold. '
        || oven_burns_for(p.fuel) || ' of fuel.', 'event');

    elsif p_action = 'put_out_oven' then
      update placed set lit = false, since = now() where id = p.id;
      perform tell(p_world, p_uid,
        'You rake the fire out of the oven. It will keep its heat for nobody.', 'event');

    elsif p_action = 'take_ashes_oven' then
      v_whole := floor(p.ash)::int;
      update placed set ash = p.ash - v_whole, since = now() where id = p.id;
      perform give(p_world, p_uid, 'ash', v_whole, 20);
      perform tell(p_world, p_uid, 'You rake ' || v_whole
        || case when v_whole = 1 then ' lot' else ' lots' end
        || ' of ashes out of the oven. (QL 20)', 'event');
    end if;
    return;
  end if;

  if p_action in ('candle_lantern', 'light_lantern', 'douse_lantern') then
    perform lantern_settle(target_item(p_target));
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if not found then return; end if;
    if p_action = 'candle_lantern' then
      if not consume(p_world, p_uid, 'candle', 1) then return; end if;
      update item set charges = round(held_burn(it))::int, lit = false, lit_at = null
        where id = it.id;
      perform tell(p_world, p_uid, 'You set a candle in the lantern. '
        || ceil(held_burn(it) / 60) || ' minutes of it, at a guess.', 'event');
    elsif p_action = 'light_lantern' then
      -- A torch is wound and then lit; the pitch in it only starts burning at
      -- the moment it catches, so its clock starts here rather than at the bench.
      if it.def = 'torch' and candle_left(it) <= 0 then
        update item set charges = round(held_burn(it))::int where id = it.id;
        select * into it from item where id = it.id;
      end if;
      update item set lit = true, lit_at = now() where id = it.id;
      perform tell(p_world, p_uid, case when it.def = 'torch'
        then 'You touch the torch to the ' || flame_near(p_world, p_uid, it.id)
             || ' and it takes. ' || ceil(candle_left(it) / 60) || ' minutes of it, throwing '
             || held_reach_of(it) || ' tiles.'
        else 'You take a light off the ' || flame_near(p_world, p_uid, it.id)
             || ' and the lantern throws it ' || held_reach_of(it) || ' tiles.' end, 'event');
    else
      v_left := candle_left(it);
      update item set lit = false, lit_at = null, charges = round(v_left)::int where id = it.id;
      perform tell(p_world, p_uid, case when it.def = 'torch'
        then 'You smother the torch. ' || ceil(v_left / 60)
             || ' minutes of it left, if it will take again.'
        else 'You pinch the wick out. ' || ceil(v_left / 60) || ' minutes of candle saved.' end, 'event');
    end if;
    return;
  end if;

  if p_action = 'place_anvil' then
    select * into it from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'anvil' and not locked
      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
    if not found then return; end if;
    v_sx := least(subtiles() - anvil_subtiles(), greatest(0, coalesce((p_target->>'sx')::int, 0)));
    v_sy := least(subtiles() - anvil_subtiles(), greatest(0, coalesce((p_target->>'sy')::int, 0)));
    -- An anvil's metal rides in `sub`, and its rarity now rides beside it.
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, rare, enchant, dmg)
    values (p_world, 'anvil', coalesce(it.extra, 'copper'),
            (p_target->>'x')::int, (p_target->>'y')::int, v_sx, v_sy,
            (p_target->>'x')::int + (v_sx + 1.0) / subtiles(),
            (p_target->>'y')::int + (v_sy + 1.0) / subtiles(), it.ql, p_uid, it.rare, it.enchant, it.dmg)
    returning * into p;
    delete from item where id = it.id;
    perform tell(p_world, p_uid, 'You set the ' || lower(anvil_name(p))
      || ' down. Bring a casting to it.', 'event');
    perform land_announce(p_world, p.x, p.y);
    return;
  end if;

  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
  if not found then return; end if;

  if p_action = 'pick_up_anvil' then
    v_made := give(p_world, p_uid, 'anvil', 1, p.ql, p.sub, p.rare);
    -- Its enchantment and its wear come up with it (`enchanting.ts`).
    update item set enchant = p.enchant, dmg = p.dmg where id = v_made;
    perform tell(p_world, p_uid, 'You heave the ' || lower(anvil_name(p))
      || ' up onto your shoulder.', 'event');
    delete from placed where id = p.id;
    perform land_announce(p_world, p.x, p.y);
    return;
  end if;

  -- Smithing: the mould, the metal, the anvil and the hands, in that order.
  if p_action = 'strike_coins' then
    -- The die wears with every strike, good or bad, and no die can be mended.
    select * into v_mould from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'coin_die' order by tool_worth(ql, dmg, extra, rare, bless) desc limit 1;
    v_lump := smith_lump(p_world, p_uid, target_item(p_target));
    m := metal_by_bar(v_lump.def);
    if v_mould.id is null or v_lump.id is null or m.id is null or not m.coins then return; end if;
    -- A bar is broken into for the lump a strike takes (a Smith's Ingots).
    v_lump := unbar(p_world, p_uid, v_lump.id, 1);
    if v_lump.id is null or not spend_stack(p_world, p_uid, v_lump.id, 1) then return; end if;
    v_mould_ql := greatest(1, v_mould.ql - v_mould.dmg / 2);
    v_broke := v_mould.dmg + die_wear() >= 100;
    if v_broke then
      delete from item where id = v_mould.id;
    else
      update item set dmg = least(100, v_mould.dmg + die_wear()) where id = v_mould.id;
    end if;
    v_hard := coin_difficulty() + (mat_of(v_lump.extra)).difficulty;
    -- The smith's hand, and then the gold itself: poor metal will not take the
    -- die however well it is struck (`coinPurity`). A Smith's Sure Hammer fails
    -- half as often (`fail:` and the job). The lump is gone either way.
    v_struck := skill_check(skill_of(p_world, p_uid, 'blacksmithing'), v_hard, anvil_ql(p), mind_ease(p_world, p_uid));
    v_pure := random() < 1 - coin_ql_weight() * (1 - least(100, greatest(0, v_lump.ql)) / 100);
    if not perk_pass(v_struck and v_pure, pk(p_world, p_uid, 'fail:' || p_action, 1)) then
      perform skill_raise(p_world, p_uid, 'blacksmithing', try_gain(false, smith_gain()));
      perform tell(p_world, p_uid, case when v_struck then 'The gold is too poor to take the die and the blanks crack'
                                        else 'The blanks come out smeared' end || '; the lump is lost.'
        || case when v_broke then ' The die is worn through.' else '' end, 'event');
      return;
    end if;
    -- And higher for a Masterwork on the anvil (`enchanting.ts`).
    v_ql := least(100, smith_ql(p_world, p_uid, 'blacksmithing', v_mould_ql, v_lump.ql, anvil_ql(p)) + placed_enchant(p, 'master'));
    perform skill_raise(p_world, p_uid, 'blacksmithing', try_gain(true, smith_gain()));
    v_rare := rarity_roll();
    v_made := give(p_world, p_uid, 'coin', coins_per_lump()::int, v_ql, m.name, v_rare, maker_mark(p_world, p_uid, v_rare));
    perform journal_made(p_world, p_uid, 'coin', v_ql, coins_per_lump()::int, v_rare);
    perform journal_note(p_world, p_uid, 'minted');
    if v_rare is not null then
      perform journal_note(p_world, p_uid, v_rare);
      perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
    end if;
    perform tell(p_world, p_uid, 'You strike ' || coins_per_lump()::int || ' ' || lower(m.name)
      || ' coins on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')'
      || case when v_broke then ' The die is worn through and done.'
              else ' The die has ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');
    return;
  end if;

  -- Smithing: a casting poured at the smelter, beaten true on the anvil.
  v_cast := smith_casting(p_world, p_uid, target_item(p_target));
  select * into d from mould_def where makes = v_cast.piece;
  m := metal_by_name(v_cast.extra);
  if v_cast.id is null or d.id is null or m.id is null then return; end if;

  -- The deeper the seam it came out of, the harder it is to beat into shape.
  -- Rolled before the casting is spent, so that a Smith's Second Heat has a
  -- casting to keep; and a Smith's Sure Hammer fails half as often.
  v_hard := d.difficulty + (mat_of(v_cast.extra)).difficulty;
  if not perk_pass(skill_check(skill_of(p_world, p_uid, d.skill), v_hard, anvil_ql(p),
                               mind_ease(p_world, p_uid)), pk(p_world, p_uid, 'fail:' || p_action, 1)) then
    v_kept := random() < pk(p_world, p_uid, 'spare:' || p_action, 0);
    if not v_kept and not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;
    perform skill_raise(p_world, p_uid, d.skill, try_gain(false, smith_gain()));
    perform tell(p_world, p_uid, 'The '
      || lower((select name from item_def where id = d.makes))
      || ' comes out misshapen and '
      || case when v_kept then 'goes back into the fire: the casting is kept.' else 'you throw the metal back.' end, 'event');
    return;
  end if;
  if not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;

  -- The casting carries the mould and the metal it was poured from, so it stands for both.
  -- Better for a Smith's Toolsmith on a tool's head or blade (`ql:` and the piece).
  v_ql := least(100, smith_ql(p_world, p_uid, d.skill, v_cast.ql, v_cast.ql, anvil_ql(p))
                     * pk(p_world, p_uid, 'ql:' || d.makes, 1) + placed_enchant(p, 'master'));
  perform skill_raise(p_world, p_uid, d.skill, try_gain(true, smith_gain()));
  -- Rarer odds for a Smith's Master's Mark (`rare:smith`).
  v_rare := perk_rare(pk(p_world, p_uid, 'rare:smith', (select r.odds from rarity_def r order by r.ord limit 1)));
  -- More to a filling for a Smith's Nail Maker (`count:` and the piece).
  v_count := floor(pk(p_world, p_uid, 'count:' || d.makes, d.per))::int;
  -- And what the smith's perks put into it (Keen Edge, Balanced, Mail Maker,
  -- Plate Maker, Temper Bath), which goes with a head into what it is fitted to.
  v_made := give(p_world, p_uid, d.makes, v_count, v_ql, m.name, v_rare, maker_mark(p_world, p_uid, v_rare), null,
                 made_mark((select pl.class_mul from player pl where pl.world_id = p_world and pl.uid = p_uid), d.makes));
  perform journal_made(p_world, p_uid, d.makes, v_ql, v_count, v_rare);
  perform journal_note(p_world, p_uid, 'smithed');
  -- The four that come out of the deep seams, which are worth a line of their own.
  if m.id in ('adamantine', 'glimmersteel', 'mithril', 'seryll') then
    perform journal_note(p_world, p_uid, 'moonmetal');
  end if;
  if v_rare is not null then
    perform journal_note(p_world, p_uid, v_rare);
    perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
  end if;
  perform tell(p_world, p_uid, 'You beat out '
    || case when v_count > 1 then v_count || ' ' else 'a ' end
    || lower(m.name) || ' '
    || case when v_count > 1 and right(lower((select name from item_def where id = d.makes)), 1) <> 's'
            then lower((select name from item_def where id = d.makes)) || 's'
            else lower((select name from item_def where id = d.makes)) end
    || ' on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');
  -- And what the go taught, said: it was raised and never told, which read as nothing learned.
end $function$;;

CREATE OR REPLACE FUNCTION public.perform_trap(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p placed; d trap_def; it item; c creature; s species_def; dd deed;
        v_sx int; v_sy int; v_names text; v_comers int; v_clean boolean; v_back bigint; v_one bigint;
begin
  if p_action = 'set_trap' then
    select * into it from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and not locked and exists (select 1 from trap_def td where td.id = item.def)
      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
    if not found then return; end if;
    select * into d from trap_def where id = it.def;
    v_sx := least(subtiles() - 1, greatest(0, coalesce((p_target->>'sx')::int, 0)));
    v_sy := least(subtiles() - 1, greatest(0, coalesce((p_target->>'sy')::int, 0)));
    -- Its maker's hand goes into the water with it (a Tailor's Fisher's Friend).
    insert into placed (world_id, kind, sub, material, x, y, sx, sy, cx, cy, ql, dmg, made_by, mark, enchant)
    values (p_world, 'trap', it.def, it.extra, (p_target->>'x')::int, (p_target->>'y')::int,
            v_sx, v_sy, (p_target->>'x')::int + (v_sx + 0.5) / subtiles(),
            (p_target->>'y')::int + (v_sy + 0.5) / subtiles(), it.ql, it.dmg, p_uid, nullif(it.mark, '{}'::jsonb), it.enchant)
    returning * into p;
    delete from item where id = it.id;
    perform tell(p_world, p_uid, case when d.water
      then 'You sink the ' || lower(trap_name(p)) || ' and make the line fast. It will fish about '
           || round(trap_life(p.sub, p.ql) * kept_life(p) / 60) || ' minutes and holds ' || creel_hold(p) || '. Bait it.'
      else 'You set the ' || lower(trap_name(p)) || ' and cover the sign of it. It will stand about '
           || round(trap_life(p.sub, p.ql) * kept_life(p) / 60) || ' minutes and will hold anything up to taming '
           || to_char(trap_holds(p), 'FM990') || '. Bait it.' end, 'event');
    perform land_announce(p_world, p.x, p.y);
    return;
  end if;

  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
  if not found then return; end if;
  select * into d from trap_def where id = p.sub;

  if p_action = 'bait_trap' then
    it := bait_in_pack(p_world, p_uid, d.water);
    if it.id is null then return; end if;
    -- Whatever was in it goes back in the pack rather than on the ground.
    if p.bait is not null then perform give(p_world, p_uid, p.bait, 1, coalesce(p.bait_ql, 20)); end if;
    if not consume(p_world, p_uid, it.def, 1, it.id) then return; end if;
    update placed set bait = it.def, bait_ql = it.ql, since = now() where id = p.id;
    if d.water then
      perform tell(p_world, p_uid, 'You put the '
        || lower((select name from item_def where id = it.def))
        || ' in the creel and sink it again. '
        || coalesce((select note from bait_def where id = it.def), ''), 'event');
    else
      select count(*) into v_comers from species_def sp
        where exists (select 1 from species_diet sd where sd.species = sp.id and sd.item = it.def)
          and sp.tame_level <= trap_holds(p);
      perform tell(p_world, p_uid, 'You lay the '
        || lower((select name from item_def where id = it.def)) || ' in the ' || lower(trap_name(p))
        || '. ' || case when v_comers = 0 then 'Nothing this trap will hold eats that.'
                        when v_comers = 1 then 'One sort would come to that.'
                        else v_comers || ' sorts would come to that.' end, 'event');
    end if;

  elsif p_action = 'take_catch' then
    select * into c from creature where world_id = p_world and id = p.caught;
    if not found then return; end if;
    select * into s from species_def where id = c.species;
    if tame_room_refusal(p_world, p_uid) is not null then
      perform tell(p_world, p_uid, tame_room_refusal(p_world, p_uid), 'error');
      return;
    end if;
    -- It is held, not willing. Getting it out without being bitten is the skill.
    v_clean := skill_check(skill_of(p_world, p_uid, 'taming'), s.tame_level + 10, p.ql,
                           mind_ease(p_world, p_uid));
    perform skill_raise(p_world, p_uid, 'taming', try_gain(v_clean, free_gain()));
    if not v_clean then
      perform tell(p_world, p_uid, 'The ' || lower(s.name)
        || ' thrashes and you cannot get a hand on it. It is still held.', 'error');
      return;
    end if;
    update placed set caught = null, bait = null, bait_ql = null where id = p.id;
    -- Won over as surely as by hand, and on the same skill: the field guide counts it as tamed.
    perform guide_mark(p_world, p_uid, c.species, 'tamed');
    select * into dd from my_deed(p_world, p_uid) md where md.world_id is not null;
    if not exists (select 1 from creature q where q.world_id = p_world and q.mode = 'active'
                     and q.keeper = p_uid) then
      update creature set trapped = null, mode = 'active', keeper = p_uid, until = now()
        where world_id = p_world and id = c.id;
      perform journal_note(p_world, p_uid, 'trapped');
      perform tell(p_world, p_uid, 'You get the noose off the ' || lower(s.name)
        || ' and it stays. It comes with you.', 'event');
    else
      update creature set trapped = null, mode = 'active', keeper = p_uid, until = now()
        where world_id = p_world and id = c.id;
      perform crate_shut_in(p_world, c.id, empty_crate(p_world, p_uid), null);
      perform journal_note(p_world, p_uid, 'trapped');
      perform tell(p_world, p_uid, 'You get the noose off the ' || lower(s.name)
        || ' and put it straight into the creature crate in your pack.', 'event');
    end if;

  elsif p_action = 'free_catch' then
    perform spring_trap(p.id,
      'You lift the board and it is gone into the grass before you have straightened up.');

  elsif p_action = 'empty_creel' then
    select string_agg(i.count || ' × ' || lower(f.name), ', ' order by f.name), count(*)
      into v_names, v_comers
      from item i join item_def f on f.id = i.def
      where i.holder = 'trap' and i.placed = p.id;
    if v_comers = 0 then return; end if;
    -- Into the cart you are working from first, as far as it has room.
    for v_one in select i.id from item i where i.holder = 'trap' and i.placed = p.id order by i.id loop
      perform gather_item(p_world, p_uid, v_one);
    end loop;
    update item set holder = 'player', holder_uid = p_uid, placed = null
      where holder = 'trap' and placed = p.id;
    perform pack_fold(p_world, p_uid);
    perform skill_raise(p_world, p_uid, 'fishing', 0.5);
    perform journal_note(p_world, p_uid, 'creeled');
    perform tell(p_world, p_uid, 'You lift the creel and tip it out: ' || v_names || '.', 'event');

  elsif p_action = 'pick_up_trap' then
    if p.bait is not null then perform give(p_world, p_uid, p.bait, 1, coalesce(p.bait_ql, 20)); end if;
    update item set holder = 'player', holder_uid = p_uid, placed = null
      where holder = 'trap' and placed = p.id;
    perform pack_fold(p_world, p_uid);
    v_back := give(p_world, p_uid, p.sub, 1, p.ql, p.material, null, null, null, p.mark);
    update item set dmg = trap_dmg(p), enchant = p.enchant where id = v_back;
    perform tell(p_world, p_uid, 'You take the ' || lower(trap_name(p)) || ' up'
      || case when p.bait is not null then ' and pocket the bait' else '' end || '.', 'event');
    delete from placed where id = p.id;
    perform land_announce(p_world, p.x, p.y);
  end if;
end $function$;;

/** What a placed thing is by the catalogue, for the kinds a scroll can be set into where they stand (`Game.placedFor`). */
create or replace function placed_def(p placed) returns text language sql immutable as $fn$
  select case p.kind when 'furniture' then p.sub when 'trap' then p.sub
                     when 'smelter' then 'smelter' when 'kiln' then 'kiln' when 'anvil' then 'anvil' end
$fn$;

/** What to call a placed thing a scroll is set into: the browser's furnitureName, smelterName, kilnName, anvilName, trapName. */
create or replace function placed_called(p placed) returns text language sql stable as $fn$
  select case p.kind when 'furniture' then placed_name(p) when 'trap' then trap_name(p) when 'anvil' then anvil_name(p)
                     when 'smelter' then rare_said(p.rare, 'Smelter') when 'kiln' then rare_said(p.rare, 'Kiln') end
$fn$;

/** The wear a scroll that did not take leaves on a placed thing: its harm, held short of broken (`placedHarm`). */
create or replace function placed_harm(p_dmg double precision) returns double precision language sql immutable as $fn$
  select least(damage_max() - 1, p_dmg + enchant_harm())
$fn$;

/** What a go that did not take on a placed thing says (`placedNotTakenSaid`). */
create or replace function placed_not_taken_said(p_name text, p_thing text, p_harm double precision, p_dmg double precision) returns text
  language sql immutable as $fn$
  select 'The ' || p_name || ' scroll does not take. The ' || p_thing || ' takes ' || enchant_ql_word(p_harm)
      || ' damage and is at ' || enchant_ql_word(p_dmg) || '. The scroll is used up.'
$fn$;

/**
 * Why this scroll will not go into this placed thing, or the scroll, the thing
 * and the enchantment when it will (`enchantSetting` for a placed target):
 * within reach, yours to use past any padlock, of the kind it goes on, whole,
 * and holding nothing yet.
 */
create or replace function enchant_setting_placed(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_scroll item, out o_place placed, out o_id text)
  language plpgsql stable as $fn$
begin
  select * into o_scroll from item i where i.world_id = p_world and i.id = nullif(p_target->>'scroll', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  select e.id into o_id from enchantments() e where e.scroll = o_scroll.def;
  if o_scroll.id is null or o_id is null then o_why := enchant_said('scroll'); return; end if;
  select * into o_place from placed pl where pl.world_id = p_world and pl.id = nullif(p_target->>'id', '')::bigint
    and pl.kind = p_target->>'kind';
  if o_place.id is null or placed_def(o_place) is null then o_why := enchant_said('gone'); return; end if;
  if not placed_in_reach(p_world, p_uid, o_place.id) then o_why := enchant_said('reach'); return; end if;
  o_why := lock_refusal(p_world, p_uid, o_place.lock, o_place.x, o_place.y);
  if o_why is not null then return; end if;
  if not enchant_fits(enchant_on(o_id), placed_def(o_place)) then o_why := enchant_wrong_kind(o_id); return; end if;
  if o_place.dmg >= damage_max() then o_why := enchant_said('broken'); return; end if;
  if o_place.enchant is not null then
    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_place.enchant->>'id'), o_place.enchant->>'id')
      || ' at QL ' || enchant_ql_word((o_place.enchant->>'ql')::double precision) || '.';
    return;
  end if;
end $fn$;

/** Which kinds of target are things standing where they were set down, for the Enchant job. */
create or replace function enchant_placed_kind(p_target jsonb) returns boolean language sql immutable as $fn$
  select coalesce(p_target->>'kind' in ('furniture', 'smelter', 'kiln', 'anvil', 'trap'), false)
$fn$;

create or replace function enchant_refusal(p_world uuid, p_uid uuid, p_target jsonb) returns text
  language sql stable as $fn$
  select case when enchant_placed_kind(p_target) then (select s.o_why from enchant_setting_placed(p_world, p_uid, p_target) s)
              else (select s.o_why from enchant_setting(p_world, p_uid, p_target) s) end
$fn$;

/**
 * A scroll set into a thing standing where it was set down. It takes as it
 * takes in the pack, at the thing's QL; a go that does not take leaves the
 * scroll's harm on it but never breaks it (`placed_harm`), and there is no
 * break roll for it, though both rolls are still taken, as the browser takes them.
 */
create or replace function perform_enchant_placed(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; e record; q record; v_skill double precision; v_name text; v_kind text; v_dmg double precision;
        v_sql double precision; v_r1 double precision; v_r2 double precision;
begin
  v_r1 := random();
  v_r2 := random();
  select * into s from enchant_setting_placed(p_world, p_uid, p_target);
  if s.o_why is not null then
    perform tell(p_world, p_uid, s.o_why, 'error');
    return;
  end if;
  select * into e from enchantments() x where x.id = s.o_id;
  v_skill := skill_of(p_world, p_uid, enchanting_skill());
  v_name := lower(placed_called(s.o_place));
  v_kind := lower((select d.name from item_def d where d.id = placed_def(s.o_place)));
  v_sql := (s.o_scroll).ql;
  perform consume(p_world, p_uid, (s.o_scroll).def, 1, (s.o_scroll).id);
  if v_r1 < enchant_chance(v_skill, v_sql) then
    select * into q from enchant_ql(v_skill, v_sql, (s.o_place).ql, v_r2);
    update placed set enchant = jsonb_build_object('id', e.id, 'ql', q.o_ql) where id = (s.o_place).id;
    perform skill_raise(p_world, p_uid, enchanting_skill(), 1);
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, (s.o_place).ql), 'event');
  else
    perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
    v_dmg := placed_harm((s.o_place).dmg);
    update placed set dmg = v_dmg where id = (s.o_place).id;
    perform tell(p_world, p_uid, placed_not_taken_said(e.name, v_name, v_dmg - (s.o_place).dmg, v_dmg), 'error');
  end if;
  perform land_announce(p_world, (s.o_place).x, (s.o_place).y);
end $fn$;

create or replace function perform_enchant(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; e record; q record; v_skill double precision; v_name text; v_kind text; v_dmg double precision;
        v_sql double precision; v_iql double precision; v_r1 double precision; v_r2 double precision;
begin
  -- A thing standing where it was set down is enchanted where it stands (`perform_enchant_placed`).
  if enchant_placed_kind(p_target) then
    perform perform_enchant_placed(p_world, p_uid, p_target);
    return;
  end if;
  -- Both rolls first, as the browser takes them: whether it takes, then its quality or whether the weapon breaks.
  v_r1 := random();
  v_r2 := random();
  select * into s from enchant_setting(p_world, p_uid, p_target);
  if s.o_why is not null then
    perform tell(p_world, p_uid, s.o_why, 'error');
    return;
  end if;
  select * into e from enchantments() x where x.id = s.o_id;
  v_skill := skill_of(p_world, p_uid, enchanting_skill());
  v_name := lower(item_name(s.o_item));
  v_kind := lower((select d.name from item_def d where d.id = (s.o_item).def));
  v_sql := (s.o_scroll).ql;
  v_iql := (s.o_item).ql;
  perform consume(p_world, p_uid, (s.o_scroll).def, 1, (s.o_scroll).id);
  if v_r1 < enchant_chance(v_skill, v_sql) then
    select * into q from enchant_ql(v_skill, v_sql, v_iql, v_r2);
    update item set enchant = jsonb_build_object('id', e.id, 'ql', q.o_ql) where id = (s.o_item).id;
    perform skill_raise(p_world, p_uid, enchanting_skill(), 1);
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, v_iql), 'event');
    return;
  end if;
  perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
  if v_r2 < enchant_break() then
    perform enchant_lose(p_world, p_uid, (s.o_item).id);
    perform tell(p_world, p_uid, not_taken_said(e.name, v_name, 'broke', damage_max()), 'error');
    return;
  end if;
  v_dmg := least(damage_max(), (s.o_item).dmg + enchant_harm());
  if v_dmg >= damage_max() then
    perform enchant_lose(p_world, p_uid, (s.o_item).id);
    perform tell(p_world, p_uid, not_taken_said(e.name, v_name, 'harmBroke', damage_max()), 'error');
  else
    update item set dmg = v_dmg where id = (s.o_item).id;
    perform tell(p_world, p_uid, not_taken_said(e.name, v_name, 'harm', v_dmg), 'error');
  end if;
end $fn$;;


/* ---- Ember Heart and Masterwork ------------------------------------------ */

/** What an enchantment of this effect on a placed thing comes to at its quality, or nought (`swingEnchant`). */
create or replace function placed_enchant(p placed, p_effect text) returns double precision language sql immutable as $fn$
  select coalesce((select greatest(0, least(ql_top(), (p.enchant->>'ql')::double precision)) * e.per_ql
                     from enchantments() e where e.id = p.enchant->>'id' and e.effect = p_effect), 0)
$fn$;

/** The fuel a placed fire burns for each second of heat: a brazier's own, and one less an Ember Heart's share (`furnaceBurn`). */
create or replace function placed_burn_rate(p placed) returns double precision
  language sql stable as $fn$
  select (case when is_brazier(p) then brazier_burn(p.ql) else 1 end) * (1 - placed_enchant(p, 'ember'))
$fn$;

/** What Masterwork adds to a thing made at a station: the best of the pieces of that kind within reach (`Game.masterAt`). */
create or replace function station_master(p_world uuid, p_uid uuid, p_station text) returns double precision
  language sql stable as $fn$
  select case when p_station is null or p_station in ('campfire', 'smelter') then 0
              else coalesce((select max(placed_enchant(pl, 'master')) from placed_near(p_world, p_uid, 'furniture', p_station, 2.4) pl), 0) end
$fn$;

/** An enchantment's figure as Examine says it: in its unit to the tenth where it has one (`FIGURE_UNITS`), and a share for the rest. */
create or replace function enchant_figure(p_id text, p_v double precision) returns text language sql immutable as $fn$
  select coalesce(trim_scale(round(p_v::numeric, 1))::text || ' ' || enchant_unit((select e.effect from enchantments() e where e.id = p_id)),
                  enchant_pct(p_v))
$fn$;

CREATE OR REPLACE FUNCTION public.furnace_settle(p_world uuid, p_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare p placed; budget double precision; jobs jsonb; out_j jsonb; done jsonb;
        v_job jsonb; v_left double precision; made int := 0; was_lit boolean;
        v_name text; v_last jsonb;
begin
  select * into p from placed where id = p_id and world_id = p_world for update;
  if not found then return 0; end if;
  -- Seconds of burning it has done since anybody last looked. A furnace that
  -- ran out of fuel on Tuesday gets Tuesday's seconds and not a moment more.
  -- Fuel burnt, over the fuel a second of heat takes: more seconds of it for an Ember Heart (`placed_burn_rate`).
  budget := case when p.lit then least(placed_fuel_spent(p), p.fuel) / placed_burn_rate(p) else 0 end;
  was_lit := p.lit;
  perform placed_settle(p_id);
  select * into p from placed where id = p_id;

  jobs := furnace_jobs(p);
  done := furnace_output(p);
  out_j := '[]'::jsonb;

  for v_job in select * from jsonb_array_elements(jobs) loop
    v_left := (v_job->>'left')::double precision;
    if budget <= 0 then
      out_j := out_j || v_job;
      continue;
    end if;
    if v_left > budget then
      out_j := out_j || jsonb_set(v_job, '{left}', to_jsonb(v_left - budget));
      budget := 0;
      continue;
    end if;
    -- It came out. Whatever is left of the budget goes on the next one.
    budget := budget - v_left;
    -- Folded into what is waiting of its kind, the way a pack folds it: one
    -- entry of twenty rather than twenty of one, and the quality the average.
    done := furnace_fold(done, v_job);
    v_last := v_job;
    made := made + 1;
  end loop;

  update placed set state = jsonb_set(jsonb_set(coalesce(state, '{}'::jsonb),
      '{jobs}', out_j), '{output}', done)
    where id = p_id;

  if made > 0 and p.made_by is not null then
    v_name := made_name(v_last->>'makes', v_last->>'piece');
    perform tell(p_world, p.made_by, 'The ' || p.kind || ' finishes '
      || case when made = 1 then 'a ' || v_name else made || ' pieces, the last of them a ' || v_name end
      || '.', 'event');
  end if;
  if was_lit and not (select lit from placed where id = p_id) then
    if p.made_by is not null then
      perform tell(p_world, p.made_by, 'A ' || p.kind
        || ' burns through the last of its fuel and goes cold.', 'event');
    end if;
  end if;
  return made;
end $function$

;;

CREATE OR REPLACE FUNCTION public.perform_craft(p_world uuid, p_uid uuid, p_recipe text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare r recipe; i record; v_n int; prefer bigint; mat text; hard double precision; tq double precision;
        s double precision; made_ql double precision; rare text; total double precision := 0;
        v_made bigint; weight double precision := 0; one double precision; share double precision;
        only_mat boolean; was text; v_base int; spared boolean := false; v_mark jsonb;
        v_parts jsonb := '{}'::jsonb; v_part jsonb; v_own jsonb; v_lye double precision; v_kept boolean := false;
        v_keep double precision; v_spare recipe_input; v_spare_ql double precision;
        v_tool bigint; v_tool_mark jsonb; v_stone boolean := false;
        v_scroll boolean; v_sheet double precision; v_harm text;
begin
  select * into r from recipe where id = p_recipe;
  prefer := target_item(p_target);
  -- What the run is aimed at, while it is still there to ask.
  select it.def into was from item it where it.id = prefer and it.world_id = p_world;
  mat := craft_material(p_world, p_uid, p_recipe, prefer);
  s := skill_of(p_world, p_uid, r.skill);
  tq := case when r.tool is null then 0 else tool_ql(p_world, p_uid, r.tool) end;
  /*
   * The tool wears on every go, whether or not the go comes off, as it does in
   * the hand and always has in the browser (`Game.act`). The island's bench
   * never wore anything, so a saw sawed for ever -- and a Carpenter's Saw
   * Care, which is how much less it wears (`wear_tool`), spared nothing.
   */
  if r.tool is not null then
    -- The one it is done with, and what its maker put into it, read before it
    -- is worn: a pot's, a bowl's or a jar's (an Artisan's Deep Pot and Sealed Jar).
    v_tool := held_tool(p_world, p_uid, r.tool);
    select it.mark into v_tool_mark from item it where it.id = v_tool;
    perform wear_tool(v_tool);
  end if;
  -- Oak and the deep metals fight the hands that shape them.
  hard := craft_hardness(p_recipe, mat);
  -- Bars broken into for what loose lumps are short of (a Smith's Ingots),
  -- before anything reads the lumps: what they weigh in the quality, and what
  -- a failed batch throws away.
  for i in select ri.item, ri.count from recipe_input ri join metal_def m on m.lump = ri.item where ri.recipe = p_recipe loop
    perform break_bars(p_world, p_uid, i.item,
      recipe_need(p_world, p_uid, p_recipe, i.count) - craft_count_loose(p_world, p_uid, i.item, null, prefer), prefer);
  end loop;

  -- An enchantment scroll (`enchant.ts`), and the sheet it would be written on, read before anything is spent.
  v_scroll := exists (select 1 from enchantments() e where e.scroll = r.result);
  if v_scroll then
    select st.ql into v_sheet from craft_stock(p_world, p_uid, prefer) st
     where st.def = 'papyrus' order by (st.id = prefer) desc, st.draw limit 1;
  end if;

  -- A Mason's Sure Chisel fails half as often on stonecutting (`fail:` and the recipe).
  if r.difficulty is not null and not perk_pass(skill_check(s, hard, tq), pk(p_world, p_uid, 'fail:' || p_recipe, 1)) then
    -- A scroll that fails loses its motes and damages the sheet it was being written on (`scroll_fails`).
    if v_scroll then
      v_harm := scroll_fails(p_world, p_uid, p_recipe, prefer);
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
      perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
      perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
      perform tell(p_world, p_uid, concat_ws(' ', r.fail, nullif(scroll_harm_said(v_harm), '')), 'event');
      return;
    end if;
    -- And a Mason's Nothing Wasted keeps what went into a failed smelter or kiln.
    spared := r.consume_on_fail and random() < pk(p_world, p_uid, 'spare:' || p_recipe, 0);
    -- And the stone out of it whole, whatever else is lost, for an Artisan's Keep the Stone.
    v_stone := r.consume_on_fail and not spared and pk(p_world, p_uid, 'stone:' || p_recipe, 0) > 0
               and exists (select 1 from recipe_input where recipe = p_recipe and item = 'gem');
    if r.consume_on_fail and not spared then
      for i in select * from recipe_input where recipe = p_recipe order by ord loop
        continue when v_stone and i.item = 'gem';
        perform craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat);
      end loop;
      -- The batch is wasted, not the vessel: you tip the ruin out and keep the
      -- bucket. Salvage if the recipe names any, otherwise whatever it returns.
      for i in
        select g.item, g.count from recipe_gives g
        where g.recipe = p_recipe
          and g.kind = (case when exists (select 1 from recipe_gives where recipe = p_recipe and kind = 'salvage')
                             then 'salvage' else 'return' end)
      loop
        perform give(p_world, p_uid, i.item, i.count, 20);
      end loop;
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
    end if;
    perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, case when v_stone
      then 'The claw goes over too far and the silver is spoiled, but you have the stone out whole.'
      else coalesce(r.fail, 'You fail to make ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.') end,
      'event');
    if spared then perform tell(p_world, p_uid, 'Nothing that went into it is lost.', 'event'); end if;
    return;
  end if;

  -- The quality of what is about to be used up, worked out before it is used
  -- up, since using it up changes the answer: off the stack each input would
  -- be spent from first, which is the clicked one where it is one of them.
  if r.ql_from_inputs then
    for i in select * from recipe_input where recipe = p_recipe order by ord loop
      only_mat := mat is not null and craft_count(p_world, p_uid, i.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
      select st.ql into one from craft_stock(p_world, p_uid, prefer) st
        where st.def = i.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
      if one is not null then
        -- By mass, not by the count. Two nails weigh two hundredths of a
        -- kilogram between them and do not get to decide what a pickaxe is.
        share := coalesce((select d.weight from item_def d where d.id = i.item), 1) * i.count;
        total := total + one * share;
        weight := weight + share;
      end if;
    end loop;
  end if;

  /*
   * What the parts carry of their makers' marks, off the stack each would be
   * spent from first, before spending them: a Smith's Keen Edge in a sword
   * blade goes into the sword whoever fits it. Only the parts the anvil beats
   * out, which are the only ones that carry a mark into anything, and only for
   * a thing made one at a time, which has a row to carry it; the larger where
   * two say the same, and never a temper, which is for whoever finishes it,
   * nor a seal or a glaze, which is on the part and not on what it goes into.
   */
  if not item_stackable(r.result) then
    for i in select ri.* from recipe_input ri where ri.recipe = p_recipe
               and (exists (select 1 from mould_def md where md.makes = ri.item)
                    -- And a yoke's pace into the cart or wagon it goes on (a Tailor's Saddler).
                    or ri.item in ('yoke')) order by ri.ord loop
      only_mat := mat is not null and craft_count(p_world, p_uid, i.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
      select it.mark into v_part from craft_stock(p_world, p_uid, prefer) st join item it on it.id = st.id
        where st.def = i.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
      if v_part is not null then
        select v_parts || coalesce(jsonb_object_agg(k.key, greatest(k.value::text::double precision,
                 coalesce((v_parts->>k.key)::double precision, k.value::text::double precision))), '{}'::jsonb)
          into v_parts
          from jsonb_each(v_part - 'temper' - 'seal' - 'glaze') k;
      end if;
    end loop;
  end if;
  /*
   * A Cook's Frugal Cook: one of the first ingredient that is not a vessel
   * back now and then, at the quality of the stack it would be spent from
   * first -- asked before the spending, which changes the answer. Only asked
   * of a recipe the perk is on.
   */
  v_keep := pk(p_world, p_uid, 'keep:' || p_recipe, 0);
  if v_keep > 0 then
    select ri.* into v_spare from recipe_input ri
     where ri.recipe = p_recipe and ri.item <> 'bucket'
       and not exists (select 1 from vessel_def v where v.item = ri.item)
     order by ri.ord limit 1;
    if v_spare.item is not null then
      only_mat := mat is not null and craft_count(p_world, p_uid, v_spare.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, v_spare.count);
      select st.ql into v_spare_ql from craft_stock(p_world, p_uid, prefer) st
        where st.def = v_spare.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
    end if;
  end if;
  -- A Tailor's Lye Saver: now and then the vessel's liquid is not used up,
  -- and the full vessel stays as it was rather than coming back empty.
  v_lye := pk(p_world, p_uid, 'lye:' || p_recipe, 0);
  v_kept := v_lye > 0 and random() < v_lye;
  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    continue when v_kept and exists (select 1 from vessel_def v where v.item = i.item);
    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;
  end loop;
  perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);

  if r.ql_from_inputs then
    made_ql := greatest(1, least(100, (case when weight > 0 then total / weight else 1 end) * (0.78 + s / 460)));
  else
    made_ql := product_ql(s, tq);
  end if;
  -- And the tree, on the trade the recipe belongs to: the quality of what came
  -- off the bench, however it was arrived at. A hundred is still a hundred.
  made_ql := least(100, made_ql * class_mul(p_world, p_uid, 'fine', r.skill));
  -- And better for a perk on the recipe (a Cook's Fine Fare).
  -- And higher for a Masterwork on the station it is made at (`station_master`).
  made_ql := least(100, made_ql * pk(p_world, p_uid, 'ql:' || p_recipe, 1) + station_master(p_world, p_uid, r.station));
  -- And a scroll never better than the sheet it was written on.
  if v_scroll and v_sheet is not null then made_ql := least(made_ql, v_sheet); end if;
  -- A Carpenter's Master Joiner: the first step of rarity at better odds on the joinery (`rare:` and the recipe).
  rare := perk_rare(pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1)));
  -- More, the go a bauble on the trade comes up in the altar of the settlement you work on.
  -- A Mason's Three from a Shard and Good Mix: more of it at a go (`count:` and what it makes).
  v_base := pk(p_world, p_uid, 'count:' || r.result, r.count)::int;
  -- And a serving more of a dish cooked in a pot or a bowl its maker had Deep Pot for, whoever cooks.
  if is_dish(r.result) then v_base := v_base + floor(coalesce((v_tool_mark->>'serve')::double precision, 0))::int; end if;
  -- But not on a dye boil, which fills the one bucket it is done in (`boiledDye`).
  v_n := case when r.result = 'dye_bucket' then v_base else bauble_yield(p_world, p_uid, r.result, v_base) end;
  /*
   * What the maker's perks put into it, which stays with it whoever has it
   * after (a Carpenter's Deep Drawers, Keel Layer, True Bow; a Cook's Hearty),
   * over what its parts carried (a Smith's Keen Edge). A pile of the same
   * thing marked the same way is one pile, so a thing made by the handful goes
   * into the pack with its mark and stacks by it; a thing made one at a time
   * is a row of its own and takes it after.
   */
  v_own := coalesce(made_mark((select pl.class_mul from player pl
                                where pl.world_id = p_world and pl.uid = p_uid), r.result), '{}'::jsonb);
  v_mark := v_parts || v_own;
  -- A pace is multiplied, since a yoke's and a builder's are two reasons to go
  -- faster; the maker's own stands over the parts' in everything else.
  if v_parts ? 'speed' and v_own ? 'speed' then
    v_mark := jsonb_set(v_mark, '{speed}', to_jsonb((v_parts->>'speed')::double precision * (v_own->>'speed')::double precision));
  end if;
  -- And what is put up in a jar its maker had Sealed Jar for rots the slower for it.
  if v_tool_mark ? 'keeps' then
    v_mark := v_mark || jsonb_build_object('rot', mark_of(v_mark, 'rot') * mark_of(v_tool_mark, 'keeps'));
  end if;
  v_mark := nullif(v_mark, '{}'::jsonb);
  if item_stackable(r.result) then
    v_made := give(p_world, p_uid, r.result, v_n, made_ql, coalesce(r.extra, mat), rare, maker_mark(p_world, p_uid, rare), null, v_mark);
  else
    v_made := give(p_world, p_uid, r.result, v_n, made_ql, coalesce(r.extra, mat), rare, maker_mark(p_world, p_uid, rare));
    if v_mark is not null then update item set mark = v_mark where id = v_made; end if;
  end if;
  -- A boil leaves its dye in the bucket it was boiled in (`boiledDye`).
  if r.result = 'dye_bucket' then perform dye_boiled(p_world, p_uid, v_made, p_recipe); end if;
  -- A vessel comes off the bench full: a bucket of juice holds its five drinks.
  update item set charges = d.charges from item_def d
    where item.id = v_made and item.charges is null and d.id = item.def and d.charges is not null;
  -- Into the ledger, which is the only memory this island has of what you have
  -- made. It says so when it is your first of a kind or your best.
  perform journal_made(p_world, p_uid, r.result, made_ql, v_n, rare);
  if rare is not null then
    perform journal_note(p_world, p_uid, rare);
    perform tell(p_world, p_uid, rarity_word(rare), 'skill');
  end if;
  for i in select g.item, g.count from recipe_gives g where g.recipe = p_recipe and g.kind = 'return' loop
    continue when v_kept and exists (select 1 from recipe_input ri join vessel_def v on v.item = ri.item
                                      where ri.recipe = p_recipe and v.empty = i.item);
    perform give(p_world, p_uid, i.item, i.count, 20);
  end loop;
  if v_kept then perform tell(p_world, p_uid, 'There is enough left in the bucket for another.', 'event'); end if;
  if v_spare.item is not null and random() < v_keep then
    perform give(p_world, p_uid, v_spare.item, 1, coalesce(v_spare_ql, made_ql));
    perform tell(p_world, p_uid, 'You save '
      || case when lower((select coalesce(name, v_spare.item) from item_def where id = v_spare.item)) ~ '^[aeiou]' then 'an ' else 'a ' end
      || lower((select coalesce(name, v_spare.item) from item_def where id = v_spare.item)) || ' from the pot.', 'event');
  end if;

  perform skill_raise(p_world, p_uid, r.skill, 1);
  -- Working a thing out with your hands is what sharpens the head.
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, craft_head()));
  perform tell(p_world, p_uid, count_said(r.done, r.count, v_base) || ' (' || case when mat is not null then lower(mat) || ', ' else '' end
    || 'QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');
end $function$;;

select private.lock_doors();
