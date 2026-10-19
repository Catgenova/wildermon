-- What goes into a craft rare puts its share of the units on the chance of what comes out rare.
--
-- Asked for: "When crafting, if an ingredient used to craft is rare+, the chance that the outcome is rare+ is increased
-- by the percentage of total ingredients that rare ingredient represents. E.g. a craft with two ingredients, one of
-- which is supreme, has a +50% chance to be supreme."
--
-- The units a go uses up are counted by their rarity (`craft_units_held`, before the go and after it, the difference
-- being what `craft_consume` took): by the unit, so that four rare planks of eight are half of it, and only what is
-- used up. The tool, the station and a bucket of water or lye -- which is the bucket's rarity, and comes back -- are
-- not ingredients and are not counted on either side of the share.
--
-- Each step's share of them goes onto the chance of coming out at exactly that step, rolled from the top step down
-- with one die, the first that comes up winning, and no step's chance more than the steps above it left of a
-- certainty (`rarity_bands`). A step's own odds stay under the share, the first step's bettered by a perk as ever
-- (a Carpenter's Master Joiner): two units, one of them supreme, come out supreme half the time and the thousandth
-- part they always did. With nothing rare in it the roll is the one it always was, `perk_rare` or `rarity_roll`, dice
-- and all (`rarity_roll_from`).
--
-- On the bench (`perform_craft`) and at the anvil, where the one casting a piece is beaten from or the one lump a
-- strike of coins takes is the whole of what goes in (`perform_forge`). A go with rare ingredients says what they put
-- on the chance, whether or not it came up (`rare_input_said`). The browser's `rarityBands`, `rollRarityFrom` and
-- `rareInputSaid`, word for word.
--
-- Not on what is gathered, fished, dug, felled or harvested, which has no ingredients; nor on a bauble restored, which
-- is the one thing made whole and not made out of anything; nor on improving, which lifts the thing itself a step
-- (`rarity_lift`); nor on a wall or anything built in place, which never comes out rare.

set local lock_timeout = '3s';

-- A tally of units by step, ordinary at nought: `[0:3]`, so that a step is its own subscript, as `rarityTally` has it.
create or replace function rarity_tally() returns int[] language sql stable as $fn$
  select array_fill(0, array[(select coalesce(max(d.ord), 0) + 1 from rarity_def d)], array[0])
$fn$;

-- One unit of a thing of this rarity, and nothing else: what goes into a piece at the anvil.
create or replace function rarity_one(p_rare text) returns int[] language plpgsql stable as $fn$
declare v int[] := rarity_tally();
begin
  v[rarity_step(p_rare)] := 1;
  return v;
end $fn$;

-- What is at hand of the things a recipe uses up, by rarity, as a craft would reach for it (`craft_stock`); a full
-- bucket is not counted, as it is not an ingredient. Asked before a go spends and after, and the difference is what
-- it spent (`rarity_tally_less`).
create or replace function craft_units_held(p_world uuid, p_uid uuid, p_recipe text, p_prefer bigint) returns int[]
language plpgsql stable as $fn$
declare v int[] := rarity_tally(); r record;
begin
  for r in
    select rarity_step(it.rare) as step, sum(st.count)::int as n
      from craft_stock(p_world, p_uid, p_prefer) st join item it on it.id = st.id
     where st.def in (select ri.item from recipe_input ri
                       where ri.recipe = p_recipe and not exists (select 1 from vessel_def v where v.item = ri.item))
     group by 1
  loop
    v[r.step] := r.n;
  end loop;
  return v;
end $fn$;

create or replace function rarity_tally_less(p_was int[], p_now int[]) returns int[] language plpgsql immutable as $fn$
declare v int[] := p_was; i int;
begin
  for i in array_lower(p_was, 1) .. array_upper(p_was, 1) loop
    v[i] := greatest(0, coalesce(p_was[i], 0) - coalesce(p_now[i], 0));
  end loop;
  return v;
end $fn$;

-- The chance of being at least this rare at all, with the first step's chance `p_first`: `rarity_chance`, and the
-- browser's `rarityChance(step, first)`, multiplied out in the same order.
create or replace function rarity_at_least(p_step int, p_first double precision) returns double precision
language plpgsql stable as $fn$
declare v_p double precision := 1; d rarity_def;
begin
  if p_step < 1 or p_step > (select max(ord) from rarity_def) then return 0; end if;
  for d in select * from rarity_def where ord <= p_step order by ord loop
    v_p := v_p * case when d.ord = 1 then p_first else d.odds end;
  end loop;
  return v_p;
end $fn$;

-- The chance of each step, ordinary at nought, for a thing made out of `p_units`: each step's own odds and its
-- share of the units, from the top down, none more than what the steps above it left. The browser's `rarityBands`.
create or replace function rarity_bands(p_units int[], p_first double precision default null) returns double precision[]
language plpgsql stable as $fn$
declare v_first double precision := coalesce(p_first, (select d.odds from rarity_def d order by d.ord limit 1));
        v_top int := (select max(ord) from rarity_def);
        v double precision[] := array_fill(0::double precision, array[(select max(ord) + 1 from rarity_def)], array[0]);
        v_total int := 0; v_above double precision := 0; v_share double precision; s int;
begin
  for s in array_lower(p_units, 1) .. array_upper(p_units, 1) loop
    v_total := v_total + greatest(0, coalesce(p_units[s], 0));
  end loop;
  for s in reverse v_top .. 1 loop
    v_share := case when v_total > 0 then greatest(0, coalesce(p_units[s], 0))::double precision / v_total else 0 end;
    v[s] := greatest(0, least(1 - v_above, rarity_at_least(s, v_first) - rarity_at_least(s + 1, v_first) + v_share));
    v_above := v_above + v[s];
  end loop;
  v[0] := greatest(0, 1 - v_above);
  return v;
end $fn$;

-- The rarity of a thing made out of `p_units`, at a first step of `p_first` (null for the plain odds): with nothing
-- rare in it, the very roll it always was; with something, one die against `rarity_bands` from the top step down.
create or replace function rarity_roll_from(p_units int[], p_first double precision) returns text language plpgsql as $fn$
declare v_bands double precision[]; v_roll double precision; v_below double precision := 0; d rarity_def;
begin
  if not exists (select 1 from generate_subscripts(p_units, 1) s where s > 0 and p_units[s] > 0) then
    return case when p_first is null then rarity_roll() else perk_rare(p_first) end;
  end if;
  v_bands := rarity_bands(p_units, p_first);
  v_roll := random();
  for d in select * from rarity_def order by ord desc loop
    v_below := v_below + v_bands[d.ord];
    if v_roll < v_below then return d.id; end if;
  end loop;
  return null;
end $fn$;

-- What a go says of the rare things that went into it, or null when there were none. The browser's `rareInputSaid`.
create or replace function rare_input_said(p_units int[]) returns text language sql stable as $fn$
  select 'Rare ingredients: '
         || string_agg('+' || round(p_units[d.ord] * 100.0 / t.total)::int || '% chance of ' || d.id
                       || ' (' || p_units[d.ord] || ' of ' || t.total || ' units used)', ', ' order by d.ord desc)
         || '.'
    from rarity_def d,
         (select sum(greatest(0, coalesce(u, 0)))::int as total from unnest(p_units) u) t
   where coalesce(p_units[d.ord], 0) > 0
$fn$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    (1, 'perform_craft', array[
      $$        v_scroll boolean; v_sheet double precision; v_harm text;
$$,
      $$  v_kept := v_lye > 0 and random() < v_lye;
  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    continue when v_kept and exists (select 1 from vessel_def v where v.item = i.item);
    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;
  end loop;
$$,
      $$  rare := perk_rare(pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1)));
$$,
      $$  perform journal_made(p_world, p_uid, r.result, made_ql, v_n, rare);
  if rare is not null then
$$], array[
      $$        v_scroll boolean; v_sheet double precision; v_harm text; v_used int[];
$$,
      $$  v_kept := v_lye > 0 and random() < v_lye;
  -- The units used up, by their rarity, for what rare ones put on the chance of a rare one (`rarity_bands`):
  -- what was at hand before the go less what is after it.
  v_used := craft_units_held(p_world, p_uid, p_recipe, prefer);
  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    continue when v_kept and exists (select 1 from vessel_def v where v.item = i.item);
    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;
  end loop;
  v_used := rarity_tally_less(v_used, craft_units_held(p_world, p_uid, p_recipe, prefer));
$$,
      $$  -- And by the rare things that went into it, each step by its share of the units used (`rarity_roll_from`).
  rare := rarity_roll_from(v_used, pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1)));
