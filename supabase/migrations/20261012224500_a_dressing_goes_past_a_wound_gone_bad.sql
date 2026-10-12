/*
 * A dressing goes on the worst wound that has not gone bad.
 *
 * Reported: "Bandages don't seem to want to dress a wound if any of your
 * wounds have gone bad." They did not. A dressing went on `worst_wound`, which
 * counts a wound gone bad as a whole life worse than any other, so with one on
 * you it was always the one picked -- and since nothing holds on a wound gone
 * bad, the dressing was refused outright however many cuts were bleeding
 * beside it, yours or somebody else's.
 *
 * And a second dressing went over the first whatever the two were, so plain
 * cloth out of the pack would take the herb that suited a wound off it, and
 * the wound that never turned under it could turn again.
 *
 * Now a dressing goes on the worst wound it would do good (`wound_to_dress`,
 * the browser's `woundToDress`): one that has not gone bad and is not dressed
 * already at least as well as the dressing out of the pack would dress it.
 * Dressings are ranked by how fast they close the wound (`dressing_pace`,
 * the browser's `dressingPace`), which is the rule `wound_close` already went
 * by: nothing, cloth, the wrong herb, the herb that suits it. So cloth never
 * goes over cloth or a cover, and nothing over the herb that suits the wound.
 * The refusal names a wound gone bad when there is one, and otherwise says
 * everything is dressed as well already. Dressing your own says which wound
 * it went on, as dressing somebody else's always has.
 *
 * And dressing somebody else could fail outright. `occupied_crate_refusal`
 * asks every go whether it is aimed at a crate with a wildermon in it, by
 * `target_item`, which cast the target's `uid` to a number -- and a person's
 * uid is a uuid. Whether that cast was ever made was the planner's choice: by
 * the primary key of `item` it is the first thing asked, and the go is an
 * error. A uid that is not a number names no item now.
 *
 * Rewritten here, each from the newest migration that defines it:
 *   target_item   -- 20260917140000_one_name_for_the_thing_in_your_hand.sql
 *   wound_close   -- 20260927094308_the_naturalist_moved_onto_perks.sql (the same numbers, read off `dressing_pace`)
 *   fight_refusal -- 20261008005032_anybody_dresses_anybody.sql
 *   perform_fight -- 20261011014703_three_for_a_bow.sql
 */
set local lock_timeout = '3s';

/* ---- target_item: from 20260917140000_one_name_for_the_thing_in_your_hand.sql, the newest that defines it. A uuid names no item. ---- */

create or replace function target_item(p_target jsonb) returns bigint
  language sql immutable as $fn$
  select case when coalesce(p_target->>'itemUid', p_target->>'uid') ~ '^[0-9]+$'
              then coalesce(p_target->>'itemUid', p_target->>'uid')::bigint end
$fn$;

/*
 * How fast a dressing closes this wound, as a multiple: nothing, cloth, the
 * wrong herb or the herb that suits it -- and so how dressings rank against
 * each other. The browser's `dressingPace`, off `CLOSE_BARE`, `CLOSE_CLOTH`,
 * `CLOSE_WRONG` and `CLOSE_RIGHT`; `supabase/test/dress.ts` holds the two to
 * the same numbers.
 */
create or replace function dressing_pace(w jsonb, p_dressing text) returns double precision
  language sql stable as $$
  select case when p_dressing is null then 0.25 when p_dressing = '' then 0.7
              when p_dressing = k.herb then 1.6 else 0.9 end
  from wound_kind_def k where k.id = w->>'kind'
$$;

/* ---- wound_close: from 20260927094308_the_naturalist_moved_onto_perks.sql, the newest that defines it. The pace read off `dressing_pace`. ---- */

create or replace function wound_close(w jsonb, p_aid double precision) returns double precision
  language sql stable as $$
  select case when (w->>'infected')::boolean then 0 else
    (w->>'severity')::double precision
    * dressing_pace(w, w->>'dressing')
    * (0.0006 + p_aid * 0.00002)
    -- Faster for the hands that dressed it: a Naturalist's Quick Mend.
    * coalesce((w->>'mend')::double precision, 1) end
$$;

/* What a dressing puts on a wound: a cover's herb, or '' for cloth. As `perform_fight` reads it. */
create or replace function dressing_put(it item) returns text
  language sql immutable as $$
  select case when it.def = 'cover' then lower(coalesce(it.extra, '')) else '' end
$$;

/*
 * Where a dressing out of this pack goes on these wounds: the worst one it
 * would do good -- not gone bad, and closed faster by what would go on it
 * (`dressing_for`) than by what is on it already. The browser's `woundToDress`.
 */
