-- Abilities on a cooldown.
--
-- Asked for, off a list of combat wildermon each with an ability it uses on a
-- cooldown: seventeen kinds that each use a fighting trade's spell -- at its
-- numbers and its rest, read off `class_spell` -- or a frost breath, instead
-- of a blow, wherever one of yours fights. Which is a species' `ability`,
-- which comes in with the definitions; this is what each does, the same as the
-- browser's (`Creatures.ability`, `pounce`). A wild one of these kinds fights
-- as any other does. When one is ready again is a mark on it, as a Binder's
-- marks are (`class_mark`, kind 'ability').

-- What the definitions bring in, ahead of them, for what is written here to be read against: the column a species'
-- ability is kept in, and the two numbers of its own a wildermon's ability has (`FROST_BREATH_REST`, `WARD_SKIN`),
-- which the definitions that come in after this write again from the browser's.
set local lock_timeout = '3s';
alter table species_def add column if not exists ability text;
create or replace function frost_breath_rest() returns double precision language sql immutable as $fn$ select 15::double precision $fn$;
create or replace function ward_skin() returns double precision language sql immutable as $fn$ select 0.1::double precision $fn$;

-- A mark on a creature while it holds, or `p_none` once it has run out (`markOn`).
create or replace function beast_mark(p_world uuid, p_id int, p_kind text, p_none double precision default 1)
returns double precision language sql stable as $fn$
  select coalesce((select m.val from class_mark m
                    where m.world_id = p_world and m.creature_id = p_id and m.kind = p_kind and m.until > now()), p_none)
$fn$;

-- Seconds between goes at an ability, and its name: its spell's, or a frost breath's (`abilityRest`, `abilityName`).
create or replace function ability_rest(p_id text) returns double precision language sql stable as $fn$
  select case when p_id = 'frost_breath' then frost_breath_rest() else (select s.rest from class_spell s where s.id = p_id) end
$fn$;
create or replace function ability_name(p_id text) returns text language sql stable as $fn$
  select case when p_id = 'frost_breath' then 'Frost Breath' else (select s.name from class_spell s where s.id = p_id) end
$fn$;

