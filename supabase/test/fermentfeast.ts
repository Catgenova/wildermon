/**
 * The oven as a station, a ferment sealed and opened, and a dish served out to a group.
 *
 * The mechanics the drop recipes need, before any of them is written: no recipe in the book is a ferment, an oven's own
 * or a group's dish yet, so this asks them of fixtures put in for the test (rolled back on the island, pushed onto the
 * book in the browser), in the same words on both sides:
 *
 *   * `oven`: a lit oven is one, a cold oven and a lit brazier are not; `campfire` still takes a lit oven or brazier;
 *   * a ferment: a go uses its inputs and its vessel and gives a Sealed vessel named for its result, ready `seconds`
 *     after; opened too soon it says how long is left, opened when ready it gives the result at its QL and the vessel
 *     back; one wanting a cellar is refused above ground and let through under it;
 *   * a group's dish: serving it hands one share to each other player awake and in reach, the rest to the server, and
 *     says so to both.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { itemDef, ITEM_DEFS } from '../../src/game/items';
import { FERMENT_CELLAR_SAYS, madeSaid, RECIPES, recipeAction, recipeReason, SEALED_ITEM, STATION_NAME, type Recipe } from '../../src/game/recipes';
import { fermentNotReady, OPEN_FERMENT, VESSEL_BACK_QL } from '../../src/game/ferment';
import { SERVE_DISH, servedSays } from '../../src/game/feast';
import { psql, ok, bad, check } from './harness';

/* The fixtures: a ferment of two cabbages in a clay jar to two pottage over ten minutes, the same wanting a cellar, and
 * pottage as a dish of four shares of bread served to five tiles. */
const SECS = 600;
const SEAL: Recipe = {
  id: 'test_ferment', category: 'Cooking', result: 'pottage', count: 2, inputs: [{ item: 'cabbage', count: 2 }, { item: 'clay_jar' }],
  skill: 'cooking', label: 'Seal to ferment', verb: 'sealing', baseTime: 5, stamina: 0, done: '', ferment: { seconds: SECS, vessel: 'clay_jar' },
};
const CELLAR: Recipe = { ...SEAL, id: 'test_cellar', title: 'Cellar pottage', ferment: { seconds: SECS, vessel: 'clay_jar', cellar: true } };
const SERVE = { serving: 'bread', count: 4, reach: 5 };

