/**
 * What an action effect is the colour of: one place to ask, so a spark off a copper blade is copper, a chip off a pick is
 * the rock or the earth it was struck from, a scrap of cloth is its dye. Each answer is the colour the island already
 * draws the thing in: the ground as the renderer shades it (`Renderer.groundColor`) and as its dust is (`../dust.ts`
 * dustTone), a metal as the figure forges gear in it (`../figure.ts` metalShades), a creature's coat as it is drawn
 * (`../../game/wildforms.ts` coatOf). Colours come back as '#rrggbb'.
 *
 * Later phases add answers here (wood, leather, a blood's colour by kind).
 */
import { DRAGON_SCALE, isMetalTone, metalShades, woodTone, type FigurePose, type GearPiece } from '../figure';
import { ARMOUR_BY_ID, type ArmourClass } from '../../game/gear';
import { dustTone } from '../dust';
import { TileType, dustiness } from '../../world/tiles';
import { coatOf as coatColours, type Forms } from '../../game/wildforms';
import { SPECIES } from '../../game/creatures';

/** What the effects ask of the island being drawn (the renderer answers). */
export interface FxWorld {
  /** A tile's ground as drawn now, 'rgb(r,g,b)', or null off the island. */
  groundColour(tx: number, ty: number): string | null;
  /** A tile's type as drawn, or null off the island. */
  tile(tx: number, ty: number): number | null;
  /** A creature's kind and colouring, or null when it is not about. */
  creature(id: number): (Forms & { species: string; variant: number }) | null;
}

/** The ground at a point: as drawn, its dust, whether it is stone, and how much it gives up when struck (`dustiness`, nought to one). */
export interface GroundTone { colour: string; dust: string; stony: boolean; weight: number }
/** A metal: its colour, shadow, lit edge and a blade's face; its name; and whether the piece is enchanted. */
export interface MetalTone { metal: string; dark: string; lit: string; blade: string; name: string; enchanted: boolean }

/** What a blow lands on at a slot of the body: the class of the armour worn there (none for bare or a cloth-less slot) and the piece. */
export interface ArmourAt { cls: ArmourClass | 'none'; piece?: GearPiece }
/** A shield: whether it is metal, its colours (a metal's, or its wood's face and shade), and whether it is enchanted. */
export interface ShieldTone { metal: boolean; tone: MetalTone | null; wood: string; woodDark: string; enchanted: boolean }
/** New-cut wood where a shield's material is not a wood we know. */
const PLAIN_WOOD: [number, number, number] = [176, 132, 88];

/** The tiles that are stone where they are struck: bare rock, cobbles, slabs, stepping stones. */
export const STONY: ReadonlySet<number> = new Set<number>([TileType.Rock, TileType.Cobblestone, TileType.Slabs, TileType.SteppingStones, TileType.Steps]);
/** Ground off the island, or not yet known. */
const NO_GROUND: GroundTone = { colour: '#8a8070', dust: '#d8ccb4', stony: false, weight: 0.4 };

const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
/** An [r, g, b] as '#rrggbb'. */
export const hexOf = (c: readonly number[]): string => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
/** 'rgb(r,g,b)' (or '#rrggbb') as '#rrggbb'. */
export function hexOfCss(css: string): string {
  if (css.startsWith('#')) return css.length === 7 ? css : NO_GROUND.colour;
  const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(css);
  return m ? hexOf([+m[1], +m[2], +m[3]]) : NO_GROUND.colour;
}

/** Between two '#rrggbb' colours, as '#rrggbb' (the spells' `mixColour` gives 'rgb()', which the kit's colour helpers do not read). */
export function mixHex(a: string, b: string, u: number): string {
  const p = parseInt(a.slice(1, 7), 16), q = parseInt(b.slice(1, 7), 16);
  const ch = (s: number): number => ((p >> s) & 255) + (((q >> s) & 255) - ((p >> s) & 255)) * u;
  return hexOf([ch(16), ch(8), ch(0)]);
}
/** A '#rrggbb' colour darker (k under one, toward black) or lighter (over one, toward white), as '#rrggbb'. */
export function shadeHex(hex: string, k: number): string {
  return k >= 1 ? mixHex(hex, '#ffffff', Math.min(1, k - 1)) : mixHex('#000000', hex, Math.max(0, k));
}

