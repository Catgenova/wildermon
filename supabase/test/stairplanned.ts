/**
 * A walk up to a storey whose staircase is only planned says so.
 *
 * Reported on Vinyard: "cant walk up these stairs", storey 2 pinned, standing on the ground of Southern Greenhouse
 * (2508..2512, 2255..2257). The island's rows: a timbercraft single staircase at storey 2 on 2508, 2256, left hand,
 * climbed from the south, planned on 11-14 and never built (`bill_done` false, nothing to stand on), and no other way
 * up -- the stone brick spiral on 2508, 2255 goes down to the cellar. A planned flight is drawn faint with a dashed
 * outline at its head, and every click on storey 2 was refused as "No path to storey 2 (pinned on the storey
 * control)", nothing naming the staircase or what it still needed. It says the staircase, where it is and its bill
 * now (`Game.unbuiltWayUp`, `wayUpSaid`); built, the same click walks up it.
 *
 * Browser only: the island holds a body to what it stands on (`frame_footing`, `storey_footing`), and a planned
 * staircase is nothing to stand on there either.
 */
import { Game, wayUpSaid } from '../../src/game/game';
import { floorBill, type BuildingsJSON, type FloorTile } from '../../src/game/building';
import { TileType } from '../../src/world/tiles';

let bad = 0;
let good = 0;
const check = (what: string, ok: boolean, detail = ''): void => {
  if (ok) good++;
  else bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** Southern Greenhouse as the island has it, moved: 2508..2512 to 20..24, 2255..2257 to 30..32. */
const OX = 2508 - 20, OY = 2255 - 30;
const SX = 2508 - OX, SY = 2256 - OY;
const done = { needed: {}, total: {} };

function house(stairDone: boolean): Game {
  const g = Game.create(4242, 64);
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  for (let y = 20; y < 44; y++) for (let x = 10; x < 34; x++) { g.world.setHeight(x, y, 10); g.world.setTile(x, y, TileType.Grass, 0); }
  const tiles: string[] = [];
  const floors: Array<Partial<FloorTile>> = [];
  const cellars: Array<{ building: number; x: number; y: number; dug: number }> = [];
  const at = (x: number, y: number): { x: number; y: number } => ({ x: x - OX, y: y - OY });
  for (let y = 2255; y <= 2257; y++) for (let x = 2508; x <= 2512; x++) {
    tiles.push(`${x - OX},${y - OY}`);
    cellars.push({ building: 1, ...at(x, y), dug: 30 });
    const bed = y === 2257 && x >= 2509 && x <= 2511;
    // The spiral down to the cellar on 2508, 2255, built.
    if (x === 2508 && y === 2255) floors.push({ building: 1, level: 0, ...at(x, y), kind: 'stairs', hand: 's', material: 'stone_brick', ...done });
    else floors.push({ building: 1, level: 0, ...at(x, y), kind: 'floor', material: bed ? 'garden_bed' : 'plank', ...done });
  }
  for (const [x, y, m] of [[2508, 2255, 'plank'], [2509, 2255, 'plank'], [2510, 2255, 'plank'], [2511, 2255, 'plank'], [2512, 2255, 'plank'],
    [2509, 2256, 'garden_bed'], [2510, 2256, 'garden_bed'], [2511, 2256, 'garden_bed'], [2512, 2256, 'plank'], [2508, 2257, 'plank'],
    [2512, 2257, 'plank']] as Array<[number, number, string]>) floors.push({ building: 1, level: 1, ...at(x, y), kind: 'floor', material: m, ...done });
  const bill = floorBill('timbercraft', 'stairs', 'hip', 'l');
  floors.push({ building: 1, level: 1, x: SX, y: SY, kind: 'stairs', hand: 'l', facing: 's', material: 'timbercraft',
    ...(stairDone ? done : { needed: { ...bill.needed }, total: { ...bill.total } }) });
  const W = (level: number, dir: 'h' | 'v', x: number, y: number, type: string, built = true) =>
    ({ building: 1, level, dir, ...at(x, y), type, material: 'plank', ...(built ? done : { needed: { plank: 1 }, total: { plank: 1 } }) });
  const walls = [
    W(0, 'h', 2508, 2255, 'solid'), W(0, 'v', 2508, 2255, 'solid'), W(0, 'h', 2509, 2255, 'solid'), W(0, 'v', 2509, 2255, 'door'),
    W(0, 'h', 2510, 2255, 'solid'), W(0, 'h', 2511, 2255, 'solid'), W(0, 'h', 2512, 2255, 'solid'), W(0, 'v', 2513, 2255, 'solid'),
    W(0, 'h', 2508, 2256, 'solid'), W(0, 'v', 2508, 2256, 'solid'), W(0, 'v', 2513, 2256, 'double_door'), W(0, 'v', 2508, 2257, 'solid'),
    W(0, 'v', 2513, 2257, 'solid'), W(0, 'h', 2508, 2258, 'solid'), W(0, 'h', 2509, 2258, 'solid'), W(0, 'h', 2510, 2258, 'solid'),
    W(0, 'h', 2511, 2258, 'solid'), W(0, 'h', 2512, 2258, 'solid'),
    W(1, 'h', 2509, 2257, 'solid', false), W(1, 'v', 2509, 2257, 'solid', false), W(1, 'h', 2510, 2257, 'solid', false), W(1, 'h', 2511, 2257, 'solid', false),
  ];
  g.buildings.sawIsland({ nextId: 2, list: [{ id: 1, name: 'Southern Greenhouse', levels: 2, workLevel: 1, tiles }], walls, floors, cellars, columns: [], noPlan: [] } as unknown as BuildingsJSON as never);
  // Where catgenova stood: the middle of the room, on the ground, storey 2 pinned.
  g.player.x = 2510.5 - OX;
  g.player.y = 2256.5 - OY;
  g.player.level = 0;
  g.settings.viewLevel = 1;
  return g;
}

const said = (g: Game): string => g.log[g.log.length - 1]?.text ?? '';

/* ---- planned, not built ---------------------------------------------------- */
{
  const g = house(false);
  const stair = g.buildings.floor(1, SX, SY)!;
  const want = 'Single staircase at 20, 31 not built: needs 4 planks, 4 thatch, 4 timbers.';
  check('the planned staircase is nothing to stand on', !g.standable(SX, SY, 1));
  check('nothing steps up onto it from the ground', g.stepRule(SX + 1, SY, 0, SX, SY) !== 1, String(g.stepRule(SX + 1, SY, 0, SX, SY)));
  check('the way up the walk waits on is that staircase', g.unbuiltWayUp(2512 - OX, 2255 - OY, 0, 1) === stair);
  check('said as its name, where it is and its bill now', wayUpSaid(stair) === want, wayUpSaid(stair));
  for (const [name, x, y] of [['the staircase itself', 2508, 2256], ['storey 2 floor at the far end', 2512, 2255], ['storey 2 floor beside it', 2508, 2257]] as const) {
    const ok = g.moveTo(x - OX, y - OY, false, false, 1);
    check(`a click on ${name}, storey 2 pinned: no walk, and the staircase said`, !ok && said(g) === want, `${ok} "${said(g)}"`);
  }
  // Half of it built: the bill as it stands now.
  stair.needed = { plank: 0, thatch: 2, timber: 4 };
  g.moveTo(2512 - OX, 2255 - OY, false, false, 1);
  check('part built: what is still needed', said(g) === 'Single staircase at 20, 31 not built: needs 2 thatch, 4 timbers.', said(g));
}

/* ---- built ---------------------------------------------------------------- */
{
  const g = house(true);
  check('built: up onto it from the ground', g.stepRule(SX + 1, SY, 0, SX, SY) === 1, String(g.stepRule(SX + 1, SY, 0, SX, SY)));
  check('built: no planned way up to name', g.unbuiltWayUp(2512 - OX, 2255 - OY, 0, 1) === undefined);
  const ok = g.moveTo(2512 - OX, 2255 - OY, false, false, 1);
  const path = (g.player.path ?? []).map((p) => `${p.x},${p.y}@${p.level}`);
  check('built: a click on storey 2 walks up it', ok && path.includes(`${SX},${SY}@1`) && path.at(-1) === `${2512 - OX},${2255 - OY}@1`, path.join(' '));
}

/* ---- not the planned one's to answer for ------------------------------------ */
{
  // A finished flight up beside a planned one: a walk refused for something else does not blame the planned one.
  const g = house(false);
  const other = g.buildings.setFloor(g.buildings.list.get(1)!, 1, 2512 - OX, 2256 - OY, 'plank', 'stairs', 's');
  Object.assign(other, done);
  check('a finished way up off the storey you stand on: no planned one named', g.unbuiltWayUp(2512 - OX, 2255 - OY, 0, 1) === undefined);
}

console.log(`a walk up to a storey whose staircase is only planned — ${good} of ${good + bad}`);
if (bad) process.exit(1);
