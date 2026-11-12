/**
 * A wildermon's light goes where the wildermon goes, and nowhere it is not.
 *
 * Reported: "i believe i've had a glimmoth glow following me at a delay ever
 * since capturing one. The glow seems to have stayed after crating it and even
 * now that the crate is stored in a stall." The night's lights (`Game.lights`)
 * gave every creature in the list its light -- the Glimmoth line's lantern
 * belly and a dragon's glow -- one shut in a wildermon crate too. The island
 * keeps sending one in a carried crate, at its holder's feet a poll behind,
 * and one in a stored crate where it was last put: a pool of light with
 * nothing in it, after the player, then left on a hillside.
 *
 * Now a creature lights the ground only while it is out in the world and drawn
 * there (`inWorld`, which the renderer draws by too). Taken through every way
 * one comes and goes: wild, tamed and following, evolved, crated in the pack,
 * carried, its crate set down, put in a stall, let out again, killed, and
 * gone from the island's answer.
 *
 * The browser's half only: the island sends what it sends, and what is drawn
 * of it, and lit, is the browser's.
 */
import { Game, DAY_SECONDS } from '../../src/game/game';
import { EVOLVE_AT, inWorld, levelSkill, SPECIES, stageOf, type Creature, type IslandCreature } from '../../src/game/creatures';
import { letOut, shutIn } from '../../src/game/creaturecrate';
import { MOTH_LIGHT } from '../../src/game/light';
import type { Item } from '../../src/game/items';

let bad = 0;
const say = (ok: boolean, line: string): void => {
  if (!ok) bad++;
  console.log(`${ok ? '  ' : 'X '}${line}`);
};

const game = Game.create(5151);
game.time = 0; // midnight
game.creatures.list.clear();
const px = game.player.x, py = game.player.y;

/** The lights a creature's own light would be: its kind's reach, wherever they are. */
const reach = (c: Creature): number => SPECIES[c.species].glow ?? MOTH_LIGHT;
const lightsOf = (c: Creature): Array<{ x: number; y: number }> => game.lights().filter((l) => l.radius === reach(c) && l.steady && !l.level);
const litAt = (c: Creature): boolean => lightsOf(c).some((l) => Math.abs(l.x - c.x) < 1e-9 && Math.abs(l.y - c.y) < 1e-9);
const dark = (c: Creature): boolean => lightsOf(c).length === 0;
const at = (c: Creature): string => `(${c.x.toFixed(1)}, ${c.y.toFixed(1)})`;

/* ---- A Glimmoth ------------------------------------------------------------- */

const moth = game.creatures.spawn('wicka', px + 2.5, py + 0.5, 'wild', game.rand, game.time - 60 * DAY_SECONDS);
say(stageOf(moth) === 0, `a Glimmoth: the wicka line's first stage (${stageOf(moth)})`);
say(litAt(moth) && lightsOf(moth).length === 1, `wild, it lights the ground where it is ${at(moth)}: ${lightsOf(moth).length} light`);

moth.mode = 'active';
moth.mine = true;
moth.x = px + 1;
moth.y = py + 0.5;
say(litAt(moth) && lightsOf(moth).length === 1, `tamed and following you, it lights the ground where it is ${at(moth)}`);

const skill = levelSkill(SPECIES.wicka);
if (skill) moth.skills[skill] = EVOLVE_AT[0];
say(stageOf(moth) === 1 && litAt(moth) && lightsOf(moth).length === 1, `evolved to its second stage (${stageOf(moth)}), it still lights the ground, once`);
if (skill) moth.skills[skill] = 1;

// Into a wildermon crate in the pack.
const crate: Item = { uid: 9101, id: 'creature_crate', ql: 40, dmg: 0, count: 1 };
game.inventory.addItem(crate);
const packed = game.inventory.items.find((it) => it.id === 'creature_crate');
if (!packed) throw new Error('no wildermon crate in the pack');
shutIn(game, moth, packed);
say(!inWorld(moth), `crated, it is out of the world (mode ${moth.mode})`);
say(dark(moth), `crated, it lights nothing: ${lightsOf(moth).length} lights, where it stood or at your feet ${at(moth)}`);

// Carried: the island sends it a poll behind you, at your feet where you were.
game.player.x = px - 3;
game.player.y = py + 2;
moth.x = px - 1.8;
moth.y = py + 1.2;
say(dark(moth), `carried, nothing follows you: ${lightsOf(moth).length} lights about ${at(moth)}`);

