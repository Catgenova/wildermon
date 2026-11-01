/*
 * Dye recipes (`src/game/dyes.ts`): a dye written down, and boiled again.
 *
 * Asked: "Players need to be able to identify, make, and reproduce a color. Lets have it so players can right
 * click a dye Make A Recipe, using paper, that will provide an ingredient list per 5L lye to reproduce that
 * color, and then when using that formula produce x ql and not higher".
 *
 * The defs just before this crossed the two jobs (`dye_recipe_action`: Make a recipe, Boil from recipe), the
 * recipe and the sheet it is written on (`dye_recipe_item`, `dye_recipe_sheet`), the trade (`dye_skill`), the
 * dyestuff a recipe names for each primary (`dye_recipe_stuff`, the easiest of that primary to boil) and every
 * refusal (`dye_recipe_said`). What is here is the doing of it:
 *
 *   * Make a recipe, aimed at a bucket of dye in the pack or a barrel of dye beside you: the best sheet of
 *     papyrus in the pack (`chart_sheet_for`, as a map is copied onto) becomes a dye recipe whose `dye` is the
 *     dye's text with no litres, `r500y0b500q4000`, at the dye's QL. Nothing is taken out of the dye;
 *   * its name says the colour, as anything dyed is named, and the hex after it (`item_name`); Examine says the
 *     mix and, per bucket of lye, the kilos of each primary's dyestuff, its share of a whole boil's weight, and
 *     the QL it comes off at most (`dye_recipe_says`, through `dye_item_says`);
 *   * Boil from recipe, aimed at the recipe: one bucket of lye and each share of dyestuff out of the pack, under
 *     the same perks as a dyestuff's own boil (a Naturalist's Double Boil and Thrifty Dyer: `dye_share_grams`),
 *     rolled on alchemy against the hardest of their boils (`dye_recipe_hard`), and as that boil for what is surer
 *     on it (a Naturalist's Sure Boil: `dye_recipe_job`); the bucket comes off as
 *     `dye_boil_litres()` of exactly the recipe's parts, at `product_ql` of alchemy and never above the
 *     recipe's QL. A boil that fails loses what went into it and gives the bucket back, as `perform_craft`
 *     does for a dyestuff's. The recipe is kept.
 *
 * Dispatched with the last jobs (`last_action`, `last_refusal`, `perform_last`), as a skep's are.
 *
 * `supabase/test/dyerecipes.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';

/* ---- the arithmetic ------------------------------------------------------------------------------------ */

/**
 * Grams of a primary's dyestuff a boil from a recipe takes for `p_parts` of it, under a body's perks (`shareGrams`,
 * `sharesFor`); with no body, what the recipe is written down as.
 */
create or replace function dye_share_grams(p_world uuid, p_uid uuid, p_primary text, p_parts int) returns int
language sql stable as $fn$
  select ceil((dye_boil_litres() * 1000 * p_parts / dye_parts() / pk(p_world, p_uid, 'litres:dye', dye_litres_per_kg()))
              * pk(p_world, p_uid, 'need:' || coalesce((select ds.recipe from dyestuff_def ds where ds.item = dye_recipe_stuff(p_primary)), ''), 1)
              - 1e-6)::int
$fn$;

/** Each primary in the mix, in order: its dyestuff, the grams and the fewest whole items over them (`recipeShares`). */
create or replace function dye_recipe_shares(p_world uuid, p_uid uuid, d dye_mix)
returns table (o int, colour text, item text, grams int, n int) language sql stable as $fn$
  select v.o, v.p, dye_recipe_stuff(v.p), g.grams, (g.grams + dye_grams_of(dye_recipe_stuff(v.p)) - 1) / dye_grams_of(dye_recipe_stuff(v.p))
  from (values (1, 'red', d.red), (2, 'yellow', d.yellow), (3, 'blue', d.blue)) v(o, p, parts)
  cross join lateral (select dye_share_grams(p_world, p_uid, v.p, v.parts) as grams) g
  where v.parts > 0
$fn$;

/** How hard a boil from a recipe is: the hardest boil of the dyestuffs it takes (`recipeDifficulty`). */
create or replace function dye_recipe_hard(d dye_mix) returns double precision language sql stable as $fn$
  select coalesce(max(r.difficulty), 0)::double precision
  from dye_recipe_shares(null, null, d) s
  join dyestuff_def ds on ds.item = s.item
  join recipe r on r.id = ds.recipe
$fn$;

/** And the dyestuff's boil it is rolled as, the hardest and the first on a tie, for the perks on that boil (`recipeBoilOf`). */
create or replace function dye_recipe_job(d dye_mix) returns text language sql stable as $fn$
  select coalesce((select ds.recipe
    from dye_recipe_shares(null, null, d) s
    join dyestuff_def ds on ds.item = s.item
    join recipe r on r.id = ds.recipe
    order by coalesce(r.difficulty, 0) desc, s.o limit 1), dye_recipe_boil())
