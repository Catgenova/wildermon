/**
 * The game's clock against the wall's, on slow frames; and a walk's turns.
 *
 * Reported: "my game sometimes partially freezes up ... the action bar is
 * stuck on the client side while it seems to be processing fine on the server
 * side. zooming in consistently seems to catch the client up". Zoomed out, a
 * frame costs several times what it does zoomed in (the tiles drawn go with
 * the square of the zoom), and the loop moved the game's clock a tenth of a
 * second a frame at most: on frames a fifth of a second apart the action bar,
 * and the walk, ran at half the island's speed. So:
 *
 *   * `clockSteps` walks the whole of a frame's wall time, up to `CATCH_UP`,
 *     in steps of at most `MAX_STEP`;
 *   * a go the island is doing is drawn off the wall clock from the moment
 *     its answer put it at: one frame after four seconds of wall time, the bar
 *     is four seconds on (it was a tenth), never past the go's length;
 *   * a walk on frames 0.3 s apart covers the ground a walk at 60 frames a
 *     second does in the same wall time (it covered a third of it).
 *
 * And reported: "pathfinding on longer/more complicated routes ... tends to
 * move me part of the way there then rubber band back". The island measured
 * each word about where the body is as a straight line from where it last had
 * it (`walk_share`), across the trees and rock the path went round. The
 * browser keeps every step of the path it arrives at (`Player.turns`) and
 * tells the island the turns among them (`turnsOf`):
 *
 *   * a walk round a corner keeps every step it arrived at, and its turns are
 *     the corner alone; a straight row and a straight diagonal have none;
 *   * held short on a leg (`turnsAhead`), the turns still ahead are the end
 *     of that leg and every one after it, the word's own spot last.
 *
 * No database.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { CATCH_UP, clockSteps, MAX_STEP } from '../../src/engine/loop';
import { turnsAhead, turnsOf, VIA_MAX } from '../../src/net/island';
import { TILE_DEFS, TileType } from '../../src/world/tiles';
import { BASE_SPEED } from '../../src/game/player';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);

/* ---- the clock ------------------------------------------------------------------------------ */

for (const gap of [1 / 60, 0.1, 0.35, 1.25]) {
  const steps = clockSteps(gap);
  check(`a frame ${gap.toFixed(3)} s after the last: ${steps.length} steps, all of it, none over ${MAX_STEP} s`,
    Math.abs(sum(steps) - gap) < 1e-9 && steps.every((s) => s > 0 && s <= MAX_STEP + 1e-12), steps.map((s) => s.toFixed(3)).join(' '));
}
check(`a frame ten seconds late makes up ${CATCH_UP} s and lets the rest go`, Math.abs(sum(clockSteps(10)) - CATCH_UP) < 1e-9);
check('no time, no steps', clockSteps(0).length === 0 && clockSteps(-1).length === 0);

/* ---- the action bar, on the wall clock ------------------------------------------------------ */

const game = Game.create(4242);
let wall = 1_000_000;
game.wallClock = () => wall;
const def = ACTION_BY_ID.get('dig');
if (!def) throw new Error('no dig');
game.showAction(def, { kind: 'self' } as never, 10, 10);
wall += 4;
// One frame, a tenth of a second of game clock, as the loop gave a frame before.
game.update(0.1);
check('one frame after four seconds of wall time, the island\'s go is four seconds on', Math.abs((game.action?.elapsed ?? 0) - 4) < 1e-6,
  `${game.action?.elapsed.toFixed(2)} s of ${game.action?.duration} s`);
game.showAction(def, { kind: 'self' } as never, 10, 3);
game.update(1 / 60);
check('an answer that puts it at seven seconds puts the bar there', Math.abs((game.action?.elapsed ?? 0) - 7) < 1e-6,
  `${game.action?.elapsed.toFixed(2)}`);
wall += 30;
game.update(1 / 60);
check('and the bar stops at the end of the go', game.action?.elapsed === game.action?.duration, `${game.action?.elapsed}`);
game.showAction(null, null);

/* ---- a walk on slow frames ------------------------------------------------------------------ */

