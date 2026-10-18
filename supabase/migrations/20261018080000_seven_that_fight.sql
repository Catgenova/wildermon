-- Seven that fight.
--
-- Asked for, off a list of combat wildermon: a testa draws what is after you
-- onto itself, a skulka strikes harder at what is fighting something else, a
-- gasha bleeds what it bites, a thumpa stuns, a spitta leaves venom, an awla
-- goes through a hide, and a sparra may be sparred with. How each fights is
-- its species' `style`, which comes in with the definitions; this is what a
-- style does, the same as the browser's (`Creatures.attack`, `styleBlow`,
-- and `attack_creature` in `creatureActions.ts` for a spar). Only one of
-- yours fights by its style: a wild one fights as any other does.

-- What the definitions bring in, ahead of them, for what is written here to be read against: the column a species'
-- style is kept in, and the two numbers a spar is held to (`SPAR_YIELD`, `SPAR_SLACK`), which the definitions that
-- come in after this write again from the browser's.
alter table species_def add column if not exists style text;
create or replace function spar_yield() returns double precision language sql immutable as $fn$ select 0.5::double precision $fn$;
create or replace function spar_slack() returns double precision language sql immutable as $fn$ select 0.5::double precision $fn$;

-- How much harder a blow of one of yours lands for how it fights: a borer on a hide (`bodkin_hide`), a flanker on one
-- whose mind is on a fight with something other than it (`blindside`).
create or replace function style_dealt(a creature, t creature) returns double precision language sql stable as $fn$
  select coalesce((
    select case when a.mode = 'wild' or t.id is null then 1
                when s.style = 'bore' and (select sd.hide from species_def sd where sd.id = t.species) is not null then bodkin_hide()
                when s.style = 'flank' and case when t.brawl is not null then t.brawl <> a.id
                                                else t.hunting is not null or (t.enemy is not null and t.enemy <> a.id) end
                  then blindside()
                else 1 end
      from species_def s where s.id = a.species), 1)::double precision
$fn$;

-- What a blow of one of yours does besides its damage, by how it fights (`styleBlow`).
create or replace function style_blow(p_world uuid, a creature, p_target int, p_dmg double precision) returns void language plpgsql as $fn$
declare v_style text; v_n int; r record;
begin
  select style into v_style from species_def where id = a.species;
  if a.mode = 'wild' or v_style is null then return; end if;
  if v_style = 'bleed' then
    -- As a knife opens it (`side_blow`).
    update creature set bleed_rate = greatest(coalesce(bleed_rate, 0), p_dmg * knife_bleed()),
        bleed_until = now() + make_interval(secs => knife_bleed_secs())
      where world_id = p_world and id = p_target and health > 0;
  elsif v_style = 'venom' then
    perform enchant_venom(p_world, p_target);
  elsif v_style = 'stun' then
    update creature set fight_blows = coalesce(fight_blows, 0) + 1 where world_id = p_world and id = a.id
      returning fight_blows into v_n;
    if v_n % heavy_every()::int = 0 then perform enchant_stun(p_world, p_target); end if;
  elsif v_style = 'shield' then
    -- Every wild thing near it that is after you or one of yours, onto it.
    for r in
      update creature o set brawl = a.id, threat_at = now(), windup_at = null
        from species_def sd
       where sd.id = o.species and not coalesce(sd.timid, false)
         and o.world_id = p_world and o.mode = 'wild' and o.health > 0 and o.brawl is distinct from a.id
         and (o.hunting is not null or o.brawl is not null
              or exists (select 1 from creature e where e.world_id = p_world and e.id = o.enemy and e.mode <> 'wild'))
         and sqrt((creature_x(o) - creature_x(a)) ^ 2 + (creature_y(o) - creature_y(a)) ^ 2) <= guard_range()
      returning lower(sd.name) as name
    loop
      if a.mode = 'active' and a.keeper is not null then
        perform tell(p_world, a.keeper, 'The ' || r.name || ' turns on ' || a.name || '.', 'fight');
      end if;
    end loop;
  end if;
end $fn$;

