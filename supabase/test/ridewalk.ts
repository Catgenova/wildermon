/**
 * A mount under you walks as you walk, on the island.
 *
 * Reported: "mounts when ridden do no animations like walking". Your own mount is carried under you each frame
 * (`Game.carryRider`), which sets it going and steps its gait; on the island the creatures are then walked along the
 * legs the island gave them (`Creatures.walkLegs`), and a ridden one's leg is one of no length, which stopped it again
 * every frame. So this asks, of a grown, saddled Thistlekit ridden across open ground with the wildlife the island's:
 *
 *   * every frame of the ride, it is going, facing the way you go, and its gait steps on;
 *   * it is where you are;
 *   * and once you stop, it stops.
 */
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const g = Game.create(4321, 64);
for (let y = 20; y <= 44; y++) for (let x = 20; x <= 44; x++) { g.world.setHeight(x, y, 20); g.world.setTile(x, y, TileType.Grass, 0); }
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
g.player.x = 24.5;
g.player.y = 30.5;
const mount = g.creatures.spawn('orse', 24.5, 30.5, 'active', g.rand, g.time - 3600 * 24 * 60);
mount.tacked = true;
mount.hunger = 1;
check('a grown, saddled Thistlekit is mounted', g.mount(mount) && g.mounted() === mount);
// The wildlife is the island's from here: walked along its legs, and this one given a leg of no length, as the island does.
g.creatures.fromIsland = true;
mount.legAt = Date.now();
mount.legEnds = mount.legAt;
g.moveTo(40, 30);
const frames: Array<{ moving: boolean; phase: number; dx: number; at: number }> = [];
for (let i = 0; i < 60; i++) {
  g.update(1 / 30);
  frames.push({ moving: mount.moving, phase: mount.walkPhase, dx: mount.dirX, at: Math.hypot(mount.x - g.player.x, mount.y - g.player.y) });
}
const going = frames.slice(1, 40);
check('every frame of the ride it is going', going.every((f) => f.moving), `${going.filter((f) => !f.moving).length} of ${going.length} still`);
check('facing the way you go, east', going.every((f) => f.dx > 0));
check('its gait steps on', going.every((f, i) => i === 0 || f.phase > going[i - 1].phase), `${going[0].phase.toFixed(2)} → ${going[going.length - 1].phase.toFixed(2)}`);
check('it is where you are', frames.every((f) => f.at < 1e-6));
g.player.stop();
g.update(1 / 30);
g.update(1 / 30);
check('and once you stop, it stops', !mount.moving);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a mount under you walks as you walk — ${ok.length} of ${ok.length}`);