const world = game.world;
const [cx, cy] = [game.spawn.x, game.spawn.y];
const R = 40;
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, 60);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
const walk = (frame: number, secs: number): number => {
  game.putBody(cx + 0.5, cy + 0.5, 0);
  game.player.stats.stamina = 1;
  game.moveTo(cx + 35, cy);
  for (let t = 0; t < secs - 1e-9; t += frame) for (const step of clockSteps(frame)) game.update(step);
  return game.player.x - (cx + 0.5);
};
const pace = BASE_SPEED * TILE_DEFS[TileType.Grass].speed;
const quick = walk(1 / 60, 6);
const slow = walk(0.3, 6);
check(`six seconds at 60 frames a second, a tile a step: its pace and no more (${(6 * pace).toFixed(3)} tiles)`,
  Math.abs(quick - 6 * pace) < 1e-6, `${quick.toFixed(3)} tiles; a step ended within ${0.06} of its middle used to go the rest at once, `
    + 'a few per cent over');
check('and on frames 0.3 s apart, the same', Math.abs(slow - 6 * pace) < 1e-6,
  `${slow.toFixed(3)} tiles; a tenth a frame walked ${(quick / 3).toFixed(2)}`);

/* ---- a walk's turns ------------------------------------------------------------------------- */

game.putBody(cx + 0.5, cy + 0.5, 0);
game.player.takeTurns();
// East six and north six: round the corner of a wood.
for (let y = cy - 6; y < cy; y++) for (let x = cx - 6; x < cx + 6; x++) world.setTile(x, y, TileType.Tree);
game.moveTo(cx + 6, cy - 6);
const path = (game.player.path ?? []).map((p) => `${p.x - cx},${p.y - cy}`);
for (let i = 0; i < 2000 && game.player.path; i++) game.update(MAX_STEP);
const steps = game.player.takeTurns();
const turns = turnsOf({ x: cx + 0.5, y: cy + 0.5 }, steps, { x: game.player.x, y: game.player.y });
check(`round the wood: every step arrived at kept (${steps.length})`, steps.length === path.length && steps.length >= 12, path.join(' '));
check('and its turns are the corner alone', turns.length === 1 && turns[0].x === cx + 6.5 && turns[0].y === cy + 0.5,
  turns.map((p) => `${p.x - cx},${p.y - cy}`).join(' '));
check('and taken, they are gone', game.player.takeTurns().length === 0);

const row = Array.from({ length: 8 }, (_, i) => ({ x: 10.5 + i, y: 4.5 }));
check('a straight row has no turns', turnsOf({ x: 9.5, y: 4.5 }, row, { x: 18.2, y: 4.5 }).length === 0);
const diagonal = Array.from({ length: 8 }, (_, i) => ({ x: 10.5 + i, y: 4.5 + i }));
check('nor a straight diagonal', turnsOf({ x: 9.5, y: 3.5 }, diagonal, { x: 18.3, y: 12.3 }).length === 0);
check('with where the island has it not known, the first step is kept', turnsOf(null, row, { x: 18.2, y: 4.5 }).length === 1);
const zig = Array.from({ length: 200 }, (_, i) => ({ x: 10.5 + i, y: 4.5 + (i % 2) }));
check(`a zigzag of 200 turns keeps the latest ${VIA_MAX}`, turnsOf(null, zig, { x: 300, y: 4.5 }).length === VIA_MAX
  && turnsOf(null, zig, { x: 300, y: 4.5 })[VIA_MAX - 1].x === zig[199].x);

const L = [{ x: 16.5, y: 10.5 }, { x: 16.5, y: 4.5 }];
const ahead = turnsAhead({ x: 10.5, y: 10.5 }, L, { x: 19.5, y: 4.5 }, { x: 16.5, y: 8 });
check('held short on the second leg: the turns ahead are that leg\'s end and the word\'s spot',
  ahead.length === 2 && ahead[0].y === 4.5 && ahead[1].x === 19.5, JSON.stringify(ahead));
const before = turnsAhead({ x: 10.5, y: 10.5 }, L, { x: 19.5, y: 4.5 }, { x: 12, y: 10.5 });
check('held short on the first: all of them', before.length === 3, JSON.stringify(before));

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
