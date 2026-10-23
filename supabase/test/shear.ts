/**
 * A tame woola is sheared, from its own menu, the same on both sides.
 *
 * Shear was written on both sides and never put on a creature's menu, and
 * `rpc_creatures` never sent the browser how much fleece had grown back, so
 * the browser could not have said whether it was ready if it had been. This
 * asks that:
 *
 *   * the island sends a keeper its own creature's fleece, and nobody else's;
 *   * the browser takes that fleece off the row it is sent;
 *   * Shear is refused in the same words on both sides for no knife and for a
 *     fleece not grown back enough, and allowed when it is;
 *   * a full fleece sheared gives the wool the browser says, and starts again.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { SHEAR_FROM, SHEAR_WOOL } from '../../src/game/creatureActions';
import type { IslandCreature } from '../../src/game/creatures';

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

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '5bea7000-0000-4000-8000-0000000000a1';
const HILD = '5bea7000-0000-4000-8000-0000000000b2';
const at = "jsonb_build_object('kind', 'creature', 'id', v_w)";
const refusal = `coalesce(act_refusal(w, u, 'shear', ${at}), 'none')`;
const as = (uid: string): string => `perform set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, true);`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_w int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Shearing', 163, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  ${as(HILD)}
  perform rpc_join(w, 'Hild');
  ${as(MIRA)}
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb
   where world_id = w;
  select creature_spawn(w, 'woola', 10.5, 9.5, 'active', now() - interval '10 days', u) into v_w;
  update creature set mode = 'active', keeper = u, traits = '{}', fleece = 0.2, leg_at = now(), leg_ends = now(),
         from_x = 10.5, from_y = 9.5, to_x = 10.5, to_y = 9.5, until = now() + interval '1 hour', settled_at = now()
   where world_id = w and id = v_w;
  insert into said values ('ID', v_w::text);

  insert into said values ('ROW', (select r::text from jsonb_array_elements(rpc_creatures(w)) r where (r->>'id')::int = v_w));
  ${as(HILD)}
  insert into said values ('HILD', coalesce((select (r ? 'fleece')::text from jsonb_array_elements(rpc_creatures(w)) r where (r->>'id')::int = v_w), 'unseen'));
  ${as(MIRA)}

  insert into said values ('R:knife', ${refusal});
  perform give(w, u, 'carving_knife', 1, 40);
  insert into said values ('R:low', ${refusal});
  update creature set fleece = 1 where world_id = w and id = v_w;
  insert into said values ('R:ready', ${refusal});
  perform act_perform(w, u, 'shear', ${at});
  insert into said values ('SHORN', coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = 'wool'), 0)::text
    || '|' || (select fleece from creature where world_id = w and id = v_w)::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const row = JSON.parse(isle.get('ROW') ?? '{}') as IslandCreature & { fleece?: number };

check('the island sends a keeper how much of its own woola\'s fleece has grown back', row.fleece !== undefined && Math.abs(row.fleece - 0.2) < 1e-6, String(row.fleece));
check('and nobody else', isle.get('HILD') === 'false', isle.get('HILD') ?? '');

/* ---- in the browser --------------------------------------------------------------- */

const g = Game.create(4243);
g.player.x = 20.5;
g.player.y = 20.5;
const c = g.creatures.spawn('woola', 20.5, 19.5, 'active');
c.fleece = 0.9;
// The island's row for it, as the browser is handed one: its fleece is the island's.
g.creatures.sawAll([{ ...row, id: c.id, x: 20.5, y: 19.5 } as IslandCreature], g.time);
const seen = g.creatures.get(c.id);
check('the browser takes the fleece off the row the island sends', !!seen && Math.abs(seen.fleece - 0.2) < 1e-6, String(seen?.fleece));

const shear = ACTION_BY_ID.get('shear');
const t: Target = { kind: 'creature', id: c.id };
const here = (): string => shear?.check?.(t, g) ?? 'none';
check('Shear is offered for a tame woola', !!shear && shear.applies(t, g));
for (const it of g.inventory.items.filter((i) => i.id === 'carving_knife')) g.inventory.remove(it.uid, it.count);
const knife = here();
check('no knife: the same words on both sides', knife === isle.get('R:knife'), `${knife} / ${isle.get('R:knife')}`);
g.inventory.add('carving_knife', { ql: 40 });
const low = here();
check(`under ${SHEAR_FROM * 100}% grown back: the same words on both sides`, low === isle.get('R:low'), `${low} / ${isle.get('R:low')}`);
if (seen) seen.fleece = 1;
check('grown back: allowed on both sides', here() === 'none' && isle.get('R:ready') === 'none', `${here()} / ${isle.get('R:ready')}`);
const [wool, after] = (isle.get('SHORN') ?? '').split('|');
check(`a full fleece gives ${SHEAR_WOOL} wool and starts again from nothing`, Number(wool) === SHEAR_WOOL && Number(after) === 0, isle.get('SHORN') ?? '');

/* ---- and on the menu ---------------------------------------------------------------- */

const ui = readFileSync('src/ui/ui.ts', 'utf8');
const menu = ui.slice(ui.indexOf('private creatureEntries('), ui.indexOf('private creatureEntries(') + 6000);
check('Shear is on a creature\'s menu', menu.includes("push(item('shear'))"));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na tame woola is sheared from its menu — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
