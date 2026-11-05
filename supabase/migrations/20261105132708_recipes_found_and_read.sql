-- Recipes found off a goblin or an orc, read and used up, and the recipes they open.
--
-- Asked for: "Orcs and goblins will begin to drop Cooking Recipes with a 5% chance to drop one when butchering their
-- corpse. These recipes will have a lock icon and greyed out in Crafting unless that recipe is read. Reading the recipe
-- consumes it. A recipe cant be consumed by a player if already known." And: "Switch the following to recipe only.
-- Preserves (cherry), cottage pie."
--
-- A shut recipe is one in `locked_recipes()` (the rulebook's, off `Recipe.locked`, in the snapshot before this one),
-- with the title its Recipe carries in `extra`. Here:
--
--   * `private.recipe_known`: the shut recipes each body has read, for good;
--   * butchering a carcass of a kind in `recipe_droppers()` gives a Recipe one time in 1 / `recipe_drop_odds()`, of a
--     shut recipe the butcher has not read, or of any once every one is read, at the carcass's QL, into the pack:
--     "Found: Recipe (cottage pie).";
--   * `read_recipe` (a relic use: `relic_use_refusal`, `perform_relic_use`) on a Recipe in the pack: the recipe read
--     and the Recipe used up, "Recipe read: Cottage pie. Recipe used up."; refused, "Recipe known.", when it is read;
--   * `craft_refusal` refuses a shut recipe unread, after any perk it wants: "Need recipe: Cottage pie.";
--   * a simma cooks no shut recipe (`tend_recipes('cook')`, as `cookRecipes`);
--   * every beat says the recipes you have read (`rpc_settle`, `recipes`), which the crafting window opens.
--
-- `supabase/test/recipedrops.ts` holds the two sides to each other.

set local lock_timeout = '3s';

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

create table if not exists private.recipe_known (
  world_id uuid not null,
  uid uuid not null,
  recipe text not null,
  read_at timestamptz not null default now(),
  primary key (world_id, uid, recipe),
  foreign key (world_id, uid) references public.player (world_id, uid) on delete cascade
);
alter table private.recipe_known enable row level security;
revoke all on private.recipe_known from public, anon, authenticated;

/** Whether a body has read the Recipe of a shut recipe. */
create or replace function private.recipe_read(p_world uuid, p_uid uuid, p_recipe text) returns boolean
language sql stable as $fn$
  select exists (select 1 from private.recipe_known k where k.world_id = p_world and k.uid = p_uid and k.recipe = p_recipe)
$fn$;

/** The shut recipe a Recipe off a carcass opens (`recipeToDrop`): one not read at random, or any once all are read. */
create or replace function private.recipe_to_drop(p_world uuid, p_uid uuid) returns text
language sql volatile as $fn$
  select coalesce(
    (select l.id from locked_recipes() l where not private.recipe_read(p_world, p_uid, l.id) order by random() limit 1),
    (select l.id from locked_recipes() l order by random() limit 1))
$fn$;

/** The shut recipe a Recipe opens, off the title in its `extra` (`recipeOn`), or null. */
create or replace function private.recipe_on(p_extra text) returns text
language sql stable as $fn$
  select l.id from locked_recipes() l where l.title = p_extra
$fn$;

/* ---- Butchering: a Recipe, maybe ------------------------------------------------------------------ */

select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    perform skill_raise(p_world, p_uid, 'butchering', 1);$o$,
  $n$    -- And a Recipe, maybe, off a goblin or an orc, at the carcass's QL (`dropRecipe`), however the butchering went.
    if sp.id = any (recipe_droppers()) and random() < recipe_drop_odds() then
      got := private.recipe_to_drop(p_world, p_uid);
      if got is not null then
        perform give(p_world, p_uid, recipe_item(), 1, corpse.ql, (select l.title from locked_recipes() l where l.id = got));
        perform tell(p_world, p_uid, 'Found: ' || (select idf.name from item_def idf where idf.id = recipe_item()) || ' ('
          || lower((select l.title from locked_recipes() l where l.id = got)) || ').', 'event');
      end if;
    end if;
    perform skill_raise(p_world, p_uid, 'butchering', 1);$n$);

/* ---- Reading one ---------------------------------------------------------------------------------- */

select pg_temp.patch_fn('public.relic_use_action(text)'::regprocedure,
  $o$'read_rune_tablet', 'enchant_statue')$o$,
  $n$'read_rune_tablet', 'enchant_statue', 'read_recipe')$n$);

select pg_temp.patch_fn('public.relic_use_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  if p_action = 'open_seed_jar' then$o$,
  $n$  if p_action = 'read_recipe' then
    -- A Recipe, and the recipe it opens not read yet (`readRecipeRefusal`).
    if v_it.def <> recipe_item() or private.recipe_on(v_it.extra) is null then return 'It is gone.'; end if;
    if private.recipe_read(p_world, p_uid, private.recipe_on(v_it.extra)) then return recipe_known_says(); end if;
    return null;
  end if;
  if p_action = 'open_seed_jar' then$n$);

select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare v_it item; v_stone item;$o$,
  $n$declare v_it item; v_stone item; v_recipe text;$n$);

select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'open_seed_jar' then$o$,
  $n$  elsif p_action = 'read_recipe' then
    -- The recipe it opens, read for good; the Recipe used up (`recipebook.ts`).
    v_recipe := private.recipe_on(v_it.extra);
    if v_recipe is null or not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    insert into private.recipe_known (world_id, uid, recipe) values (p_world, p_uid, v_recipe) on conflict do nothing;
    perform tell(p_world, p_uid, 'Recipe read: ' || (select l.title from locked_recipes() l where l.id = v_recipe)
      || '. Recipe used up.', 'skill');

  elsif p_action = 'open_seed_jar' then$n$);

/* ---- Crafting: shut until read -------------------------------------------------------------------- */

select pg_temp.patch_fn('public.craft_refusal(uuid,uuid,text,bigint)'::regprocedure,
  $o$  if r.tool is not null and tool_ql(p_world, p_uid, r.tool) <= 0 then$o$,
  $n$  -- A shut recipe, until its Recipe is read (`recipeUnread`); a perk it also wants is said first.
  if exists (select 1 from locked_recipes() l where l.id = p_recipe) and not private.recipe_read(p_world, p_uid, p_recipe) then
    return 'Need recipe: ' || (select l.title from locked_recipes() l where l.id = p_recipe) || '.';
  end if;
  if r.tool is not null and tool_ql(p_world, p_uid, r.tool) <= 0 then$n$);

-- And a simma cooks none of them (`cookRecipes`).
select pg_temp.patch_fn('public.tend_recipes(text)'::regprocedure,
  $o$'make_apple_pie', 'make_cherry_preserves', 'make_cottage_pie', 'make_stew',$o$,
  $n$'make_apple_pie', 'make_stew',$n$);

/* ---- The beat says what you have read ------------------------------------------------------------- */

select pg_temp.patch_fn('public.rpc_settle(bigint,uuid,bigint,boolean,jsonb)'::regprocedure,
  $o$    'titles', coalesce(p.titles, '[]'::jsonb),$o$,
  $n$    'titles', coalesce(p.titles, '[]'::jsonb),
    -- The shut recipes read (`private.recipe_known`), which the crafting window opens.
    'recipes', coalesce((select jsonb_agg(k.recipe order by k.recipe) from private.recipe_known k
                          where k.world_id = p.world_id and k.uid = me), '[]'::jsonb),$n$);

select private.lock_doors();
