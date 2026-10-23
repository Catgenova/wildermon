/**
 * Fruit, bushes and forage keep their seasons, the same on both sides.
 *
 * Asked for: each fruit tree, berry bush and seasonal wild forage fruits in
 * its own seasons, in one table (`src/game/fruiting.ts`); out of season
 * picking it gives nothing, refused in words that say when it next fruits,
 * the same on both sides; Examine says its seasons and whether it is in
 * season now; under glass everything fruits in every season; and before the
 * first spring everything fruits, as it always had.
 *
 * So this asks:
 *
 *   * the numbers are the same numbers: the island's table is the browser's,
 *     item for item, and so is every sentence it says;
 *   * the season fruiting goes by is counted the same at moments round the
 *     turns of the year, and before the first spring there is none and
 *     everything fruits on both sides, as it does under glass;
 *   * in each of the four seasons -- held on the island for a transaction
 *     that is rolled back (`wurm.season`), the clock stood still at a moment
 *     of it in the browser -- four trees picked and two bushes cut on both
 *     sides: refused out of season in the same words, and in season the same
 *     fruit, said the same way, and Examine saying the same of each;
 *   * the forage tables rolled from end to end on both sides turn up what is
 *     in season and nothing else, and a go of foraging on each finds only that;
 *   * and a plucka would climb a tree in its season and not out of it.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { BOTANIZE_TABLE, BOTANIZE_WATER_TABLE, FORAGE_TABLE, rollTable } from '../../src/game/forage';
import {
  FRUITING, fruitingSays, fruitSeason, fruitsAt, fruitsIn, inSeason, nextFruiting, outOfSeasonSaid,
} from '../../src/game/fruiting';
import { SEASON_DAYS, SEASONS, yearOf, YEAR_DAYS, YEAR_FROM, type Season } from '../../src/world/calendar';
import { DAY_SECONDS } from '../../src/game/pace';
import { BUSH_DEFS, packTreeData, TileType, TREE_AGES, TREE_DEFS } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
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
const q = (v: string): string => `'${v.replace(/'/g, "''")}'`;
/** Lines of `KEY|value` out of a psql run, by key. */
const lines = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));

/* ---- the numbers ----------------------------------------------------------- */

const items = Object.keys(FRUITING);
const theirTable = psql(`select string_agg(i || ':' || coalesce(array_to_string(fruiting_seasons(i), ','), '-'), ' ' order by i)
  from unnest(array[${items.map(q).join(', ')}, 'potato', 'wheat_seed']) i`);
const myTable = [...items, 'potato', 'wheat_seed'].sort().map((i) => `${i}:${FRUITING[i]?.join(',') ?? '-'}`).join(' ');
check(`the island's table is the browser's: ${items.length} things that keep a season, and a potato and wheat seed that do not`,
  theirTable === myTable, `island ${theirTable}\nbrowser ${myTable}`);

/** Everything a tree bears or a bush is cut for: what has refusals and an Examine line. */
const BORNE = [...new Set([...TREE_DEFS.map((t) => t.fruit), ...BUSH_DEFS.map((b) => b.yields)].filter((id): id is string => !!id))];
{
  const pairs = BORNE.flatMap((id) => [...SEASONS, null].map((s) => [id, s] as const));
  const out = psql(`select string_agg(coalesce(fruit_out_said(i, s), '-') || '#' || fruit_says(i, s), E'\\n' order by o)
    from unnest(array[${pairs.map(([i]) => q(i)).join(', ')}], array[${pairs.map(([, s]) => (s ? q(s) : 'null')).join(', ')}]::text[])
      with ordinality u(i, s, o)`).split('\n');
  const mine = pairs.map(([id, s]) => `${s && !fruitsIn(id, s) ? outOfSeasonSaid(id, s) : '-'}#${fruitingSays(id, s)}`);
  const differ = mine.map((m, k) => (m === out[k] ? '' : `${pairs[k].join(':')}: island "${out[k]}", browser "${m}"`)).filter(Boolean);
  check(`and so is every sentence: ${pairs.length} refusals and Examine lines, ${BORNE.length} things in four seasons and before the first spring`,
    !differ.length, differ.slice(0, 3).join('; '));
}

/* ---- the season ------------------------------------------------------------ */

