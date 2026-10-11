/**
 * The rune gate: a settlement's way in, two pillars cut with runes under a
 * lintel, the kin of the Runestones on the Crescent's shore.
 *
 * It is a wall type (`WALL_TYPES`, `rune_gate`), and so everything about
 * where it stands and what it costs is the walls' own: planned with Plan fence
 * on any border, building or none, on the ground; fed a unit at a time with
 * Build fence; laid in stone brick and nothing else (`WallTypeDef.laidIn`,
 * asked where a material's `only` is: `onlyRefusal` here and
 * `material_only_refusal` on an island), with a light mote set in each pillar
 * over the stone's bill; taken down with Remove fence. Nothing hangs in it and
 * nothing locks it: people, carts and beasts all pass and the eye goes
 * through, and nothing rests on its lintel.
 *
 * What it does is light. While a citizen of a settlement whose border takes
 * in the tile on either side of it -- its founder, a mayor or a builder; not
 * a guest, not a stranger -- stands within `RUNE_GATE_REACH` of the middle
 * of its opening, both pillars' runes and the roundel on the lintel light,
 * one after the other up from the foot over `RUNE_GATE_RISE`; and once nobody
 * of the settlement is in the opening they go out over `RUNE_GATE_FADE`.
 * After dark they throw a small pool of pale gold, as a Runestone's do
 * (`runeGateLight`). The light is only drawn: no rule asks about it.
 *
 * It is the browser's own doing from what it already holds: where every body
 * is drawn, and who is a citizen. For the body playing that is the
 * settlements it is on and its rank on each (`myDeeds`). For anybody else on
 * an island it is the roll of each settlement a rune gate stands on, which
 * the island sends to whoever is ashore (`rpc_rune_gate_folk`, the one rule
 * this needs) and this keeps (`sawGateFolk`).
 */
import { isDone, WALL_TYPE_BY_ID, type Border, type Wall } from './building';
import type { Game } from './game';
import type { LightSource } from './light';
import { rankAtLeast } from './ranks';

/** The wall type a rune gate is. */
export const RUNE_GATE = 'rune_gate';
/** How near the middle of its opening a citizen lights it, in tiles: about a stride either side of the line between its pillars. */
export const RUNE_GATE_REACH = 0.75;
/** Seconds its runes take to come up, the lowest first and the roundel last. */
export const RUNE_GATE_RISE = 0.4;
/** Seconds they take to go out once no citizen is in the opening. */
export const RUNE_GATE_FADE = 1.5;
/** The rank a citizen holds at least: a builder (a guest walks a settlement and is not of it). */
export const RUNE_GATE_RANK = 'builder';

/**
 * And its light after dark, while lit: a pool of pale gold out to this many
 * tiles from the middle of its opening, as strong as a Runestone's at the
 * full, and less as it fades (`runeGateLight`). Drawn only.
 */
export const RUNE_GATE_GLOW_REACH = 1.6;
export const RUNE_GATE_GLOW = 0.3;
export const RUNE_GATE_CAST = '255, 204, 128';
export const RUNE_GATE_CAST_ALPHA = 0.3;

/** Whether a wall is a rune gate. */
export const isRuneGate = (w: Pick<Wall, 'type'> | undefined): boolean => w?.type === RUNE_GATE;

/** The middle of a border, in tiles: where a rune gate's opening is measured from. */
export function gateMiddle(b: Border): { x: number; y: number } {
  return b.dir === 'h' ? { x: b.x + 0.5, y: b.y } : { x: b.x, y: b.y + 0.5 };
}

/** The two tiles a border lies between: the one it is the north or west edge of, and the one across it. */
export function gateTiles(b: Border): Array<[number, number]> {
  return b.dir === 'h' ? [[b.x, b.y], [b.x, b.y - 1]] : [[b.x, b.y], [b.x - 1, b.y]];
}

/** A border's key: the same one for the wall, wherever it is asked from. */
const keyOf = (b: Border): string => `${b.dir}${b.x},${b.y}`;

/* ---- who is a citizen ------------------------------------------------------ */

/**
 * The rolls the island sent: for each settlement a rune gate stands on, by
 * where its token is ("12,40"), the uids of its founder, mayors and builders.
 */
const folkOf = new WeakMap<object, Map<string, Set<string>>>();

/**
 * Keep what the island said of the rolls (`rpc_rune_gate_folk`): a list of
 * settlements, each its token's `x` and `y` and its citizens' uids in `folk`.
 * Anything else in it is passed over.
 */
export function sawGateFolk(g: Game, rows: unknown[]): void {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const { x, y, folk } = r as { x?: unknown; y?: unknown; folk?: unknown };
    if (typeof x !== 'number' || typeof y !== 'number' || !Array.isArray(folk)) continue;
    out.set(`${x},${y}`, new Set(folk.filter((u): u is string => typeof u === 'string')));
  }
  folkOf.set(g, out);
}

