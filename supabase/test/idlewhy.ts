/**
 * A deed worker says why it is standing about.
 *
 * Asked for: "Show why a worker is idle. A wildermon set to work on a settlement often stands idle and the player
 * can't tell why", from a report of a Tinka sent home "from about 300 tiles away, but it didn't move". Each place a
 * worker's step finds nothing to do keeps the cause, as a code and a number, and its card says it as a sentence.
 * Asked of the island and of the browser, the classic cases:
 *
 *   * a water carrier with a full bucket and no barrel on the settlement: `room`;
 *   * a reed cutter with no reed bed within its range: `range`, at its own range at its level;
 *   * a mender with nothing in the stores to mend: `stock`;
 *   * a worker three hundred tiles from its work: `far`, and how far;
 *   * and, on the island only, a worker nothing is settling: `away` while its keeper is away, `unswept` while they
 *     are awake but nobody is within the clock's reach of it, which `rpc_creatures` reads off a turn long overdue.
 *
 * The same code and the same sentence on both sides for each, the stored reason cleared when it sets out to work,
 * and the clock's reach the one `world_tick` sweeps.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { HOME_SLACK, SPECIES, workRangeOf, type Creature, type GatherKind } from '../../src/game/creatures';
import { idleSays, type Idle, type IdleWhy } from '../../src/game/workerlog';
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

const T = 60;
const FAR = 300;
const U = '7e5b0000-0000-4000-8000-000000000f21';

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_holla int; v_sedra int; v_tinka int; v_far int; r jsonb; v_reach int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Idlewhy', 221, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 399) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Idlestead', ${T}, ${T}, 10, 5, u);
  -- Its keeper well off, out of the reach of the sweep \`rpc_creatures\` runs round them on a bare postgres.
  update player set x = ${T + 180} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now()
   where world_id = w and uid = u;
  v_holla := creature_spawn(w, 'holla', ${T} + 1.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  v_sedra := creature_spawn(w, 'sedra', ${T} - 1.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  v_tinka := creature_spawn(w, 'tinka', ${T} + 0.5, ${T} + 1.5, 'deed', now() - interval '30 days', u);
  v_far := creature_spawn(w, 'tinka', ${T + FAR} + 1.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', keeper = u, phase = 'idle', carrying = null, job = null, post = null,
         until = now() - interval '60 seconds', leg_at = now() - interval '60 seconds', leg_ends = now() - interval '60 seconds'
   where world_id = w and id in (v_holla, v_sedra, v_tinka, v_far);
  update creature set carrying = '{"def": "water_bucket", "count": 1, "ql": 40}'::jsonb where world_id = w and id = v_holla;
  -- Only just due, so that it takes one leg home and not a minute of them.
  update creature set until = now() - interval '10 milliseconds' where world_id = w and id = v_far;
  perform creature_settle(w, v_holla);
  perform creature_settle(w, v_sedra);
  perform creature_settle(w, v_tinka);
  perform creature_settle(w, v_far);
  insert into said select 'HOLLA', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') from creature where world_id = w and id = v_holla;
  insert into said select 'SEDRA', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || work_range(c) from creature c where world_id = w and id = v_sedra;
  insert into said select 'TINKA', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') from creature where world_id = w and id = v_tinka;
  insert into said select 'FAR', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') from creature where world_id = w and id = v_far;

  -- Cleared when it sets out: a barrel with room, and the water carrier is off to it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, liquid)
    values (w, 'furniture', 'barrel', ${T} + 3, ${T}, 0, 0, ${T} + 3.375, ${T} + 0.375, 40, u, 0, null);
  update creature set until = now() - interval '1 second', phase = 'idle' where world_id = w and id = v_holla;
  perform creature_settle(w, v_holla);
  insert into said select 'HOLLA2', coalesce(idle_why, 'null') || '|' || phase from creature where world_id = w and id = v_holla;

  -- Nobody settling it: its keeper away, and then awake but more than the clock's reach from it.
  update creature set until = now() - make_interval(secs => idle_stale() + 30) where world_id = w and id = v_tinka;
  update player set away = true where world_id = w and uid = u;
  r := rpc_creatures(w, 40);
  insert into said select 'AWAY', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleN', '') from jsonb_array_elements(r) e where (e->>'id')::int = v_tinka;
  update player set away = false, seen_at = now() where world_id = w and uid = u;
  r := rpc_creatures(w, 40);
  insert into said select 'UNSWEPT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleN', '') from jsonb_array_elements(r) e where (e->>'id')::int = v_tinka;
  -- And what is stored, as it is sent, for one being worked: the reed cutter, with its keeper's ledger key.
  update creature set until = now() + interval '10 seconds' where world_id = w and id = v_sedra;
  insert into said select 'SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleN', '') || '|' || (e ? 'ledger')::text
    from jsonb_array_elements(r) e where (e->>'id')::int = v_sedra;
  insert into said select 'SENTFAR', (count(*) > 0)::text from jsonb_array_elements(r) e where (e->>'id')::int = v_far;

  v_reach := sweep_reach()::int;
  insert into said values ('REACH', v_reach::text);
  insert into said values ('TICK', (v_reach = 40 + leg_slack() and position('creature_sweep(w.id, p.x, p.y, 40, v_deadline, null, true)'
    in pg_get_functiondef('world_tick'::regproc)) > 0)::text);
  insert into said values ('SLACK', home_slack()::text);
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const islandIdle = (k: string): Idle | null => {
  const [why, n] = (isle.get(k) ?? '').split('|');
  return why ? { why: why as IdleWhy, n: Number(n || 0) } : null;
};

/* ---- the browser ---------------------------------------------------------- */