const DAY = DAY_SECONDS;
{
  // Round every turn of two years, either side of the second, and before the first spring.
  const moments: number[] = [];
  for (let d = -2 * SEASON_DAYS; d <= 2 * YEAR_DAYS; d += SEASON_DAYS) moments.push(YEAR_FROM + d * DAY - 1, YEAR_FROM + d * DAY, YEAR_FROM + d * DAY + DAY / 2);
  const theirs = psql(`select string_agg(coalesce(fruit_season(to_timestamp(a)), '-') || ':' || fruits_now('apple', to_timestamp(a))
      || ':' || fruits_now('cherry', to_timestamp(a)) || ':' || fruits_now('cherry', to_timestamp(a), true), ' ' order by o)
    from unnest(array[${moments.join(',')}]::double precision[]) with ordinality u(a, o)`);
  const mine = moments.map((t) => `${fruitSeason(t) ?? '-'}:${fruitsAt('apple', t)}:${fruitsAt('cherry', t)}:${fruitsAt('cherry', t, true)}`).join(' ');
  check(`the season fruiting goes by is the same at ${moments.length} moments round the turns, on both sides`, theirs === mine, `island ${theirs}\nbrowser ${mine}`);
  const before = YEAR_FROM - DAY;
  check('and before the first spring there is none, and everything bears on both sides',
    fruitSeason(before) === null && items.every((i) => fruitsAt(i, before))
      && psql(`select bool_and(fruits_now(i, to_timestamp(${before}))) and fruit_season(to_timestamp(${before})) is null from unnest(array[${items.map(q).join(', ')}]) i`) === 't');
  check('and under glass everything bears in every season, on both sides',
    SEASONS.every((s) => items.every((i) => fruitsIn(i, s, true)))
      && psql(`select bool_and(fruits_now(i, to_timestamp(${YEAR_FROM} + (k * ${SEASON_DAYS} + 3) * ${DAY}), true))
          from unnest(array[${items.map(q).join(', ')}]) i, generate_series(0, 3) k`) === 't');
  check('and the next season is the first one round from the next, for one season and for two',
    nextFruiting('apple', 'autumn') === 'autumn' && nextFruiting('olive', 'spring') === 'autumn' && nextFruiting('olive', 'autumn') === 'winter'
      && nextFruiting('lemon', 'summer') === 'winter' && nextFruiting('lemon', 'winter') === 'spring');
}

/* ---- picking ----------------------------------------------------------------
 * A row of four fruit trees and two bushes on Faraway, Ivar beside each in
 * turn, in each season held on the island and stood still in the browser.
 */
const W = `(select id from world where name = 'Faraway')`;
const IVAR = `(select uid from player where world_id = ${W} and name = 'Ivar')`;
const SEED = Number(psql(`select seed from world where name = 'Faraway'`));
const now = Date.now() / 1000;
/** A moment two and a half days into a season of this year. */
const momentIn = (s: Season): number => YEAR_FROM + (yearOf(now) * YEAR_DAYS + SEASONS.indexOf(s) * SEASON_DAYS + 2) * DAY + DAY / 2;
const ROW = 50;
const FROM_X = 20;
const BEARS = TREE_AGES.findIndex((a) => a.bears && a.alive);
type Subject = { what: string; action: 'pick_fruit' | 'harvest_bush'; tile: TileType; data: number; item: string };
const tree = (name: string): Subject => {
  const s = TREE_DEFS.findIndex((t) => t.name === name);
  return { what: `${name.toLowerCase()} tree`, action: 'pick_fruit', tile: TileType.Tree, data: packTreeData(s, BEARS), item: TREE_DEFS[s].fruit ?? '' };
};
const bush = (name: string): Subject => {
  const s = BUSH_DEFS.findIndex((b) => b.name === name);
  return { what: name.toLowerCase(), action: 'harvest_bush', tile: TileType.Bush, data: s, item: BUSH_DEFS[s].yields ?? '' };
};
const SUBJECTS: Subject[] = [tree('Apple'), tree('Cherry'), tree('Olive'), tree('Lemon'), bush('Rose bush'), bush('Lavender bush')];
const tileId = (t: TileType): string => `${t}`;
const target = (x: number, y: number): string => `'{"kind":"tile","x":${x},"y":${y}}'::jsonb`;
/** "You pick 3 apples off the apple tree. (QL 12.3)" with its numbers taken out, for comparing what is said when the dice differ. */
const shape = (s: string): string => s.replace(/\d+(\.\d+)?/g, 'N');

