-- Enchanting part 3a: six enchantments for what is worn in the jewel slot.
--
-- A jewelled ring takes Scholar's Band (QL/20 % more skill from every go) or
-- Knackstone (the chance of a knack times 1 + QL/200); a jewelled pendant takes
-- Steady Heart (stamina back QL/5 % faster), Hearthbound (hunger and thirst
-- fall QL/5 % slower), Favoured (QL/10 % more favour from a prayer) or
-- Stillwater (QL/10 % more Calm from a sitting). There is one jewel slot, so
-- one of them at a time. All read worn_enchant; the rows and words are the defs'.
--
-- Rewritten from their newest definitions:
--   skill_mult, earn_knacks  20261010050222_the_reader_moves_onto_tiers.sql
--   body_settle, perform_faith  20261010072602_love_and_power_move_onto_tiers.sql
--   sitting_worth  20261010114845_runestones_clear_their_ground.sql

create or replace function skill_mult(p_world uuid, p_uid uuid, p_id text) returns double precision
  language plpgsql stable as $function$
declare p player; m double precision;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  if not found then return 1; end if;
  m := case when coalesce(p.rested, 0) > 0 then rest_mult() else 1 end;
  -- A knack earned on the way up never wears off, unlike a meal or a night's sleep.
  m := m + knack_bonus((p.knacks->>p_id)::int);
  -- And the stones you wear, a jewel's and a circlet's, on the trades they favour.
  m := m + jewel_gain(worn(p_world, p_uid, 'jewel'), p_id) + jewel_gain(worn(p_world, p_uid, 'head'), p_id);
  -- And a Scholar's Band worn, on every trade (`skillMult`).
  m := m + worn_enchant(p_world, p_uid, 'learn');
  -- And a reader's Attentive, for good, on every skill, and a Clarity while it lasts (`skillMult`).
  m := m + path_fx(p_world, p_uid, 'learn', 0);
  if p.clarity_until > now() then
    m := m + coalesce((select (fx->>'more')::double precision from path_pick where id = 'knowledge_clarity'), 0);
  end if;
  -- A full table, worth a fifth, or more to a Cook with Balanced Diet.
  m := m * table_mul(p.nutrition, greatest(table_best(), pk(coalesce(p.class_mul, '{}'::jsonb), 'table:best', table_best())));
  -- And the dish that favours this one, while it lasts.
  m := m + coalesce((select sum((b->>'bonus')::double precision)
                       from jsonb_array_elements(coalesce(p.boons, '[]'::jsonb)) b
                      where b->>'skill' = p_id
                        and (b->>'until')::double precision > world_time(p_world)), 0);
  /*
   * And the tree, which is the last thing on and the only one that is not the
   * same for everybody with the same sheet.
   *
   * Free here, and that is why learning is wired here rather than in
   * `skill_raise`: this function already has the row in hand, and the fold
   * kept on it is a product somebody else worked out. It tells only on the
   * skills the trade covers -- the check is inside `class_mul` -- so a smith's
   * forge sense is worth nothing at a loom.
   */
  m := m * class_mul(coalesce(p.class_mul, '{}'::jsonb), 'learn', p_id);
  -- And a Due Reward's share more on every skill (`justice_reward`).
  m := m * (1 + coalesce(case when (p.blessings->'reward'->>'until')::timestamptz > now()
                              then (p.blessings->'reward'->>'more')::double precision end, 0));
  -- And a bauble for the trade in the altar of the settlement you are working on.
  return greatest(0.01, m) * bauble_learn(p_world, p_uid, p_id);
end $function$;