$fn$;

/** The shares, said: "2.5 kg of raspberries (25), 2.5 kg of blueberries (25)" (`shareSaid`). */
create or replace function dye_recipe_shares_said(p_world uuid, p_uid uuid, d dye_mix) returns text language sql stable as $fn$
  select string_agg(dye_kg_said(s.grams) || ' kg of ' || lower((select x.name from item_def x where x.id = s.item)) || ' (' || s.n || ')', ', ' order by s.o)
  from dye_recipe_shares(p_world, p_uid, d) s
$fn$;

/* ---- the words ------------------------------------------------------------------------------------------- */

/** What Examine adds of a recipe (`recipeSays`). */
create or replace function dye_recipe_says(d dye_mix) returns text language sql stable as $fn$
  select ' Recipe: ' || colour_word(dye_hex(d)) || ', ' || dye_hex(d) || ': ' || dye_shares_said(d)
      || '. Per ' || dye_boil_litres()::int || ' L of lye: ' || dye_recipe_shares_said(null, null, d)
      || '. Output: ' || dye_boil_litres()::int || ' L, QL at most ' || dye_ql_said(d.ql) || '.'
$fn$;

/** Why `p_have` of a dyestuff is short of `p_grams` of it for a boil, or null (`weightRefusal`). */
create or replace function dye_weight_refusal(p_item text, p_grams int, p_have int) returns text language sql stable as $fn$
  select case when p_have * dye_grams_of(p_item) >= p_grams then null
              else 'Need ' || dye_kg_said(p_grams) || ' kg of ' || lower((select d.name from item_def d where d.id = p_item))
                   || ' per ' || dye_boil_litres()::int || ' litres of lye; have ' || dye_kg_said(p_have * dye_grams_of(p_item)) || ' kg.' end
$fn$;

/** What writing one says (`recipeWrittenSaid`). */
create or replace function dye_recipe_written_said(d dye_mix) returns text language sql stable as $fn$
  select 'Recipe written: ' || colour_word(dye_hex(d)) || ', ' || dye_hex(d) || ' at QL ' || dye_ql_said(d.ql) || ': ' || dye_shares_said(d) || '.'
$fn$;

/* ---- the two jobs -------------------------------------------------------------------------------------------- */

/** The thing in the pack a job is aimed at: loose in it, as the browser's `inventory.get` finds it. */
create or replace function dye_recipe_held(p_world uuid, p_uid uuid, p_target jsonb) returns item language sql stable as $fn$
  select i.* from item i
   where i.world_id = p_world and i.id = target_item(p_target) and i.holder = 'player' and i.holder_uid = p_uid
$fn$;

/** The recipe a job is aimed at, or null for anything that is not one with a dye on it (`recipeOf`). */
create or replace function dye_recipe_of(it item) returns dye_mix language sql stable as $fn$
  select case when it.def = dye_recipe_item() then dye_read(it.dye) end
$fn$;

/** Why a recipe job will not go, or null: the browser's `makeRecipeRefusal` and `boilRecipeRefusal`, question for question. */
create or replace function dye_recipe_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare it item; pc placed; d dye_mix; s record;
begin
  if p_action = dye_recipe_make() then
    if p_target->>'kind' = 'furniture' then
      select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint and kind = 'furniture';
      if not found then return dye_recipe_said('gone'); end if;
      if not near_piece(p_world, p_uid, pc) then return dye_recipe_said('far'); end if;
      if pc.liquid is distinct from 'dye' or dye_read(pc.dye) is null then return dye_recipe_said('noDye'); end if;
    else
      it := dye_recipe_held(p_world, p_uid, p_target);
      if it.id is null then return dye_recipe_said('gone'); end if;
      if dye_in(it) is null then return dye_recipe_said('noDye'); end if;
    end if;
    if (chart_sheet_for(p_world, p_uid)).id is null then return dye_recipe_said('noSheet'); end if;
    return null;
  end if;
  it := dye_recipe_held(p_world, p_uid, p_target);
  if it.id is null then return dye_recipe_said('gone'); end if;
  d := dye_recipe_of(it);
  if d is null then return dye_recipe_said('blank'); end if;
  if pack_count(p_world, p_uid, dye_boil_in()) < 1 then return dye_recipe_said('noLye'); end if;
  for s in select * from dye_recipe_shares(p_world, p_uid, d) order by o loop
    if dye_weight_refusal(s.item, s.grams, pack_count(p_world, p_uid, s.item)) is not null then
      return dye_weight_refusal(s.item, s.grams, pack_count(p_world, p_uid, s.item));
    end if;
  end loop;
  return null;
end $fn$;

/** What a boil from a recipe takes: each share of dyestuff and one bucket of lye, out of the pack. */
create or replace function dye_recipe_spend(p_world uuid, p_uid uuid, d dye_mix) returns void language plpgsql as $fn$
declare s record;
begin
  for s in select * from dye_recipe_shares(p_world, p_uid, d) order by o loop
    perform consume(p_world, p_uid, s.item, s.n);
  end loop;
  perform consume(p_world, p_uid, dye_boil_in(), 1);
