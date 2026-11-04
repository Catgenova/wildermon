/**
 * Every liquid but lye and dye is drunk, out of a barrel, a well, a bucket or anything else that holds it.
 *
 * Asked for: "Allow drinking of water and other drinkable liquids from barrels, buckets, wells, and other containers.
 * Liquids like lyes and dyes cannot be drank." This asks of both sides, in the same words: a bucket of water and a
 * bucket of whey are drunk out of the pack, a litre a drink, the thirst they say; a bucket of lye and a bucket of dye
 * are not; a barrel of whey is drunk from and a barrel of lye or dye is not ("Not drinkable."); and the island's list
 * of drinkable liquids is the browser's.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { drinkable, UNDRINKABLE } from '../../src/game/brewing';
import { type PlacedFurniture } from '../../src/game/furniture';
import { DRINK_LITRES, itemDef, LIQUID_NAME, litresOf, type Item, type LiquidKind } from '../../src/game/items';
import { TileType } from '../../src/world/tiles';

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

const LIQUIDS = Object.keys(LIQUID_NAME) as LiquidKind[];
check('lye and dye, and nothing else, are not drunk', [...UNDRINKABLE].sort().join(',') === 'dye,lye'
  && LIQUIDS.every((l) => drinkable(l) === !UNDRINKABLE.has(l)), LIQUIDS.filter((l) => !drinkable(l)).join(','));
check('a bucket of water and a bucket of whey give a drink', (itemDef('water_bucket').drink ?? 0) > 0 && (itemDef('whey_bucket').drink ?? 0) > 0);
check('a bucket of lye and a bucket of dye give none', !itemDef('lye_bucket').drink && !itemDef('dye_bucket').drink);

/* ---- on the island -------------------------------------------------------------------------------------------- */

const NELL = 'd71c4a17-0000-4000-8000-0000000000d4';
const BUCKETS = ['water_bucket', 'whey_bucket', 'lye_bucket'];
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${NELL}'; v_it bigint; v_b bigint; v_bar bigint; r record;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Drinks', 181, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Nell');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 0.1, 'health', 1, 'stamina', 1)
   where world_id = w;
  perform land_set_tile(w, x, y, ${TileType.Grass}) from generate_series(0, 63) x, generate_series(0, 63) y;
  insert into said select 'DRINKABLE', string_agg(id, ',' order by id) from liquid_def where not drinkable;

  -- Out of the pack: a bucket of water, of whey, of lye.
  for r in select * from unnest(array[${BUCKETS.map((b) => `'${b}'`).join(', ')}]) b(def) loop
    update player set stats = stats || jsonb_build_object('thirst', 0.1) where world_id = w and uid = u;
    v_it := give(w, u, r.def, 1, 30);
    insert into said values (r.def || '_ASK', coalesce(act_refusal(w, u, 'drink_skin', jsonb_build_object('kind', 'item', 'uid', v_it)), 'none'));
    if act_refusal(w, u, 'drink_skin', jsonb_build_object('kind', 'item', 'uid', v_it)) is null then
      perform act_perform(w, u, 'drink_skin', jsonb_build_object('kind', 'item', 'uid', v_it));
    end if;
    insert into said select r.def, item_litres(it) || ' ' || round(((select stats->>'thirst' from player where world_id = w and uid = u)::numeric), 2)
      from item it where it.id = v_it;
  end loop;

  -- Out of a barrel beside you: whey, lye, dye.
  v_b := give(w, u, 'barrel', 1, 40);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_b, 'x', 11, 'y', 10, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_bar from placed where world_id = w and kind = 'furniture' and sub = 'barrel';
  for r in select * from unnest(array['whey', 'lye', 'dye']) l(liquid) loop
    update placed set liquid = r.liquid, litres = 20, ferment = 0 where id = v_bar;
    update player set stats = stats || jsonb_build_object('thirst', 0.1) where world_id = w and uid = u;
    insert into said values ('BARREL_' || r.liquid, coalesce(act_refusal(w, u, 'drink_from_vessel', jsonb_build_object('kind', 'furniture', 'id', v_bar)), 'none'));
  end loop;
  update placed set liquid = 'whey', litres = 20 where id = v_bar;
  perform act_perform(w, u, 'drink_from_vessel', jsonb_build_object('kind', 'furniture', 'id', v_bar));
  insert into said select 'BARREL_DRUNK', litres::text from placed where id = v_bar;
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('on the island: lye and dye, and nothing else, are not drunk', at('DRINKABLE') === [...UNDRINKABLE].sort().join(','), at('DRINKABLE'));

