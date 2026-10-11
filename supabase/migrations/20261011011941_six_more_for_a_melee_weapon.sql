/*
 * Enchanting, part 2a: six more for a melee weapon (`enchant.ts`,
 * `enchanting.ts`), and the table taught that an enchantment goes on a kind
 * of thing.
 *
 *   * Venomfang (two life motes): a hit puts venom in the creature QL/4
 *     percent of the time -- `venom_drain` of its full health a second for
 *     `venom_secs`, through its bleed, never the last of it (`enchant_venom`).
 *     A creature has no wounds to carry venom as a person does; its bleed is
 *     the one hurt that runs on in it.
 *   * Gale (two wind): a swing takes QL/10 percent less time (`act_base`).
 *   * Nightblade (two dark): QL/20 percentage points on the chance of a
 *     critical blow (`my_crit_chance`).
 *   * Sunstrike (two light): QL/4 percent more damage to a hostile monster
 *     (`class_dealt`).
 *   * Leeching (a life mote and a dark): QL/10 percent of what every hit deals
 *     comes back as health, at what a creature's blow of that size takes of
 *     yours (`blow_share`).
 *   * Tidecaller (two water): every hit puts the creature's next blow back by
 *     QL/5 percent of the time between its blows (`blow_every`). A creature
 *     has no stamina to drain; the time between its blows is what tires.
 *
 * The defs just before this crossed the rows, the motes each scroll is written
 * with (as recipe inputs), what each goes on (`enchant_on`, `enchant_fits`),
 * the refusal that names it (`enchant_wrong_kind`) and what Examine says each
 * does (`enchant_line`).
 *
 * Rewritten here, each from the newest migration that defines it:
 *   enchant_says, enchant_setting, enchant_hit -- 20261010230740_enchanting.sql
 *   act_base -- 20261007121144_the_archer.sql
 *   my_crit_chance, class_dealt -- 20261007125706_the_skirmisher.sql
 */

/** What an enchantment of this effect on this thing comes to, or nothing (`swingEnchant`). */
create or replace function enchant_of(it item, p_effect text) returns double precision language sql immutable as $fn$
  select coalesce((select greatest(0, least(ql_top(), (it.enchant->>'ql')::double precision)) * e.per_ql
                     from enchantments() e where e.id = it.enchant->>'id' and e.effect = p_effect), 0)
$fn$;

/** Examine's line for what a thing holds, or nothing (`enchantSays`): its line with its figure at its quality. */
create or replace function enchant_says(p jsonb) returns text language sql immutable as $fn$
  select coalesce((select ' ' || e.name || ' at QL ' || enchant_ql_word(z.q) || ': '
                          || replace(enchant_line(e.id), '{v}', enchant_pct(enchant_hit_chance(e.id, z.q)))
                     from enchantments() e, (select (p->>'ql')::double precision as q) z where e.id = p->>'id'), '')
$fn$;

/** Why this scroll will not go into this thing, or the three of them when it will (`enchantSetting`). */
create or replace function enchant_setting(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_scroll item, out o_item item, out o_id text)
  language plpgsql stable as $fn$
begin
  select * into o_scroll from item i where i.world_id = p_world and i.id = nullif(p_target->>'scroll', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  select e.id into o_id from enchantments() e where e.scroll = o_scroll.def;
  if p_target->>'kind' is distinct from 'item' or o_scroll.id is null or o_id is null then o_why := enchant_said('scroll'); return; end if;
  select * into o_item from item i where i.world_id = p_world and i.id = target_item(p_target)
    and i.holder = 'player' and i.holder_uid = p_uid;
  if o_item.id is null then o_why := enchant_said('weapon'); return; end if;
  -- Each goes on its own kind of thing, and the refusal names it.
  if not enchant_fits(enchant_on(o_id), o_item.def) then o_why := enchant_wrong_kind(o_id); return; end if;
  if o_item.dmg >= damage_max() then o_why := enchant_said('broken'); return; end if;
  if o_item.enchant is not null then
    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_item.enchant->>'id'), o_item.enchant->>'id')
      || ' at QL ' || enchant_ql_word((o_item.enchant->>'ql')::double precision) || '.';
    return;
  end if;
end $fn$;

/**
 * Venom in a creature (`venom`): a bleed of `venom_drain` of its full health a
 * second for `venom_secs`, the stronger of it and any bleed already running,
 * to the later end; a bleed never takes the last of it.
 */
