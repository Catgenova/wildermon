/**
 * One of every tool, QL 20, issued; kept through a death; given again when missing.
 *
 * Reported with a screenshot of an empty pack: "Players spawn with no tools at
 * all. They should spawn with one of each, 20ql, unimproveable".
 *
 * Asked of both sides:
 *   * the kit is one of every tool an action, recipe, build, bridge or
 *     improvement asks for but the frying pan and clay vessels ("Remove clay
 *     bowl, pot, jar, frying pan from starter tools."), at QL 20 (the water skin at 30), the same list in
 *     the browser and on the island;
 *   * coming ashore gives all of it, issued, and the stake;
 *   * an issued tool cannot be improved;
 *   * a death leaves the issued tools on the body and buries the rest;
 *   * a kit tool held in no issued copy is given again on coming ashore and on
 *     waking from a death, once; nothing is given twice.
 *
 * Everything the island does is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { barterPutRefusal, barterSaid } from '../../src/game/barter';
import { KIT_LEFT_OUT, KIT_QL, STARTER_KIT } from '../../src/game/game';
import { Inventory, itemName } from '../../src/game/items';
import { fitsOrder } from '../../src/game/orders';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

const MIRA = '00000000-0000-4000-8000-00000000a1c1';

/* ---- the list ----------------------------------------------------------------- */
const asked = psql(`select string_agg(distinct t, ',' order by t) from (
  select tool t from build_material_def union select tool from improve_tool union select tool from action_def
  union select tool from recipe union select tool from bridge_def) x where t is not null;`).split(',');
const kitIds = STARTER_KIT.map(([id]) => id);
const wanted = asked.filter((t) => !KIT_LEFT_OUT.includes(t));
check('the browser kit has one of every tool the island asks for but the cooking vessels', wanted.every((t) => kitIds.includes(t)),
  wanted.filter((t) => !kitIds.includes(t)).join(',') || `${wanted.length} tools`);
check('and none of the cooking vessels', KIT_LEFT_OUT.every((t) => asked.includes(t) && !kitIds.includes(t)), KIT_LEFT_OUT.join(','));
check('and one of each only', new Set(kitIds).size === kitIds.length);
check(`every tool at QL ${KIT_QL}, the water skin at 30`,
  STARTER_KIT.every(([id, ql]) => ql === (id === 'water_skin' ? 30 : 20)) && KIT_QL === 20);