// As the island says it: a row in its answer, mode stored, at the holder.
const row = (c: Creature, over: Partial<IslandCreature> = {}): IslandCreature => ({
  id: c.id, species: c.species, name: c.name, variant: c.variant, mode: c.mode, stance: c.stance, x: c.x, y: c.y, health: c.health, ...over,
} as IslandCreature);
game.creatures.sawAll([row(moth, { mode: 'stored', x: game.player.x - 0.6, y: game.player.y - 0.4 })], game.time);
say(game.creatures.list.has(moth.id) && dark(moth), `the island's answer for it, stored at its holder ${at(moth)}: ${lightsOf(moth).length} lights`);

// Its crate set down on the ground.
game.inventory.items.splice(game.inventory.items.indexOf(packed), 1);
packed.creature = undefined;
const standing = game.addFurniture('creature_crate', Math.floor(px) + 4, Math.floor(py) - 2, 0, 0, 40);
shutIn(game, moth, standing);
say(dark(moth), `its crate standing on the ground: ${lightsOf(moth).length} lights at the crate ${at(moth)}`);

// Picked up and stored in a stall: the island last put it on the hillside.
standing.creature = undefined;
game.furniture.delete(standing.id);
const stall = game.addFurniture('stall', Math.floor(px) + 6, Math.floor(py) + 3, 0, 0, 40);
const stored: Item = { uid: 9102, id: 'creature_crate', ql: 40, dmg: 0, count: 1, creature: moth.id };
stall.items.push(stored);
game.creatures.sawAll([row(moth, { mode: 'stored', x: px + 7.5, y: py + 4.5 })], game.time);
say(dark(moth), `its crate stored in a stall: ${lightsOf(moth).length} lights on the hillside ${at(moth)}`);

// Let out of a crate in the pack: lit again, where it stands.
stall.items.length = 0;
const again: Item = { uid: 9103, id: 'creature_crate', ql: 40, dmg: 0, count: 1, creature: moth.id };
game.inventory.addItem(again);
moth.mode = 'active';
letOut(game, moth);
say(inWorld(moth) && litAt(moth) && lightsOf(moth).length === 1, `let out, it lights the ground where it stands ${at(moth)}, once`);

// Gone from the island's answer: out of range, or dead there.
game.creatures.sawAll([], game.time);
say(!game.creatures.list.has(moth.id) && dark(moth), `gone from the island's answer, its light goes with it: ${lightsOf(moth).length} lights`);

// Killed here.
const wild = game.creatures.spawn('wicka', px + 3.5, py - 1.5, 'wild', game.rand, game.time - 60 * DAY_SECONDS);
say(litAt(wild), `a wild one lights the ground ${at(wild)}`);
game.creatures.kill(game, wild, 'player', true);
say(dark(wild), `killed, its light goes with it: ${lightsOf(wild).length} lights`);

/* ---- Every kind with a light of its own -------------------------------------- */

const glowing = Object.values(SPECIES).filter((d) => d.glow).map((d) => d.id);
say(glowing.length > 0, `kinds with a light of their own: ${glowing.join(', ')}`);
for (const id of glowing) {
  game.creatures.list.clear();
  const c = game.creatures.spawn(id, px + 2.5, py + 2.5, 'active', game.rand, game.time - 60 * DAY_SECONDS);
  say(litAt(c), `a ${id} out in the world lights the ground (${reach(c)})`);
  const box: Item = { uid: 9200, id: 'creature_crate', ql: 40, dmg: 0, count: 1 };
  shutIn(game, c, box);
  c.x = game.player.x - 1;
  say(dark(c), `crated and carried, it lights nothing: ${lightsOf(c).length}`);
}

/* ---- Every light from a creature is from one in the world --------------------- */

game.creatures.list.clear();
const many = [0, 1, 2, 3].map((i) => game.creatures.spawn(i % 2 ? 'wicka' : glowing[0] ?? 'wicka', px + i, py - 2, i < 2 ? 'active' : 'wild', game.rand, game.time));
for (const c of many.slice(1, 3)) shutIn(game, c, { uid: 9300 + c.id, id: 'creature_crate', ql: 40, dmg: 0, count: 1 });
const lit = many.filter((c) => litAt(c)).map((c) => c.id).sort();
const out = many.filter(inWorld).map((c) => c.id).sort();
say(JSON.stringify(lit) === JSON.stringify(out), `of four, two of them crated, those lit are those in the world: ${JSON.stringify(lit)} and ${JSON.stringify(out)}`);

game.time = DAY_SECONDS / 2;
say(game.lights().length === 0 || !game.lights().some((l) => l.radius === MOTH_LIGHT), 'and by day nothing is lit');

console.log(bad ? `${bad} failed` : "a wildermon's light goes where it goes");
if (bad) process.exit(1);
