/**
 * Litres: every vessel holds litres, and anything that uses a liquid takes litres of it.
 *
 * Asked for: "any container can hold X liters. Anything that uses liquid will have a liter requirement. A bucket that
 * holds 5 liters of water would decrease by 1 liter each time 1 dough is made." This asks of both sides, on the same
 * makings, that a dough takes its litres out of a bucket of water and says what is left in its name and its weight;
 * that a bucket at its last litre is an empty bucket and a barrel beside you makes up the rest; that a bucket short of
 * full will not leach into lye; that a tanning takes its litres of lye; that a drink takes a litre and a bucket drunk
 * dry is empty; and that a part bucket poured into a barrel pours what is in it.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { type PlacedFurniture } from '../../src/game/furniture';
import { DRINK_LITRES, itemName, LITRE_KG, litresOf, TAN_LYE, unitWeight, type Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
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

const DOUGH = RECIPE_BY_ID.get('make_dough')!.inputs.find((i) => i.litres)!.litres!;
check(`a dough takes ${DOUGH} L water, a tanning ${TAN_LYE} L lye; a litre weighs ${LITRE_KG} kg`, DOUGH > 0 && TAN_LYE > 0 && LITRE_KG > 0);

/* ---- on the island -------------------------------------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000c3';
const item = (action: string, id: string): string => `perform act_perform(w, u, '${action}', jsonb_build_object('kind', 'item', 'uid', ${id}));`;
const say = (k: string, id: string): string => `insert into said select '${k}', it.def || '|' || item_name(it) || '|' || round(unit_weight(it)::numeric, 4) from item it where it.id = ${id};`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_flour bigint; v_w bigint; v_b bigint; v_bar bigint; v_hide bigint; v_lye bigint; v_milk bigint; v_part bigint; v_ash bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Litres', 179, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 0.1, 'health', 1, 'stamina', 1)
   where world_id = w;
  perform land_set_tile(w, x, y, ${TileType.Grass}) from generate_series(0, 63) x, generate_series(0, 63) y;
  insert into skill (world_id, uid, id, value) values (w, u, 'cooking', 90), (w, u, 'leatherworking', 90), (w, u, 'alchemy', 90)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- Dough out of a bucket of water, twice, and a third time short.
  v_flour := give(w, u, 'flour', 20, 40);
  v_w := give(w, u, 'water_bucket', 1, 30);
  ${say('W0', 'v_w')}
  ${item('make_dough', 'v_flour')}
  ${say('W1', 'v_w')}
  ${item('make_dough', 'v_flour')}
  ${say('W2', 'v_w')}
  insert into said values ('SHORT', coalesce(craft_refusal(w, u, 'make_dough', v_flour), 'none'));

  -- A barrel of water beside: the bucket's last litre, and the rest out of the barrel.
  v_b := give(w, u, 'barrel', 1, 40);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_b, 'x', 11, 'y', 10, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_bar from placed where world_id = w and kind = 'furniture' and sub = 'barrel';
  update placed set liquid = 'water', litres = 20, ferment = 0 where id = v_bar;
  insert into said values ('BARREL', coalesce(craft_refusal(w, u, 'make_dough', v_flour), 'none'));
  ${item('make_dough', 'v_flour')}
  ${say('W3', 'v_w')}
  insert into said select 'BAR', litres::text from placed where id = v_bar;
  update placed set litres = 0, liquid = null where id = v_bar;

  -- A bucket short of full does not leach into lye.
  v_w := give(w, u, 'water_bucket', 1, 30);
  update item set charges = 3 where id = v_w;
  v_ash := give(w, u, 'ash', 4, 30);
  insert into said values ('LYE', coalesce(craft_refusal(w, u, 'make_lye', v_ash), 'none'));
  delete from item where id in (v_w, v_ash);

  -- Tanning: its litres of lye.
  v_hide := give(w, u, 'hide', 1, 40);
  perform give(w, u, 'carving_knife', 1, 40);
  v_lye := give(w, u, 'lye_bucket', 1, 40);
  ${item('tan_hide', 'v_hide')}
  ${say('TAN', 'v_lye')}

  -- Drinking a bucket of milk dry.
  v_milk := give(w, u, 'milk_bucket', 1, 40);
  update item set charges = 2 where id = v_milk;
  ${item('drink_skin', 'v_milk')}
  ${say('DRINK1', 'v_milk')}
  ${item('drink_skin', 'v_milk')}
  ${say('DRINK2', 'v_milk')}

  -- A part bucket of water poured into the barrel.
  v_part := give(w, u, 'water_bucket', 1, 30);
  update item set charges = 3 where id = v_part;
  ${item('pour_into_barrel', 'v_part')}
  ${say('POUR', 'v_part')}
  insert into said select 'POURED', litres::text from placed where id = v_bar;
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ------------------------------------------------------------------------------------------- */

