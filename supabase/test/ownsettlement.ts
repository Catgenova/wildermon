/**
 * A settlement's workers eat from its own stores and carry the hod to its own building work only.
 *
 * Asked: "my wildermon are travelling 200 tiles to eat from my neighbor's deed". A hungry worker ate out of the
 * stores of whatever settlement it stood on (`worker_feed`), anybody's. And asked for: a hod carrier fitted the
 * nearest planned work within its reach of its totem (`hod_needing`, `hod_needing_stocked`, `hod_wanted`), whoever's
 * settlement it was on; the browser's `hodStep` the same.
 *
 * So this asks, of Ivarholm (Ivar's, radius 5 round 2040,2040) and Hildstead (Hild's, round 2070,2070) on Bigness:
 *
 *   * an Ivarholm worker standing on Hildstead, hungry, with bread in a Hildstead crate and none at home, is not fed;
 *   * and with bread in an Ivarholm crate, wherever it stands, it is fed from that;
 *   * with Ivar a citizen of Hildstead too, its workers' stores are Ivarholm's alone (asked: "Bastiondrakes were
 *     travelling to Marcaronis house to eat": a hod carrier fetched from the nearest store on any settlement its keeper
 *     belonged to, and ate there), on the island (`deed_store_items`) and in the browser (`deedStores`);
 *   * planned work a tile past Ivarholm's edge, within an Ivarholm Brickling's reach, is not its work on the island,
 *     whether asked for what it holds or what the stores hold, and is not counted as wanted;
 *   * the same work a tile inside the edge is;
 *   * and in the browser the same: a hod carrier fits a plank into a wall inside its settlement, not one past its edge.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
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

const IVAR = '11111111-1111-1111-1111-111111111111';
const HILD = '22222222-2222-2222-2222-222222222222';
/** Ivarholm's token and radius: a tile past its edge, and a tile inside it, on its east. */
const IX = 2040, IY = 2040, R = 5;
const OUT = IX + R + 1, IN = IX + R;