create or replace function earn_knacks(p_world uuid, p_uid uuid, p_id text, p_base double precision)
returns void language plpgsql as $fn$
declare p player; v_id text; had int;
begin
  -- A Polymath's chance is the better (`knackChance`'s third).
  if random() >= knack_chance(p_id, p_base, path_fx(p_world, p_uid, 'knack', 1) * (1 + worn_enchant(p_world, p_uid, 'knack'))) then return; end if;
  if random() < knack_home() then
    v_id := p_id;
  else
    select k.skill into v_id from knack_kin k
     where k.family = (select family from knack_kin where skill = p_id)
     order by random() limit 1;
    v_id := coalesce(v_id, p_id);
  end if;
  select * into p from player where world_id = p_world and uid = p_uid for update;
  if not found then return; end if;
  had := coalesce((p.knacks->>v_id)::int, 0);
  if had >= knack_cap() then return; end if;
  update player set knacks = jsonb_set(coalesce(knacks, '{}'::jsonb), array[v_id], to_jsonb(had + 1)),
         skills_at = now()
    where world_id = p_world and uid = p_uid;
  perform journal_note(p_world, p_uid, 'knack');
  perform tell(p_world, p_uid, 'You have a knack for '
    || lower((select name from skill_def where id = v_id)) || ' now. It goes in '
    || round(knack_bonus(had + 1) * 100) || '% faster.', 'skill');
end $fn$;