/* ---- the island --------------------------------------------------------------- */
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Kit', 175, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into said select 'KIT', string_agg(def || ':' || ql::int || ':' || issued::text, ',' order by def)
    from item where world_id = w and holder_uid = u and def <> 'deed_stake';
  insert into said select 'STAKE', count(*)::text from item where world_id = w and holder_uid = u and def = 'deed_stake';
  select id into v_id from item where world_id = w and holder_uid = u and def = 'hatchet';
  insert into said values ('IMPROVE', coalesce(item_refusal(w, u, 'improve_item', jsonb_build_object('uid', v_id::text)), '-'));

  -- A log in the pack, then a death.
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'log', 30);
  update player set x = 20.5, y = 20.5 where world_id = w and uid = u;
  perform player_die(w, u);
  insert into said select 'AFTER', count(*) filter (where issued)::text || '|' || count(*) filter (where def = 'log')::text
    from item where world_id = w and holder_uid = u and holder = 'player';
  insert into said select 'GRAVE', coalesce(string_agg(i.def, ',' order by i.def), '-') from item i join placed p on p.id = i.placed
   where i.world_id = w and p.sub = 'grave';

  -- A kit tool lost, then coming ashore again: given once.
  delete from item where world_id = w and holder_uid = u and def = 'saw';
  perform rpc_join(w, 'Mira');
  perform rpc_join(w, 'Mira');
  insert into said select 'SAW', count(*)::text || '|' || min(ql)::int::text || '|' || bool_and(issued)::text
    from item where world_id = w and holder_uid = u and def = 'saw';
  insert into said select 'TOTAL', count(*)::text from item where world_id = w and holder_uid = u and issued;
  -- A kit tool put down out of the pack (a store, the ground) and coming ashore again: not given again.
  update item set holder = 'ground', holder_uid = null, gx = 16, gy = 16 where world_id = w and holder_uid = u and def = 'pickaxe';
  perform rpc_join(w, 'Mira');
  perform rpc_join(w, 'Mira');
  insert into said select 'PUTDOWN', count(*) filter (where holder_uid = u)::text || '|' || count(*)::text
    from item where world_id = w and def = 'pickaxe' and issued;
  -- And one given with nobody calling (a death on the clock) says whose it is.
  perform set_config('request.jwt.claims', '', true);
  delete from item where world_id = w and holder_uid = u and def = 'awl';
  perform kit_topup(w, u);
  insert into said select 'WHOSE', bool_and(origin_uid = u)::text from item where world_id = w and def = 'awl' and issued;
  update item set holder = 'ground', holder_uid = null, gx = 16, gy = 16 where world_id = w and holder_uid = u and def = 'awl';
  perform kit_topup(w, u);
  insert into said select 'AWL', count(*)::text from item where world_id = w and def = 'awl' and issued;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into said select 'DOOR', has_function_privilege('authenticated', 'kit_topup(uuid,uuid)', 'execute')::text;

  -- Not sold or traded: a barter side, a deal, a stall price, an order.
  select id into v_id from item where world_id = w and holder_uid = u and def = 'hatchet' and issued;
  insert into said values ('BARTER', coalesce(barter_thing_refusal(w, u, v_id, 1, null), '-'));
  insert into player (world_id, uid, name, x, y, stats) values (w, '00000000-0000-4000-8000-00000000a1c2', 'Otto', 16.5, 16.5, '{}');
  insert into said values ('DEAL', coalesce(rpc_deal(w, '00000000-0000-4000-8000-00000000a1c2', array[v_id], 0, 0)->>'why', '-'));
  insert into said values ('PRICE', coalesce(rpc_price(w, v_id, 5)->>'why', '-'));
  insert into said select 'FITS', count(*)::text from order_fits(w, u, 'hatchet', 1);
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'hatchet', 25);
  insert into said select 'FITS2', count(*)::text || '|' || bool_or(issued)::text from order_fits(w, u, 'hatchet', 1);
  insert into said values ('SAID', barter_said('starter'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

const want = [...STARTER_KIT].map(([id, ql]) => `${id}:${ql}:true`).sort().join(',');
check('coming ashore gives the browser kit, every piece issued, at its QL', at('KIT') === want, at('KIT'));
check('and the stake', at('STAKE') === '1', at('STAKE'));
check('an issued tool cannot be improved', /cannot be improved/i.test(at('IMPROVE')), at('IMPROVE'));
check('a death leaves every issued tool on the body and buries the rest', at('AFTER') === `${STARTER_KIT.length}|0`, at('AFTER'));
check('the grave holds the log and the stake, and no kit tool', at('GRAVE').split(',').sort().join(',') === 'deed_stake,log', at('GRAVE'));
check(`a lost kit tool is given again on coming ashore, once, at QL ${KIT_QL}, issued`, at('SAW') === `1|${KIT_QL}|true`, at('SAW'));
check('nothing given twice', at('TOTAL') === String(STARTER_KIT.length), at('TOTAL'));
check('a kit tool put down out of the pack is still yours: coming ashore twice gives no other', at('PUTDOWN') === '0|1', at('PUTDOWN'));
check('one given with nobody calling is marked as yours, and put down is not given again', at('WHOSE') === 'true' && at('AWL') === '1', `${at('WHOSE')} / ${at('AWL')}`);
check('a player cannot call the top-up', at('DOOR') === 'false', at('DOOR'));

const STARTER = barterSaid('starter');
check('the island says it in the browser\'s words', at('SAID') === STARTER, at('SAID'));
check('a starter tool does not go on a side of a barter', at('BARTER') === STARTER, at('BARTER'));
check('or in a deal', at('DEAL') === STARTER, at('DEAL'));
check('or take a price on a stall', at('PRICE') === STARTER, at('PRICE'));
check('or fill an order; one of your own making does', at('FITS') === '0' && at('FITS2') === '1|false', `${at('FITS')} / ${at('FITS2')}`);

/* ---- the browser's side -------------------------------------------------------- */
const inv = new Inventory();
const kitHatchet = inv.add('hatchet', { ql: 20, issued: true, extra: 'Copper' });
const made = inv.add('hatchet', { ql: 25, extra: 'Copper' });
check('a starting-kit tool is called a Starter (tool)', itemName(kitHatchet).startsWith('Starter hatchet') && !itemName(made).startsWith('Starter'),
  `${itemName(kitHatchet)} / ${itemName(made)}`);
check('the browser keeps it off a barter side in the same words', barterPutRefusal(kitHatchet, false, 1, 'Mira') === STARTER);
check('and off an order', !fitsOrder(kitHatchet, { def: 'hatchet', ql: 1 }, false) && fitsOrder(made, { def: 'hatchet', ql: 1 }, false));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`one of every tool — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
