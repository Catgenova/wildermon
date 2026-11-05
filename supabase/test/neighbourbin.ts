/**
 * A worker fills its keeper's storage, and nobody else's.
 *
 * Reported: "Meri's oremander is bringing copper to my storage, fix". On the live island Meri's Oremander, a deed
 * worker of Meris Meadow, sent its copper to catgenova's raw material bin by Solara: the nearest bin within its
 * settlement's square, which reached over the bin, and a bin nobody marked a store and nobody locked is shut to no
 * hand. Beside a post and on the tile a load is put down on, the same.
 *
 * Ann's settlement at 20, 20 (5 out) and her raw bin at 24, 20; Bo's settlement at 34, 20, its square reaching to 24, and
 * his own bin at 40, 20; Bo's Oremander at 25, 20. Both sides: the load goes to Bo's bin, not Ann's nearer one; off a
 * post beside Ann's crate, not into her crate; put down on Ann's bin's tile, not into it. Ann's own worker still fills
 * Ann's bin, and with no bin of Bo's the load stays out of Ann's.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { type PlacedFurniture } from '../../src/game/furniture';
import { type PlacedCrate } from '../../src/game/crates';
import { type Creature } from '../../src/game/creatures';
import { type Item } from '../../src/game/items';

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

const ANN = 'd71c4a17-0000-4000-8000-0000000000a1';
const BO = 'd71c4a17-0000-4000-8000-0000000000b0';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; v_ann_bin bigint; v_bo_bin bigint; v_post bigint; c creature; r record;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Neighbours', 184, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', '${ANN}')::text, true);
  perform rpc_join(w, 'Ann');
  perform set_config('request.jwt.claims', json_build_object('sub', '${BO}')::text, true);
  perform rpc_join(w, 'Bo');
  perform land_set_tile(w, x, y, 0) from generate_series(0, 63) x, generate_series(0, 63) y;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Annstead', 20, 20, 5, 1, '${ANN}');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Bowick', 34, 20, 10, 1, '${BO}');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', 24, 20, 0, 0, 24.5, 20.5, 50, '${ANN}') returning id into v_ann_bin;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper)
    values (w, 9901, 'mola', 'Digger', 'deed', 25.5, 20.5, 25.5, 20.5, 40, 'male', '${BO}');
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper)
    values (w, 9902, 'mola', 'Ann''s digger', 'deed', 21.5, 20.5, 21.5, 20.5, 40, 'female', '${ANN}');

  -- Bo's worker with no bin of Bo's: not Ann's.
  select * into c from creature where world_id = w and id = 9901;
  insert into said select 'NONE', coalesce((select s.kind || ':' || s.id from worker_store(w, c, 'copper_ore', 1) s limit 1), 'nowhere');
  insert into said values ('ANN_BIN', 'furniture:' || v_ann_bin);

  -- With his own bin at 40, 20: there, not Ann's nearer one.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', 40, 20, 0, 0, 40.5, 20.5, 50, '${BO}') returning id into v_bo_bin;
  insert into said values ('BO_BIN', 'furniture:' || v_bo_bin);
  insert into said select 'HOME', coalesce((select s.kind || ':' || s.id from worker_store(w, c, 'copper_ore', 1) s limit 1), 'nowhere');

  -- Ann's own worker: Ann's bin, as before.
  select * into c from creature where world_id = w and id = 9902;
  insert into said select 'ANNS', coalesce((select s.kind || ':' || s.id from worker_store(w, c, 'copper_ore', 1) s limit 1), 'nowhere');

  -- Put down on Ann's bin's tile by Bo's worker: not into it.
  select * into c from creature where world_id = w and id = 9901;
  perform worker_put(w, c, 'copper_ore', 3, 30, 24, 20);
  insert into said select 'PUT_ANN', coalesce((select sum(count) from item where world_id = w and holder = 'furniture' and inside is null
     and placed = v_ann_bin and def = 'copper_ore'), 0)::text;
  insert into said select 'PUT_BO', coalesce((select sum(count) from item where world_id = w and holder = 'furniture' and inside is null
     and placed = v_bo_bin and def = 'copper_ore'), 0)::text;

  -- Off a post beside Ann's crate: not into her crate.
  delete from placed where id = v_bo_bin;
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by, material) values (w, 77, 'plank', 22, 21, 1, 1, false, '${ANN}', 'pine');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'post', 'post', 22, 22, 0, 0, 22.5, 22.5, 50, '${BO}') returning id into v_post;
  update creature set post = v_post where world_id = w and id = 9901;
  select * into c from creature where world_id = w and id = 9901;
  insert into said select 'POST', coalesce((select s.kind || ':' || s.id from worker_store(w, c, 'copper_ore', 1) s limit 1), 'nowhere');

  -- Working around Bo beside Ann's bin and crate (\`around_stores\`): neither, but his own wagon there.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'wagon', 25, 22, 0, 0, 25.5, 22.5, 50, '${BO}') returning id into v_post;
  insert into said values ('WAGON', 'furniture:' || v_post);
  insert into said select 'AROUND_BO', coalesce(string_agg(s.kind || ':' || s.id, ',' order by s.kind, s.id), 'none')
    from around_stores(w, '${BO}', 23, 21, 6) s;
  insert into said select 'AROUND_ANN', coalesce(string_agg(s.kind || ':' || s.id, ',' order by s.kind, s.id), 'none')
    from around_stores(w, '${ANN}', 23, 21, 6) s;
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('island: Bo\'s worker with no bin of his own sends nothing to Ann\'s', at('NONE') !== at('ANN_BIN'), `${at('NONE')} (Ann's ${at('ANN_BIN')})`);
check('island: with his own bin, to it rather than Ann\'s nearer one', at('HOME') === at('BO_BIN'), `${at('HOME')} (his ${at('BO_BIN')})`);
check('island: Ann\'s own worker still fills Ann\'s bin', at('ANNS') === at('ANN_BIN'), at('ANNS'));
check('island: put down on Ann\'s bin\'s tile, none goes into it: into his own', at('PUT_ANN') === '0' && at('PUT_BO') === '3', `Ann's ${at('PUT_ANN')}, his ${at('PUT_BO')}`);
check('island: off a post beside Ann\'s crate, not into the crate', at('POST') !== 'crate:77', at('POST'));
// Reported: "diglett is running to Cats place like Digimon was": a worker round its keeper filled the neighbour's bins.
check('island: working around Bo beside Ann\'s bin and crate, only his own wagon is his storage',
  at('AROUND_BO') === at('WAGON'), `${at('AROUND_BO')} (his wagon ${at('WAGON')})`);
check('island: working around Ann there, her bin and crate are hers',
  at('AROUND_ANN').split(',').includes(at('ANN_BIN')) && at('AROUND_ANN').split(',').includes('crate:77'), at('AROUND_ANN'));

/* ---- in the browser: Bo's game -------------------------------------------------------------------------------- */

