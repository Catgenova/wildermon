/**
 * Recipes found off a goblin or an orc, Formulas off an ogre or a dragon, read and used up, and the recipes they open.
 *
 * Asked for: "Orcs and goblins will begin to drop Cooking Recipes with a 5% chance to drop one when butchering their
 * corpse. These recipes will have a lock icon and greyed out in Crafting unless that recipe is read. Reading the
 * recipe consumes it. A recipe cant be consumed by a player if already known." And: "Switch the following to recipe
 * only. Preserves (cherry), cottage pie." This asks, of both sides, in the same words:
 *
 *   * that the shut recipes, their titles, the odds, the kinds that carry one, the item and the action are the same;
 *   * that a shut recipe unread is refused, "Need recipe: Cottage pie.", and greyed (never ready) in the browser;
 *   * that butchering a carcass of a kind that carries one gives a Recipe at the odds (the roll forced either way), and
 *     a rabba's never; one of a recipe not read first, and of any once all are read;
 *   * that reading one opens its recipe and uses it up, and one already open is refused, "Recipe known.", and kept;
 *   * that a simma cooks no shut recipe, on both sides alike;
 *   * and that the beat says the recipes read.
 *
 * And: "All enchants crafts will be locked behind Formulas, which operate the same way. Formulas have a 5% chance to
 * drop from ogre butchering and 25% chance from dragon butchering." So, on both sides: every enchantment scroll shut
 * ("Need formula: Emberbrand scroll."); an ogre's and a dragon's carcass give a Formula (never a Recipe) and a goblin's
 * and an orc's a Recipe (never a Formula), at their own odds; a Formula read by Read formula, used up, refused when
 * known ("Formula known."), and not read as a Recipe.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { cookRecipes } from '../../src/game/creatures';
import { ITEM_DEFS, itemDef } from '../../src/game/items';
import { BOOK_DROPS, dropRecipe, FORMULA_ITEM, FORMULA_KNOWN, READ_FORMULA, READ_RECIPE, RECIPE_DROP_ODDS, RECIPE_DROPPERS, RECIPE_ITEM, RECIPE_KNOWN, recipeOn, recipeToDrop } from '../../src/game/recipebook';
import { lockedRecipes, needRecipeSays, RECIPE_BY_ID, recipeReason, RECIPES, recipeStatus, recipeTitle } from '../../src/game/recipes';
import { lockedHiddenSays, recipeSearch } from '../../src/game/craftsearch';
import { BOON_BONUS, BOON_FOODS, BOON_SKILLS, boonTime, knacksOf, knackSays } from '../../src/game/boons';
import { BREWS } from '../../src/game/brewing';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const U = 'a9c1e000-0000-4000-8000-0000000000c3';
const PIE = RECIPE_BY_ID.get('make_cottage_pie')!;
const LOCKED = lockedRecipes('recipe');
const FORMULAS = lockedRecipes('formula');
const EMBER = RECIPE_BY_ID.get('make_emberbrand_scroll')!;
/** The island's `book_drops`, every roll forced to land (1) or to miss (0): rolled back with the rest. */
const forced = (odds: number): string => `create or replace function book_drops() returns table (kind text, book text, odds double precision)
  language sql immutable as $fn$ select * from (values ${BOOK_DROPS.map((d) => `('${d.kind}', '${d.book}', ${odds}::double precision)`).join(', ')}) v (kind, book, odds) $fn$;`;

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_x int; v_y int; aim jsonb; mark bigint; r record; first text; second text; a bigint; b bigint; c bigint;
        p jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Recipes found', 983, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Reader');
  select floor(x)::int, floor(y)::int into v_x, v_y from player where world_id = w and uid = u;
  aim := jsonb_build_object('kind', 'ground', 'x', v_x, 'y', v_y);
  perform give(w, u, 'butchering_knife', 1, 100);

  insert into said values ('ODDS', recipe_drop_odds()::text);
  insert into said values ('DROPPERS', array_to_string(recipe_droppers(), ','));
  insert into said select 'LOCKED', string_agg(l.id || ':' || l.title, ',' order by l.ord) from locked_recipes() l where recipe_book(l.id) = 'recipe';
  insert into said select 'FLOCKED', string_agg(l.id || ':' || l.title, ',' order by l.ord) from locked_recipes() l where recipe_book(l.id) = 'formula';
  insert into said select 'DROPS', string_agg(bd.kind || ':' || bd.book || ':' || bd.odds, ',') from book_drops() bd;
  insert into said select 'FITEM', d.name || '|' || d.description from item_def d where d.id = book_item('formula');
  insert into said select 'FACT', a.label || '|' || a.base_time || '|' || a.stamina from action_def a where a.id = 'read_formula';
  insert into said values ('FNEED', coalesce(craft_refusal(w, u, 'make_emberbrand_scroll', null), 'ALLOWED'));
  insert into said select 'ITEM', d.name || '|' || d.description from item_def d where d.id = recipe_item();
  insert into said select 'ACT', a.label || '|' || a.base_time || '|' || a.stamina from action_def a where a.id = 'read_recipe';
  insert into said values ('COOKS', array_to_string(tend_recipes('cook'), ','));
  insert into said values ('NEED', coalesce(craft_refusal(w, u, 'make_cottage_pie', null), 'ALLOWED'));

  -- The roll forced to land, here only (rolled back with the rest): a rabba's carcass, then a goblin's.
  ${forced(1)}
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Rabba');
  perform act_perform(w, u, 'butcher', aim);
  insert into said select 'RABBA', count(*)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item();

  select max(n) into mark from event where world_id = w;
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Goblin');
  perform act_perform(w, u, 'butcher', aim);
  select id, extra into a, first from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item();
  insert into said values ('FIRST', coalesce(first, '-') || '|' || coalesce((select ql::text from item where id = a), '-'));
  insert into said select 'FOUND', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.text like 'Found: %';

  -- Read: through the door, then done.
  insert into said values ('READ:NO', coalesce(act_refusal(w, u, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', a)), 'ALLOWED'));
  p := rpc_act(w, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', a));
  insert into said values ('READ:ACT', coalesce(p->>'why', '-') || '|' || coalesce((select act from player where world_id = w and uid = u), 'idle'));
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  select max(n) into mark from event where world_id = w;
  perform act_perform(w, u, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', a));
  insert into said select 'READ', (select string_agg(k.recipe, ',' order by k.recipe) from private.recipe_known k where k.world_id = w and k.uid = u)
    || '|' || (select count(*) from item where id = a)::text;
  insert into said select 'READ:TOLD', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.kind = 'skill';

  -- The next from a goblin: the one not read.
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Goblin');
  perform act_perform(w, u, 'butcher', aim);
  select id, extra into b, second from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item();
  insert into said values ('SECOND', coalesce(second, '-'));
  perform act_perform(w, u, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', b));

  -- All read: an orc's still gives one, of any; reading it is refused, and it is kept.
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Orc');
  perform act_perform(w, u, 'butcher', aim);
  select id into c from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item();
  insert into said values ('THIRD', coalesce((select extra from item where id = c), '-'));
  insert into said values ('KNOWN', coalesce(act_refusal(w, u, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', c)), 'ALLOWED'));
  perform act_perform(w, u, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', c));
  insert into said values ('KEPT', (select count(*) from item where id = c)::text);

  -- Formulas: an ogre's and a dragon's carcass give one, never a Recipe; a goblin's or an orc's never one.
  delete from item where id = c;
  select max(n) into mark from event where world_id = w;
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Ogre');
  perform act_perform(w, u, 'butcher', aim);
  insert into said select 'OGRE', (select count(*) from item where world_id = w and holder = 'player' and holder_uid = u and def = book_item('formula'))
    || '|' || (select count(*) from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item());
  select id, extra into a, first from item where world_id = w and holder = 'player' and holder_uid = u and def = book_item('formula');
  insert into said values ('FFIRST', coalesce(first, '-'));
  insert into said select 'FFOUND', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.text like 'Found: %';
  -- Not read as a Recipe; read as a Formula.
  insert into said values ('FASRECIPE', coalesce(act_refusal(w, u, 'read_recipe', jsonb_build_object('kind', 'item', 'uid', a)), 'ALLOWED'));
  insert into said values ('FREAD:NO', coalesce(act_refusal(w, u, 'read_formula', jsonb_build_object('kind', 'item', 'uid', a)), 'ALLOWED'));
  select max(n) into mark from event where world_id = w;
  perform act_perform(w, u, 'read_formula', jsonb_build_object('kind', 'item', 'uid', a));
  insert into said select 'FREAD', (select count(*) from private.recipe_known k where k.world_id = w and k.uid = u
      and k.recipe = (select l.id from locked_recipes() l where l.title = first))::text || '|' || (select count(*) from item where id = a)::text;
  insert into said select 'FREAD:TOLD', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.kind = 'skill';
  -- Every Formula read: a dragon's still gives one, refused and kept.
  insert into private.recipe_known (world_id, uid, recipe)
    select w, u, l.id from locked_recipes() l where recipe_book(l.id) = 'formula' on conflict do nothing;
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Dragon');
  perform act_perform(w, u, 'butcher', aim);
  select id into b from item where world_id = w and holder = 'player' and holder_uid = u and def = book_item('formula');
  insert into said values ('DRAGON', coalesce((select extra from item where id = b), '-') || '|'
    || (select count(*) from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item()));
  insert into said values ('FKNOWN', coalesce(act_refusal(w, u, 'read_formula', jsonb_build_object('kind', 'item', 'uid', b)), 'ALLOWED'));
  insert into said values ('FOPEN', coalesce(craft_refusal(w, u, 'make_emberbrand_scroll', null), 'ALLOWED'));
  delete from item where id = b;
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Goblin');
  perform act_perform(w, u, 'butcher', aim);
  insert into said select 'GOBLINF', count(*)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = book_item('formula');
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def in (recipe_item(), book_item('formula'));

  -- The roll forced to miss: a goblin's and a dragon's give none.
  ${forced(0)}
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Goblin');
  perform act_perform(w, u, 'butcher', aim);
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Dragon');
  perform act_perform(w, u, 'butcher', aim);
  insert into said select 'MISS', count(*)::text from item where world_id = w and holder = 'player' and holder_uid = u and def in (recipe_item(), book_item('formula'));

  insert into said values ('OPEN', coalesce(craft_refusal(w, u, 'make_cottage_pie', null), 'ALLOWED'));
  insert into said values ('BEAT', (rpc_settle(null, w)->'recipes')::text);
end $t$;
select string_agg(k || '=' || coalesce(v, ''), E'\\n') from said;
rollback;
`);
const island = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1) ?? '(nothing)';

check('the odds of a Recipe are the same on both sides', Number(island('ODDS')) === RECIPE_DROP_ODDS, island('ODDS'));
check('goblins and orcs carry them, on both sides', island('DROPPERS') === RECIPE_DROPPERS.join(','), island('DROPPERS'));
check('the books and the odds are the same on both sides: goblin and orc a Recipe at 5%, ogre a Formula at 5%, dragon one at 25%',
  island('DROPS') === BOOK_DROPS.map((d) => `${d.kind}:${d.book}:${d.odds}`).join(',')
    && BOOK_DROPS.map((d) => `${d.kind}:${d.book}:${d.odds}`).join(',') === 'goblin:recipe:0.05,orc:recipe:0.05,ogre:formula:0.05,dragon:formula:0.25', island('DROPS'));
check('every enchantment scroll is shut behind a Formula, titled the same, and nothing else is',
  island('FLOCKED') === FORMULAS.map((r) => `${r.id}:${recipeTitle(r)}`).join(',')
    && FORMULAS.length === RECIPES.filter((r) => r.category === 'Enchanting').length && FORMULAS.length === 43
    && FORMULAS.every((r) => r.category === 'Enchanting'), `${FORMULAS.length}`);
check('every shut recipe has its own title, so a book opens one', new Set(lockedRecipes().map(recipeTitle)).size === lockedRecipes().length);
check('a Formula is named and described the same', island('FITEM') === `${itemDef(FORMULA_ITEM).name}|${itemDef(FORMULA_ITEM).description}`, island('FITEM'));
check('reading one takes as long', island('FACT') === `${ACTION_BY_ID.get(READ_FORMULA)!.label}|${ACTION_BY_ID.get(READ_FORMULA)!.baseTime}|${ACTION_BY_ID.get(READ_FORMULA)!.stamina}`, island('FACT'));
check('on the island, a scroll unread is refused', island('FNEED') === needRecipeSays(EMBER) && island('FNEED') === 'Need formula: Emberbrand scroll.', island('FNEED'));
check('an ogre carcass gives a Formula, not a Recipe, the roll forced', island('OGRE') === '1|0', island('OGRE'));
check('of a scroll, and says so', FORMULAS.some((r) => recipeTitle(r) === island('FFIRST'))
  && island('FFOUND') === `Found: ${itemDef(FORMULA_ITEM).name} (${island('FFIRST').toLowerCase()}).`, island('FFOUND'));
check('a Formula is not read as a Recipe', island('FASRECIPE') === 'It is gone.', island('FASRECIPE'));
check('reading it is let through, opens its scroll and uses it up, and says so',
  island('FREAD:NO') === 'ALLOWED' && island('FREAD') === '1|0' && island('FREAD:TOLD') === `Formula read: ${island('FFIRST')}. Formula used up.`,
  `${island('FREAD:NO')} / ${island('FREAD')} / ${island('FREAD:TOLD')}`);
check('all read, a dragon still gives a Formula, never a Recipe', FORMULAS.some((r) => recipeTitle(r) === island('DRAGON').split('|')[0]) && island('DRAGON').endsWith('|0'), island('DRAGON'));
check('one already read is refused, "Formula known."', island('FKNOWN') === FORMULA_KNOWN && FORMULA_KNOWN === 'Formula known.', island('FKNOWN'));
check('read, an emberbrand scroll is no longer refused for its Formula', !island('FOPEN').startsWith('Need formula'), island('FOPEN'));
check('a goblin carcass never gives a Formula, the roll forced', island('GOBLINF') === '0', island('GOBLINF'));
check('the shut recipes are cherry preserves and cottage pie, titled the same',
  island('LOCKED') === LOCKED.map((r) => `${r.id}:${recipeTitle(r)}`).join(',')
    && LOCKED.map((r) => r.id).sort().join(',') === 'make_cherry_preserves,make_cottage_pie', island('LOCKED'));
check('a Recipe is named and described the same', island('ITEM') === `${itemDef(RECIPE_ITEM).name}|${itemDef(RECIPE_ITEM).description}`, island('ITEM'));
check('reading one takes as long', island('ACT') === `${ACTION_BY_ID.get(READ_RECIPE)!.label}|${ACTION_BY_ID.get(READ_RECIPE)!.baseTime}|${ACTION_BY_ID.get(READ_RECIPE)!.stamina}`, island('ACT'));
check('a simma cooks no shut recipe, the same on both sides',
  island('COOKS') === cookRecipes().join(',') && !LOCKED.some((r) => cookRecipes().includes(r.id)), island('COOKS'));
check('on the island, a shut recipe unread is refused', island('NEED') === needRecipeSays(PIE) && island('NEED') === 'Need recipe: Cottage pie.', island('NEED'));
check('a rabba carcass gives no Recipe, the roll forced', island('RABBA') === '0', island('RABBA'));
const [first, firstQl] = island('FIRST').split('|');
check('a goblin carcass gives one, at its QL, the roll forced', LOCKED.some((r) => recipeTitle(r) === first) && Number(firstQl) === 40, island('FIRST'));
check('and says so', island('FOUND') === `Found: ${itemDef(RECIPE_ITEM).name} (${first.toLowerCase()}).`, island('FOUND'));
check('reading one is let through the door', island('READ:NO') === 'ALLOWED' && island('READ:ACT').startsWith('-|'), `${island('READ:NO')} / ${island('READ:ACT')}`);
const firstId = LOCKED.find((r) => recipeTitle(r) === first)?.id ?? '?';
check('reading it opens its recipe and uses it up', island('READ') === `${firstId}|0`, island('READ'));
check('and says so', island('READ:TOLD') === `Recipe read: ${first}. Recipe used up.`, island('READ:TOLD'));
check('the next is of the recipe not read', island('SECOND') !== first && LOCKED.some((r) => recipeTitle(r) === island('SECOND')), island('SECOND'));
check('all read, an orc still gives one', LOCKED.some((r) => recipeTitle(r) === island('THIRD')), island('THIRD'));
check('one already read is refused, and kept', island('KNOWN') === RECIPE_KNOWN && island('KEPT') === '1', `${island('KNOWN')} / ${island('KEPT')}`);
check('the roll missed, a goblin and a dragon give none', island('MISS') === '0', island('MISS'));
check('read, cottage pie is no longer refused for its recipe', !island('OPEN').startsWith('Need recipe'), island('OPEN'));
// Compared as a set: the island's order is its database's collation, which on CI puts emberbrand before ember_heart.
const beatRead = ((): string[] => { try { return (JSON.parse(island('BEAT')) as string[]).slice().sort(); } catch { return []; } })();
check('the beat says the recipes and Formulas read', JSON.stringify(beatRead) === JSON.stringify(lockedRecipes().map((r) => r.id).sort()), island('BEAT'));

/* ---- the browser -------------------------------------------------------------------- */

const g = Game.create(4242);
for (const it of [...g.inventory.items]) if (it.id === RECIPE_ITEM) g.inventory.remove(it.uid, it.count);
check('in the browser, a shut recipe unread is refused in the same words', recipeReason(PIE, g) === island('NEED'), String(recipeReason(PIE, g)));
const st = recipeStatus(PIE, g);
check('and greyed: never ready', st.unread && !st.ready && st.max === 0, JSON.stringify({ unread: st.unread, ready: st.ready }));

g.rand = () => 0.5;
check('a roll over the odds gives none', dropRecipe(g, 'goblin', 40) === null && !g.inventory.items.some((it) => it.id === RECIPE_ITEM));
g.rand = () => RECIPE_DROP_ODDS - 1e-9;
check('a rabba carcass gives none, the roll forced', dropRecipe(g, 'rabba', 40) === null);
const said1 = dropRecipe(g, 'goblin', 40);
const got1 = g.inventory.items.find((it) => it.id === RECIPE_ITEM);
check('a goblin carcass gives one, at its QL, and says so as the island does',
  !!got1 && got1.ql === 40 && said1 === `Found: ${itemDef(RECIPE_ITEM).name} (${got1.extra?.toLowerCase()}).`, `${said1}`);

const read = ACTION_BY_ID.get(READ_RECIPE)!;
const at1: Target = { kind: 'item', uid: got1!.uid };
check('reading it is allowed', read.check?.(at1, g) === null);
const seen = g.log.length;
read.perform(at1, g);
const r1 = recipeOn(got1);
check('reading it opens its recipe and uses it up, and says so as the island does',
  !!r1 && g.knowsRecipe(r1.id) && !g.inventory.get(got1!.uid) && g.log.slice(seen).some((l) => l.text === `Recipe read: ${recipeTitle(r1)}. Recipe used up.`),
  g.log.slice(seen).map((l) => l.text).join(' / '));
const next = recipeToDrop(g, 'recipe', 0);
check('the next is of the recipe not read', !!next && next.id !== r1?.id, next?.id);
for (const r of LOCKED) g.knownRecipes.add(r.id);
check('all read, one of any still drops', !!recipeToDrop(g, 'recipe', 0.99));
dropRecipe(g, 'orc', 40);
const got2 = g.inventory.items.find((it) => it.id === RECIPE_ITEM)!;
check('one already read is refused in the same words, and kept',
  read.check?.({ kind: 'item', uid: got2.uid }, g) === RECIPE_KNOWN && read.check?.({ kind: 'item', uid: got2.uid }, g) === island('KNOWN'));
check('read, cottage pie is no longer refused for its recipe', !String(recipeReason(PIE, g)).startsWith('Need recipe'), String(recipeReason(PIE, g)));
check('read, it is not greyed for its recipe', !recipeStatus(PIE, g).unread);

/* Formulas, in the browser. */
const f = Game.create(4244);
for (const it of [...f.inventory.items]) if (it.id === RECIPE_ITEM || it.id === FORMULA_ITEM) f.inventory.remove(it.uid, it.count);
check('in the browser, a scroll unread is refused in the same words', recipeReason(EMBER, f) === island('FNEED'), String(recipeReason(EMBER, f)));
check('and greyed: never ready', recipeStatus(EMBER, f).unread && !recipeStatus(EMBER, f).ready);
const heldOf = (id: string): number => f.inventory.items.filter((it) => it.id === id).length;
f.rand = () => 0.049;
const saidO = dropRecipe(f, 'ogre', 50);
const gotO = f.inventory.items.find((it) => it.id === FORMULA_ITEM);
check('an ogre carcass under 5% gives a Formula, not a Recipe, and says so as the island does',
  !!gotO && heldOf(RECIPE_ITEM) === 0 && FORMULAS.some((r) => recipeTitle(r) === gotO.extra) && saidO === `Found: ${itemDef(FORMULA_ITEM).name} (${gotO.extra?.toLowerCase()}).`, `${saidO}`);
f.rand = () => 0.051;
check('an ogre carcass at 5% or over gives none', dropRecipe(f, 'ogre', 50) === null);
f.rand = () => 0.249;
check('a dragon carcass under 25% gives a Formula', !!dropRecipe(f, 'dragon', 50) && heldOf(FORMULA_ITEM) === 2 && heldOf(RECIPE_ITEM) === 0);
f.rand = () => 0.251;
check('a dragon carcass at 25% or over gives none', dropRecipe(f, 'dragon', 50) === null);
f.rand = () => 0;
dropRecipe(f, 'goblin', 50);
dropRecipe(f, 'orc', 50);
check('a goblin or an orc carcass gives a Recipe, never a Formula', heldOf(FORMULA_ITEM) === 2 && heldOf(RECIPE_ITEM) === 2);
const rf = ACTION_BY_ID.get(READ_FORMULA)!;
const rr = ACTION_BY_ID.get(READ_RECIPE)!;
const atO: Target = { kind: 'item', uid: gotO!.uid };
check('a Formula is offered Read formula, not Read recipe', rf.applies(atO, f) && !rr.applies(atO, f));
const seenF = f.log.length;
rf.perform(atO, f);
const opened = recipeOn(gotO);
check('reading it opens its scroll and uses it up, and says so as the island does',
  !!opened && f.knowsRecipe(opened.id) && !f.inventory.get(gotO!.uid)
    && f.log.slice(seenF).some((l) => l.text === `Formula read: ${recipeTitle(opened)}. Formula used up.`), f.log.slice(seenF).map((l) => l.text).join(' / '));
for (const r of FORMULAS) f.knownRecipes.add(r.id);
const gotD = f.inventory.items.find((it) => it.id === FORMULA_ITEM)!;
check('one already read is refused in the same words, and kept', rf.check?.({ kind: 'item', uid: gotD.uid }, f) === island('FKNOWN'));
check('read, an emberbrand scroll is no longer refused for its Formula', !String(recipeReason(EMBER, f)).startsWith('Need formula'), String(recipeReason(EMBER, f)));

/* And the whole butchering go, the roll forced: wired in, after the parts are taken. */
const h = Game.create(4243);
for (const it of [...h.inventory.items]) if (it.id === RECIPE_ITEM) h.inventory.remove(it.uid, it.count);
h.inventory.add('butchering_knife', { ql: 100 });
const [x, y] = [h.player.tileX, h.player.tileY];
h.dropOnGround(x, y, { uid: h.inventory.nextUid++, id: 'corpse', ql: 30, dmg: 0, count: 1, extra: 'Goblin' });
h.rand = () => 0;
ACTION_BY_ID.get('butcher')!.perform({ kind: 'ground', x, y, uid: null }, h);
check('butchering a goblin carcass in the browser gives one, the roll forced', h.inventory.items.some((it) => it.id === RECIPE_ITEM && it.ql === 30));
h.dropOnGround(x, y, { uid: h.inventory.nextUid++, id: 'corpse', ql: 30, dmg: 0, count: 1, extra: 'Dragon' });
ACTION_BY_ID.get('butcher')!.perform({ kind: 'ground', x, y, uid: null }, h);
check('butchering a dragon carcass in the browser gives a Formula, the roll forced', h.inventory.items.some((it) => it.id === FORMULA_ITEM && it.ql === 30));

/* ---- The crafting search: a shut recipe unread is off the page unless "Show locked", and then found by name only ---- */

const pie = RECIPE_BY_ID.get('make_cottage_pie')!;
const stew = RECIPE_BY_ID.get('make_stew')!;
check('an open recipe answers to a material in it', recipeSearch(stew, 'potato', false, false) === 'listed');
check('a shut recipe unread is not listed, and a search for its name counts it as hidden', recipeSearch(pie, '', true, false) === 'hidden'
  && recipeSearch(pie, 'cottage', true, false) === 'hidden', `${recipeSearch(pie, '', true, false)} ${recipeSearch(pie, 'cottage', true, false)}`);
check('and a search for a material in it neither lists nor counts it, with "Show locked" or without',
  recipeSearch(pie, 'potato', true, false) === 'no' && recipeSearch(pie, 'potato', true, true) === 'no' && recipeSearch(pie, 'clay bowl', true, true) === 'no');
check('with "Show locked" ticked it is listed, by its name', recipeSearch(pie, '', true, true) === 'listed' && recipeSearch(pie, 'cottage pie', true, true) === 'listed');
check('once read it is an open recipe: listed, and found by its materials', recipeSearch(pie, 'potato', false, false) === 'listed'
  && recipeSearch(pie, '', false, false) === 'listed');
const matched = RECIPES.filter((r) => recipeSearch(r, 'preserves', !!r.locked, false) === 'hidden').length;
check(`the line at the foot counts them: "${lockedHiddenSays(matched)}"`, matched === 1 && lockedHiddenSays(matched) === 'Locked recipes: 1 · Show', lockedHiddenSays(matched));

/* ---- Meal boosts: only a dish off a shut recipe, on its own skills ---- */

const dishes = lockedRecipes('recipe').map((r) => r.result);
check('every dish off a shut recipe carries a meal boost, and nothing else does',
  dishes.every((id) => knacksOf(id).length > 0) && BOON_FOODS.every((id) => dishes.includes(id)), `${dishes.join(',')} / ${BOON_FOODS.join(',')}`);
check('every skill a meal boost names is one a meal boost may name', BOON_FOODS.every((id) => knacksOf(id).every((k) => BOON_SKILLS.includes(k))));
const sets = BOON_FOODS.map((id) => [...knacksOf(id)].sort().join('+'));
check('no two dishes give the same meal boost', new Set(sets).size === sets.length, sets.join(' '));
check('cottage pie: butchering; cherry preserves: foraging, on a dish of their own',
  knacksOf('cottage_pie').join() === 'butchering' && knacksOf('cherry_preserves').join() === 'foraging'
    && RECIPE_BY_ID.get('make_cherry_preserves')!.result === 'cherry_preserves' && RECIPE_BY_ID.get('make_preserves')!.result === 'preserves'
    && knacksOf('preserves').length === 0);
const m = Game.create(4244);
m.player.boons = [];
const none = ['stew', 'baked_potato', 'bread', 'preserves', 'spirit_bucket', 'tincture', ...BREWS.map((b) => `${b.id}_bucket`)].map((id) => m.grantBoon(id, 60));
check('plain food, brews, spirit and a tincture give none', none.every((x) => x === null) && m.player.boons.length === 0, JSON.stringify(m.player.boons));
const said = m.grantBoon('cottage_pie', 60);
check('a cottage pie gives its meal boost, for as long as its QL says, and says so',
  m.player.boons.length === 1 && m.player.boons[0].skill === 'butchering' && m.player.boons[0].bonus === BOON_BONUS
    && Math.abs(m.player.boons[0].until - m.time - boonTime('cottage_pie', 60)) < 1e-6 && said === `${knackSays('cottage_pie')}, ${Math.floor(boonTime('cottage_pie', 60) / 60)}m.`,
  `${said} ${JSON.stringify(m.player.boons)}`);
check('and its description says it, from the rule', (ITEM_DEFS.cottage_pie.description ?? '').startsWith(`${knackSays('cottage_pie')}, `), ITEM_DEFS.cottage_pie.description);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`recipes found and read — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