create or replace function enchant_venom(p_world uuid, p_id integer) returns void language plpgsql as $fn$
declare c creature; v_rate double precision;
begin
  select * into c from creature where world_id = p_world and id = p_id and health > 0;
  if c.id is null then return; end if;
  v_rate := max_health(c) * venom_drain();
  update creature set bleed_rate = case when bleed_until > now() then greatest(coalesce(bleed_rate, 0), v_rate) else v_rate end,
      bleed_until = greatest(case when bleed_until > now() then bleed_until else now() end, now() + make_interval(secs => venom_secs()))
    where world_id = p_world and id = p_id;
end $fn$;

/**
 * What the enchantment on what struck a landed hit does (`enchantRoll`,
 * `enchantWorks`): a rolled one when its roll comes up -- a Kindler's burn, a
 * knife's bleed of the blow, a stun, venom -- and Leeching and Tidecaller
 * every time, with no roll; said in the fight log, all but those two.
 */
create or replace function enchant_hit(p_world uuid, p_uid uuid, p_id integer, p_held item, p_dmg double precision) returns void
  language plpgsql as $fn$
declare e record; c creature; sd species_def; v_ql double precision;
begin
  if p_held.id is null or p_held.enchant is null then return; end if;
  select * into e from enchantments() x where x.id = p_held.enchant->>'id';
  if e.id is null then return; end if;
  select * into c from creature where world_id = p_world and id = p_id;
  if c.id is null or c.health <= 0 then return; end if;
  v_ql := (p_held.enchant->>'ql')::double precision;
  if e.effect in ('burn', 'bleed', 'stun', 'venom') then
    if random() >= enchant_hit_chance(e.id, v_ql) then return; end if;
  elsif e.effect not in ('leech', 'drain') then
    return;
  end if;
  if e.effect = 'burn' then perform class_burn(p_world, p_uid, p_id, enchant_burn_each(), enchant_burn_secs());
  elsif e.effect = 'bleed' then perform side_blow(p_world, p_uid, p_id, 'knives', p_dmg);
  elsif e.effect = 'stun' then perform enchant_stun(p_world, p_id);
  elsif e.effect = 'venom' then perform enchant_venom(p_world, p_id);
  elsif e.effect = 'leech' then
    -- A share of what it dealt, at what a creature's blow of that size takes of you (`leechHeal`).
    update player set stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{health}',
        to_jsonb(least(1, coalesce((stats->>'health')::double precision, 1)
                          + greatest(0, p_dmg) * enchant_hit_chance(e.id, v_ql) * blow_share())))
     where world_id = p_world and uid = p_uid;
  elsif e.effect = 'drain' then
    -- Its next blow put back by a share of the time between its blows (`drainSecs`), as a spear's stagger puts it back.
    select * into sd from species_def where id = c.species;
    update creature set until = greatest(until, now()) + make_interval(secs => blow_every(sd) * enchant_hit_chance(e.id, v_ql))
     where world_id = p_world and id = p_id;
  end if;
  if enchant_hit_said(e.effect) is not null then
    perform tell(p_world, p_uid, 'Your ' || e.name || ' '
      || replace(enchant_hit_said(e.effect), '{t}', lower((select s.name from species_def s where s.id = c.species))), 'fight');
  end if;
end $fn$;

/* ---- act_base: from 20261007121144_the_archer.sql, the newest that defines it. A Gale's swing. ---- */

