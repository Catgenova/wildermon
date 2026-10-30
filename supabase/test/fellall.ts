/**
 * A felling worker carries every log of the tree home.
 *
 * Asked: "Fix the woodcutting wildermon to carry all logs to storage on cut down instead of just 1". A Sapgnaw's
 * felling (`worker_do`, 'woodcut'; the browser's `finishFelling`) handed it one log and dropped the rest at the stump.
 * So this fells, on both sides, the tree of the age with the most logs, its last notch the worker's, and asks:
 *
 *   * the load the worker carries is every log of the tree;
 *   * and none is left on the ground at the stump.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { packTreeData, TileType, TREE_AGES } from '../../src/world/tiles';
import type { Item } from '../../src/game/items';

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

/** The age with the most logs, and its logs. */
const AGE = TREE_AGES.reduce((best, a, i) => (a.logs > TREE_AGES[best].logs ? i : best), 0);
const LOGS = TREE_AGES[AGE].logs;
const KEEPER = '11111111-1111-1111-1111-111111111111';
const TX = 2100, TY = 2100;

const out = psql(`begin;
create temp table said (k text, v text);
do $t$
declare w uuid; v_c int; v_age tree_age_def; r jsonb;
begin
  select id into w from world where name = 'Bigness';
  select * into v_age from tree_age_def where id = ${AGE};
  perform land_set_tile(w, ${TX}, ${TY}, tile_id('Tree'));
  perform land_set_data(w, ${TX}, ${TY}, tree_pack(2, ${AGE}));
  perform tree_notch(w, ${TX}, ${TY}, v_age.hits - 1);
  delete from item where world_id = w and holder = 'ground' and gx = ${TX} and gy = ${TY};
  v_c := creature_spawn(w, 'bevere', ${TX + 1}.5, ${TY}.5, 'active', now() - interval '60 days', '${KEEPER}');
  update creature set mode = 'deed', job = 'woodcut', work_x = ${TX}, work_y = ${TY} where world_id = w and id = v_c;
  r := worker_do(w, v_c);
  insert into said values ('LOAD', coalesce(r->>'def', '-') || ':' || coalesce(r->>'count', '-'));
  insert into said select 'GROUND', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'ground' and gx = ${TX} and gy = ${TY};
  insert into said values ('TILE', land_tile(w, ${TX}, ${TY}) = tile_id('Stump'));
end $t$;
select k || '=' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] as [string, string]; }));
const at = (k: string): string => said.get(k) ?? '?';

check(`on the island, a felled tree of ${LOGS} logs: the worker carries all ${LOGS}`, at('LOAD') === `log:${LOGS}`, at('LOAD'));
check('and none is left on the ground at the stump', at('GROUND') === '0' && at('TILE') === 'true', `${at('GROUND')} on the ground; stump ${at('TILE')}`);

/* ---- in the browser ------------------------------------------------------------------ */
{
  const g = Game.create(4271);
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  g.world.setTile(20, 20, TileType.Tree, packTreeData(2, AGE));
  g.world.setNotch(20, 20, TREE_AGES[AGE].hits - 1);
  const c = g.creatures.spawn('bevere', 21.5, 20.5, 'active', g.rand, g.time - 3600 * 24 * 60);
  c.workX = 20;
  c.workY = 20;
  const got = (g.creatures as unknown as { finishFelling(g: Game, c: unknown): Item | null }).finishFelling(g, c);
  const ground = g.groundAt(20, 20).filter((it) => it.id === 'log').reduce((n, it) => n + it.count, 0);
  check(`in the browser, a felled tree of ${LOGS} logs: the worker carries all ${LOGS}`, got?.id === 'log' && got.count === LOGS, `${got?.id}:${got?.count}`);
  check('and none is left on the ground at the stump', ground === 0 && g.world.getTile(20, 20) === TileType.Stump, `${ground} on the ground`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`a felling worker carries every log home — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
