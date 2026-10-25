/**
 * Everything on a crate rack in one window, and taken out of it across crates.
 *
 * Asked for, off a full rack of eight rows all reading "Seeds": "is it
 * possible to just condense the inventory instead of having to go through
 * each box? I do like being able to separate, but I get lost pretty easily."
 *
 * The rack's Open all lists every pile on it as the pack would pile it
 * (`rackStock`, by `sameStack`; `stack_key` on the island), with the spots it
 * stands on; a count taken from a line comes out of its rows in the rack's
 * order until the count is met (`rackTakes`), one `take_from_store` a row —
 * no door of its own. The rack's menu names each crate by its spot and what
 * it holds (`crateHolds`).
 *
 * The same rack is built on both sides: three plank crates on its first three
 * spots, the middle one somebody else's. The listing is held against the
 * island's own grouping of those rows, and each take is planned once in the
 * browser and then asked of both, row by row, through the same door: after
 * each, what is left in each crate and what is in the pack, on both sides.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it,
 * off his deed so that a crate somebody else set down is not his to empty.
 * Touches only its own tile.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { crateHolds, crateShut, rackSpotOf, rackStock, rackTakes, type PlacedCrate } from '../../src/game/crates';
import { furnitureCentre, rackDeck } from '../../src/game/furniture';
import { itemDef, type Item } from '../../src/game/items';

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

const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const asDane = `select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false);`;

// Off Dane's deed (Hoarding stands at 30,30), and clear of the tile `rackput` uses.
const X = 44;
const Y = 40;
// What each crate holds, in the rack's order: [def, ql, count]. The second is somebody else's.
const HOLDS: Array<Array<[string, number, number]>> = [
  [['cotton_seed', 20, 30], ['wheat_seed', 20, 10]],
  [['cotton_seed', 30, 8]],
  [['cotton_seed', 40, 25], ['wheat_seed', 20, 5]],
];
const THEIRS = 1;

const game = Game.create(4242);
game.crates.clear();
const rack = game.addFurniture('crate_shelf', X, Y, 0, 0, 20);
const deck = rackDeck(rack);
const [cx, cy] = furnitureCentre(rack);
game.player.x = cx + 0.05;
game.player.y = cy - 0.1;

const WAS = psql(`select x || ',' || y from player where world_id = ${W} and name = 'Dane'`);
const BASE = Number(psql(`select coalesce(max(id), 0) + 1 from crate where world_id = ${W}`));

const tidy = `
  delete from item i using crate c where i.world_id = c.world_id and i.holder = 'crate' and i.crate = c.id
    and c.world_id = ${W} and c.x = ${X} and c.y = ${Y};
  delete from crate where world_id = ${W} and x = ${X} and y = ${Y};
  delete from placed where world_id = ${W} and kind = 'furniture' and sub = 'crate_shelf' and x = ${X} and y = ${Y};
  delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('cotton_seed', 'wheat_seed');`;

// The island's rows, made first so the browser's can carry the same uids: a plan made here names rows there.
const ids = psql(`
${tidy}
insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by, ql)
  values (${W}, 'furniture', 'crate_shelf', ${X}, ${Y}, 0, 0, ${cx}, ${cy}, ${DANE}, 20);
${HOLDS.map((_, n) => `
insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by, material)
  values (${W}, ${BASE + n}, 'plank', ${X}, ${Y}, ${deck[n][0]}, ${deck[n][1]}, false,
          ${n === THEIRS ? `'99999999-9999-9999-9999-999999999999'` : DANE}, 'pine');`).join('')}
update player set body_at = now(), x = ${game.player.x}, y = ${game.player.y}, level = 0 where world_id = ${W} and uid = ${DANE};
with made as (
  insert into item (world_id, holder, crate, def, ql, count)
  values ${HOLDS.flatMap((rows, n) => rows.map(([def, ql, count]) => `(${W}, 'crate', ${BASE + n}, '${def}', ${ql}, ${count})`)).join(', ')}
  returning id, crate, def)
select string_agg(id::text, ',' order by crate, id) from made;`).split('\n').pop() ?? '';
const uids = ids.split(',').map(Number);

let next = 0;
const crates: PlacedCrate[] = HOLDS.map((rows, n) => {
  const items: Item[] = rows.map(([id, ql, count]) => ({ uid: uids[next++], id, ql, dmg: 0, count }));
  const c = game.addCrate('plank', X, Y, deck[n][0], deck[n][1], items, false, 'pine');
  if (n === THEIRS) c.mine = false;
  return c;
});
game.inventory.nextUid = Math.max(game.inventory.nextUid, ...uids) + 1000;
game.inventory.items = game.inventory.items.filter((it) => it.id !== 'cotton_seed' && it.id !== 'wheat_seed');

check('the same rack on both sides',
  crates.map((c) => rackSpotOf(rack, c)).join(',') === '1,2,3' && uids.length === HOLDS.flat().length,
  `spots ${crates.map((c) => rackSpotOf(rack, c)).join(',')}, ${uids.length} rows`);

/* ---- the rack's menu: each crate by what is in it ------------------------- */
const name = (def: string): string => itemDef(def).name;
check('a crate says the kinds it holds most of, the most first',
  crateHolds(crates[0]) === `${name('cotton_seed')} 30 · ${name('wheat_seed')} 10`, String(crateHolds(crates[0])));
{
  const many = game.addCrate('plank', X + 1, Y, 0, 0, [
    { uid: game.inventory.nextUid++, id: 'iron_ore', ql: 20, dmg: 0, count: 3 },
    { uid: game.inventory.nextUid++, id: 'wheat_seed', ql: 20, dmg: 0, count: 9 },
    { uid: game.inventory.nextUid++, id: 'cotton_seed', ql: 20, dmg: 0, count: 4 },
    { uid: game.inventory.nextUid++, id: 'rock_shards', ql: 20, dmg: 0, count: 1 },
  ]);
  check('and how many kinds more past the two it names',
    crateHolds(many) === `${name('wheat_seed')} 9 · ${name('cotton_seed')} 4 · +2`, String(crateHolds(many)));
  game.crates.delete(many.id);
}

