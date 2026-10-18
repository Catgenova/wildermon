/**
 * Skills past a hundred.
 *
 * Asked for: "Allow skills to continue to gain exp above 100.00 on a
 * exponential 2^. This is for leaderboard purpose only". This asks, of both
 * sides, that a go is worth the same as it was up to `SKILL_TOP` and is divided
 * by `PAST_TOP` for every point past it; that a raise at the top goes on past
 * it; that everything that uses the skill reads it no higher than the top; and
 * that the boards read the whole of it.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { PAST_TOP, SKILL_TOP, skillGain } from '../../src/game/skills';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/* ---- on the island ----------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000f8';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Past the top', 178, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into said values ('NUMBERS', skill_top() || '|' || past_top());
  insert into said select 'GAINS', string_agg(skill_gain_of(v, 1, 1)::text, '|' order by v) from unnest(array[50, 99.5, 100, 100.5, 101.5, 103]::double precision[]) v;
  -- At the top, raised over and over with a big go.
  insert into skill (world_id, uid, id, value) values (w, u, 'mining', ${SKILL_TOP} - 0.00001)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for i in 1..40 loop perform skill_raise(w, u, 'mining', 2000); end loop;
  insert into said select 'RAISED', skill_standing(w, u, 'mining') || '|' || skill_of(w, u, 'mining');
  insert into said select 'BOARD', b->'skills'->'mining'->0->>'value' from rpc_boards(w) b;
  insert into said select 'TOLD', text from event where world_id = w and uid = u and text like 'Mining increased%' order by n desc limit 1;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check(`the top is ${SKILL_TOP} and a go past it is divided by ${PAST_TOP} a point, on both sides`, at('NUMBERS') === `${SKILL_TOP}|${PAST_TOP}`, at('NUMBERS'));
const vs = [50, 99.5, 100, 100.5, 101.5, 103];
const isleGains = at('GAINS').split('|').map(Number);
check('a go is worth the same on both sides, under the top and past it', vs.every((v, i) => near(isleGains[i], skillGain(v, 1, 1))),
  `${isleGains.join(',')} / ${vs.map((v) => skillGain(v, 1, 1)).join(',')}`);
check(`and past the top each point halves it: ${PAST_TOP} times less at 101.5 than at 100.5, ${PAST_TOP ** 3} times less at 103 than at 100`,
  near(skillGain(100.5, 1, 1) / skillGain(101.5, 1, 1), PAST_TOP) && near(skillGain(100, 1, 1) / skillGain(103, 1, 1), PAST_TOP ** 3));
const [standing, used] = at('RAISED').split('|').map(Number);
check(`on the island a skill raised at the top goes on past it, and what uses it reads ${SKILL_TOP}`, standing > SKILL_TOP && used === SKILL_TOP, at('RAISED'));
check('the board reads the whole of it', Number(at('BOARD')) === standing, `${at('BOARD')} vs ${standing}`);
check('and a raise says what it came to', at('TOLD').includes(` to ${standing.toFixed(4)}.`), at('TOLD'));

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4255);
g.skills.values.set('mining', SKILL_TOP - 0.00001);
for (let i = 0; i < 40; i++) g.gainSkill('mining', 2000);
check(`in the browser a skill raised at the top goes on past it, and what uses it reads ${SKILL_TOP}`,
  g.skills.standing('mining') > SKILL_TOP && g.skills.get('mining') === SKILL_TOP, `${g.skills.standing('mining')} ${g.skills.get('mining')}`);
check('and is saved whole', (g.skills.toJSON().mining ?? 0) > SKILL_TOP);
check('and a raise says what it came to', g.log.some((e) => e.text.includes(` to ${g.skills.standing('mining').toFixed(4)}.`)));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nskills past a hundred — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