create or replace function wound_to_dress(p_world uuid, p_uid uuid, p_wounds jsonb) returns jsonb
  language sql stable as $$
  select worst_wound((select coalesce(jsonb_agg(x), '[]'::jsonb)
                        from jsonb_array_elements(coalesce(p_wounds, '[]'::jsonb)) x
                        cross join lateral (select dressing_for(p_world, p_uid, x) as d) put
                        where not coalesce((x->>'infected')::boolean, false)
                          and (put.d).id is not null
                          and dressing_pace(x, dressing_put(put.d)) > dressing_pace(x, x->>'dressing')))
$$;

/* ---- fight_refusal: from 20261008005032_anybody_dresses_anybody.sql, the newest that defines it. Past a wound gone bad. ---- */

CREATE OR REPLACE FUNCTION public.fight_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare it item; c creature; d species_def; w weapon_def; bow weapon_def; dist double precision;
        p player; slot text; corpse item; hurt jsonb; use item; pt player;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action in ('equip', 'unequip') then
    select * into it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found then return 'It is gone.'; end if;
    slot := slot_of(it.def);
    if slot is null then return 'That is not worn or wielded.'; end if;
    if p_action = 'unequip' then
      return case when (p.equipped->>slot)::bigint is distinct from it.id
                  then 'You are not wearing that.' end;
    end if;
    if (p.equipped->>slot)::bigint = it.id then return 'You already have it on.'; end if;
    if slot = 'offhand' and two_handed_in_hand(p_world, p_uid) then
      return 'Both your hands are on your weapon.';
    end if;
    return null;

  elsif p_action in ('attack_creature', 'shoot_creature', 'treat_creature') then
    perform creature_settle(p_world, (p_target->>'id')::int);
    c := target_creature(p_world, p_target);
    if c.world_id is null then return 'It is dead or gone.'; end if;
    select * into d from species_def where id = c.species;
    dist := (select sqrt((creature_x(c) - pl.x) ^ 2 + (creature_y(c) - pl.y) ^ 2)
             from player pl where pl.world_id = p_world and pl.uid = p_uid);
    if p_action = 'attack_creature' then
      if c.mode <> 'wild' then return 'That one is tame. Release it first if you mean it.'; end if;
      if dist > melee_reach(p_world, p_uid) then return 'It is out of reach.'; end if;
      return null;
    elsif p_action = 'shoot_creature' then
      if c.mode <> 'wild' then return 'That one is tame. Release it first if you mean it.'; end if;
      select bw.* into bow from weapon_def bw where bw.id = (worn(p_world, p_uid, 'weapon')).def and bw.ammo is not null;
      if not found then return 'You have no bow in your hands.'; end if;
      if coalesce((select sum(pack_count(p_world, p_uid, idf.id)) from item_def idf
                   where arrow_head_of(idf.id) is not null), 0) <= 0 then return 'You are out of arrows.'; end if;
      -- Further for the bow's maker's mark, a Carpenter's True Bow, and for an Archer's Long Draw (`bow_range`).
      if dist > bow_range(p_world, p_uid, bow, worn(p_world, p_uid, 'weapon')) then
        return 'Too far for a ' || lower((select name from item_def where id = bow.id)) || '.';
      end if;
      -- And nearer for an Archer's Close Quarters (`draw_nearest`).
      if dist < draw_nearest(p_world, p_uid) then return 'It is too close to draw on.'; end if;
      return null;
    else
      if c.mode = 'wild' then return 'It will not stand still for you while it is wild.'; end if;
      if c.health >= max_health(c) then return c.name || ' is not hurt.'; end if;
      if pack_count(p_world, p_uid, 'bandage') <= 0 then return 'You have no bandages. Cut some from cloth.'; end if;
      if dist > 1.9 then return 'You need to be beside it.'; end if;
      return null;
    end if;

  elsif p_action = 'butcher' then
    corpse := target_corpse(p_world, p_uid, p_target);
    if corpse.id is null then return 'There is nothing to butcher.'; end if;
    if (corpse_species(corpse.extra)).id is null then return 'You cannot make sense of this carcass.'; end if;
    return null;

  elsif p_action = 'bind_wound' then
    /*
     * Somebody else's, which anybody may: standing beside you, at your first
     * aid and with your dressings. What is wrong with them is this side's to
     * say; the browser knows only your pack.
     */
    if p_target->>'kind' = 'person' and p_target->>'uid' is distinct from p_uid::text then
      if coalesce(p_target->>'uid', '') !~ '^[0-9a-f-]{36}$' then return 'They are not on this island.'; end if;
      select * into pt from player where world_id = p_world and uid = (p_target->>'uid')::uuid;
      if not found then return 'They are not on this island.'; end if;
      if sqrt((pt.x - p.x) ^ 2 + (pt.y - p.y) ^ 2) > 1.9 then return 'You need to be beside them.'; end if;
      perform wounds_settle(p_world, pt.uid);
      select * into pt from player where world_id = p_world and uid = pt.uid;
      if jsonb_array_length(coalesce(pt.wounds, '[]'::jsonb)) = 0 then return coalesce(pt.name, 'They') || ' has nothing open to dress.'; end if;
      -- The worst it would do good (`wound_to_dress`): past one gone bad, and past one dressed as well already.
      if wound_to_dress(p_world, p_uid, pt.wounds) is not null then return null; end if;
      -- Nothing to put on a wound that could take one; with every wound gone bad, what wants doing first is the lye.
      if (dressing_for(p_world, p_uid, '{}'::jsonb)).id is null
         and exists (select 1 from jsonb_array_elements(pt.wounds) x where not coalesce((x->>'infected')::boolean, false)) then
        return 'You have nothing to dress it with.';
      end if;
      hurt := worst_wound((select jsonb_agg(x) from jsonb_array_elements(pt.wounds) x where (x->>'infected')::boolean));
      if hurt is not null then
        return 'The ' || (select name from wound_kind_def where id = hurt->>'kind') || ' on '
          || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || ' has gone bad. It wants cleaning out before anything will hold on it.';
      end if;
      return 'Every wound on ' || coalesce(pt.name, 'them') || ' that has not gone bad is already dressed at least as well as what you carry would dress it. '
        || 'A dressing only goes over one that closes the wound slower.';
    end if;
    perform wounds_settle(p_world, p_uid);
    select * into p from player where world_id = p_world and uid = p_uid;
    if jsonb_array_length(coalesce(p.wounds, '[]'::jsonb)) = 0 then
      return case when coalesce((p.stats->>'health')::double precision, 1) >= 0.999
        then 'There is nothing wrong with you.' else 'Nothing is open. You are only tired and thin.' end;
    end if;
    -- The worst it would do good (`wound_to_dress`): past one gone bad, and past one dressed as well already.
    if wound_to_dress(p_world, p_uid, p.wounds) is not null then return null; end if;
    -- Nothing to put on a wound that could take one; with every wound gone bad, what wants doing first is the lye.
    if (dressing_for(p_world, p_uid, '{}'::jsonb)).id is null
       and exists (select 1 from jsonb_array_elements(p.wounds) x where not coalesce((x->>'infected')::boolean, false)) then
      return 'You have nothing to dress it with.';
    end if;
    hurt := worst_wound((select jsonb_agg(x) from jsonb_array_elements(p.wounds) x where (x->>'infected')::boolean));
    if hurt is not null then
      return 'The ' || (select name from wound_kind_def where id = hurt->>'kind')
        || ' on your ' || part_name(hurt->>'part')
        || ' has gone bad. Clean it out before anything will hold on it.';
    end if;
    -- The browser's `DRESSED_AS_WELL`.
    return 'Every wound on you that has not gone bad is already dressed at least as well as what you carry would dress it. '
      || 'A dressing only goes over one that closes the wound slower.';

  elsif p_action = 'clean_wound' then
    perform wounds_settle(p_world, p_uid);
    select * into p from player where world_id = p_world and uid = p_uid;
    if not exists (select 1 from jsonb_array_elements(coalesce(p.wounds, '[]'::jsonb)) x
                   where (x->>'infected')::boolean) then
      return 'Nothing on you has gone bad.';
    end if;
    if pack_count(p_world, p_uid, 'lye_bucket') <= 0 then
      return 'You need a bucket of lye to clean it out with.';
    end if;
    return null;
  end if;
  return null;