/* ---- the listing: one line a pile, across the crates ---------------------- */
const theirLines = (): string => psql(`
  select string_agg(def || ' ' || n, ',' order by def) from (
    select min(i.def) as def, sum(i.count)::int as n from item i join crate c on c.world_id = i.world_id and c.id = i.crate
     where i.world_id = ${W} and i.holder = 'crate' and c.x = ${X} and c.y = ${Y}
     group by stack_key(i)) piles`);
const myLines = (): string => rackStock(game, rack).map((l) => `${l.item.id} ${l.item.count}`).sort().join(',');
check('the listing piles the rows as the island does', myLines() === theirLines() && myLines() === 'cotton_seed 63,wheat_seed 15',
  `browser ${myLines()}, island ${theirLines()}`);
const cotton = (): ReturnType<typeof rackStock>[number] | undefined => rackStock(game, rack).find((l) => l.item.id === 'cotton_seed');
const line = cotton();
check('each line says the spots its rows stand on, in the rack\'s order', line?.spots.join(',') === '1,2,3', line?.spots.join(','));
const ql = (30 * 20 + 8 * 30 + 25 * 40) / 63;
check('and its quality by the unit', Math.abs((line?.item.ql ?? 0) - ql) < 1e-9, `${line?.item.ql} against ${ql}`);

/* ---- taking a count across the crates ------------------------------------- */
const def = ACTION_BY_ID.get('take_from_store');
if (!def) throw new Error('there is no take_from_store');
const said: string[] = [];
game.logMsg = ((text: string) => { said.push(text); }) as Game['logMsg'];

const theirCrates = (): string => psql(`
  select string_agg(coalesce((select sum(i.count) from item i where i.world_id = c.world_id and i.holder = 'crate' and i.crate = c.id and i.def = d.def), 0)::text, ',' order by d.def, c.id)
    from crate c, (values ('cotton_seed'), ('wheat_seed')) d(def) where c.world_id = ${W} and c.x = ${X} and c.y = ${Y}`);
const myCrates = (): string => ['cotton_seed', 'wheat_seed']
  .flatMap((d) => crates.map((c) => c.items.filter((it) => it.id === d).reduce((n, it) => n + it.count, 0))).join(',');