$$,
      $$  perform journal_made(p_world, p_uid, r.result, made_ql, v_n, rare);
  -- What the rare ingredients put on the chance, said whether or not it came up.
  if rare_input_said(v_used) is not null then perform tell(p_world, p_uid, rare_input_said(v_used), 'event'); end if;
  if rare is not null then
$$], array[1, 1, 1, 1]),
    (2, 'perform_forge', array[
      $$    v_rare := rarity_roll();
$$,
      $$  v_rare := perk_rare(pk(p_world, p_uid, 'rare:smith', (select r.odds from rarity_def r order by r.ord limit 1)));
$$], array[
      $$    -- The one lump a strike uses is all that goes into it, so a rare lump is the whole of it (`rarity_roll_from`).
    v_rare := rarity_roll_from(rarity_one(v_lump.rare), null);
    if v_lump.rare is not null then perform tell(p_world, p_uid, rare_input_said(rarity_one(v_lump.rare)), 'event'); end if;
$$,
      $$  -- And for a rare casting, which is all that goes into it (`rarity_roll_from`).
  v_rare := rarity_roll_from(rarity_one(v_cast.rare), pk(p_world, p_uid, 'rare:smith', (select r.odds from rarity_def r order by r.ord limit 1)));
  if v_cast.rare is not null then perform tell(p_world, p_uid, rare_input_said(rarity_one(v_cast.rare)), 'event'); end if;
$$], array[1, 1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

select private.lock_doors();
