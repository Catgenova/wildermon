/**
 * A well's water reaches the browser as it stands now, not as it stood at its last draw.
 *
 * Reported with a screenshot: a well beside the dough recipe counted as "1 L + 0.00098 L stored". The island kept a
 * well's litres as of its last draw and the moment of that draw (`since`), worked out what is in it now
 * (`placed_litres`) for every draw and refusal, and sent the browser the stored litres without the moment
 * (`rpc_ground`): a drawn-down well read as empty however long it had been refilling.
 *
 * So this asks, of a well drawn dry a hundred seconds ago, that what the island sends is what it holds now: its draw
 * (`well_rate`, the browser's `WELL_TRICKLE` and `WELL_TRICKLE_QL`) times a hundred seconds; and of one drawn dry a day
 * ago, that it reads full.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { WELL_HOLDS, WELL_TRICKLE, WELL_TRICKLE_AT, WELL_TRICKLE_QL } from '../../src/game/furniture';

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

const QL = 40;
const AGO = 100;
const out = psql(`begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; px double precision; py double precision; v_soon bigint; v_long bigint; g jsonb;
begin
  select id into w from world where name = 'Faraway';
  select uid, x, y into me, px, py from player where world_id = w and name = 'Ivar';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, liquid, since)
    values (w, 'furniture', 'well', floor(px)::int + 2, floor(py)::int, 0, 0, floor(px) + 2.5, floor(py) + 0.5, ${QL}, me, 0, 'water',
            now() - interval '${AGO} seconds') returning id into v_soon;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, liquid, since)
    values (w, 'furniture', 'well', floor(px)::int - 3, floor(py)::int, 0, 0, floor(px) - 2.5, floor(py) + 0.5, ${QL}, me, 0, 'water',
            now() - interval '1 day') returning id into v_long;
  g := rpc_ground(w, 40, false);
  insert into said select 'SOON', (e->>'litres') from jsonb_array_elements(g->'placed') e where (e->>'id')::bigint = v_soon;
  insert into said select 'LONG', (e->>'litres') from jsonb_array_elements(g->'placed') e where (e->>'id')::bigint = v_long;
end $$;
select k || '|' || coalesce(v, '-') from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));

const rate = WELL_TRICKLE + (QL / WELL_TRICKLE_AT) * WELL_TRICKLE_QL;
const soon = Number(said.get('SOON'));
check(`a well drawn dry ${AGO} s ago is sent with what it has drawn since: ${(rate * AGO).toFixed(2)} L`,
  Math.abs(soon - rate * AGO) < rate * 2, `sent ${said.get('SOON')}`);
check(`and one drawn dry a day ago is sent full: ${WELL_HOLDS} L`, Number(said.get('LONG')) === WELL_HOLDS, `sent ${said.get('LONG')}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a well's water reaches the browser as it stands — ${ok.length} of ${ok.length}`);
