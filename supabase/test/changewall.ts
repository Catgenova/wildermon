/**
 * Changing a wall where it stands, the same on both sides.
 *
 * Asked: "when a wall can't be removed, add an option to change it." Storey
 * 2's solid marble wall that storey 3 rests on is refused Remove; `change_wall`
 * plans another type or material on it in one go, as Plan wall plans one on a
 * bare side. This puts the browser (`changeWallReason`, `change_wall` and
 * `build_wall` in `buildActions.ts`) and the island (`change_wall_refusal`,
 * `perform_change_wall`, `change_build_refusal`, `perform_change_build`) to
 * the same questions:
 *
 *   * the change is offered and allowed on the wall storey 3 rests on, to a
 *     door, a window, a double door, an arch or a bay window in marble;
 *   * refused in the same words for a type that carries nothing (Remove's
 *     words), a material too light for what stands on it, the wall it already
 *     is, a portcullis or a counter up a storey, a hidden door, glass as a
 *     door, with no mallet, and the change already planned;
 *   * planned, it says so in the same words, with the bill; the wall standing
 *     stays solid, finished and shut, and storey 3 still rests on it (Remove
 *     still refused), on both sides; the change is sent with its wall;
 *   * asked again for the wall standing, it drops the change;
 *   * built a unit a go, the wall stays shut till the last of it, and then is
 *     the door, finished, open to walk through, and still carrying storey 3;
 *   * a wall still going up is planned again in place, at the new bill;
 *   * a shop counter with takings in it is not changed.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it.
 * His settlement is moved over the ground this uses for the while, and the
 * ground, the settlement and Dane are put back after.
 */
import { Game } from '../../src/game/game';
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { heftWord, isDone, MATERIAL_BY_ID, wallBill, WALL_TYPE_BY_ID, type Side, type WallType } from '../../src/game/building';
import { needsText } from '../../src/game/buildActions';
import { COUNTER_EMPTY_FIRST, COUNTER_GROUND } from '../../src/game/counters';
import { changeLine, HIDDEN_DOOR_ALONE, planLine } from '../../src/game/gates';
import { GLASS_ONLY } from '../../src/game/glasshouse';
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
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const ITEMS = `'mallet', 'trowel', 'log', 'plank', 'timber', 'marble_brick', 'mortar', 'hinge'`;

/* ---- the ground, as it was, to be put back ------------------------------- */
const X0 = 17, X1 = 27, Y0 = 22, Y1 = 30;
const heightsWere = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1 + 1}) gx, generate_series(${Y0}, ${Y1 + 1}) gy;`);
const tilesWere = psql(`select string_agg(gx || ',' || gy || ',' || land_tile(${W}, gx, gy) || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);
const deedWas = psql(`select coalesce((select x || ',' || y || ',' || radius || ',' || level from deed
  where world_id = ${W} and founded_by = ${DANE}), '');`);

/* ---- the same ground on both sides: level grass at twenty ------------------ */
const BASE = 20;
const game = Game.create(4242);
const bld = game.buildings;
const world = game.world;
(game as unknown as { deed: unknown }).deed = { name: 'Latecomer', x: 21, y: 26, radius: 5, level: 1, mine: true };
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.Grass, 0);
game.inventory.add('mallet', { ql: 40 });
game.inventory.add('trowel', { ql: 40 });
game.skills.values.set('carpentry', 90);
game.skills.values.set('masonry', 90);
game.setPerks({});
game.player.x = 20.5;
game.player.y = 26.5;
game.player.level = 1;

psql(`
do $$
declare w uuid; u uuid; gx int; gy int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  delete from wall where world_id = w;
  delete from floor_tile where world_id = w;
  delete from building_column where world_id = w;
  delete from building_tile where world_id = w;
  delete from building where world_id = w;
  delete from placed where world_id = w and kind = 'counter';
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def in (${ITEMS});
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1), (w, 'player', u, 'trowel', 40, 1);
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop
    perform land_set_tile(w, gx, gy, tile_id('Grass')); perform land_set_data(w, gx, gy, 0);
  end loop; end loop;
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 90), (w, u, 'masonry', 90)
    on conflict (world_id, uid, id) do update set value = 90;
  if exists (select 1 from deed where world_id = w and founded_by = u) then
    update deed set x = 21, y = 26, radius = 5, level = 1 where world_id = w and founded_by = u;
  else
    insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Latecomer', 21, 26, 5, u);
  end if;
  update player set body_at = now(), x = 20.5, y = 26.5, level = 1 where world_id = w and uid = u;
end $$;`);

