/*
 * Whey: pressing a bucket of milk into cheese hands the bucket back full of
 * whey, and a bucket of whey is fed to a creature you keep (`dairy.ts`).
 *
 * The bucket of whey and the recipe that hands it back are definitions: an
 * item, a vessel (`vessel_def`, so it is poured into a barrel or tipped out
 * through the jobs every bucket has), `recipe_gives` for `make_cheese` (a
 * bucket of whey back on success, an empty bucket on failure), and the
 * constants `whey_bucket` and `whey_feed`. What is here is the feeding.
 *
 * Feed takes what was asked for (the target's `itemUid`) if it is carried and
 * is something the creature is fed, and otherwise the first such thing in the
 * pack: its own diet, or a bucket of whey, which every kind takes. A thing of
 * its diet is eaten and fills `graze_fill` of its hunger, which was the 0.5
 * written out here; a bucket of whey fills `whey_feed` and becomes an empty
 * bucket in place (`vessel_becomes`). The browser's `feed` is the same.
 *
 * Replaced, each from its newest definition, for the feed branch apiece:
 *   creature_refusal  -- `feed_in_pack`, and the refusal names whey
 *   perform_creature  -- `feed_in_pack`, whey, `graze_fill`
 */

/*
 * What a creature you keep is fed out of the pack: the thing asked for, when
 * it is carried loose and is one, or else the first of its diet or a bucket of
 * whey. The browser's `feedOf`.
 */
create or replace function feed_in_pack(p_world uuid, p_uid uuid, p_species text, p_target jsonb)
  returns item language plpgsql stable as $$
declare v_it item;
begin
  select i.* into v_it from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
     and (is_bait_for(p_species, i.def) or i.def = whey_bucket())
     and (target_item(p_target) is null or i.id = target_item(p_target))
   order by i.id limit 1;
  return v_it;
end $$;

