import { darker, drawBeast, drawBeastPortrait, extentOf, headOf, kitOf, topOf, type Anim, type BeastPose, type Kind } from './beasts';
import type { V3 } from './figure';
import { LUME, VESP } from './wild-air';
import { QUILL } from './wild-birds';
import { MARSHREAPER, REEDPUP, REEDWEAVER } from './wild-reed';
import { SKYLOOKLET, SKYRANGE, SKYWARDEN } from './wild-sky';
import { DRAGON } from './wild-dragon';
import { DOWSE } from './wild-diggers';
import { DIRTLET, EARTHREND, TUNNELCLAW } from './wild-badger';
import { FERRODRILL, IRONEMOLE, OREMANDER } from './wild-iron';
import { BURA, CUDDA, GORRAL, SHAGGAN, SNEDDA } from './wild-herd';
import { ARBORCREST, PIPSEED, SPRIGWING } from './wild-pip';
import { CARTLING, HAULHORN, WAGONOX } from './wild-haul';
import { BUNNYCOURSER, HARE_TACKED, HARE_TUCK, hareGrip, hareSeat, MOONHARE, THISTLEKIT } from './wild-hare';
import { MAGGA } from './wild-odd';
import { CLAYBURROW, MUDLET, TERRAMOLE } from './wild-clay';
import { SANDPINCHER, SANDPINNACLE, SANDPIP } from './wild-sand';
import { ULVA } from './wild-hunters';
import { HARVESTUSK, PIGROOT, PLOWHOG } from './wild-pig';
import { CLOUDBORNE, CLOUDLET, CLOUDRAM } from './wild-cloud';
import { SNUFFLET, SNUFFROOT, SNUFFTHORN } from './wild-snuff';
import { SPOREKIN, SPORELING, SPORELORD } from './wild-spore';
import { GOBLIN, OGRE, ORC } from './wild-upright';
import { MENDERMASK, PATCHCOON, STITCHKIT } from './wild-mend';
import { MIDDUN, PLUCKA, WADD } from './wild-brook';
import { BASTIONTOAD, CRAGHOPPER, MOSSKIP } from './wild-toad';
import { AQUAVOYAGER, PUDDLEHOP, SPRINGCARRIER } from './wild-frog';
import { LEMLEAF, LEMLET, LEMORIAN } from './wild-lemur';
import { SLUGEMBER, SLUGFERNO, SLUGLOW } from './wild-slug';
import { HALLOWMIRE, LANTERNVEIL, WHISPET } from './wild-ghost';
import { LOGCHEWER, SAPGNAW, TIMBERLORD } from './wild-gnaw';
import { GRUBBA } from './wild-wild';
import { LASHRUNNER, SNAREPUP, VINEHUNTER } from './wild-vine';
import { BLUSHKIT, BRIARPOUNCE, THORNLANCE } from './wild-briar';
import { BASTIONDRAKE, BRICKLING, MORTARBACK } from './wild-brick';
import { CHIPTAIL, MONOLITHUMP, QUARRYBASH } from './wild-chip';
import { BRAMBO, CARRA, GRAZZA, GRISTA, KEMMA, SALVA, SHEELA, SIFFA, TANNA } from './wild-hands';
import { GLIMMOTH, LUREWING, NOCTILURE } from './wild-moth';
import { AMBRA, BEDDA, CINDRA, FORGA, HOPPA, PETTA, POTTA, RELKA, SCURRA, SIMMA, WURLA } from './wild-hands2';
import { CHISSA, CORDRA, DIPPA, FLECHA, GLOSSA, MUDDA, PAPRA, RIPPA } from './wild-hands3';
import { AWLA, GASHA, SKULKA, SPARRA, SPITTA, TESTA } from './wild-fighters';
import { CRAGJAWS, PEBBLETOOTH, SHALECLAW } from './wild-crag';
import { BASHKA, BRITTLA, CRAKKA, DULLA, EXECUTA, FROSTA, HAMMA, HOWLA, LEECHA, MARKA, ROOTLE, SCORCHA, SHOVA, WARDO, WHIRLA } from './wild-abilities';
import { GALECREST, TEMPESTWYRM, ZEPHLET } from './wild-zephyr';

/**
 * The wildermon, each as a body of its own (`./beasts` for what they are all
 * made with).
 *
 * None of them is simply the animal it was drawn from. Every one is a cute
 * thing first -- a head a size too big for it, eyes that look back at you at
 * forty pixels, soft round masses -- and every one carries something that is
 * not in any field guide: a snufflet wears a mane of leaves, a woola's fleece is
 * cloud. What it is made of is its variant's two colours, the coat and the
 * markings, and its kind's own things.
 */

/* ---- the kinds ----------------------------------------------------------------------- */