export class FxMaterials {
  constructor(private readonly world: FxWorld) {}

  /** The ground under a point (tiles). */
  ground(x: number, y: number): GroundTone {
    const tx = Math.floor(x), ty = Math.floor(y);
    const c = this.world.groundColour(tx, ty), t = this.world.tile(tx, ty);
    if (c === null || t === null) return NO_GROUND;
    return { colour: hexOfCss(c), dust: hexOfCss(dustTone(c)), stony: STONY.has(t), weight: dustiness(t) };
  }

  /** The stone of the tile under a point as drawn (an ore's colour in a seam), or null where it is not stone. */
  stone(x: number, y: number): string | null {
    const g = this.ground(x, y);
    return g.stony ? g.colour : null;
  }

  /** A piece's metal (iron's for none, or for a material that is not a metal), and whether it is enchanted. */
  metal(piece: GearPiece | undefined): MetalTone {
    const s = metalShades(piece?.material);
    return { metal: hexOf(s.metal), dark: hexOf(s.dark), lit: hexOf(s.lit), blade: hexOf(s.blade), name: piece?.material ?? 'iron', enchanted: !!piece?.enchanted };
  }

  /**
   * The piece a body holds by its id (`FxEvent.held`): the weapon in hand, or the job's tool (mining's pickaxe is the
   * pose's tool whatever it is called), or none.
   */
  piece(pose: FigurePose | undefined, id: string | undefined): GearPiece | undefined {
    if (!pose) return undefined;
    if (id && pose.gear?.weapon?.id === id && pose.job === 'attack_creature') return pose.gear.weapon;
    if (pose.tool && (!id || pose.tool.id === id || id === 'pickaxe')) return pose.tool;
    return id && pose.gear?.weapon?.id === id ? pose.gear.weapon : undefined;
  }

  /** The armour worn at a slot of the body (`head`, `chest`, `arms`, `legs`, `feet`): its class and the piece. */
  armour(pose: FigurePose | undefined, slot: string): ArmourAt {
    const piece = pose?.gear?.[slot as 'head'], a = piece ? ARMOUR_BY_ID.get(piece.id) : undefined;
    return a && piece ? { cls: a.cls, piece } : { cls: 'none' };
  }

  /** Dragon scale's colour, for a blow on scale armour. */
  scale(): string {
    return hexOf(DRAGON_SCALE);
  }

  /** The shield worn (`gear.offhand`): metal (the metal shield, or one of a metal) or wood, in its colours; null without one. */
  shield(pose: FigurePose | undefined): ShieldTone | null {
    const piece = pose?.gear?.offhand;
    if (!piece || !/shield/.test(piece.id)) return null;
    const metal = piece.id === 'metal_shield' || isMetalTone(piece.material), w = woodTone(piece.material) ?? PLAIN_WOOD;
    return { metal, tone: metal ? this.metal(piece) : null, wood: hexOf(w), woodDark: hexOf([w[0] * 0.62, w[1] * 0.58, w[2] * 0.55]), enchanted: !!piece.enchanted };
  }

  /** A dyed piece's dye, or null for one undyed. */
  dye(piece: GearPiece | undefined): string | null {
    return piece?.dye && /^#[0-9a-f]{6}$/i.test(piece.dye) ? piece.dye.toLowerCase() : null;
  }

  /** A creature's coat and markings as it is drawn, or null when it is not about. */
  coat(id: number): [string, string] | null {
    const c = this.world.creature(id), def = c ? SPECIES[c.species] : undefined;
    return c && def ? coatColours(c, def) : null;
  }
}
