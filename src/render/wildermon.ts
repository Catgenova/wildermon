import { darker, drawBeast, drawBeastPortrait, headOf, topOf, type Anim, type BeastPose, type Kind } from './beasts';
import { LUME, VESP } from './wild-air';
import { QUILL, SEDRA } from './wild-birds';
import { SKYLOOKLET, SKYRANGE, SKYWARDEN } from './wild-sky';
import { DRAGON } from './wild-dragon';
import { DOWSE, SNOUT } from './wild-diggers';
import { FERRODRILL, IRONEMOLE, OREMANDER } from './wild-iron';
import { BURA, CUDDA, GORRAL, ORSE, ROXXEN, SAPPA, SHAGGAN, SNEDDA } from './wild-herd';
import { MAGGA } from './wild-odd';
import { CLAYBURROW, MUDLET, TERRAMOLE } from './wild-clay';
import { SANDPINCHER, SANDPINNACLE, SANDPIP } from './wild-sand';
import { ULVA } from './wild-hunters';
import { HARVESTUSK, PIGROOT, PLOWHOG } from './wild-pig';
import { CLOUDBORNE, CLOUDLET, CLOUDRAM } from './wild-cloud';
import { SNUFFLET, SNUFFROOT, SNUFFTHORN } from './wild-snuff';
import { SPOREKIN, SPORELING, SPORELORD } from './wild-spore';
import { GOBLIN, OGRE, ORC, TINKA } from './wild-upright';
import { BEVERE, BOGGA, EMBRA, HOLLA, MIDDUN, PLUCKA, WADD } from './wild-brook';
import { COBBE, GRUBBA, ROWL } from './wild-wild';
import { CHIPTAIL, MONOLITHUMP, QUARRYBASH } from './wild-chip';
import { BRAMBO, CARRA, GRAZZA, GRISTA, KEMMA, SALVA, SHEELA, SIFFA, TANNA, WICKA } from './wild-hands';
import { AMBRA, BEDDA, CINDRA, FORGA, HOPPA, PETTA, POTTA, RELKA, SCURRA, SIMMA, SPRIGGA, WURLA } from './wild-hands2';
import { CHISSA, CORDRA, DIPPA, FLECHA, GLOSSA, MUDDA, PAPRA, RIPPA } from './wild-hands3';
import { AWLA, GASHA, SKULKA, SPARRA, SPITTA, TESTA, THUMPA } from './wild-fighters';
import { BASHKA, BRITTLA, CRAKKA, DULLA, EXECUTA, FROSTA, HAMMA, HOWLA, LEECHA, LUNGRA, MARKA, ROOTLE, SCORCHA, SHOVA, STONA, WARDO, WHIRLA } from './wild-abilities';

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
  snout: SNOUT,
  roxxen: ROXXEN,
  orse: ORSE,
  cudda: CUDDA,
  bura: BURA,
  gorral: GORRAL,
  shaggan: SHAGGAN,
  snedda: SNEDDA,
  sappa: SAPPA,
  rowl: ROWL,
  grubba: GRUBBA,
  cobbe: COBBE,
  quarra: CHIPTAIL,
  embra: EMBRA,
  bogga: BOGGA,
  bevere: BEVERE,
  wadd: WADD,
  holla: HOLLA,
  plucka: PLUCKA,
  middun: MIDDUN,
  sedra: SEDRA,
  warda: SKYLOOKLET,
  quill: QUILL,
  tinka: TINKA,
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
  wicka: WICKA,
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
  sprigga: SPRIGGA,
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
  thumpa: THUMPA,
  spitta: SPITTA,
  awla: AWLA,
  sparra: SPARRA,
  lungra: LUNGRA,
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
  stona: STONA,
  leecha: LEECHA,
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
  noot: [CLAYBURROW, TERRAMOLE],
  crawler: [SANDPINCHER, SANDPINNACLE],
};

/** Whether a kind is drawn as a model here, or still by hand. */
export const modelled = (species: string | undefined): boolean => !!species && species in WILDERMON;

/** The model a kind is drawn as at a stage, and the name its pictures are kept under. */
function modelAt(species: string, stage = 0): { key: string; kind: Kind } | null {
  const later = stage > 0 ? WILDERMON_STAGES[species]?.[stage - 1] : undefined;
  if (later) return { key: `${species}@${stage}`, kind: later };
  const kind = WILDERMON[species];
  return kind ? { key: species, kind } : null;
}

/** A wildermon with its feet at (sx, sy), as it is drawn at its stage. */
export function drawWildermon(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, species: string, colors: [string, string], p: BeastPose, stage = 0): void {
  const m = modelAt(species, stage);
  if (m) drawBeast(ctx, sx, sy, zoom, m.key, m.kind, colors, p);
}

/** How far over its feet the top of a kind is, standing, at zoom one: where its name and health bar go. */
export function wildermonTop(species: string, stage = 0): number | undefined {
  const m = modelAt(species, stage);
  return m ? topOf(m.key, m.kind) : undefined;
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
