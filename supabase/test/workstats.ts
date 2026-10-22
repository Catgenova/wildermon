/**
 * A wildermon's lifetime at work.
 *
 * Asked for: "per wildermon lifetime work stats from the existing work ledger: lifetime output by thing, best day
 * (count and date), total time working and total time idle (with the top idle reason). Keep lifetime counters on the
 * island cheaply (one small jsonb/columns update where the ledger is already written). Shown on the wildermon card as a
 * 'Work' section; the keeper sees it for their own wildermon only."
 *
 *   * the arithmetic, the same on both sides (`workFromLedger`/`work_stats_ledger`, `workTime`/`work_stats_time`):
 *     what each write of the ledger added goes onto the lifetime, across days, no more than `WORK_ITEMS` kinds of
 *     thing, the best day by things handled, and time by the reason it was idle for it;
 *   * counted where the work is, on the island by the row write that writes the ledger (`work_stats_keep`): a load into
 *     a store, a go, the skill, across a day boundary, the seconds between settles by the reason kept on it, and a
 *     settle long past its turn as idle, `away`;
 *   * and in the browser by the worker's own step;
 *   * sent to the keeper only, and said on the card as it is kept, the same from either side's numbers;
 *   * and what it costs a worker's step on the island, measured with the trigger and without.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import type { Creature } from '../../src/game/creatures';
import { DAY_SECONDS } from '../../src/game/pace';
import { ledgerAdd, type IdleWhy, type WorkLedger } from '../../src/game/workerlog';
import { bestDay, emptyWork, IDLE_LABEL, IDLE_STALE, topIdle, WORK_ITEMS, workFromLedger, workLines, workTime, type WorkStats } from '../../src/game/workstats';
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
/** Equal as data, whatever order the keys came in: jsonb keeps its own. */
const same = (a: unknown, b: unknown): boolean => {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b;
  }
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  return ka.join() === kb.join() && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};
/** The island's record without its own clock (`at`), which the browser has no need of. */
const bare = (s: unknown): WorkStats | null => {
  if (!s || typeof s !== 'object') return null;
  const { at: _at, ...rest } = s as Record<string, unknown>;
  return rest as unknown as WorkStats;
};

/* ---- the arithmetic, on both sides ---------------------------------------- */

type Step = { day: number; goes?: number; skill?: number; item?: string; n?: number } | { secs: number; why: IdleWhy | null };
const KINDS = ['reed', 'log', 'plank', 'stone', 'clay', 'sand', 'peat', 'tar', 'moss', 'dirt', 'flint', 'iron_ore', 'tin_ore', 'copper_ore'];
const steps: Step[] = [
  { day: 5, goes: 1 },
  { day: 5, item: 'reed', n: 3 },
  { secs: 40, why: null },
  { day: 5, skill: 0.25 },
  { day: 5, goes: 1, item: 'reed', n: 2 },
  { secs: 15, why: 'range' },
  { secs: 5, why: 'stock' },
  { secs: 30, why: 'rest' },
  { secs: 12, why: 'bed' },
  // A new day: the lifetime goes on where the ledger starts afresh.
  { day: 6, goes: 1, item: 'log', n: 4 },
  { day: 6, item: 'reed', n: 1 },
  { secs: 22, why: 'range' },
  { day: 6, skill: 0.5 },
  // A better day than the first.
  { day: 7, item: 'reed', n: 9 },
  // Many kinds over the days: more than the lifetime counts.
  ...KINDS.map((item, i) => ({ day: 8 + Math.floor(i / 7), item, n: 1 })),
  { secs: 0, why: 'far' },
  { secs: -3, why: null },
];
let ledger: WorkLedger | null = null;
let browser: WorkStats | null = null;
const browserAfter: WorkStats[] = [];
for (const s of steps) {
  if ('secs' in s) browser = workTime(browser, s.secs, s.why);
  else {
    const was = ledger;
    ledger = ledgerAdd(ledger ? (JSON.parse(JSON.stringify(ledger)) as WorkLedger) : null, s.day, s);
    browser = workFromLedger(browser, was, ledger);
  }
  browserAfter.push(JSON.parse(JSON.stringify(browser)) as WorkStats);
}
const sqlSteps = steps.map((s, i) => ('secs' in s
  ? `st := work_stats_time(st, ${s.secs}, ${s.why ? `'${s.why}'` : 'null'});`
  : `was := l; l := ledger_add(l, ${s.day}, ${s.goes ?? 0}, ${s.skill ?? 0}, ${s.item ? `'${s.item}'` : 'null'}, ${s.n ?? 0});
  st := work_stats_ledger(st, was, l);`) + `\n  insert into said values ('S${i}', st::text);`).join('\n  ');

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000f23';
const OTHER = '7e5b0000-0000-4000-8000-000000000f24';
const STEPS = 300;
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare l jsonb; was jsonb; st jsonb; w uuid; u uuid := '${U}'; v_sedra int; v_crate int := 9102; v_day int;
        v_t0 timestamptz; v_on double precision; v_off double precision; v_i int;
