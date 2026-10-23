/**
 * A wildermon crate in a store says who is in it.
 *
 * Asked for: "Add wildermon names to wildermon crates when in all storage spots like stalls". A piece's things
 * (`rpc_ground`), a crate's things (`crates_near`) and a shop counter's goods (`counter_json`) carry the crate's
 * `creature` and its name (`occupant`, `occupant_name`); the browser keeps it on the item (`storedThing`,
 * `Counters.saw`) and names the crate by it (`itemName`), where the wildermon may be somebody else's and unknown to it.
 *
 * Runs against the database the suite leaves behind. The island's half is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { storedThing } from '../../src/game/game';
import { Counters } from '../../src/game/counters';
import { itemDef, itemName } from '../../src/game/items';

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

/* ---- the island ------------------------------------------------------------ */

const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; c int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Occupants', 183, 20, 10, 10, true) returning id into w;
  c := creature_spawn(w, 'sparra', 5.5, 5.5, 'wild', now() - interval '30 days');
  update creature set name = 'Biscuit' where world_id = w and id = c;
  insert into said values ('NAME', occupant_name(w, c)), ('NONE', coalesce(occupant_name(w, -1), 'null'));
end $$;
${['rpc_ground', 'crates_near', 'counter_json'].map((fn) => `insert into said values ('F:${fn}', pg_get_functiondef('${fn}'::regproc));`).join('\n')}
select k || '=' || replace(v, E'\\n', ' ') from said order by k;
rollback;
`);
const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

check('occupant_name is the wildermon\'s name', island('NAME') === 'Biscuit', island('NAME'));
check('and nothing for no wildermon', island('NONE') === 'null', island('NONE'));
const OCC = "'occupant', case when i.creature is not null then occupant_name(i.world_id, i.creature) end";
for (const fn of ['rpc_ground', 'crates_near', 'counter_json']) {
  const def = island(`F:${fn}`);
  check(`${fn} sends each thing's creature and occupant`, def.includes(OCC) && def.includes("'creature', i.creature"));
}

/* ---- the browser ----------------------------------------------------------- */

const crate = itemDef('creature_crate').name;
const stored = storedThing({ id: 1, def: 'creature_crate', ql: 30, dmg: 0, count: 1, extra: null, creature: 77, occupant: 'Biscuit' });
check('a stored crate keeps its wildermon and its name', stored.creature === 77 && stored.occupant === 'Biscuit');
check(`and is named by it: ${itemName(stored)}`, itemName(stored) === `${crate} (Biscuit)`, itemName(stored));
const empty = storedThing({ id: 2, def: 'creature_crate', ql: 30, dmg: 0, count: 1, extra: null });
check('an empty one is named as before', itemName(empty) === crate, itemName(empty));
const counters = new Counters();
counters.saw({ id: 5, x: 3, y: 3, sub: 'n', goods: [{ id: 3, def: 'creature_crate', ql: 30, dmg: 0, count: 1, extra: null, price: 100, creature: 78, occupant: 'Pip' }] });
const good = counters.list.get(5)?.items[0];
check('a crate on a counter is named by its wildermon', !!good && itemName(good) === `${crate} (Pip)`, good ? itemName(good) : 'none');

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a stored wildermon crate says who is in it — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
