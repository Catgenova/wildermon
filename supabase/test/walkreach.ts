/**
 * Walked to a creature and then asked: from where the island takes it to be in reach.
 *
 * Reported: "lots of instances of moving to the area and then still getting an error message of being too far away and
 * nothing happens". The island measures a creature body to body (`creature_in_reach`, 1.9 tiles); the browser took any
 * tile beside the creature's as near, whose far corner is 2.7 tiles off, walked there and asked, and was refused. Now:
 *
 *   * a creature is in reach body to body, within `CREATURE_REACH`, short of the island's 1.9;
 *   * the walk to one ends on a tile whose middle is that near it;
 *   * one that moved off while the feet were on the way is walked to again (`WALK_TRIES`), and asked once in reach,
 *     with no "too far".
 */
import { CREATURE_REACH, Game, WALK_TRIES } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { TileType } from '../../src/world/tiles';
import { check, finish } from './harness';
import { keyX, keyY } from '../../src/game/tileindex';

const g = Game.create(4242, 64);
const px = g.spawn.x, py = g.spawn.y;
for (let y = py - 12; y <= py + 13; y++) for (let x = px - 12; x <= px + 13; x++) g.world.setHeight(x, y, 5);
for (let y = py - 12; y <= py + 12; y++) for (let x = px - 12; x <= px + 12; x++) g.world.setTile(x, y, TileType.Grass);
const tame = ACTION_BY_ID.get('tame');
if (!tame) throw new Error('no tame');

check('a reach short of the island\'s 1.9 (`creature_in_reach`)', CREATURE_REACH < 1.9 && CREATURE_REACH >= 1.42, String(CREATURE_REACH));

// In the corner of a tile diagonal to the creature's, the creature in the far corner of its own.
g.putBody(px + 0.05, py + 0.05, 0);
const c = g.creatures.spawn('rabba', px + 1.95, py + 1.95, 'wild', g.rand, g.time - 3600 * 24 * 30);
const t = { kind: 'creature', id: c.id } as Target;
const away = Math.hypot(c.x - g.player.x, c.y - g.player.y);
check('a corner of the tile beside it, 2.7 tiles off, is not in reach', !g.inRange(tame, t), `${away.toFixed(2)} tiles`);

// Asked as the island is asked: walked to first, and the ask sent on arriving.
const asked: string[] = [];
const said: string[] = [];
g.ask = (def) => { asked.push(def.id); };
const log = g.logMsg.bind(g);
g.logMsg = (text: string, kind?: never) => { said.push(text); return log(text, kind); };
g.requestAction(tame, t);
const end = g.player.path?.at(-1);
check('walked to a tile whose middle is within reach of it', !!end && Math.hypot(end.x + 0.5 - c.x, end.y + 0.5 - c.y) <= CREATURE_REACH,
  end ? `${end.x},${end.y}: ${Math.hypot(end.x + 0.5 - c.x, end.y + 0.5 - c.y).toFixed(2)}` : 'no path');
for (let i = 0; i < 400 && !asked.length; i++) g.update(0.05);
check('asked on arriving, from within reach', asked.length === 1 && Math.hypot(c.x - g.player.x, c.y - g.player.y) <= CREATURE_REACH,
  `asked ${asked.length}; ${Math.hypot(c.x - g.player.x, c.y - g.player.y).toFixed(2)} tiles`);

// One that moves off while the feet are on the way: walked to again, and asked, with nothing said of being too far.
asked.length = 0;
said.length = 0;
g.putBody(px - 6.5, py + 0.5, 0);
c.x = px + 0.5; c.y = py + 0.5;
g.requestAction(tame, t);
for (let i = 0; i < 30; i++) g.update(0.05);
// Off three tiles while the walk is under way: where the walk ends is out of its reach.
c.x = px + 3.5; c.y = py + 3.5;
for (let i = 0; i < 600 && !asked.length; i++) g.update(0.05);
check(`moved off on the way: walked to again (${WALK_TRIES} times at most) and asked, never "too far"`,
  asked.length === 1 && !said.some((s) => /too far/i.test(s)), `asked ${asked.length}; said ${said.filter((s) => /far/i.test(s)).join(' / ') || 'nothing'}`);
// Walked again after arriving out of reach: the ways in not yet tried first (`ActiveAction.tried`).
{
  const forage = ACTION_BY_ID.get('forage');
  if (!forage) throw new Error('no forage');
  const ft = { kind: 'tile', x: px, y: py } as Target;
  g.putBody(px - 5.5, py + 0.5, 0);
  const w = g as unknown as { walkToward(def: unknown, t: Target, avoid?: ReadonlySet<number>): boolean; walkedTo: number | null };
  w.walkToward(forage, ft);
  const first = w.walkedTo;
  w.walkToward(forage, ft, new Set(first === null ? [] : [first]));
  const second = w.walkedTo;
  const ok = (k: number | null): boolean => k !== null && Math.max(Math.abs(keyX(k) - px), Math.abs(keyY(k) - py)) <= 1;
  check('walked again: another way in than the one tried, still beside the tile', first !== null && second !== null && first !== second && ok(first) && ok(second),
    `${first === null ? '-' : `${keyX(first)},${keyY(first)}`} then ${second === null ? '-' : `${keyX(second)},${keyY(second)}`}`);
}
finish('Walked to a creature, then asked');
