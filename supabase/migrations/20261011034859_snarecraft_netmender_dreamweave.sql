-- Enchanting part 3f: Snarecraft, Netmender and Dreamweave.
--
-- Snarecraft (2 dark, a snare, a deadfall or a creel, enchanted where it
-- stands or in the pack): a trap's chance of taking a creature is QL/4 %
-- better, never past 90% (catch_chance); a creel's chance of a fish the same
-- (trap_settle). Netmender (2 water, a fishing net): a drag brings up QL/10 %
-- more fish on the average (perform_fish), and the net wears five times that
-- share slower, QL/2 % (wear_tool; enchant_second). Dreamweave (dark + light,
-- a bed, a cot or a tent): a night in it banks QL/4 % more rest, and the most
-- rest held after it is that much more (sleep_until_morning, passed from
-- perform_last). Examine's line fills a second figure, {w} (enchant_says).
--
-- Rewritten from their newest definitions:
--   catch_chance         20260915002500_traps.sql
--   wear_tool            20261011021905_four_for_the_tools_a_job_is_done_with.sql
--   trap_settle          20260927121838_the_mender_moved_onto_perks.sql
--   perform_fish         20261011021905_four_for_the_tools_a_job_is_done_with.sql
--   sleep_until_morning  20260915014000_night.sql
--   enchant_says         20261011025047_a_pack_a_coat_and_a_hat.sql
--   perform_last         20261010230740_enchanting.sql

drop function if exists sleep_until_morning(uuid, uuid, double precision, text);

create or replace function catch_chance(p placed, c creature) returns double precision
  language sql stable as $$
  select least(0.9, d.odds
    * (0.5 + least(100, greatest(1, p.ql)) / 140)
    * greatest(0.15, 1 - s.tame_level / (trap_holds(p) * 1.8))
    * case when s.timid then 1.5 when s.hunter then 0.6 else 1 end
    -- And better for a Snarecraft set into it where it stands (`catchChance`).
    * (1 + placed_enchant(p, 'snare')))
  from trap_def d, species_def s
  where d.id = p.sub and s.id = c.species
$$;