export const WILDERMON: Record<string, Kind> = {
  rabba: SNUFFLET,
  woola: CLOUDLET,
  magga: MAGGA,
  noot: MUDLET,
  crawler: SANDPIP,
  ulva: ULVA,
  seavic: PIGROOT,
  vola: SPORELING,
  mola: IRONEMOLE,
  dowse: DOWSE,
  snout: DIRTLET,
  roxxen: CARTLING,
  orse: THISTLEKIT,
  cudda: CUDDA,
  bura: BURA,
  gorral: GORRAL,
  shaggan: SHAGGAN,
  snedda: SNEDDA,
  sappa: PIPSEED,
  rowl: SNAREPUP,
  grubba: GRUBBA,
  cobbe: BRICKLING,
  quarra: CHIPTAIL,
  embra: SLUGLOW,
  bogga: MOSSKIP,
  bevere: SAPGNAW,
  wadd: WADD,
  holla: PUDDLEHOP,
  plucka: PLUCKA,
  middun: MIDDUN,
  sedra: REEDPUP,
  warda: SKYLOOKLET,
  quill: QUILL,
  tinka: STITCHKIT,
  goblin: GOBLIN,
  orc: ORC,
  ogre: OGRE,
  vesp: VESP,
  lume: LUME,
  dragon: DRAGON,
  kemma: KEMMA,
  sheela: SHEELA,
  salva: SALVA,
  carra: CARRA,
  tanna: TANNA,
  grista: GRISTA,
  wicka: GLIMMOTH,
  brambo: BRAMBO,
  grazza: GRAZZA,
  siffa: SIFFA,
  forga: FORGA,
  potta: POTTA,
  cindra: CINDRA,
  hoppa: HOPPA,
  simma: SIMMA,
  relka: RELKA,
  bedda: BEDDA,
  wurla: WURLA,
  sprigga: LEMLET,
  ambra: AMBRA,
  petta: PETTA,
  scurra: SCURRA,
  rippa: RIPPA,
  chissa: CHISSA,
  mudda: MUDDA,
  cordra: CORDRA,
  flecha: FLECHA,
  papra: PAPRA,
  glossa: GLOSSA,
  dippa: DIPPA,
  testa: TESTA,
  skulka: SKULKA,
  gasha: GASHA,
  thumpa: PEBBLETOOTH,
  spitta: SPITTA,
  awla: AWLA,
  sparra: SPARRA,
  lungra: BLUSHKIT,
  hamma: HAMMA,
  crakka: CRAKKA,
  bashka: BASHKA,
  executa: EXECUTA,
  whirla: WHIRLA,
  scorcha: SCORCHA,
  frosta: FROSTA,
  rootle: ROOTLE,
  dulla: DULLA,
  brittla: BRITTLA,
  shova: SHOVA,
  howla: HOWLA,
  marka: MARKA,
  wardo: WARDO,
  stona: ZEPHLET,
  leecha: LEECHA,
  whispet: WHISPET,
};

/**
 * What a kind that evolves is drawn as at its second stage and its third (`SpeciesDef.stages`). A kind with none here
 * is drawn as its first at every stage.
 */
export const WILDERMON_STAGES: Partial<Record<string, readonly [Kind, Kind]>> = {
  rabba: [SNUFFROOT, SNUFFTHORN],
  mola: [FERRODRILL, OREMANDER],
  quarra: [QUARRYBASH, MONOLITHUMP],
  vola: [SPOREKIN, SPORELORD],
  warda: [SKYWARDEN, SKYRANGE],
  woola: [CLOUDRAM, CLOUDBORNE],
  seavic: [PLOWHOG, HARVESTUSK],
  bevere: [LOGCHEWER, TIMBERLORD],
  embra: [SLUGEMBER, SLUGFERNO],
  whispet: [LANTERNVEIL, HALLOWMIRE],
  noot: [CLAYBURROW, TERRAMOLE],
  crawler: [SANDPINCHER, SANDPINNACLE],
  cobbe: [MORTARBACK, BASTIONDRAKE],
  roxxen: [WAGONOX, HAULHORN],
  tinka: [PATCHCOON, MENDERMASK],
  orse: [BUNNYCOURSER, MOONHARE],
  sedra: [REEDWEAVER, MARSHREAPER],
  holla: [SPRINGCARRIER, AQUAVOYAGER],
  stona: [GALECREST, TEMPESTWYRM],
  bogga: [CRAGHOPPER, BASTIONTOAD],
  wicka: [LUREWING, NOCTILURE],
  sappa: [SPRIGWING, ARBORCREST],
  snout: [TUNNELCLAW, EARTHREND],
  thumpa: [SHALECLAW, CRAGJAWS],
  rowl: [LASHRUNNER, VINEHUNTER],
  sprigga: [LEMLEAF, LEMORIAN],
  lungra: [BRIARPOUNCE, THORNLANCE],
};