const g = Game.create(184, 256);
g.crates.clear();
g.furniture.clear();
g.deed = { name: 'Bowick', x: 34, y: 20, radius: 10, mine: true, role: 'founder' } as typeof g.deed;
const piece = (id: number, x: number, mine: boolean): PlacedFurniture => {
  const f = { id, kind: 'bulk_bin', x, y: 20, sx: 0, sy: 0, ql: 50, items: [], mine } as unknown as PlacedFurniture;
  g.furniture.set(id, f);
  return f;
};
piece(501, 24, false);
const worker = { id: 9901, species: 'mola', x: 25.5, y: 20.5, mode: 'deed', keeper: 'me' } as unknown as Creature;
const ore: Item = { uid: 1, id: 'copper_ore', ql: 30, dmg: 0, count: 1 };
const where = (): string => {
  const s = g.creatures.storeFor(g, worker, ore);
  return s ? `${s.x},${s.y}` : 'nowhere';
};
check('browser: with no bin of his own, not Ann\'s', where() !== '24,20', where());
piece(502, 40, true);
check('browser: with his own bin, to it rather than Ann\'s nearer one', where() === '40,20', where());
const ann = { id: 77, kind: 'plank', x: 22, y: 21, sx: 1, sy: 1, items: [], mine: false } as unknown as PlacedCrate;
g.crates.set(77, ann);
check('browser: Ann\'s crate is not his worker\'s to fill', g.deedStores().every((s) => !(s.x === 22 && s.y === 21) || !s.workerMay), 'crate 77');
const round = g.aroundStores({ x: 23, y: 21, radius: 6 } as Parameters<typeof g.aroundStores>[0]);
check('browser: working around Bo there, neither Ann\'s bin nor her crate', round.every((s) => !(s.x === 24 && s.y === 20) && !(s.x === 22 && s.y === 21)),
  round.map((s) => `${s.x},${s.y}`).join(' ') || 'none');

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na worker fills its keeper's storage — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
