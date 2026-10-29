/**
 * A mount under you walks as you walk, on the island; and so does a team in the traces, yours or anybody's.
 *
 * Reported: "mounts when ridden do no animations like walking". Your own mount is carried under you each frame
 * (`Game.carryRider`), which sets it going and steps its gait; on the island the creatures are then walked along the
 * legs the island gave them (`Creatures.walkLegs`), and a ridden one's leg is one of no length, which stopped it again
 * every frame. So this asks, of a grown, saddled Thistlekit ridden across open ground with the wildlife the island's:
 *
 *   * every frame of the ride, it is going, facing the way you go, and its gait steps on;
 *   * it is where you are;
 *   * and once you stop, it stops.
 *
 * And asked: "Make sure that fix also applies to hitched mons". A team in the traces of a vehicle you drive is put
 * ahead of it each frame (`Game.haulVehicle`) and was stopped the same way; and the island drags the team of a vehicle
 * somebody else drives to their feet on a leg of no length (`drag_along`), so everybody else saw it stand under the
 * driver. So the same is asked of two Thistlekits in the traces of a large cart, driven by you and then by somebody
 * else, and of where they stand: ahead of the cart, the way it goes.
 */
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';
import type { Creature } from '../../src/game/creatures';

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

/* ---- a team in the traces -------------------------------------------------------- */

g.dismount();
g.player.x = 24.5;
g.player.y = 36.5;
g.player.stop();
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
const cart = g.addFurniture('large_cart', 24, 36, 0, 0, 40, [], 'Pine');
const team: Creature[] = [0, 1].map(() => {
  const c = g.creatures.spawn('orse', 25.5, 36.5, 'active', g.rand, g.time - 3600 * 24 * 60);
  c.hunger = 1;
  return c;
});
check('two Thistlekits go into the traces of a large cart', team.every((c) => g.hitch(c, cart)));
cart.driven = true;
for (const c of team) {
  c.legAt = Date.now();
  c.legEnds = c.legAt;
}
const drive = (what: string, step: () => void, ahead: () => [number, number]): void => {
  const seen: Array<{ moving: boolean; phase: number; dx: number; off: number }> = [];
  for (let i = 0; i < 45; i++) {
    step();
    const [ax] = ahead();
    for (const c of team) seen.push({ moving: c.moving, phase: c.walkPhase, dx: c.dirX, off: c.x - ax });
  }
  const mid = seen.slice(team.length * 2, team.length * 35);
  check(`${what}: every frame of the drive, each of the team is going`, mid.every((f) => f.moving), `${mid.filter((f) => !f.moving).length} of ${mid.length} still`);
  check(`${what}: facing the way it goes, east, its gait stepping on`,
    mid.every((f) => f.dx > 0) && team.every((c, k) => mid[mid.length - team.length + k].phase > mid[k].phase));
  check(`${what}: ahead of the cart, not under it`, mid.every((f) => f.off > 0.5), `${Math.min(...mid.map((f) => f.off)).toFixed(2)} tiles ahead at the least`);
};
g.moveTo(40, 36);
drive('your own cart', () => g.update(1 / 30), () => [g.player.x, g.player.y]);

// Somebody else on the box: the island drags the cart and its team to their feet, a walk of theirs at a time.
g.player.stop();
cart.driven = false;
cart.helm = 'driver-uid';
let dx = 30.5;
const seenAs = (x: number): void => g.roster.saw({ id: 9001, uid: 'driver-uid', name: 'Drover', x, y: 36.5, dirX: 1, dirY: 0, level: 0,
  moving: true, swimming: false, working: false } as never);
seenAs(dx);
drive("somebody else's cart", () => {
  dx += 0.12;
  seenAs(dx);
  for (const c of team) {
    c.legAt = Date.now();
    c.legEnds = c.legAt;
  }
  g.roster.ease(1 / 30);
  g.update(1 / 30);
}, () => g.roster.drawnAt(g.roster.byUid('driver-uid')!));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a mount under you walks as you walk — ${ok.length} of ${ok.length}`);
