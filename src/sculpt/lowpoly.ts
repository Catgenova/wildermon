/**
 * The low-poly male and female bodies (`tools/sculpt/lowarm.mjs` buildArmBody) on their own rigs
 * (`tools/sculpt/lowrig.mjs`), as `lowrig.mjs` writes them to `assets/lowmale.json` and `assets/lowfemale.json`: drawn
 * flat (each polygon its own corners and its own normal) by the GPU skinning path (`./gl`), posed from the figure's rig
 * each frame. The figure's bones (`bonesOf`, with the body's own proportions) are taken onto ours as `fromGame` in
 * `lowrig.mjs` takes them (each control bone turned as its figure bone has turned from the fitted rest, our own joints
 * kept; the arms kept off the body, hers turned further out as they swing, the ankles and toes as hinges on the body's
 * own axes, the thumbs closed toward the palm), the helpers driven from those, and the body stood on its lowest sole.
 * Shaded as the review renders shade it: one colour a polygon, from its normal in view space, by the light fitted for
 * that body (`tools/sculpt/lowlight-<who>.json`, written by `tools/sculpt/lowlight.py`), in the look's skin. A hairstyle
 * made for the low-poly bodies (`tools/sculpt/lowhair.mjs`, `./assets/lowhair.json`: 'swept', 'braid', 'bob') is drawn with the
 * body, on the head bone, in three tones of the look's hair colour (its valleys a fourth, darker), the body's scalp
 * under it shaved; any other style draws no hair yet, and none is drawn while the hood is up (`hairShown`). The
 * undergarment (`tools/sculpt/lowunder.mjs`: his briefs; her briefs and band) is the body's own polygons painted, their
 * material `M.under` (matte: lit by the light's brightness without its highlight or rims); a polygon split for its line
 * is two, the piece after the body's polygons (`split`), left out with its parent under a garment that hides that.
 *
 * Over the body, a garment (`tools/sculpt/lowgarment.mjs` garmentAsset, written beside each body: the first outfit's
 * shawl, `assets/lowshawl-<who>.json` by `tools/sculpt/garments/shawl.mjs`): laid out flat with the body in one bake,
 * skinned to the body's bones and its own (the cape's, appended after the body's, each driven from the body's pose by
 * `liftOf`, the 'lift' rule of lowgarment.mjs), lit by the same light in its own colours, inked with the body as one
 * silhouette. Garments are listed in GARMENTS, each with its wear hook: the first outfit's shawl, its trousers
 * (`assets/lowtrousers-<who>.json` by `tools/sculpt/garments/trousers.mjs`, no bones of their own; the body's polygons
 * they cover whole, `hides`, are left out of the bake while they are worn), its boots (`assets/lowboots-<who>.json`
 * by `tools/sculpt/garments/boots.mjs`, no bones of their own, hiding the foot and the ankle; the body stands on their
 * soles, `soles`, while they are worn), its tunic (`assets/lowtunic-<who>.json`, fitted over the trousers and under
 * the shawl by `tools/sculpt/garments/outfit1.mjs`, no bones of its own, `hides` too) and its hood
 * (`assets/lowhood-<who>.json` by `tools/sculpt/garments/hood.mjs`, no bones of its own, rising out of the shawl's cowl;
 * while it is up the hair is not drawn, `hairShown`), and the plate set's helm (`assets/lowhelm-<who>.json` by
 * `tools/sculpt/garments/helm.mjs`: rigid on the head, the head's polygons it covers whole left out, the hair not drawn
 * under it; off unless `outfit.plateHelm`), the chain set's coif, hauberk & sleeves, leggings and boots (mail laid over
 * the body's own triangles in courses of rings, by `tools/sculpt/garments/chaincoif.mjs`, chainchest.mjs, chainlegs.mjs,
 * chainboots.mjs; their mail in its metal), and the scale set's helm, cuirass & sleeves, leggings and boots
 * (`assets/lowscale<piece>-<who>.json` by `tools/sculpt/garments/scale*.mjs`: dragon scale in courses over leather, all
 * four in the set's one material, `scaleMat`). Garments share materials by colour; a bake takes only the worn ones' (`usedOf`).
 *
 * In both hands while a clip grips it (`./anim` Clip.grip, `heldIn`), the long sword (`assets/long_sword.json`,
 * `tools/sculpt/lowgear.mjs` gearAsset): laid at rest on the right hand's socket (its grip's lead point at the fist,
 * its axes the socket's) and skinned wholly to that hand, the left hand put on its grip by the clip player; lit by the
 * body's light in its own colours, its engraving lit when enchanted (its glow left to the renderer's bloom). Over its
 * clip's blow, the blade's slash trail (`./anim/trail.ts`), lit gold when it is enchanted. Wielded but not in hand (no
 * clip gripping it), it is carried on the back: laid at rest on its back socket (`sockets.<who>.back`, by
 * `tools/sculpt/lowgear.mjs` backSocketOf: the hilt behind the right shoulder, the point toward the left hip, its flat
 * on the shawl's cape) and skinned wholly to the upper back (spine_03). The maul is drawn the same way in both hands as
 * the Runestone Warhammer (`assets/warhammer.json`, `tools/sculpt/gear/warhammer.mjs`), its striking ends kept off the
 * ground (`Held.ends`, `Held.rest`), its head's slash trail over the blow (`PropAsset.trail`), and carried on the back
 * head up (its back socket: the head behind the right shoulder blade, the haft toward the left hip, clear of every
 * garment set). Mining (the jobs swung overhead, `./anim` SWING_TOOL) draws the Runestone Pickaxe
 * (`assets/pickaxe.json`, `tools/sculpt/gear/pickaxe.mjs`) in both hands the same way, with no trail.
 *
 * Every other weapon wielded is drawn too (`tools/sculpt/gear/weapons.mjs`; the hatchet and the butchering and carving
 * knives are the hand tools' own props): the battle axe, the spear and the javelin in both hands in the overhead swing,
 * each with its head's slash trail, and carried on the back while not in hand (the axe head up as the maul, the spear and
 * the javelin point up); the swords, the knives, the hatchet, the club and the throwing axe in the striking fist of the
 * one-handed fight (`./anim` ONE_HAND, `./anim/clips/fight.ts`) as a hand tool is (`toolsIn`), each with its blade's or
 * head's slash trail; carried while not in hand, the swords and the club on the back as the long sword, the knives, the
 * hatchet and the throwing axe across the small of the back under the belt (`sockets.<who>.belt`, tools/sculpt/lowgear.mjs
 * beltSocketOf), rigid on the pelvis. The club's wood is drawn in the wood it is carved from (`woodTint`).
 *
 * Each prop's head or blade (its stone, `PropMaterial.metal`) is drawn in the metal it was smithed from: the weapon's
 * material, or for mining the pose's tool's (`FigurePose.tool`), in the flat figure's colours for that metal
 * (`metalShades`; iron's for none), lit as metal (`Material.metal`: `./gl.ts` METAL_CURVE, METAL_SHEEN); its gold, wood,
 * leather, collars, emblems, pommel and glow keep their own colours (`metalTint`).
 */
import MALE_ASSET from './assets/lowmale.json';
import FEMALE_ASSET from './assets/lowfemale.json';
import MALE_SHAWL from './assets/lowshawl-male.json';
import FEMALE_SHAWL from './assets/lowshawl-female.json';
import MALE_TROUSERS from './assets/lowtrousers-male.json';
import FEMALE_TROUSERS from './assets/lowtrousers-female.json';
import MALE_BOOTS from './assets/lowboots-male.json';
import FEMALE_BOOTS from './assets/lowboots-female.json';
import MALE_PLATE_BOOTS from './assets/lowplateboots-male.json';
import FEMALE_PLATE_BOOTS from './assets/lowplateboots-female.json';
import MALE_LEATHER_LEGS from './assets/lowleatherlegs-male.json';
import FEMALE_LEATHER_LEGS from './assets/lowleatherlegs-female.json';
import MALE_LEATHER_LEGS_FLAPS from './assets/lowleatherlegsflaps-male.json';
import FEMALE_LEATHER_LEGS_FLAPS from './assets/lowleatherlegsflaps-female.json';
import MALE_LEATHER_BOOTS from './assets/lowleatherboots-male.json';
import FEMALE_LEATHER_BOOTS from './assets/lowleatherboots-female.json';
import MALE_TUNIC from './assets/lowtunic-male.json';
import FEMALE_TUNIC from './assets/lowtunic-female.json';
import MALE_HOOD from './assets/lowhood-male.json';
import MALE_PLATE_CHEST from './assets/lowplatechest-male.json';
import FEMALE_PLATE_CHEST from './assets/lowplatechest-female.json';
import FEMALE_HOOD from './assets/lowhood-female.json';
import MALE_HELM from './assets/lowhelm-male.json';
import FEMALE_HELM from './assets/lowhelm-female.json';
import MALE_PLATE_LEGS from './assets/lowplatelegs-male.json';
import FEMALE_PLATE_LEGS from './assets/lowplatelegs-female.json';
import MALE_MANTLE from './assets/lowmantle-male.json';
import FEMALE_MANTLE from './assets/lowmantle-female.json';
import MALE_LEATHER_HAT from './assets/lowhat-male.json';
import FEMALE_LEATHER_HAT from './assets/lowhat-female.json';
import MALE_LEATHER_SHAWL from './assets/lowleathershawl-male.json';
import FEMALE_LEATHER_SHAWL from './assets/lowleathershawl-female.json';
import MALE_LEATHER_SHAWL_OVER from './assets/lowleathershawlover-male.json';
import FEMALE_LEATHER_SHAWL_OVER from './assets/lowleathershawlover-female.json';
import MALE_LEATHER_CHEST from './assets/lowleatherchest-male.json';
import FEMALE_LEATHER_CHEST from './assets/lowleatherchest-female.json';
// the chain set (tools/sculpt/garments/chainchest.mjs, chaincoif.mjs, chainlegs.mjs, chainboots.mjs)
import MALE_CHAIN_CHEST from './assets/lowchainchest-male.json';
import FEMALE_CHAIN_CHEST from './assets/lowchainchest-female.json';
import MALE_CHAIN_COIF from './assets/lowchaincoif-male.json';
import FEMALE_CHAIN_COIF from './assets/lowchaincoif-female.json';
import MALE_CHAIN_LEGS from './assets/lowchainlegs-male.json';
import FEMALE_CHAIN_LEGS from './assets/lowchainlegs-female.json';
import MALE_CHAIN_BOOTS from './assets/lowchainboots-male.json';
import FEMALE_CHAIN_BOOTS from './assets/lowchainboots-female.json';
// the scale set (tools/sculpt/garments/scalechest.mjs)
import MALE_SCALE_CHEST from './assets/lowscalechest-male.json';
import FEMALE_SCALE_CHEST from './assets/lowscalechest-female.json';
import MALE_SCALE_LEGS from './assets/lowscalelegs-male.json';
import FEMALE_SCALE_LEGS from './assets/lowscalelegs-female.json';
import MALE_SCALE_BOOTS from './assets/lowscaleboots-male.json';
import FEMALE_SCALE_BOOTS from './assets/lowscaleboots-female.json';
import MALE_SCALE_HELM from './assets/lowscalehelm-male.json';
import FEMALE_SCALE_HELM from './assets/lowscalehelm-female.json';
import LONG_SWORD from './assets/long_sword.json';
import WARHAMMER from './assets/warhammer.json';
import PICKAXE from './assets/pickaxe.json';
// the Runecut hand tools, struck with at the bench (tools/sculpt/gear/hammer.mjs, mallet.mjs, chisel.mjs, hatchet.mjs, butchering_knife.mjs)
import HAMMER from './assets/hammer.json';
import MALLET from './assets/mallet.json';
import CHISEL from './assets/chisel.json';
import HATCHET from './assets/hatchet.json';
import BUTCHERING_KNIFE from './assets/butchering_knife.json';
import AWL from './assets/awl.json';
import CARVING_KNIFE from './assets/carving_knife.json';
import TROWEL from './assets/trowel.json';
import FILE from './assets/file.json';
import WHETSTONE from './assets/whetstone.json';
// the weapons wielded that are not the long sword or the maul (tools/sculpt/gear/weapons.mjs)
import SWORD_1H from './assets/sword.json';
import SHORT_SWORD from './assets/short_sword.json';
import HUNTING_KNIFE from './assets/hunting_knife.json';
import BATTLE_AXE from './assets/battle_axe.json';
import CLUB from './assets/club.json';
import SPEAR from './assets/spear.json';
import JAVELIN from './assets/javelin.json';
import THROWING_AXE from './assets/throwing_axe.json';
import HAIR_ASSET from './assets/lowhair.json';
import MALE_LIGHT from '../../tools/sculpt/lowlight-male.json';
import FEMALE_LIGHT from '../../tools/sculpt/lowlight-female.json';
import { DRAGON_SCALE, isMetalTone, metalShades, sculptRig, viewOf, woodTone, type ChainPiece, type FigurePose, type DyedPiece, type GearPiece, type PlatePiece, type Rig } from '../render/figure';
import { DEFAULT_LOOK, type Look } from '../game/look';
import { ANCIENT_SWORD } from '../game/gear';
import { STRIDE, type Baked } from './bake';
import { M, bodyMaterials } from './models/body';
import { bonesOf, FEMALE, heightOf, MALE, REST_EXTRAS, relaxedIdle, type Bones, type Proportions } from './rig';
import { humanProportions } from './human';
import { SH_TERMS, type LowLight, type SculptDraw, type TrailDraw } from './gl';
import type { Material } from './sdf';
import { animate, clipFor, heldIn, ONE_HAND, SWING_TOOL, toolsIn } from './anim';
import type { Side } from './anim/clip';
import { wrap } from './anim/clip';
import { slashTrail } from './anim/trail';
import { skeleton, type AnimAsset, type Held, type Skeleton } from './anim/skeleton';

