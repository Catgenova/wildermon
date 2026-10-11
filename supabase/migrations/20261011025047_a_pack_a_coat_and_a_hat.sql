-- Enchanting part 3b: Packmule, Seal's Coat and Hawk's Eye.
--
-- Packmule (2 earth, a backpack or a satchel): each pack carried with it adds
-- QL/10 kilos to what you carry before the weight tells (carry_limit). Seal's
-- Coat (2 water, what is worn on the chest): swimming costs QL/5 % less
-- stamina (body_settle); the speed it also gives is the browser's, which is
-- where a swimmer's pace is kept, held to a walk. Hawk's Eye (2 wind, what is
-- worn on the head): sight QL/10 % further, which is the browser's own reckoning
-- too. The rows and words are the defs'; a Packmule's figure is said in kilos
-- (enchant_kilo, enchant_figure).
--
-- Rewritten from their newest definitions:
--   enchant_says  20261011011941_six_more_for_a_melee_weapon.sql
--   carry_limit   20261010072602_love_and_power_move_onto_tiers.sql
--   body_settle   20261011023945_six_for_the_jewel_slot.sql

/** An enchantment's figure as Examine says it: kilos for Packmule, to the tenth, and a share for the rest (`enchantFigure`). */
create or replace function enchant_figure(p_id text, p_v double precision) returns text language sql immutable as $fn$
  select case when enchant_kilo((select e.effect from enchantments() e where e.id = p_id))
              then trim_scale(round(p_v::numeric, 1))::text || ' kg' else enchant_pct(p_v) end
$fn$;

/** Examine's line for what a thing holds, or nothing (`enchantSays`): its line with its figure at its quality. */
create or replace function enchant_says(p jsonb) returns text language sql immutable as $fn$
  select coalesce((select ' ' || e.name || ' at QL ' || enchant_ql_word(z.q) || ': '
                          || replace(enchant_line(e.id), '{v}', enchant_figure(e.id, enchant_hit_chance(e.id, z.q)))
                     from enchantments() e, (select (p->>'ql')::double precision as q) z where e.id = p->>'id'), '')
$fn$;

CREATE OR REPLACE FUNCTION public.carry_limit(p_world uuid, p_uid uuid)
 RETURNS double precision
 LANGUAGE sql
 STABLE
AS $function$
  select carry_base() + skill_of(p_world, p_uid, 'body_strength') * carry_per_strength()
       -- And a Terraformer's Strong Back.
       + pk(p_world, p_uid, 'carry', 0)
       -- And Power's Pack Mule.
       + path_fx(p_world, p_uid, 'mule', 0)
       -- And a Packmule on each pack carried (`carryLimit`): a pack in a pack is held by that pack, not the body.
       + coalesce((select sum(enchant_of(i, 'mule')) from item i
                    where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid), 0)
$function$;

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
    -- And less for a Seal's Coat worn (`swimWind`).
    cost := swim_wind() * greatest(0.4, 1 - skill_of(p_world, p_uid, 'swimming') / 200) * path_fx(p_world, p_uid, 'swim', 1)
          * (1 - worn_enchant(p_world, p_uid, 'swim'));
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



select private.lock_doors();