begin
  ${sqlSteps}
  insert into said values ('ITEMS', work_items()::text);
  insert into said values ('BACK', work_stats_ledger('{"goes": 1, "skill": 0, "made": {}, "best": null, "work": 0, "rest": 0, "idle": {}}'::jsonb,
    '{"day": 9, "now": {"goes": 2, "skill": 0, "made": {"reed": 2}}, "last": null}'::jsonb,
    '{"day": 8, "now": {"goes": 2, "skill": 0, "made": {"reed": 2}}, "last": null}'::jsonb)::text);

  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Workstats', 223, 160, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 160);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Workstead', ${T}, ${T}, 10, 5, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed) values (w, v_crate, 'plank', ${T} + 1, ${T}, 0, 0, true);
  v_sedra := creature_spawn(w, 'sedra', ${T} + 1.5, ${T} + 0.5, 'active', now() - interval '30 days', u);
  -- Set to work: its record starts as it comes onto the settlement.
  update creature set mode = 'deed', traits = '{}', keeper = u, settled_at = now() - interval '100 seconds' where world_id = w and id = v_sedra;
  insert into said select 'START', coalesce(work_stats::text, 'null') from creature where world_id = w and id = v_sedra;
  v_day := island_day(w);
  insert into said values ('DAY', v_day::text);
  -- A load of reed home at the crate, after standing 100 seconds with nothing in range.
  update creature c set phase = 'home', job = null, post = null, idle_why = 'range', idle_n = 10,
         carrying = '{"def": "reed", "count": 3, "ql": 30}'::jsonb,
         settled_at = now() - interval '100 seconds',
         from_x = crate_centre_x(cr), from_y = crate_centre_y(cr), to_x = crate_centre_x(cr), to_y = crate_centre_y(cr),
         until = now() - interval '10 milliseconds', leg_at = now() - interval '10 milliseconds', leg_ends = now() - interval '10 milliseconds'
    from crate cr where cr.world_id = w and cr.id = v_crate and c.world_id = w and c.id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'HOME', work_stats::text from creature where world_id = w and id = v_sedra;
  -- A go at its task, 60 seconds after it last settled, at work.
  update creature set phase = 'work', work_x = ${T} + 2, work_y = ${T}, carrying = null, idle_why = null, idle_n = null,
         settled_at = now() - interval '60 seconds',
         until = now() - interval '10 milliseconds' where world_id = w and id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'GO', work_stats::text from creature where world_id = w and id = v_sedra;
  -- What a worker learns.
  perform worker_learn(w, v_sedra, 'foraging', 0.5);
  insert into said select 'LEARN', work_stats::text || '|' || (ledger->'now'->>'skill') from creature where world_id = w and id = v_sedra;
  -- Long past its turn, resting: the time past its turn by more than idle_stale is idle (away), the rest rest.
  update creature set idle_why = 'rest', phase = 'work', work_x = ${T} + 2, work_y = ${T},
         settled_at = now() - interval '500 seconds',
         until = now() - interval '400 seconds' where world_id = w and id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'LATE', work_stats::text from creature where world_id = w and id = v_sedra;
  -- The next day: the ledger written a day back, which counts for nothing, and work that rolls it over onto the lifetime.
  update creature set ledger = jsonb_set(ledger, '{day}', to_jsonb(v_day - 1)) where world_id = w and id = v_sedra;
  insert into said select 'BACKED', work_stats::text from creature where world_id = w and id = v_sedra;
  update creature c set phase = 'home', carrying = '{"def": "reed", "count": 9, "ql": 30}'::jsonb, idle_why = null,
         from_x = crate_centre_x(cr), from_y = crate_centre_y(cr), to_x = crate_centre_x(cr), to_y = crate_centre_y(cr),
         until = now() - interval '10 milliseconds', leg_at = now() - interval '10 milliseconds', leg_ends = now() - interval '10 milliseconds'
    from crate cr where cr.world_id = w and cr.id = v_crate and c.world_id = w and c.id = v_sedra;
  perform creature_settle(w, v_sedra);
  insert into said select 'ROLLED', work_stats::text || '|' || ledger::text from creature where world_id = w and id = v_sedra;

  -- Sent to its keeper, and to nobody else.
  update creature set from_x = ${T} + 1.5, from_y = ${T} + 0.5, to_x = ${T} + 1.5, to_y = ${T} + 0.5 where world_id = w and id = v_sedra;
  insert into said select 'MINE', coalesce((select e->>'work' from jsonb_array_elements(rpc_creatures(w, 40)) e
                                              where (e->>'id')::int = v_sedra), 'none');
  perform set_config('request.jwt.claims', json_build_object('sub', '${OTHER}')::text, true);
  perform rpc_join(w, 'Other');
  insert into said select 'THEIRS', coalesce((select coalesce(e->>'work', 'unsent') from jsonb_array_elements(rpc_creatures(w, 40)) e
                                              where (e->>'id')::int = v_sedra), 'none');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);

  -- What it costs a step: the same go, ${STEPS} times, with the trigger and without, by turns, the best of each.
  v_on := 1e9; v_off := 1e9;
  for v_i in 1..6 loop
    if v_i % 2 = 0 then alter table creature disable trigger work_stats_keep; end if;
    v_t0 := clock_timestamp();
    for v_k in 1..${STEPS} loop
      update creature set phase = 'work', work_x = ${T} + 2, work_y = ${T}, carrying = null,
             until = now() - interval '10 milliseconds', settled_at = now() - make_interval(secs => v_k) where world_id = w and id = v_sedra;
      perform creature_settle(w, v_sedra);
    end loop;
    if v_i % 2 = 1 then v_on := least(v_on, extract(epoch from clock_timestamp() - v_t0));
    else v_off := least(v_off, extract(epoch from clock_timestamp() - v_t0)); end if;
    alter table creature enable trigger work_stats_keep;
  end loop;
  insert into said values ('COST', v_on::text || '|' || v_off::text);
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