type M3 = number[];
type V = [number, number, number];
type Q = [number, number, number, number];
interface Bone { name: string; p: number; kind: 'control' | 'helper'; head: V; R: M3; from?: number; drive?: 'half' | 'twist' | 'wrist' | 'untwist'; f?: number; game?: string }
interface Asset {
  floor: number; T: M3; verts: number[]; polys: Array<[number[], number, number[]?]>; tris: number[]; weights: number[][]; soles: number[];
  /** The polygons split off another for the undergarment's paint (`tools/sculpt/lowunder.mjs`): [the piece, its parent]. */
  split?: Array<[number, number]>;
  bones: Bone[]; rest: Pick<Rig, 'arm' | 'elbow' | 'hand' | 'leg' | 'knee'>;
  game: { armIn: number; thumbCurl: number; armSwing?: [number, number]; armSwingAt?: number };
}
/**
 * The 'lift' drive's settings (`tools/sculpt/lowgarment.mjs` liftOf): of the source's swing θ (degrees; with `axis`, only
 * its part about that axis of the source's own, taken `sign` as a raise) the bone turns a θ + (b - a) max(0, θ - knee), at
 * most max; `also`, a share of the swing about the other axis, either way, at most its max.
 */
export interface Lift { a: number; knee: number; b: number; max: number; axis?: 'x' | 'z' | null; sign?: number; also?: { axis: 'x' | 'z'; a: number; max: number } }
/** A garment's own bone: parent `p` and driver `from` the body's bone indices, its rest head and frame, the drive. */
interface GarmentBone extends Lift { name: string; p: number; kind: 'helper'; head: V; R: M3; from: number; drive: 'lift' }
/**
 * A garment as `tools/sculpt/lowgarment.mjs` garmentAsset writes it beside its body: vertices in the body's units and
 * axes, polygons (corners, material index into `mats`), triangles (three corners and the polygon), each vertex's (bone,
 * weight) list (the body's bones, then its own from `base` on), its materials' colours (red, green, blue nought to one).
 */
export interface GarmentAsset {
  who: string; base: number; mats: string[]; colours: Array<[number, number, number]>;
  verts: number[]; polys: Array<[number[], number]>; tris: number[]; weights: number[][]; bones: GarmentBone[];
  /** The body's polygons the garment covers whole: left out of the body while it is worn. */
  hides?: number[];
  /** The garment's vertices the body stands on while it is worn (a boot's sole), with the body's own sole. */
  soles?: number[];
  /** The body's bones its shapes' drives read (`poseIn`): spine_03, the left's upperarm, lowerarm and hand, the right's. */
  shapeBones?: number[];
  /** Its corrective shapes: each its drive and its offsets at rest on the vertices it moves (`at`; `d` three a vertex). */
  shapes?: GarmentShape[];
  /**
   * Its materials plain and enchanted, parallel to `mats` (kind 0 lit by the body's light, 1 unlit, glowing in the
   * bloom, 2 metal: lit by the light's brightness only, as the long sword's), as the long sword's: without them every
   * material is its colour, lit, in both.
   */
  plain?: Array<{ c: string; kind: number }>;
  enchanted?: Array<{ c: string; kind: number }>;
  /** The polygons from here on drawn only while it is enchanted (a halo, an inset's glow). */
  glowFrom?: number;
  /** The polygons from here on left out while its GARMENTS entry's `drops` says (the boots' knee crest under the leggings' knee guard). */
  dropFrom?: number;
}

/**
 * A prop held in the hand as `tools/sculpt/lowgear.mjs` gearAsset writes it: vertices in its own frame (game units; y from
 * the pommel's point to the point), polygons (corners, material) and triangles (three corners and the polygon), the
 * polygons from `glowFrom` on its glow (drawn only enchanted); its materials plain and enchanted (kind 0 lit, 1 unlit, 2
 * glow); its grip along y; each body's hand sockets at rest and its game units to a mesh unit.
 */
/** Where a prop sits on a body at rest: on the bone named, its grip's lead point at o, its x, y, z along R's columns (and a hand's curl closed on it). */
interface Socket { bone: string; o: V; R: M3; curl?: Record<string, [number, number, number]> }
interface PropAsset {
  id: string; length: number; verts: number[]; polys: Array<[number[], number]>; tris: number[]; glowFrom: number;
  mats: string[];
  /** Its materials' colours and kinds (0 lit, 1 unlit, 2 glow), and those drawn in its metal (`metalTint`) their role in it. */
  plain: PropMaterial[]; enchanted: PropMaterial[];
  grip: { lead: V; second: V; from?: number; to?: number };
  /**
   * Each body's sockets: the hands', and where it is carried while it is wielded and not in hand, on the back (`back`:
   * rigid on the upper back) or across the small of the back (`belt`: rigid on the pelvis; tools/sculpt/lowgear.mjs
   * beltSocketOf).
   */
  sockets: Record<'male' | 'female', Record<'l' | 'r', Socket> & { back?: Socket; belt?: Socket }>; scale: Record<'male' | 'female', number>;
  /** Its points kept off the ground (its own frame), and how far its far end is let down onto it (`Held.ends`, `Held.rest`). */
  ends?: V[]; rest?: number;
  /** Where along it (its own y) its slash trail's inner edge is (`Held.inner`): a prop that leaves one other than the long sword. */
  trail?: number;
  /** A hand tool's: the hand it is held in (the chisel the left; the right where not given). */
  hand?: 'l' | 'r';
  /** A hand tool's point that meets the work, its own frame (the chisel's: its struck top), and its reach from the fist (grip.lead). */
  contact?: V; reach?: number;
}
/**
 * A prop's material: its colour and kind, and for the stone of a head or a blade, its role in the metal it is smithed
 * from (`tools/sculpt/lowgear.mjs` metalMats): a face, or the bevel's lit edge.
 */
interface PropMaterial { c: string; kind: number; metal?: 'face' | 'edge'; wood?: boolean }
/** Where the prop drawn is (`lowBaked`): in the hand, carried on the back, or at the belt. */
type Carried = 'hand' | 'back' | 'belt';
const SWORD = LONG_SWORD as unknown as PropAsset;
/**
 * The props drawn in both hands, by the id of what is held (`heldIn`): the long sword, the maul as the Runestone
 * Warhammer, and the pickaxe (`SWING_TOOL`) as the Runestone Pickaxe; and the hand tools a clip holds in one fist, by
 * item id, each drawn in the metal and enchantment of the pose's tool (`FigurePose.tool`). One is drawn at a time, so all
 * take the same materials (`PROP_MAT`).
 */
const PROPS: readonly PropAsset[] = [SWORD, { ...(WARHAMMER as unknown as PropAsset), id: 'maul' }, { ...(PICKAXE as unknown as PropAsset), id: SWING_TOOL },
  // the hand tools by item id, each in one fist (`PropAsset.hand`), its working part in its metal (the mallet all wood)
  HAMMER as unknown as PropAsset, MALLET as unknown as PropAsset, CHISEL as unknown as PropAsset, HATCHET as unknown as PropAsset, BUTCHERING_KNIFE as unknown as PropAsset,
  // the hand tools held in one fist at the bench (tools/sculpt/gear/finetools.mjs): the awl, the carving knife, the trowel,
  // the file and the whetstone, by item id; the knife's, the trowel's and the file's blades in their metal
  AWL as unknown as PropAsset, CARVING_KNIFE as unknown as PropAsset, TROWEL as unknown as PropAsset, FILE as unknown as PropAsset, WHETSTONE as unknown as PropAsset,
  // the weapons by item id (tools/sculpt/gear/weapons.mjs): the swords, the knife, the axes, the club, the spear and the
  // javelin; the ancient short sword drawn as the short sword
  SWORD_1H as unknown as PropAsset, SHORT_SWORD as unknown as PropAsset, { ...(SHORT_SWORD as unknown as PropAsset), id: ANCIENT_SWORD }, HUNTING_KNIFE as unknown as PropAsset,
  BATTLE_AXE as unknown as PropAsset, CLUB as unknown as PropAsset, SPEAR as unknown as PropAsset, JAVELIN as unknown as PropAsset, THROWING_AXE as unknown as PropAsset,
];
const PROP_OF = new Map(PROPS.map((p) => [p.id, p]));
/**
 * The hand tools a clip draws in one hand each (`./anim` Clip.tools, `toolsIn`), by item id: the props that meet the
 * work (`PropAsset.contact`). Each laid at rest on its hand's socket and skinned wholly to that hand, its fist closed on it
 * as its socket says, drawn in the place of its hand's materials (`toolMat`).
 */
const TOOL_PROPS: readonly PropAsset[] = PROPS.filter((p) => p.contact);
const TOOL_OF = new Map(TOOL_PROPS.map((p) => [p.id, p]));
/** Whether a prop leaves a slash trail in its clip's blow (`lowTrail`): the long sword, and one that says where its trail's inner edge is. */
const trails = (p: PropAsset): boolean => p === SWORD || p.trail !== undefined;
/** The sword's points over the last quarter of its blade (its glow's left out), its own frame: what of it reaches lowest. */
const ENDS: V[] = (() => {
  const used = new Set<number>(), from = SWORD.grip.lead[1] + 0.75 * (SWORD.length - SWORD.grip.lead[1]), out: V[] = [];
  for (let t = 0; t < SWORD.tris.length; t += 4) if (SWORD.tris[t + 3] < SWORD.glowFrom) for (let k = 0; k < 3; k++) used.add(SWORD.tris[t + k]);
  for (const i of used) if (SWORD.verts[i * 3 + 1] > from) out.push([SWORD.verts[i * 3], SWORD.verts[i * 3 + 1], SWORD.verts[i * 3 + 2]]);
  return out;
})();

/** A hairstyle on one body (`tools/sculpt/lowhair.mjs` gameHair): its vertices, polygons and triangles (corners, polygon),
 * each polygon's material (4 the hair, 5 to 8 the hair in a valley by its step, 3 the buzzed sides' patches), each vertex's (bone, weight) pairs, and the body's
 * polygons drawn shaved. */
interface HairAsset { verts: number[]; polys: number[][]; mat: number[]; tris: number[]; weights: number[][]; shave: number[] }
const HAIRS = HAIR_ASSET as unknown as Record<'male' | 'female', Record<string, HairAsset>>;
/**
 * The hairstyles pressed under the leather hat (`assets/lowhat-<who>.json` hair, `tools/sculpt/garments/hat.mjs` hatHair:
 * each vertex moved toward the skull until it is inside the crown and under the brim, its topology the hairstyle's own),
 * named `<style>:hat`, drawn in the style's place while the hat is worn (`hairStyle`).
 */
const UNDER_HAT = ':hat';
const underHat = (hat: unknown): Record<string, HairAsset> => Object.fromEntries(Object.entries((hat as { hair?: Record<string, HairAsset> }).hair ?? {}).map(([k, h]) => [k + UNDER_HAT, h]));