CREATE OR REPLACE FUNCTION public.body_settle(p_world uuid, p_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p player; secs double precision;
        h double precision; t double precision; w double precision; hp double precision;
        deep boolean; swum double precision; swim_from timestamptz; nagged timestamptz;
        cost double precision; gasped double precision; i int;
        v_upkeep double precision; v_free double precision;
begin
  select * into p from player where world_id = p_world and uid = p_uid for update;
  if not found then return; end if;
  secs := least(body_gap(), extract(epoch from (now() - p.body_at)));
  if secs <= 0 then
    update player set body_at = now() where world_id = p_world and uid = p_uid;
    return;
  end if;
  h := coalesce((p.stats->>'hunger')::double precision, 1);
  t := coalesce((p.stats->>'thirst')::double precision, 1);
  w := coalesce((p.stats->>'stamina')::double precision, 1);
  hp := coalesce((p.stats->>'health')::double precision, 1);
  deep := coalesce(in_deep_water(p_world, p_uid), false);
  swim_from := coalesce(p.swim_at, p.body_at);
  nagged := p.drowned_at;

  /*
   * What is on your table, which holds hunger and thirst off.
   *
   * `upkeep_mul` reads the *average* of the four, so anything at all in you
   * helps and a full table helps most. `kept_best` has been crossed from the
   * browser since nutrition was written and nothing on this island read it, so
   * a body that ate well got nothing for it but the bar going up once.
   */
  -- And slower for Power's Enduring.
  -- And slower for a Hearthbound worn (`Game.upkeepMul`).
  v_upkeep := path_fx(p_world, p_uid, 'upkeep', 1) * (1 - worn_enchant(p_world, p_uid, 'upkeep'));
  h := greatest(0, h - secs * hunger_rate() * upkeep_mul(p.nutrition) * v_upkeep);
  t := greatest(0, t - secs * thirst_rate() * upkeep_mul(p.nutrition) * v_upkeep);

  if deep then
    /*
     * Open water, which cost nothing at all until now.
     *
     * A strong swimmer tires more slowly — the same easing the browser has
     * always applied — and a swimmer with no wind left is swallowing water.
     * The warning is spaced by `drown_warn` off the row rather than off a
     * clock in a tab, because `body_settle` runs on every walk and every beat
     * and an unspaced line would be a wall of them.
     */
    -- And less for Power's Hard Breath (`swimWind`).
    cost := swim_wind() * greatest(0.4, 1 - skill_of(p_world, p_uid, 'swimming') / 200) * path_fx(p_world, p_uid, 'swim', 1);
    -- And nothing for the stretch of it inside a Deep Lungs or an Unbroken (Power's): free from the last settling up to the later of the two.
    v_free := greatest(0, least(secs, extract(epoch from (least(now(), greatest(
      coalesce((p.blessings->'path_lungs'->>'until')::timestamptz, p.body_at),
      coalesce((p.blessings->'path_unbroken'->>'until')::timestamptz, p.body_at))) - p.body_at))));
    /*
     * How much of the stretch there was breath for, and how much of it there
     * was not. The browser asks that of every frame it draws; here it is one
     * division, and it has to be asked: a stretch that *ends* out of breath is
     * not a stretch that spent the whole of itself drowning, and charging it
     * as one turns twenty seconds in the water into a death.
     */
    gasped := greatest(0, (secs - v_free) - (case when cost > 0 then w / cost else 0 end));
    w := greatest(0, w - (secs - v_free) * cost);
    if gasped > 0 then
      hp := greatest(0, hp - gasped * drown_rate());
      if nagged is null or now() - nagged > make_interval(secs => drown_warn()) then
        perform tell(p_world, p_uid,
          'You are exhausted and swallowing water. Get to shore!', 'error');
        nagged := now();
      end if;
    end if;
    /*
     * And deep water is its own teacher — a go a second, and no other way.
     *
     * Two things push at this from opposite sides and only one shape satisfies
     * both. `skill_gain_of` has a floor under it (`min_gain`), so a base scaled
     * by a tenth of a second is not a tenth of a second's worth — it is the
     * floor, and a browser settling ten times a second would buy ten goes out
     * of one. And `skill_room` falls as the number rises, so one go of a
     * minute's worth is a quarter more than sixty goes of a second's:
     *
     *     sixty goes of 0.09, a second apiece      1 -> 6.4278
     *     one go of 5.40, the whole minute at once 1 -> 8.0092
     *
     * — which a body left floating while the tab is shut would collect by the
     * three minutes, over and over, drowning each time and not minding.
     *
     * So the clock runs on the row and is spent a whole second at a time, the
     * way `swimClock` spends it over there. Twenty-five goes to a call, as in
     * `settle`, and what is left stays on the clock for the next one — and a
     * body that reaches the shore drops the backlog, because ashore is where
     * the clock starts again.
     */
    swum := least(floor(extract(epoch from (now() - swim_from))), 25);
    if swum >= 1 then
      for i in 1..swum::int loop
        perform skill_raise(p_world, p_uid, 'swimming', swim_learn());
      end loop;
      swim_from := swim_from + make_interval(secs => swum);
    end if;
  else
    if p.act is null then
      /*
       * And your wind, which comes back slower on the move.
       *
       * `wind_walk()` was crossed the day the body was and called by nothing, so
       * a body that walked all day got its wind back as fast as one sitting
       * down. The island cannot watch your feet between beats, so it asks the
       * one thing it does know: whether the body moved at all during the stretch
       * this is settling. Moved in it, walked through it.
       */
      w := least(1, w + secs
             * (case when p.moved_at > p.body_at then wind_walk() else wind_rest() end)
             * (1 + greatest(0, skill_of(p_world, p_uid, 'body_stamina') - char_start()) * wind_per_level())
             -- And faster for a Steady Heart worn (`Game.windMul`).
             * (1 + worn_enchant(p_world, p_uid, 'wind'))
             * (case when h <= 0 or t <= 0 then wind_starving() else 1 end));
    end if;
    -- Ashore, so the swimming clock starts again from nothing and the
    -- telling-off is forgotten.
    swim_from := now();
    nagged := null;
  end if;

  -- Nothing knits while you are trying not to drown.
  if not deep and h > heal_fed() and t > heal_fed() and hp < 1 then
    hp := least(1, hp + secs * heal_rate());
  end if;
  -- And a Renewal's share of the time since the body was last settled (`faith_renewal`), and a Chirurgeon's Regenerate's (`class_regen`).
  hp := least(1, hp + faith_renewal(p.blessings, p.body_at) + class_regen(p.blessings, p.body_at));

  /*
   * And the rest banked by a night in a bed, which burns while you work.
   *
   * `rest_bonus()` was crossed from the browser the day sleeping was ported
   * and nothing ever called it, so the rest went in and never came out: a body
   * that had slept once carried it for ever, and would have carried a doubled
   * rate for ever the moment anything spent it. It burns a second a second,
   * and only while there is a job in hand — standing about is not work.
   */
  if p.act is not null and coalesce(p.rested, 0) > 0 then
    update player set rested = greatest(0, p.rested - secs)
      where world_id = p_world and uid = p_uid;
    if p.rested - secs <= 0 then
      perform tell(p_world, p_uid,
        'The rest goes out of you. Skills go in at their ordinary pace again.', 'system');
    end if;
  end if;

  /*
   * And what is on the table going off, which nothing here did either.
   *
   * `nutrient_decay` is a full measure falling away to nothing over fifty
   * minutes of world time. Without it one good dinner fed a body for the rest
   * of its life, which would have been the reward for porting `upkeep_mul`
   * above rather than a rule.
   */
  if p.nutrition is not null and p.nutrition <> '{}'::jsonb then
    update player set nutrition = (
        select jsonb_object_agg(k, greatest(0, (p.nutrition->>k)::double precision - secs * nutrient_decay()))
          from jsonb_object_keys(p.nutrition) k)
      where world_id = p_world and uid = p_uid;
  end if;

  update player set body_at = now(), swim_at = swim_from, drowned_at = nagged,
    stats = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      coalesce(stats, '{}'::jsonb),
      '{hunger}', to_jsonb(h)), '{thirst}', to_jsonb(t)),
      '{stamina}', to_jsonb(w)), '{health}', to_jsonb(hp))
    where world_id = p_world and uid = p_uid;
  -- And a body that has taken its last breath, where every other death goes.
  if hp <= 0 then perform player_die(p_world, p_uid); end if;