for (const season of SEASONS) {
  const at = momentIn(season);
  const sql = [`begin;`,
    `select set_config('wurm.season', ${q(season)}, true);`,
    `select give(${W}, ${IVAR}, 'sickle', 1, 40);`,
    `insert into skill (world_id, uid, id, value) values (${W}, ${IVAR}, 'forestry', 30) on conflict (world_id, uid, id) do update set value = 30;`,
    `delete from building_tile where world_id = ${W} and y between ${ROW} and ${ROW + 1} and x between ${FROM_X} and ${FROM_X + SUBJECTS.length};`,
  ];
  SUBJECTS.forEach((s, k) => {
    const x = FROM_X + k;
    sql.push(
      `select land_set_tile(${W}, ${x}, ${ROW}, ${tileId(s.tile)}); select land_set_data(${W}, ${x}, ${ROW}, ${s.data});`,
      `select land_set_tile(${W}, ${x}, ${ROW + 1}, tile_id('Grass')); select land_set_data(${W}, ${x}, ${ROW + 1}, 0);`,
      `delete from foraged where world_id = ${W} and x = ${x} and y = ${ROW};`,
      `update player set body_at = now(), x = ${x + 0.5}, y = ${ROW + 1.5}, level = 0 where world_id = ${W} and uid = ${IVAR};`,
      `delete from item where world_id = ${W} and holder = 'player' and holder_uid = ${IVAR} and def = ${q(s.item)};`,
      `select 'REFUSED${k}|' || coalesce(act_refusal_rules(${W}, ${IVAR}, ${q(s.action)}, ${target(x, ROW)}), '-');`,
      `select 'LOOK${k}|' || examine_tile_text(${W}, ${x}, ${ROW}, ${IVAR});`,
      `select act_perform(${W}, ${IVAR}, ${q(s.action)}, ${target(x, ROW)}) where act_refusal_rules(${W}, ${IVAR}, ${q(s.action)}, ${target(x, ROW)}) is null;`,
      `select 'GOT${k}|' || coalesce(sum(count), 0) from item where world_id = ${W} and holder = 'player' and holder_uid = ${IVAR} and def = ${q(s.item)};`,
      `select 'SAID${k}|' || coalesce((select text from event where world_id = ${W} and uid = ${IVAR} order by n desc limit 1), '-');`,
    );
  });
  sql.push(`rollback;`);
  const said = lines(psql(sql.join('\n')));
  const get = (k: string): string => said.get(k) ?? 'MISSING';

  const g = Game.create(SEED);
  g.world.seed = SEED;
  g.wallClock = () => at;
  g.skills.values.set('forestry', 30);
  g.inventory.add('sickle', { ql: 40 });
  const examine = ACTION_BY_ID.get('examine');
  SUBJECTS.forEach((s, k) => {
    const x = FROM_X + k;
    const tell = `in ${season}, the ${s.what}`;
    g.world.setTile(x, ROW, s.tile, s.data);
    g.world.setTile(x, ROW + 1, TileType.Grass, 0);
    const t: Target = { kind: 'tile', x, y: ROW, cx: x + 0.5, cy: ROW + 0.5 };
    const act = ACTION_BY_ID.get(s.action);
    const mine = act?.check?.(t, g) ?? '-';
    const inSeasonNow = fruitsIn(s.item, season);
    check(`${tell}: both sides ${inSeasonNow ? 'let it be picked' : 'refuse it, and say when it next bears'}, in the same words`,
      get(`REFUSED${k}`) === mine && (inSeasonNow ? mine === '-' : mine === outOfSeasonSaid(s.item, season) && mine.endsWith(`${nextFruiting(s.item, season)}.`)),
      `island "${get(`REFUSED${k}`)}", browser "${mine}"`);
    examine?.perform(t, g);
    const look = g.log[g.log.length - 1]?.text ?? '';
    const line = fruitingSays(s.item, season);
    check(`${tell}: and Examine says its seasons and whether it is in season, the same on both`,
      get(`LOOK${k}`).includes(line.trim()) && look.includes(line), `island "${get(`LOOK${k}`)}", browser "${look}"`);
    const before = g.inventory.count(s.item);
    if (mine === '-') act?.perform(t, g);
    const got = g.inventory.count(s.item) - before;
    const told = g.log[g.log.length - 1]?.text ?? '';
    if (inSeasonNow) {
      check(`${tell}: picked in season, both sides give ${s.item.replace('_', ' ')} and say so the same way`,
        Number(get(`GOT${k}`)) > 0 && got > 0 && shape(get(`SAID${k}`)).startsWith(shape(told.split(' (QL')[0])),
        `island ${get(`GOT${k}`)} "${get(`SAID${k}`)}", browser ${got} "${told}"`);
    } else {
      check(`${tell}: out of season, neither side gives anything`, get(`GOT${k}`) === '0' && got === 0, `island ${get(`GOT${k}`)}, browser ${got}`);
    }
  });
}

/* ---- foraging ---------------------------------------------------------------
 * Each table rolled from end to end in each season: what turns up on the
 * island is what turns up in the browser, and it is what is in season.
 */
