/*
 * Obsidian gear and obsidian glass (`src/game/gear.ts` OBSIDIAN_PIECES, `src/game/recipes.ts` OBSIDIAN_ARMOUR and
 * KNAPPED, `src/game/materials.ts` OBSIDIAN, `src/game/building.ts` OBSIDIAN_GLASS).
 *
 * The definitions carried all of it: the obsidian item, the five pieces and their class (`armour_class_def`,
 * `armour_def`, `armour_vs`, `armour_swing_by`), Obsidian as a material (`material_def`: the edge, bite and wear
 * a knapped head or blade has, read by `mat_edge`, `working_ql` and `damage_item`), the recipes (the set riveted
 * at an anvil, the tools and weapons knapped with a chisel, each stamped Obsidian by `recipe.extra`) and the wall
 * and floor material (`build_material_def`, `build_material_bill`). What is here is the doing:
 *
 *   * `anvil`: an anvil set down within reach (`Game.anvilNear`).
 *   * A tool or a weapon knapped from obsidian is improved with obsidian at stonecutting (`improvable_of`, the
 *     browser's `improvable` with the item's material), whatever the same thing in metal is improved with.
 *
 * `supabase/test/obsidian.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

select pg_temp.patch_fn('at_station(uuid, uuid, text)',
  $o$    when 'smelter' then$o$,
  $n$    -- An anvil set down (`anvil.ts`, `Game.anvilNear`).
    when 'anvil' then
      exists (select 1 from placed_near(p_world, p_uid, 'anvil', null, 2.6))
    when 'smelter' then$n$);

/** What a thing of this id and material is improved with, and the skill: obsidian at stonecutting for a thing knapped from it. */
create or replace function improvable_of(p_def text, p_extra text) returns setof improvable_def language sql stable as $fn$
  select d.item, case when lower(coalesce(p_extra, '')) = 'obsidian' then m.id else d.material end,
         case when lower(coalesce(p_extra, '')) = 'obsidian' and d.material <> m.id then m.skill else d.skill end
    from improvable_def d cross join (select * from improve_material_def where id = 'obsidian') m
   where d.item = p_def
$fn$;

select pg_temp.patch_fn('item_refusal(uuid, uuid, text, jsonb)',
  $o$select * into v_what from improvable_def where item = v_it.def;$o$,
  $n$select * into v_what from improvable_of(v_it.def, v_it.extra);$n$);
select pg_temp.patch_fn('perform_item(uuid, uuid, text, jsonb)',
  $o$select * into v_what from improvable_def where item = v_it.def;$o$,
  $n$select * into v_what from improvable_of(v_it.def, v_it.extra);$n$);

select private.lock_doors();