const U = 'a9c1e000-0000-4000-8000-0000000000d4';
const NEAR = 'a9c1e000-0000-4000-8000-0000000000d5';
const FAR = 'a9c1e000-0000-4000-8000-0000000000d6';

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; near uuid := '${NEAR}'; far uuid := '${FAR}'; v_x int; v_y int; v_oven bigint; v_brazier bigint;
        v_cab bigint; v_sealed bigint; mark bigint; v_dish bigint; p jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ferments and feasts', 984, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', near)::text, true);
  perform rpc_join(w, 'Ann');
  perform set_config('request.jwt.claims', json_build_object('sub', far)::text, true);
  perform rpc_join(w, 'Bo');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Cook');
  select floor(x)::int, floor(y)::int into v_x, v_y from player where world_id = w and uid = u;

  insert into said values ('STATION', station_name('oven'));

  -- The oven: none, then a cold one, then lit; and a lit brazier, which is a hearth but no oven.
  insert into said values ('OVEN:NONE', at_station(w, u, 'oven')::text);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'oven', v_x - 1, v_y - 1, 0, 0, v_x - 0.75, v_y - 0.75, 40, u) returning id into v_oven;
  insert into said values ('OVEN:COLD', at_station(w, u, 'oven')::text);
  update placed set lit = true, fuel = 600 where id = v_oven;
  insert into said values ('OVEN:LIT', at_station(w, u, 'oven')::text || '|' || at_station(w, u, 'campfire')::text);
  update placed set lit = false, fuel = 0 where id = v_oven;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, lit, fuel)
    values (w, 'furniture', 'brazier', v_x + 1, v_y, 0, 0, v_x + 1.5, v_y + 0.5, 40, u, true, 600) returning id into v_brazier;
  insert into said values ('BRAZIER', at_station(w, u, 'oven')::text || '|' || at_station(w, u, 'campfire')::text);

  -- The ferments, here only.
  insert into recipe (id, result, count, skill, label, verb, base_time, stamina, done)
    values ('test_ferment', 'pottage', 2, 'cooking', 'Seal to ferment', 'sealing', 5, 0, ''),
           ('test_cellar', 'pottage', 2, 'cooking', 'Seal to ferment', 'sealing', 5, 0, '');
  insert into recipe_input (recipe, ord, item, count) values
    ('test_ferment', 0, 'cabbage', 2), ('test_ferment', 1, 'clay_jar', 1),
    ('test_cellar', 0, 'cabbage', 2), ('test_cellar', 1, 'clay_jar', 1);
  create or replace function ferment_recipes() returns table (id text, title text, seconds double precision, vessel text, cellar boolean)
    language sql immutable as $fn$ select * from (values ('test_ferment', 'Pottage', ${SECS}::double precision, 'clay_jar', false),
      ('test_cellar', 'Cellar pottage', ${SECS}::double precision, 'clay_jar', true)) v (id, title, seconds, vessel, cellar) $fn$;

  v_cab := give(w, u, 'cabbage', 4, 50);
  perform give(w, u, 'clay_jar', 2, 30);
  insert into said values ('CELLAR:UP', coalesce(craft_refusal(w, u, 'test_cellar', null), 'ALLOWED'));
  update player set level = -1 where world_id = w and uid = u;
  insert into said values ('CELLAR:DOWN', coalesce(craft_refusal(w, u, 'test_cellar', null), 'ALLOWED'));
  update player set level = 0 where world_id = w and uid = u;
  insert into said values ('SEAL:NO', coalesce(craft_refusal(w, u, 'test_ferment', null), 'ALLOWED'));

  select max(n) into mark from event where world_id = w;
  perform perform_craft(w, u, 'test_ferment', jsonb_build_object('kind', 'item', 'uid', v_cab));
  select id into v_sealed from item where world_id = w and holder = 'player' and holder_uid = u and def = sealed_item();
  insert into said select 'SEALED', it.extra || '|' || (it.charges - world_time(w))::int || '|' || (it.ql > 0)::text
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'cabbage')
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'clay_jar')
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'pottage')
    from item it where it.id = v_sealed;
  insert into said select 'SEALED:TOLD', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.text like 'Sealed:%';

  insert into said values ('OPEN:SOON', coalesce(act_refusal(w, u, 'open_ferment', jsonb_build_object('kind', 'item', 'uid', v_sealed)), 'ALLOWED'));
  p := rpc_act(w, 'open_ferment', jsonb_build_object('kind', 'item', 'uid', v_sealed));
  insert into said values ('OPEN:DOOR', coalesce(p->>'why', '-'));
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  update item set charges = floor(world_time(w))::int - 1, ql = 44 where id = v_sealed;
  insert into said values ('OPEN:READY', coalesce(act_refusal(w, u, 'open_ferment', jsonb_build_object('kind', 'item', 'uid', v_sealed)), 'ALLOWED'));
  select max(n) into mark from event where world_id = w;
  perform act_perform(w, u, 'open_ferment', jsonb_build_object('kind', 'item', 'uid', v_sealed));
  insert into said select 'OPENED', (select count(*) from item where id = v_sealed)::text
    || '|' || (select string_agg(count || 'x' || round(ql::numeric, 0), ',') from item where world_id = w and holder = 'player' and holder_uid = u and def = 'pottage')
    || '|' || (select string_agg(count || 'x' || round(ql::numeric, 0), ',' order by ql) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'clay_jar');
  insert into said select 'OPENED:TOLD', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.kind = 'event';

  -- A dish for a group, here only: one beside the server, one far off.
  create or replace function serve_dishes() returns table (item text, serving text, count int, reach double precision)
    language sql immutable as $fn$ select 'pottage'::text, '${SERVE.serving}'::text, ${SERVE.count}::int, ${SERVE.reach}::double precision $fn$;
  update player set x = v_x + 2.5, y = v_y + 0.5, away = false, seen_at = now() where world_id = w and uid = near;
  update player set x = v_x + 12.5, y = v_y + 0.5, away = false, seen_at = now() where world_id = w and uid = far;
  delete from item where world_id = w and def = 'bread';
  select id into v_dish from item where world_id = w and holder = 'player' and holder_uid = u and def = 'pottage' limit 1;
  update item set count = 1, ql = 60 where id = v_dish;
  insert into said values ('SERVE:NO', coalesce(act_refusal(w, u, 'serve_dish', jsonb_build_object('kind', 'item', 'uid', v_dish)), 'ALLOWED'));
  select max(n) into mark from event where world_id = w;
  perform act_perform(w, u, 'serve_dish', jsonb_build_object('kind', 'item', 'uid', v_dish));
  insert into said select 'SERVED', (select count(*) from item where id = v_dish)::text
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'bread')
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = near and def = 'bread')
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = far and def = 'bread')
    || '|' || (select round(min(ql)::numeric, 0) from item where world_id = w and def = 'bread');
  insert into said select 'SERVED:TOLD', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = u and e.text like 'Served%';
  insert into said select 'SERVED:THEM', string_agg(e.text, ' / ' order by e.n) from event e
    where e.world_id = w and e.n > mark and e.uid = near and e.text like 'Served%';