const STEPS = 2000;
for (const season of SEASONS) {
  const at = momentIn(season);
  const tables: Array<[string, Array<[string, number]>]> = [['forage', FORAGE_TABLE], ['botanize', BOTANIZE_TABLE], ['botanize_water', BOTANIZE_WATER_TABLE]];
  const theirs = lines(psql(`begin;
select set_config('wurm.season', ${q(season)}, true);
${tables.map(([id]) => `select '${id}|' || string_agg(distinct roll_table(${q(id)}, (r + 0.5) / ${STEPS}), ',' order by roll_table(${q(id)}, (r + 0.5) / ${STEPS})) from generate_series(0, ${STEPS - 1}) r;`).join('\n')}
rollback;`));
  for (const [id, table] of tables) {
    const mine = [...new Set(Array.from({ length: STEPS }, (_, r) => rollTable(inSeason(table, at), (r + 0.5) / STEPS)))].sort().join(',');
    const due = table.filter(([i]) => fruitsIn(i, season)).map(([i]) => i).sort().join(',');
    check(`in ${season}, the ${id.replace('_', ' at the water, ')} table rolled end to end turns up the same on both sides, and only what is in season`,
      theirs.get(id) === mine && mine === due, `island ${theirs.get(id)}\nbrowser ${mine}\nin season ${due}`);
  }
}
{
  // And a go of foraging on each side, in winter and in summer, finds only what is in season.
  for (const season of ['winter', 'summer'] as const) {
    const at = momentIn(season);
    const x = FROM_X;
    const y = ROW + 3;
    const out = psql(`begin;
select set_config('wurm.season', ${q(season)}, true);
insert into skill (world_id, uid, id, value) values (${W}, ${IVAR}, 'foraging', 90) on conflict (world_id, uid, id) do update set value = 90;
delete from building_tile where world_id = ${W} and x = ${x} and y = ${y};
select land_set_tile(${W}, ${x}, ${y}, tile_id('Grass')); select land_set_data(${W}, ${x}, ${y}, 0);
update player set body_at = now(), x = ${x + 0.5}, y = ${y + 0.5}, level = 0 where world_id = ${W} and uid = ${IVAR};
delete from item where world_id = ${W} and holder = 'player' and holder_uid = ${IVAR} and def in (${FORAGE_TABLE.map(([i]) => q(i)).join(', ')});
do $$
declare k int;
begin
  for k in 1..12 loop
    delete from foraged where world_id = ${W} and x = ${x} and y = ${y};
    perform act_perform(${W}, ${IVAR}, 'forage', ${target(x, y)});
  end loop;
end $$;
select coalesce(string_agg(distinct def, ','), '') from item where world_id = ${W} and holder = 'player' and holder_uid = ${IVAR} and def in (${FORAGE_TABLE.map(([i]) => q(i)).join(', ')});
rollback;`).split('\n').pop() ?? '';
    const found = out.split(',').filter(Boolean);
    const g = Game.create(SEED);
    g.wallClock = () => at;
    g.skills.values.set('foraging', 90);
    const forage = ACTION_BY_ID.get('forage');
    for (let k = 0; k < 12; k++) forage?.perform({ kind: 'tile', x, y, cx: x + 0.5, cy: y + 0.5 }, g);
    const mine = g.inventory.items.map((it) => it.id).filter((i) => FORAGE_TABLE.some(([f]) => f === i));
    check(`a go of foraging in ${season} finds only what is in season, on both sides`,
      found.length > 0 && mine.length > 0 && found.every((i) => fruitsIn(i, season)) && mine.every((i) => fruitsIn(i, season)),
      `island ${found.join(', ')}; browser ${[...new Set(mine)].join(', ')}`);
  }
}

/* ---- a plucka ---------------------------------------------------------------
 * Set to fruit on the island, it would climb an apple tree in autumn and pass
 * it by in spring.
 */
{
  const x = FROM_X;
  const out = lines(psql(`begin;
select land_set_tile(${W}, ${x}, ${ROW}, ${TileType.Tree}); select land_set_data(${W}, ${x}, ${ROW}, ${tree('Apple').data});
select land_set_tile(${W}, ${x}, ${ROW + 1}, tile_id('Grass')); select land_set_data(${W}, ${x}, ${ROW + 1}, 0);
delete from building_tile where world_id = ${W} and x = ${x} and y between ${ROW} and ${ROW + 1};
delete from foraged where world_id = ${W} and x = ${x} and y = ${ROW};
select creature_spawn(${W}, 'plucka', ${x + 0.5}, ${ROW + 1.5}, 'stored', now() - interval '9 hours', ${IVAR}) as picker \\gset
${SEASONS.map((s) => `select set_config('wurm.season', ${q(s)}, true);
select '${s}|' || worker_gatherable(${W}, ${x}, ${ROW}, 'fruit', (select c from creature c where c.world_id = ${W} and c.id = :'picker'));`).join('\n')}
rollback;`));
  const climbs = SEASONS.map((s) => `${s}:${out.get(s)}`).join(' ');
  check('a plucka would climb an apple tree in its season and not out of it',
    SEASONS.every((s) => out.get(s) === String(fruitsIn('apple', s))), climbs);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`fruit, bushes and forage keep their seasons, the same on both sides — ${ok.length} of ${ok.length}`);