end $fn$;

create or replace function perform_dye_recipe(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare it item; pc placed; d dye_mix; v_sheet item; v_id bigint; v_s double precision; v_ql double precision; v_said text;
begin
  if dye_recipe_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;

  if p_action = dye_recipe_make() then
    if p_target->>'kind' = 'furniture' then
      select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
      d := dye_read(pc.dye);
    else
      d := dye_in(dye_recipe_held(p_world, p_uid, p_target));
    end if;
    v_sheet := chart_sheet_for(p_world, p_uid);
    perform chart_take_sheet(v_sheet.id);
    v_id := give(p_world, p_uid, dye_recipe_item(), 1, d.ql);
    update item set dye = dye_text(d) where id = v_id;
    perform tell(p_world, p_uid, dye_recipe_written_said(d), 'event');
    return;
  end if;

  -- Boil from recipe.
  d := dye_recipe_of(dye_recipe_held(p_world, p_uid, p_target));
  v_s := skill_of(p_world, p_uid, dye_skill());
  -- What a boil takes, said before it is taken: by the perks, not by what is left.
  v_said := 'Boiled from recipe: ' || dye_recipe_shares_said(p_world, p_uid, d) || ', in ' || dye_boil_litres()::int || ' litres of lye.';
  -- A boil that does not come off loses what went into it, and the bucket is tipped out and kept (`perform_craft`).
  if not perk_pass(skill_check(v_s, dye_recipe_hard(d), 0), pk(p_world, p_uid, 'fail:' || dye_recipe_job(d), 1)) then
    perform dye_recipe_spend(p_world, p_uid, d);
    perform give(p_world, p_uid, 'bucket', 1, 20);
    perform skill_raise(p_world, p_uid, dye_skill(), try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, dye_recipe_said('failed'), 'event');
    return;
  end if;
  -- What the boil rolls, as a dyestuff's does, and never above the recipe's.
  v_ql := least(100, product_ql(v_s, 0) * class_mul(p_world, p_uid, 'fine', dye_skill()));
  v_ql := least(v_ql, d.ql);
  d := row(d.red, d.yellow, d.blue, dye_ql(v_ql), null)::dye_mix;
  perform dye_recipe_spend(p_world, p_uid, d);
  v_id := give(p_world, p_uid, 'dye_bucket', 1, v_ql);
  update item set count = 1, dye = dye_text(d, dye_boil_litres()::int) where id = v_id;
  perform journal_made(p_world, p_uid, 'dye_bucket', v_ql, 1, null);
  perform skill_raise(p_world, p_uid, dye_skill(), 1);
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, craft_head()));
  perform tell(p_world, p_uid, v_said || ' Made: ' || dye_says(d, dye_boil_litres()), 'event');
end $fn$;

/* ---- wired in --------------------------------------------------------------------------------------------- */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- With the last jobs.
    ('last_action', $$      or bee_action(p_action)$$, $$      or bee_action(p_action)
      -- A dye written down, and boiled again (`dyes.ts`).
      or dye_recipe_action(p_action)$$),
    ('last_refusal', $$  if bee_action(p_action) then
    return skep_refusal(p_world, p_uid, p_action, p_target);
  end if;$$, $$  if bee_action(p_action) then
    return skep_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A dye written down, and boiled again (`dyes.ts`).
  if dye_recipe_action(p_action) then
    return dye_recipe_refusal(p_world, p_uid, p_action, p_target);
  end if;$$),
    ('perform_last', $$  if bee_action(p_action) then
    perform perform_skep(p_world, p_uid, p_action, p_target);
    return;
  end if;$$, $$  if bee_action(p_action) then
    perform perform_skep(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- A dye written down, and boiled again (`dyes.ts`).
  if dye_recipe_action(p_action) then
    perform perform_dye_recipe(p_world, p_uid, p_action, p_target);
    return;
  end if;$$),
    -- Examine on a recipe says what it records and boils into (`recipeSays`).
    ('dye_item_says', $$then ' Holds: ' || dye_says(dye_in(it), (dye_in(it)).litres)$$,
                      $$then ' Holds: ' || dye_says(dye_in(it), (dye_in(it)).litres)
              when dye_recipe_of(it) is not null then dye_recipe_says(dye_recipe_of(it))$$),
    -- And its name, the hex of the dye it records after it: a Purple dye recipe (#660066).
    ('item_name', $$              when it.def = 'ancient_stamp' then ' (' || greatest(0, coalesce(it.charges, stamp_goes()::int)) || ' goes)'$$,
                  $$              when it.def = 'ancient_stamp' then ' (' || greatest(0, coalesce(it.charges, stamp_goes()::int)) || ' goes)'
              when dye_recipe_of(it) is not null then ' (' || dye_hex(dye_recipe_of(it)) || ')'$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the lines to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