end $t$;
select string_agg(k || '=' || coalesce(v, ''), E'\\n') from said;
rollback;
`);
const island = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1) ?? '(nothing)';

check('the oven station is named the same', island('STATION') === STATION_NAME.oven && STATION_NAME.oven === 'lit oven', island('STATION'));
check('on the island, no oven, or a cold one, is no oven station', island('OVEN:NONE') === 'false' && island('OVEN:COLD') === 'false', `${island('OVEN:NONE')} / ${island('OVEN:COLD')}`);
check('a lit oven is one, and a campfire too, as it was', island('OVEN:LIT') === 'true|true', island('OVEN:LIT'));
check('a lit brazier is a campfire and no oven', island('BRAZIER') === 'false|true', island('BRAZIER'));
check('a ferment wanting a cellar is refused above ground', island('CELLAR:UP') === FERMENT_CELLAR_SAYS, island('CELLAR:UP'));
check('and not for its cellar under it', island('CELLAR:DOWN') !== FERMENT_CELLAR_SAYS, island('CELLAR:DOWN'));
check('a ferment with what it wants is let through', island('SEAL:NO') === 'ALLOWED', island('SEAL:NO'));
const [sealedAs, readyIn, hasQl, cabLeft, jarLeft, potNow] = island('SEALED').split('|');
check('a go seals a vessel named for its result, ready in its seconds, the inputs and the vessel used up and nothing made yet',
  sealedAs === 'Pottage' && Math.abs(Number(readyIn) - SECS) <= 1 && hasQl === 'true' && cabLeft === '2' && jarLeft === '1' && potNow === '0', island('SEALED'));
check('and says so', island('SEALED:TOLD') === 'Sealed: pottage. Ready in 10m.', island('SEALED:TOLD'));
check('opened too soon, it says how long is left', island('OPEN:SOON') === fermentNotReady(SECS - 1) || island('OPEN:SOON') === fermentNotReady(SECS), island('OPEN:SOON'));
check('and the door says the same', island('OPEN:DOOR') === island('OPEN:SOON'), island('OPEN:DOOR'));
check('ready, it is let through', island('OPEN:READY') === 'ALLOWED', island('OPEN:READY'));
check('opened, it gives the result at its QL and the vessel back, and is gone',
  island('OPENED') === `0|2x44|1x${VESSEL_BACK_QL},1x30`, island('OPENED'));
check('and says so as a craft does', island('OPENED:TOLD') === madeSaid('pottage', 2, undefined, 44, ''), island('OPENED:TOLD'));
check('a group dish is let through', island('SERVE:NO') === 'ALLOWED', island('SERVE:NO'));
check('served, one share to the player in reach, none to the one out of it, the rest to the server, at its QL',
  island('SERVED') === `0|${SERVE.count - 1}|1|0|60`, island('SERVED'));
check('and says so to the server', island('SERVED:TOLD') === servedSays('pottage', 1, SERVE.count - 1), island('SERVED:TOLD'));
check('and to whoever was handed one', island('SERVED:THEM') === `Served to you: ${itemDef(SERVE.serving).name.toLowerCase()}, by Cook.`, island('SERVED:THEM'));

/* ---- the browser -------------------------------------------------------------------- */

const g = Game.create(4242);
const [px, py] = [g.player.tileX, g.player.tileY];
check('in the browser, no oven is no oven station', !g.atStation('oven'));
const oven = g.addFurniture('oven', px - 1, py - 1, 0, 0, 40);
check('a cold oven is none', !g.atStation('oven'));
oven.lit = true;
oven.fuel = 600;
check('a lit oven is one, and a campfire too, as on the island', g.atStation('oven') && g.atStation('campfire'));
oven.lit = false;
const brazier = g.addFurniture('brazier', px + 1, py, 0, 0, 40);
brazier.lit = true;
brazier.fuel = 600;
check('a lit brazier is a campfire and no oven, as on the island', !g.atStation('oven') && g.atStation('campfire'));

RECIPES.push(SEAL, CELLAR);
for (const it of [...g.inventory.items]) if (['cabbage', 'clay_jar', 'pottage', SEALED_ITEM].includes(it.id)) g.inventory.remove(it.uid, it.count);
const cab = g.inventory.add('cabbage', { count: 4, ql: 50 });
g.inventory.add('clay_jar', { count: 2, ql: 30 });
g.player.level = 0;
check('a ferment wanting a cellar is refused above ground, in the same words', recipeReason(CELLAR, g) === island('CELLAR:UP'), String(recipeReason(CELLAR, g)));
g.player.level = -1;
check('and not under it', recipeReason(CELLAR, g) !== FERMENT_CELLAR_SAYS, String(recipeReason(CELLAR, g)));
g.player.level = 0;
check('a ferment with what it wants is let through', recipeReason(SEAL, g) === null, String(recipeReason(SEAL, g)));
const seen = g.log.length;
recipeAction(SEAL).perform({ kind: 'item', uid: cab.uid }, g);
const sealed = g.inventory.items.find((it) => it.id === SEALED_ITEM);
const count = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
check('a go seals a vessel named for its result, ready in its seconds, the inputs and the vessel used up and nothing made yet',
  !!sealed && sealed.extra === 'Pottage' && Math.abs((sealed.charges ?? 0) - g.time - SECS) <= 1 && count('cabbage') === 2 && count('clay_jar') === 1 && count('pottage') === 0,
  JSON.stringify(sealed));
check('and says so as the island does', g.log.slice(seen).some((l) => l.text === island('SEALED:TOLD')), g.log.slice(seen).map((l) => l.text).join(' / '));
const open = ACTION_BY_ID.get(OPEN_FERMENT)!;
const at: Target = { kind: 'item', uid: sealed!.uid };
check('opened too soon, it says how long is left, as the island does', open.check?.(at, g) === island('OPEN:SOON'), String(open.check?.(at, g)));
sealed!.charges = Math.floor(g.time) - 1;
sealed!.ql = 44;
check('ready, it is let through', open.check?.(at, g) === null);
const seen2 = g.log.length;
open.perform(at, g);
const jars = g.inventory.items.filter((it) => it.id === 'clay_jar').map((it) => `${it.count}x${Math.round(it.ql)}`).sort().join(',');
const pots = g.inventory.items.filter((it) => it.id === 'pottage').map((it) => `${it.count}x${Math.round(it.ql)}`).join(',');
check('opened, it gives the result at its QL and the vessel back, and is gone, as on the island',
  `${g.inventory.get(sealed!.uid) ? 1 : 0}|${pots}|${jars}` === island('OPENED'), `${pots} / ${jars}`);
check('and says so as the island does', g.log.slice(seen2).some((l) => l.text === island('OPENED:TOLD')), g.log.slice(seen2).map((l) => l.text).join(' / '));

ITEM_DEFS.pottage.serve = SERVE;
for (const it of [...g.inventory.items]) if (it.id === 'bread' || it.id === 'pottage') g.inventory.remove(it.uid, it.count);
const dish = g.inventory.add('pottage', { ql: 60 });
g.folkAshore = [
  { uid: NEAR, name: 'Ann', online: true, x: g.player.x + 2, y: g.player.y },
  { uid: FAR, name: 'Bo', online: true, x: g.player.x + 12, y: g.player.y },
];
const serve = ACTION_BY_ID.get(SERVE_DISH)!;
check('a group dish is let through', serve.check?.({ kind: 'item', uid: dish.uid }, g) === null);
const seen3 = g.log.length;
serve.perform({ kind: 'item', uid: dish.uid }, g);
check('served, the server keeps the shares not handed out, at its QL, as on the island',
  !g.inventory.get(dish.uid) && count('bread') === SERVE.count - 1 && g.inventory.items.some((it) => it.id === 'bread' && Math.round(it.ql) === 60), String(count('bread')));
check('and says so as the island does', g.log.slice(seen3).some((l) => l.text === island('SERVED:TOLD')), g.log.slice(seen3).map((l) => l.text).join(' / '));
delete ITEM_DEFS.pottage.serve;

for (const l of [...ok, ...bad]) console.log(l);
console.log(`ovens, ferments and feasts — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