/* ---- 3x3 rotations (row-major) and quaternions [w, x, y, z], as lowrig.mjs ------------------------------------- */
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mm = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const mv = (m: M3, v: V): V => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const tr = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const col = (m: M3, k: number): V => [m[k], m[3 + k], m[6 + k]];
function axisAngle(a: V, deg: number): M3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1, [x, y, z] = [a[0] / l, a[1] / l, a[2] / l];
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
/** A local pose from [rx, ry, rz] degrees: Rz · Rx · Ry. */
const euler = (rx: number, ry = 0, rz = 0): M3 => mm(axisAngle([0, 0, 1], rz), mm(axisAngle([1, 0, 0], rx), axisAngle([0, 1, 0], ry)));
function quat(m: M3): Q {
  const t = m[0] + m[4] + m[8];
  let q: Q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [0.25 * s, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [(m[7] - m[5]) / s, 0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[2] - m[6]) / s, (m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s]; }
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
const qmat = ([w, x, y, z]: Q): M3 => [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
const qmul = (a: Q, b: Q): Q => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qinv = (q: Q): Q => [q[0], -q[1], -q[2], -q[3]];
function qpow(q: Q, t: number): Q {
  if (q[0] < 0) q = [-q[0], -q[1], -q[2], -q[3]];
  const a = Math.acos(Math.min(1, q[0])), s = Math.sin(a);
  if (s < 1e-9) return [1, 0, 0, 0];
  const k = Math.sin(a * t) / s;
  return [Math.cos(a * t), q[1] * k, q[2] * k, q[3] * k];
}
/** The twist about the bone's own axis (local y), and the swing left: q = swing · twist. */
function swingTwist(q: Q): { swing: Q; twist: Q } {
  let t: Q = [q[0], 0, q[2], 0];
  const l = Math.hypot(t[0], t[2]);
  t = l < 1e-9 ? [1, 0, 0, 0] : [t[0] / l, 0, t[2] / l, 0];
  return { swing: qmul(q, qinv(t)), twist: t };
}
/** The twist about a unit local axis k, and the swing left: q = swing · twist (lowrig.mjs swingTwist). */
function swingTwistAbout(q: Q, k: V): { swing: Q; twist: Q } {
  const p = q[1] * k[0] + q[2] * k[1] + q[3] * k[2];
  let t: Q = [q[0], k[0] * p, k[1] * p, k[2] * p];
  const l = Math.hypot(t[0], t[1], t[2], t[3]);
  t = l < 1e-9 ? [1, 0, 0, 0] : [t[0] / l, t[1] / l, t[2] / l, t[3] / l];
  return { swing: qmul(q, qinv(t)), twist: t };
}

/**
 * A garment bone's turn from its source bone's local turn `Lsrc`, by the 'lift' rule of `tools/sculpt/lowgarment.mjs`
 * liftOf (ported as it is; `tools/sculpt/lowgarmentcheck.mjs` holds the two to the same result): the source's swing (its
 * turn less its twist about its own Y); with `axis` only the swing's part about that axis, taken `sign` as a raise and
 * nothing the other way; turned g(θ) = a θ + (b - a) max(0, θ - knee), at most max; `also` a share of the swing about the
 * other axis, either way, at most its max.
 */
export function liftOf(Lsrc: M3, d: Lift): M3 {
  const { swing } = swingTwist(quat(Lsrc)), s: Q = swing[0] < 0 ? [-swing[0], -swing[1], -swing[2], -swing[3]] : swing;
  const g = (th: number): number => Math.min(d.max, d.a * th + (d.b - d.a) * Math.max(0, th - d.knee));
  if (!d.axis) {
    const th = (2 * Math.acos(Math.min(1, s[0])) * 180) / Math.PI;
    return th < 1e-6 ? I3 : qmat(qpow(s, g(th) / th));
  }
  // (the swing's part about a local axis, degrees, signed)
  const about = (ax: 'x' | 'z'): [V, number] => {
    const k: V = ax === 'x' ? [1, 0, 0] : [0, 0, 1], { twist } = swingTwistAbout(s, k);
    return [k, (2 * Math.atan2(twist[1] * k[0] + twist[3] * k[2], twist[0]) * 180) / Math.PI];
  };
  const turn = (k: V, deg: number): Q => { const h = ((deg / 2) * Math.PI) / 180; return [Math.cos(h), k[0] * Math.sin(h), 0, k[2] * Math.sin(h)]; };
  const sign = d.sign ?? 1, [k, th0] = about(d.axis), th = sign * th0;
  let q: Q = th > 1e-6 ? turn(k, sign * g(th)) : [1, 0, 0, 0];
  // (and a share of the swing about the other axis, either way, at most also.max)
  if (d.also) { const [k2, t2] = about(d.also.axis); q = qmul(turn(k2, Math.max(-d.also.max, Math.min(d.also.max, d.also.a * t2))), q); }
  return qmat(q);
}
/**
 * A corrective shape's drive (`tools/sculpt/lowgarment.mjs` driveOf): on an arm the product of ramp(feature, a, b) over
 * `ramps` (a feature of the arm's, `poseIn`, or the body's bend); `side` 'l' or 'r' that arm, 'both' the two arms'
 * product, 'either' the greater.
 */
export interface ShapeDrive { side: 'l' | 'r' | 'both' | 'either'; ramps: Array<[string, number, number]> }
interface GarmentShape { name: string; drive: ShapeDrive; at: number[]; d: number[] }
/** 0 below a, 1 past b (b may be below a), smoothstep between: exactly 0 and 1 outside (lowgarment.mjs ramp). */
const ramp = (x: number, [a, b]: [number, number]): number => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
type Arm = { raise: number; elbowFwd: number; across: number; fwd: number; up: number };
/**
 * The pose as a corrective shape's drive reads it (`tools/sculpt/lowgarment.mjs` poseIn): each arm in the chest's frame,
 * in upper arms' lengths from the shoulder at rest, and the chest's lean forward, degrees. `bones`: spine_03, the left's
 * upperarm, lowerarm and hand, the right's; `heads` their heads at rest.
 */
export function poseIn(heads: readonly V[], chestR: M3, F: ReadonlyArray<{ W: M3; P: V }>, bones: readonly number[]): { l: Arm; r: Arm; bend: number } {
  const c = bones[0], C = mm(F[c].W, tr(chestR)), rel = (p: V): V => mv(tr(C), sub(p, F[c].P));
  const arm = (k: number, s: number): Arm => {
    const S0 = sub(heads[k], heads[0]), L = Math.hypot(...sub(heads[k + 1], heads[k])), e = rel(F[bones[k + 1]].P), hd = rel(F[bones[k + 2]].P);
    return { raise: (e[1] - S0[1]) / L, elbowFwd: (e[2] - S0[2]) / L, across: (s * hd[0]) / L, fwd: (hd[2] - S0[2]) / L, up: (hd[1] - S0[1]) / L };
  };
  return { l: arm(1, 1), r: arm(4, -1), bend: (Math.atan2(C[7], C[4]) * 180) / Math.PI };
}
/** A corrective shape's weight from the pose (`tools/sculpt/lowgarment.mjs` driveOf). */
export function driveOf(f: { l: Arm; r: Arm; bend: number }, d: ShapeDrive): number {
  const on = (s: 'l' | 'r'): number => d.ramps.reduce((w, [k, a, b]) => w * ramp(k in f[s] ? f[s][k as keyof Arm] : (f as unknown as Record<string, number>)[k], [a, b]), 1);
  return d.side === 'both' ? on('l') * on('r') : d.side === 'either' ? Math.max(on('l'), on('r')) : on(d.side);
}
/** A garment's corrective shapes' weights from the body's frames. */
export function shapeWeights(body: ReadonlyArray<{ R: M3; head: V }>, garment: Pick<GarmentAsset, 'shapes' | 'shapeBones'>, F: ReadonlyArray<{ W: M3; P: V }>): number[] {
  const sb = garment.shapeBones;
  if (!garment.shapes?.length || !sb) return [];
  const f = poseIn(sb.map((i) => body[i].head), body[sb[0]].R, F, sb);
  return garment.shapes.map(({ drive }) => driveOf(f, drive));
}
/** The garment worn whose corrective shapes a bake carries: the first worn that has any (one a bake: a shawl). */
const shapedOf = (garments: readonly GarmentAsset[], worn: readonly boolean[]): number => garments.findIndex((g, k) => worn[k] && !!g.shapes?.length);

const angleOf = (q: Q): number => (2 * Math.acos(Math.min(1, Math.abs(q[0]))) * 180) / Math.PI;

/** The low-poly woman's height, sole to crown, as a share of the low-poly man's. */
export const WOMAN_OF_MAN = 0.85;

/** A body's frames: each bone's world rotation and head, and its local turn (what a garment bone's drive reads). */
interface Frame { W: M3; P: V; L: M3 }
/**
 * The garment's own bones' frames, appended to the body's (`tools/sculpt/lowgarment.mjs` garmentFrames): each hung
 * from its body parent as at rest, turned by its drive from its source bone's local turn.
 */
export function garmentFrames(body: ReadonlyArray<{ R: M3; head: V }>, own: readonly GarmentBone[], F: readonly Frame[]): Frame[] {
  return own.map((b) => {
    const pb = body[b.p], pa = F[b.p];
    const Rrel = mm(tr(pb.R), b.R), off = mv(tr(pb.R), sub(b.head, pb.head));
    const L = b.drive === 'lift' ? liftOf(F[b.from].L, b) : I3;
    return { W: mm(pa.W, mm(Rrel, L)), P: add(pa.P, mv(pa.W, off)), L };
  });
}

/** Colour channels nought to one as a hex colour. */
const hexOf = (c: readonly number[]): string => `#${c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
/** Where the garments' materials start among a low-poly body's: after the body's own (`bodyMaterials`, indexed by `M`). */
const GARMENT_MAT = Object.keys(M).length;
/**
 * The garments' materials, each once (garments of one outfit share theirs): a colour, lit (kind 0) or unlit (kind 1); a
 * garment's material is its index here, plain or enchanted.
 */
const GARMENT_COLOURS: Array<{ c: string; kind: number; piece?: Tinted; role?: PlateRole }> = [];
/** What tints a garment's material: a plate piece's metal, or a dyed piece's dye (`dye:<piece>`). */
type Tinted = PlatePiece | `dye:${DyedPiece}`;
const colourIndex = (m: { c: string; kind: number }, piece?: Tinted, role?: PlateRole): number => {
  const k = GARMENT_COLOURS.findIndex((x) => x.c === m.c && x.kind === m.kind && x.piece === piece && x.role === role);
  return k >= 0 ? k : GARMENT_COLOURS.push({ c: m.c, kind: m.kind, piece, role }) - 1;
};
/**
 * A plate piece's plates (`mats` 'plate', the face) and their shadow side ('shade'), and a chain piece's mail (its rings'
 * upper slopes and lower): each piece's its own materials, so each is drawn in the metal it is smithed from (`plateMat`).
 * Its gold, under layer, leather, cores and runes keep their colours.
 */
type PlateRole = 'face' | 'shade';
const PLATE_ROLE: Readonly<Record<string, PlateRole>> = { plate: 'face', shade: 'shade', scale: 'face', edge: 'shade' };
/** A dyed piece's materials the dye takes: its fabric or leather (the face) and their lighter and darker parts (as shade: as much lighter or darker than the dye). */
const DYE_ROLE: Readonly<Record<string, PlateRole>> = { fabric: 'face', pattern: 'shade', leather: 'face', dark: 'shade', light: 'shade', tan: 'shade' };
/** A garment's materials in a look: its own plain or enchanted, else its colours, lit. */
const looksOf = (g: GarmentAsset, look: 'plain' | 'enchanted'): Array<{ c: string; kind: number }> => (look === 'enchanted' ? g.enchanted : undefined) ?? g.plain ?? g.colours.map((c) => ({ c: hexOf(c), kind: 0 }));
/**
 * Where the prop drawn takes its materials (`PROPS`: the sword's place, whichever it is): straight after the body's. Its
 * plain and its enchanted materials take the same places (`materialsOf` lays in the one it is drawn with).
 */
const PROP_MAT = (): number => GARMENT_MAT;
/**
 * The most materials a prop drawn takes: the prop's place (`PROP_MAT`) holds the one gripped in both hands or carried on
 * the back, and each hand's tool (`TOOL_PROPS`, one in a hand at a time) has a place of this many after it.
 */
const PROP_SLOTS = 20;
/** Where the tool in a hand takes its materials: the right's place after the prop's, the left's after that. */
const toolMat = (side: Side): number => PROP_MAT() + PROP_SLOTS * (side === 'r' ? 1 : 2);
/**
 * Where the worn garments' materials start, after the left hand's tool's: each bake takes only the materials of the
 * garments it has on (`usedOf`, each once, in the order they are laid), so the draw keeps within the renderer's
 * materials (`./gl.ts` MAX_MATS) however many garments the bodies can wear.
 */
const WORN_MAT = PROP_MAT() + PROP_SLOTS * 3;
/** Each bake's garments' materials: their places among all the garments' (`GARMENT_COLOURS`), in the bake's order. */
const USED = new WeakMap<Baked, readonly number[]>();

/**
 * One body: its asset, the figure's proportions it is posed with, its height as a share of the base man's, and the
 * garments it can wear (their own bones posed with the body's always, each garment's after the one before; each drawn
 * when the bake is asked for with it worn), and its hairstyles.
 */
function lowBody(A: Asset, P: Proportions, share: number, garments: readonly GarmentAsset[], hairs: Record<string, HairAsset>, tints: ReadonlyArray<Tinted | undefined>): { baked: (worn: readonly boolean[], sword?: Carried, style?: string, lit?: readonly boolean[], drop?: readonly boolean[], prop?: string, tools?: Partial<Record<Side, string>>, up?: Partial<Record<Side, number>>) => Baked; bones: (pose: FigurePose, worn?: readonly boolean[], over?: Record<string, [number, number, number]>) => Float32Array; shapes: () => number[]; trail: (pose: FigurePose, lit: boolean) => TrailDraw | undefined; skeleton: Skeleton; held: Held; heldOf: (id: string) => Held | undefined; toolHeld: (id: string) => Held | undefined; figure: (pose: FigurePose) => Array<M3 | undefined>; used: (worn: readonly boolean[], lit?: readonly boolean[]) => number[] } {
  const BONES = A.bones;
  const AT = new Map(BONES.map((b, i) => [b.name, i]));
  for (const g of garments) if (g.base !== BONES.length) throw new Error(`garment for ${g.base} bones on a body of ${BONES.length}`);
  /** The body's bones and the garments' own, in the order the weights index them; where each garment's own begin. */
  const ALL = [...BONES, ...garments.flatMap((g) => g.bones)];
  const OWN = garments.map((_, k) => BONES.length + garments.slice(0, k).reduce((n, g) => n + g.bones.length, 0));
  /** A garment's weights with its own bones moved to where they sit among all. */
  const WEIGHTS = garments.map((g, k) => g.weights.map((w) => w.map((x, j) => (j % 2 === 0 && x >= g.base ? x - g.base + OWN[k] : x))));
  /** Each garment's materials, plain and enchanted: their indices among the garments'. */
  const indexOf = (look: 'plain' | 'enchanted') => garments.map((g, k) => looksOf(g, look).map((m, i) => {
    const t = tints[k], role = !t ? undefined : t.startsWith('dye:') ? DYE_ROLE[g.mats[i]] : PLATE_ROLE[g.mats[i]];
    return colourIndex(m, role && t, role);
  }));
  const MATS_OF = { plain: indexOf('plain'), enchanted: indexOf('enchanted') };
  /** The garments' materials a bake takes (their places among all the garments'), each once, in the order they are laid. */
  const usedOf = (worn: readonly boolean[], lit: readonly boolean[] = []): number[] => [...new Set(garments.flatMap((_, k) => (worn[k] ? MATS_OF[lit[k] ? 'enchanted' : 'plain'][k] : [])))];

  /**
   * Where the other fist closes on a prop's grip on this body: where the grip says, or further down it by as much as keeps
   * the two fists from overlapping (the fist's width along the grip, from the right hand's vertices, and a tenth more).
   */
  function secondOn(prop: PropAsset, who: 'male' | 'female'): number {
    const so = prop.sockets[who].r, y: V = [so.R[1], so.R[4], so.R[7]], hand = new Set(['hand_r', 'knuckles_r', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'fingers_01_r', 'fingers_02_r', 'fingers_mid_r'].map((n) => AT.get(n)).filter((i) => i !== undefined));
    let lo = Infinity, hi = -Infinity;
    A.weights.forEach((w, i) => {
      let b = -1, top = 0;
      for (let j = 0; j < w.length; j += 2) if (w[j + 1] > top) { top = w[j + 1]; b = w[j]; }
      if (!hand.has(b)) return;
      const d = dot([A.verts[i * 3] - so.o[0], A.verts[i * 3 + 1] - so.o[1], A.verts[i * 3 + 2] - so.o[2]], y);
      lo = Math.min(lo, d); hi = Math.max(hi, d);
    });
    const width = hi > lo ? (hi - lo) * prop.scale[who] * 1.1 : 0;
    return Math.max(prop.grip.from ?? 0, Math.min(prop.grip.second[1], prop.grip.lead[1] - width));
  }

  /* ---- the rig's rest, done once ----------------------------------------------------------------------------------- */
  const REL = BONES.map((b) => (b.p >= 0 ? mm(tr(BONES[b.p].R), b.R) : b.R));
  const OFF = BONES.map((b) => (b.p >= 0 ? mv(tr(BONES[b.p].R), sub(b.head, BONES[b.p].head)) : b.head));
  const T = A.T;
  /** The body as the clip player sees it, the clips authored in the man's bone frames, its height the game's. */
  const SK = skeleton(A as unknown as AnimAsset, MALE_ASSET as unknown as AnimAsset, heightOf(humanProportions(0)) * share);
  /** The sword as this body holds it: its sockets, its grip and its point along it, its scale. */
  const WHO = (A as unknown as { who?: string }).who === 'female' ? 'female' : 'male';
  const HELD: Held = { sockets: SWORD.sockets[WHO], lead: SWORD.grip.lead[1], second: secondOn(SWORD, WHO), tip: SWORD.length, ends: ENDS, scale: SWORD.scale[WHO] };
  /** Each prop as this body holds it (the sword's above), by the weapon's id. */
  /** Each hand tool as this body holds it (its sockets, its scale, where it meets the work), by id. */
  const TOOL_HELD = new Map<string, Held>(TOOL_PROPS.map((p) => [p.id, { sockets: p.sockets[WHO], lead: p.grip.lead[1], second: p.grip.lead[1], tip: p.length, scale: p.scale[WHO], contact: p.contact, ...(p.trail !== undefined ? { inner: p.trail } : {}) }]));
  const HELDS = new Map<string, Held>(PROPS.map((p) => [p.id, p === SWORD ? HELD : { sockets: p.sockets[WHO], lead: p.grip.lead[1], second: secondOn(p, WHO), tip: p.length, ends: p.ends, rest: p.rest, scale: p.scale[WHO], ...(p.trail !== undefined ? { inner: p.trail } : {}) }]));

  /** Each bone's world rotation and head for a local pose (bone index -> 3x3), the helpers driven, as lowrig.mjs posed(). */
  function posed(local: Array<M3 | undefined>, move: V = [0, 0, 0]): Frame[] {
    const out: Frame[] = [];
    BONES.forEach((b, i) => {
      let L = local[i] ?? I3;
      if (b.kind === 'helper' && b.from !== undefined && local[b.from]) {
        const q = quat(local[b.from] as M3), f = b.f ?? 0.5;
        if (b.drive === 'half') L = qmat(qpow(q, f));
        else if (b.drive === 'untwist') L = qmat(qpow(swingTwist(q).twist, -f));
        else if (b.drive === 'wrist') { const { swing, twist } = swingTwist(q); L = qmat(qmul(qpow(swing, f), twist)); }
        else if (b.drive === 'twist') { const tw = qmat(qpow(swingTwist(q).twist, f)), Rr = mm(tr(b.R), BONES[b.from].R); L = mm(Rr, mm(tw, tr(Rr))); }
      }
      if (b.p < 0) { out.push({ W: mm(b.R, L), P: add(b.head, move), L }); return; }
      const pa = out[b.p];
      out.push({ W: mm(pa.W, mm(REL[i], L)), P: add(pa.P, mv(pa.W, OFF[i])), L });
    });
    return out;
  }

  /** Our local pose from the figure's bones posed and at the fitted rest, as lowrig.mjs fromGame(). */
  function fromGame(gPosed: Bones, gRest: Bones): Array<M3 | undefined> {
    const D = (g: string): M3 => mm(tr(T), mm(mm(gPosed[g].m, tr(gRest[g].m)), T));
    const half = (a: M3, b: M3): M3 => mm(a, qmat(qpow(quat(mm(tr(a), b)), 0.5)));
    const Wd: Array<M3 | undefined> = [];
    BONES.forEach((b, i) => {
      if (b.kind !== 'control' || !b.game) return;
      let d: M3;
      if (b.game === 'neck+head/2') d = half(D('neck'), D('head'));
      else if (b.game.endsWith('/2')) { const g = b.game.slice(0, -2); d = half(D(g.replace('fing', 'wrist')), D(g)); }
      else d = D(b.game);
      Wd[i] = mm(d, b.R);
    });
    // the arms kept off the body: turned out, with all below, until they lean in no further than at rest, seen from the chest
    const chest = D('chest');
    const below = (i: number): number[] => { const o = [i]; for (let k = 0; k < o.length; k++) BONES.forEach((c, j) => { if (c.p === o[k] && c.kind === 'control') o.push(j); }); return o; };
    for (const s of ['l', 'r']) for (const seg of ['upperarm', 'lowerarm']) {
      const i = AT.get(`${seg}_${s}`) as number, b = BONES[i], w = Wd[i];
      if (!w) continue;
      const r0 = col(b.R, 1), side = Math.sign(r0[0]), v = mv(tr(chest), col(w, 1));
      // (hers further out as it swings forward or back, as lowrig.mjs swingOut)
      const sw = A.game.armSwing ? A.game.armSwing[v[2] > 0 ? 0 : 1] * Math.min(1, Math.abs(v[2]) / (A.game.armSwingAt ?? 0.5)) : 0;
      const xmin = Math.min(0.95, Math.abs(r0[0]) * A.game.armIn + sw);
      if (side * v[0] >= xmin) continue;
      const k = Math.sqrt((1 - xmin * xmin) / Math.max(1e-9, v[1] * v[1] + v[2] * v[2]));
      const ax = cross(v, [side * xmin, v[1] * k, v[2] * k]), ang = (Math.asin(Math.min(1, Math.hypot(ax[0], ax[1], ax[2]))) * 180) / Math.PI;
      if (ang < 1e-6) continue;
      const C = mm(chest, mm(axisAngle(ax, ang), tr(chest)));
      for (const j of below(i)) if (Wd[j]) Wd[j] = mm(C, Wd[j] as M3);
    }
    // locals, parents first
    const W: M3[] = [], pose: Array<M3 | undefined> = [];
    BONES.forEach((b, i) => {
      if (b.kind !== 'control') return;
      const base = b.p >= 0 && W[b.p] ? mm(W[b.p], REL[i]) : b.R;
      const want = Wd[i] ?? base;
      pose[i] = mm(tr(base), want);
      W[i] = want;
    });
    // the ankles and the balls of the feet as hinges about their own bend axes; the balls only bend up
    for (const [s, k] of [['l', 0], ['r', 1]] as const) {
      for (const [bone, g, up] of [[`foot_${s}`, `ankle${k}`, `knee${k}`], [`ball_${s}`, `toe${k}`, `ankle${k}`]]) {
        if (!gPosed[g] || !gPosed[up]) continue;
        const i = AT.get(bone) as number, b = BONES[i];
        const q = quat(mm(D(g), tr(D(up)))), a = angleOf(q), sg = Math.sign(q[0] || 1);
        const pw = Wd[b.p];
        const X = mv(pw ? mm(pw, tr(BONES[b.p].R)) : I3, col(b.R, 0));
        pose[i] = euler((bone.startsWith('ball') ? 1 : Math.sign(dot([q[1] * sg, q[2] * sg, q[3] * sg], X))) * a);
      }
    }
    // the thumbs: closed toward the palm by the figure thumb's angle from its hand
    for (const [s, k] of [['l', 0], ['r', 1]] as const) {
      if (!gPosed[`thumb${k}`]) continue;
      const a = angleOf(quat(mm(tr(D(`wrist${k}`)), D(`thumb${k}`))));
      pose[AT.get(`thumb_01_${s}`) as number] = euler(a);
      pose[AT.get(`thumb_02_${s}`) as number] = euler(a * A.game.thumbCurl);
      pose[AT.get(`thumb_03_${s}`) as number] = euler(a * A.game.thumbCurl);
    }
    return pose;
  }

  /* ---- the body as the GPU draws it ----------------------------------------------------------------------------------- */
  const FLOOR: V = [0, A.floor, 0];
  /** Mesh units to the figure's: the body's height, sole to crown, `share` of the base man's. */
  let SCALE = 0;
  function scale(): number {
    if (!SCALE) {
      let top = -Infinity;
      for (let i = 1; i < A.verts.length; i += 3) top = Math.max(top, A.verts[i]);
      SCALE = (heightOf(humanProportions(0)) * share) / (top - A.floor);
    }
    return SCALE;
  }
  /** A mesh point in the figure's frame: x the body's right, y forward, z up, the floor at z 0. */
  const toGame = (p: V): V => { const s = scale(), q = mv(T, sub(p, FLOOR)); return [q[0] * s, q[1] * s, q[2] * s]; };

  const BAKED = new Map<string, Baked>();
  /**
   * The body with the hairstyle's hair if it has one, and the garments worn over it, laid out for the GPU in one bake:
   * every polygon its own corners, each with the polygon's normal, so it is drawn flat; the body's polygons a worn
   * garment covers whole left out, each garment plain or enchanted (`lit`: its enchanted materials, and its polygons from
   * `glowFrom` on). The hair's vertices follow the body's; its polygons take the hair's material
   * (`M.hairCut`, three tones; in a valley `M.hairValley` to `M.hairValley4`, its valley's step), the body's shaved
   * polygons the scalp's (`M.hairUnder`).
   */
  function lowBaked(worn: readonly boolean[], sword?: Carried, style = '', lit: readonly boolean[] = [], drop: readonly boolean[] = [], prop = SWORD.id, tools: Partial<Record<Side, string>> = {}, up: Partial<Record<Side, number>> = {}): Baked {
    const hair = hairs[style];
    const key = `${garments.map((_, k) => (worn[k] ? (lit[k] ? 2 : 1) + (drop[k] ? 2 : 0) : 0)).join('')}|${sword ? `${sword}:${prop}` : ''}|${hair ? style : ''}|${tools.l ?? ''}:${tools.r ?? ''}:${up.l ?? 0}:${up.r ?? 0}`, had = BAKED.get(key);
    if (had) return had;
    const t0 = performance.now();
    const verts: number[] = [], tris: number[] = [], faceSkin: number[] = [];
    /** One mesh's polygons added: its vertices (the body's units), polygons (corners, the outline whose normal shades them), triangles and weights, and each polygon's material index. */
    const lay = (V3s: number[], polys: Array<[number[], number, number[]?]>, T3: number[], weights: number[][], matOf: (pi: number) => number, hidden: ReadonlySet<number> | null = null, corner0?: (i: number, pi: number) => void): void => {
      const at = (i: number): V => [V3s[i * 3], V3s[i * 3 + 1], V3s[i * 3 + 2]];
      const corner = new Map<number, number>();
      // Each polygon's weights, its corners' summed, the heaviest four kept: one turn for the face's normal at every corner.
      const faceWeights = polys.map(([v]) => {
        const sum = new Map<number, number>();
        for (const i of v) { const w = weights[i]; for (let j = 0; j < w.length; j += 2) sum.set(w[j], (sum.get(w[j]) ?? 0) + w[j + 1]); }
        const top = [...sum].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((t, [, w]) => t + w, 0) || 1;
        const out = [0, 0, 0, 0, 0, 0, 0, 0];
        top.forEach(([b, w], j) => { out[j] = b; out[4 + j] = w / tot; });
        return out;
      });
      const normals = polys.map(([v, , nv]) => {
        const pts = (nv ?? v).map((i) => toGame(at(i)));
        let n: V = [0, 0, 0];
        for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        return [n[0] / l, n[1] / l, n[2] / l] as V;
      });
      const idx = (i: number, pi: number): number => {
        const key = pi * 65536 + i;
        let k = corner.get(key);
        if (k !== undefined) return k;
        k = verts.length / STRIDE;
        corner.set(key, k);
        const p = toGame(at(i)), n = normals[pi], mat = matOf(pi), w = weights[i];
        const bi = [0, 0, 0, 0], bw = [0, 0, 0, 0];
        for (let j = 0; j < 4 && j * 2 < w.length; j++) { bi[j] = w[j * 2]; bw[j] = w[j * 2 + 1]; }
        verts.push(p[0], p[1], p[2], n[0], n[1], n[2], mat, ...bi, ...bw, mat, -1);
        faceSkin.push(...faceWeights[pi]);
        corner0?.(i, pi);
        return k;
      };
      for (let t = 0; t < T3.length; t += 4) { const pi = T3[t + 3]; if (hidden?.has(pi)) continue; tris.push(idx(T3[t], pi), idx(T3[t + 1], pi), idx(T3[t + 2], pi)); }
    };
    // the body and the hair as one mesh: its vertices, polygons ([corners, material, outline]), weights and triangles
    // (9: the undergarment painted on the body, tools/sculpt/lowunder.mjs)
    const MATS = [M.skin, M.hair, M.pupil, M.hairUnder, M.hairCut, M.hairValley, M.hairValley2, M.hairValley3, M.hairValley4, M.under];
    const nBody = A.verts.length / 3, nPolys = A.polys.length, shaved = new Set(hair ? hair.shave : []);
    const allPolys: Array<[number[], number, number[]?]> = A.polys.map(([v, m, nv], pi) => [v, shaved.has(pi) ? 3 : m, nv]);
    if (hair) hair.polys.forEach((v, j) => allPolys.push([v.map((i) => i + nBody), hair.mat[j]]));
    const allVerts = hair ? A.verts.concat(hair.verts) : A.verts, allWeights = hair ? A.weights.concat(hair.weights) : A.weights;
    const allTris = hair ? A.tris.concat(hair.tris.map((x, k) => (k % 4 === 3 ? x + nPolys : x + nBody))) : A.tris;
    const hidden = new Set(garments.flatMap((g, k) => (worn[k] ? g.hides ?? [] : [])));
    // (a piece split off a polygon a garment hides is hidden with it)
    for (const [piece, parent] of A.split ?? []) if (hidden.has(parent)) hidden.add(piece);
    lay(allVerts, allPolys, allTris, allWeights, (pi) => MATS[allPolys[pi][1]] ?? M.skin, hidden);
    const shaped = shapedOf(garments, worn), used = usedOf(worn, lit), slot = new Map(used.map((m, j) => [m, WORN_MAT + j]));
    let shapes: Baked['shapes'];
    garments.forEach((g, k) => {
      if (!worn[k]) return;
      // (plain: its glow's polygons left out)
      // (and its polygons from dropFrom on left out while its entry drops them)
      const end = Math.min(lit[k] || g.glowFrom === undefined ? Infinity : g.glowFrom, drop[k] && g.dropFrom !== undefined ? g.dropFrom : Infinity);
      const mats = MATS_OF[lit[k] ? 'enchanted' : 'plain'][k], T3 = end === Infinity ? g.tris : g.tris.filter((_, t) => g.tris[t - (t % 4) + 3] < end);
      // (the shaped one's corrective shapes at each of its corners: the offset, the figure's units and axes, and its
      // polygon's normal's)
      const SH = k === shaped ? g.shapes ?? [] : [];
      if (!SH.length) { lay(g.verts, g.polys, T3, WEIGHTS[k], (pi) => slot.get(mats[g.polys[pi][1]]) as number); return; }
      const from = verts.length / STRIDE, data: number[] = [];
      const gv = (i: number): V => [g.verts[i * 3], g.verts[i * 3 + 1], g.verts[i * 3 + 2]];
      const normalOf = (v: number[], off: (i: number) => V): V => {
        const pts = v.map((i) => toGame(add(gv(i), off(i))));
        let n: V = [0, 0, 0];
        for (let q = 0; q < pts.length; q++) { const a = pts[q], b = pts[(q + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        return [n[0] / l, n[1] / l, n[2] / l];
      };
      const full = SH.map((sh) => { const o = new Float64Array(g.verts.length); sh.at.forEach((i, q) => { o[i * 3] = sh.d[q * 3]; o[i * 3 + 1] = sh.d[q * 3 + 1]; o[i * 3 + 2] = sh.d[q * 3 + 2]; }); return o; });
      const N0 = g.polys.map(([v]) => normalOf(v, () => [0, 0, 0]));
      const NS = full.map((o) => g.polys.map(([v]) => normalOf(v, (i) => [o[i * 3], o[i * 3 + 1], o[i * 3 + 2]])));
      const sc = scale();
      lay(g.verts, g.polys, T3, WEIGHTS[k], (pi) => slot.get(mats[g.polys[pi][1]]) as number, null, (i, pi) => {
        full.forEach((o, q) => {
          const d = mv(T, [o[i * 3], o[i * 3 + 1], o[i * 3 + 2]]), n = sub(NS[q][pi], N0[pi]);
          data.push(d[0] * sc, d[1] * sc, d[2] * sc, 0, n[0], n[1], n[2], 0);
        });
      });
      shapes = { from, count: verts.length / STRIDE - from, shapes: SH.length, data: Float32Array.from(data) };
    });
    const PR = PROP_OF.get(prop);
    if (sword && PR) {
      // laid at rest on the right hand's socket, all of it on that hand, or on the back's or the belt's, all of it on the
      // upper back or the pelvis; its glow's polygons left out
      const so = (sword === 'back' || sword === 'belt' ? PR.sockets[WHO][sword] : undefined) ?? PR.sockets[WHO][PR.hand ?? 'r'], hand = AT.get(so.bone) as number, k = 1 / PR.scale[WHO], g = PR.grip.lead, V3s: number[] = [];
      for (let i = 0; i < PR.verts.length; i += 3) V3s.push(...add(so.o, mv(so.R, [(PR.verts[i] - g[0]) * k, (PR.verts[i + 1] - g[1]) * k, (PR.verts[i + 2] - g[2]) * k])));
      const T3: number[] = [];
      for (let t = 0; t < PR.tris.length; t += 4) if (PR.tris[t + 3] < PR.glowFrom) T3.push(PR.tris[t], PR.tris[t + 1], PR.tris[t + 2], PR.tris[t + 3]);
      const off = PROP_MAT();
      lay(V3s, PR.polys, T3, Array.from({ length: V3s.length / 3 }, () => [hand, 1]), (pi) => off + PR.polys[pi][1]);
    }
    // each hand's tool laid at rest on its hand's socket, its grip at the fist as far further up its handle as the body
    // holds it (`up`), all of it on that hand
    for (const [side, id] of Object.entries(tools) as Array<[Side, string | undefined]>) {
      const TP = id ? TOOL_OF.get(id) : undefined;
      if (!TP) continue;
      const so = TP.sockets[WHO][side], hand = AT.get(so.bone) as number, k = 1 / TP.scale[WHO], g: V = [TP.grip.lead[0], TP.grip.lead[1] + (up[side] ?? 0), TP.grip.lead[2]], V3s: number[] = [];
      for (let i = 0; i < TP.verts.length; i += 3) V3s.push(...add(so.o, mv(so.R, [(TP.verts[i] - g[0]) * k, (TP.verts[i + 1] - g[1]) * k, (TP.verts[i + 2] - g[2]) * k])));
      const T3: number[] = [];
      for (let t = 0; t < TP.tris.length; t += 4) if (TP.tris[t + 3] < (TP.glowFrom < 0 ? Infinity : TP.glowFrom)) T3.push(TP.tris[t], TP.tris[t + 1], TP.tris[t + 2], TP.tris[t + 3]);
      const off = toolMat(side);
      lay(V3s, TP.polys, T3, Array.from({ length: V3s.length / 3 }, () => [hand, 1]), (pi) => off + TP.polys[pi][1]);
    }
    const baked: Baked = { band: 1, verts: Float32Array.from(verts), tris: Uint32Array.from(tris), nVerts: verts.length / STRIDE, nTris: tris.length / 3, bones: ALL.map((b) => b.name), ms: performance.now() - t0, grid: [0, 0, 0], cell: 0, faceSkin: Float32Array.from(faceSkin) };
    if (shapes) baked.shapes = shapes;
    USED.set(baked, used);
    BAKED.set(key, baked);
    return baked;
  }

  let G_REST: Bones | null = null;
  /** The figure's bones at the rest fitted to the body's (lowrig.mjs fitRest), for the turns the figure's bones make from it. */
  function gameRest(): Bones {
    if (!G_REST) {
      const r = { ...sculptRig({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look: DEFAULT_LOOK }).rest, ...structuredClone(A.rest) } as Rig;
      G_REST = bonesOf(r, P, [], REST_EXTRAS);
    }
    return G_REST;
  }

  /** The figure's rig for a pose: stood doing nothing, the sculpt's own idle (as `sculptScene`); otherwise the figure's. */
  function rigFor(pose: FigurePose): Rig {
    const figure = sculptRig(pose).rig;
    const idle = !pose.moving && !pose.working && !pose.swimming && !pose.driving && !pose.emote && !pose.cast;
    return idle ? relaxedIdle(figure, pose.phase / 6, pose.facing) : figure;
  }

  /** How far the last pose drawn (`lowBones`) was lifted to stand on its lowest sole, mesh units. */
  let DY = 0;
  /**
   * The slash trail of the prop in hand at the pose's moment of its clip (`./anim/trail.ts`), as drawn: in the figure's
   * frame, stood as the body last drawn (`lowBones`) was; none out of the blow, and none for a prop that leaves none
   * (`trails`).
   */
  function lowTrail(pose: FigurePose, lit: boolean): TrailDraw | undefined {
    const c = clipFor(pose, SK.body), id = heldIn(pose), prop = id === undefined ? undefined : PROP_OF.get(id), held = id === undefined ? undefined : HELDS.get(id);
    // (or the weapon in the striking fist of the one-handed fight, `ONE_HAND`)
    const side = c?.clip.strike?.side ?? 'r', one = c && !c.clip.grip && ONE_HAND(pose) ? toolsIn(pose, SK.body)?.tools[side] : undefined, tool = one ? TOOL_OF.get(one) : undefined, toolHeld = one ? TOOL_HELD.get(one) : undefined;
    const pts = c?.clip.grip && prop && held && trails(prop) ? slashTrail(SK, c.clip, wrap(c.clip, c.t), held)
      : c && tool && toolHeld && tool.trail !== undefined ? slashTrail(SK, c.clip, wrap(c.clip, c.t), toolHeld, side) : undefined;
    if (!pts) return undefined;
    const strip = new Float32Array(pts.length * 10), up: V = [0, DY, 0];
    pts.forEach((q, k) => strip.set([...toGame(add(q.inner, up)), q.a, 0, ...toGame(add(q.tip, up)), q.a, 1], k * 10));
    return { strip, n: pts.length * 2, lit };
  }

  /** The skinning matrices for a pose (3x4 rows per bone, the figure's frame), the body stood on its lowest sole (or a worn garment's). */
  /** The worn garment's corrective shapes' weights in the last pose bound (`lowBones`). */
  let SHAPES_W: number[] = [];
  function lowBones(pose: FigurePose, worn: readonly boolean[] = [], over?: Record<string, [number, number, number]>): Float32Array {
    // a clip where the state has one (./anim), else the figure's pose on the rig; the bones in `over` turned as it says
    // (local [rx, ry, rz] degrees: the authoring tools' still holds, `lowHoldScene`)
    const id = heldIn(pose), { local: drawn, move } = animate(SK, pose, () => fromGame(bonesOf(rigFor(pose), P, [], REST_EXTRAS), gameRest()), id === undefined ? undefined : HELDS.get(id), (tool) => TOOL_HELD.get(tool));
    const local = over ? [...drawn] : drawn;
    if (over) for (const [b, e] of Object.entries(over)) { const i = AT.get(b); if (i !== undefined) local[i] = euler(e[0], e[1], e[2]); }
    const Fb = posed(local, move), F = [...Fb, ...garments.flatMap((g) => garmentFrames(BONES, g.bones, Fb))];
    // each bone's skinning turn and shift in the mesh's frame: v -> S v + t
    const S = F.map((f, i) => mm(f.W, tr(ALL[i].R)));
    const t = F.map((f, i) => sub(f.P, mv(S[i], ALL[i].head)));
    // stood on the lowest sole: the sole's vertices skinned
    let low = Infinity;
    const stand = (V3s: number[], W: number[][], soles: readonly number[]): void => {
      for (const vi of soles) {
        const v: V = [V3s[vi * 3], V3s[vi * 3 + 1], V3s[vi * 3 + 2]], w = W[vi];
        let y = 0;
        for (let j = 0; j < w.length; j += 2) { const b = w[j]; y += w[j + 1] * (dot([S[b][3], S[b][4], S[b][5]], v) + t[b][1]); }
        low = Math.min(low, y);
      }
    };
    stand(A.verts, A.weights, A.soles);
    garments.forEach((g, k) => { if (worn[k] && g.soles) stand(g.verts, WEIGHTS[k], g.soles); });
    const dy = A.floor - low, s = scale();
    DY = dy;
    const sk = shapedOf(garments, worn);
    SHAPES_W = sk < 0 ? [] : shapeWeights(BONES, garments[sk], Fb);
    const out = new Float32Array(ALL.length * 12);
    ALL.forEach((_, i) => {
      const Ag = mm(T, mm(S[i], T));
      const sh = mv(T, add(sub(add(mv(S[i], FLOOR), t[i]), FLOOR), [0, dy, 0]));
      out.set([Ag[0], Ag[1], Ag[2], sh[0] * s, Ag[3], Ag[4], Ag[5], sh[1] * s, Ag[6], Ag[7], Ag[8], sh[2] * s], i * 12);
    });
    return out;
  }

  return { baked: lowBaked, bones: lowBones, shapes: () => SHAPES_W, trail: lowTrail, skeleton: SK, held: HELD, heldOf: (id) => HELDS.get(id), toolHeld: (id) => TOOL_HELD.get(id), figure: (pose) => fromGame(bonesOf(rigFor(pose), P, [], REST_EXTRAS), gameRest()), used: usedOf };
}

type OutfitKey = 'hood' | 'tunic' | 'trousers' | 'boots' | 'plateChest' | 'plateLegs' | 'plateBoots' | 'plateHelm' | 'leatherChest' | 'leatherLegs' | 'leatherBoots' | 'leatherHat' | ChainPiece | 'scaleHelm' | 'scaleChest' | 'scaleLegs' | 'scaleBoots';
type EnchantKey = keyof NonNullable<NonNullable<FigurePose['outfit']>['enchanted']>;
/**
 * The sculpted piece each worn item is drawn as (`outfitOf`): its wear switch, its enchantment's, and for plate and chain
 * the piece whose metal it is. A set's chest and arms are one garment, worn for either item.
 */
const ITEM_PIECES: Readonly<Record<string, { key: OutfitKey; ench: EnchantKey; plate?: PlatePiece }>> = {
  wool_cap: { key: 'hood', ench: 'clothHood' },
  cloth_tunic: { key: 'tunic', ench: 'clothTunic' },
  cloth_sleeves: { key: 'tunic', ench: 'clothTunic' },
  cloth_trousers: { key: 'trousers', ench: 'clothTrousers' },
  cloth_shoes: { key: 'boots', ench: 'clothBoots' },
  leather_cap: { key: 'leatherHat', ench: 'leatherHat' },
  leather_jerkin: { key: 'leatherChest', ench: 'leatherChest' },
  leather_sleeves: { key: 'leatherChest', ench: 'leatherChest' },
  leather_trousers: { key: 'leatherLegs', ench: 'leatherLegs' },
  leather_boots: { key: 'leatherBoots', ench: 'leatherBoots' },
  helm: { key: 'plateHelm', ench: 'helm', plate: 'helm' },
  ancient_helm: { key: 'plateHelm', ench: 'helm', plate: 'helm' },
  plate_breastplate: { key: 'plateChest', ench: 'chest', plate: 'chest' },
  plate_arms: { key: 'plateChest', ench: 'chest', plate: 'chest' },
  plate_legs: { key: 'plateLegs', ench: 'legs', plate: 'legs' },
  plate_boots: { key: 'plateBoots', ench: 'boots', plate: 'boots' },
  chain_coif: { key: 'chainCoif', ench: 'chainCoif', plate: 'chainCoif' },
  chain_hauberk: { key: 'chainChest', ench: 'chainChest', plate: 'chainChest' },
  chain_sleeves: { key: 'chainChest', ench: 'chainChest', plate: 'chainChest' },
  chain_leggings: { key: 'chainLegs', ench: 'chainLegs', plate: 'chainLegs' },
  chain_boots: { key: 'chainBoots', ench: 'chainBoots', plate: 'chainBoots' },
  // the scale set: all its pieces in one material (`scale`: dragon scale, which none of them names)
  scale_helm: { key: 'scaleHelm', ench: 'scaleHelm', plate: 'scale' },
  scale_cuirass: { key: 'scaleChest', ench: 'scaleChest', plate: 'scale' },
  scale_sleeves: { key: 'scaleChest', ench: 'scaleChest', plate: 'scale' },
  scale_leggings: { key: 'scaleLegs', ench: 'scaleLegs', plate: 'scale' },
  scale_boots: { key: 'scaleBoots', ench: 'scaleBoots', plate: 'scale' },
};
/**
 * What a figure has equipped (`FigurePose.gear`) as its outfit: each worn piece's sculpted garment, enchanted when it is,
 * plate in its metal (the breastplate's over the arms'). The first outfit's pieces stay under what does not replace them.
 */
export function outfitOf(gear: FigurePose['gear']): NonNullable<FigurePose['outfit']> {
  const dye: Partial<Record<DyedPiece, string>> = {};
  const out: NonNullable<FigurePose['outfit']> = {}, enchanted: NonNullable<NonNullable<FigurePose['outfit']>['enchanted']> = {}, metal: Partial<Record<PlatePiece, string>> = {};
  for (const slot of ['arms', 'chest', 'head', 'legs', 'feet'] as const) {
    const piece = gear?.[slot], to = piece ? ITEM_PIECES[piece.id] : undefined;
    if (!piece || !to) continue;
    out[to.key] = true;
    if (piece.enchanted) enchanted[to.ench] = true;
    if (to.plate && piece.material) metal[to.plate] = piece.material;
    if (piece.dye && to.key in DYED) dye[to.key as DyedPiece] = piece.dye;
  }
  if (Object.keys(dye).length) out.dye = dye;
  if (Object.keys(enchanted).length) out.enchanted = enchanted;
  if (Object.keys(metal).length) out.metal = metal;
  return out;
}
const DYED: Readonly<Record<DyedPiece, true>> = { hood: true, tunic: true, trousers: true, boots: true, leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true };
/** The pose with its outfit: the one it is given (the creator's), else what it has equipped (`outfitOf`). */
const dressed = (pose: FigurePose): FigurePose => (pose.outfit || !pose.gear ? pose : { ...pose, outfit: outfitOf(pose.gear) });

/**
 * The wear switches: what a figure has on over its low-poly body, from its pose's `outfit` (`FigurePose.outfit`), each
 * garment left out there at the game's default: the shawl, the trousers, the boots and the tunic worn, the hood down.
 * (In play, what a figure has equipped: `outfitOf`.)
 */
/** A pose's outfit switches (none set: the first outfit, the defaults). The first outfit's pieces give way to a set's
 * piece worn over the same place: the shawl to any chest armour, mantle or leather shawl, the trousers to plate or
 * leather leggings, the tunic to plate or leather chest, the hood to the helm or the hat, the boots to plate or leather boots. */
const o = (pose: FigurePose): NonNullable<FigurePose['outfit']> => pose.outfit ?? {};
const wearsShawl = (pose: FigurePose): boolean => (pose.outfit?.shawl ?? true) && !(o(pose).plateChest || o(pose).plateMantle || o(pose).leatherChest || o(pose).leatherShawl || o(pose).chainChest || o(pose).scaleChest);
const wearsTrousers = (pose: FigurePose): boolean => (pose.outfit?.trousers ?? true) && !(o(pose).plateLegs || o(pose).leatherLegs || o(pose).chainLegs || o(pose).scaleLegs);
/** Whether a figure wears the plate set's boots (`tools/sculpt/garments/plateboots.mjs`; over the leggings, the body stood on their soles): off unless asked for. */
const wearsPlateBoots = (pose: FigurePose): boolean => pose.outfit?.plateBoots ?? false;
/** Whether a figure wears the boots (the body stands on their soles while it does): not under the plate or leather boots. */
/** Whether a figure wears the leather set's boots (`tools/sculpt/garments/leatherboots.mjs`; the body stood on their soles): off unless asked for. */
const wearsLeatherBoots = (pose: FigurePose): boolean => pose.outfit?.leatherBoots ?? false;
/** Whether a figure wears the chain set's boots (`tools/sculpt/garments/chainboots.mjs`; the body stood on their soles): off unless asked for. */
const wearsChainBoots = (pose: FigurePose): boolean => pose.outfit?.chainBoots ?? false;
/** Whether a figure wears the scale set's boots (`tools/sculpt/garments/scaleboots.mjs`; the body stood on their soles): off unless asked for. */
const wearsScaleBoots = (pose: FigurePose): boolean => pose.outfit?.scaleBoots ?? false;
const wearsBoots = (pose: FigurePose): boolean => (pose.outfit?.boots ?? true) && !wearsPlateBoots(pose) && !wearsLeatherBoots(pose) && !wearsChainBoots(pose) && !wearsScaleBoots(pose);
/** Whether a figure wears the tunic (under the shawl, over the trousers). */
const wearsTunic = (pose: FigurePose): boolean => (pose.outfit?.tunic ?? true) && !(o(pose).plateChest || o(pose).leatherChest || o(pose).chainChest || o(pose).scaleChest);
/** Whether a figure has the hood up: down unless asked for, and only with the shawl (it rises out of the shawl's cowl). */
const wearsHood = (pose: FigurePose): boolean => (pose.outfit?.hood ?? false) && wearsShawl(pose) && !(o(pose).plateHelm || o(pose).leatherHat || o(pose).chainCoif || o(pose).scaleHelm);
/**
 * Whether a figure's hair is drawn over its low-poly head: not while the hood is up (the hood's shell is snug on the
 * skull, so any hairstyle would come through it), nor under the plate helm. A hairstyle drawn with the body checks this
 * before it is laid in.
 */
/**
 * Whether a figure wears the plate set's helm (`assets/lowhelm-<who>.json` by `tools/sculpt/garments/helm.mjs`, rigid on
 * the head, no bones of its own; the head's polygons it covers whole, `hides`, left out): off unless asked for.
 */
const wearsHelm = (pose: FigurePose): boolean => pose.outfit?.plateHelm ?? false;
/**
 * Whether a figure wears the chain set's coif (`assets/lowchaincoif-<who>.json` by `tools/sculpt/garments/chaincoif.mjs`:
 * mail over the skull and the neck, the face open, the hair not drawn under it): off unless `outfit.chainCoif`. Its
 * tippet over the shoulders is left out under a chest piece with a collar of its own (`coifTippetDropped`).
 */
const wearsCoif = (pose: FigurePose): boolean => pose.outfit?.chainCoif ?? false;
const coifTippetDropped = (pose: FigurePose): boolean => wearsShawl(pose) || !!(o(pose).plateChest || o(pose).plateMantle || o(pose).leatherChest || o(pose).leatherShawl || o(pose).scaleChest);
/** Whether a figure wears the scale set's helm (`tools/sculpt/garments/scalehelm.mjs`: rigid on the head, the hair not drawn under it): off unless asked for. */
const wearsScaleHelm = (pose: FigurePose): boolean => pose.outfit?.scaleHelm ?? false;
export const hairShown = (pose: FigurePose): boolean => !wearsHood(pose) && !wearsHelm(pose) && !wearsCoif(pose) && !wearsScaleHelm(pose);
/**
 * Whether a figure wears the leather set's feathered cap (`assets/lowhat-<who>.json` by `tools/sculpt/garments/hat.mjs`:
 * rigid on the head, no bones of its own, its crown snug on the skull, the hair drawn pressed under it, `hairStyle`):
 * off unless `outfit.leatherHat`.
 */
const wearsLeatherHat = (pose: FigurePose): boolean => pose.outfit?.leatherHat ?? false;
/**
 * The hairstyle a figure's hair is drawn in: none while the hood is up, the style pressed under the leather hat while
 * that is worn (`<style>:hat`, when the hat has one for it), else the look's own.
 */
const HAT_HAIRS = new Set([...Object.keys(underHat(MALE_LEATHER_HAT)), ...Object.keys(underHat(FEMALE_LEATHER_HAT))]);
const hairStyle = (pose: FigurePose, style: string): string => (!hairShown(pose) ? '' : wearsLeatherHat(pose) && HAT_HAIRS.has(style + UNDER_HAT) ? style + UNDER_HAT : style);

/**
 * Whether a piece is enchanted (`FigurePose.outfit.enchanted`): the plate set's cores and engraving, the leather set's
 * runes, the first outfit's (cloth...) trim lines and patterns lit, as the long sword's when it is; plain unless asked for.
 */
export const enchantedOf = (piece: EnchantKey) => (pose: FigurePose): boolean => pose.outfit?.enchanted?.[piece] ?? false;
/** Whether a figure wears the plate set's chest & arms (`tools/sculpt/garments/platechest.mjs`); off unless asked for. */
const wearsPlateChest = (pose: FigurePose): boolean => pose.outfit?.plateChest ?? false;
/** Whether a figure wears the leather set's shawl (`tools/sculpt/garments/leathershawl.mjs`, over the chest armour); off unless asked for. */
const wearsLeatherShawl = (pose: FigurePose): boolean => pose.outfit?.leatherShawl ?? false;
/**
 * Whether a figure wears the leather set's chest & arms (`tools/sculpt/garments/leatherchest.mjs`: the layered cuirass,
 * its collar, pauldrons, base sleeves, bracers and wrist bands, over bare skin, the body it covers hidden); off unless
 * asked for.
 */
const wearsLeatherChest = (pose: FigurePose): boolean => pose.outfit?.leatherChest ?? false;

/**
 * The garments a low-poly body can wear, in the order they are laid over it: each its copy for the man and the woman, its
 * wear hook and, for one that can be enchanted, its enchantment's. (A garment's `drops`: whether its polygons from
 * `dropFrom` on are left out, e.g. the plate boots' knee crests while the plate leggings' knee guards are worn over the
 * same place.)
 */
const GARMENTS: ReadonlyArray<{ man: GarmentAsset; woman: GarmentAsset; wears: (pose: FigurePose) => boolean; enchanted?: (pose: FigurePose) => boolean; drops?: (pose: FigurePose) => boolean; plate?: PlatePiece; dye?: DyedPiece }> = [
  { man: MALE_SHAWL as unknown as GarmentAsset, woman: FEMALE_SHAWL as unknown as GarmentAsset, wears: wearsShawl, enchanted: enchantedOf('clothShawl') },
  { man: MALE_TROUSERS as unknown as GarmentAsset, woman: FEMALE_TROUSERS as unknown as GarmentAsset, wears: wearsTrousers, enchanted: enchantedOf('clothTrousers'), dye: 'trousers' },
  { man: MALE_BOOTS as unknown as GarmentAsset, woman: FEMALE_BOOTS as unknown as GarmentAsset, wears: wearsBoots, enchanted: enchantedOf('clothBoots'), dye: 'boots' },
  { man: MALE_TUNIC as unknown as GarmentAsset, woman: FEMALE_TUNIC as unknown as GarmentAsset, wears: wearsTunic, enchanted: enchantedOf('clothTunic'), dye: 'tunic' },
  { man: MALE_HOOD as unknown as GarmentAsset, woman: FEMALE_HOOD as unknown as GarmentAsset, wears: wearsHood, enchanted: enchantedOf('clothHood'), dye: 'hood' },
  { man: MALE_HELM as unknown as GarmentAsset, woman: FEMALE_HELM as unknown as GarmentAsset, wears: wearsHelm, enchanted: enchantedOf('helm'), plate: 'helm' },
  // the plate set's leggings (`tools/sculpt/garments/platelegs.mjs`): off unless asked for; their base layer takes the place of the legs' skin
  { man: MALE_PLATE_LEGS as unknown as GarmentAsset, woman: FEMALE_PLATE_LEGS as unknown as GarmentAsset, wears: (p) => p.outfit?.plateLegs ?? false, enchanted: enchantedOf('legs'), plate: 'legs' },
  { man: MALE_PLATE_BOOTS as unknown as GarmentAsset, woman: FEMALE_PLATE_BOOTS as unknown as GarmentAsset, wears: wearsPlateBoots, enchanted: enchantedOf('boots'), drops: (pose) => (pose.outfit?.plateLegs || pose.outfit?.scaleLegs) ?? false, plate: 'boots' },
  { man: MALE_PLATE_CHEST as unknown as GarmentAsset, woman: FEMALE_PLATE_CHEST as unknown as GarmentAsset, wears: wearsPlateChest, enchanted: enchantedOf('chest'), plate: 'chest' },
  // the plate set's fur mantle (`assets/lowmantle-<who>.json` by `tools/sculpt/garments/mantle.mjs`): off unless asked
  // for; enchanted, its clasps' cores glow
  { man: MALE_MANTLE as unknown as GarmentAsset, woman: FEMALE_MANTLE as unknown as GarmentAsset, wears: (p) => p.outfit?.plateMantle ?? false, enchanted: enchantedOf('mantle') },
  { man: MALE_LEATHER_BOOTS as unknown as GarmentAsset, woman: FEMALE_LEATHER_BOOTS as unknown as GarmentAsset, wears: wearsLeatherBoots, enchanted: enchantedOf('leatherBoots'), dye: 'leatherBoots' },
  // (their waist, from dropFrom on (the waistband and the cloth above the chest's undershirt's foot), left out under the leather chest)
  { man: MALE_LEATHER_LEGS as unknown as GarmentAsset, woman: FEMALE_LEATHER_LEGS as unknown as GarmentAsset, wears: (p) => p.outfit?.leatherLegs ?? false, enchanted: enchantedOf('leatherLegs'), drops: (p) => wearsLeatherChest(p) || (p.outfit?.chainChest ?? false), dye: 'leatherLegs' },
  // (their hip flaps, only without the leather chest or the hauberk: its skirt takes their place over the hip)
  { man: MALE_LEATHER_LEGS_FLAPS as unknown as GarmentAsset, woman: FEMALE_LEATHER_LEGS_FLAPS as unknown as GarmentAsset, wears: (p) => (p.outfit?.leatherLegs ?? false) && !(p.outfit?.leatherChest ?? false) && !(p.outfit?.chainChest ?? false), enchanted: enchantedOf('leatherLegs'), dye: 'leatherLegs' },
  // the leather set's chest & arms (`tools/sculpt/garments/leatherchest.mjs`): over the leggings, under the shawl (its
  // polygons the shawl covers, from dropFrom on, left out under it)
  { man: MALE_LEATHER_CHEST as unknown as GarmentAsset, woman: FEMALE_LEATHER_CHEST as unknown as GarmentAsset, wears: wearsLeatherChest, enchanted: enchantedOf('leatherChest'), drops: wearsLeatherShawl, dye: 'leatherChest' },
  { man: MALE_LEATHER_HAT as unknown as GarmentAsset, woman: FEMALE_LEATHER_HAT as unknown as GarmentAsset, wears: wearsLeatherHat, enchanted: enchantedOf('leatherHat'), dye: 'leatherHat' },
  // (the leather shawl: its own copy over the leather chest, fitted over its plates; the plain one without it)
  { man: MALE_LEATHER_SHAWL as unknown as GarmentAsset, woman: FEMALE_LEATHER_SHAWL as unknown as GarmentAsset, wears: (p) => wearsLeatherShawl(p) && !wearsLeatherChest(p), enchanted: enchantedOf('leatherShawl') },
  { man: MALE_LEATHER_SHAWL_OVER as unknown as GarmentAsset, woman: FEMALE_LEATHER_SHAWL_OVER as unknown as GarmentAsset, wears: (p) => wearsLeatherShawl(p) && wearsLeatherChest(p), enchanted: enchantedOf('leatherShawl') },
  // the chain set's hauberk & sleeves (`tools/sculpt/garments/chainchest.mjs`): its mail in its metal; its skirt over
  // whichever leggings are worn
  { man: MALE_CHAIN_COIF as unknown as GarmentAsset, woman: FEMALE_CHAIN_COIF as unknown as GarmentAsset, wears: wearsCoif, enchanted: enchantedOf('chainCoif'), drops: coifTippetDropped, plate: 'chainCoif' },
  // (the leggings' mail below the boots' top, from dropFrom on, left out under the chain boots, which take its place)
  { man: MALE_CHAIN_LEGS as unknown as GarmentAsset, woman: FEMALE_CHAIN_LEGS as unknown as GarmentAsset, wears: (p) => p.outfit?.chainLegs ?? false, enchanted: enchantedOf('chainLegs'), drops: wearsChainBoots, plate: 'chainLegs' },
  { man: MALE_CHAIN_BOOTS as unknown as GarmentAsset, woman: FEMALE_CHAIN_BOOTS as unknown as GarmentAsset, wears: wearsChainBoots, enchanted: enchantedOf('chainBoots'), plate: 'chainBoots' },
  { man: MALE_CHAIN_CHEST as unknown as GarmentAsset, woman: FEMALE_CHAIN_CHEST as unknown as GarmentAsset, wears: (p) => p.outfit?.chainChest ?? false, enchanted: enchantedOf('chainChest'), plate: 'chainChest' },
  // the scale set's cuirass & sleeves (`tools/sculpt/garments/scalechest.mjs`): off unless asked for; its scales and
  // scale-plate in the set's material (`scaleMat`)
  // the scale set's leggings (`tools/sculpt/garments/scalelegs.mjs`): off unless asked for; their leather takes the
  // place of the legs' skin
  { man: MALE_SCALE_LEGS as unknown as GarmentAsset, woman: FEMALE_SCALE_LEGS as unknown as GarmentAsset, wears: (p) => p.outfit?.scaleLegs ?? false, enchanted: enchantedOf('scaleLegs'), drops: (p) => p.outfit?.scaleChest ?? false, plate: 'scale' },
  // the scale set's boots (`tools/sculpt/garments/scaleboots.mjs`; the body stood on their soles): off unless asked for
  { man: MALE_SCALE_BOOTS as unknown as GarmentAsset, woman: FEMALE_SCALE_BOOTS as unknown as GarmentAsset, wears: wearsScaleBoots, enchanted: enchantedOf('scaleBoots'), plate: 'scale' },
  // the scale set's helm (`tools/sculpt/garments/scalehelm.mjs`: rigid on the head, the head's polygons it covers whole left
  // out, the hair not drawn under it): off unless asked for
  { man: MALE_SCALE_HELM as unknown as GarmentAsset, woman: FEMALE_SCALE_HELM as unknown as GarmentAsset, wears: wearsScaleHelm, enchanted: enchantedOf('scaleHelm'), plate: 'scale' },
  { man: MALE_SCALE_CHEST as unknown as GarmentAsset, woman: FEMALE_SCALE_CHEST as unknown as GarmentAsset, wears: (p) => p.outfit?.scaleChest ?? false, enchanted: enchantedOf('scaleChest'), plate: 'scale' },
];

/** What tints a garment's materials: its plate piece's metal, or its dye. */
const tintOf = (g: (typeof GARMENTS)[number]): Tinted | undefined => g.plate ?? (g.dye ? (`dye:${g.dye}` as const) : undefined);
const BODIES = {
  man: lowBody(MALE_ASSET as unknown as Asset, MALE, 1, GARMENTS.map((g) => g.man), { ...HAIRS.male, ...underHat(MALE_LEATHER_HAT) }, GARMENTS.map(tintOf)),
  woman: lowBody(FEMALE_ASSET as unknown as Asset, FEMALE, WOMAN_OF_MAN, GARMENTS.map((g) => g.woman), { ...HAIRS.female, ...underHat(FEMALE_LEATHER_HAT) }, GARMENTS.map(tintOf)),
};
/** The garments' materials after the body's (each once, however many garments share it): lit by the body's light in their own colours, unlit (glowing in the bloom), or metal (lit by its brightness, as the sword). */
const GARMENT_MATS: Material[] = GARMENT_COLOURS.map((m) => (m.kind === 1 ? { colour: m.c, emissive: true } : m.kind === 2 ? { colour: m.c, gear: true } : { colour: m.c, cloth: true }));
const LUMA = (c: readonly number[]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const hexOfRgb = (c: readonly number[]): string => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
/**
 * A head's or a blade's stone in the metal it is smithed from (`PropMaterial.metal`; `metalShades`, the colours the flat
 * figure forges gear in, iron for no metal or one it does not know): a face the metal's colour, as much lighter or darker
 * than it as the face's own colour is than the head's stone (`stoneM`), so its facets and cracks still part; the bevel
 * the metal's lit edge. Everything else of the prop keeps its own colour.
 */
function metalTint(p: PropAsset, m: PropMaterial, metal: string | undefined): string {
  if (m.wood && m.kind === 0) return woodTint(p, m, metal);
  if (!m.metal || m.kind !== 0) return m.c;
  const sh = metalShades(metal);
  if (m.metal === 'edge') return hexOfRgb(sh.lit);
  const ref = p.plain[p.mats.indexOf('stoneM')] ?? m, k = Math.pow(LUMA(hexRgb(m.c)) / LUMA(hexRgb(ref.c)), METAL_FACETS);
  const top = Math.min(1, METAL_TOP / LUMA(sh.metal));
  return hexOfRgb(sh.metal.map((v) => v * k * top));
}
/**
 * A prop carved whole from a wood (the club, `PropMaterial.wood`) in the wood it is carved from (`woodTone`, the flat
 * figure's colours for that wood): that wood's colour, scaled as much as the modelled colour is darker than oak's; as
 * modelled for no wood or one the figure does not know.
 */
function woodTint(p: PropAsset, m: PropMaterial, wood: string | undefined): string {
  const w = woodTone(wood), oak = woodTone('oak');
  if (!w || !oak) return m.c;
  const c = hexRgb(m.c), k = LUMA(c) / LUMA(oak);
  return hexOfRgb(w.map((v) => v * k));
}
/**
 * How much further apart a metal's facets are than the stone's they were modelled in (its shade over the head's stone,
 * to this power), and the brightest a face of it is (0 to 255, as luma), so a pale metal keeps its colour in the light.
 */
const METAL_FACETS = 1.8, METAL_TOP = 172;
/**
 * A plate piece's plates in the metal it is smithed from (`FigurePose.outfit.metal`; `metalShades`, as a prop's head,
 * `metalTint`): the face the metal's colour, the shadow side as much darker than it as the modelled shade is than the
 * modelled plate, lit as metal. With no metal given, the piece's own colours.
 */
function plateMat(g: (typeof GARMENT_COLOURS)[number], metal: string): Material {
  const sh = metalShades(metal), top = Math.min(1, METAL_TOP / LUMA(sh.metal));
  const face = GARMENT_COLOURS.find((x) => x.piece === g.piece && x.role === 'face' && x.kind === g.kind) ?? g;
  const k = g.role === 'shade' ? Math.pow(LUMA(hexRgb(g.c)) / LUMA(hexRgb(face.c)), METAL_FACETS) : 1;
  return { colour: hexOfRgb(sh.metal.map((v) => v * k * top)), gear: true, metal: true };
}
/**
 * The scale set's scales and scale-plate (`PLATE_ROLE` scale, edge) in its material: dragon scale's colour
 * (`DRAGON_SCALE`), the edge as much darker than it as it was modelled, lit as the plate set's (by brightness, no metal
 * sheen); a piece made of a metal in that metal, as plate (`plateMat`).
 */
function scaleMat(g: (typeof GARMENT_COLOURS)[number], material: string | undefined): Material {
  if (isMetalTone(material)) return plateMat(g, material as string);
  const face = GARMENT_COLOURS.find((x) => x.piece === g.piece && x.role === 'face' && x.kind === g.kind) ?? g;
  const k = g.role === 'shade' ? LUMA(hexRgb(g.c)) / LUMA(hexRgb(face.c)) : 1;
  return { colour: hexOfRgb(DRAGON_SCALE.map((v) => v * k)), gear: true };
}
/**
 * A dyed piece's fabric or leather in its dye (`FigurePose.outfit.dye`): the face the dye's colour, a part modelled lighter
 * or darker than the face as much lighter or darker than the dye, lit as it was. Its trim, seams, straps and runes keep theirs.
 */
function dyeMat(g: (typeof GARMENT_COLOURS)[number], dye: string, was: Material): Material {
  const face = GARMENT_COLOURS.find((x) => x.piece === g.piece && x.role === 'face' && x.kind === g.kind) ?? g;
  const k = g.role === 'shade' ? LUMA(hexRgb(g.c)) / LUMA(hexRgb(face.c)) : 1;
  return { ...was, colour: hexOfRgb(hexRgb(dye).map((v) => v * k)) };
}
/** A prop's materials, plain or enchanted, its head's or blade's stone in its metal (`metalTint`): lit by the body's light by brightness, or unlit (and so glowing in the bloom). */
const propMats = (p: PropAsset, which: 'plain' | 'enchanted', metal: string | undefined): Material[] => p[which].map((m) => (m.kind === 0 ? { colour: metalTint(p, m, metal), gear: true, ...(m.metal ? { metal: true } : {}) } : { colour: m.c, emissive: true }));
/** The skin colour the bodies' light was fitted to (`tools/sculpt/lowlight.py`), red, green and blue nought to one: a cloth's colour over it tints the light. */
const FIT_SKIN: [number, number, number] = [0.68, 0.49, 0.41];

/** A fitted light's coefficients ([channel][term], nought to 255) as the shader takes them: per term, red, green and blue nought to one. */
function shOf(fit: { global: number[][] }): Float32Array {
  const out = new Float32Array(SH_TERMS * 3);
  for (let k = 0; k < SH_TERMS; k++) for (let c = 0; c < 3; c++) out[k * 3 + c] = fit.global[c][k] / 255;
  return out;
}
const SH = { man: shOf(MALE_LIGHT), woman: shOf(FEMALE_LIGHT) };
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
/** The look's skin over the default look's, which the light was fitted to the review renders' skin for, per channel. */
let FITTED: [number, number, number] | null = null;
function toneOf(materials: Material[]): [number, number, number] {
  const a = hexRgb(materials[M.skin].colour), b = (FITTED ??= hexRgb(bodyMaterials(DEFAULT_LOOK)[M.skin].colour));
  return [a[0] / b[0], a[1] / b[1], a[2] / b[2]];
}

/** A body's skeleton as the clip player poses it in the game (for the authoring tools). */
export const lowSkeleton = (body: 'man' | 'woman'): Skeleton => BODIES[body].skeleton;
/** The long sword as a body holds it in both hands (for the authoring tools). */
export const lowHeld = (body: 'man' | 'woman'): Held => BODIES[body].held;
/** A hand tool (`TOOL_PROPS`, by id) as a body holds it (for the authoring tools). */
export const lowToolHeld = (body: 'man' | 'woman', id: string): Held | undefined => BODIES[body].toolHeld(id);
/** Where the tool in a hand takes its materials, and how many it may take (for the authoring tools). */
export const lowToolMats = (side: Side): [number, number] => [toolMat(side), PROP_SLOTS];
/**
 * The most materials a draw of a pose takes, whatever it holds (for the authoring tools to keep within `./gl.ts`
 * MAX_MATS): the body's, the prop's and both hands' tools' places, and the worn garments' materials (`usedOf`).
 */
export function lowMaterialsMost(given: FigurePose): number {
  const pose = dressed(given), who = (pose.look ?? DEFAULT_LOOK).gender === 'woman' ? 'woman' : 'man';
  return WORN_MAT + BODIES[who].used(GARMENTS.map((g) => g.wears(pose)), GARMENTS.map((g) => g.enchanted?.(pose) ?? false)).length;
}
/** A prop drawn in both hands (`PROPS`, by the weapon's id) as a body holds it (for the authoring tools). */
export const lowHeldOf = (body: 'man' | 'woman', id: string): Held | undefined => BODIES[body].heldOf(id);
/** A body's local turns for a pose as the figure's pose maps onto it, with no clip (for the authoring tools to compare). */
export const lowFigure = (body: 'man' | 'woman', pose: FigurePose): Array<M3 | undefined> => BODIES[body].figure(pose);

/**
 * A prop alone (`PROPS`, by the id of what is held), stood on its foot and turned `yaw` degrees about the upright, in the
 * metal and look of a piece, as the game draws it in hand (lit by the man's light by brightness, its glow left out): for
 * the authoring tools' close-ups.
 */
export function lowPropDraw(id: string, piece: GearPiece | undefined, yaw = 0): SculptDraw | undefined {
  const p = PROP_OF.get(id);
  if (!p) return undefined;
  const c = Math.cos((yaw * Math.PI) / 180), s = Math.sin((yaw * Math.PI) / 180);
  // its y up (the game's z), its z toward the game's -y, turned about the upright
  const at = (i: number): V => { const x = p.verts[i * 3], y = p.verts[i * 3 + 1], z = -p.verts[i * 3 + 2]; return [x * c - z * s, x * s + z * c, y]; };
  const verts: number[] = [], tris: number[] = [], faceSkin: number[] = [];
  for (let t = 0; t < p.tris.length; t += 4) {
    const pi = p.tris[t + 3];
    if (pi >= p.glowFrom) continue;
    const pts = p.polys[pi][0].map(at);
    let n: V = [0, 0, 0];
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
    const l = Math.hypot(...n) || 1, mat = p.polys[pi][1];
    for (let k = 0; k < 3; k++) {
      const q = at(p.tris[t + k]);
      verts.push(q[0], q[1], q[2], n[0] / l, n[1] / l, n[2] / l, mat, 0, 0, 0, 0, 1, 0, 0, 0, mat, -1);
      faceSkin.push(0, 0, 0, 0, 1, 0, 0, 0);
      tris.push(tris.length);
    }
  }
  const baked: Baked = { band: 1, verts: Float32Array.from(verts), tris: Uint32Array.from(tris), nVerts: verts.length / STRIDE, nTris: tris.length / 3, bones: ['prop'], ms: 0, grid: [0, 0, 0], cell: 0, faceSkin: Float32Array.from(faceSkin) };
  const materials = propMats(p, piece?.enchanted ? 'enchanted' : 'plain', piece?.material);
  return { baked, bones: Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]), materials, view: viewOf(0), blink: 0, low: { sh: SH.man, tone: [1, 1, 1], fit: FIT_SKIN } };
}

/**
 * A body stood holding a hand tool (`PROPS`, by item id) in its fist, for the authoring tools' held check (no clip draws
 * one yet): the pose's figure, the bones in `turns` turned as it says (local [rx, ry, rz] degrees, as
 * tools/sculpt/lowrig.mjs posed: the arm raised to the work), the fist closed on the tool as its socket says, the tool in
 * its hand (`PropAsset.hand`) in the pose's tool's metal (`FigurePose.tool`), lit when that is enchanted.
 */
export function lowHoldScene(given: FigurePose, id: string, turns: Record<string, [number, number, number]> = {}): SculptDraw | undefined {
  const prop = PROP_OF.get(id), pose = dressed(given);
  if (!prop) return undefined;
  const look = pose.look ?? DEFAULT_LOOK, facing = ((Math.round(pose.facing) % 8) + 8) % 8;
  const who = look.gender === 'woman' ? 'woman' : 'man', body = BODIES[who], side = prop.hand ?? 'r';
  const worn = GARMENTS.map((g) => g.wears(pose)), enchanted = GARMENTS.map((g) => g.enchanted?.(pose) ?? false), drops = GARMENTS.map((g) => g.drops?.(pose) ?? false);
  const curl = prop.sockets[who === 'woman' ? 'female' : 'male'][side].curl ?? {};
  const over: Record<string, [number, number, number]> = { ...Object.fromEntries(Object.entries(curl).map(([b, e]) => [`${b}_${side}`, e])), ...turns };
  const baked = body.baked(worn, 'hand', hairStyle(pose, look.hair), enchanted, drops, id);
  const materials = materialsOf(look, prop, pose.tool?.enchanted ? 'enchanted' : 'plain', pose.tool?.material, {}, pose.outfit?.metal, pose.outfit?.dye, USED.get(baked));
  const bones = body.bones(pose, worn, over), shapes = body.shapes();
  return { baked, bones, materials, view: viewOf(facing), blink: 0, low: { sh: SH[who], tone: toneOf(materials), fit: FIT_SKIN }, ...(shapes.some((w) => w > 0) ? { shapes } : {}) };
}

/** Whether a look is drawn as a low-poly body: a man or a woman (neither keeps the sculpted base). */
export const hasLowBody = (look: { gender: string }): boolean => look.gender === 'man' || look.gender === 'woman';


/**
 * The look's materials with the prop's drawn (plain or enchanted, in its metal) after them, each hand's tool after that,
 * and the worn garments' after those (`used`, the bake's: `usedOf`), kept per look's materials, prop and garments so the
 * renderer's copy is reused.
 */
const DRESSED = new Map<string, Material[]>();
function materialsOf(look: Look, prop: PropAsset = SWORD, lit: 'plain' | 'enchanted' = 'plain', metal?: string, tools: Partial<Record<Side, { id: string; piece?: GearPiece }>> = {}, plate: Partial<Record<PlatePiece, string>> = {}, dye: Partial<Record<DyedPiece, string>> = {}, used: readonly number[] = []): Material[] {
  const toolKey = (['r', 'l'] as const).map((s) => { const t = tools[s]; return t ? `${t.id}:${t.piece?.material ?? ''}:${t.piece?.enchanted ? 1 : 0}` : ''; }).join(',');
  const plateKey = (['chest', 'legs', 'boots', 'helm', 'chainCoif', 'chainChest', 'chainLegs', 'chainBoots', 'scale'] as const).map((p) => plate[p] ?? '').join(',') + ';' + Object.entries(dye).sort().join(',');
  const body = bodyMaterials(look), key = `${body.map((m) => m.colour).join()}|${prop.id}|${lit}|${metal ?? ''}|${toolKey}|${plateKey}|${used.join('.')}`;
  let out = DRESSED.get(key);
  if (!out) {
    out = [...body];
    // the hairstyle's hair in three tones of the look's hair colour (a fourth, darker, in its valleys), its shave the
    // skin toward that colour
    const hair = body[M.hair].colour;
    out[M.hairCut] = { colour: hair, ramp: true, noCrease: true };
    [M.hairValley, M.hairValley2, M.hairValley3, M.hairValley4].forEach((m, i) => { (out as Material[])[m] = { colour: hair, ramp: true, valley: i + 1, noCrease: true }; });
    out[M.hairUnder] = { colour: hair, shave: true };
    // (the places the props and tools leave empty: the body's skin, never drawn)
    for (let k = body.length; k < WORN_MAT; k++) out[k] = body[M.skin];
    // the worn garments' materials in the bake's order (`usedOf`): each plate or chain piece's plates or mail in its own
    // metal, each dyed piece's fabric or leather in its dye
    used.forEach((k, j) => {
      const m = GARMENT_MATS[k], g = GARMENT_COLOURS[k], dyed = g.piece?.startsWith('dye:') ? dye[g.piece.slice(4) as DyedPiece] : undefined;
      const pm = g.piece && !g.piece.startsWith('dye:') ? plate[g.piece as PlatePiece] : undefined;
      (out as Material[])[WORN_MAT + j] = g.piece === 'scale' ? scaleMat(g, pm) : pm ? plateMat(g, pm) : dyed && m.emissive !== true ? dyeMat(g, dyed, m) : m;
    });
    propMats(prop, lit, metal).forEach((m, k) => { (out as Material[])[PROP_MAT() + k] = m; });
    // each hand's tool in its hand's place, in the metal and look of the piece it is drawn as
    for (const [side, t] of Object.entries(tools) as Array<[Side, { id: string; piece?: GearPiece } | undefined]>) {
      const p = t ? TOOL_OF.get(t.id) : undefined;
      if (p) propMats(p, t?.piece?.enchanted ? 'enchanted' : 'plain', t?.piece?.material).slice(0, PROP_SLOTS).forEach((m, k) => { (out as Material[])[toolMat(side) + k] = m; });
    }
    if (DRESSED.size > 64) DRESSED.clear();
    DRESSED.set(key, out);
  }
  return out;
}

/** Everything a draw needs for a pose (`drawSculptGL`): the man's body for a man, the woman's for a woman, the garments it wears over it. */
export function lowScene(given: FigurePose): SculptDraw {
  const pose = dressed(given), look = pose.look ?? DEFAULT_LOOK;
  const facing = ((Math.round(pose.facing) % 8) + 8) % 8;
  const who = look.gender === 'woman' ? 'woman' : 'man', body = BODIES[who];
  const worn = GARMENTS.map((g) => g.wears(pose)), enchanted = GARMENTS.map((g) => g.enchanted?.(pose) ?? false), drops = GARMENTS.map((g) => g.drops?.(pose) ?? false);
  // the prop in both hands while a clip grips it (the long sword, the maul, mining's pickaxe), else carried while it is
  // wielded and not in a hand: on the back (one with a back socket) or at the belt (one with a belt socket); the piece it is
  // drawn as (the weapon, or the job's tool) in its metal, lit when enchanted
  const weapon = pose.gear?.weapon, held = heldIn(pose), prop = held !== undefined ? PROP_OF.get(held) : undefined;
  // the tools in the hands while a clip holds them (`toolsIn`): the job's own in its metal, the weapon of the one-handed
  // fight in its, the other hand's plain
  const hands = toolsIn(pose, who), tools = hands?.tools ?? {}, fight = ONE_HAND(pose);
  const pieces = Object.fromEntries(Object.entries(tools).map(([s, id]) => [s, { id: id as string, piece: fight && id === weapon?.id ? weapon : id === pose.tool?.id ? pose.tool : undefined }]));
  const inHand = !!prop, carried = !inHand && weapon && !(fight && Object.values(tools).includes(weapon.id)) ? PROP_OF.get(weapon.id) : undefined;
  const at = carried?.sockets[who === 'woman' ? 'female' : 'male'], sword: Carried | undefined = inHand ? 'hand' : at?.back ? 'back' : at?.belt ? 'belt' : undefined, drawn = sword ? prop ?? carried : undefined;
  const piece: GearPiece | undefined = held === SWING_TOOL || (held !== undefined && held === pose.tool?.id) ? pose.tool : weapon;
  const lit = piece?.enchanted ? 'enchanted' : 'plain';
  const baked = body.baked(worn, sword, hairStyle(pose, look.hair), enchanted, drops, drawn?.id, tools, hands?.up);
  const materials = materialsOf(look, drawn, lit, piece?.material, pieces, pose.outfit?.metal, pose.outfit?.dye, USED.get(baked)), low: LowLight = { sh: SH[who], tone: toneOf(materials), fit: FIT_SKIN };
  const bones = body.bones(pose, worn), trail = (inHand && prop && trails(prop)) || fight ? body.trail(pose, lit === 'enchanted') : undefined;
  const shapes = body.shapes();
  return { baked, bones, materials, view: viewOf(facing), blink: 0, low, ...(trail ? { trail } : {}), ...(shapes.some((w) => w > 0) ? { shapes } : {}) };
}

/** Local turns by bone name, [rx, ry, rz] degrees (as `tools/sculpt/lowrig.mjs` posed). */
type Turns = Readonly<Record<string, readonly [number, number, number]>>;
/**
 * A hand tool (`PROPS`, by id) in the right fist of a body stood idle (the pose's look, outfit and facing), the right arm
 * turned by `turns` and the fist closed on the tool as its socket says, in the metal and enchantment of `pose.tool`: for
 * the authoring tools to check the grip in the game's renderer before a clip holds it.
 */
export function lowToolStill(given: FigurePose, id: string, turns: Turns): SculptDraw | undefined {
  const prop = PROP_OF.get(id), pose = dressed(given);
  if (!prop) return undefined;
  const look = pose.look ?? DEFAULT_LOOK, who = look.gender === 'woman' ? 'woman' : 'man', body = BODIES[who];
  const stood: FigurePose = { ...pose, working: false, job: undefined, act: undefined };
  const worn = GARMENTS.map((g) => g.wears(stood)), enchanted = GARMENTS.map((g) => g.enchanted?.(stood) ?? false), drops = GARMENTS.map((g) => g.drops?.(stood) ?? false);
  const curl = Object.fromEntries(Object.entries(prop.sockets[who === 'woman' ? 'female' : 'male'].r.curl ?? {}).map(([b, e]) => [`${b}_r`, e]));
  const baked = body.baked(worn, 'hand', hairStyle(stood, look.hair), enchanted, drops, id);
  const materials = materialsOf(look, prop, pose.tool?.enchanted ? 'enchanted' : 'plain', pose.tool?.material, {}, pose.outfit?.metal, pose.outfit?.dye, USED.get(baked)), low: LowLight = { sh: SH[who], tone: toneOf(materials), fit: FIT_SKIN };
  const bones = body.bones(stood, worn, { ...turns, ...curl } as Record<string, [number, number, number]>);
  return { baked, bones, materials, view: viewOf(((Math.round(pose.facing) % 8) + 8) % 8), blink: 0, low };
}
