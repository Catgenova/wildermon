/**
 * Body stamina makes the stamina bar bigger.
 *
 * Asked for: "Body stamina should also increase the bar. 2x at 100". Stamina is
 * kept as a share of the bar, so what is spent and what comes back is divided
 * by its size. Asked of both sides:
 *
 *   * the bar is 1 at the starting mark and 2 at a hundred, and the same number
 *     at every level on both sides (`staminaBar`, `stamina_bar`);
 *   * a dig takes the same share of a full bar in the browser as on the island,
 *     and at a hundred that share is the cost (less for the hardier body) over
 *     a bar twice the size;
 *   * a second standing still puts back the same share on both sides, over the
 *     bigger bar.
 *
 * The island half runs in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { CHAR_START, Game } from '../../src/game/game';
import { SKILL_TOP } from '../../src/game/skills';
import { WIND_REST } from '../../src/game/body';
import { ACTION_BY_ID } from '../../src/game/actions';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

const LEVELS = [CHAR_START, 60, SKILL_TOP];
const g = Game.create(4242);
const dig = ACTION_BY_ID.get('dig')!;

/* ---- the browser ---------------------------------------------------------- */
const mine = LEVELS.map((L) => {
  g.skills.values.set('body_stamina', L);
  const bar = g.staminaBar();
  return { L, bar, spend: g.staminaCost(dig.stamina) / bar, rest: (WIND_REST * g.windRegen()) / bar };
});
check(`the bar is 1 at ${CHAR_START} and 2 at ${SKILL_TOP}`, near(mine[0].bar, 1) && near(mine[2].bar, 2), mine.map((m) => `${m.L}: ${m.bar}`).join(', '));
check(`a dig at ${SKILL_TOP} takes its cost over a bar twice the size`, near(mine[2].spend, g.staminaCost(dig.stamina) / 2), String(mine[2].spend));

/* ---- the island ----------------------------------------------------------- */
const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '33333333-3333-3333-3333-333333333333'; L double precision; before double precision; after double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Bar', 181, 64, 32, 32, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Ash');
  foreach L in array array[${LEVELS.join(', ')}]::double precision[] loop
    insert into skill (world_id, uid, id, value) values (w, u, 'body_stamina', L)
      on conflict (world_id, uid, id) do update set value = excluded.value;
    insert into said values ('bar' || L, stamina_bar(w, u)::text);
    -- A dig from a full bar.
    update player set stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'), body_at = now(), act = null
     where world_id = w and uid = u;
    perform spend_wind(w, u, 'dig');
    select (stats->>'stamina')::double precision into after from player where world_id = w and uid = u;
    insert into said values ('spend' || L, (1 - after)::text);
    -- And a second standing still, from an empty one, fed and watered.
    update player set stats = stats || '{"stamina": 0, "hunger": 1, "thirst": 1}'::jsonb,
        body_at = now() - interval '1 second', moved_at = now() - interval '1 hour', act = null
     where world_id = w and uid = u;
    perform body_settle(w, u);
    select (stats->>'stamina')::double precision into after from player where world_id = w and uid = u;
    insert into said values ('rest' || L, after::text);
  end loop;
end $t$;
select k || '=' || v from said;
rollback;
`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), Number(l.slice(l.indexOf('=') + 1))]));
for (const m of mine) {
  const bar = isle.get(`bar${m.L}`) ?? NaN;
  const spend = isle.get(`spend${m.L}`) ?? NaN;
  const rest = isle.get(`rest${m.L}`) ?? NaN;
  check(`body stamina ${m.L}: the same bar on both sides`, near(bar, m.bar), `browser ${m.bar}, island ${bar}`);
  check(`body stamina ${m.L}: a dig takes the same share of it`, Math.abs(spend - m.spend) < 1e-6, `browser ${m.spend}, island ${spend}`);
  check(`body stamina ${m.L}: a second standing still puts back the same share`, Math.abs(rest - m.rest) < 2e-3, `browser ${m.rest}, island ${rest}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`body stamina grows the bar — ${ok.length} of ${ok.length}`);
