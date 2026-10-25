/**
 * Deploy: a carried wagon set down beside you at once.
 *
 * Asked for: "On vehicles like Wagon, add a right click option when it is in
 * your inventory 'Deploy' instead of just placing it like furniture." The
 * spot is `place_furniture`'s own (the island's `place_furniture` decides as
 * it always has): the nearest beside you, off your own tile, turned the way
 * you face when it fits that way.
 */
import { ACTION_BY_ID } from '../../src/game/actions';
import { DEPLOY_REACH, deploySpot, isDriveable } from '../../src/game/furniture';
import { Game } from '../../src/game/game';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const game = Game.create(4242);
const place = ACTION_BY_ID.get('place_furniture');
if (!place) throw new Error('there is no place_furniture any more');
const p = game.player;
p.dirX = 1;
p.dirY = 0;
const wagon = game.inventory.add('wagon', { ql: 30 });
check('a wagon is a vehicle, and a stool is not', isDriveable({ kind: 'wagon' }) && !isDriveable({ kind: 'stool' }));

const spot = deploySpot(game, wagon);
check('there is a spot for it beside the body', !!spot, spot ? `${spot.x},${spot.y} facing ${spot.facing}` : 'none');
if (spot) {
  const away = Math.max(Math.abs(spot.x - p.tileX), Math.abs(spot.y - p.tileY));
  check('off the tile the body stands on, and within reach', away >= 1 && away <= DEPLOY_REACH, `${away} tiles off`);
  check('turned the way the body faces', spot.facing === 'e', `facing ${spot.facing}`);
  check('and the set-down agrees it may go there', (place.check?.(spot, game) ?? null) === null);
  const before = [...game.furniture.values()].filter((f) => f.kind === 'wagon').length;
  place.perform?.(spot, game);
  const after = [...game.furniture.values()].filter((f) => f.kind === 'wagon');
  check('set down: a wagon on the ground, out of the pack',
    after.length === before + 1 && !game.inventory.get(wagon.uid), `${after.length - before} set down, in pack: ${!!game.inventory.get(wagon.uid)}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`deploy sets a vehicle down beside you — ${ok.length} of ${ok.length}`);
