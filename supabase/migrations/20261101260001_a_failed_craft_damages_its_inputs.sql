-- A failed craft damages its inputs, by their QL, instead of keeping them all or destroying them all.
--
-- Asked: "Implement that failing a craft damages all ingredients, more damage at 1ql and very little at 99ql, but
-- crafts like smelters dont automatically destroy it all". Every unit a failed go would have spent, off the stacks it
-- would have spent them from and in that order, takes `fail_damage` of its own QL: `fail_damage_at_low()` at
-- `fail_damage_ql_low()` and below, `fail_damage_at_high()` at `fail_damage_ql_high()` and above, a straight line
-- between, to the whole point (the constants come with the definitions, 20261101260000_defs.sql). A pile's damage is
-- by the unit (`stack_key` leaves damage out, as `sameStack` does), so the units used are damaged where they lie: the
-- pile's damage goes up by that over its count. Units taken to `damage_max()` are gone. A litre input loses that share
-- of the litres it would have taken, the vessel left as it is. Nothing is used up, so nothing is handed back.
--
-- On the bench (`perform_craft`): the recipes that kept everything now damage, and the ones that lost everything
-- (smelting, alloys, cooking, kilns and the rest) damage too. A Mason's or a Tailor's Nothing Wasted spares the damage
-- on the recipes it always covered; an Artisan's Keep the Stone spares the gem. A scroll keeps its own rule.
-- At the anvil (`perform_forge`): a failed piece damages its casting (a Smith's Second Heat spares it), and a failed
-- strike its lump, which is spent only on a strike that comes off. A failed brew (`perform_last`) damages what would
-- have gone in and loses the barrel that share of its water. A failed boil from a dye recipe (`perform_dye_recipe`)
-- damages its dyestuffs and its lye.
--
-- `recipe.consume_on_fail` had one reader, the bench's failure, and has none now; it goes. The browser's flag is
-- `spareOnFail`, which only chooses the recipes Nothing Wasted covers, and is written into the perks, not the recipe.

set local lock_timeout = '3s';

/* The damage a failed go puts on one unit of an input of this QL, a whole number (`failDamage`). */
create or replace function fail_damage(p_ql double precision) returns double precision language sql immutable as $fn$
  select floor(fail_damage_at_low()
    + (fail_damage_at_high() - fail_damage_at_low())
      * (least(fail_damage_ql_high(), greatest(fail_damage_ql_low(), p_ql)) - fail_damage_ql_low())
      / (fail_damage_ql_high() - fail_damage_ql_low())
    + 0.5)
$fn$;

/* One stack's part of a failed go: "log ×1, +38 damage", "log ×1, destroyed" (`failPartSaid`). */
create or replace function fail_part_said(p_def text, p_n int, p_dmg double precision, p_gone boolean)
returns text language sql stable as $fn$
  select lower(coalesce((select d.name from item_def d where d.id = p_def), p_def)) || ' ×' || p_n || ', '
    || case when p_gone then 'destroyed' else '+' || p_dmg::int || ' damage' end
$fn$;

/* A litre input's part: "water 2 L, 1 L lost" (`failLitresSaid`). */
create or replace function fail_litres_said(p_liquid text, p_need double precision, p_lost double precision)
returns text language sql immutable as $fn$
  select p_liquid || ' ' || trim_scale(p_need::numeric) || ' L, ' || trim_scale(p_lost::numeric) || ' L lost'
$fn$;

/* The litres of `p_need` a failed go loses out of one source of this QL, to the whole litre (`failLitresOf`). */
create or replace function fail_litres_of(p_need double precision, p_ql double precision)
returns double precision language sql immutable as $fn$
  select floor(p_need * fail_damage(p_ql) / damage_max() + 0.5)
$fn$;

/* What a failed go says: its head, and what was damaged (`failDamagedSaid`). */
create or replace function fail_damaged_said(p_head text, p_parts text[]) returns text language sql immutable as $fn$
  select case when coalesce(array_length(p_parts, 1), 0) > 0
              then p_head || ' Inputs damaged: ' || array_to_string(p_parts, '; ') || '.'
              else p_head end
$fn$;

/*
 * A failed go's damage on `p_n` units of one item row: by its QL, the pile's
 * damage up by that over its count, or the units gone where that takes them to
 * `damage_max()`. What it did, in words, or nothing when there is nothing there.
 */
create or replace function fail_damage_item(p_id bigint, p_n int) returns text[] language plpgsql as $fn$
declare it item; v_take int; v_d double precision;
begin
  select * into it from item where id = p_id for update;
  if not found or p_n <= 0 or it.count < 1 then return '{}'; end if;
  v_take := least(p_n, it.count);
  v_d := fail_damage(it.ql);
  if it.dmg + v_d >= damage_max() then
    if v_take >= it.count then delete from item where id = it.id;
    else update item set count = count - v_take where id = it.id; end if;
    return array[fail_part_said(it.def, v_take, v_d, true)];
  end if;
  update item set dmg = dmg + v_d * v_take / count where id = it.id;
  return array[fail_part_said(it.def, v_take, v_d, false)];
end $fn$;

/*
 * `craft_consume`'s draw, damaging instead of spending: the same stacks, in the
 * same order, the clicked one first (`damageDrawn` over `drawFor`).
 */
create or replace function craft_fail_damage(p_world uuid, p_uid uuid, p_item text, p_n integer,
                                             p_prefer bigint default null, p_mat text default null)
returns text[] language plpgsql as $fn$
declare left_to_take int := p_n; r record; have int; take int; only_mat boolean; v_said text[] := '{}';
begin
  perform 1 from item i where i.id in (select s.id from craft_stock(p_world, p_uid, p_prefer) s where s.def = p_item)
   order by i.id for update;
  only_mat := p_mat is not null and craft_count(p_world, p_uid, p_item, p_mat, p_prefer) >= p_n;
  if craft_count(p_world, p_uid, p_item, case when only_mat then p_mat end, p_prefer) < p_n then return '{}'; end if;
  if not only_mat and exists (select 1 from metal_def m where m.lump = p_item) then
    perform break_bars(p_world, p_uid, p_item, p_n - craft_count_loose(p_world, p_uid, p_item, null, p_prefer), p_prefer);
  end if;
  for r in
    select s.id from craft_stock(p_world, p_uid, p_prefer) s
     where s.def = p_item and (not only_mat or s.extra is not distinct from p_mat) and whole_item(s.id)
     order by (s.id = p_prefer) desc, s.draw
  loop
    exit when left_to_take <= 0;
    select i.count into have from item i where i.id = r.id;
    continue when not found or have < 1;
    take := least(left_to_take, have);
    v_said := v_said || fail_damage_item(r.id, take);
    left_to_take := left_to_take - take;
  end loop;
  return v_said;
end $fn$;

/* `consume`'s draw out of the pack, damaging instead of spending (the browser's `inventory.consume` order). */
create or replace function pack_fail_damage(p_world uuid, p_uid uuid, p_item text, p_n integer)
returns text[] language plpgsql as $fn$
declare left_to_take int := p_n; r record; take int; v_said text[] := '{}';
begin
  if pack_count(p_world, p_uid, p_item, null) < p_n then return '{}'; end if;
  for r in
    select i.id, i.count from item i
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = p_item and not i.locked
     order by i.id
     for update
  loop
    exit when left_to_take <= 0;
    take := least(left_to_take, r.count);
    v_said := v_said || fail_damage_item(r.id, take);
    left_to_take := left_to_take - take;
  end loop;
  return v_said;
end $fn$;

/*
 * A failed go's loss on a litre input: of each source's share of `p_need`, in
 * `litre_sources`' order, `fail_damage` of what is in it as a share of
 * `damage_max()`, added up and rounded to the whole litre, and that taken as a
 * go takes it (`failLitres`). Nothing when there is not `p_need` at hand.
 */
create or replace function craft_fail_litres(p_world uuid, p_uid uuid, p_vessel text, p_need integer)
returns text[] language plpgsql as $fn$
declare r record; v_left double precision := p_need; m double precision; v_ql double precision;
        v_sum double precision := 0; v_lost double precision;
begin
  if p_need <= 0 or litres_at_hand(p_world, p_uid, p_vessel, true) < p_need then return '{}'; end if;
  for r in select * from litre_sources(p_world, p_uid, p_vessel, true) s order by s.ord loop
    exit when v_left <= 0;
    m := least(v_left, r.litres);
    continue when m <= 0;
    if r.kind = 'item' then select i.ql into v_ql from item i where i.id = r.id;
    else select brew_ql(p, extract(epoch from now())::double precision) into v_ql from placed p where p.id = r.id; end if;
    v_sum := v_sum + (m * fail_damage(v_ql)) / damage_max();
    v_left := v_left - m;
  end loop;
  v_lost := floor(v_sum + 0.5);
  perform take_litres(p_world, p_uid, p_vessel, v_lost);
  return array[fail_litres_said((select l.name from vessel_def v join liquid_def l on l.id = v.liquid where v.item = p_vessel),
                                p_need, v_lost)];
end $fn$;

/* A failed boil from a dye recipe's damage: `dye_recipe_spend`'s draw, damaging instead of spending. */
create or replace function dye_recipe_fail_damage(p_world uuid, p_uid uuid, d dye_mix) returns text[] language plpgsql as $fn$
declare s record; v_said text[] := '{}';
begin
  for s in select * from dye_recipe_shares(p_world, p_uid, d) order by o loop
    v_said := v_said || pack_fail_damage(p_world, p_uid, s.item, s.n);
  end loop;
  return v_said || pack_fail_damage(p_world, p_uid, dye_boil_in(), 1);
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The bench: a failed go damages what it would have used.
    ('public', 'perform_craft',
     $$v_harm text; v_used int[];$$,
     $$v_harm text; v_used int[]; v_hurt text[] := '{}';$$),
    ('public', 'perform_craft',
     $$    -- And a Mason's Nothing Wasted keeps what went into a failed smelter or kiln.
    spared := r.consume_on_fail and random() < pk(p_world, p_uid, 'spare:' || p_recipe, 0);
    -- And the stone out of it whole, whatever else is lost, for an Artisan's Keep the Stone.
    v_stone := r.consume_on_fail and not spared and pk(p_world, p_uid, 'stone:' || p_recipe, 0) > 0
               and exists (select 1 from recipe_input where recipe = p_recipe and item = 'gem');
    if r.consume_on_fail and not spared then
      for i in select * from recipe_input where recipe = p_recipe order by ord loop
        continue when v_stone and i.item = 'gem';
        if i.litres is not null then perform take_litres(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.litres));
        else perform craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat); end if;
      end loop;
      -- The batch is wasted, not the vessel: you tip the ruin out and keep the
      -- bucket. Salvage if the recipe names any, otherwise whatever it returns.
      for i in
        select g.item, g.count from recipe_gives g
        where g.recipe = p_recipe
          and g.kind = (case when exists (select 1 from recipe_gives where recipe = p_recipe and kind = 'salvage')
                             then 'salvage' else 'return' end)
      loop
        perform give(p_world, p_uid, i.item, i.count, 20);
      end loop;
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
    end if;
    perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, case when v_stone
      then 'Failed: focus. Silver lost; gem kept.'
      else coalesce(r.fail, 'Failed: ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.') end,
      'event');
    if spared then perform tell(p_world, p_uid, 'Nothing Wasted: inputs kept.', 'event'); end if;$$,
     $$    -- Nothing used up: what it would have used is damaged by its own QL, off the stacks it would have
    -- spent and in that order (`craft_fail_damage`, `craft_fail_litres`), and nothing handed back --
    -- but not, now and then, for a perk on the recipe (a Mason's or a Tailor's Nothing Wasted).
    if pk(p_world, p_uid, 'spare:' || p_recipe, 0) > 0 then
      spared := random() < pk(p_world, p_uid, 'spare:' || p_recipe, 0);
    end if;
    -- And the stone spared, whatever else is damaged, for an Artisan's Keep the Stone.
    v_stone := not spared and pk(p_world, p_uid, 'stone:' || p_recipe, 0) > 0
               and exists (select 1 from recipe_input where recipe = p_recipe and item = 'gem');
    if not spared then
      for i in select * from recipe_input where recipe = p_recipe order by ord loop
        continue when v_stone and i.item = 'gem';
        if i.litres is not null then
          v_hurt := v_hurt || craft_fail_litres(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.litres));
        else
          v_hurt := v_hurt || craft_fail_damage(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat);
        end if;
      end loop;
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
    end if;
    perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, fail_damaged_said(
      coalesce(r.fail, 'Failed: ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.'), v_hurt),
      'event');
    if spared then perform tell(p_world, p_uid, 'Nothing Wasted: inputs undamaged.', 'event'); end if;
    if v_stone then perform tell(p_world, p_uid, 'Keep the Stone: gem undamaged.', 'event'); end if;$$),
    -- The anvil: a strike spends its lump only when it comes off; a failed one damages it.
    ('public', 'perform_forge',
     $$    if v_lump.id is null or not spend_stack(p_world, p_uid, v_lump.id, 1) then return; end if;$$,
     $$    if v_lump.id is null or v_lump.count < 1 or not at_hand(p_world, p_uid, v_lump.id) then return; end if;$$),
    ('public', 'perform_forge',
     $$      perform tell(p_world, p_uid, 'Failed: coins, ' || case when v_struck then 'gold too poor for the die'
                                        else 'skill check' end || '. Lump lost.'
        || case when v_broke then ' Coin die worn out.' else '' end, 'event');
      return;
    end if;$$,
     $$      perform tell(p_world, p_uid, fail_damaged_said('Failed: coins, ' || case when v_struck then 'gold too poor for the die'
                                        else 'skill check' end || '.', fail_damage_item(v_lump.id, 1))
        || case when v_broke then ' Coin die worn out.' else '' end, 'event');
      return;
    end if;
    if not spend_stack(p_world, p_uid, v_lump.id, 1) then return; end if;$$),
    -- And a failed piece damages its casting, but not for a Smith's Second Heat.
    ('public', 'perform_forge',
     $$    if not v_kept and not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;
    perform skill_raise(p_world, p_uid, d.skill, try_gain(false, smith_gain()));
    perform tell(p_world, p_uid, 'Failed: '
      || lower((select name from item_def where id = d.makes)) || '. '
      || case when v_kept then 'Second Heat: casting kept.' else 'Casting lost.' end, 'event');$$,
     $$    perform skill_raise(p_world, p_uid, d.skill, try_gain(false, smith_gain()));
    perform tell(p_world, p_uid, case when v_kept
      then 'Failed: ' || lower((select name from item_def where id = d.makes)) || '. Second Heat: casting undamaged.'
      else fail_damaged_said('Failed: ' || lower((select name from item_def where id = d.makes)) || '.',
                             fail_damage_item(v_cast.id, 1)) end, 'event');$$),
    -- A brew: what would have gone in damaged, and the barrel that share of its water lost.
    ('public', 'perform_last',
     $$    if not craft_consume(p_world, p_uid, bd.input, bd.count) then return; end if;
    if not skill_check(skill_of(p_world, p_uid, 'brewing'), bd.difficulty, 0) then
      update placed set litres = greatest(0, placed_litres(pc) - bd.litres), since = now()
        where id = pc.id;
      update placed set liquid = null where id = pc.id and litres <= 0;
      update placed set knack = null where id = pc.id;
      perform skill_raise(p_world, p_uid, 'brewing', try_gain(false, brew_gain()));
      perform tell(p_world, p_uid, 'Brew failed: '
        || lower(placed_name(pc)) || ' emptied.', 'event');
      return;
    end if;$$,
     $$    if not skill_check(skill_of(p_world, p_uid, 'brewing'), bd.difficulty, 0) then
      v_parts := craft_fail_damage(p_world, p_uid, bd.input, bd.count)
        || fail_litres_said((select l.name from liquid_def l where l.id = 'water'), bd.litres,
                            least(placed_litres(pc), fail_litres_of(bd.litres, pc.ql)));
      update placed set litres = placed_litres(pc) - least(placed_litres(pc), fail_litres_of(bd.litres, pc.ql)), since = now()
        where id = pc.id;
      update placed set liquid = null where id = pc.id and litres <= 0;
      perform skill_raise(p_world, p_uid, 'brewing', try_gain(false, brew_gain()));
      perform tell(p_world, p_uid, fail_damaged_said('Failed: ' || lower(bd.name) || '.', v_parts), 'event');
      return;
    end if;
    if not craft_consume(p_world, p_uid, bd.input, bd.count) then return; end if;$$),
    -- A boil from a dye recipe: its dyestuffs and its lye damaged, and no bucket handed back.
    ('public', 'perform_dye_recipe',
     $$  -- A boil that does not come off loses what went into it, and the bucket is tipped out and kept (`perform_craft`).
  if not perk_pass(skill_check(v_s, dye_recipe_hard(d), 0), pk(p_world, p_uid, 'fail:' || dye_recipe_job(d), 1)) then
    perform dye_recipe_spend(p_world, p_uid, d);
    perform give(p_world, p_uid, 'bucket', 1, 20);
    perform skill_raise(p_world, p_uid, dye_skill(), try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, dye_recipe_said('failed'), 'event');$$,
     $$  -- A boil that does not come off uses nothing up: its dyestuffs and its lye are damaged by their QL (`perform_craft`).
  if not perk_pass(skill_check(v_s, dye_recipe_hard(d), 0), pk(p_world, p_uid, 'fail:' || dye_recipe_job(d), 1)) then
    perform skill_raise(p_world, p_uid, dye_skill(), try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, fail_damaged_said(dye_recipe_said('failed'), dye_recipe_fail_damage(p_world, p_uid, d)), 'event');$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- Nothing reads it now: a failed go is the same on every recipe.
alter table recipe drop column if exists consume_on_fail;
-- And nothing is handed back on a fail.
delete from recipe_gives where kind = 'salvage';

select private.lock_doors();