check(`the lifetime counts at most ${WORK_ITEMS} kinds of thing, on both sides`, Number(isle.get('ITEMS')) === WORK_ITEMS, isle.get('ITEMS'));
{
  const diffs = steps.map((_, i) => i).filter((i) => !same(JSON.parse(isle.get(`S${i}`) ?? 'null'), browserAfter[i]));
  check(`the same lifetime on both sides after each of ${steps.length} writes and times`, diffs.length === 0,
    diffs.slice(0, 3).map((i) => `#${i}: ${isle.get(`S${i}`)} / ${JSON.stringify(browserAfter[i])}`).join(' ; '));
  const day5 = browserAfter[8];
  check('a go, a load and the skill are counted onto the lifetime, and the time by why',
    day5.goes === 2 && day5.made.reed === 5 && Math.abs(day5.skill - 0.25) < 1e-9 && day5.work === 40 && day5.idle.range === 15
      && day5.idle.stock === 5 && day5.rest === 42, JSON.stringify(day5));
  const day6 = browserAfter[12];
  check('across a day the lifetime goes on: both days\' goes, things and skill, and the idle time added up',
    day6.goes === 3 && day6.made.reed === 6 && day6.made.log === 4 && Math.abs(day6.skill - 0.75) < 1e-9 && day6.idle.range === 37, JSON.stringify(day6));
  check('the best day is the one that handled the most: day 5\'s five, then day 7\'s nine', same(day5.best, { day: 5, n: 5 })
    && same(browserAfter[13].best, { day: 7, n: 9 }), `${JSON.stringify(day5.best)} ${JSON.stringify(browserAfter[13].best)}`);
  const end = browserAfter[browserAfter.length - 1];
  check(`no more than ${WORK_ITEMS} kinds of thing, the ones past it left out; nothing or less than nothing of time is no time`,
    Object.keys(end.made).length === WORK_ITEMS && !('tin_ore' in end.made) && !('copper_ore' in end.made) && !('far' in end.idle) && end.work === 40,
    JSON.stringify(end.made));
  check('the top idle reason is the one it stood about for longest', same(topIdle(end), ['range', 37]), JSON.stringify(topIdle(end)));
  check('and a ledger gone back a day adds nothing, on both sides', same(JSON.parse(isle.get('BACK') ?? 'null'), { goes: 1, skill: 0, made: {}, best: null, work: 0, rest: 0, idle: {} })
    && same(workFromLedger({ ...emptyWork(), goes: 1 }, { day: 9, now: { goes: 2, skill: 0, made: { reed: 2 } }, last: null }, { day: 8, now: { goes: 2, skill: 0, made: { reed: 2 } }, last: null }), { ...emptyWork(), goes: 1 }),
    isle.get('BACK'));
}