-- What a creature takes of a blow besides its blood and its herd: more while it is brittle and while a Binder holds it,
-- and less inside a stone skin (`markOn`'s 'brittle' and 'stone').
create or replace function class_brittle(p_world uuid, p_id integer) returns double precision language sql stable as $fn$
  select coalesce((select m.val from class_mark m
                    where m.world_id = p_world and m.creature_id = p_id and m.kind = 'brittle' and m.until > now()), 1)
       * coalesce((select m.val from class_mark m
                    where m.world_id = p_world and m.creature_id = p_id and m.kind = 'hold' and m.until > now()), 1)
       * coalesce((select m.val from class_mark m
                    where m.world_id = p_world and m.creature_id = p_id and m.kind = 'stone' and m.until > now()), 1)
$fn$;

/*
 * One of yours uses its ability on what it is fighting, when it is ready and there is a use for it (`ability`): true
 * or false for whether that blow killed it, when the ability was its blow; null when it strikes as well, or did
 * nothing. Then not again for its rest.
 */
create or replace function beast_ability(p_world uuid, a creature, p_target int) returns boolean language plpgsql as $fn$
declare v_ab text; t creature; td species_def; b jsonb; r record; v_n int := 0; v_g int; v_was double precision;
        v_spent boolean := true; v_died boolean := false; v_top double precision;
begin
  select ability into v_ab from species_def where id = a.species;
  if v_ab is null or a.mode = 'wild' or v_ab = 'beastmaster_pounce' then return null; end if;
  if beast_mark(p_world, a.id, 'ability', 0) > 0 then return null; end if;
  select * into t from creature where world_id = p_world and id = p_target and health > 0;
  if t.id is null then return null; end if;
  select * into td from species_def where id = t.species;

  case v_ab
  when 'blade_hamstring' then
    b := class_beast_blow(p_world, a.id, t.id, spell_fx(v_ab, 'more'));
    if not (b->>'died')::boolean then
      update creature set slow = spell_fx(v_ab, 'pace'), slow_until = now() + make_interval(secs => spell_fx(v_ab, 'secs'))
       where world_id = p_world and id = t.id;
    end if;
  when 'berserker_skull_crack' then
    b := class_beast_blow(p_world, a.id, t.id, spell_fx(v_ab, 'more'));
    if not (b->>'died')::boolean then
      perform class_hold(p_world, t.id, spell_fx(v_ab, 'hold') * case when coalesce(td.monster, false) then spell_fx(v_ab, 'monster') else 1 end);
    end if;
  when 'blade_shield_bash' then
    b := class_beast_blow(p_world, a.id, t.id, spell_fx(v_ab, 'more'));
    if not (b->>'died')::boolean then
      update creature set windup_at = null, until = greatest(until, now()) + make_interval(secs => spell_fx(v_ab, 'back'))
       where world_id = p_world and id = t.id;
    end if;
  when 'berserker_execute' then
    if t.health >= max_health(t) * spell_fx(v_ab, 'low') then return null; end if;
    b := class_beast_blow(p_world, a.id, t.id, spell_fx(v_ab, 'more'));
  when 'berserker_whirlwind' then
    for r in select cr.id from creature cr
              where cr.world_id = p_world and cr.mode = 'wild' and cr.health > 0
                and (creature_x(cr) - creature_x(a)) ^ 2 + (creature_y(cr) - creature_y(a)) ^ 2 <= spell_fx(v_ab, 'reach') ^ 2
              order by cr.id loop
      for v_g in 1 .. spell_fx(v_ab, 'blows')::int loop
        b := class_beast_blow(p_world, a.id, r.id, spell_fx(v_ab, 'more'));
        if (b->>'died')::boolean then
          if r.id = t.id then v_died := true; end if;
          exit;
        end if;
      end loop;
    end loop;
    b := jsonb_build_object('died', v_died);
  when 'kindler_scorch' then
    b := class_beast_blow(p_world, a.id, t.id, spell_fx(v_ab, 'fire'));
    if not (b->>'died')::boolean then
      -- As a burn of yours runs (`class_burn`), at the spell's own numbers.
      v_was := max_health(t) * spell_fx(v_ab, 'each');
      update creature set bleed_rate = case when bleed_until > now() then greatest(coalesce(bleed_rate, 0), v_was) else v_was end,
          bleed_until = greatest(coalesce(bleed_until, now()), now() + make_interval(secs => spell_fx(v_ab, 'secs')))
       where world_id = p_world and id = t.id;
      insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
        values (p_world, t.id, 'burn', v_was, now() + make_interval(secs => spell_fx(v_ab, 'secs')), a.keeper)
        on conflict (world_id, creature_id, kind) do update
          set val = case when class_mark.until > now() then greatest(class_mark.val, excluded.val) else excluded.val end,
              until = greatest(class_mark.until, excluded.until), by_uid = excluded.by_uid;
    end if;
  when 'frost_breath' then
    b := class_beast_blow(p_world, a.id, t.id, 1);
    if not (b->>'died')::boolean then perform enchant_frost(p_world, t.id); end if;
  when 'binder_root' then
    if beast_mark(p_world, t.id, 'root', 0) > 0 then return null; end if;
    perform class_leash(p_world, t.id, 'root', 0, spell_fx(v_ab, 'secs'), a.keeper);
  when 'binder_dull_claws' then
    if beast_mark(p_world, t.id, 'dull') < 1 then return null; end if;
    perform class_mark_put(p_world, t.id, 'dull', spell_fx(v_ab, 'dealt'), spell_fx(v_ab, 'secs'), a.keeper);
  when 'binder_brittle' then
    if beast_mark(p_world, t.id, 'brittle') > 1 then return null; end if;
    perform class_mark_put(p_world, t.id, 'brittle', spell_fx(v_ab, 'taken'), spell_fx(v_ab, 'secs'), a.keeper);
  when 'skirmisher_marked_for_death' then
    if beast_mark(p_world, t.id, 'marked') > 1 then return null; end if;
    perform class_mark_put(p_world, t.id, 'marked', spell_fx(v_ab, 'crit'), spell_fx(v_ab, 'secs'), a.keeper);
  when 'pikeman_keep_away' then
    perform class_mark_put(p_world, a.id, 'keep_away', spell_fx(v_ab, 'push'), spell_fx(v_ab, 'secs'), a.keeper);
    v_spent := false;
  when 'warder_stoneskin' then
    perform class_mark_put(p_world, a.id, 'stone', 1 - spell_fx(v_ab, 'cut'), spell_fx(v_ab, 'secs'), a.keeper);
    v_spent := false;
  when 'blade_guardians_call' then
    for r in
      update creature o set brawl = a.id, windup_at = null,
          -- Held on it for the whole of the call, as the spell holds them on you.
          threat_at = now() + make_interval(secs => spell_fx(v_ab, 'secs') - threat_hold())
        from species_def sd
       where sd.id = o.species and not coalesce(sd.timid, false)
         and o.world_id = p_world and o.mode = 'wild' and o.health > 0 and o.brawl is distinct from a.id
         and (o.hunting is not null or o.brawl is not null
              or exists (select 1 from creature e where e.world_id = p_world and e.id = o.enemy and e.mode <> 'wild'))
         and (creature_x(o) - creature_x(a)) ^ 2 + (creature_y(o) - creature_y(a)) ^ 2 <= spell_fx(v_ab, 'reach') ^ 2
      returning o.id
    loop
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then return null; end if;
    v_spent := false;
  when 'warder_ward' then
    if a.mode <> 'active' or a.keeper is null then return null; end if;
    select coalesce((stats->>'aegis')::double precision, 0) into v_was from player where world_id = p_world and uid = a.keeper;
    if v_was is null or warder_skin_after(p_world, a.keeper, a.keeper, ward_skin()) <= v_was then return null; end if;
    perform warder_skin_put(p_world, a.keeper, a.keeper, ward_skin());
    v_spent := false;
  when 'chirurgeon_leech' then
    v_was := t.health;
    v_top := max_health(t);
    b := class_beast_blow(p_world, a.id, t.id, spell_fx(v_ab, 'more'));
    update creature set health = least(max_health(a), health + least((b->>'dmg')::double precision, v_was) / v_top * max_health(a))
     where world_id = p_world and id = a.id;
  else
    return null;
  end case;

  insert into class_mark (world_id, creature_id, kind, val, until)
    values (p_world, a.id, 'ability', 1, now() + make_interval(secs => ability_rest(v_ab)))
    on conflict (world_id, creature_id, kind) do update set val = 1, until = excluded.until;
  if a.mode = 'active' and a.keeper is not null then
    perform tell(p_world, a.keeper, a.name || ' uses ' || ability_name(v_ab) || '.', 'fight');
  end if;
  if not v_spent then return null; end if;
  return coalesce((b->>'died')::boolean, false);
end $fn$;

/*
 * A pounce, on the way to what it is going for (`pounce`): within the spell's reach of it and nothing in between, it
 * leaps to half its own reach short of it and strikes, and puts its next blow back. True when it did.
 */
create or replace function beast_pounce(p_world uuid, c creature, q creature, p_dist double precision) returns boolean
language plpgsql as $fn$
declare v_ab text := 'beastmaster_pounce'; v_x double precision; v_y double precision; b jsonb;
begin
  if c.mode = 'wild' or (select ability from species_def where id = c.species) is distinct from v_ab then return false; end if;
  if beast_mark(p_world, c.id, 'ability', 0) > 0 or p_dist > spell_fx(v_ab, 'reach') then return false; end if;
  if not line_clear(p_world, c.to_x, c.to_y, creature_x(q), creature_y(q)) then return false; end if;
  v_x := creature_x(q) - (creature_x(q) - c.to_x) / greatest(p_dist, 0.001) * companion_reach() / 2;
  v_y := creature_y(q) - (creature_y(q) - c.to_y) / greatest(p_dist, 0.001) * companion_reach() / 2;
  if not creature_tile_ok(p_world, floor(v_x)::int, floor(v_y)::int) then v_x := creature_x(q); v_y := creature_y(q); end if;
  update creature set from_x = v_x, from_y = v_y, to_x = v_x, to_y = v_y, leg_at = now(), leg_ends = now(), until = now(),
      phase = 'idle', enemy = q.id, heel_until = null
    where world_id = p_world and id = c.id;
  b := class_beast_blow(p_world, c.id, q.id, spell_fx(v_ab, 'more'));
  if not (b->>'died')::boolean then
    update creature set windup_at = null, until = greatest(until, now()) + make_interval(secs => spell_fx(v_ab, 'back'))
     where world_id = p_world and id = q.id;
  end if;
  insert into class_mark (world_id, creature_id, kind, val, until)
    values (p_world, c.id, 'ability', 1, now() + make_interval(secs => ability_rest(v_ab)))
    on conflict (world_id, creature_id, kind) do update set val = 1, until = excluded.until;
  if c.mode = 'active' and c.keeper is not null then
    perform tell(p_world, c.keeper, c.name || ' uses ' || ability_name(v_ab) || '.', 'fight');
  end if;
  return true;
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Its ability instead of a blow, when it is ready; and a keep-away's push after one.
    (1, 'creature_attack', $$v_guard uuid; v_died boolean;$$, $$v_guard uuid; v_died boolean; v_used boolean;$$, 1),
    (2, 'creature_attack', $$  select * into d from species_def where id = a.species;
  select * into t from creature where world_id = p_world and id = p_target;$$,
                           $$  select * into d from species_def where id = a.species;
  select * into t from creature where world_id = p_world and id = p_target;
  if a.mode <> 'wild' and d.ability is not null then
    v_used := beast_ability(p_world, a, p_target);
    if v_used is not null then return v_used; end if;
  end if;$$, 1),
    (3, 'creature_attack', $$  if not v_died then perform style_blow(p_world, a, p_target, v_dmg); end if;$$,
                           $$  if not v_died then perform style_blow(p_world, a, p_target, v_dmg); end if;
  -- Pushed off while a keep-away holds on what struck it (`pikeman_keep_away`).
  if not v_died and beast_mark(p_world, a.id, 'keep_away', 0) > 0 then
    perform class_shove(p_world, p_target, creature_x(a), creature_y(a), beast_mark(p_world, a.id, 'keep_away', 0));
  end if;$$, 1),

    -- A pounce on the way to it.
    (4, 'companion_settle', $$    else
      -- A leg that ends well inside its reach$$,
                            $$    elsif beast_pounce(p_world, c, q, dist) then
      select * into c from creature where world_id = p_world and id = p_id;
      done := done + 1;
      c.until := now() + make_interval(secs => companion_blow() / (beast_mul(c, 'haste') * companion_quick(c)));
      c.leg_at := now(); c.leg_ends := now();
    else
      -- A leg that ends well inside its reach$$, 1),

    -- A blow from what it is already on keeps it there at least as long as it was held already (a howla's call).
    (5, 'beast_threat', $$    update creature set threat_at = now() where world_id = p_world and id = p_id;$$,
                        $$    update creature set threat_at = greatest(threat_at, now()) where world_id = p_world and id = p_id;$$, 1)
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
