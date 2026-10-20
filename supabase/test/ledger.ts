/**
 * A deed worker keeps a ledger of the last island day.
 *
 * Asked for: "A work ledger. Per deed worker, show what it did over the last island day ... Keep it to a fixed small
 * set of counters per creature: items produced/handled (by item id, top 3), trips/goes, skill gained. Rolling day:
 * keep two buckets (this day and last day) keyed by the island day number, roll over when the day changes, so storage
 * stays bounded."
 *
 *   * the arithmetic, the same on both sides (`ledgerAdd`, `ledger_add`): counted into the day, rolled over when the
 *     day changes, the day before kept only when it is the day before, and no more than `LEDGER_ITEMS` kinds of
 *     thing a day;
 *   * counted where the work is: a load into a store, a go, and the skill a go teaches, on the island and in the
 *     browser;
 *   * rolled over at the day boundary by the work itself;
 *   * and said on the card as it is kept.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import type { Creature } from '../../src/game/creatures';
import { DAY_SECONDS } from '../../src/game/pace';
import { LEDGER_ITEMS, LEDGER_SHOWN, ledgerAdd, ledgerLines, type WorkLedger } from '../../src/game/workerlog';
import { TileType } from '../../src/world/tiles';

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
/** Equal as data, whatever order the keys came in: jsonb keeps its own. */
const same = (a: unknown, b: unknown): boolean => {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
  }
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  return ka.join() === kb.join() && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};

/* ---- the arithmetic, on both sides ---------------------------------------- */