/* ---- counted where the work is: the island ------------------------------- */

const islandDay = Number(isle.get('DAY'));
{
  const start = JSON.parse(isle.get('START') ?? 'null') as Record<string, number> | null;
  check('set to work, its record starts, empty, at the time it came onto the settlement', !!start && same(bare(start), emptyWork()) && typeof start.at === 'number',
    isle.get('START'));
  const home = bare(JSON.parse(isle.get('HOME') ?? 'null'));
  check('a load into a store goes onto the lifetime, and the 100 seconds it stood with nothing in range onto that reason',
    home?.made.reed === 3 && home.best?.n === 3 && home.best.day === islandDay && Math.abs((home.idle.range ?? 0) - 100) < 1 && home.work < 1, isle.get('HOME'));
  const go = bare(JSON.parse(isle.get('GO') ?? 'null'));
  check('a go at its task is counted, and the 60 seconds before it at work', go?.goes === 1 && Math.abs((go.work ?? 0) - 60) < 1, isle.get('GO'));
  const [learnt, skill] = (isle.get('LEARN') ?? '').split('|');
  const learn = bare(JSON.parse(learnt || 'null'));
  check('and what it learns at work', !!learn && learn.skill > 0 && Math.abs(learn.skill - Number(skill)) < 1e-6, isle.get('LEARN'));
  const late = bare(JSON.parse(isle.get('LATE') ?? 'null'));
  check(`a settle 400 seconds past its turn: that much idle as nobody settling it (over ${IDLE_STALE} s late), the 100 before its turn resting`,
    !!late && Math.abs((late.idle.away ?? 0) - 400) < 1 && Math.abs(late.rest - 100) < 1, isle.get('LATE'));
  const backed = bare(JSON.parse(isle.get('BACKED') ?? 'null'));
  check('the ledger put back a day by hand adds nothing', !!backed && same(backed, late), isle.get('BACKED'));
  const [rolledS, rolledL] = (isle.get('ROLLED') ?? '').split('|');
  const rolled = bare(JSON.parse(rolledS || 'null'));
  const rl = JSON.parse(rolledL || 'null') as WorkLedger | null;
  check('the day after, the work rolls the ledger over and its load goes onto the lifetime; the best day is the bigger',
    !!backed && rolled?.made.reed === (backed.made.reed ?? 0) + 9 && rl?.now.made.reed === 9 && rl.last?.made.reed === backed.made.reed
      && (backed.best?.n ?? 0) < 9 && same(rolled.best, { day: islandDay, n: 9 }), isle.get('ROLLED'));
  const mine = bare(JSON.parse(isle.get('MINE') ?? 'null'));
  check('its keeper is sent it, without the island\'s own clock', !!mine && same(mine, rolled) && !('at' in (JSON.parse(isle.get('MINE') ?? '{}') as object)), isle.get('MINE'));
  check('and somebody else is not', isle.get('THEIRS') === 'unsent', isle.get('THEIRS'));
  const lines = workLines(rolled, rl);
  const browserLines = workLines(JSON.parse(JSON.stringify(rolled)) as WorkStats, rl);
  check(`and its card says it the same from the island's numbers: ${lines.join(' / ')}`,
    lines.join('|') === browserLines.join('|') && lines[0] === `Handled: ${rolled?.made.reed} reeds` && lines.some((l) => l === `Best island day: 9 handled (day ${islandDay})`)
      && lines.some((l) => l.includes(`(most: ${IDLE_LABEL.away}, `)), lines.join(' / '));
  const [on, off] = (isle.get('COST') ?? '').split('|').map(Number);
  check(`what it costs a worker's step: ${(on / STEPS * 1000).toFixed(3)} ms with it, ${(off / STEPS * 1000).toFixed(3)} ms without, over ${STEPS} steps`,
    on > 0 && off > 0 && on < off * 1.25 + 0.05, isle.get('COST'));
}