CREATE OR REPLACE FUNCTION public.wear_tool(p_item bigint, p_multiplier double precision DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare it item;
begin
  select * into it from item where id = p_item;
  if not found then return; end if;
  -- Less for a perk on the tool, for whoever has it in hand (a Carpenter's Saw Care).
  -- And less for a Truesteel in it (`wearTool`).
  perform damage_item(p_item, (0.06 + 3 / (10 + it.ql)) * p_multiplier
    * case when it.holder_uid is null then 1 else pk(it.world_id, it.holder_uid, 'wear:' || it.def, 1) end
    * (1 - enchant_of(it, 'temper'))
    -- And a Netmender in a net, that many times its share of the catch.
    * (1 - enchant_of(it, 'mend') * enchant_second('mend')));
end $function$;

CREATE OR REPLACE FUNCTION public.trap_settle(p_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare p placed; d trap_def; v_dmg double precision; v_n int; v_best creature;
        v_chance double precision; v_odds double precision; s species_def;
        v_depth double precision; v_got text; v_held int; v_ql double precision; v_new bigint; v_mul jsonb;
begin
  select * into p from placed where id = p_id and kind = 'trap' for update;
  if not found then return false; end if;
  select * into d from trap_def where id = p.sub;

  v_dmg := trap_dmg(p);
  if v_dmg >= 100 then
    if p.caught is not null then
      perform spring_trap(p_id, 'The ' || lower(trap_name(p))
        || ' rots through and whatever was in it walks away.');
    end if;
    if p.made_by is not null then
      perform tell(p.world_id, p.made_by, 'A ' || lower(trap_name(p))
        || ' has rotted through out in the country.', 'system');
    end if;
    delete from item where holder = 'trap' and placed = p_id;
    delete from placed where id = p_id;
    return true;
  end if;

  -- How many rolls there were between then and now, bounded by its own life.
  v_n := floor(least(extract(epoch from (now() - p.since)), trap_life(p.sub, p.ql) * kept_life(p))
               / trap_check_every())::int;
  update placed set dmg = v_dmg, since = now() where id = p_id;
  if p.bait is null or v_n < 1 then return false; end if;

  if d.water then
    v_held := coalesce((select sum(i.count)::int from item i
                        where i.holder = 'trap' and i.placed = p_id), 0);
    -- As many as it holds, more for a Fisher's Deep Creel in it.
    if v_held >= creel_hold(p) then return false; end if;
    -- What its setter's perks make of what its bait draws (a Fisher's Strong Bait and Big Fish).
    select pl.class_mul into v_mul from player pl where pl.world_id = p.world_id and pl.uid = p.made_by;
    v_depth := water_depth(p.world_id, p.x, p.y);
    -- Better odds for its maker's hand in it (a Tailor's Fisher's Friend), and for a Snarecraft set into it.
    v_odds := d.odds * (0.6 + least(100, greatest(1, p.ql)) / 250) * mark_of(p.mark, 'catch')
      * (1 + placed_enchant(p, 'snare'));
    -- One roll standing for all of them, then one fish for each success it is
    -- still willing to hold.
    for v_n in 1..least(v_n, creel_hold(p) - v_held) loop
      exit when random() >= v_odds;
      v_got := pick_fish(v_depth, 40, p.bait, random(), v_mul);
      exit when v_got is null;
      v_ql := greatest(1, least(100, p.ql * (0.5 + random() * 0.7)));
      insert into item (world_id, holder, placed, def, ql, count)
      values (p.world_id, 'trap', p_id, v_got, v_ql, 1);
      -- Every so often the bait is worked out of it and it goes on empty.
      if random() < 0.14 then
        update placed set bait = null, bait_ql = null where id = p_id;
        if p.made_by is not null then
          perform tell(p.world_id, p.made_by, 'The bait is gone out of a creel. '
            || 'It will take nothing more until it is baited again.', 'system');
        end if;
        exit;
      end if;
    end loop;
    return false;
  end if;

  if p.caught is not null then return false; end if;
  -- The likeliest thing in reach that would come to what is laid, and is not
  -- so wary that it simply takes the bait and goes.
  for v_best in select c.* from creature c
    where c.world_id = p.world_id and c.mode = 'wild' and c.trapped is null
      and sqrt((creature_x(c) - p.cx) ^ 2 + (creature_y(c) - p.cy) ^ 2) <= d.reach
    order by catch_chance(p, c) desc, c.id
  loop
    select * into s from species_def where id = v_best.species;
    if s.monster or not exists (select 1 from species_diet sd
          where sd.species = s.id and sd.item = p.bait) then
      continue;
    end if;
    if s.tame_level > trap_holds(p) then
      -- Too much trap for: a third of a chance a roll that it lifts the bait.
      if random() < 1 - power(0.7, v_n) then
        update placed set bait = null, bait_ql = null where id = p_id;
        if p.made_by is not null then
          perform tell(p.world_id, p.made_by, 'Something took the bait out of your '
            || lower(trap_name(p)) || ' and was gone. It was too much trap for.', 'system');
        end if;
        return false;
      end if;
      continue;
    end if;
    v_chance := catch_chance(p, v_best);
    exit;
  end loop;
  if v_best.id is null or v_chance is null then return false; end if;

  -- The one roll that stands for all of them.
  if random() >= 1 - power(1 - v_chance, v_n) then return false; end if;
  update creature set trapped = p_id,
      from_x = p.cx, from_y = p.cy, to_x = p.cx, to_y = p.cy,
      leg_at = now(), leg_ends = now(), until = now() + interval '1 hour',
      hunting = null, enemy = null, settled_at = now()
    where world_id = p.world_id and id = v_best.id;
  update placed set caught = v_best.id where id = p_id;
  if p.made_by is not null then
    -- The browser's own words, and it says them the instant the board falls.
    -- Here nobody was there for the instant, so it is said when somebody next
    -- looks — which is the whole of what a trap is for.
    perform journal_note(p.world_id, p.made_by, 'caught');
    perform tell(p.world_id, p.made_by, 'Your ' || lower(trap_name(p))
      || ' has sprung. There is a ' || lower(s.name) || ' in it.', 'event');
  end if;
  return false;
end $function$;

CREATE OR REPLACE FUNCTION public.perform_fish(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare tx int; ty int; spot record; skill double precision; rod_ql double precision;
        bait text; got text; made_ql double precision; tool_id bigint;
        haul int; i int; parts text[] := '{}'; one text; counted jsonb := '{}'::jsonb; k text;
        v_net jsonb; v_mend double precision := 0; v_more double precision; v_mul jsonb; v_rare text; v_order text[] := '{}';
begin
  select class_mul into v_mul from player where world_id = p_world and uid = p_uid;
  tx := (p_target->>'x')::int; ty := (p_target->>'y')::int;
  skill := skill_of(p_world, p_uid, 'fishing');

  if p_action = 'fish' then
    select * into spot from cast_at(p_world, p_uid, tx, ty, cast_reach(p_world, p_uid));
    if spot.depth is null then return; end if;
    rod_ql := tool_ql(p_world, p_uid, 'fishing_rod');
    select it.id into tool_id from item it
      where it.world_id = p_world and it.holder = 'player' and it.holder_uid = p_uid and it.def = 'fishing_rod'
      order by tool_worth(it.ql, it.dmg, it.extra, it.rare, it.bless) desc limit 1;
    if tool_id is not null then perform wear_tool(tool_id, 0.5); end if;
    -- Something goes on the hook if anything worth using is in the pack.
    bait := bait_for(p_world, p_uid, spot.depth, skill);
    if bait is not null and pack_count(p_world, p_uid, bait) < 1 then return; end if;

    got := catch_fish(spot.depth, skill, rod_ql, bait, v_mul);
    -- The bait goes with a landed fish, and with one that comes off unless a
    -- Fisher's Bait Saver keeps it on the hook.
    if bait is not null and (got is not null
                             or not (pk(v_mul, 'spare:fish', 0) > 0 and random() < pk(v_mul, 'spare:fish', 0))) then
      perform consume(p_world, p_uid, bait, 1);
    end if;
    -- Written below the cast rather than above it: what comes off the hook
    -- used to teach exactly what a landed fish taught.
    perform skill_raise(p_world, p_uid, 'fishing', try_gain(got is not null, rod_gain()));
    if got is null then
      perform tell(p_world, p_uid, case when bait is null then 'Something takes it and comes off again.'
        else 'Something takes the ' || lower((select coalesce(name, bait) from item_def where id = bait))
             || ' and comes off again.' end, 'event');
    else
      made_ql := product_ql(skill, rod_ql);
      -- And now and then a rare one, for a Fisher's Rare Catch.
      v_rare := perk_rare(pk(v_mul, 'rare:fish', 0));
      perform gather(p_world, p_uid, got, 1, made_ql, null, v_rare);
      perform journal_note(p_world, p_uid, 'fish:' || got);
      if bait is not null then perform journal_note(p_world, p_uid, 'baited'); end if;
      perform tell(p_world, p_uid, 'You land '
        || case when coalesce(v_rare, lower((select name from fish_def where id = got))) ~ '^[aeiou]' then 'an ' else 'a ' end
        || coalesce(v_rare || ' ', '') || lower((select name from fish_def where id = got))
        || case when bait is null then '' else ' on the '
             || lower((select coalesce(name, bait) from item_def where id = bait)) end
        || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');
      if v_rare is not null then
        perform journal_note(p_world, p_uid, v_rare);
        perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
      end if;
      -- And one more, now and then, for a Bountiful on the rod: the same fish, never rare.
      perform enchant_more(p_world, p_uid, 'fishing_rod', 'bounty', got, made_ql, lower((select name from fish_def where id = got)));
    end if;

  elsif p_action = 'drag_net' then
    select * into spot from cast_at(p_world, p_uid, tx, ty, net_reach(p_world, p_uid));
    if spot.depth is null then return; end if;
    rod_ql := tool_ql(p_world, p_uid, 'fishing_net');
    select it.id, it.mark into tool_id, v_net from item it
      where it.world_id = p_world and it.holder = 'player' and it.holder_uid = p_uid and it.def = 'fishing_net'
      order by tool_worth(it.ql, it.dmg, it.extra, it.rare, it.bless) desc limit 1;
    if tool_id is not null then perform wear_tool(tool_id, 1.4); end if;
    select coalesce(enchant_of(it, 'mend'), 0) into v_mend from item it where it.id = tool_id;
    v_mend := coalesce(v_mend, 0);
    if not exists (select 1 from fish_here(spot.depth, skill)) then
      perform skill_raise(p_world, p_uid, 'fishing', try_gain(false, net_gain()));
      perform tell(p_world, p_uid, 'The net comes up with nothing in it but weed.', 'event');
      return;
    end if;
    -- A net takes numbers, not size: the big fish go round it or through it.
    -- A Fisher's Full Net hauls more before anything else is counted in.
    haul := net_least()::int + floor(random() * (1 + (net_haul() - net_least()) * (0.3 + least(100, rod_ql) / 160)))::int
      + floor(pk(v_mul, 'haul:drag_net', 0))::int;
    -- And more of it for its maker's hand in the net (a Tailor's Fisher's Friend): the share
    -- over a whole fish is a chance at one more, so the catch is that much more on the average.
    -- And a Netmender in it, the same way.
    if mark_of(v_net, 'catch') <> 1 or v_mend > 0 then
      v_more := haul * mark_of(v_net, 'catch') * (1 + v_mend);
      haul := floor(v_more)::int + case when random() < v_more - floor(v_more) then 1 else 0 end;
    end if;
    for i in 1..haul loop
      one := pick_fish(spot.depth, skill, null, random(), v_mul);
      -- Anything that lives deeper than a net reaches mostly avoids it.
      if one is not null and ((select depth from fish_def where id = one) <= 8 or random() < 0.12) then
        -- And now and then a rare one, for a Fisher's Rare Catch, on a pile of its own.
        v_rare := perk_rare(pk(v_mul, 'rare:drag_net', 0));
        k := one || ':' || coalesce(v_rare, '');
        counted := jsonb_set(counted, array[k], to_jsonb(coalesce((counted->>k)::int, 0) + 1));
        -- Said in the order they came up, as the browser says them.
        if not k = any(v_order) then v_order := v_order || k; end if;
      end if;
    end loop;
    if counted = '{}'::jsonb then
      perform skill_raise(p_world, p_uid, 'fishing', try_gain(false, net_gain()));
      perform tell(p_world, p_uid, 'The net comes up empty.', 'event');
      return;
    end if;
    perform skill_raise(p_world, p_uid, 'fishing', try_gain(true, net_gain()));
    made_ql := product_ql(skill, rod_ql);
    perform journal_note(p_world, p_uid, 'netted');
    foreach k in array v_order loop
      one := split_part(k, ':', 1);
      v_rare := nullif(split_part(k, ':', 2), '');
      perform gather(p_world, p_uid, one, (counted->>k)::int, made_ql, null, v_rare);
      perform journal_note(p_world, p_uid, 'fish:' || one, (counted->>k)::int);
      parts := parts || ((counted->>k) || ' × ' || coalesce(v_rare || ' ', '')
                         || lower((select coalesce(name, one) from item_def where id = one)));
      if v_rare is not null then
        perform journal_note(p_world, p_uid, v_rare);
        perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
      end if;
    end loop;
    perform tell(p_world, p_uid, 'You walk the net round and haul it in: '
      || array_to_string(parts, ', ') || '.', 'event');
  end if;

end $function$;

create or replace function sleep_until_morning(p_world uuid, p_uid uuid, p_rest double precision,
    p_what text, p_dream double precision default 0)
  returns void language plpgsql as $$
declare h double precision; hours double precision; secs double precision; p player;
        banked double precision; was double precision;
begin
  h := hour_of_day(p_world);
  hours := case when h < dawn_hour() + 0.5 then dawn_hour() + 0.5 - h
                else 24 - h + dawn_hour() + 0.5 end;
  secs := hours / 24 * day_seconds();
  perform sleep_forward(p_world, p_uid, secs);

  select * into p from player where world_id = p_world and uid = p_uid for update;
  was := rest_left(p);
  -- What a Dreamweave in the bed adds, to the night and to the most that is held (`bankRest`).
  banked := greatest(was, least(rest_cap() * (1 + p_dream), was + secs * rest_per_second() * p_rest * (1 + p_dream)));
  update player set
      stats = jsonb_set(jsonb_set(jsonb_set(stats,
        '{stamina}', '1'),
        '{health}', to_jsonb(least(1, coalesce((stats->>'health')::double precision, 1) + 0.25 * p_rest))),
        '{hunger}', to_jsonb(greatest(0, coalesce((stats->>'hunger')::double precision, 1) - 0.2))),
      rested = banked, rested_at = now()
    where world_id = p_world and uid = p_uid;
  -- Sleeping is hungry work, and a night is a long time to go without water.
  update player set stats = jsonb_set(stats, '{thirst}',
      to_jsonb(greatest(0, coalesce((stats->>'thirst')::double precision, 1) - 0.25)))
    where world_id = p_world and uid = p_uid;
  perform skill_raise(p_world, p_uid, 'body_stamina', 0.3 * p_rest);

  perform tell(p_world, p_uid, 'You sleep in the ' || p_what || ' and wake at '
    || world_clock(p_world) || ', rested.'
    || case when banked - was > 1
       then ' You have ' || clock_left(banked) || ' of rest in you; while it burns, '
            || 'everything teaches you twice as much.'
       else '' end, 'event');
end $$;

create or replace function enchant_says(p jsonb) returns text language sql immutable as $fn$
  select coalesce((select ' ' || e.name || ' at QL ' || enchant_ql_word(z.q) || ': '
                          || replace(replace(enchant_line(e.id), '{v}', enchant_figure(e.id, enchant_hit_chance(e.id, z.q))),
                                     '{w}', enchant_pct(enchant_hit_chance(e.id, z.q) * enchant_second(e.effect)))
                     from enchantments() e, (select (p->>'ql')::double precision as q) z where e.id = p->>'id'), '')
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
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    perform perform_bauble(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'sacrifice' then
    perform perform_sacrifice(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'absorb_mote' then
    perform perform_absorb(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = enchant_action() then
    perform perform_enchant(p_world, p_uid, p_target);
    return;
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    if bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
         (p_target->>'x')::int, (p_target->>'y')::int) is not null then return; end if;
    select * into d from bridge_def where id = v_kind;
    v_h := round((centre_height(p_world, floor(p.x)::int, floor(p.y)::int)
                + centre_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)) / 2);
    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when v_kind = 'stone' then null else 'Oak' end, p_uid)
    returning id into v_id;
    -- gates: the first span, beside the end it is set out from, also takes a drawbridge's winch.
    insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select p_world, v_id, t.n, t.x, t.y, span_bill(v_kind, t.n), span_bill(v_kind, t.n)
    from span_tiles(floor(p.x)::int, floor(p.y)::int,
                    (p_target->>'x')::int, (p_target->>'y')::int) t;
    select count(*)::int into v_n from bridge_span sp where sp.world_id = p_world and sp.bridge = v_id;
    perform journal_note(p_world, p_uid, 'planned_bridge');
    perform skill_raise(p_world, p_uid, d.skill, 0.4);
    perform tell(p_world, p_uid, 'You set out a ' || lower(d.name) || ' of ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || ' across. Each one wants '
      || span_wants(span_bill(v_kind)) || '. ' || d.note, 'system');

  elsif p_action = 'build_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into d from bridge_def where id = b.kind;
    select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
      and not span_done(sp.needed) order by sp.n limit 1;
    if not found then return; end if;
    -- One unit of one thing per go, as with a wall.
    select e2.key into v_want from jsonb_each(s.needed) e2
      where (e2.value)::int > 0 and pack_count(p_world, p_uid, e2.key) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    if not consume(p_world, p_uid, v_want, 1) then return; end if;
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
        perform tell(p_world, p_uid, 'That span is decked. ' || v_left || ' still open.', 'event');
      else
        perform journal_note(p_world, p_uid, 'bridged');
        perform tell(p_world, p_uid, 'The last span is decked and the ' || lower(bridge_name(b))
          || ' is open. ' || case when d.carts then 'A cart will cross it.'
                                  else 'Foot traffic only; nothing with a wheel.' end, 'system');
      end if;
    else
      perform tell(p_world, p_uid, 'You work a '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');
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
      then 'You take the ' || lower(bridge_name(b)) || ' down and save '
           || array_to_string(v_parts, ', ') || '.'
      else 'You take the ' || lower(bridge_name(b)) || ' down.' end, 'event');

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
      if e.uid <> p_uid then
        perform tell(p_world, e.uid, 'The bell rings out over ' || r.name || ' from ' || pc.x || ', ' || pc.y || '.', 'system');
      end if;
    end loop;
    perform journal_note(p_world, p_uid, 'rang');
    perform tell(p_world, p_uid, 'You ring the ' || lower(placed_name(pc)) || ' and it sounds over ' || r.name || '. '
      || case when v_n > 0 then v_n || ' wildermon ' || case when v_n = 1 then 'comes' else 'come' end || ' at the sound'
              else 'Nothing is working the deed to come' end
      || ', and every citizen hears where it hangs: ' || pc.x || ', ' || pc.y || '.', 'event');

  elsif p_action = 'sleep' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    /*
     * A well-made bed is a better night than a cot with a thin mattress — and
     * a bed under a roof, in a room with walls all round it, is a better night
     * again than the same bed standing in a field in the weather.
     */
    perform journal_note(p_world, p_uid, 'slept');
    perform sleep_until_morning(p_world, p_uid,
      (select bed from furniture_def where id = pc.sub) * (0.6 + pc.ql / 250)
        * case when case when pc.level < 0 then cellar_done(p_world, floor(pc.x)::int, floor(pc.y)::int) -- cellar: always indoors
                         else indoors(p_world, 0, floor(pc.x)::int, floor(pc.y)::int) end -- cellar
               then indoors_rest() else 1 end, -- cellar
      lower(placed_name(pc)),
      -- And a Dreamweave set into it banks more of the night.
      placed_enchant(pc, 'dream'));

  elsif p_action = 'set_home' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    update player set home_x = pc.x, home_y = pc.y where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You make up the ' || lower(placed_name(pc))
      || '. This is where you will wake, whatever happens to you.', 'event');

  elsif p_action = 'pair_creature' then
    c := target_creature(p_world, p_target);
    mate := mate_for(p_world, c);
    if c.world_id is null or mate.id is null or pair_refuses(p_world, c, mate) is not null then return; end if;
    if c.sex = 'female' then dam := c; sire := mate; else dam := mate; sire := c; end if;
    v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
    v_care := (dam.care + sire.care) / 2;
    v_took := random() < breed_chance(v_skill, v_care);
    perform skill_raise(p_world, p_uid, 'animal_husbandry', try_gain(v_took, breed_gain()));
    if not v_took then
      -- A failed pairing costs both of them a rest, but only half of one.
      -- Half a shorter one for the breeder's Short Rest.
      update creature set bred_at = now() - make_interval(secs => breed_rest() * (1 - pk(p_world, p_uid, 'breed:rest', 1) / 2))
        where world_id = p_world and id in (dam.id, sire.id);
      perform tell(p_world, p_uid, dam.name || ' and ' || sire.name
        || ' will have nothing to do with one another. Brush them, feed them, and try again.', 'error');
      return;
    end if;
    perform pair_them(p_world, dam.id, sire.id, v_skill, p_uid, p_target->>'sex');
    perform journal_note(p_world, p_uid, 'paired');
    perform tell(p_world, p_uid, sire.name || ' is put to ' || dam.name
      || '. She is in young and will drop in about ' || clock_left(gestation() * pk(p_world, p_uid, 'breed:gestation', 1))
      || '. Between them they carry '
      || trait_names((select array_agg(distinct t) from unnest(sire.traits || dam.traits) t))
      || '.', 'event');

  elsif p_action = 'read_blood' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    perform tell(p_world, p_uid, blood_read(p_world, p_uid, c), 'event');

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
    perform skill_raise(p_world, p_uid, 'alchemy', 0.3);
    perform tell(p_world, p_uid, 'You work ' || litres_word(v_n) || ' of ' || colour_word(v_want)
      || ' dye through it. It comes out ' || colour_word(v_want) || ', ' || v_want || '.', 'event');

  elsif p_action = 'strip_dye' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    select * into dye from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = 'lye_bucket' order by i.id limit 1;
    if dye.id is null or not consume(p_world, p_uid, 'lye_bucket', 1) then return; end if;
    perform give(p_world, p_uid, 'bucket', 1, dye.ql);
    update item set dye = null where id = it.id;
    perform skill_raise(p_world, p_uid, 'alchemy', 0.2);
    perform tell(p_world, p_uid, 'You boil it out in lye. It is back to the colour of '
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
    if not craft_consume(p_world, p_uid, bd.input, bd.count) then return; end if;
    if not skill_check(skill_of(p_world, p_uid, 'brewing'), bd.difficulty, 0) then
      update placed set litres = greatest(0, placed_litres(pc) - bd.litres), since = now()
        where id = pc.id;
      update placed set liquid = null where id = pc.id and litres <= 0;
      update placed set knack = null where id = pc.id;
      perform skill_raise(p_world, p_uid, 'brewing', try_gain(false, brew_gain()));
      perform tell(p_world, p_uid, 'It will not take. You tip the whole soured lot out of the '
        || lower(placed_name(pc)) || '.', 'event');
      return;
    end if;
    update placed set litres = bd.litres, liquid = bd.id, ferment = bd.seconds, since = now(),
        ql = greatest(1, least(100, (v_ql + skill_of(p_world, p_uid, 'brewing')) / 2)),
        -- Its brewer's hand in it, which goes into every bucket drawn off it (a Cook's Strong Brew).
        knack = nullif(pk(p_world, p_uid, 'brewed:' || bd.id, 1), 1)
      where id = pc.id;
    perform journal_note(p_world, p_uid, 'brew');
    perform journal_note(p_world, p_uid, 'brew:' || bd.id);
    perform skill_raise(p_world, p_uid, 'brewing', try_gain(true, brew_gain()));
    perform tell(p_world, p_uid, bd.done || ' (about ' || round(bd.seconds / 60) || ' minutes)', 'event');
  end if;
end $function$;

select private.lock_doors();
