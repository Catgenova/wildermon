-- Formulas off an ogre or a dragon, read and used up, and every enchantment scroll shut until its Formula is read.
--
-- Asked for: "All enchants crafts will be locked behind Formulas, which operate the same way. Formulas have a 5% chance
-- to drop from ogre butchering and 25% chance from dragon butchering."
--
-- The rulebook (the snapshot before this one) now shuts every enchantment scroll (`locked_recipes()` holds them with
-- the cooking ones), says which book opens each (`recipe_book`: 'formula' for a scroll, 'recipe' for a dish), the item
-- each book is written on (`book_item`), what reading one already open says (`book_known_says`), the book an item is
-- (`book_of_item`), and the kinds whose carcasses carry one with the odds (`book_drops`: goblin and orc a Recipe at 5%,
-- ogre a Formula at 5%, dragon a Formula at 25%). Here:
--
--   * `private.recipe_to_drop` picks of one kind of book (`recipeToDrop`);
--   * butchering rolls the carcass's own kind's odds and gives that kind of book: "Found: Formula (emberbrand scroll).";
--   * `read_formula` reads a Formula as `read_recipe` reads a Recipe (a relic use), each only its own kind;
--   * `craft_refusal` names the book: "Need formula: Emberbrand scroll.".
--
-- Known ones stay in `private.recipe_known`, keyed by the recipe. `supabase/test/recipedrops.ts` holds the two sides to
-- each other.

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

/** The shut recipe a book of this kind off a carcass opens (`recipeToDrop`): one not read at random, or any once all are. */
create or replace function private.recipe_to_drop(p_world uuid, p_uid uuid, p_book text) returns text
language sql volatile as $fn$
  select coalesce(
    (select l.id from locked_recipes() l
      where recipe_book(l.id) = p_book and not private.recipe_read(p_world, p_uid, l.id) order by random() limit 1),
    (select l.id from locked_recipes() l where recipe_book(l.id) = p_book order by random() limit 1))
$fn$;

/** The shut recipe a Recipe or a Formula opens, off its def and the title in its `extra` (`recipeOn`), or null. */
create or replace function private.book_opens(p_def text, p_extra text) returns text
language sql stable as $fn$
  select l.id from locked_recipes() l where l.title = p_extra and recipe_book(l.id) = book_of_item(p_def)
$fn$;

/* ---- Butchering: a book of the carcass's kind, maybe ---------------------------------------------- */

select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    -- And a Recipe, maybe, off a goblin or an orc, at the carcass's QL (`dropRecipe`), however the butchering went.
    if sp.id = any (recipe_droppers()) and random() < recipe_drop_odds() then
      got := private.recipe_to_drop(p_world, p_uid);
      if got is not null then
        perform give(p_world, p_uid, recipe_item(), 1, corpse.ql, (select l.title from locked_recipes() l where l.id = got));
        perform tell(p_world, p_uid, 'Found: ' || (select idf.name from item_def idf where idf.id = recipe_item()) || ' ('
          || lower((select l.title from locked_recipes() l where l.id = got)) || ').', 'event');
      end if;
    end if;$o$,
  $n$    -- And a book, maybe, off a kind that carries one (`book_drops`: a Recipe off a goblin or an orc, a Formula off an
    -- ogre or a dragon), at the carcass's QL (`dropRecipe`), however the butchering went.
    if exists (select 1 from book_drops() bd where bd.kind = sp.id and random() < bd.odds) then
      got := private.recipe_to_drop(p_world, p_uid, (select bd.book from book_drops() bd where bd.kind = sp.id));
      if got is not null then
        perform give(p_world, p_uid, book_item(recipe_book(got)), 1, corpse.ql, (select l.title from locked_recipes() l where l.id = got));
        perform tell(p_world, p_uid, 'Found: ' || (select idf.name from item_def idf where idf.id = book_item(recipe_book(got))) || ' ('
          || lower((select l.title from locked_recipes() l where l.id = got)) || ').', 'event');
      end if;
    end if;$n$);

/* ---- Reading one ---------------------------------------------------------------------------------- */

select pg_temp.patch_fn('public.relic_use_action(text)'::regprocedure,
  $o$'read_recipe'$o$,
  $n$'read_recipe', 'read_formula'$n$);

select pg_temp.patch_fn('public.relic_use_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  if p_action = 'read_recipe' then
    -- A Recipe, and the recipe it opens not read yet (`readRecipeRefusal`).
    if v_it.def <> recipe_item() or private.recipe_on(v_it.extra) is null then return 'It is gone.'; end if;
    if private.recipe_read(p_world, p_uid, private.recipe_on(v_it.extra)) then return recipe_known_says(); end if;
    return null;
  end if;$o$,
  $n$  if p_action in ('read_recipe', 'read_formula') then
    -- A Recipe or a Formula, each read by its own action, and the recipe it opens not read yet (`readRecipeRefusal`).
    if v_it.def <> book_item(case p_action when 'read_formula' then 'formula' else 'recipe' end)
       or private.book_opens(v_it.def, v_it.extra) is null then return 'It is gone.'; end if;
    if private.recipe_read(p_world, p_uid, private.book_opens(v_it.def, v_it.extra)) then
      return book_known_says(book_of_item(v_it.def));
    end if;
    return null;
  end if;$n$);

select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'read_recipe' then
    -- The recipe it opens, read for good; the Recipe used up (`recipebook.ts`).
    v_recipe := private.recipe_on(v_it.extra);
    if v_recipe is null or not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    insert into private.recipe_known (world_id, uid, recipe) values (p_world, p_uid, v_recipe) on conflict do nothing;
    perform tell(p_world, p_uid, 'Recipe read: ' || (select l.title from locked_recipes() l where l.id = v_recipe)
      || '. Recipe used up.', 'skill');$o$,
  $n$  elsif p_action in ('read_recipe', 'read_formula') then
    -- The recipe it opens, read for good; the Recipe or Formula used up (`recipebook.ts`).
    v_recipe := private.book_opens(v_it.def, v_it.extra);
    if v_recipe is null or not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    insert into private.recipe_known (world_id, uid, recipe) values (p_world, p_uid, v_recipe) on conflict do nothing;
    perform tell(p_world, p_uid, (select idf.name from item_def idf where idf.id = v_it.def) || ' read: '
      || (select l.title from locked_recipes() l where l.id = v_recipe)
      || '. ' || (select idf.name from item_def idf where idf.id = v_it.def) || ' used up.', 'skill');$n$);

/* ---- Crafting: the book named ---------------------------------------------------------------------- */

select pg_temp.patch_fn('public.craft_refusal(uuid,uuid,text,bigint)'::regprocedure,
  $o$    return 'Need recipe: ' || (select l.title from locked_recipes() l where l.id = p_recipe) || '.';$o$,
  $n$    return 'Need ' || recipe_book(p_recipe) || ': ' || (select l.title from locked_recipes() l where l.id = p_recipe) || '.';$n$);

select private.lock_doors();