/** Whether any rune gate is standing finished among the walls this browser holds: whether the rolls are worth asking for. */
export function runeGatesHeld(g: Game): boolean {
  for (const w of g.buildings.walls.values()) if (isRuneGate(w)) return true;
  return false;
}

/** Whether a settlement's square takes in a tile. */
const covers = (d: { x: number; y: number; radius: number }, x: number, y: number): boolean =>
  Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius;

/** Whether the body playing is a citizen of a settlement that takes in either side of this border. */
function selfCitizen(g: Game, b: Border): boolean {
  const tiles = gateTiles(b);
  return g.myDeeds().some((d) => rankAtLeast(d.role, RUNE_GATE_RANK) && tiles.some(([x, y]) => covers(d, x, y)));
}

/** Whether somebody else, by their uid, is on the roll the island sent of a settlement that takes in either side of this border. */
function peerCitizen(g: Game, b: Border, uid: string | undefined): boolean {
  const rolls = folkOf.get(g);
  if (!uid || !rolls?.size) return false;
  const tiles = gateTiles(b);
  // The island's list names a settlement by its token, which every settlement in view is drawn from (`neighbourDeeds`, and our own).
  const deeds = [...g.neighbourDeeds, ...(g.deed ? [g.deed] : [])];
  return deeds.some((d) => tiles.some(([x, y]) => covers(d, x, y)) && !!rolls.get(`${d.x},${d.y}`)?.has(uid));
}

/** Whether a citizen of the gate's settlement stands within its reach now: the body playing, or anybody drawn near it. */
export function citizenInGate(g: Game, b: Border): boolean {
  const m = gateMiddle(b);
  const near = (x: number, y: number, level: number): boolean => level === 0 && Math.hypot(x - m.x, y - m.y) <= RUNE_GATE_REACH;
  if (near(g.player.x, g.player.y, g.player.level) && selfCitizen(g, b)) return true;
  if (!g.roster.size) return false;
  for (const p of g.roster.list()) {
    const [x, y] = g.roster.drawnAt(p);
    if (near(x, y, p.level) && peerCitizen(g, b, p.uid)) return true;
  }
  return false;
}

/* ---- how lit it is ----------------------------------------------------------- */

/** When each gate was last lit from dark, and when a citizen was last in it, in seconds on the clock the frames are drawn by. */
interface Lit { from: number; last: number }
const litOf = new WeakMap<object, Map<string, Lit>>();

/**
 * How lit a rune gate is at `now` (seconds, the frames' clock), nought to
 * one, and how long since it came up from dark: one while a citizen is in
 * it and for as long after as it takes to start fading, then down to nought
 * over `RUNE_GATE_FADE`. A rune gate unfinished, or anything else, is dark.
 * `since` is what the runes' climb up the pillars is timed from.
 */
export function runeGateLit(g: Game, w: Wall, now: number): { lit: number; since: number } {
  if (!isRuneGate(w) || w.level !== 0 || !isDone(w)) return { lit: 0, since: 0 };
  let byGate = litOf.get(g);
  if (!byGate) litOf.set(g, (byGate = new Map()));
  const key = keyOf(w);
  let s = byGate.get(key);
  if (citizenInGate(g, w)) {
    // Lit afresh only from dark: one who walks back in while it is still fading keeps the light it had.
    if (!s || now - s.last > RUNE_GATE_FADE) s = { from: now, last: now };
    else s.last = now;
    byGate.set(key, s);
  }
  if (!s) return { lit: 0, since: 0 };
  const out = now - s.last;
  if (out > RUNE_GATE_FADE) {
    byGate.delete(key);
    return { lit: 0, since: 0 };
  }
  return { lit: 1 - Math.max(0, out) / RUNE_GATE_FADE, since: Math.max(0, now - s.from) };
}

/** The light of every rune gate lit near `near`, at `now`: a pool of pale gold round the middle of each opening, as strong as it is lit. */
export function runeGateLights(g: Game, now: number, near: (x: number, y: number) => boolean): LightSource[] {
  const out: LightSource[] = [];
  for (const w of g.buildings.walls.values()) {
    if (!isRuneGate(w)) continue;
    const m = gateMiddle(w);
    if (!near(m.x, m.y)) continue;
    const { lit } = runeGateLit(g, w, now);
    if (lit > 0.01) out.push(runeGateLight(m.x, m.y, lit));
  }
  return out;
}

/** A rune gate's light, its opening's middle at world (x, y), `lit` of the way up. */
export const runeGateLight = (x: number, y: number, lit: number): LightSource => ({
  x, y, radius: RUNE_GATE_GLOW_REACH, strength: RUNE_GATE_GLOW * lit, steady: true, soft: true,
  cast: RUNE_GATE_CAST, castAlpha: RUNE_GATE_CAST_ALPHA * lit,
});

/** What a rune gate is, as the help and the news name it: its wall type's own name, lower case. */
export const runeGateName = (): string => (WALL_TYPE_BY_ID.get(RUNE_GATE)?.name ?? 'Rune gate').toLowerCase();