/* ---- building on both sides at once ---------------------------------------- */
const along = (x: number, y: number, side: Side): { bx: number; by: number; dir: 'h' | 'v' } => ({
  bx: side === 'e' ? x + 1 : x, by: side === 's' ? y + 1 : y, dir: side === 'n' || side === 's' ? 'h' : 'v',
});
const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
const building = (id: number, name: string, tiles: Array<[number, number]>, levels: number): void => {
  const b = bld.create(name, tiles[0][0], tiles[0][1]);
  if (b.id !== id) throw new Error(`the browser numbered ${name} ${b.id}, not ${id}`);
  for (const [x, y] of tiles.slice(1)) bld.addTile(b, x, y);
  b.levels = levels;
  b.workLevel = levels - 1;
  sql(`insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${id}, '${name}', ${levels}, ${levels - 1}, u);
    insert into building_tile (world_id, building, x, y) values ${tiles.map(([x, y]) => `(w, ${id}, ${x}, ${y})`).join(', ')};`);
};
/** A wall on both sides, finished, or with its whole bill still to build (`planned`). */
const wall = (id: number, level: number, x: number, y: number, side: Side, type: WallType, mat: string, planned = false): void => {
  const b = bld.list.get(id)!;
  const wl = bld.setWall(b, level, x, y, side, type, mat);
  wl.building = id;
  if (!planned) for (const k of Object.keys(wl.needed)) wl.needed[k] = 0;
  const { bx, by, dir } = along(x, y, side);
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dir}' and x = ${bx} and y = ${by};
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, ${level}, '${dir}', ${bx}, ${by}, ${id}, '${type}', '${mat}', '${JSON.stringify(wl.needed)}', '${JSON.stringify(wl.total)}', u);`);
};
const floor = (id: number, level: number, x: number, y: number, mat: string): void => {
  const b = bld.list.get(id)!;
  const f = bld.setFloor(b, level, x, y, mat, 'floor');
  for (const k of Object.keys(f.needed)) f.needed[k] = 0;
  sql(`insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
    values (w, ${level}, ${x}, ${y}, ${id}, '${mat}', 'floor', '${JSON.stringify(f.needed)}', '${JSON.stringify(f.total)}');`);
};
const give = (id: string, n: number): void => {
  game.inventory.add(id, { count: n, ql: 40 });
  sql(`perform give(w, u, '${id}', ${n}, 40);`);
};

/** What each side says to a job: the browser's check, and the island's `build_refusal`. */
const say = (id: string, target: Record<string, unknown>): [string, string] => {
  const t = { kind: 'tile', cx: target.x, cy: target.y, ...target };
  const a = ACTION_BY_ID.get(id);
  if (!a) throw new Error(`there is no ${id}`);
  const mine = a.check?.(t as never, game) ?? 'ALLOWED';
  const theirs = psql(`select coalesce(build_refusal(${W}, ${DANE}, '${id}', '${JSON.stringify(t)}'::jsonb), 'ALLOWED');`);
  return [mine, theirs];
};
const same = (what: string, id: string, target: Record<string, unknown>, want: string): void => {
  const [mine, theirs] = say(id, target);
  check(what, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
};
/** Do a job on both sides, and the last thing each said doing it. */
const both = (id: string, target: Record<string, unknown>): [string, string] => {
  const t = { kind: 'tile', cx: target.x, cy: target.y, ...target };
  game.log.length = 0;
  ACTION_BY_ID.get(id)?.perform(t as never, game);
  const mine = game.log.map((l) => l.text).pop() ?? 'NOTHING SAID';
  psql(`delete from event where world_id = ${W} and uid = ${DANE};`);
  psql(`select perform_building(${W}, ${DANE}, '${id}', '${JSON.stringify(t)}'::jsonb);`);
  const theirs = psql(`select text from event where world_id = ${W} and uid = ${DANE} order by n desc limit 1;`) || 'NOTHING SAID';
  return [mine, theirs];
};
/** A wall as each side has it: type, material, finished or not, and the change planned on it with its bill. */
const wallState = (level: number, x: number, y: number, side: Side): [string, string] => {
  const wl = bld.wall(level, x, y, side);
  const bill = (b: Record<string, number>): string => Object.keys(b).sort().map((k) => `${k}:${b[k]}`).join(',');
  const mine = wl ? `${wl.type}|${wl.material}|${isDone(wl)}|${wl.change ? `${wl.change.type}|${wl.change.material}|${bill(wl.change.needed)}|${bill(wl.change.total)}` : '-'}` : 'none';
  const { bx, by, dir } = along(x, y, side);
  const theirs = psql(`select coalesce((select wl.type || '|' || wl.material || '|' || bill_done(wl.needed) || '|'
      || coalesce((select c.type || '|' || c.material || '|'
           || (select string_agg(k || ':' || (c.needed->>k), ',' order by k) from jsonb_object_keys(c.needed) k) || '|'
           || (select string_agg(k || ':' || (c.total->>k), ',' order by k) from jsonb_object_keys(c.total) k)
         from wall_change c where c.world_id = wl.world_id and c.level = wl.level and c.dir = wl.dir and c.x = wl.x and c.y = wl.y), '-')
    from wall wl where wl.world_id = ${W} and wl.level = ${level} and wl.dir = '${dir}' and wl.x = ${bx} and wl.y = ${by}), 'none');`);
  return [mine, theirs];
};
/** Whether the border is shut to a body walking across it, on each side: `blocksAt`, and the island's wall row. */
const shut = (level: number, x: number, y: number, side: Side): [boolean, boolean] => {
  const [ox, oy] = side === 'n' ? [x, y - 1] : side === 's' ? [x, y + 1] : side === 'w' ? [x - 1, y] : [x + 1, y];
  const { bx, by, dir } = along(x, y, side);
  const theirs = psql(`select coalesce((select bill_done(wl.needed) and not coalesce(t.passable, false) from wall wl
    left join wall_type_def t on t.id = wl.type
    where wl.world_id = ${W} and wl.level = ${level} and wl.dir = '${dir}' and wl.x = ${bx} and wl.y = ${by}), false);`) === 't';
  return [bld.blocksAt(level, x, y, ox, oy), theirs];
};

/* ---- Manor: three storeys of solid marble, the third resting on the second --- */
const MANOR: Array<[number, number]> = [[20, 26], [21, 26]];
building(1, 'Manor', MANOR, 3);
const SIDES: Array<[number, number, Side]> = [[20, 26, 'n'], [20, 26, 'w'], [20, 26, 's'], [21, 26, 'n'], [21, 26, 'e'], [21, 26, 's']];
for (const level of [0, 1, 2]) {
  for (const [x, y, s] of SIDES) wall(1, level, x, y, s, 'solid', 'marble');
  if (level > 0) for (const [x, y] of MANOR) floor(1, level, x, y, 'plank');
}
const T = { x: 20, y: 26, side: 'n', level: 1 };
const RESTS = 'Storey 3 rests on this wall: add a column at each end, or remove the wall above, first.';
const to = (wallType: WallType, material: string): Record<string, unknown> => ({ ...T, wallType, material });

same('storey 2\'s wall under storey 3 is refused Remove', 'remove_wall', T, RESTS);
check('and Change wall is offered on it', !!ACTION_BY_ID.get('change_wall')?.applies({ kind: 'tile', cx: 20, cy: 26, ...T } as never, game));
for (const wt of ['door', 'window', 'double_door', 'arch', 'bay'] as WallType[]) {
  same(`a change to a ${WALL_TYPE_BY_ID.get(wt)?.name.toLowerCase()} in marble is allowed: full height, it carries storey 3`, 'change_wall', to(wt, 'marble'), 'ALLOWED');
}
for (const wt of ['railing', 'half_wall', 'fence'] as WallType[]) {
  same(`a change to a ${WALL_TYPE_BY_ID.get(wt)?.name.toLowerCase()} carries nothing: refused in Remove's words`, 'change_wall', to(wt, 'marble'), RESTS);
}
same('a material too light for the marble over it is refused, as a Repoint is', 'change_wall', to('door', 'log'),
  `Log cannot carry the ${heftWord(MATERIAL_BY_ID.get('marble')!.heft)} above it.`);