end $function$;



CREATE OR REPLACE FUNCTION public.perform_faith(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p player; pc placed; faith double precision; hour double precision;
        gained double precision; cap double precision; got double precision;
        was double precision; med double precision; sit record; v_step path_step;
        v_way text; r record; v_bloom int;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'pray' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    faith := skill_of(p_world, p_uid, faith_skill());
    hour := hour_of_day(p_world);
    cap := favour_cap(faith);
    -- What a prayer banks is Prayer's to say; what you can hold is faith's (`favour_cap`).
    got := least(cap, favour_settle(p_world, p_uid) + prayer_worth(pc.ql, hour, skill_of(p_world, p_uid, praying_skill()))
                                                     -- And more for a Favoured worn.
                                                     * (1 + worn_enchant(p_world, p_uid, 'favour')));
    update player set favour = got, favour_at = now(), prayed_at = now()
      where world_id = p_world and uid = p_uid;
    perform journal_note(p_world, p_uid, 'prayed');
    perform skill_raise(p_world, p_uid, faith_skill(), prayer_gain());
    perform tell(p_world, p_uid,
      case when abs(hour - 6) < 2 or abs(hour - 20) < 2
           then 'You kneel in the half light and it goes better than it usually does.'
           else 'You kneel at the stone.' end
      || ' Favour ' || floor(got) || ' of ' || floor(cap) || '.', 'event');
    -- And Prayer, the skill it is said with, as every job teaches its own (`completeAction`).
    perform skill_raise(p_world, p_uid, praying_skill(), try_gain(true));

  elsif p_action = 'cast' then
    if cast_reason(p_world, p_uid, p_target->>'spell', target_item(p_target)) is not null then
      return;
    end if;
    perform journal_note(p_world, p_uid, 'cast:' || (p_target->>'spell'));
    perform tell(p_world, p_uid,
      do_cast(p_world, p_uid, p_target->>'spell', target_item(p_target)), 'event');

  elsif p_action = 'meditate' then
    -- Struck in the middle of it: said at the blow (`sitting_struck`), and nothing comes of it.
    if p.struck_at is not null and p.act_started is not null and p.struck_at >= p.act_started then return; end if;
    select * into sit from sitting_worth(p_world, p_uid);
    was := skill_of(p_world, p_uid, meditation_skill());
    -- And where it was sat, for the next sitting near it until the woods turn (`satHere`).
    update player set sat_at = now(),
           sat_spots = sat_spots_now(p) || jsonb_build_array(jsonb_build_array(floor(p.x)::int, floor(p.y)::int)),
           sat_dawn = tree_last_dawn()
      where world_id = p_world and uid = p_uid;
    perform journal_note(p_world, p_uid, 'sat');
    perform skill_raise(p_world, p_uid, meditation_skill(), sit.gain);
    med := skill_of(p_world, p_uid, meditation_skill());
    -- The Calm it banks, up to what this much meditation holds.
    cap := player_calm_cap(p_world, p_uid);
    update player set calm = least(cap, coalesce(calm, 0) + sit.calm)
      where world_id = p_world and uid = p_uid returning calm into got;
    perform tell(p_world, p_uid, sit.said || ' Calm ' || floor(got) || ' of ' || floor(cap) || '.', 'event');
    -- And the trees round you, once a day of the island's clock, for Love's Bloom (`bloomSitting`).
    v_bloom := path_bloom(p_world, p_uid);
    if v_bloom > 0 then
      perform tell(p_world, p_uid, 'The trees round you grow while you sit: ' || v_bloom || ' of them, a stage each.', 'event');
    end if;
    if p.way is null and med >= choose_at() and was < choose_at() then
      perform tell(p_world, p_uid, 'Something settles. Three ways of looking at all this have '
        || 'become clear, and you may walk exactly one of them. Choose from the rug.', 'system');
    end if;
    if p.way is not null and path_moved(p.way) then
      -- A moved path's tiers, as they open (`tierSaid`).
      for r in select t.tier, d.name as path_name from path_tier t, path_def d
        where d.id = p.way and was < t.at and med >= t.at order by t.tier
      loop
        perform journal_note(p_world, p_uid, 'path');
        perform tell(p_world, p_uid, r.path_name || ': tier ' || r.tier || ' is open. Take one of '
          || listed_or((select array_agg(k.name order by k.num) from path_pick k where k.path = p.way and k.tier = r.tier))
          || ' in the Faith window.', 'system');
      end loop;
    elsif p.way is not null then
      for r in select s.*, d.name as path_name from path_step s join path_def d on d.id = s.path
        where s.path = p.way and was < s.at and med >= s.at order by s.n
      loop
        perform tell(p_world, p_uid, r.path_name || ': ' || r.name || '. ' || r.note, 'system');
      end loop;
    end if;

  elsif p_action = 'choose_path' then
    v_way := p_target->>'material';
    if p.way is not null or not exists (select 1 from path_def where id = v_way) then return; end if;
    update player set way = v_way where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You take the path of '
      || (select name from path_def where id = v_way) || '. '
      || (select note from path_def where id = v_way), 'system');

  elsif p_action = 'use_ability' then
    v_step := ability_of(p_world, p_uid, p_target->>'material');
    if v_step.path is null then return; end if;
    update player set used_at = jsonb_set(used_at, array[v_step.ability], to_jsonb(now()))
      where world_id = p_world and uid = p_uid;
    perform skill_raise(p_world, p_uid, meditation_skill(), technique_gain());
    perform tell(p_world, p_uid, work_ability(p_world, p_uid, v_step.ability), 'event');
  end if;