-- Whether it is a sparring partner of yours, out and about, and so may be attacked (`sparring`).
create or replace function spar_partner(c creature, p_uid uuid) returns boolean language sql stable as $fn$
  select c.mode not in ('wild', 'stored') and c.keeper = p_uid
     and coalesce((select style from species_def where id = c.species), '') = 'spar'
$fn$;

-- Whether a sparring partner has yielded, at this much health (`yielded`).
create or replace function spar_yielded(c creature, p_health double precision) returns boolean language sql stable as $fn$
  select p_health <= max_health(c) * spar_yield() + spar_slack()
$fn$;

-- What a blow that lands on a sparring partner says (`sparSaid`).
create or replace function spar_said(c creature, p_health double precision) returns text language sql stable as $fn$
  select 'You land one on ' || c.name || '. It is down to ' || greatest(0, ceil(p_health)) || ' of ' || max_health(c)
         || case when spar_yielded(c, p_health) then ', and yields' else '' end || '.'
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The target, for how it fights, and what its blow does besides.
    (1, 'creature_attack', $$  select * into d from species_def where id = a.species;$$,
                           $$  select * into d from species_def where id = a.species;
  select * into t from creature where world_id = p_world and id = p_target;$$, 1),
    (2, 'creature_attack', $$           * class_dull(p_world, p_attacker);$$,
                           $$           * class_dull(p_world, p_attacker)
           -- And harder for how it fights: a borer on a hide, a flanker on one whose mind is elsewhere (`style_dealt`).
           * style_dealt(a, t);$$, 1),
    (3, 'creature_attack', $$  v_died := wound_beast(p_world, p_target, v_dmg, creature_x(a), creature_y(a), null, p_attacker);$$,
                           $$  v_died := wound_beast(p_world, p_target, v_dmg, creature_x(a), creature_y(a), null, p_attacker);
  if not v_died then perform style_blow(p_world, a, p_target, v_dmg); end if;$$, 1),

    -- A sparring partner of yours may be attacked, until it has yielded.
    (4, 'fight_refusal', $$      if c.mode <> 'wild' then return 'That one is tame. Release it first if you mean it.'; end if;
      if dist > melee_reach(p_world, p_uid) then return 'It is out of reach.'; end if;$$,
                         $$      if c.mode <> 'wild' and not spar_partner(c, p_uid) then return 'That one is tame. Release it first if you mean it.'; end if;
      if c.mode <> 'wild' and spar_yielded(c, c.health) then return c.name || ' has yielded. Let it get its breath back first.'; end if;
      if dist > melee_reach(p_world, p_uid) then return 'It is out of reach.'; end if;$$, 1),

    -- And a spar: no lower than it yields at, and nothing else besides.
    (5, 'perform_fight', $$v_wind double precision;$$, $$v_wind double precision; v_spar boolean := false;$$, 1),
    (6, 'perform_fight', $$    w := swung_with(p_world, p_uid);$$,
                         $$    w := swung_with(p_world, p_uid);
    v_spar := c.mode <> 'wild';$$, 1),
    (7, 'perform_fight', $$             * class_dealt(p_world, p_uid, c);
      died := hurt_creature(p_world, c.id, dmg, p_uid);$$,
                         $$             * class_dealt(p_world, p_uid, c);
      if v_spar then
        dmg := least(dmg, greatest(0, c.health - max_health(c) * spar_yield()));
        update creature set health = health - dmg, hurt_at = now() where world_id = p_world and id = c.id;
        if held.id is not null then perform damage_item(held.id, 0.35 * pk(p_world, p_uid, 'worn:weapon', 1)); end if;
        perform tell(p_world, p_uid, spar_said(c, c.health - dmg), 'fight');
        return;
      end if;
      died := hurt_creature(p_world, c.id, dmg, p_uid);$$, 1),
    (8, 'perform_fight', $$    if not coalesce(died, false) then perform engage_beast(p_world, c.id, p_uid); end if;
    -- And a Pikeman's Keep Away$$,
                         $$    if v_spar then return; end if;
    if not coalesce(died, false) then perform engage_beast(p_world, c.id, p_uid); end if;
    -- And a Pikeman's Keep Away$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