/** What a kind that is ridden is drawn as saddled and bridled, at each of its stages; and how high its rider sits on each, in pixels at zoom one. */
const TACKED: Partial<Record<string, { kinds: readonly Kind[]; seat: (stage: number) => number; grip: (stage: number) => V3; tuck: readonly number[] }>> = {
  orse: { kinds: HARE_TACKED, seat: hareSeat, grip: hareGrip, tuck: HARE_TUCK },
};

/** Whether a kind is drawn as a model here, or still by hand. */
export const modelled = (species: string | undefined): boolean => !!species && species in WILDERMON;

/** The model a kind is drawn as at a stage, and the name its pictures are kept under. */
function modelAt(species: string, stage = 0, tacked = false): { key: string; kind: Kind } | null {
  const saddled = tacked ? TACKED[species]?.kinds[Math.max(0, Math.min(2, stage))] : undefined;
  if (saddled) return { key: `${species}@${stage}+tack`, kind: saddled };
  const later = stage > 0 ? WILDERMON_STAGES[species]?.[stage - 1] : undefined;
  if (later) return { key: `${species}@${stage}`, kind: later };
  const kind = WILDERMON[species];
  return kind ? { key: species, kind } : null;
}

/** A wildermon with its feet at (sx, sy), as it is drawn at its stage. */
export function drawWildermon(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, species: string, colors: [string, string], p: BeastPose, stage = 0, tacked = false): void {
  const m = modelAt(species, stage, tacked);
  if (m) drawBeast(ctx, sx, sy, zoom, m.key, m.kind, colors, p);
}

/** How far over its feet the top of a kind is, standing, at zoom one: where its name and health bar go. */
export function wildermonTop(species: string, stage = 0): number | undefined {
  const m = modelAt(species, stage);
  if (!m) return undefined;
  return CLEARS.has(species) ? Math.max(topOf(m.key, m.kind), clearOf(m.key, m.kind)) : topOf(m.key, m.kind);
}

/**
 * The kinds whose name and health bar go over the highest they reach standing about or at their acts, not only standing still and
 * going: a beast that rears, or whose tall ears swivel, would otherwise come up through its own name.
 */
const CLEARS = new Set(['orse']);
/** Over the feet the highest any part of a kind comes, in screen units at zoom one, through its loop standing and its strike and task, with a margin. */
const clears = new Map<string, number>();
function clearOf(key: string, kind: Kind): number {
  const had = clears.get(key);
  if (had !== undefined) return had;
  const kit = kitOf(key, kind, 0), base: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  let hi = 0;
  const up = (a: Anim): void => { for (let f = 0; f < 8; f++) hi = Math.max(hi, -extentOf(kind, kit, f, a).y0); };
  for (let t = 0; t < 24; t += 0.5) up({ ...base, t, breath: 0.5 + 0.5 * Math.sin(t) });
  for (const act of kind.acts ?? []) for (let q = 0; q <= 16; q++) up({ ...base, act: { kind: act, t: q / 16 } });
  const top = hi * (kind.size ?? 1) + 3;
  clears.set(key, top);
  return top;
}

/** How high a rider sits on a kind at its stage, in screen pixels at zoom one over its feet, grown: where its model's saddle is. */
export function wildermonSeat(species: string, stage = 0): number | undefined {
  return TACKED[species]?.seat(stage);
}

/**
 * How its rider sits on a kind at its stage: where the reins go to -- its bit, in the rider's own units from the saddle, grown
 * (`Seat.grip`) -- and how far the legs are drawn up (`Seat.tuck`).
 */
export function wildermonSaddle(species: string, stage = 0): { grip: V3; tuck: number } | undefined {
  const t = TACKED[species];
  return t && { grip: t.grip(stage), tuck: t.tuck[Math.max(0, Math.min(t.tuck.length - 1, stage))] };
}

/** Where a kind's head is over its feet at a facing, at zoom one (`headOf`): where the reins of a team come to. */
export function wildermonHead(species: string, facing: number, stage = 0): [number, number] | null {
  const m = modelAt(species, stage);
  return m ? headOf(m.key, m.kind, facing) : null;
}

/** A kind on its own, for a page; posed, for one that shows it walking, striking or at its task. */
export function drawWildermonPortrait(ctx: CanvasRenderingContext2D, w: number, h: number, species: string, colors: [string, string], facing = 1, ink?: string,
  stage = 0, pose?: Partial<Anim>, t = 0): void {
  const m = modelAt(species, stage);
  if (m) drawBeastPortrait(ctx, w, h, m.key, m.kind, colors, facing, ink, t, pose);
}

export type { Anim };
export { darker };