/* ---- in the browser ------------------------------------------------------------------------------------------- */

const g = Game.create(181, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number): Item => g.gather(id, { count: 1, ql });
const mine = new Map<string, string>();

for (const def of BUCKETS) {
  g.player.stats.thirst = 0.1;
  const it = thing(def, 30);
  const t = { kind: 'item', uid: it.uid } as Target;
  const offered = act('drink_skin').applies(t, g);
  mine.set(`${def}_ASK`, offered ? (act('drink_skin').check?.(t, g) ?? 'none') : 'not offered');
  if (offered) act('drink_skin').perform(t, g);
  const left = g.inventory.held(it.uid);
  mine.set(def, `${left ? litresOf(left) : 0} ${g.player.stats.thirst.toFixed(2)}`);
}
const barrelItem = thing('barrel', 40);
act('place_furniture').perform({ kind: 'tile', x: 11, y: 10, sx: 1, sy: 1, itemUid: barrelItem.uid, facing: 's' } as Target, g);
const bar = [...g.furniture.values()].find((p) => p.kind === 'barrel') as PlacedFurniture;
const bt = { kind: 'furniture', id: bar.id } as Target;
for (const liquid of ['whey', 'lye', 'dye'] as LiquidKind[]) {
  bar.liquid = liquid;
  bar.litres = 20;
  g.player.stats.thirst = 0.1;
  mine.set(`BARREL_${liquid}`, act('drink_from_vessel').check?.(bt, g) ?? 'none');
  check(`a barrel of ${liquid}: Drink ${UNDRINKABLE.has(liquid) ? 'not offered' : 'offered'}`, act('drink_from_vessel').applies(bt, g) === !UNDRINKABLE.has(liquid));
}
bar.liquid = 'whey';
bar.litres = 20;
act('drink_from_vessel').perform(bt, g);
mine.set('BARREL_DRUNK', String(bar.litres));

/* ---- what both say -------------------------------------------------------------------------------------------- */

const full = itemDef('water_bucket').charges ?? 0;
for (const def of ['water_bucket', 'whey_bucket']) {
  const want = `${full - DRINK_LITRES} ${Math.min(1, 0.1 + (itemDef(def).drink ?? 0)).toFixed(2)}`;
  check(`${itemDef(def).name}: drunk out of the pack, a litre gone and its thirst given (island)`, at(`${def}_ASK`) === 'none' && at(def) === want, `${at(`${def}_ASK`)} / ${at(def)}`);
  check(`${itemDef(def).name}: the same in the browser`, mine.get(`${def}_ASK`) === 'none' && mine.get(def) === want, `${mine.get(`${def}_ASK`)} / ${mine.get(def)}`);
}
check('bucket of lye: not drunk on the island, untouched', at('lye_bucket_ASK') !== 'none' && at('lye_bucket') === `${full} 0.10`, `${at('lye_bucket_ASK')} / ${at('lye_bucket')}`);
check('bucket of lye: not offered in the browser, untouched', mine.get('lye_bucket_ASK') === 'not offered' && mine.get('lye_bucket') === `${full} 0.10`, `${mine.get('lye_bucket_ASK')} / ${mine.get('lye_bucket')}`);
for (const liquid of ['whey', 'lye', 'dye']) {
  const want = UNDRINKABLE.has(liquid as LiquidKind) ? 'Not drinkable.' : 'none';
  check(`a barrel of ${liquid}: ${want === 'none' ? 'drunk from' : want}, both sides`, at(`BARREL_${liquid}`) === want && mine.get(`BARREL_${liquid}`) === want,
    `island "${at(`BARREL_${liquid}`)}", browser "${mine.get(`BARREL_${liquid}`)}"`);
}
check(`a barrel of whey drunk from: ${DRINK_LITRES} litre out, both sides`, at('BARREL_DRUNK') === String(20 - DRINK_LITRES) && mine.get('BARREL_DRUNK') === String(20 - DRINK_LITRES),
  `island ${at('BARREL_DRUNK')}, browser ${mine.get('BARREL_DRUNK')}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ndrinking from anything — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