CREATE OR REPLACE FUNCTION public.act_base(p_world uuid, p_uid uuid, p_action text, p_base double precision)
 RETURNS double precision
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_wind double precision; v_swing double precision; v_two boolean := false;
begin
  if not is_fight(p_action) then return p_base; end if;
  select coalesce((pl.stats->>'stamina')::double precision, 1) into v_wind
    from player pl where pl.world_id = p_world and pl.uid = p_uid;
  if p_action = 'attack_creature' then
    select sw.swing, coalesce(sw.two_handed, false) into v_swing, v_two from swung_with(p_world, p_uid) sw;
  else
    select w.swing into v_swing from weapon_def w
      where w.id = (worn(p_world, p_uid, 'weapon')).def and w.ammo is not null;
  end if;
  -- Tired arms, and wounded ones (`arm_pace`).
  return coalesce(v_swing, p_base) * tired_pace(coalesce(v_wind, 1))
    -- Not while a Sworn Blade's Hold the Line holds; and quicker in a Berserker's Adrenaline,
    * (select case when (pl.blessings->'hold_line'->>'until')::timestamptz > now() then 1 else arm_pace(pl.wounds) end
            * case when (pl.blessings->'adrenaline'->>'until')::timestamptz > now()
                   then (pl.blessings->'adrenaline'->>'time')::double precision else 1 end
            -- and a draw quicker in an Archer's Deadeye,
            * case when p_action = 'shoot_creature' and (pl.blessings->'deadeye'->>'until')::timestamptz > now()
                   then (pl.blessings->'deadeye'->>'time')::double precision else 1 end
         from player pl where pl.world_id = p_world and pl.uid = p_uid)
    -- and with both hands on it for a Berserker's Wild Strength, as `fightBase` has it,
    * case when v_two then pk(p_world, p_uid, 'swing:two_handed', 1) else 1 end
    -- and a swing quicker for a Gale in what is swung (`swingEnchant`).
    * case when p_action = 'attack_creature' then 1 - enchant_of(swung_item(p_world, p_uid), 'swing') else 1 end;
end $function$;

/* ---- my_crit_chance: from 20261007125706_the_skirmisher.sql, the newest that defines it. A Nightblade's share. ---- */

create or replace function my_crit_chance(p_world uuid, p_uid uuid, w weapon_def)
  returns double precision language sql stable as $$
  select crit_chance(skill_of(p_world, p_uid, w.kind), w.id, w.kind)
       + case when w.id = 'fist' then 0 else pk(p_world, p_uid, 'crit:' || w.kind, 0) end
       -- And a Nightblade's share in what is swung, when it is what is asked about (`myCritChance`).
       + case when w.ammo is null and w.id = (swung_with(p_world, p_uid)).id
              then enchant_of(swung_item(p_world, p_uid), 'crit') else 0 end
$$;

/* ---- class_dealt: from 20261007125706_the_skirmisher.sql, the newest that defines it. A Sunstrike's share. ---- */

CREATE OR REPLACE FUNCTION public.class_dealt(p_world uuid, p_uid uuid, c creature)
 RETURNS double precision
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce((
    select case when (pl.blessings->'battle_rage'->>'until')::timestamptz > now()
                then (pl.blessings->'battle_rage'->>'dealt')::double precision else 1 end
         * case when c.health < max_health(c) * pk(pl.class_mul, 'finish:below', 0)
                then pk(pl.class_mul, 'finish:dmg', 1) else 1 end
         * case when coalesce((pl.stats->>'health')::double precision, 1) < pk(pl.class_mul, 'pain:deep', 0) then pk(pl.class_mul, 'pain:deeper', 1)
                when coalesce((pl.stats->>'health')::double precision, 1) < pk(pl.class_mul, 'pain:below', 0) then pk(pl.class_mul, 'pain:dmg', 1)
                else 1 end
         * case when coalesce(sd.monster, false) then pk(pl.class_mul, 'monster:dmg', 1) else 1 end
         * case when pk(pl.class_mul, 'gap:dmg', 1) <> 1 and g.d > beast_reach(sd) and g.d <= melee_reach(p_world, p_uid)
                then pk(pl.class_mul, 'gap:dmg', 1) else 1 end
         * coalesce((select cm.val from class_mark cm where cm.world_id = p_world and cm.creature_id = c.id
                       and cm.kind = 'exposed' and cm.until > now()), 1)
         -- And a Skirmisher's Opportunist on one fighting somebody else: another creature, or another person.
         * case when (pl.blessings->'opportunist'->>'until')::timestamptz > now()
                 and (c.enemy is not null or (c.hunting is not null and c.hunting <> p_uid))
                then (pl.blessings->'opportunist'->>'dealt')::double precision else 1 end
         -- And harder on a hostile monster for a Sunstrike in what is swung (`classDealt`).
         * case when coalesce(sd.monster, false) then 1 + enchant_of(swung_item(p_world, p_uid), 'smite') else 1 end
      from player pl
      join species_def sd on sd.id = c.species
      cross join lateral (select sqrt((creature_x(c) - pl.x) ^ 2 + (creature_y(c) - pl.y) ^ 2) as d) g
     where pl.world_id = p_world and pl.uid = p_uid), 1)
$function$;

notify pgrst, 'reload schema';
select private.lock_doors();