const out = psql(`begin;
create temp table said (k text, v text);
do $t$
declare w uuid; v_c int; v_b int; v_k bigint; c creature;
begin
  select id into w from world where name = 'Bigness';
  -- An Ivarholm worker, hungry, standing on Hildstead.
  v_c := creature_spawn(w, 'cobbe', 2070.5, 2070.5, 'active', now() - interval '60 days', '${IVAR}');
  update creature set mode = 'deed', hunger = 0.05 where world_id = w and id = v_c;
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 9701, 'plank', 2071, 2070, 0, 0, true, '${HILD}');
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 9701, 'bread', 30, 3);
  insert into said values ('FED:theirs', coalesce(worker_feed(w, v_c), '-'));
  insert into said select 'LEFT:theirs', coalesce(sum(count), 0)::text from item where world_id = w and crate = 9701;
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 9702, 'plank', 2041, 2040, 0, 0, true, '${IVAR}');
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 9702, 'bread', 30, 3);
  insert into said values ('FED:own', coalesce(worker_feed(w, v_c), '-'));
  insert into said select 'LEFT:own', coalesce(sum(count), 0)::text from item where world_id = w and crate = 9702;
  -- Ivar a citizen of Hildstead too: its workers' stores are still Ivarholm's alone.
  insert into deed_member (world_id, founder, uid, role) values (w, '${HILD}', '${IVAR}', 'guest');
  insert into said select 'NEAREST', coalesce((select s.sid::text from store_holding(w, '${IVAR}', array['bread'], 2070.5, 2070.5) s), '-');
  insert into said select 'COUNT', stores_count(w, '${IVAR}', 'bread')::text;

  -- An Ivarholm Brickling's work: a planned plank wall a tile past the edge, then one a tile inside it.
  update creature set mode = 'deed', job = 'hod' where world_id = w and id = v_c;
  select * into c from creature where world_id = w and id = v_c;
  insert into said values ('REACH', work_range(c)::text);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 9702, 'plank', 30, 5);
  -- Nothing else planned within its reach, so what it picks is the wall here or nothing.
  delete from wall where world_id = w and x between ${IX} - 15 and ${IX} + 15 and y between ${IY} - 15 and ${IY} + 15;
  delete from floor_tile where world_id = w and x between ${IX} - 15 and ${IX} + 15 and y between ${IY} - 15 and ${IY} + 15;
  select coalesce(max(id), 0) + 1 into v_b from building where world_id = w;
  insert into building (world_id, id, name, planned_by) values (w, v_b, 'Shed', '${IVAR}');
  insert into building_tile (world_id, building, x, y) values (w, v_b, ${OUT}, ${IY});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 0, 'h', ${OUT}, ${IY}, v_b, 'solid', 'plank', '{"plank":2}', '{"plank":2}', '${IVAR}');
  insert into said select 'OUT:holding', coalesce((select h.x || ',' || h.y from hod_needing(w, ${IX}, ${IY}, work_range(c), 'plank', c.keeper) h), '-');
  insert into said select 'OUT:anyone', coalesce((select h.x || ',' || h.y from hod_needing(w, ${IX}, ${IY}, work_range(c), 'plank') h), '-');
  insert into said select 'OUT:stocked', coalesce((select h.x || ',' || h.y from hod_needing_stocked(w, c.keeper, ${IX}, ${IY}, work_range(c)) h), '-');
  insert into said select 'OUT:wanted', coalesce((select h.n from hod_wanted(w, ${IX}, ${IY}, work_range(c), c.keeper) h), 0)::text;
  update wall set x = ${IN} where world_id = w and building = v_b;
  update building_tile set x = ${IN} where world_id = w and building = v_b;
  insert into said select 'IN:holding', coalesce((select h.x || ',' || h.y from hod_needing(w, ${IX}, ${IY}, work_range(c), 'plank', c.keeper) h), '-');
  insert into said select 'IN:stocked', coalesce((select h.x || ',' || h.y from hod_needing_stocked(w, c.keeper, ${IX}, ${IY}, work_range(c)) h), '-');
  insert into said select 'IN:wanted', coalesce((select h.n from hod_wanted(w, ${IX}, ${IY}, work_range(c), c.keeper) h), 0)::text;
end $t$;
select k || '|' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));
const at = (k: string): string => said.get(k) ?? '(not said)';

check('on the island, an Ivarholm worker standing on Hildstead, with bread in a Hildstead crate and none at home, is not fed from it',
  at('FED:theirs') === '-' && at('LEFT:theirs') === '3', `${at('FED:theirs')} ${at('LEFT:theirs')}`);
check('and with bread in an Ivarholm crate, it is fed from that, wherever it stands', at('FED:own') === 'bread' && at('LEFT:own') === '2',
  `${at('FED:own')} ${at('LEFT:own')}`);
check('with its keeper a citizen of Hildstead too, the nearest store holding bread to a worker on Hildstead is Ivarholm\'s crate, not Hildstead\'s',
  at('NEAREST') === '9702', at('NEAREST'));
check('and the stores count only Ivarholm\'s bread', at('COUNT') === '2', at('COUNT'));
check(`the wall a tile past Ivarholm's edge is within an Ivarholm Brickling's reach (${at('REACH')} tiles)`,
  Number(at('REACH')) > R + 1 && at('OUT:anyone') === `${OUT},${IY}`, at('OUT:anyone'));
check('and is not its work: not for the plank it holds, not for the stores\' planks, and not counted as wanted',
  at('OUT:holding') === '-' && at('OUT:stocked') === '-' && at('OUT:wanted') === '0', `${at('OUT:holding')} ${at('OUT:stocked')} ${at('OUT:wanted')}`);
check('the same wall a tile inside the edge is its work, both ways, and counted',
  at('IN:holding') === `${IN},${IY}` && at('IN:stocked') === `${IN},${IY}` && Number(at('IN:wanted')) > 0,
  `${at('IN:holding')} ${at('IN:stocked')} ${at('IN:wanted')}`);

/* ---- in the browser ------------------------------------------------------------------ */

/** A settlement of radius 5 round 20,20, a crate of planks on it, a plank wall planned at a column: what a Brickling does in a minute. */
const hodded = (wx: number): number => {
  const g = Game.create(4261);
  for (let y = 10; y <= 32; y++) for (let x = 10; x <= 32; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Plankend', x: 20, y: 20, radius: R, level: 3 };
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  g.addCrate('plank', 21, 20, 0, 0, [{ uid: g.inventory.nextUid++, id: 'plank', ql: 30, dmg: 0, count: 5 }], true);
  const b = g.buildings.create('Shed', wx, 20);
  const wall = g.buildings.setWall(b, 0, wx, 20, 'n', 'solid', 'plank');
  for (const k of Object.keys(wall.needed)) wall.needed[k] = k === 'plank' ? 2 : 0;
  const c = g.creatures.spawn('cobbe', 20.5, 20.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.job = 'hod' as never;
  c.hunger = 1;
  for (let i = 0; i < 600; i++) {
    g.time += 0.1;
    g.creatures.update(0.1, g);
  }
  return 2 - (wall.needed.plank ?? 0);
};
const inside = hodded(20 + R);
const outside = hodded(20 + R + 1);
check('in the browser, a Brickling fits planks into a wall a tile inside its settlement\'s edge', inside > 0, `${inside} fitted`);
check('and none into one a tile past it, though within its reach', outside === 0, `${outside} fitted`);

/** Its keeper a citizen of a second settlement, with a crate of planks on it: what the workers' stores are. */
{
  const g = Game.create(4262);
  g.deed = { name: 'Plankend', x: 20, y: 20, radius: R, level: 3 };
  g.neighbourDeeds = [{ name: 'Faraway', x: 60, y: 60, radius: R, level: 3, holder: null, mine: true, role: 'guest' as never }];
  g.addCrate('plank', 21, 20, 0, 0, [{ uid: g.inventory.nextUid++, id: 'plank', ql: 30, dmg: 0, count: 5 }], true);
  g.addCrate('plank', 61, 60, 0, 0, [{ uid: g.inventory.nextUid++, id: 'plank', ql: 30, dmg: 0, count: 5 }], true);
  const at = g.deedStores().map((s) => s.centre.map(Math.floor).join(',')).join(' ');
  check('in the browser, with its keeper a citizen of a second settlement, the workers\' stores are its own settlement\'s alone',
    g.deedStores().some((s) => Math.floor(s.centre[0]) === 21) && !g.deedStores().some((s) => s.centre[0] > 40), at);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a settlement's workers keep to their own settlement — ${ok.length} of ${ok.length}`);