const g = Game.create(179, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
g.player.stats.thirst = 0.1;
for (const s of ['cooking', 'leatherworking', 'alchemy']) g.skills.values.set(s, 90);
g.rand = () => 0.01;
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, n = 1): Item => g.gather(id, { count: n, ql });
const target = (it: Item): Target => ({ kind: 'item', uid: it.uid } as Target);
const use = (action: string, it: Item): void => { act(action).perform(target(it), g); };
const says = (it: Item): string => `${it.id}|${itemName(it)}|${unitWeight(it).toFixed(4)}`;
const said = new Map<string, string>();

const flour = thing('flour', 40, 20);
let water = thing('water_bucket', 30);
said.set('W0', says(water));
use('make_dough', flour);
said.set('W1', says(water));
use('make_dough', flour);
said.set('W2', says(water));
said.set('SHORT', act('make_dough').check?.(target(flour), g) ?? 'none');
const barrelItem = thing('barrel', 40);
act('place_furniture').perform({ kind: 'tile', x: 11, y: 10, sx: 1, sy: 1, itemUid: barrelItem.uid, facing: 's' } as Target, g);
const bar = [...g.furniture.values()].find((p) => p.kind === 'barrel') as PlacedFurniture;
bar.liquid = 'water';
bar.litres = 20;
said.set('BARREL', act('make_dough').check?.(target(flour), g) ?? 'none');
use('make_dough', flour);
said.set('W3', says(water));
said.set('BAR', String(bar.litres));
bar.litres = 0;
bar.liquid = undefined;

water = thing('water_bucket', 30);
water.charges = 3;
const ash = thing('ash', 30, 4);
said.set('LYE', act('make_lye').check?.(target(ash), g) ?? 'none');
g.inventory.remove(water.uid, 1);
g.inventory.remove(ash.uid, 4);

const hide = thing('hide', 40);
thing('carving_knife', 40);
const lye = thing('lye_bucket', 40);
use('tan_hide', hide);
said.set('TAN', says(lye));

const milk = thing('milk_bucket', 40);
milk.charges = 2;
use('drink_skin', milk);
said.set('DRINK1', says(milk));
use('drink_skin', milk);
said.set('DRINK2', says(milk));

const part = thing('water_bucket', 30);
part.charges = 3;
use('pour_into_barrel', part);
said.set('POUR', says(part));
said.set('POURED', String(bar.litres));

/* ---- what both say -------------------------------------------------------------------------------------------- */

const both = (k: string, what: string, want?: (v: string) => boolean): void => {
  const here = said.get(k) ?? '(not said)';
  check(`${what}: “${here}”${isle.get(k) === here ? ', the same on both sides' : ''}`, isle.get(k) === here && (!want || want(here)), `island “${at(k)}”`);
};
const w0 = (litres: number): string => `${(1.6 + litres * LITRE_KG).toFixed(4)}`;
both('W0', 'a full bucket of water: 5 L, weighing what it did', (v) => v === `water_bucket|Bucket of water (5 L)|${w0(5)}`);
both('W1', `a dough out of it: ${5 - DOUGH} L left, and lighter`, (v) => v === `water_bucket|Bucket of water (${5 - DOUGH} L)|${w0(5 - DOUGH)}`);
both('W2', `another: ${5 - 2 * DOUGH} L left`, (v) => v === `water_bucket|Bucket of water (${5 - 2 * DOUGH} L)|${w0(5 - 2 * DOUGH)}`);
check(`a third with ${5 - 2 * DOUGH} L is refused on both sides`, at('SHORT') !== 'none' && said.get('SHORT') !== 'none', `${at('SHORT')} / ${said.get('SHORT')}`);
check('with a barrel of water beside, it is not', at('BARREL') === 'none' && said.get('BARREL') === 'none', `${at('BARREL')} / ${said.get('BARREL')}`);
both('W3', 'and the bucket at its last litre is an empty bucket', (v) => v.startsWith('bucket|Bucket|'));
both('BAR', `the barrel made up the rest: ${20 - (DOUGH - (5 - 2 * DOUGH))} L left`, (v) => v === String(20 - (DOUGH - (5 - 2 * DOUGH))));
check('a bucket short of full does not leach into lye, on both sides', at('LYE') !== 'none' && said.get('LYE') !== 'none', `${at('LYE')} / ${said.get('LYE')}`);
both('TAN', `a hide tanned: ${5 - TAN_LYE} L lye left`, (v) => v.startsWith(`lye_bucket|Bucket of lye (${5 - TAN_LYE} L)|`));
both('DRINK1', `a drink: ${2 - DRINK_LITRES} L left`, (v) => v.startsWith(`milk_bucket|Bucket of milk (${2 - DRINK_LITRES} L)|`));
both('DRINK2', 'drunk dry: an empty bucket', (v) => v.startsWith('bucket|Bucket|'));
both('POUR', 'a part bucket poured: empty', (v) => v.startsWith('bucket|Bucket|'));
both('POURED', 'and the barrel took its 3 L, no more', (v) => v === '3');
check('the browser reads a bucket with no litres on it as full', litresOf({ id: 'water_bucket' }) === 5);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nlitres — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