const g = Game.create(221, 512);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.deed = { name: 'Idlestead', x: T, y: T, radius: 10, level: 5 };
const worker = (species: string, x: number, y: number): Creature => {
  const c = g.creatures.spawn(species, x, y, 'deed', () => 0.5, -1e9);
  c.traits = [];
  return c;
};
const step = (c: Creature): void =>
  (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
const holla = worker('holla', T + 1.5, T + 0.5);
const sedra = worker('sedra', T - 1.5, T + 0.5);
const tinka = worker('tinka', T + 0.5, T + 1.5);
const far = worker('tinka', T + FAR + 1.5, T + 0.5);
for (const c of [holla, sedra, tinka, far]) step(c);

const says = (idle: Idle | null | undefined, c: Creature): string => (idle ? idleSays(idle, SPECIES[c.species].gathers as GatherKind) : '');
const same = (what: string, key: string, c: Creature, want: IdleWhy, sentence: string): void => {
  const there = islandIdle(key);
  const here = c.idle;
  check(`${what}: "${sentence}" on both sides`,
    there?.why === want && here?.why === want && says(there, c) === sentence && says(here, c) === sentence,
    `${isle.get(key)} / ${here?.why}|${here?.n} — ${says(there, c)} / ${says(here, c)}`);
};

same('a water carrier with a full bucket and no barrel', 'HOLLA', holla, 'room', 'Idle: no barrel on the settlement has room for water.');
const reach = workRangeOf(sedra, SPECIES.sedra);
same(`a reed cutter with no reed bed within its ${reach} tiles`, 'SEDRA', sedra, 'range', `Idle: no reed bed within ${reach} tiles of the totem.`);
check('the range in the reason is its own at its level, on both sides',
  islandIdle('SEDRA')?.n === reach && Number((isle.get('SEDRA') ?? '').split('|')[2]) === reach && sedra.idle?.n === reach, `${isle.get('SEDRA')} / ${reach}`);
same('a mender with nothing in the stores', 'TINKA', tinka, 'stock', 'Idle: nothing in your settlement stores to mend.');
const dist = Math.round(Math.hypot(FAR + 1, 0));
same(`a worker ${FAR} tiles from its work`, 'FAR', far, 'far', `Idle: walking home, ${dist} tiles from its work.`);
check(`and only past its range and ${HOME_SLACK} more, the island's \`home_slack\``, Number(isle.get('SLACK')) === HOME_SLACK, isle.get('SLACK'));

check('a reason is cleared when it sets out to work: a barrel with room, and the water carrier is off to it',
  (isle.get('HOLLA2') ?? '').startsWith('null|') && (isle.get('HOLLA2') ?? '') !== 'null|idle', isle.get('HOLLA2'));
{
  // And in the browser, a barrel with room and a full bucket in its arms.
  g.addFurniture('barrel', T + 3, T, 0, 0, 40, []);
  holla.carrying = { uid: g.inventory.nextUid++, id: 'water_bucket', ql: 40, dmg: 0, count: 1 };
  step(holla);
  check('and in the browser, the same', holla.idle === null, `${holla.idle?.why}`);
}

const reachN = Number(isle.get('REACH'));
const tinkaKind = SPECIES.tinka.gathers as GatherKind;
check('a worker whose keeper is away is not worked, and says so',
  islandIdle('AWAY')?.why === 'away' && idleSays(islandIdle('AWAY')!, tinkaKind) === 'Idle: keeper away.', isle.get('AWAY'));
check(`one whose keeper is awake but more than ${reachN} tiles from it is not worked either, and says that`,
  islandIdle('UNSWEPT')?.why === 'unswept'
    && idleSays(islandIdle('UNSWEPT')!, tinkaKind) === `Idle: nobody awake within ${reachN} tiles.`, isle.get('UNSWEPT'));
check(`the reach is the ${reachN} tiles \`world_tick\` sweeps the tame round everybody awake: forty and \`leg_slack\``, isle.get('TICK') === 'true', isle.get('TICK'));
check('a worker being worked is sent as it was stored, with its ledger for its keeper',
  isle.get('SENT') === `range|${reach}|true`, isle.get('SENT'));
check(`and your own workers are sent wherever they are: the one ${FAR} tiles off`, isle.get('SENTFAR') === 'true', isle.get('SENTFAR'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na worker says why it is idle — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
