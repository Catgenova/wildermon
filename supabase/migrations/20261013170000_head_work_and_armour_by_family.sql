/*
 * Head work raises mind logic, and armour slows a swing by its family.
 *
 * Mind logic was raised by a finished craft (`craft_head`), a restored find
 * (`restore_gain`) and a book (`book_teaches`) and by nothing else, and since
 * every raise is a roll for a knack that lands on the characteristic itself
 * (`earn_knacks`), its knacks came to crafters and hardly anybody else. Four
 * jobs that are thinking as much as the hands now raise it too, each by a
 * share of a go generated from the browser's constant of the same name
 * (`npm run defs`), `try_gain` of it as a craft has it:
 *
 *   * a go of prospecting, `prospect_head()`, always landed: a go always reads
 *     the ground (`perform_ground`);
 *   * an offering to a wild creature, `tame_head()`, landed when it is taken
 *     (`perform_creature`);
 *   * a scroll set into a weapon, a crate or a placed thing, `enchant_head()`,
 *     landed when it takes (`perform_enchant`, `perform_enchant_crate`,
 *     `perform_enchant_placed`);
 *   * a treasure map's hoard dug up, `hoard_head()`, always landed
 *     (`perform_treasure`). Reading a map is a look at a picture
 *     (`rpc_treasure_map`), not a job, and teaches nothing.
 *
 * And `swing_burden` counts each piece of armour at its make's weight times
 * what its family makes of it (`armour_swing_by`: cloth and leather half,
 * chain and scale the whole, plate a quarter again), a shield at
 * `shield_swing_by()` of its own. `armour_swing_kg()` is still the browser's
 * `ARMOUR_SWING_FULL` over the heaviest set, now over the heaviest set as it
 * counts (`heaviestSet().counted`), so plate and a metal shield still come to
 * exactly that.
 *
 * swing_burden           -- from 20261013130000_armour_and_a_heavy_pack_slow_a_swing.sql, the newest that defines it.
 * perform_ground         -- from 20261011021905_four_for_the_tools_a_job_is_done_with.sql, the newest that defines it.
 * perform_creature       -- from 20261010072602_love_and_power_move_onto_tiers.sql, the newest that defines it.
 * perform_enchant        -- from 20261011033349_fair_wind_deep_hold_true_axle_bag_of_holding.sql, the newest that defines it.
 * perform_enchant_crate  -- from 20261011033349_fair_wind_deep_hold_true_axle_bag_of_holding.sql, the newest that defines it.
 * perform_enchant_placed -- from 20261011031657_enchanted_where_it_stands.sql, the newest that defines it.
 * perform_treasure       -- from 20260917140000_one_name_for_the_thing_in_your_hand.sql, the newest that defines it.
 */

set local lock_timeout = '3s';

-- Armour counted by its family, a shield at its own weight.
create or replace function swing_burden(p_world uuid, p_uid uuid, p_action text)
  returns double precision language plpgsql stable as $$
declare v_kg double precision;
begin
  if not is_fight(p_action) then return 1; end if;
  -- Armour where armour is worn, and a shield in the off hand, at the make's weight times
  -- what its family makes of it (`armour_swing_by`, `shield_swing_by`; `Game.armourCounted`).
  select coalesce(sum(idf.weight * case when s.slot = 'offhand' then shield_swing_by() else armour_swing_by(a.cls) end), 0)
    into v_kg
    from player p
    cross join unnest(array['head', 'chest', 'arms', 'legs', 'feet', 'offhand']) s(slot)
    join item i on i.id = (p.equipped->>s.slot)::bigint
      and i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
    join item_def idf on idf.id = i.def
    left join armour_def a on a.id = i.def and s.slot <> 'offhand'
   where p.world_id = p_world and p.uid = p_uid
     and case when s.slot = 'offhand' then exists (select 1 from shield_def sd where sd.id = i.def)
              else a.id is not null end;
  return (1 + v_kg * armour_swing_kg())
       -- Over what your back takes (`Game.overloaded`): what you carry, and nothing a cart or a wagon does.
       * case when carried_weight(p_world, p_uid) > carry_limit(p_world, p_uid) then 1 + overburden_swing() else 1 end;
end $$;