/* ---- counted where the work is: the browser ------------------------------ */

{
  const g = Game.create(223, 256);
  const w = g.world;
  w.water = null;
  w.heights.fill(10);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Workstead', x: T, y: T, radius: 10, level: 5 };
  const crate = g.addCrate('plank', T + 1, T, 0, 0, [{ uid: g.inventory.nextUid++, id: 'hatchet', ql: 30, dmg: 40, count: 1 }], true);
  const step = (c: Creature, dt = 0.25): void =>
    (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, dt, g);
  const [cx, cy] = [crate.x + 0.5, crate.y + 0.5];
  const sedra = g.creatures.spawn('sedra', cx, cy, 'deed', () => 0.5, -1e9);
  sedra.traits = [];
  sedra.carrying = { uid: g.inventory.nextUid++, id: 'reed', ql: 30, dmg: 0, count: 3 };
  for (let i = 0; i < 4 && sedra.carrying; i++) step(sedra);
  const day = g.islandDay();
  check('in the browser, a load into a store goes onto the lifetime, and the best day with it',
    sedra.work?.made.reed === 3 && same(sedra.work.best, { day, n: 3 }), JSON.stringify(sedra.work));
  const tinka = g.creatures.spawn('tinka', cx, cy, 'deed', () => 0.5, -1e9);
  tinka.traits = [];
  tinka.idle = { why: 'stock', n: 0 };
  step(tinka, 2);
  check('and a go, with what it learns at it, and the time before it by why it stood about', tinka.work?.goes === 1 && (tinka.work.skill ?? 0) > 0
    && tinka.work.idle.stock === 2, JSON.stringify(tinka.work));
  // The next day, by the island clock.
  g.time += DAY_SECONDS;
  tinka.busyUntil = 0;
  crate.items[0].dmg = 40;
  step(tinka, 3);
  check('and across the day boundary the lifetime goes on', tinka.work?.goes === 2 && tinka.ledger?.now.goes === 1 && tinka.ledger.last?.goes === 1
    && tinka.work.work === 3, JSON.stringify(tinka.work));
  check('and its best day is read with the days its ledger holds', same(bestDay({ ...emptyWork(), best: { day: 1, n: 2 } },
    { day: 9, now: { goes: 1, skill: 0, made: { reed: 4 } }, last: { goes: 1, skill: 0, made: { reed: 3 } } }), { day: 9, n: 4 }));
  const lines = workLines(tinka.work, tinka.ledger);
  check(`said on its card: ${lines.join(' / ')}`, lines[0].startsWith('Cycles: 2 · +') && lines[1].startsWith('Working: 3 s · Idle: 2 s (most: stores empty, 2 s)'),
    lines.join(' / '));
  check('and nothing for one that has never worked', workLines(null).length === 0 && workLines(emptyWork()).length === 0);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na lifetime at work — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
