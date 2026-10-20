-- An old lamp restores into an ancient lamp, which rekindles a wildermon's lowest-tier trait.
--
-- Asked for: the "Old lamp", a relic restored from archaeology finds, becomes the Ancient lamp, and gets a wildermon
-- use: used on a wildermon of yours, from that wildermon's menu, it rerolls its lowest-tier trait, at that tier or
-- better and never worse, one time in twenty one tier higher; the lamp is used up.
--
-- An old lamp restores into an ancient lamp (`relic_def.result`, which the snapshot after this one gives the rulebook,
-- with the item); `old_lamp` is `ancient_lamp` now, so every lamp already held, kept, ordered or counted is carried
-- across here, in the same places the comb was (20261019180000).
--
-- Used from a wildermon's menu, on one of yours that is out of its crate and beside you (`artifact_refusal`, unchanged),
-- it is used up and (`perform_artifact`, the browser's `rekindle`):
--
--   * the slot it rekindles is its lowest-tier trait, one at random of those that share the lowest tier (`tier_odds.ord`);
--     one with fewer than `trait_slots()` traits has an empty slot, lower than any trait, which it fills as the lowest
--     tier there is;
--   * what comes in is at that tier, or one time in `lamp_tier_odds` the tier above; at the top tier there is nothing
--     above, and it is another of the top tier;
--   * it is a trait the creature does not carry by name, the one going out included (`lamp_trait`): fighting blood
--     `fight_share` of the time, a name it does not carry in that grade, and otherwise a plain trait of that tier, as
--     `roll_trait` keeps a creature's traits apart.
--
-- And it says which went, which came, at what tier and what that trait does (`lamp_says`).
--
-- `lamp_tier_odds` is the browser's `LAMP_TIER_ODDS`; it is made here as well as in the snapshot after this, so that
-- what is made below can name it and so that it is shut to players with everything else.

set local lock_timeout = '3s';

create or replace function lamp_tier_odds() returns double precision language sql immutable as $fn$ select 20::double precision $fn$;

-- A trait's figure as a card prints it, the browser's `pct`: `1.32` is "+32%", `0.8` is "−20%". `trait_effect.mul` is
-- a real, which puts 1.225 a hair over where the browser has it a hair under, so it is read back to the thousandth its
-- figures are kept to (`gradeMul`) first; and the browser rounds a half up, as `floor(x + 0.5)`, where `pct_say`'s
-- `round` takes a half to the even number, which would say +12% where a card says +13%.
create or replace function trait_pct(p_mul real) returns text language sql immutable as $fn$
  select case when n < 0 then '−' else '+' end || abs(n)::int || '%'
  from (select floor((round(p_mul::numeric, 3)::double precision - 1) * 100 + 0.5) as n) x
$fn$;

-- What one trait does, as a card says it: "+20% speed", or "+32% learning, +20% yield". The browser's `traitSays`.
create or replace function trait_says(p_id text) returns text language sql stable as $fn$
  select string_agg(trait_pct(e.mul) || ' ' || ch.label, ', ' order by ch.ord)
  from trait_effect e join channel_def ch on ch.id = e.channel
  where e.trait = p_id
$fn$;

-- A trait as an ancient lamp's line names it: "fleet, a rare trait (+20% speed)". The browser's `kindled`.
create or replace function lamp_kindled(p_id text) returns text language sql stable as $fn$
  select coalesce(d.name, p_id) || ', ' || article(coalesce(d.tier, 'common')) || ' ' || coalesce(d.tier, 'common') || ' trait'
      || coalesce(' (' || trait_says(p_id) || ')', '')
  from (select 1) one left join trait_def d on d.id = p_id
$fn$;

/*
 * A fresh trait of one tier that a set does not carry by name, as `roll_trait` keeps them: fighting blood
 * `fight_share` of the time, a name not in the set in that grade, and otherwise a plain trait of that tier; the other
 * where one has none left. Null with nothing of that tier left at all. The browser's `lampTrait`.
 */
create or replace function lamp_trait(p_tier text, p_taken text[]) returns text language plpgsql volatile as $fn$
declare v_families text[] := trait_families(p_taken); v_got text; v_fights boolean; v_plain boolean;
begin
  v_fights := exists (select 1 from trait_def d where d.family is not null and d.tier = p_tier and not (d.family = any(v_families)));
  v_plain := exists (select 1 from trait_def d where d.family is null and d.tier = p_tier and not (d.id = any(v_families)));
  if v_fights and (not v_plain or random() < fight_share()) then
    select d.id into v_got from trait_def d
     where d.family is not null and d.tier = p_tier and not (d.family = any(v_families))
     order by random() limit 1;
    return v_got;
  end if;
  select d.id into v_got from trait_def d
   where d.family is null and d.tier = p_tier and not (d.id = any(v_families))
   order by random() limit 1;
  return v_got;
end $fn$;

-- What an ancient lamp says it did, word for word as the browser's `lampSays`.
create or replace function lamp_says(p_creature text, p_lamp text, p_was text, p_from text, p_now text, p_up boolean)
  returns text language sql stable as $fn$
  select case when p_was is not null
      then 'You light the ' || p_lamp || ' over ' || p_creature || ': its ' || coalesce((select d.name from trait_def d where d.id = p_was), p_was)
        || ', ' || article(p_from) || ' ' || p_from || ' trait, goes out, and ' || lamp_kindled(p_now) || ' is kindled in its place'
      else 'You light the ' || p_lamp || ' over ' || p_creature || ': ' || lamp_kindled(p_now) || ' is kindled in an empty slot'
    end
    || case when p_up then ', a tier above ' || p_from else '' end
    || '. The lamp is used up'
    || case when not p_up and exists (select 1 from tier_odds t where t.ord > (select f.ord from tier_odds f where f.tier = p_from))
         then '; one time in ' || lamp_tier_odds()::int || ' it kindles one a tier above' else '' end
    || '.'
$fn$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- The lamp is an artifact, and the item it uses (the browser's `ARTIFACT_FOR`).
    (1, 'artifact_item', array[$$when 'use_ancient_file' then 'ancient_file'$$], array[$$when 'use_ancient_file' then 'ancient_file'
                       when 'use_ancient_lamp' then 'ancient_lamp'$$], array[1]),
    -- And what it does.
    (2, 'perform_artifact', array[$$v_points int; v_rare text;$$, $$
  else
    -- A stat not yet at the most it takes, any of them as likely as another.
$$], array[$$v_points int; v_rare text;
        v_traits text[]; v_slot int; v_was text; v_from text; v_tier text; v_now text; v_up boolean;$$, $$
  elsif p_action = 'use_ancient_lamp' then
    -- Its lowest-tier trait, one at random of those that share the lowest tier; an empty slot, lower than any trait,
    -- where it has fewer than `trait_slots`, filled as the lowest tier there is (the browser's `rekindle`).
    v_traits := coalesce(c.traits, '{}');
    if coalesce(array_length(v_traits, 1), 0) < trait_slots() then
      v_slot := coalesce(array_length(v_traits, 1), 0) + 1;
      v_was := null;
      v_from := (select t.tier from tier_odds t order by t.ord limit 1);
    else
      select u.i into v_slot from unnest(v_traits) with ordinality u(id, i)
        left join trait_def d on d.id = u.id left join tier_odds t on t.tier = d.tier
       order by coalesce(t.ord, 0), random() limit 1;
      v_was := v_traits[v_slot];
      v_from := coalesce((select d.tier from trait_def d where d.id = v_was), (select t.tier from tier_odds t order by t.ord limit 1));
    end if;
    -- At that tier, or one time in `lamp_tier_odds` the tier above, where there is one.
    v_tier := null;
    if random() < 1 / lamp_tier_odds() then
      select t.tier into v_tier from tier_odds t where t.ord > (select f.ord from tier_odds f where f.tier = v_from) order by t.ord limit 1;
    end if;
    v_up := v_tier is not null;
    v_tier := coalesce(v_tier, v_from);
    -- One it does not carry by name, the one going out included (`lamp_trait`).
    v_now := lamp_trait(v_tier, v_traits);
    if v_now is null then
      perform tell(p_world, p_uid, 'You light the ' || v_name || ' over ' || c.name || ', and nothing is kindled. The lamp is used up.', 'event');
    else
      v_traits[v_slot] := v_now;
      update creature set traits = v_traits where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, lamp_says(c.name, v_name, v_was, v_from, v_now, v_up), 'event');
    end if;

  else
    -- A stat not yet at the most it takes, any of them as likely as another.
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

-- An old lamp held, kept, put up for sale, bartered, ordered, stored, counted or carried is an ancient lamp.
update item set def = 'ancient_lamp' where def = 'old_lamp';
update away_tally set def = 'ancient_lamp' where def = 'old_lamp';
update barter_item set def = 'ancient_lamp' where def = 'old_lamp';
update buy_order set def = 'ancient_lamp' where def = 'old_lamp';
update sale set def = 'ancient_lamp' where def = 'old_lamp';
update deed_ledger set def = 'ancient_lamp' where def = 'old_lamp';
update deed_store_log set def = 'ancient_lamp' where def = 'old_lamp';
update deed_work set def = 'ancient_lamp' where def = 'old_lamp';
update player set ledger = (ledger - 'old_lamp') || jsonb_build_object('ancient_lamp', ledger -> 'old_lamp') where ledger ? 'old_lamp';
update creature set carrying = carrying || jsonb_build_object('def', 'ancient_lamp') where carrying->>'def' = 'old_lamp';

select private.lock_doors();