CREATE OR REPLACE FUNCTION public.creature_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare c creature; d species_def; food text; held int; working int; cap int; q creature; pl player;
begin
  -- Opening a crate you carry is asked of the crate, not of a creature.
  if p_action in ('crate_follow', 'crate_work') then
    return crate_open_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- Walked forward before it is looked at: where it was is not where it is.
  perform creature_settle(p_world, (p_target->>'id')::int);
  c := target_creature(p_world, p_target);
  if c.world_id is null then return 'It is gone.'; end if;
  select * into d from species_def where id = c.species;

  -- In the traces until somebody takes it out: nothing that would send it
  -- anywhere else is open to it, in the words culling one already uses.
  if p_action in ('assign_deed', 'take_creature', 'crate_creature', 'release_creature')
     and c.hitched_to is not null then
    return c.name || ' is in the traces. Take it out first.';
  end if;

  -- Only your own is yours to send anywhere, put in a crate, order about or name.
  if p_action in ('take_creature', 'assign_deed', 'crate_creature', 'release_creature', 'cull_creature',
                  'set_stance', 'order_attack', 'order_heel', 'rename_creature')
     and c.mode <> 'wild' and c.keeper is distinct from p_uid then
    return c.name || ' is not yours.';
  end if;

  -- An order is heard from wherever you stand, as a stance is.
  if p_action not in ('examine_creature', 'assign_deed', 'set_stance', 'order_attack', 'order_heel')
     and not creature_in_reach(p_world, p_uid, c) then
    return case when c.mode = 'wild' then 'The ' || lower(d.name) || ' is not close enough.'
                else 'Stand next to ' || c.name || '.' end;
  end if;

  if p_action = 'tame' then
    if d.monster then
      return 'A ' || lower(d.name) || ' is not a wildermon. There is nothing to be done with it but kill it.';
    end if;
    if c.mode <> 'wild' then return c.name || ' is already yours.'; end if;
    if skill_of(p_world, p_uid, 'taming') < d.tame_level then
      return 'You need taming ' || to_char(d.tame_level, 'FM990.#') || ' to try.';
    end if;
    if bait_in_pack(p_world, p_uid, c.species, pk(p_world, p_uid, 'bait:any', 0) > 0) is null then
      return d.name || 's take ' || diet_text(c.species) || '. Bring some.';
    end if;
    -- The first follows you, and every one after that goes into a crate you carry.
    return tame_room_refusal(p_world, p_uid);

  elsif p_action = 'assign_deed' then
    if c.mode = 'wild' then return 'It is not yours to set to work.'; end if;
    if c.mode = 'stored' then return c.name || ' is in a creature crate. Open the crate to set it to work.'; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'You have no settlement to assign it to.';
    end if;
    if d.gathers is null then return 'A ' || lower(d.name) || ' has no trade to be set to.'; end if;
    -- A trade asked for by name has to be one of its own.
    if nullif(p_target->>'job', '') is not null
       and not (p_target->>'job' = d.gathers or p_target->>'job' = any(coalesce(d.trades, '{}'::text[]))) then
      return 'A ' || lower(d.name) || ' cannot be set to that.';
    end if;
    if not worker_job_ported(coalesce(nullif(p_target->>'job', ''), d.gathers)) then
      return 'Nobody has taught this island what '
        || (select plain from gather_def where id = coalesce(nullif(p_target->>'job', ''), d.gathers))
        || ' looks like yet.';
    end if;
    -- One off a post takes a place as much as one off the road, since a post costs none.
    if c.mode <> 'deed' or c.post is not null then
      working := workers_on_deed(p_world, p_uid);
      cap := worker_cap(p_world, p_uid);
      if working >= cap then
        return (my_deed(p_world, p_uid)).name || ' has work for ' || cap
          || ' wildermon at level ' || cap || '. Upgrade the settlement to take on more.';
      end if;
    end if;
    return null;

  elsif p_action = 'feed' then
    if c.mode not in ('active', 'deed') then return 'It is not yours to feed.'; end if;
    -- Its own diet, or a bucket of whey, which every kind takes (`feed_in_pack`).
    if (feed_in_pack(p_world, p_uid, c.species, p_target)).id is null then
      return 'It eats ' || diet_text(c.species) || ', or drinks a bucket of whey.';
    end if;
    return null;

  elsif p_action = 'groom' then
    if d.monster then return 'Not that. Not ever.'; end if;
    if c.mode = 'wild' then return 'It is not yours to brush.'; end if;
    if pack_count(p_world, p_uid, 'brush') <= 0 then return 'You need a brush.'; end if;
    if c.care >= 0.995 then return c.name || ' has been brushed to a shine already.'; end if;
    return null;

  elsif p_action = 'shear' then
    if d.fleece is null then return 'There is nothing on it worth shearing.'; end if;
    if c.mode = 'wild' then return 'Tame it first; it will not stand still for you otherwise.'; end if;
    if pack_count(p_world, p_uid, 'carving_knife') <= 0 then return 'You need a knife to shear with.'; end if;
    if c.fleece < 0.35 then
      return c.name || ' has hardly any '
        || case when d.shear_yield = 'feather' then 'feathers' else 'fleece' end || ' back yet.';
    end if;
    return null;

  elsif p_action = 'milk_creature' then
    if not d.milk then return 'That is not something you milk.'; end if;
    if c.mode in ('wild', 'stored') then return 'It is not yours to milk.'; end if;
    -- Less than a bucket a milking goes on into a part bucket of milk, if there is one (`milk_go`).
    if pack_count(p_world, p_uid, 'bucket') <= 0
       and not (milk_litres(c.species) < bucket_litres() and pack_count(p_world, p_uid, 'milk_part') > 0) then
      return 'You need an empty bucket.';
    end if;
    if c.sex <> 'female' then return c.name || ' is male. Nothing is coming out of him.'; end if;
    if c.fleece < milk_ready() then return c.name || ' has nothing to give yet.'; end if;
    return null;

  elsif p_action = 'set_stance' then
    if c.mode <> 'active' then return 'Only a companion takes orders like that.'; end if;
    if coalesce(p_target->>'stance', '') not in ('passive', 'defensive', 'aggressive', 'guard') then
      return 'Passive, defensive, guarding you or aggressive.';
    end if;
    return null;

  elsif p_action = 'order_attack' then
    if c.mode <> 'active' then return 'Only a companion takes orders like that.'; end if;
    if coalesce(p_target->>'foe', '') !~ '^[0-9]+$' then return 'Mark something wild first, or fight it.'; end if;
    select * into q from creature where world_id = p_world and id = (p_target->>'foe')::int;
    if not found or q.mode <> 'wild' or q.hitched_to is not null then return 'Mark something wild first, or fight it.'; end if;
    select * into pl from player where world_id = p_world and uid = p_uid;
    -- As far as it follows a fight: further for a Beastmaster's Long Leash.
    if sqrt((creature_x(q) - pl.x) ^ 2 + (creature_y(q) - pl.y) ^ 2) > pk(pl.class_mul, 'leash:companion', companion_leash()) then
      return 'It is more than ' || pk(pl.class_mul, 'leash:companion', companion_leash()) || ' tiles from you.';
    end if;
    return null;

  elsif p_action = 'order_heel' then
    if c.mode <> 'active' then return 'Only a companion takes orders like that.'; end if;
    return null;

  elsif p_action = 'rename_creature' then
    if c.mode = 'wild' then return 'It is not yours to name.'; end if;
    if nullif(btrim(coalesce(p_target->>'name', '')), '') is null then return 'Choose a name.'; end if;
    return null;

  elsif p_action = 'take_creature' then
    if c.mode = 'stored' then return c.name || ' is in a creature crate. Open the crate to let it out.'; end if;
    if c.mode <> 'deed' then return 'It is already with you.'; end if;
    -- Where the one following you now goes, or why it has nowhere to.
    return (companion_swap(p_world, p_uid, c)).v_why;

  elsif p_action = 'crate_creature' then
    if c.mode = 'stored' then return c.name || ' is already in a creature crate.'; end if;
    if c.mode not in ('active', 'deed') then return 'It is not yours to put in a crate.'; end if;
    if c.rider is not null then return 'Get down off ' || c.name || ' first.'; end if;
    if empty_crate(p_world, p_uid) is null then return 'You need an empty creature crate in your pack.'; end if;
    return null;

  elsif p_action = 'release_creature' then
    if c.mode = 'wild' then return 'It is already wild.'; end if;
    if c.mode = 'stored' and exists (select 1 from item i where i.world_id = p_world and i.creature = c.id
                                        and (i.deal is not null or i.holder <> 'player')) then
      return c.name || '''s crate is on offer, on a stall or in the post. Take it back first.';
    end if;
    return null;

  elsif p_action = 'cull_creature' then
    -- Only your own, and only one that is not in the traces or under you when
    -- you ask: both of those are a mess this does not have to make.
    if c.mode = 'wild' then return 'That one is nobody''s. Fight it if you mean it.'; end if;
    if c.hitched_to is not null then return c.name || ' is in the traces. Take it out first.'; end if;
    if c.rider is not null then return 'Get down off ' || c.name || ' first.'; end if;
    if c.mode = 'stored' and exists (select 1 from item i where i.world_id = p_world and i.creature = c.id
                                        and (i.deal is not null or i.holder <> 'player')) then
      return c.name || '''s crate is on offer, on a stall or in the post. Take it back first.';
    end if;
    return null;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.perform_creature(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare c creature; d species_def; a age_def; food text; n int; made_ql double precision;
        gained double precision; chance double precision; warm double precision; nm text;
        held int; brush_id bigint; top double precision; before double precision; skill double precision;
        dd deed; v_swap int; v_to text; v_why text; v_more boolean := false; v_fed item;
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
    -- What it is fed: the thing asked for, or the first of its diet or a bucket of whey (`feedOf`).
    v_fed := feed_in_pack(p_world, p_uid, c.species, p_target);
    if v_fed.id is null then return; end if;
    food := v_fed.def;
    if food = whey_bucket() then
      -- Drunk out of the bucket, and the bucket kept.
      if not vessel_becomes(v_fed.id, 'bucket') then return; end if;
      update creature set hunger = least(1, hunger + whey_feed()) where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, c.name || ' drinks the bucket of whey. The bucket comes back empty.', 'event');
    else
      if not consume(p_world, p_uid, food, 1, v_fed.id) then return; end if;
      -- A meal (`GRAZE_FILL`), as grazing and a store on the deed fill it.
      update creature set hunger = least(1, hunger + graze_fill()) where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, c.name || ' gobbles up the ' || material_name(food, 1) || '.', 'event');
    end if;

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
    -- A bucket off a Cudda, a Gorral's litres into a part bucket (`milk_go`).
    perform milk_go(p_world, p_uid, c);

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

select private.lock_doors();