same('but glass as a solid wall goes in under the marble (`GLASS_UNDER_ANY`)', 'change_wall', to('solid', 'glass'), 'ALLOWED');
same('the wall it already is is refused', 'change_wall', to('solid', 'marble'), 'Already that wall.');
same('a portcullis up a storey is refused as Plan wall refuses it', 'change_wall', to('portcullis', 'marble'),
  'Portcullis: ground floor only. Switch to storey 1.');
same('a hidden door is planned on a bare side', 'change_wall', to('hidden_door', 'marble'), HIDDEN_DOOR_ALONE);
same('glass as a door is refused', 'change_wall', to('door', 'glass'), GLASS_ONLY);
same('a shop counter up a storey is refused', 'change_wall', to('counter', 'marble'), COUNTER_GROUND);
same('a type and material missing are asked for', 'change_wall', T, 'Choose a side, wall type and material.');
for (const it of game.inventory.items.filter((i) => i.id === 'mallet')) game.inventory.remove(it.uid, it.count);
sql(`delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'mallet';`);
same('and no change is planned without a mallet', 'change_wall', to('door', 'marble'), 'Need a mallet.');
give('mallet', 1);

/* ---- the change planned: the wall standing stays as it is ------------------- */
const DOOR = wallBill('marble', 'door');
{
  const [mine, theirs] = both('change_wall', to('door', 'marble'));
  const want = `${changeLine('door', 'Marble', 'north')} Needs ${needsText(DOOR)}.`;
  check(`a change to a marble door is planned in the same words: "${want}"`, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
}
{
  const [mine, theirs] = wallState(1, 20, 26, 'n');
  const bill = Object.keys(DOOR.total).sort().map((k) => `${k}:${DOOR.total[k]}`).join(',');
  const want = `solid|marble|true|door|marble|${bill}|${bill}`;
  check('the wall stands a finished solid marble wall, the door planned on it at its whole bill, on both sides', mine === want && theirs === want,
    `browser ${mine}, island ${theirs}`);
}
{
  const [mine, theirs] = shut(1, 20, 26, 'n');
  check('and the border is shut on both sides', mine && theirs, `browser ${mine}, island ${theirs}`);
}
same('and storey 3 still rests on it: Remove is still refused', 'remove_wall', T, RESTS);
{
  const sent = psql(`select wall_gear(${W}, ${DANE}, wl)->'change'->>'type' from wall wl where wl.world_id = ${W} and wl.level = 1 and wl.dir = 'h' and wl.x = 20 and wl.y = 26;`);
  check('the change is sent with its wall in the ground read', sent === 'door', sent);
}
same('the same change asked for again is refused', 'change_wall', to('door', 'marble'), 'Change already planned.');
same('the wall standing asked for again drops the change', 'change_wall', to('solid', 'marble'), 'ALLOWED');
{
  const [mine, theirs] = both('change_wall', to('solid', 'marble'));
  check('and says so in the same words', mine === 'Change dropped: north side.' && theirs === mine, `browser "${mine}", island "${theirs}"`);
  const [a, b] = wallState(1, 20, 26, 'n');
  check('and the change is gone on both sides', a === 'solid|marble|true|-' && b === a, `browser ${a}, island ${b}`);
}
same('with no change planned, the wall standing is the wall it already is', 'change_wall', to('solid', 'marble'), 'Already that wall.');

/* ---- the change built ------------------------------------------------------- */
both('change_wall', to('door', 'marble'));
same('building the change with nothing to hand asks for its bill', 'build_wall', T, `Need ${needsText(DOOR)}.`);
for (const [id, n] of Object.entries(DOOR.total)) give(id, n);
same('with it to hand it is built', 'build_wall', T, 'ALLOWED');
{
  const [mine, theirs] = both('build_wall', T);
  check('a go says what went in, the same on both sides', mine.startsWith('Added: ') && mine === theirs, `browser "${mine}", island "${theirs}"`);
  const [a, b] = wallState(1, 20, 26, 'n');
  check('and the wall stands a finished solid wall while the change goes up, on both sides', a.startsWith('solid|marble|true|door|marble|') && a === b,
    `browser ${a}, island ${b}`);
  const [s1, s2] = shut(1, 20, 26, 'n');
  check('the border still shut', s1 && s2, `browser ${s1}, island ${s2}`);
}
{
  const units = Object.values(DOOR.total).reduce((a, b) => a + b, 0);
  let mineGoes = 1;
  while (mineGoes < 200 && bld.wall(1, 20, 26, 'n')?.change) {
    game.log.length = 0;
    ACTION_BY_ID.get('build_wall')?.perform({ kind: 'tile', cx: 20, cy: 26, ...T } as never, game);
    mineGoes++;
  }
  const mineSaid = game.log.map((l) => l.text).pop() ?? 'NOTHING SAID';
  psql(`delete from event where world_id = ${W} and uid = ${DANE};`);
  const theirGoes = 1 + Number(psql(`do $$ declare w uuid; u uuid; n int := 0; begin
      select id into w from world where name = 'Hoarding';
      select uid into u from player where world_id = w and name = 'Dane';
      while n < 200 and exists (select 1 from wall_change c where c.world_id = w and c.level = 1 and c.dir = 'h' and c.x = 20 and c.y = 26) loop
        perform perform_building(w, u, 'build_wall', '${JSON.stringify({ kind: 'tile', cx: 20, cy: 26, ...T })}'::jsonb);
        n := n + 1;
      end loop;
      perform set_config('wurm.goes', n::text, false);
    end $$; select current_setting('wurm.goes');`).split('\n').pop());
  const theirSaid = psql(`select text from event where world_id = ${W} and uid = ${DANE} order by n desc limit 1;`);
  check(`built a unit a go, ${units} goes on both sides`, mineGoes === units && theirGoes === units, `browser ${mineGoes}, island ${theirGoes}`);
  check('the last go says the wall is built, in the same words', mineSaid === 'Built: marble wall.' && theirSaid === mineSaid,
    `browser "${mineSaid}", island "${theirSaid}"`);
  const [a, b] = wallState(1, 20, 26, 'n');
  check('and the wall is the marble door, finished, with no change left, on both sides', a === 'door|marble|true|-' && b === a, `browser ${a}, island ${b}`);
  const [s1, s2] = shut(1, 20, 26, 'n');
  check('open to walk through, on both sides', !s1 && !s2, `browser ${s1}, island ${s2}`);
}
same('and storey 3 rests on the door as it did on the wall', 'remove_wall', T, RESTS);
same('which is now the wall it already is', 'change_wall', to('door', 'marble'), 'Already that wall.');

/* ---- a wall still going up is planned again in place ------------------------ */
wall(1, 2, 21, 26, 'n', 'solid', 'marble', true);
{
  const up = { x: 21, y: 26, side: 'n', level: 2 };
  same('a wall of storey 3 still going up may be changed to a plank window', 'change_wall', { ...up, wallType: 'window', material: 'plank' }, 'ALLOWED');
  const [mine, theirs] = both('change_wall', { ...up, wallType: 'window', material: 'plank' });
  const bill = wallBill('plank', 'window');
  const want = `${planLine('window', 'Plank', 'north')} Needs ${needsText(bill)}.`;
  check(`and is planned again where it stands, as Plan wall says: "${want}"`, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
  const [a, b] = wallState(2, 21, 26, 'n');
  check('a plank window from nothing in, with no change on it, on both sides', a === 'window|plank|false|-' && b === a, `browser ${a}, island ${b}`);
  const wl = bld.wall(2, 21, 26, 'n');
  const theirs2 = psql(`select needed::text = total::text and total = '${JSON.stringify(bill.total)}'::jsonb from wall where world_id = ${W} and level = 2 and dir = 'h' and x = 21 and y = 26;`);
  check('at the new bill on both sides', !!wl && JSON.stringify(wl.needed) === JSON.stringify(bill.needed) && theirs2 === 't', `island ${theirs2}`);
}

/* ---- a shop counter with takings in it -------------------------------------- */
building(2, 'Shop', [[24, 26]], 1);
wall(2, 0, 24, 26, 's', 'counter', 'plank');
game.counters.open(24, 26, 's').till = 5;
sql(`insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, till) values (w, 'counter', 's', 24, 26, 0, 0, 24.5, 26.5, 5);`);
same('a shop counter with takings in it is not changed', 'change_wall', { x: 24, y: 26, side: 's', level: 0, wallType: 'solid', material: 'plank' },
  COUNTER_EMPTY_FIRST);
game.counters.close(24, 26, 's');
sql(`delete from placed where world_id = w and kind = 'counter';`);
same('and empty, it is', 'change_wall', { x: 24, y: 26, side: 's', level: 0, wallType: 'solid', material: 'plank' }, 'ALLOWED');

/* ---- put the ground back -------------------------------------------------- */
{
  const heights = heightsWere.split(';').map((r) => r.split(',').map(Number));
  const tiles = tilesWere.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`delete from wall where world_id = w;
    delete from floor_tile where world_id = w;
    delete from building_tile where world_id = w;
    delete from building where world_id = w;
    delete from placed where world_id = w and kind = 'counter';
    delete from item where world_id = w and holder = 'player' and holder_uid = u and def in (${ITEMS});
    ${heights.map(([x, y, h]) => `perform land_set_height(w, ${x}, ${y}, ${h});`).join('\n')}
    ${tiles.map(([x, y, t, d]) => `perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
    update player set body_at = now(), x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;
    ${deedWas ? `update deed set x = ${deedWas.split(',')[0]}, y = ${deedWas.split(',')[1]}, radius = ${deedWas.split(',')[2]}, level = ${deedWas.split(',')[3]}
      where world_id = w and founded_by = u;` : 'delete from deed where world_id = w and founded_by = u;'}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`a wall changed where it stands is the same on both sides — ${ok.length} of ${ok.length}`);