end $function$;

/* ---- perform_fight: from 20261011014703_three_for_a_bow.sql, the newest that defines it. Past a wound gone bad. ---- */

CREATE OR REPLACE FUNCTION public.perform_fight(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_landed boolean; it item; p player; slot text; shield item; c creature; d species_def; w weapon_def;
        bow weapon_def; arrow item; held item; dist double precision; dmg double precision;
        bane double precision; before double precision; died boolean; reach double precision;
        corpse item; sp species_def; knife_ql double precision; v_share double precision;
        made_ql double precision; taken text[] := '{}'; r record; v_n int; lumps text[] := '{}';
        hurt jsonb; use item; suits boolean; clean boolean; healed double precision;
        top double precision; out_w jsonb; one jsonb; lye item; got text; v_bait int;
        pt player; v_other boolean; v_mend double precision; v_kind text; v_crit boolean := false; v_head text;
        v_wind double precision;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'equip' then
    select * into it from item where id = target_item(p_target);
    slot := slot_of(it.def);
    update player set equipped = jsonb_set(equipped, array[slot], to_jsonb(it.id))
      where world_id = p_world and uid = p_uid returning * into p;
    -- Both hands on it means nothing else in them.
    if slot = 'weapon' and coalesce((select two_handed from weapon_def where id = it.def), false) then
      shield := worn(p_world, p_uid, 'offhand');
      if shield.id is not null then
        update player set equipped = equipped - 'offhand' where world_id = p_world and uid = p_uid;
        perform tell(p_world, p_uid, 'You need both hands for that, so the '
          || lower((select name from item_def where id = shield.def)) || ' goes on your back.', 'info');
      end if;
    end if;
    perform tell(p_world, p_uid, 'You '
      || case when slot in ('weapon', 'offhand') then 'take up' else 'put on' end
      || ' the ' || lower((select name from item_def where id = it.def)) || '.', 'info');

  elsif p_action = 'unequip' then
    select * into it from item where id = target_item(p_target);
    slot := slot_of(it.def);
    update player set equipped = equipped - slot where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You put the '
      || lower((select name from item_def where id = it.def)) || ' away.', 'info');

  elsif p_action = 'attack_creature' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    select * into d from species_def where id = c.species;
    w := swung_with(p_world, p_uid);
    held := swung_item(p_world, p_uid);
    before := c.health;
    -- The gains used to be written above the roll, so a miss paid exactly
    -- what a landed blow paid.
    -- Its blood has a say in whether you connect at all.
    v_landed := random() <= hit_chance(p_world, p_uid, w.kind, mark_of(held.mark, 'aim')) * beast_mul(c, 'evade');
    perform skill_raise(p_world, p_uid, 'fighting', try_gain(v_landed, swing_fight()));
    perform skill_raise(p_world, p_uid, w.kind, try_gain(v_landed, swing_arm()));
    perform skill_raise(p_world, p_uid, 'body_strength', try_gain(v_landed, swing_body()));
    -- And, if it is dark enough to matter, what it teaches about noticing.
    perform fought_in_dark(p_world, p_uid, dark_swing());
    if not v_landed then
      perform tell(p_world, p_uid, 'You swing at the ' || lower(d.name)
        || case when held.id is null then '' else ' with your '
             || lower((select name from item_def where id = held.def)) end || ' and miss.', 'fight');
    else
      bane := case when held.id is not null and mat_bane(held.extra) and d.glow is not null
                   then bane_bonus() else 1 end;
      -- And harder or softer for the way you stand (`stance_dealt`).
      -- And for what its hide makes of an edge, a point or a weight, and at something whose mind is on another fight.
      -- And now and then a critical one (`my_crit_chance`), more often for a Skirmisher's Keen Edge and on one Marked for Death
      -- (`class_marked`), and harder for a Skirmisher's Lethal (`crit_mul`).
      -- And every one while a Berserker's Last Rage holds (`class_crit`).
      v_crit := random() < my_crit_chance(p_world, p_uid, w) * class_marked(p_world, c.id) or class_crit(p_world, p_uid);
      dmg := weapon_damage(p_world, p_uid, w, held) * bane * my_stance_dealt(p_world, p_uid, p.fight_stance)
             * hide_takes(d.hide, blow_of(w.id, w.kind)) * blindside_of(c, p_uid) * (0.75 + random() * 0.5)
             * case when v_crit then crit_mul(p_world, p_uid, w) else 1 end * faith_arms(p_world, p_uid, d)
             -- And what a fighting trade makes of it: a Battle Rage, an Executioner, Pain Fuels (`class_dealt`).
             * class_dealt(p_world, p_uid, c);
      died := hurt_creature(p_world, c.id, dmg, p_uid);
      -- And it teaches the fighting trade you hold (`class_learn`), a kill more.
      perform class_learn(p_world, p_uid, class_learn_blow() + case when died then class_learn_kill() else 0 end);
      -- And a Thirst for Blood's share of your health back (`class_leech`).
      perform class_leech(p_world, p_uid);
      perform faith_feast(p_world, p_uid, dmg);
      -- And what the weapon does besides: a maul staggers, a spear holds it off, a knife opens it up (`sideBlow`).
      if not died and w.id <> 'fist' then perform side_blow(p_world, p_uid, c.id, w.kind, dmg); end if;
      -- Less for a Mender's Armour Care.
      if held.id is not null then perform damage_item(held.id, 0.35 * pk(p_world, p_uid, 'worn:weapon', 1)); end if;
      if not died then
        perform tell(p_world, p_uid, 'You strike the ' || lower(d.name)
          || case when held.id is null then '' else ' with your '
               || lower((select name from item_def where id = held.def)) end
          || case when v_crit then ', a critical blow' else '' end
          || '. It is down to ' || greatest(0, ceil(c.health - dmg)) || ' of ' || max_health(c) || '.', 'fight');
      end if;
    end if;
    /*
     * And it fights back, on its own clock rather than yours: whatever is
     * struck that does not bolt is after you now (`engage_beast`), and lands
     * its blows every `blow_every` seconds in `hunt_settle` while you are in
     * reach of it, swinging or not. It used to answer each swing with a roll.
     */
    if not coalesce(died, false) then perform engage_beast(p_world, c.id, p_uid); end if;
    -- And a Pikeman's Keep Away pushes what it landed on further off, once it has turned on you (`class_keep_away`).
    if v_landed and not coalesce(died, false) then perform class_keep_away(p_world, p_uid, c.id); end if;
    -- And what is enchanted into the weapon, now and then, on a hit that landed (`enchant_hit`): a burn, a bleed, a stun.
    if v_landed and not coalesce(died, false) and w.id <> 'fist' then perform enchant_hit(p_world, p_uid, c.id, held, dmg); end if;

  elsif p_action = 'shoot_creature' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    select * into d from species_def where id = c.species;
    held := worn(p_world, p_uid, 'weapon');
    select bw.* into bow from weapon_def bw where bw.id = held.def and bw.ammo is not null;
    if not found then return; end if;
    -- The arrows asked for, else plain ones, else any (`nockedArrow`).
    select i.* into arrow from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and arrow_head_of(i.def) is not null
      order by (i.def = coalesce(p_target->>'arrow', 'arrow')) desc, (i.def = 'arrow') desc, i.ql desc limit 1;
    if arrow.id is null or not consume(p_world, p_uid, arrow.def, 1, arrow.id) then return; end if;
    v_head := arrow_head_of(arrow.def);
    dist := (select sqrt((creature_x(c) - pl.x) ^ 2 + (creature_y(c) - pl.y) ^ 2)
             from player pl where pl.world_id = p_world and pl.uid = p_uid);
    -- The far end of a bow's range is a far harder shot than the near end (`bow_range`); and no shot at all
    -- for one that spends an Archer's Read the Wind, which cannot miss (`class_wind_take`).
    v_wind := class_wind_take(p_world, p_uid);
    v_landed := v_wind is not null or random() <= hit_chance(p_world, p_uid, 'archery', mark_of(held.mark, 'aim'))
                            * (1 - (dist / bow_range(p_world, p_uid, bow, held)) * 0.35) * beast_mul(c, 'evade');
    perform skill_raise(p_world, p_uid, 'fighting', try_gain(v_landed, shot_fight()));
    perform skill_raise(p_world, p_uid, 'archery', try_gain(v_landed, shot_archery()));
    -- Picking a target out of the dark at range is the hardest looking there is.
    perform fought_in_dark(p_world, p_uid, dark_shot());
    if not v_landed then
      perform tell(p_world, p_uid, 'Your arrow goes wide of the ' || lower(d.name) || '.', 'fight');
    else
      -- The stave throws it; the head is what goes in. Both have a say.
      bane := case when mat_bane(arrow.extra) and d.glow is not null then bane_bonus() else 1 end;
      -- And critical more often for a Read the Wind spent on it, and on one Marked for Death.
      v_crit := random() < my_crit_chance(p_world, p_uid, bow) * coalesce(v_wind, 1) * class_marked(p_world, c.id) or class_crit(p_world, p_uid);
      -- And what the head is: a blunt crushes, a bodkin goes through a hide (`headBlow`, `headHide`).
      dmg := weapon_damage(p_world, p_uid, bow, held) * mat_edge(arrow.extra) * bane * my_stance_dealt(p_world, p_uid, p.fight_stance)
             * hide_takes(d.hide, case when v_head = 'blunt' then 'crush' else blow_of(bow.id, bow.kind) end)
             * case when v_head = 'bodkin' and d.hide is not null then bodkin_hide() else 1 end
             * blindside_of(c, p_uid)
             * (0.6 + arrow.ql / 140) * (0.8 + random() * 0.4)
             * case when v_crit then crit_mul(p_world, p_uid, bow) else 1 end * faith_arms(p_world, p_uid, d)
             -- And what a fighting trade makes of it: a Battle Rage, an Executioner, Pain Fuels (`class_dealt`),
             * class_dealt(p_world, p_uid, c)
             -- and an Archer's Ambush on one not after you (`class_ambush`).
             * class_ambush(p_world, p_uid, c);
      died := hurt_creature(p_world, c.id, dmg, p_uid);
      -- And it teaches the fighting trade you hold (`class_learn`), a kill more.
      perform class_learn(p_world, p_uid, class_learn_blow() + case when died then class_learn_kill() else 0 end);
      -- And a Thirst for Blood's share of your health back (`class_leech`).
      perform class_leech(p_world, p_uid);
      perform faith_feast(p_world, p_uid, dmg);
      perform damage_item(held.id, 0.25 * pk(p_world, p_uid, 'worn:weapon', 1));
      -- And now and then the arrow back in your pack, for an Archer's Arrow Saver (`class_arrow_saved`).
      perform class_arrow_saved(p_world, p_uid, arrow);
      -- A broadhead bleeds it as a knife does, a blunt staggers it as a maul does (`headSide`).
      if not died and v_head in ('broadhead', 'blunt') then
        perform side_blow(p_world, p_uid, c.id, case when v_head = 'broadhead' then 'knives' else 'mauls' end, dmg);
      end if;
      -- And what is enchanted into the bow, now and then (`enchant_shot`): a Flamearrow's burn, a Frostbite's slow.
      if not died then perform enchant_shot(p_world, p_uid, c.id, held); end if;
      if not died then
        perform tell(p_world, p_uid, 'Your arrow goes home'
          || case when v_crit then ', a critical hit' else '' end || '. The ' || lower(d.name)
          || ' is down to ' || greatest(0, ceil(c.health - dmg)) || ' of ' || max_health(c) || '.', 'fight');
      end if;
    end if;
    -- Shot at, it comes for you, as anything struck does.
    if not coalesce(died, false) then perform engage_beast(p_world, c.id, p_uid); end if;

  elsif p_action = 'butcher' then
    corpse := target_corpse(p_world, p_uid, p_target);
    sp := corpse_species(corpse.extra);
    if corpse.id is null or sp.id is null then return; end if;
    knife_ql := nullif(tool_ql(p_world, p_uid, 'butchering_knife'), 0);
    -- And more of it for a Cook's Full Carcass, and never more than all of it.
    v_share := least(1, butcher_yield(skill_of(p_world, p_uid, 'butchering'), knife_ql)
                        * pk(p_world, p_uid, 'share:butcher', 1));
    /*
     * The Butchering skill decides the quality of everything that comes off
     * the carcass, the way every trade's skill decides what it makes: with a
     * knife it is your skill, or the knife's quality spread 0.6 to 1.4 when
     * that comes out lower; bare-handed it is your skill spread the same way.
     * The corpse's own quality used to scale it down again by 0.6 to 1.0, so
     * a butcher at 100 took meat off at 66 to 80 and the skill did not decide
     * it. Asked for: "Butchering skill determines ql of Butchering output".
     */
    made_ql := product_ql(skill_of(p_world, p_uid, 'butchering'), coalesce(knife_ql, 0));
    -- What it was sleeping on, which is not a part of it at all.
    for r in select sb.n from species_butcher sb where sb.species = sp.id and sb.part = 'hoard' loop
      for v_n in 1..round(r.n * (4 + v_share * 6))::int loop
        select item into got from hoard_metal order by random() limit 1;
        perform gather(p_world, p_uid, got, 1, greatest(20, least(100, 40 + random() * 55)));
        lumps := lumps || lower((select name from item_def where id = got));
      end loop;
    end loop;
    if array_length(lumps, 1) > 0 then
      perform journal_note(p_world, p_uid, 'hoard');
      perform tell(p_world, p_uid, 'Something rattles as the belly opens: ' || array_length(lumps, 1)
        || ' lumps of what it had been sleeping on. '
        || (select string_agg(distinct l, ', ') from unnest(lumps) l) || '.', 'event');
    end if;
    /* `n` was a plpgsql variable here and `species_butcher.n` a column, and
     * Postgres would not guess which was meant. That is the fourth time on
     * this island — `land_tile.y`, `crop.y`, `trait_def.tier` — so the locals
     * that could collide carry a prefix. */
    for r in select b.part, b.item, sb.n from butcher_part b
             join species_butcher sb on sb.part = b.part and sb.species = sp.id
             order by b.ord loop
      v_n := floor(r.n * v_share)::int;
      -- The remainder is a chance at one more, so a poor job still gives something.
      if random() < r.n * v_share - v_n then v_n := v_n + 1; end if;
      -- Glands are the rare part: only a steady hand finds them intact.
      if r.part = 'gland' and v_n > 0 and random() > 0.35 * (0.5 + v_share) then v_n := 0; end if;
      if v_n <= 0 then continue; end if;
      -- Better for a perk on the part (a Cook's Prime Cuts and Hide Keeper).
      perform gather(p_world, p_uid, r.item, v_n,
        least(100, greatest(1, least(100, made_ql)) * pk(p_world, p_uid, 'ql:' || r.item, 1)));
      taken := taken || (case when v_n > 1 then v_n || ' × ' else '' end
        || lower((select name from item_def where id = r.item)));
    end loop;
    -- And bait for the hook out of what is left (a Cook's Bait Maker), into the pack.
    v_bait := floor(pk(p_world, p_uid, 'bait:butcher', 0))::int;
    if v_bait > 0 then
      perform give(p_world, p_uid, 'offal', v_bait, greatest(1, least(100, made_ql)));
      taken := taken || (v_bait || ' × ' || lower((select name from item_def where id = 'offal')));
    end if;
    delete from item where id = corpse.id;
    if array_length(taken, 1) is null then
      perform tell(p_world, p_uid, 'You make a mess of the ' || lower(sp.name)
        || ' carcass and salvage nothing.', 'event');
    else
      perform tell(p_world, p_uid, 'You butcher the ' || lower(sp.name) || ' and take '
        || array_to_string(taken, ', ') || ' (QL ' || to_char(greatest(1, least(100, made_ql)), 'FM990.0') || ').'
        || case when knife_ql is null then ' Bare hands waste most of a carcass.' else '' end, 'event');
    end if;
    /*
     * And what a go at it teaches, which was nothing: every other trade's
     * performer raises its own skill, and this one never did, so Butchering
     * stayed where it started on an island however much was butchered -- and
     * with it the quality of everything taken off a carcass. A full go, as
     * the browser has always counted one, whatever the carcass gave.
     */
    perform skill_raise(p_world, p_uid, 'butchering', 1);

  elsif p_action = 'bind_wound' then
    -- Your own, or somebody else's beside you, which anybody may:
    -- at your first aid and out of your pack either way.
    v_other := p_target->>'kind' = 'person' and p_target->>'uid' is distinct from p_uid::text;
    if v_other then
      select * into pt from player where world_id = p_world and uid = (p_target->>'uid')::uuid;
      if not found then return; end if;
    else
      select * into pt from player where world_id = p_world and uid = p_uid;
    end if;
    -- The worst wound it would do good: one gone bad, or dressed as well already, is passed over, never in the way.
    hurt := wound_to_dress(p_world, p_uid, pt.wounds);
    if hurt is null then return; end if;
    use := dressing_for(p_world, p_uid, hurt);
    if use.id is null or not consume(p_world, p_uid, use.def, 1, use.id) then return; end if;
    got := dressing_put(use);
    v_kind := (select name from wound_kind_def where id = hurt->>'kind');
    suits := got = (select herb from wound_kind_def where id = hurt->>'kind');
    -- Slips half as often for a Naturalist's Sure Hands.
    clean := perk_pass(skill_check(skill_of(p_world, p_uid, 'first_aid'), dress_check(), use.ql),
                       pk(p_world, p_uid, 'fail:bind_wound', 1));
    -- And closes faster for the hands that dressed it: a Naturalist's Quick Mend.
    v_mend := pk(p_world, p_uid, 'mend:bind_wound', 1);
    -- Cloth holds a dressing on. The right herb closes the wound.
    healed := (0.06 + (skill_of(p_world, p_uid, 'first_aid') / 100) * 0.24 + (use.ql / 100) * 0.1)
              * (case when clean then 1 else 0.35 end)
              * (case when suits then 1.5 when got <> '' then 1.1 else 1 end)
              -- And more on a body far gone, for a Chirurgeon's Triage Instinct, and over again in a Surgeon's Hands.
              * (case when coalesce((pt.stats->>'health')::double precision, 1) < pk(p_world, p_uid, 'triage:below', 0)
                      then pk(p_world, p_uid, 'triage:heal', 1) else 1 end)
              * (case when (p.blessings->'surgeons_hands'->>'until')::timestamptz > now()
                      then (p.blessings->'surgeons_hands'->>'more')::double precision else 1 end)
              -- And more on somebody else, for a Naturalist's Field Medic or a Chirurgeon's Field Surgeon.
              * (case when v_other then pk(p_world, p_uid, 'heal:others', 1) else 1 end);
    out_w := '[]'::jsonb;
    for one in select * from jsonb_array_elements(pt.wounds) loop
      if one = hurt then
        one := jsonb_set(one, '{severity}', to_jsonb(greatest(0, (one->>'severity')::double precision - healed)));
        if clean then
          one := jsonb_set(jsonb_set(one, '{dressing}', to_jsonb(got)), '{bleeding}', 'false');
          one := case when v_mend <> 1 then jsonb_set(one, '{mend}', to_jsonb(v_mend)) else one - 'mend' end;
          -- And goes bad less often under the hands that dressed it: a Chirurgeon's Clean Cloth (`fester_chance`).
          one := case when pk(p_world, p_uid, 'fester:bind_wound', 1) <> 1
                      then jsonb_set(one, '{fester}', to_jsonb(pk(p_world, p_uid, 'fester:bind_wound', 1))) else one - 'fester' end;
        end if;
      end if;
      if (one->>'severity')::double precision > 0.004 or (one->>'infected')::boolean then
        out_w := out_w || one;
      end if;
    end loop;
    -- And wind back on whoever it is on, for a Chirurgeon's Bedside Manner.
    update player set wounds = out_w,
        stats = jsonb_set(jsonb_set(pt.stats, '{health}',
          to_jsonb(least(1, coalesce((pt.stats->>'health')::double precision, 1) + healed))),
          '{stamina}', to_jsonb(least(1, coalesce((pt.stats->>'stamina')::double precision, 1) + pk(p_world, p_uid, 'stamina:bind_wound', 0))))
      where world_id = p_world and uid = pt.uid;
    perform journal_note(p_world, p_uid, 'dressed');
    if clean and suits then perform journal_note(p_world, p_uid, 'covered'); end if;
    perform skill_raise(p_world, p_uid, 'first_aid', try_gain(clean, bandage_gain()));
    if v_other then
      perform tell(p_world, p_uid, case
        when not clean then 'The dressing slips and you make a poor job of it. ' || coalesce(pt.name, 'They')
          || ' still has ' || wound_text(hurt) || '.'
        else 'You dress the ' || v_kind || ' on ' || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || case when suits then ' with ' || got || ', which suits it.' when got <> '' then ' with ' || got || '.'
                  else ' with cloth.' end
        end, 'event');
      perform tell(p_world, pt.uid, coalesce(p.name, 'Somebody') || case when clean
        then ' dresses the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.'
        else ' tries to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || ' and makes a poor job of it.' end,
        'event');
      return;
    end if;
    perform tell(p_world, p_uid, case
      when not clean then 'The dressing slips and you make a poor job of it. You still have '
        || wound_text(hurt) || '.'
      -- Naming the wound it went on, as the browser does.
      when suits then 'You lay the ' || got || ' cover on the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it. The bleeding stops at once and it is already closing.'
      when got <> '' then 'You bind the ' || got || ' cover over the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || '. It is the wrong herb for a ' || v_kind || ', but it holds and the bleeding stops.'
      else 'You clean the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it with cloth. The bleeding stops, though it will be slow to close.'
      end, 'event');

  elsif p_action = 'clean_wound' then
    select * into p from player where world_id = p_world and uid = p_uid;
    select i.* into lye from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'lye_bucket'
      order by i.ql desc limit 1;
    if lye.id is null or not consume(p_world, p_uid, 'lye_bucket', 1, lye.id) then return; end if;
    perform give(p_world, p_uid, 'bucket', 1, lye.ql);
    clean := skill_check(skill_of(p_world, p_uid, 'first_aid'), 26, lye.ql);
    perform journal_note(p_world, p_uid, 'cleaned');
    perform skill_raise(p_world, p_uid, 'first_aid', try_gain(clean, clean_gain()));
    select x into hurt from jsonb_array_elements(p.wounds) x where (x->>'infected')::boolean limit 1;
    if not clean then
      perform tell(p_world, p_uid, 'You scour the '
        || (select name from wound_kind_def where id = hurt->>'kind')
        || ' out and it is no better for it. The lye is gone.', 'error');
      return;
    end if;
    out_w := '[]'::jsonb;
    for one in select * from jsonb_array_elements(p.wounds) loop
      if one = hurt then
        -- Scoured out, nothing of the old dressing is left on it: no salve and no quick hands.
        one := jsonb_set(jsonb_set(jsonb_set(one, '{infected}', 'false'),
          '{bleeding}', 'true'), '{dressing}', 'null'::jsonb) - 'mend' - 'salved';
      end if;
      out_w := out_w || one;
    end loop;
    update player set wounds = out_w where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You scour the '
      || (select name from wound_kind_def where id = hurt->>'kind') || ' on your '
      || part_name(hurt->>'part') || ' out with lye. It is open and clean again, and bleeding. Dress it.', 'event');

  elsif p_action = 'treat_creature' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    select i.* into use from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'bandage'
      order by i.ql desc limit 1;
    if use.id is null or not consume(p_world, p_uid, 'bandage', 1, use.id) then return; end if;
    clean := skill_check(skill_of(p_world, p_uid, 'first_aid'), 14, use.ql);
    top := max_health(c);
    healed := top * (0.06 + (skill_of(p_world, p_uid, 'first_aid') / 100) * 0.24 + (use.ql / 100) * 0.1)
              * (case when clean then 1 else 0.35 end);
    update creature set health = least(top, health + healed)
      where world_id = p_world and id = c.id returning * into c;
    perform skill_raise(p_world, p_uid, 'first_aid', try_gain(clean, bandage_gain()));
    perform tell(p_world, p_uid, case when clean
      then 'You dress ' || c.name || '''s wounds with the '
        || lower((select name from item_def where id = 'bandage')) || '. It is up to '
      else c.name || ' will not hold still and the dressing goes on badly. It is up to '
      end || ceil(c.health) || ' of ' || top || '.', 'event');
  end if;
end $function$;

notify pgrst, 'reload schema';
select private.lock_doors();
