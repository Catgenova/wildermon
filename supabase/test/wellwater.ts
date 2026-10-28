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
 * Reported again: a full well read "200 / 200 litres of empty", and dough still would not make beside it. A well drawn
 * dry keeps no liquid in its row; the island counts it as water (`placed_liquid`) and now sends that. So the well
 * drawn dry a day ago here has no liquid in its row, and this asks that it is sent as water, and that the browser,
 * reading what the island sent (`sawGround`), has it as water and counts its litres toward a recipe's (`litreSources`).
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { WELL_HOLDS, WELL_TRICKLE, WELL_TRICKLE_AT, WELL_TRICKLE_QL } from '../../src/game/furniture';
import { Game, type IslandGround } from '../../src/game/game';
import { litreSources } from '../../src/game/placeables';

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
    values (w, 'furniture', 'well', floor(px)::int - 3, floor(py)::int, 0, 0, floor(px) - 2.5, floor(py) + 0.5, ${QL}, me, 0, null,
            now() - interval '1 day') returning id into v_long;
  g := rpc_ground(w, 40, false);
  insert into said select 'SOON', (e->>'litres') from jsonb_array_elements(g->'placed') e where (e->>'id')::bigint = v_soon;
  insert into said select 'LONG', (e->>'litres') from jsonb_array_elements(g->'placed') e where (e->>'id')::bigint = v_long;
  insert into said select 'LONGLIQUID', coalesce(e->>'liquid', '-') from jsonb_array_elements(g->'placed') e where (e->>'id')::bigint = v_long;
  insert into said values ('LONGID', v_long::text), ('AT', floor(px) || ',' || floor(py)), ('GROUND', g::text);
end $$;
select k || '|' || coalesce(v, '-') from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));

const rate = WELL_TRICKLE + (QL / WELL_TRICKLE_AT) * WELL_TRICKLE_QL;
const soon = Number(said.get('SOON'));
check(`a well drawn dry ${AGO} s ago is sent with what it has drawn since: ${(rate * AGO).toFixed(2)} L`,
  Math.abs(soon - rate * AGO) < rate * 2, `sent ${said.get('SOON')}`);
check(`and one drawn dry a day ago is sent full: ${WELL_HOLDS} L`, Number(said.get('LONG')) === WELL_HOLDS, `sent ${said.get('LONG')}`);
check('and as water, with no liquid left in its row (`placed_liquid`)', said.get('LONGLIQUID') === 'water', `sent ${said.get('LONGLIQUID')}`);
{
  const seen = Game.create(4242, 64);
  const [ax, ay] = (said.get('AT') ?? '0,0').split(',').map(Number);
  seen.player.x = ax + 0.5;
  seen.player.y = ay + 0.5;
  seen.sawGround(JSON.parse(said.get('GROUND') ?? '{}') as IslandGround);
  const well = seen.furniture.get(Number(said.get('LONGID')));
  check('the browser reads it as a full well of water', well?.liquid === 'water' && well?.litres === WELL_HOLDS, `${well?.litres} of ${well?.liquid}`);
  const water = litreSources(seen, 'water_bucket', 5, []).reduce((n, src) => n + src.litres, 0);
  check(`and counts its ${WELL_HOLDS} litres toward a recipe's water within reach`, water >= WELL_HOLDS, `${water} L`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a well's water reaches the browser as it stands — ${ok.length} of ${ok.length}`);