end $function$;



create or replace function sitting_worth(p_world uuid, p_uid uuid)
  returns table (gain double precision, calm double precision, place double precision, said text) language plpgsql stable as $$
declare p player; tx int; ty int; v_deed boolean; v_swirl boolean; v_stale boolean; v_stone boolean; r record;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  tx := floor(p.x)::int; ty := floor(p.y)::int;
  v_deed := exists (select 1 from deed d where d.world_id = p_world
    and abs(tx - d.x) <= d.radius and abs(ty - d.y) <= d.radius);
  v_swirl := exists (select 1 from mote_swirl m where m.world_id = p_world
    and sqrt(((m.x - tx) ^ 2 + (m.y - ty) ^ 2)::double precision) <= sit_swirl_reach());
  v_stale := exists (select 1 from jsonb_array_elements(sat_spots_now(p)) e
    where sqrt((((e->>0)::int - tx) ^ 2 + ((e->>1)::int - ty) ^ 2)::double precision) <= sit_stale_reach());
  -- A Runestone within reach (`runestoneWithin`).
  v_stone := runestone_within((select w.size from world w where w.id = p_world), tx, ty, sit_stone_reach()) is not null;
  select * into r from sit_place(v_deed, centre_height(p_world, tx, ty), has_water(p_world, tx, ty), v_swirl, v_stale, v_stone);
  place := r.place;
  said := r.said;
  gain := sit_gain() * r.place;
  -- And more banked for a Stillwater worn (`sittingWorth`).
  calm := sit_calm() * r.place * (1 + worn_enchant(p_world, p_uid, 'calm'));
  return next;
end $$;



select private.lock_doors();
