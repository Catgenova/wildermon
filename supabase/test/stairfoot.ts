/**
 * Down a staircase off its foot, with storey 2 floored over the foot.
 *
 * Reported on Solara Manor: "there's clearly a marble stair going from storey 2 to storey 1 and I can't go down it".
 * The flight's tile was walked onto from storey 2 and off it again onto storey 2's floor on every side, its foot
 * too, because storey 2 was floored there: nothing went down. Off a flight across its foot is down onto the storey
 * under it now, as wheels, mounts and workers already went (`Game.footStep`, `driveStorey`, `worker_way_leg`); off
 * its head or its sides it is the storey's floor as before.
 *
 * Browser only: the island takes the storey a walk ends on from its footing (`storey_footing`).
 */
import { Game } from '../../src/game/game';
import type { BuildingsJSON } from '../../src/game/building';
import { TileType } from '../../src/world/tiles';

let bad = 0;
let good = 0;
const check = (what: string, ok: boolean, detail = ''): void => {
  if (ok) good++;
  else bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** A room three tiles square at 30..32, 40..42 on both storeys, its flight in the middle climbed from the east. */
const X0 = 30, Y0 = 40, SX = 31, SY = 41;
const g = Game.create(4242, 64);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
for (let y = 30; y < 54; y++) for (let x = 20; x < 44; x++) { g.world.setHeight(x, y, 10); g.world.setTile(x, y, TileType.Grass, 0); }
const done = { needed: {}, total: {} };
const floors = [];
const tiles = [];
for (let y = Y0; y <= Y0 + 2; y++) for (let x = X0; x <= X0 + 2; x++) {
  tiles.push(`${x},${y}`);
  floors.push({ building: 1, level: 0, x, y, kind: 'floor', material: 'marble', ...done });
  floors.push(x === SX && y === SY
    ? { building: 1, level: 1, x, y, kind: 'stairs', facing: 'e', material: 'marble', ...done }
    : { building: 1, level: 1, x, y, kind: 'floor', material: 'marble', ...done });
}
g.buildings.sawIsland({ nextId: 2, list: [{ id: 1, name: 'Manor', levels: 3, workLevel: 1, tiles }], walls: [], floors } as unknown as BuildingsJSON as never);

check('up onto the flight from its foot, the ground east of it: storey 2', g.stepRule(SX + 1, SY, 0, SX, SY) === 1, String(g.stepRule(SX + 1, SY, 0, SX, SY)));
check('off it across its foot, with storey 2 floored over the foot: down to the ground', g.stepRule(SX, SY, 1, SX + 1, SY) === 0, String(g.stepRule(SX, SY, 1, SX + 1, SY)));
check('off it across its head: storey 2', g.stepRule(SX, SY, 1, SX - 1, SY) === 1, String(g.stepRule(SX, SY, 1, SX - 1, SY)));
check('off it across a side: storey 2', g.stepRule(SX, SY, 1, SX, SY - 1) === 1, String(g.stepRule(SX, SY, 1, SX, SY - 1)));

g.player.x = X0 + 0.5;
g.player.y = Y0 + 0.5;
g.player.level = 1;
const found = g.moveTo(X0 + 2, Y0 + 2, false, true, 0);
const path = (g.player.path ?? []).map((p) => `${p.x},${p.y}@${p.level}`);
check('a walk from storey 2 to the ground in the same room is found, over the flight and off its foot', found && path.includes(`${SX},${SY}@1`) && path.includes(`${SX + 1},${SY}@0`), path.join(' '));

console.log(`down a staircase off its foot under a floored storey — ${good} of ${good + bad}`);
if (bad) process.exit(1);