const theirPack = (d: string): string =>
  psql(`select coalesce(sum(count), 0) from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def = '${d}'`);
const theirRefusal = (uid: number, count: number): string =>
  psql(`select coalesce(act_refusal(${W}, ${DANE}, 'take_from_store', jsonb_build_object('kind', 'item', 'uid', ${uid}, 'count', ${count})), 'ALLOWED')`);

const take = (id: string, count: number): Array<{ uid: number; count: number }> => {
  const l = rackStock(game, rack).find((x) => x.item.id === id);
  if (!l) throw new Error(`no line of ${id}`);
  const plan = rackTakes(game, l, count);
  for (const step of plan) {
    const t: Target = { kind: 'item', uid: step.uid, count: step.count };
    const mine = def.check?.(t, game) ?? 'ALLOWED';
    const theirs = theirRefusal(step.uid, step.count);
    check(`${step.count} of row ${step.uid} is allowed`, mine === 'ALLOWED' && theirs === 'ALLOWED', `browser "${mine}", island "${theirs}"`);
    def.perform?.(t, game);
    psql(`${asDane} select rpc_act(${W}, 'take_from_store', jsonb_build_object('kind', 'item', 'uid', ${step.uid}, 'count', ${step.count}), 1);`);
  }
  return plan;
};

// Forty cotton: the thirty in the first crate, the second passed over (not his), ten of the third's twenty-five.
const p1 = take('cotton_seed', 40);
check('forty come from the rows in the rack\'s order, passing over the crate that is not yours',
  p1.map((s) => s.count).join(',') === '30,10' && myCrates() === theirCrates() && myCrates() === '0,8,15,10,0,5',
  `plan ${p1.map((s) => s.count).join(',')}; browser ${myCrates()}, island ${theirCrates()}`);
check('and the forty are one pile in the pack', game.inventory.count('cotton_seed') === 40 && theirPack('cotton_seed') === '40'
  && game.inventory.items.filter((it) => it.id === 'cotton_seed').length === 1,
  `browser ${game.inventory.count('cotton_seed')}, island ${theirPack('cotton_seed')}`);

// Twenty wheat of fifteen on the rack: the fifteen there are, from two crates.
const p2 = take('wheat_seed', 20);
check('more than the line holds takes the line', p2.map((s) => s.count).join(',') === '10,5'
  && myCrates() === theirCrates() && myCrates() === '0,8,15,0,0,0' && game.inventory.count('wheat_seed') === 15 && theirPack('wheat_seed') === '15',
  `plan ${p2.map((s) => s.count).join(',')}; browser ${myCrates()} / ${game.inventory.count('wheat_seed')}, island ${theirCrates()} / ${theirPack('wheat_seed')}`);
check('and a line with nothing left goes from the listing', !rackStock(game, rack).some((l) => l.item.id === 'wheat_seed') && myLines() === theirLines(),
  `browser ${myLines()}, island ${theirLines()}`);

// The rest of the cotton he may have: the fifteen in the third crate, and the second's still passed over.
const p3 = take('cotton_seed', 23);
check('the rest is the rows he may take', p3.map((s) => s.count).join(',') === '15' && myCrates() === theirCrates() && myCrates() === '0,8,0,0,0,0',
  `plan ${p3.map((s) => s.count).join(',')}; browser ${myCrates()}, island ${theirCrates()}`);

// And then only somebody else's is left: nothing to plan, and why, in the island's words.
const left = cotton();
const plan = left ? rackTakes(game, left, left.item.count) : [];
const row = left?.rows[0];
const mine = row ? crateShut(game, row.crate) : null;
const theirs = row ? theirRefusal(row.item.uid, row.item.count) : '';
check('a line only in a crate shut to you plans nothing, and says why as the island does',
  !plan.length && !!mine && mine === theirs, `${plan.length} steps; browser "${mine}", island "${theirs}"`);

// Tidied away, and Dane back where he stood.
psql(`${tidy}
  update player set body_at = now(), x = ${WAS.split(',')[0]}, y = ${WAS.split(',')[1]} where world_id = ${W} and uid = ${DANE};`);

for (const l of [...ok, ...bad]) console.log(l);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`everything on a rack in one list, taken across its crates, the same on both sides — ${ok.length} of ${ok.length}`);
