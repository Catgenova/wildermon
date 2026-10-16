/**
 * Flattening wears the shovel.
 *
 * Reported: "Flattening, 2x shovel, both not taking any dmg". On an island a
 * go at flattening wore no shovel at all, one or two of them: `perform_ground`
 * wore its tool in most of its branches, and five were written without it.
 * This asks, of both sides, that every go at flattening wears the best shovel
 * in the pack by the same amount a dig does, so two shovels share the work
 * between them; and of the island, that every job on the ground with a tool
 * wears it.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game, wearPerUse } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

const QL = 30;
const GOES = 4;
const PER_GO = wearPerUse(QL);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000c1';
const island = (shovels: number): string => psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Level', 173, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 10.5, y = 10.5, stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;
  for i in 1..${shovels} loop perform give(w, u, 'shovel', 1, ${QL}); end loop;
  -- A shoulder of soil on the east side of the tile beside you, six high.
  perform land_set_height(w, 12, 10, land_height(w, 12, 10) + 6);
  perform land_set_height(w, 12, 11, land_height(w, 12, 11) + 6);
  for i in 1..${GOES} loop
    perform act_perform(w, u, 'flatten', jsonb_build_object('kind', 'tile', 'x', 11, 'y', 10));
  end loop;
  insert into said select 'WORN', string_agg(dmg::text, '|' order by id) from item where world_id = w and holder_uid = u and def = 'shovel';
  insert into said select 'DIRT', coalesce(sum(count), 0)::text from item where world_id = w and holder_uid = u and def = 'dirt';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const read = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const one = read(island(1));
const two = read(island(2));
const wornOne = (one.get('WORN') ?? '').split('|').map(Number);
const wornTwo = (two.get('WORN') ?? '').split('|').map(Number);
check('on the island, the goes moved ground', Number(one.get('DIRT')) === GOES && Number(two.get('DIRT')) === GOES, `${one.get('DIRT')} / ${two.get('DIRT')}`);
check(`on the island, ${GOES} goes at flattening wear one shovel ${GOES} times a dig's wear`,
  wornOne.length === 1 && near(wornOne[0], GOES * PER_GO), `${one.get('WORN')}, a go is ${PER_GO.toFixed(4)}`);
check('and two shovels share the same wear between them, half each',
  wornTwo.length === 2 && wornTwo.every((d) => near(d, (GOES / 2) * PER_GO)), two.get('WORN'));

/*
 * And every other job on the ground with a tool: its branch of `perform_ground`
 * wears that tool, or hands the go to a function of its own that does. Four
 * more were found wearing nothing when flattening was: bedding and taking up
 * paving, cutting reeds and prospecting.
 */
const ground = psql(`select pg_get_functiondef('perform_ground'::regproc)`);
const jobs = psql(`select string_agg(id || ':' || tool, ' ') from action_def where tool is not null and ground_action(id)`)
  .split(' ').filter(Boolean).map((j) => j.split(':') as [string, string]);
const heads = [...ground.matchAll(/\n {2}(?:if|elsif) p_action (?:= '([a-z_]+)'|in \(([^)]*)\)) then/g)];
const branch = (job: string): string | null => {
  const i = heads.findIndex((h) => (h[1] ?? h[2] ?? '').match(/[a-z_]+/g)?.includes(job));
  if (i < 0) return null;
  return ground.slice(heads[i].index, heads[i + 1]?.index ?? ground.length);
};
const idle = jobs.filter(([job]) => {
  const b = branch(job);
  return b === null || !/wear_tool\(|perform perform_[a-z_]+\(/.test(b);
});
check(`on the island, every one of the ${jobs.length} jobs on the ground with a tool wears it`, jobs.length > 5 && !idle.length,
  idle.map(([j, t]) => `${j} (${t})`).join(', ') || 'all of them');

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4249);
for (const it of [...g.inventory.items]) if (it.id === 'shovel') g.inventory.remove(it.uid, it.count);
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
const [X, Y] = [Math.floor(g.player.x), Math.floor(g.player.y)];
const shovels = [g.inventory.add('shovel', { ql: QL }), g.inventory.add('shovel', { ql: QL })];
for (const [cx, cy] of [[X + 2, Y], [X + 2, Y + 1]]) {
  g.world.setHeight(cx, cy, g.world.getHeight(cx, cy) + 6);
  g.world.setDirt(cx, cy, g.world.getDirt(cx, cy) + 6);
}
const flatten = ACTION_BY_ID.get('flatten');
const at = { kind: 'tile', x: X + 1, y: Y } as Target;
check('in the browser, the tile wants flattening', !!flatten?.applies?.(at, g) && (flatten?.check?.(at, g) ?? null) === null, String(flatten?.check?.(at, g)));
if (flatten) {
  g.requestAction(flatten, at, GOES);
  for (let t = 0; t < 800 && (g.action || g.queue.length); t++) {
    g.player.stats.stamina = 1;
    g.update(0.25);
  }
}
const wornHere = shovels.map((s) => s.dmg);
check('in the browser, the same goes wear the two shovels the same, half each',
  wornHere.every((d) => near(d, (GOES / 2) * PER_GO)), wornHere.map((d) => d.toFixed(4)).join('|'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nflattening wears the shovel — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