type Add = { day: number; goes?: number; skill?: number; item?: string; n?: number };
const ITEMS = ['reed', 'log', 'plank', 'stone', 'clay', 'sand', 'peat', 'tar', 'moss', 'dirt'];
const steps: Add[] = [
  { day: 5, goes: 1 },
  { day: 5, item: 'reed', n: 3 },
  { day: 5, skill: 0.25 },
  { day: 5, goes: 1, item: 'reed', n: 2 },
  // More kinds of thing than a day counts: the first eight, and nothing of the rest.
  ...ITEMS.map((item) => ({ day: 5, item, n: 1 })),
  { day: 6, goes: 1, item: 'log', n: 4 },
  { day: 6, skill: 0.5 },
  // A day with nothing in it between: the day before that is not "the day before".
  { day: 8, goes: 1 },
];
let browser: WorkLedger | null = null;
const browserAfter: WorkLedger[] = [];
for (const s of steps) {
  browser = ledgerAdd(browser, s.day, s);
  browserAfter.push(JSON.parse(JSON.stringify(browser)) as WorkLedger);
}
const sqlSteps = steps.map((s, i) =>
  `l := ledger_add(l, ${s.day}, ${s.goes ?? 0}, ${s.skill ?? 0}, ${s.item ? `'${s.item}'` : 'null'}, ${s.n ?? 0});
  insert into said values ('S${i}', l::text);`).join('\n  ');

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000f22';
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare l jsonb; w uuid; u uuid := '${U}'; v_sedra int; v_crate int := 9101; v_day int; v_gain double precision;
begin
  ${sqlSteps}
  insert into said values ('ITEMS', ledger_items()::text);

  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ledger', 222, 160, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 160);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ledgerstead', ${T}, ${T}, 10, 5, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed) values (w, v_crate, 'plank', ${T} + 1, ${T}, 0, 0, true);
  v_sedra := creature_spawn(w, 'sedra', ${T} + 1.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  v_day := island_day(w);
  insert into said values ('DAY', v_day::text || '|' || floor(world_time(w) / day_seconds())::text);
  -- A load of reed home at the crate.
  update creature c set traits = '{}', keeper = u, phase = 'home', job = null, post = null,
         carrying = '{"def": "reed", "count": 3, "ql": 30}'::jsonb,
         from_x = crate_centre_x(cr), from_y = crate_centre_y(cr), to_x = crate_centre_x(cr), to_y = crate_centre_y(cr),
         until = now() - interval '10 milliseconds', leg_at = now() - interval '10 milliseconds', leg_ends = now() - interval '10 milliseconds'
    from crate cr where cr.world_id = w and cr.id = v_crate and c.world_id = w and c.id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'HOME', coalesce(ledger::text, 'null') from creature where world_id = w and id = v_sedra;
  insert into said select 'CRATE', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'crate' and crate = v_crate and def = 'reed';
  -- A go at its task, on a tile with nothing of its trade on it.
  update creature set phase = 'work', work_x = ${T} + 2, work_y = ${T}, carrying = null,
         until = now() - interval '10 milliseconds' where world_id = w and id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'GO', ledger::text from creature where world_id = w and id = v_sedra;
  -- What a worker learns.
  v_gain := worker_learn(w, v_sedra, 'foraging', 0.5);
  insert into said select 'LEARN', v_gain::text || '|' || ((ledger->'now'->>'skill')::double precision)::text
    from creature where world_id = w and id = v_sedra;
  -- The next day: what it did yesterday is the day before, and today starts empty.
  update creature set ledger = jsonb_set(ledger, '{day}', to_jsonb(v_day - 1)) where world_id = w and id = v_sedra;
  update creature set phase = 'work', work_x = ${T} + 2, work_y = ${T}, until = now() - interval '10 milliseconds'
   where world_id = w and id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'ROLLED', ledger::text from creature where world_id = w and id = v_sedra;
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

check(`a day counts at most ${LEDGER_ITEMS} kinds of thing, on both sides`, Number(isle.get('ITEMS')) === LEDGER_ITEMS, isle.get('ITEMS'));
{
  const diffs = steps.map((_, i) => i).filter((i) => !same(JSON.parse(isle.get(`S${i}`) ?? 'null'), browserAfter[i]));
  check(`the same ledger on both sides after each of ${steps.length} additions`, diffs.length === 0,
    diffs.map((i) => `#${i}: ${isle.get(`S${i}`)} / ${JSON.stringify(browserAfter[i])}`).join(' ; '));
  const day5 = browserAfter[3 + ITEMS.length];
  check('a go, a load and the skill a day are counted into it',
    day5.day === 5 && day5.now.goes === 2 && day5.now.made.reed === 6 && Math.abs(day5.now.skill - 0.25) < 1e-9, JSON.stringify(day5));
  check(`no more than ${LEDGER_ITEMS} kinds of thing a day, and the ones past it left out`,
    Object.keys(day5.now.made).length === LEDGER_ITEMS && !('moss' in day5.now.made) && !('dirt' in day5.now.made) && day5.now.made.tar === 1, JSON.stringify(day5.now.made));
  const day6 = browserAfter[browserAfter.length - 2];
  check('the next day rolls it over: the day before kept, today fresh',
    day6.day === 6 && same(day6.last, day5.now) && day6.now.goes === 1 && day6.now.made.log === 4 && Math.abs(day6.now.skill - 0.5) < 1e-9,
    JSON.stringify(day6));
  const day8 = browserAfter[browserAfter.length - 1];
  check('two days on, the day before had nothing in it: no last day, and still two buckets at most',
    day8.day === 8 && day8.last === null && day8.now.goes === 1 && same(Object.keys(day8).sort(), ['day', 'last', 'now']), JSON.stringify(day8));
}

/* ---- counted where the work is: the island ------------------------------- */

const [islandDay] = (isle.get('DAY') ?? '').split('|').map(Number);
check('the island day is the island clock over a day\'s length', isle.get('DAY') === `${islandDay}|${islandDay}`, isle.get('DAY'));
{
  const home = JSON.parse(isle.get('HOME') ?? 'null') as WorkLedger | null;
  check('a load into a store is counted to the day it went in', home?.day === islandDay && home.now.made.reed === 3 && isle.get('CRATE') === '3',
    `${isle.get('HOME')} crate ${isle.get('CRATE')}`);
  const go = JSON.parse(isle.get('GO') ?? 'null') as WorkLedger | null;
  check('a go at its task is counted', go?.now.goes === 1 && go.now.made.reed === 3, isle.get('GO'));
  const [gain, skill] = (isle.get('LEARN') ?? '').split('|').map(Number);
  check('and what it learns at work', gain > 0 && Math.abs(skill - ((go?.now.skill ?? 0) + gain)) < 1e-6, isle.get('LEARN'));
  const rolled = JSON.parse(isle.get('ROLLED') ?? 'null') as WorkLedger | null;
  check('at the day boundary the work itself rolls it over: yesterday\'s kept, today\'s begun',
    rolled?.day === islandDay && rolled.last?.goes === 1 && rolled.last.made.reed === 3 && rolled.now.goes === 1 && !Object.keys(rolled.now.made).length,
    isle.get('ROLLED'));
}

/* ---- counted where the work is: the browser ------------------------------ */

{
  const g = Game.create(222, 256);
  const w = g.world;
  w.water = null;
  w.heights.fill(10);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Ledgerstead', x: T, y: T, radius: 10, level: 5 };
  const crate = g.addCrate('plank', T + 1, T, 0, 0, [{ uid: g.inventory.nextUid++, id: 'hatchet', ql: 30, dmg: 40, count: 1 }], true);
  const step = (c: Creature): void =>
    (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
  const [cx, cy] = [crate.x + 0.5, crate.y + 0.5];
  const sedra = g.creatures.spawn('sedra', cx, cy, 'deed', () => 0.5, -1e9);
  sedra.traits = [];
  sedra.carrying = { uid: g.inventory.nextUid++, id: 'reed', ql: 30, dmg: 0, count: 3 };
  for (let i = 0; i < 4 && sedra.carrying; i++) step(sedra);
  const day = g.islandDay();
  check('in the browser, a load into a store is counted', sedra.ledger?.day === day && sedra.ledger.now.made.reed === 3, JSON.stringify(sedra.ledger));
  const tinka = g.creatures.spawn('tinka', cx, cy, 'deed', () => 0.5, -1e9);
  tinka.traits = [];
  step(tinka);
  check('and a go, with what it learns at it', tinka.ledger?.now.goes === 1 && (tinka.ledger.now.skill ?? 0) > 0, JSON.stringify(tinka.ledger));
  // The next day, by the island clock.
  g.time += DAY_SECONDS;
  tinka.busyUntil = 0;
  crate.items[0].dmg = 40;
  step(tinka);
  check('and rolled over at the day boundary by the work itself', tinka.ledger?.day === day + 1 && tinka.ledger.last?.goes === 1 && tinka.ledger.now.goes === 1,
    JSON.stringify(tinka.ledger));
  const lines = ledgerLines(tinka.ledger, g.islandDay());
  check(`and said on its card: ${lines.join(' / ')}`, lines.length === 2 && lines[0].startsWith('This island day: 1 cycle; +') && lines[1].startsWith('Last island day: 1 cycle; +'),
    lines.join(' / '));
}

{
  // What the card says of a day, read off the numbers: the most handled first, `LEDGER_SHOWN` of them.
  const l: WorkLedger = { day: 9, now: { goes: 0, skill: 0, made: {} }, last: { goes: 38, skill: 2.1, made: { reed: 140, log: 2, seed: 12, clay: 1 } } };
  const lines = ledgerLines(l, 9);
  check(`the last island day reads off the numbers, ${LEDGER_SHOWN} things at most: ${lines.join(' / ')}`,
    lines.length === 1 && lines[0] === 'Last island day: 38 cycles; handled 140 reeds, 12 seeds and 2 logs; +2.10 skill.', lines.join(' / '));
  check('and a ledger last written two days ago says nothing', ledgerLines(l, 11).length === 0);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na worker keeps a ledger — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
