/**
 * Recipes found off a goblin or an orc, read and used up, and the recipes they open.
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
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { cookRecipes } from '../../src/game/creatures';
import { itemDef } from '../../src/game/items';
import { dropRecipe, READ_RECIPE, RECIPE_DROP_ODDS, RECIPE_DROPPERS, RECIPE_ITEM, RECIPE_KNOWN, recipeOn, recipeToDrop } from '../../src/game/recipebook';
import { lockedRecipes, needRecipeSays, RECIPE_BY_ID, recipeReason, recipeStatus, recipeTitle } from '../../src/game/recipes';

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
const LOCKED = lockedRecipes();

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
  insert into said select 'LOCKED', string_agg(l.id || ':' || l.title, ',' order by l.ord) from locked_recipes() l;
  insert into said select 'ITEM', d.name || '|' || d.description from item_def d where d.id = recipe_item();
  insert into said select 'ACT', a.label || '|' || a.base_time || '|' || a.stamina from action_def a where a.id = 'read_recipe';
  insert into said values ('COOKS', array_to_string(tend_recipes('cook'), ','));
  insert into said values ('NEED', coalesce(craft_refusal(w, u, 'make_cottage_pie', null), 'ALLOWED'));

  -- The roll forced to land, here only (rolled back with the rest): a rabba's carcass, then a goblin's.
  create or replace function recipe_drop_odds() returns double precision language sql immutable as $fn$ select 1::double precision $fn$;
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

  -- The roll forced to miss: a goblin's gives none.
  create or replace function recipe_drop_odds() returns double precision language sql immutable as $fn$ select 0::double precision $fn$;
  delete from item where id = c;
  perform drop_on_ground(w, v_x, v_y, 'corpse', 40, 'Goblin');
  perform act_perform(w, u, 'butcher', aim);
  insert into said select 'MISS', count(*)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = recipe_item();

  insert into said values ('OPEN', coalesce(craft_refusal(w, u, 'make_cottage_pie', null), 'ALLOWED'));
  insert into said values ('BEAT', (rpc_settle(null, w)->'recipes')::text);
end $t$;
select string_agg(k || '=' || coalesce(v, ''), E'\\n') from said;
rollback;
`);
const island = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1) ?? '(nothing)';

check('the odds of a Recipe are the same on both sides', Number(island('ODDS')) === RECIPE_DROP_ODDS, island('ODDS'));
check('goblins and orcs carry them, on both sides', island('DROPPERS') === RECIPE_DROPPERS.join(','), island('DROPPERS'));
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
check('the roll missed, a goblin gives none', island('MISS') === '0', island('MISS'));
check('read, cottage pie is no longer refused for its recipe', !island('OPEN').startsWith('Need recipe'), island('OPEN'));
check('the beat says the recipes read', island('BEAT') === JSON.stringify(LOCKED.map((r) => r.id).sort()).replace(/,/g, ', '), island('BEAT'));

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
const next = recipeToDrop(g, 0);
check('the next is of the recipe not read', !!next && next.id !== r1?.id, next?.id);
for (const r of LOCKED) g.knownRecipes.add(r.id);
check('all read, one of any still drops', !!recipeToDrop(g, 0.99));
dropRecipe(g, 'orc', 40);
const got2 = g.inventory.items.find((it) => it.id === RECIPE_ITEM)!;
check('one already read is refused in the same words, and kept',
  read.check?.({ kind: 'item', uid: got2.uid }, g) === RECIPE_KNOWN && read.check?.({ kind: 'item', uid: got2.uid }, g) === island('KNOWN'));
check('read, cottage pie is no longer refused for its recipe', !String(recipeReason(PIE, g)).startsWith('Need recipe'), String(recipeReason(PIE, g)));
check('read, it is not greyed for its recipe', !recipeStatus(PIE, g).unread);

/* And the whole butchering go, the roll forced: wired in, after the parts are taken. */
const h = Game.create(4243);
for (const it of [...h.inventory.items]) if (it.id === RECIPE_ITEM) h.inventory.remove(it.uid, it.count);
h.inventory.add('butchering_knife', { ql: 100 });
const [x, y] = [h.player.tileX, h.player.tileY];
h.dropOnGround(x, y, { uid: h.inventory.nextUid++, id: 'corpse', ql: 30, dmg: 0, count: 1, extra: 'Goblin' });
h.rand = () => 0;
ACTION_BY_ID.get('butcher')!.perform({ kind: 'ground', x, y, uid: null }, h);
check('butchering a goblin carcass in the browser gives one, the roll forced', h.inventory.items.some((it) => it.id === RECIPE_ITEM && it.ql === 30));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`recipes found and read — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