-- A go of prospecting raises mind logic.
CREATE OR REPLACE FUNCTION public.perform_ground(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare tx int; ty int; cx int; cy int; here int; t tile_def; v_data int; v_tree tree_def;
        d action_def; v_spoil text;
        v_skill double precision; v_tool double precision; v_ql double precision; v_n int; v_slab item; v_kind int; v_target int; v_hi record; v_lo record;
        v_rock rock_def; v_rad int; v_tiles int[] := '{}'; v_names text[] := '{}'; v_row record;
        v_id bigint; v_species int; v_sprout item; v_buried text; v_size int;
        v_age tree_age_def; v_to tree_age_def; v_needs double precision; v_grown int; v_cut int;
begin
  tx := (p_target->>'x')::int; ty := (p_target->>'y')::int;
  here := land_tile(p_world, tx, ty);
  select * into t from tile_def where id = here;
  v_data := land_data(p_world, tx, ty);
  select * into d from action_def where id = p_action;
  -- What this ground is made of, which digging has always read off the tile
  -- and flattening never did.
  v_spoil := coalesce(t.dig_yield, 'dirt');

  -- A flight of garden steps, laid or taken up (`perform_steps`).
  if p_action in ('lay_steps', 'lay_timber_steps', 'take_up_steps') then
    perform perform_steps(p_world, p_uid, p_action, p_target);
    return;
  end if;

  if p_action in ('take_level', 'clear_level') then
    if p_action = 'clear_level' then
      update player set level_h = null where world_id = p_world and uid = p_uid;
      perform tell(p_world, p_uid,
        'You put the level away. Flattening works to the ground you stand on again.', 'event');
    else
      cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
      update player set level_h = land_height(p_world, cx, cy) where world_id = p_world and uid = p_uid;
      perform tell(p_world, p_uid, 'You sight the level at ' || land_height(p_world, cx, cy)
        || '. Flattening works to it, and digging, dropping and concrete stop at it.', 'event');
    end if;
    return;
  end if;

  if p_action = 'flatten' then
    v_target := flatten_target(p_world, p_uid, tx, ty);
    -- The corners furthest above and below the height we are working towards.
    /*
     * The high corner has to be soil, because a shovel does not move rock. It
     * used to be the highest corner whatever it was made of, and a tile with
     * one rock shoulder on it stopped the whole run dead with "Mine it down
     * instead" while the other three corners still had work in them. The rock
     * is stepped round now and named at the end.
     */
    select c.cx, c.cy into v_hi from tile_corners(tx, ty) c
      where land_height(p_world, c.cx, c.cy) > v_target and land_dirt(p_world, c.cx, c.cy) > 0
      order by land_height(p_world, c.cx, c.cy) desc limit 1;
    select c.cx, c.cy into v_lo from tile_corners(tx, ty) c
      where land_height(p_world, c.cx, c.cy) < v_target
      order by land_height(p_world, c.cx, c.cy) limit 1;
    if v_hi.cx is null and v_lo.cx is null then
      perform tell(p_world, p_uid,
        case when exists (select 1 from tile_corners(tx, ty) c
                           where land_height(p_world, c.cx, c.cy) > v_target and land_dirt(p_world, c.cx, c.cy) <= 0)
             then 'What is still standing high here is bare rock. Mine it down.'
             else 'There is nothing left to move here.' end, 'error');
      return;
    end if;
    /*
     * A go moves `flatten_step` -- two units for a Terraformer's Level Hand --
     * but never past the height being worked to, so a corner one short of it
     * moves the one.
     */
    v_n := pk(p_world, p_uid, 'flatten:step', flatten_step())::int;
    if v_hi.cx is not null then
      v_n := least(v_n, land_height(p_world, v_hi.cx, v_hi.cy) - v_target, land_dirt(p_world, v_hi.cx, v_hi.cy));
    end if;
    if v_lo.cx is not null then v_n := least(v_n, v_target - land_height(p_world, v_lo.cx, v_lo.cy)); end if;
    v_n := greatest(1, v_n);
    if v_hi.cx is not null and v_lo.cx is not null then
      -- One corner down and one up: the dirt simply moves across the tile.
      perform raise_corner(p_world, v_hi.cx, v_hi.cy, -v_n);
      perform raise_corner(p_world, v_lo.cx, v_lo.cy, v_n);
      perform tell(p_world, p_uid, 'You move some dirt across the tile.', 'event');
    elsif v_hi.cx is not null then
      perform raise_corner(p_world, v_hi.cx, v_hi.cy, -v_n);
      perform gather(p_world, p_uid, v_spoil, v_n,
        least(100, product_ql(skill_of(p_world, p_uid, d.skill), tool_ql(p_world, p_uid, 'shovel'))
                   * pk(p_world, p_uid, 'ql:flatten', 1)));
      perform tell(p_world, p_uid, 'You scrape the ground down and pocket the '
        || lower((select name from item_def where id = v_spoil)) || '.', 'event');
    else
      /*
       * Its own stuff first and dirt after. Dirt fills anything, and it would
       * be a strange rule that let you take clay out of a bank and not put it
       * back.
       */
      if take_spoil(p_world, p_uid, v_spoil) then
        perform raise_corner(p_world, v_lo.cx, v_lo.cy, 1);
        -- And the second unit of a Level Hand's go, if there is soil for it.
        if v_n > 1 and take_spoil(p_world, p_uid, v_spoil) then perform raise_corner(p_world, v_lo.cx, v_lo.cy, 1); end if;
        perform tell(p_world, p_uid, 'You pack '
          || lower((select name from item_def where id = v_spoil))
          || ' in to bring the ground up.', 'event');
      elsif take_spoil(p_world, p_uid, 'dirt') then
        perform raise_corner(p_world, v_lo.cx, v_lo.cy, 1);
        if v_n > 1 and take_spoil(p_world, p_uid, 'dirt') then perform raise_corner(p_world, v_lo.cx, v_lo.cy, 1); end if;
        perform tell(p_world, p_uid, 'You pack dirt in to bring the ground up.', 'event');
      else
        perform tell(p_world, p_uid, 'You need '
          || lower((select name from item_def where id = v_spoil))
          || ' or dirt to bring this ground up, in the pack or in something beside you.', 'error');
        return;
      end if;
    end if;
    -- And what an hour of levelling ground teaches, which was nothing at all.
    perform skill_raise(p_world, p_uid, d.skill, 1);
    if t.turns_to_dirt then perform land_set_tile(p_world, tx, ty, 1); end if;
    perform land_announce(p_world, tx, ty);
    if not needs_flattening(p_world, p_uid, tx, ty) then
      perform tell(p_world, p_uid,
        case when floor((select x from player where world_id = p_world and uid = p_uid))::int = tx
              and floor((select y from player where world_id = p_world and uid = p_uid))::int = ty
             then 'The tile is now flat at its lowest corner.'
             else 'The tile is now flat and level with the ground you stand on.' end, 'event');
    end if;

  elsif p_action = 'drop_dirt' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    -- Dirt, clay or sand: the one named off the menu, or the first to hand.
    v_spoil := spoil_near(p_world, p_uid, target_item(p_target));
    if v_spoil is null or not take_spoil(p_world, p_uid, v_spoil) then return; end if;
    perform raise_corner(p_world, cx, cy, 1);
    -- What a spadeful covers over becomes what was in it, off the list both
    -- sides read: a clay bank or a beach can be laid now as well as dug.
    if exists (select 1 from buryable b where b.tile = here) then
      perform land_set_tile(p_world, tx, ty, spoil_tile(v_spoil));
    end if;
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You drop the ' || lower((select name from item_def where id = v_spoil))
      || ' on the ' || corner_name(tx, ty, cx, cy) || ' corner, raising the ground.', 'event');

  elsif p_action = 'raise_rock' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    -- Spent either way: concrete that slumps off is concrete gone.
    if not consume(p_world, p_uid, 'concrete', 1) then return; end if;
    v_skill := skill_of(p_world, p_uid, 'masonry');
    v_tool := tool_ql(p_world, p_uid, 'trowel');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'trowel'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    -- A Mason's Concrete Hand never fails (`fail:raise_rock`).
    if not perk_pass(skill_check(v_skill, d.difficulty, v_tool), pk(p_world, p_uid, 'fail:raise_rock', 1)) then
      perform skill_raise(p_world, p_uid, 'masonry', try_gain(false));
      perform tell(p_world, p_uid, 'The concrete slumps off the rock before it sets, and is lost.', 'event');
      return;
    end if;
    -- The rock rises: the height goes up and the soil over it stays nought --
    -- two steps for a Mason's Double Lift, where the slope and the level let it.
    v_n := greatest(1, floor(pk(p_world, p_uid, 'lift:raise_rock', 1))::int);
    if v_n > 1 and (slope_refusal(p_world, p_uid, 'masonry', cx, cy, v_n) is not null
                    or land_height(p_world, cx, cy) + v_n
                       > coalesce((select pl.level_h from player pl where pl.world_id = p_world and pl.uid = p_uid),
                                  land_height(p_world, cx, cy) + v_n)) then
      v_n := 1;
    end if;
    perform land_set_height(p_world, cx, cy, land_height(p_world, cx, cy) + v_n);
    perform reconcile_around(p_world, cx, cy);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You lay concrete on the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands ' || case when v_n > 1 then number_word(v_n) || ' steps' else 'a step' end
      || ' higher.', 'event');
    perform skill_raise(p_world, p_uid, 'masonry', 1);

  /*
   * A Mason's Rubble Fill: the same step up on bare rock for rock shards
   * rather than a concrete, spent either way, under the same check.
   */
  elsif p_action = 'rubble_fill' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    if not consume(p_world, p_uid, 'rock_shards', pk(p_world, p_uid, 'rubble', 0)::int) then return; end if;
    v_skill := skill_of(p_world, p_uid, 'masonry');
    v_tool := tool_ql(p_world, p_uid, 'trowel');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'trowel'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    if not skill_check(v_skill, d.difficulty, v_tool) then
      perform skill_raise(p_world, p_uid, 'masonry', try_gain(false));
      perform tell(p_world, p_uid, 'The rubble slides off the rock before it binds, and is lost.', 'event');
      return;
    end if;
    perform land_set_height(p_world, cx, cy, land_height(p_world, cx, cy) + 1);
    perform reconcile_around(p_world, cx, cy);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You pack rubble into the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands a step higher.', 'event');
    perform skill_raise(p_world, p_uid, 'masonry', 1);

  elsif p_action = 'dredge' then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    v_skill := skill_of(p_world, p_uid, 'digging');
    v_tool := tool_ql(p_world, p_uid, 'shovel');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'shovel'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    if not skill_check(v_skill, d.difficulty, v_tool) then
      perform skill_raise(p_world, p_uid, 'digging', try_gain(false));
      perform tell(p_world, p_uid, 'The shovel comes up with nothing but water.', 'event');
      return;
    end if;
    -- The bottom comes up a spadeful at a time, exactly as a corner ashore
    -- does under `dig`: the height and the soil over the rock go down
    -- together, and the water over it is that much deeper.
    perform land_set_height(p_world, cx, cy, land_height(p_world, cx, cy) - 1);
    v_n := land_dirt(p_world, cx, cy) - 1;
    perform land_set_dirt(p_world, cx, cy, v_n);
    if t.turns_to_dirt then perform land_set_tile(p_world, tx, ty, 1); end if;
    perform reconcile_around(p_world, cx, cy);
    perform land_announce(p_world, tx, ty);
    v_ql := least(100, product_ql(v_skill, v_tool) * pk(p_world, p_uid, 'ql:dredge', 1));
    perform gather(p_world, p_uid, v_spoil, 1, v_ql, null, perk_rare(pk(p_world, p_uid, 'rare:dredge', 0)));
    perform tell(p_world, p_uid, 'You dredge up some ' || lower((select name from item_def where id = v_spoil))
      || ' off the bottom at the ' || corner_name(tx, ty, cx, cy) || ' corner. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');
    perform skill_raise(p_world, p_uid, 'digging', 1);

  elsif p_action = 'pave_slabs' then
    select i.* into v_slab from item i join slab_def s on s.item = i.def
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
      order by (i.id = target_item(p_target)) desc, i.id limit 1;
    if not found then return; end if;
    select id into v_kind from slab_def where item = v_slab.def;
    if not perk_pass(skill_check(skill_of(p_world, p_uid, 'paving'), d.difficulty, v_slab.ql),
                     pk(p_world, p_uid, 'fail:pave_slabs', 1)) then
      perform skill_raise(p_world, p_uid, 'paving', try_gain(false));
      perform tell(p_world, p_uid,
        'The slab rocks on its bed however you set it. You leave it for now.', 'event');
      return;
    end if;
    if not consume(p_world, p_uid, v_slab.def, 1, v_slab.id) then return; end if;
    perform land_set_tile(p_world, tx, ty, 21);
    perform land_set_data(p_world, tx, ty, v_kind);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You bed the '
      || lower((select name from item_def where id = v_slab.def)) || ' down flat and true.', 'event');
    perform skill_raise(p_world, p_uid, 'paving', 1);

  elsif p_action = 'remove_paving' then
    -- A slab comes up whole more often than not; gravel and cobbles do not.
    v_kind := case when here = 21 then v_data & 3 else null end;
    perform land_set_tile(p_world, tx, ty, 1);
    perform land_announce(p_world, tx, ty);
    if v_kind is not null and random() < 0.6 then
      v_ql := product_ql(skill_of(p_world, p_uid, 'paving'));
      perform gather(p_world, p_uid, (select item from slab_def where id = v_kind), 1, v_ql);
      perform tell(p_world, p_uid, 'You lever the '
        || regexp_replace(lower((select name from slab_def where id = v_kind)), 's$', '')
        || ' up whole. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');
    else
      perform tell(p_world, p_uid, 'You break up the paving, leaving bare dirt.', 'event');
    end if;
    perform skill_raise(p_world, p_uid, 'paving', 1);

  elsif p_action = 'cut_grass' then
    perform mark_foraged(p_world, tx, ty, 'grass');
    -- More to a cut for a Naturalist's Hay Cutter.
    v_cut := floor(pk(p_world, p_uid, 'count:mixed_grass', grass_per_cut()))::int;
    perform gather(p_world, p_uid, 'mixed_grass', v_cut, product_ql(skill_of(p_world, p_uid, 'foraging')));
    -- Grass kept cut on a deed becomes lawn: the tile counts the days, in
    -- the bits `tree_day` reads.
    if here = tile_id('Grass') and on_deed(p_world, tx, ty) then
      v_n := v_data & 3;
      perform land_set_data(p_world, tx, ty, v_n | 4);
      perform land_announce(p_world, tx, ty);
      perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.'
        || case when 3 - v_n - 1 > 0
             then ' Kept cut, this will be lawn in ' || (3 - v_n - 1) || ' more day' || case when 3 - v_n - 1 = 1 then '' else 's' end || '.'
             else ' Kept cut, this will be lawn tomorrow.' end, 'event');
    else
      perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.', 'event');
    end if;
    perform skill_raise(p_world, p_uid, 'foraging', 1);

  elsif p_action = 'cut_moss' then
    -- Cut as grass is, and the tile stays moss.
    perform mark_foraged(p_world, tx, ty, 'moss');
    v_cut := moss_per_cut()::int;
    perform gather(p_world, p_uid, 'moss', v_cut, product_ql(skill_of(p_world, p_uid, 'foraging')));
    perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' clumps of moss.', 'event');
    perform skill_raise(p_world, p_uid, 'foraging', 1);

  elsif p_action = 'cut_reeds' then
    perform mark_foraged(p_world, tx, ty, 'reed');
    v_skill := skill_of(p_world, p_uid, 'foraging');
    -- Never fewer than a Naturalist's Reed Cutter says, whatever the roll.
    v_n := greatest(floor(pk(p_world, p_uid, 'count:reed', 0))::int,
                    reed_cut()::int + case when random() < v_skill / reed_extra_at() then 1 else 0 end);
    perform gather(p_world, p_uid, 'reed', v_n,
      product_ql(v_skill, tool_ql(p_world, p_uid, 'carving_knife')));
    perform tell(p_world, p_uid, 'You cut ' || v_n || ' reeds out of the bed.', 'event');
    perform skill_raise(p_world, p_uid, 'foraging', 1);

  elsif p_action = 'pick_fruit' then
    select * into v_tree from tree_def where id = tree_species(v_data);
    -- An old tree carries more than one only just come into bearing, and a
    -- very old one as much as an old one.
    v_skill := skill_of(p_world, p_uid, 'forestry');
    -- And more for Love's Abundance, as a field's harvest has.
    v_n := greatest(1, round(case when tree_age(v_data) in (2, 4) then 5 else 3 end
                             * (0.5 + v_skill / 130) * (0.7 + random() * 0.6) * path_fx(p_world, p_uid, 'harvest', 1))::int)
           -- And one more for a Forester's Fruitful.
           + case when random() < pk(p_world, p_uid, 'more:pick_fruit', 0) then 1 else 0 end;
    v_ql := product_ql(v_skill);
    perform gather(p_world, p_uid, v_tree.fruit, v_n, v_ql);
    perform mark_foraged(p_world, tx, ty, 'forage');
    perform skill_raise(p_world, p_uid, 'forestry', 0.35);
    perform tell(p_world, p_uid, 'You pick ' || v_n || ' '
      || lower((select name from item_def where id = v_tree.fruit))
      || case when v_n = 1 then '' else 's' end
      || ' off the ' || lower(v_tree.name) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');

  elsif p_action = 'pick_sprout' then
    select * into v_tree from tree_def where id = tree_species(v_data);
    -- A Forester's Sprout Picker never fails (`fail:pick_sprout`).
    if not perk_pass(skill_check(skill_of(p_world, p_uid, 'forestry'), 15), pk(p_world, p_uid, 'fail:pick_sprout', 1)) then
      perform skill_raise(p_world, p_uid, 'forestry', try_gain(false));
      perform tell(p_world, p_uid, 'You find no sprout worth picking.', 'event');
      return;
    end if;
    -- And picks more than one (`count:sprout`).
    v_n := greatest(1, floor(pk(p_world, p_uid, 'count:sprout', 1))::int);
    perform gather(p_world, p_uid, 'sprout', v_n,
      product_ql(skill_of(p_world, p_uid, 'forestry')), v_tree.name);
    perform tell(p_world, p_uid, case when v_n = 1 then 'You pick a ' || lower(v_tree.name) || ' sprout.'
      else 'You pick ' || number_word(v_n) || ' ' || lower(v_tree.name) || ' sprouts.' end, 'event');
    perform skill_raise(p_world, p_uid, 'forestry', 1);

  elsif p_action = 'prune' then
    select * into v_tree from tree_def where id = tree_species(v_data);
    select * into v_age from tree_age_def where id = tree_age(v_data);
    select * into v_to from tree_age_def where id = v_age.pruned;
    -- The door has already said no to a tree too young for this; a null age
    -- is never written into a tile.
    if v_to.id is null then return; end if;
    v_skill := skill_of(p_world, p_uid, 'forestry');
    v_tool := tool_ql(p_world, p_uid, 'sickle');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'sickle'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    if not skill_check(v_skill, d.difficulty, v_tool) then
      perform skill_raise(p_world, p_uid, 'forestry', try_gain(false));
      perform tell(p_world, p_uid, 'You cut at the ' || lower(v_tree.name)
        || ' and take off nothing that matters.', 'event');
      return;
    end if;
    /*
     * The age and nothing else. The species stays, and so does the notch a
     * hatchet has left in the trunk — it is beside the land, and the tile is
     * still a tree: pruning is the crown's business, and a half-felled tree
     * pruned back is still half felled.
     */
    perform land_set_data(p_world, tx, ty, tree_pack(tree_species(v_data), v_to.id));
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You prune the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back. It stands as a ' || lower(v_to.name) || ' ' || lower(v_tree.name) || ' now.', 'event');
    perform skill_raise(p_world, p_uid, 'forestry', 1);

  elsif p_action = 'plant' then
    -- The one chosen off the menu first, and the oldest that comes to hand if
    -- nobody chose. Sprouts come in nine species and what goes in the ground
    -- is what stands there for the next twenty years, so "whichever was picked
    -- up first" was not a choice anybody had made.
    select * into v_sprout from item where world_id = p_world and holder = 'player'
      and holder_uid = p_uid and def = 'sprout' and not locked
      and (target_item(p_target) is null or id = target_item(p_target))
      order by (id = target_item(p_target)) desc, id limit 1;
    if not found then return; end if;
    v_species := coalesce((select id from tree_def where name = v_sprout.extra), 0);
    if not consume(p_world, p_uid, 'sprout', 1, v_sprout.id) then return; end if;
    perform land_set_tile(p_world, tx, ty, 16);
    -- Species and age packed the one way (`tree_pack`): a planted tree
    -- starts as a sapling and grows on the same clock as one that seeded itself.
    -- Young, or further on for a Forester's Nursery (`grown:plant`).
    v_grown := planted_age(floor(pk(p_world, p_uid, 'grown:plant', 0))::int);
    perform land_set_data(p_world, tx, ty, tree_pack(v_species, v_grown));
    perform land_announce(p_world, tx, ty);
    perform journal_note(p_world, p_uid, 'planted');
    if (select fruit from tree_def where id = v_species) is not null then
      perform journal_note(p_world, p_uid, 'orchard');
    end if;
    perform tell(p_world, p_uid, 'You plant the '
      || lower((select name from tree_def where id = v_species)) || ' sprout.'
      || case when v_grown = planted_age(0) then ''
              else ' It comes up a ' || lower((select name from tree_age_def where id = v_grown)) || ' '
                   || lower((select name from tree_def where id = v_species)) || '.' end, 'event');
    perform skill_raise(p_world, p_uid, 'forestry', 1);

  elsif p_action = 'graft' then
    -- The sprout named off the menu, or the first fruit sprout to hand.
    select i.* into v_sprout from item i join tree_def td on td.name = i.extra and td.fruit is not null
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
       and i.def = 'sprout' and not i.locked
       and (target_item(p_target) is null or i.id = target_item(p_target))
     order by (i.id = target_item(p_target)) desc, i.id limit 1;
    if not found then return; end if;
    select * into v_tree from tree_def where id = tree_species(v_data);
    v_species := (select id from tree_def where name = v_sprout.extra);
    -- The sprout is spent either way: a graft that does not take is a sprout gone.
    if not consume(p_world, p_uid, 'sprout', 1, v_sprout.id) then return; end if;
    v_skill := skill_of(p_world, p_uid, 'forestry');
    v_tool := tool_ql(p_world, p_uid, 'carving_knife');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'carving_knife'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    -- A Forester's Master Grafter's graft always takes (`fail:graft`).
    if not perk_pass(skill_check(v_skill, d.difficulty, v_tool), pk(p_world, p_uid, 'fail:graft', 1)) then
      perform skill_raise(p_world, p_uid, 'forestry', try_gain(false));
      perform tell(p_world, p_uid, 'The ' || lower(v_sprout.extra) || ' graft does not take, and the sprout is spent.', 'event');
      return;
    end if;
    -- The species and nothing else: the age stays, and so does any notch.
    perform land_set_data(p_world, tx, ty, tree_pack(v_species, tree_age(v_data)));
    perform land_announce(p_world, tx, ty);
    perform journal_note(p_world, p_uid, 'orchard');
    perform tell(p_world, p_uid, 'You graft the ' || lower(v_sprout.extra) || ' sprout onto the ' || lower(v_tree.name)
      || '. It is a ' || lower((select name from tree_age_def where id = tree_age(v_data))) || ' '
      || lower(v_sprout.extra) || ' tree now.', 'event');
    perform skill_raise(p_world, p_uid, 'forestry', 1);

  elsif p_action = 'harvest_bush' then
    -- As fruit off a tree: more to a practised hand, and never nothing.
    v_skill := skill_of(p_world, p_uid, 'forestry');
    v_tool := tool_ql(p_world, p_uid, 'sickle');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'sickle'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    v_n := greatest(1, round(3 * (0.5 + v_skill / 130) * (0.7 + random() * 0.6))::int)
           -- And one more for a Forester's Hedge Harvest.
           + case when random() < pk(p_world, p_uid, 'more:harvest_bush', 0) then 1 else 0 end;
    v_ql := product_ql(v_skill, v_tool);
    perform gather(p_world, p_uid, (select yields from bush_def where id = bush_species(v_data)), v_n, v_ql);
    perform mark_foraged(p_world, tx, ty, 'forage');
    perform skill_raise(p_world, p_uid, 'forestry', 0.35);
    perform tell(p_world, p_uid, 'You cut ' || v_n || ' '
      || lower((select name from item_def where id = (select yields from bush_def where id = bush_species(v_data))))
      || ' off the ' || lower((select name from bush_def where id = bush_species(v_data)))
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');
    -- And one more, now and then, for a Bountiful on the sickle.
    perform enchant_more(p_world, p_uid, 'sickle', 'bounty', (select yields from bush_def where id = bush_species(v_data)), v_ql);

  elsif p_action = 'coppice' then
    -- A Forester's Coppice: a tree grown enough to bear, cut back to young off
    -- the stool for `coppice` logs, and left standing to grow on.
    select * into v_tree from tree_def where id = tree_species(v_data);
    select * into v_age from tree_age_def where id = tree_age(v_data);
    if here <> 16 or not coalesce(v_age.alive and v_age.bears, false) then return; end if;
    v_skill := skill_of(p_world, p_uid, 'woodcutting');
    v_tool := tool_ql(p_world, p_uid, 'hatchet');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'hatchet'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    if not skill_check(v_skill, d.difficulty, v_tool) then
      perform skill_raise(p_world, p_uid, 'woodcutting', try_gain(false));
      perform tell(p_world, p_uid, 'Your hatchet glances off and you fail to make headway.', 'event');
      return;
    end if;
    -- A fresh trunk off the stool: whatever notch was in the old one went with it.
    perform land_set_data(p_world, tx, ty, tree_pack(tree_species(v_data), planted_age(0)));
    delete from tree_notch where world_id = p_world and x = tx and y = ty;
    perform land_announce(p_world, tx, ty);
    v_n := floor(pk(p_world, p_uid, 'coppice', 0))::int;
    v_ql := product_ql(v_skill, v_tool);
    perform gather(p_world, p_uid, 'log', v_n, v_ql, v_tree.name);
    perform tell(p_world, p_uid, 'You cut the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back to the stool and get ' || v_n || case when v_n = 1 then ' log' else ' logs' end
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ') It stands as a '
      || lower((select name from tree_age_def where id = planted_age(0))) || ' ' || lower(v_tree.name) || ' now.', 'event');
    perform skill_raise(p_world, p_uid, 'woodcutting', 1);

  elsif p_action = 'tap_resin' then
    -- A Forester's Tap Resin: `tap_resin` tar out of a living pine, once a day
    -- for each -- the refusal says when it runs again.
    v_skill := skill_of(p_world, p_uid, 'forestry');
    v_tool := tool_ql(p_world, p_uid, 'carving_knife');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'carving_knife'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    perform mark_foraged(p_world, tx, ty, 'resin');
    v_n := floor(pk(p_world, p_uid, 'tap_resin', 0))::int;
    v_ql := product_ql(v_skill, v_tool);
    perform gather(p_world, p_uid, 'tar', v_n, v_ql);
    perform tell(p_world, p_uid, 'You cut the ' || lower((select name from tree_def where id = resin_tree()))
      || '''s bark and collect ' || v_n || ' ' || lower((select name from item_def where id = 'tar'))
      || ' from it. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');
    perform skill_raise(p_world, p_uid, 'forestry', 1);

  elsif p_action = 'clear_brush' then
    -- A Forester's Clear Brush: every bush and reed within `clear_brush` tiles
    -- of the one chosen, in one go. A bush leaves grass and reeds bare dirt,
    -- as `CLEARED_TO` has it in the browser.
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'sickle'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    v_rad := floor(pk(p_world, p_uid, 'clear_brush', 0))::int;
    v_n := 0;
    for v_row in select gx, gy from generate_series(ty - v_rad, ty + v_rad) gy, generate_series(tx - v_rad, tx + v_rad) gx
                  where in_bounds(p_world, gx, gy) and land_tile(p_world, gx, gy) in (tile_id('Bush'), tile_id('Reed')) loop
      perform land_set_tile(p_world, v_row.gx, v_row.gy,
        case when land_tile(p_world, v_row.gx, v_row.gy) = tile_id('Bush') then tile_id('Grass') else tile_id('Dirt') end);
      perform land_set_data(p_world, v_row.gx, v_row.gy, 0);
      perform land_announce(p_world, v_row.gx, v_row.gy);
      v_n := v_n + 1;
    end loop;
    perform tell(p_world, p_uid, 'You clear the brush off ' || v_n || case when v_n = 1 then ' tile.' else ' tiles.' end, 'event');
    perform skill_raise(p_world, p_uid, 'forestry', 1);

  elsif p_action = 'dig_stump' then
    select * into v_tree from tree_def where id = tree_species(v_data);
    v_skill := skill_of(p_world, p_uid, 'digging');
    v_tool := tool_ql(p_world, p_uid, 'shovel');
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'shovel'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id); end if;
    if not skill_check(v_skill, d.difficulty, v_tool) then
      perform skill_raise(p_world, p_uid, 'digging', try_gain(false));
      perform tell(p_world, p_uid, 'The roots hold. You dig round the ' || lower(v_tree.name)
        || ' stump and it does not shift.', 'event');
      return;
    end if;
    -- Bare dirt where it stood: the roots came out with it.
    perform land_set_tile(p_world, tx, ty, tile_id('Dirt'));
    perform land_set_data(p_world, tx, ty, 0);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You dig the ' || lower(v_tree.name)
      || ' stump out. The ground is bare dirt where it stood.', 'event');
    -- And a log of the tree's kind, for a Terraformer's Stump Puller.
    v_n := pk(p_world, p_uid, 'stump:log', 0)::int;
    if v_n > 0 then
      perform gather(p_world, p_uid, 'log', v_n, product_ql(v_skill, v_tool), v_tree.name);
      perform tell(p_world, p_uid, 'The root ball comes up with a length of good ' || lower(v_tree.name) || ' on it.', 'event');
    end if;
    perform skill_raise(p_world, p_uid, 'digging', 1);

  elsif p_action = 'dig_worms' then
    perform skill_raise(p_world, p_uid, 'digging', 0.2);
    select i.id into v_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'shovel'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if v_id is not null then perform wear_tool(v_id, 0.4); end if;
    -- Damp ground gives more than dry: a marsh is full of them.
    v_n := floor(random() * case when t.rich_worms then 5 else 3 end)::int
           + case when t.rich_worms then 1 else 0 end;
    if v_n = 0 then
      perform tell(p_world, p_uid, 'You turn a spadeful over and nothing is moving in it.', 'event');
      return;
    end if;
    perform gather(p_world, p_uid, 'worm', v_n, 20 + random() * 40);
    perform journal_note(p_world, p_uid, 'worms');
    perform tell(p_world, p_uid, 'You turn the dirt over and pick ' || v_n || ' worm'
      || case when v_n > 1 then 's' else '' end || ' out of it.', 'event');

  elsif p_action = 'prospect' then
    v_skill := skill_of(p_world, p_uid, 'prospecting');
    v_rad := prospect_radius(v_skill) + pk(p_world, p_uid, 'further:prospect', 0)::int + path_fx(p_world, p_uid, 'further', 0)::int;
    v_size := (select size from world where id = p_world);
    -- Metal counts wherever it lies: bare, under soil, or below water.
    for v_row in select x, y, (bedrock_at(p_world, x, y)).name as nm
      from generate_series(greatest(0, tx - v_rad), least(v_size - 1, tx + v_rad)) x
      cross join generate_series(greatest(0, ty - v_rad), least(v_size - 1, ty + v_rad)) y
      -- Anything worth mining, not only what is metal: a coal seam is a
      -- seam, and asking `ore` is asking whether its name ends in `_ore`.
      where (bedrock_at(p_world, x, y)).seam
      order by y, x
    loop
      v_tiles := v_tiles || (v_row.y * v_size + v_row.x);
      v_names := v_names || lower(v_row.nm);
    end loop;
    perform mark_prospected(p_world, p_uid, v_tiles);

    -- Sampling where you stand tells you what that particular rock holds.
    v_rock := bedrock_at(p_world, tx, ty);
    v_ql := ore_max_ql((select seed from world where id = p_world), tx, ty);
    v_buried := case when here = 4 then ''
      else ' It lies under ' || greatest(1, land_dirt(p_world, tx, ty)) || ' of ground.' end;
    if v_rock.seam then
      perform tell(p_world, p_uid, 'You sample the ' || lower(v_rock.name)
        || '. It needs mining ' || to_char(case when v_rock.ore
                                                then greatest(0, v_rock.level - pk(p_world, p_uid, 'ore:below', 0))
                                                else v_rock.level end, 'FM990')
        || ' to work' || case when skill_of(p_world, p_uid, 'mining')
                                   >= case when v_rock.ore
                                           then greatest(0, v_rock.level - pk(p_world, p_uid, 'ore:below', 0))
                                           else v_rock.level end
                              then ', which you have' else '' end
        || ', and will give up nothing finer than quality ' || to_char(v_ql, 'FM990')
        || '.' || v_buried, 'event');
    else
      perform tell(p_world, p_uid, 'Plain ' || lower(v_rock.name)
        || ' beneath you, with no metal in it, and nothing finer than quality '
        || to_char(v_ql, 'FM990') || ' in the stone.' || v_buried, 'event');
    end if;

    if coalesce(array_length(v_tiles, 1), 0) = 0 then
      perform tell(p_world, p_uid, 'You read the ground ' || v_rad
        || ' tiles about you and find no sign of anything worth mining.', 'event');
    else
      perform tell(p_world, p_uid, 'Within ' || v_rad || ' tiles you read '
        || (select string_agg(case when n > 1 then n || ' tiles of ' || nm
                                   else 'a tile of ' || nm end, ' and ' order by nm)
            from (select nm, count(*) as n from unnest(v_names) nm group by nm) q)
        || ', buried or bare. They are marked for a while.', 'event');
    end if;
    perform skill_raise(p_world, p_uid, 'prospecting', 1);
    -- And the head, for reading a seam out of the ground: a go always reads it (`PROSPECT_HEAD`).
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, prospect_head()));
  end if;

end $function$;

-- An offering, taken or refused, raises mind logic (`TAME_HEAD`).
CREATE OR REPLACE FUNCTION public.perform_creature(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare c creature; d species_def; a age_def; food text; n int; made_ql double precision;
        gained double precision; chance double precision; warm double precision; nm text;
        held int; brush_id bigint; top double precision; before double precision; skill double precision;
        dd deed; v_swap int; v_to text; v_why text; v_more boolean := false;
begin
  -- Opening a crate is asked of the crate, standing or carried.
  if p_action in ('crate_follow', 'crate_work') then
    perform perform_crate_open(p_world, p_uid, p_action, p_target);
    return;
  end if;
  c := target_creature(p_world, p_target);
  if c.world_id is null then return; end if;
  select * into d from species_def where id = c.species;
  a := age_row(c.born, old_of(c), age_pace(c));

  if p_action = 'examine_creature' then
    if c.mode = 'wild' and d.monster then
      perform tell(p_world, p_uid, 'A ' || lower(d.name) || ': ' || d.description
        || ' It has ' || ceil(c.health) || ' of ' || max_health(c) || ' in it and hits for '
        || to_char(attack_of(c), 'FM990') || '. It cannot be tamed. Kill it and butcher it, or keep well clear.', 'error');
    elsif c.mode = 'wild' then
      warm := coax_bonus(c, pk(p_world, p_uid, 'coax:step', coax_step()));
      perform tell(p_world, p_uid, 'A wild ' || lower(d.name) || ': ' || d.description
        || ' It eats ' || diet_text(c.species) || '.'
        || case when warm > 0 then ' It has taken ' ||
             case when c.coaxed = 1 then 'an offering' else c.coaxed || ' offerings' end
             || ' from your hand and is ' || to_char(warm * 100, 'FM990') || '% readier for the next.'
           else '' end
        || ' You would have to tame it to learn more.', 'event');
    else
      perform tell(p_world, p_uid, c.name || ' (' || c.sex || ' ' || lower(d.name) || ', ' || a.name
        || '): ' || d.description || ' Level ' || creature_level(c.skills)
        || '. Health ' || ceil(c.health) || '/' || max_health(c) || '. It is ' || care_word(c.care)
        || ' and carries ' || trait_names(c.traits) || '. '
        || case when c.hunger < 0.3 then 'It looks hungry.' when c.hunger < 0.6 then 'It could eat.'
                else 'It looks well fed.' end
        || ' It eats ' || diet_text(c.species) || '.'
        -- And the odds of a pairing, for a Herdsman's Stud Book.
        || stud_book(p_world, p_uid, c), 'event');
    end if;

  elsif p_action = 'tame' then
    -- Any food as an offering for a Herdsman's Any Bait.
    food := bait_in_pack(p_world, p_uid, c.species, pk(p_world, p_uid, 'bait:any', 0) > 0);
    if food is null then return; end if;
    -- The crate may have gone out of the pack since the offering was begun.
    if tame_room_refusal(p_world, p_uid) is not null then
      perform tell(p_world, p_uid, tame_room_refusal(p_world, p_uid), 'error');
      return;
    end if;
    if not consume(p_world, p_uid, food, 1) then return; end if;
    chance := tame_chance(p_world, p_uid, c);
    perform faith_kinship_spent(p_world, p_uid, c.id);
    update creature set hunger = least(1, hunger + 0.25) where world_id = p_world and id = c.id;
    if random() < chance then
      held := companion_of(p_world, p_uid);
      update creature set mode = 'active', stance = 'defensive', keeper = p_uid, coaxed = 0, coaxed_at = null
        where world_id = p_world and id = c.id;
      -- One follows you; every one after that goes into the crate you carry.
      if held is not null then perform crate_shut_in(p_world, c.id, empty_crate(p_world, p_uid), null); end if;
      perform tell(p_world, p_uid, 'The ' || lower(d.name) || ' takes the '
        || material_name(food, 1) || ' from your hand and trusts you. '
        || case when held is null then c.name || ' now follows you.'
             else 'It goes into the creature crate in your pack: set the crate down, or open it to have it follow you or work the deed.' end,
        'system');
      perform journal_note(p_world, p_uid, 'tamed');
      perform guide_mark(p_world, p_uid, c.species, 'tamed');
      perform skill_told(p_world, p_uid, 'taming', try_gain(true, tame_gain()));
      perform skill_told(p_world, p_uid, 'soul_strength', try_gain(true, tame_nerve()));
      perform skill_told(p_world, p_uid, 'mind_logic', try_gain(true, tame_head()));
    else
      -- It refused, but it stayed for the offering, and that is worth
      -- something to the next one.
      update creature set coaxed = coaxed + 1, coaxed_at = now()
        where world_id = p_world and id = c.id returning * into c;
      warm := coax_bonus(c, pk(p_world, p_uid, 'coax:step', coax_step()));
      perform tell(p_world, p_uid, 'The ' || lower(d.name) || ' '
        || replace(d.tame_fail, '{food}', material_name(food, 1)) || '.'
        -- No ceiling on it any more, so nothing here says there is one: this
        -- read "as used to you as it will get" from the fourth offering on,
        -- which was true then and is not now.
        || case when warm > 0 then ' It is growing used to you: '
             || to_char(warm * 100, 'FM990') || '% readier than the first time.'
           else '' end, 'event');
      perform skill_told(p_world, p_uid, 'taming', try_gain(false, tame_gain()));
      perform skill_told(p_world, p_uid, 'soul_strength', try_gain(false, tame_nerve()));
      perform skill_told(p_world, p_uid, 'mind_logic', try_gain(false, tame_head()));
    end if;

  elsif p_action = 'feed' then
    food := bait_in_pack(p_world, p_uid, c.species);
    if food is null or not consume(p_world, p_uid, food, 1) then return; end if;
    update creature set hunger = least(1, hunger + 0.5) where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, c.name || ' gobbles up the ' || material_name(food, 1) || '.', 'event');

  elsif p_action = 'groom' then
    select i.id into brush_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'brush'
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    skill := skill_of(p_world, p_uid, 'animal_husbandry');
    before := c.care;
    top := max_health(c);
    update creature set
        -- More of it at a go for a Herdsman's Brushwork.
        care = least(1, care + (0.18 + (skill / 100) * 0.34
                          + (least(100, tool_ql(p_world, p_uid, 'brush')) / 100) * 0.22) * pk(p_world, p_uid, 'groom:care', 1)),
        -- A brushing is also a looking-over: it finds the small hurts, more of them for Healing Hands.
        health = least(top, health + top * pk(p_world, p_uid, 'groom:heal', groom_heal()))
      where world_id = p_world and id = c.id returning * into c;
    if brush_id is not null then perform wear_tool(brush_id, 3); end if;
    perform journal_note(p_world, p_uid, 'groom');
    if c.care >= 0.995 then perform journal_note(p_world, p_uid, 'groomfull'); end if;
    gained := skill_told(p_world, p_uid, 'animal_husbandry', 0.4);
    perform tell(p_world, p_uid, case when before < 0.12 and c.care >= 0.12
        then 'You work the dust out of ' || c.name || '''s coat. It leans into the brush. ('
        else 'You brush ' || c.name || ' down. (' end || care_word(c.care) || ')', 'event');

  elsif p_action = 'shear' then
    -- A full fleece is three, a half-grown one is one, and quality follows the fleece.
    n := greatest(1, round(c.fleece * case when coalesce(d.shear_yield, 'wool') = 'wool' then 3 else 6 end)::int)
      -- And more of it for a perk on what comes off (a Tailor's Full Fleece).
      + floor(pk(p_world, p_uid, 'plus:' || coalesce(d.shear_yield, 'wool'), 0))::int;
    made_ql := greatest(1, least(100, 15 + c.fleece * 45 + skill_of(p_world, p_uid, 'tailoring') * 0.4));
    perform gather(p_world, p_uid, coalesce(d.shear_yield, 'wool'), n, made_ql);
    update creature set fleece = 0 where world_id = p_world and id = c.id;
    perform skill_told(p_world, p_uid, 'tailoring', 0.4);
    perform skill_told(p_world, p_uid, 'taming', 0.1);
    perform tell(p_world, p_uid, 'You '
      || case when coalesce(d.shear_yield, 'wool') = 'wool' then 'shear' else 'pluck' end
      || ' ' || c.name || ' and come away with ' || n || ' '
      || lower((select coalesce(name, 'wool') from item_def where id = coalesce(d.shear_yield, 'wool')))
      || '. (QL ' || to_char(made_ql, 'FM990.0') || ') It will grow back.', 'event');

  elsif p_action = 'milk_creature' then
    if not consume(p_world, p_uid, 'bucket', 1) then return; end if;
    -- What it has been fed on is what comes out of it.
    made_ql := greatest(1, least(100, 20 + c.fleece * 40 + c.hunger * 30));
    perform give(p_world, p_uid, 'milk_bucket', 1, made_ql);
    -- A Farmer's Milkmaid fills a second bucket now and then, if there is one.
    if random() < pk(p_world, p_uid, 'more:milk_creature', 0) then
      v_more := consume(p_world, p_uid, 'bucket', 1);
      if v_more then perform give(p_world, p_uid, 'milk_bucket', 1, made_ql); end if;
    end if;
    update creature set fleece = 0 where world_id = p_world and id = c.id;
    perform skill_told(p_world, p_uid, 'farming', 0.3);
    perform tell(p_world, p_uid, 'You milk ' || c.name || ' into the bucket'
      || case when v_more then ' and fill another' else '' end || '. (QL '
      || to_char(made_ql, 'FM990.0') || ')', 'event');

  elsif p_action = 'set_stance' then
    update creature set stance = p_target->>'stance', enemy = null where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, c.name || ' will be '
      || case when p_target->>'stance' = 'guard' then 'guarding you' else p_target->>'stance' end || '.', 'info');

  elsif p_action = 'order_attack' then
    update creature set enemy = (p_target->>'foe')::int, heel_until = null where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, c.name || ' goes for the ' || lower((select sd.name from creature q
      join species_def sd on sd.id = q.species where q.world_id = p_world and q.id = (p_target->>'foe')::int)) || '.', 'fight');

  elsif p_action = 'order_heel' then
    update creature set enemy = null, heel_until = now() + make_interval(secs => fall_back())
      where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, c.name || ' falls back to your side, and starts no fight for ' || fall_back() || ' seconds.', 'info');

  elsif p_action = 'rename_creature' then
    nm := left(btrim(p_target->>'name'), 24);
    update creature set name = nm where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, 'It answers to ' || nm || ' now.', 'info');

  elsif p_action = 'take_creature' then
    -- The one following you takes its place, on the deed or in a crate you carry.
    select sw.v_current, sw.v_to, sw.v_why into v_swap, v_to, v_why from companion_swap(p_world, p_uid, c) sw;
    if v_why is not null then return; end if;
    if c.carrying is not null then
      perform drop_on_ground(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int,
        c.carrying->>'def', coalesce((c.carrying->>'ql')::double precision, 1), c.carrying->>'extra',
        coalesce((c.carrying->>'count')::int, 1));
    end if;
    update creature set mode = 'active', keeper = p_uid, post = null, carrying = null, phase = 'idle',
        enemy = null, hunting = null, settled_at = now()
      where world_id = p_world and id = c.id;
    perform creature_settle(p_world, c.id);
    perform tell(p_world, p_uid, c.name || ' now follows you.', 'system');
    if v_to = 'deed' then
      update creature set mode = 'deed', job = (select s.gathers from species_def s where s.id = creature.species),
          phase = 'idle', work_x = null, work_y = null, carrying = null, enemy = null, hunting = null,
          settled_at = now()
        where world_id = p_world and id = v_swap returning * into c;
      perform tell(p_world, p_uid, c.name || ' stays behind in its place, and will ' || deed_job_line(c) || '.', 'info');
    elsif v_to = 'crate' then
      perform crate_shut_in(p_world, v_swap, empty_crate(p_world, p_uid), null);
      perform tell(p_world, p_uid, (select q.name from creature q where q.world_id = p_world and q.id = v_swap)
        || ' goes into the creature crate in your pack.', 'info');
    end if;

  elsif p_action = 'crate_creature' then
    if empty_crate(p_world, p_uid) is null or c.mode not in ('active', 'deed') then return; end if;
    perform crate_shut_in(p_world, c.id, empty_crate(p_world, p_uid), null);
    perform tell(p_world, p_uid, c.name || ' goes into the creature crate. Set the crate down and it can be seen inside.', 'system');

  elsif p_action = 'assign_deed' then
    -- The same key, missed in the same place: this is the token the wildermon
    -- is being put to work around, so it is the caller's own, not whichever
    -- one the planner happened to hand back first. On an island with two
    -- settlements it teleported a stored beast to a stranger's token.
    dd := my_deed(p_world, p_uid);
    -- The trade it was asked for by name, or its species' own. The door has
    -- already said the name is one of its trades.
    update creature set mode = 'deed', keeper = p_uid, phase = 'idle',
        job = coalesce(nullif(p_target->>'job', ''), d.gathers),
        work_x = null, work_y = null, carrying = null,
        from_x = case when c.mode = 'stored' then dd.x + 0.5 else creature_x(c) end,
        from_y = case when c.mode = 'stored' then dd.y + 1.5 else creature_y(c) end,
        to_x = case when c.mode = 'stored' then dd.x + 0.5 else creature_x(c) end,
        to_y = case when c.mode = 'stored' then dd.y + 1.5 else creature_y(c) end,
        leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
      where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, c.name || ' will '
      || coalesce((select plain from gather_def where id = coalesce(nullif(p_target->>'job', ''), d.gathers)), 'stay around the settlement')
      || ' within ' || work_range(c) || ' tiles of the token and bring what it finds to the crate.', 'system');

  elsif p_action = 'release_creature' then
    -- Out of its crate first, at the crate's door.
    if c.mode = 'stored' then perform crate_let_out(p_world, c.id); end if;
    -- Blood takes generations to build and a moment to walk away.
    update creature set mode = 'wild', stance = 'passive', keeper = null,
        name = d.name, coaxed = 0, coaxed_at = null, until = now()
      where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, 'The ' || lower(d.name) || ' ' || d.leaves || '.', 'system');

  elsif p_action = 'cull_creature' then
    /*
     * One action, and it is done.
     *
     * A beast you keep could always be killed — by swinging at it until it
     * stopped, which is a strange thing to have to do to your own livestock
     * and takes as long as fighting a wild one. This is the short way, and it
     * leaves exactly what the long way left: a carcass on the tile, for the
     * knife.
     *
     * Walked forward first, so the carcass lands where the body actually is;
     * a kept one stands at the token, which `creature_settle` has already
     * seen to. Whatever it was carrying is not buried with it.
     */
    perform creature_settle(p_world, c.id);
    -- One in a crate is let out of it first: the carcass lies at the crate's door.
    if c.mode = 'stored' then perform crate_let_out(p_world, c.id); end if;
    select * into c from creature where world_id = p_world and id = c.id;
    if c.world_id is null then return; end if;
    if c.carrying is not null then
      perform drop_on_ground(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int,
        c.carrying->>'def', coalesce((c.carrying->>'ql')::double precision, 1),
        c.carrying->>'extra', coalesce((c.carrying->>'count')::int, 1));
      update creature set carrying = null where world_id = p_world and id = c.id;
    end if;
    nm := c.name;
    -- Past any soak its blood could put in the way: this is not a blow, it is
    -- a decision. `wound_beast` is told nobody struck it, so it writes no
    -- hunter's line and no "you kill the wild one" — the words below are what
    -- happened.
    perform wound_beast(p_world, c.id, 1e9, null, null, null, null);
    perform tell(p_world, p_uid, 'You put ' || nm || ' down. The ' || lower(d.name)
      || '''s carcass lies where it stood, ready for the knife.', 'fight');
  end if;
end $function$;

-- A scroll set, taken or not, raises mind logic (`ENCHANT_HEAD`).
create or replace function perform_enchant(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; e record; q record; v_skill double precision; v_name text; v_kind text; v_dmg double precision;
        v_sql double precision; v_iql double precision; v_r1 double precision; v_r2 double precision;
begin
  -- A thing standing where it was set down is enchanted where it stands (`perform_enchant_placed`).
  if p_target->>'kind' = 'crate' then
    perform perform_enchant_crate(p_world, p_uid, p_target);
    return;
  end if;
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
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, enchant_head()));
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, v_iql), 'event');
    return;
  end if;
  perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, enchant_head()));
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
end $fn$;

-- A scroll set, taken or not, raises mind logic (`ENCHANT_HEAD`).
create or replace function perform_enchant_crate(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; e record; q record; v_skill double precision; v_name text; v_kind text; v_dmg double precision;
        v_sql double precision; v_r1 double precision; v_r2 double precision;
begin
  v_r1 := random();
  v_r2 := random();
  select * into s from enchant_setting_crate(p_world, p_uid, p_target);
  if s.o_why is not null then
    perform tell(p_world, p_uid, s.o_why, 'error');
    return;
  end if;
  select * into e from enchantments() x where x.id = s.o_id;
  v_skill := skill_of(p_world, p_uid, enchanting_skill());
  v_name := lower(crate_name(s.o_crate));
  v_kind := lower((select d.name from item_def d where d.id = (select c.item from crate_def c where c.kind = (s.o_crate).kind)));
  v_sql := (s.o_scroll).ql;
  perform consume(p_world, p_uid, (s.o_scroll).def, 1, (s.o_scroll).id);
  if v_r1 < enchant_chance(v_skill, v_sql) then
    select * into q from enchant_ql(v_skill, v_sql, (s.o_crate).ql, v_r2);
    update crate set enchant = jsonb_build_object('id', e.id, 'ql', q.o_ql) where world_id = p_world and id = (s.o_crate).id;
    perform skill_raise(p_world, p_uid, enchanting_skill(), 1);
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, enchant_head()));
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, (s.o_crate).ql), 'event');
  else
    perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, enchant_head()));
    v_dmg := placed_harm((s.o_crate).dmg);
    update crate set dmg = v_dmg where world_id = p_world and id = (s.o_crate).id;
    perform tell(p_world, p_uid, placed_not_taken_said(e.name, v_name, v_dmg - (s.o_crate).dmg, v_dmg), 'error');
  end if;
  perform land_announce(p_world, (s.o_crate).x, (s.o_crate).y);
end $fn$;

-- A scroll set, taken or not, raises mind logic (`ENCHANT_HEAD`).
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
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, enchant_head()));
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, (s.o_place).ql), 'event');
  else
    perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, enchant_head()));
    v_dmg := placed_harm((s.o_place).dmg);
    update placed set dmg = v_dmg where id = (s.o_place).id;
    perform tell(p_world, p_uid, placed_not_taken_said(e.name, v_name, v_dmg - (s.o_place).dmg, v_dmg), 'error');
  end if;
  perform land_announce(p_world, (s.o_place).x, (s.o_place).y);
end $fn$;

-- A hoard dug up raises mind logic.
CREATE OR REPLACE FUNCTION public.perform_treasure(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_map item; v_t treasure; v_tier treasure_def; v_i int; v_got text;
        v_ql double precision; v_rare text; v_c int;
begin
  v_map := carried(p_world, p_uid, target_item(p_target));
  if v_map.id is null then return; end if;
  v_t := treasure_at(v_map.id);
  if v_t.item_id is null then return; end if;
  select * into v_tier from treasure_def where id = v_t.tier;

  -- What was left to watch it, before anything is worth picking up.
  for v_i in 1..v_tier.guards loop
    perform creature_spawn(p_world, v_tier.guard, v_t.x + 0.5, v_t.y + 0.5, 'wild');
  end loop;

  for v_i in 1..v_tier.lumps loop
    select item into v_got from hoard_metal order by random() limit 1;
    v_ql := greatest(1, least(100, v_map.ql * (0.7 + random() * 0.5)));
    perform drop_on_ground(p_world, v_t.x, v_t.y, v_got, v_ql);
  end loop;
  for v_i in 1..v_tier.things loop
    /*
     * A tool or a blade, not a wardrobe. `improvable_def` is everything worth
     * bettering and that includes the furniture and the boats — the suite's
     * first hoard came up with a cart and a chest in it, which is a thing
     * nobody buried. `item_def.category` already draws the line: 55 tools,
     * heaviest eleven kilos, against 38 pieces of `misc` that run to a
     * six-hundred-kilo sailing boat.
     */
    select i.item into v_got from improvable_def i join item_def d on d.id = i.item
     where d.category = 'tool' order by random() limit 1;
    v_ql := greatest(1, least(100, v_map.ql * (0.7 + random() * 0.5)));
    v_rare := rarity_roll();
    v_c := drop_on_ground(p_world, v_t.x, v_t.y, v_got, v_ql);
    update item set rare = v_rare where world_id = p_world and holder = 'ground'
      and gx = v_t.x and gy = v_t.y and def = v_got and rare is null and v_rare is not null;
  end loop;

  perform consume(p_world, p_uid, 'treasure_map', 1, v_map.id);
  perform journal_note(p_world, p_uid, 'hoard');
  -- Matching a map's picture to the ground it was drawn from is head work (`HOARD_HEAD`).
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, hoard_head()));
  perform tell(p_world, p_uid, 'The spade goes through rotten board and the hoard is open — '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' thing' || case when v_tier.things = 1 then '' else 's' end
    || ' lying where they fell. And something was left to watch over it.', 'event');
  perform land_announce(p_world, v_t.x, v_t.y);
end $function$;

select private.lock_doors();

notify pgrst, 'reload schema';
