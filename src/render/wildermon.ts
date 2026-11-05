import { darker, drawBeast, drawBeastPortrait, extentOf, forgetBeast, headOf, kitOf, topOf, type Anim, type BeastPose, type Kind } from './beasts';
import type { V3 } from './figure';

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
 *
 * Each line's models are a module of their own (`./wild-<line>`), fetched the
 * first time a body of that line is wanted (`LINES`), not with the page: the
 * models are about a quarter of the game's code, and an island shows a handful
 * of lines at a time. Until its module is in, a body is not drawn (its name
 * and health bar still are), and a page's picture of it is put down once it
 * is. A line not drawn for `FORGET_AFTER` lets go of its pieces and pictures
 * (`forgetBeast`), so a long evening does not keep every line it has seen.
 */

/** What a kind that is ridden is drawn as saddled and bridled, at each of its stages; and how high its rider sits on each, in pixels at zoom one. */
interface Tack { kinds: readonly Kind[]; seat: (stage: number) => number; grip: (stage: number) => V3; tuck: readonly number[] }
/**
 * A line's models: its first stage; what it is drawn as at its second stage and its third (`SpeciesDef.stages`), when it
 * evolves -- with none, it is drawn as its first at every stage; saddled, when it is ridden; and, for a kind of
 * subspecies (`SpeciesDef.subspecies`), each subspecies by its variant.
 */
interface Line { kind: Kind; stages?: readonly [Kind, Kind]; tacked?: Tack; subspecies?: readonly Kind[] }
const line = (kind: Kind, stages?: readonly [Kind, Kind], tacked?: Tack): Line => ({ kind, stages, tacked });

/* ---- the kinds ----------------------------------------------------------------------- */

/** Each kind's line, by species, as its module is fetched. */
const LINES: Record<string, () => Promise<Line>> = {
  rabba: () => import('./wild-snuff').then((m) => line(m.SNUFFLET, [m.SNUFFROOT, m.SNUFFTHORN])),
  woola: () => import('./wild-cloud').then((m) => line(m.CLOUDLET, [m.CLOUDRAM, m.CLOUDBORNE])),
  magga: () => import('./wild-chest').then((m) => line(m.CHESTKIT, [m.LOOTVENT, m.HOARDBACK])),
  noot: () => import('./wild-clay').then((m) => line(m.MUDLET, [m.CLAYBURROW, m.TERRAMOLE])),
  crawler: () => import('./wild-sand').then((m) => line(m.SANDPIP, [m.SANDPINCHER, m.SANDPINNACLE])),
  ulva: () => import('./wild-spider').then((m) => line(m.SPRINDLE, [m.WEBLOOM, m.SILKWARD])),
  seavic: () => import('./wild-pig').then((m) => line(m.PIGROOT, [m.PLOWHOG, m.HARVESTUSK])),
  vola: () => import('./wild-spore').then((m) => line(m.SPORELING, [m.SPOREKIN, m.SPORELORD])),
  mola: () => import('./wild-iron').then((m) => line(m.IRONEMOLE, [m.FERRODRILL, m.OREMANDER])),
  dowse: () => import('./wild-nail').then((m) => line(m.NAILSPROUT, [m.HAMMERTIN, m.NAILWRIGHT])),
  snout: () => import('./wild-badger').then((m) => line(m.DIRTLET, [m.TUNNELCLAW, m.EARTHREND])),
  roxxen: () => import('./wild-haul').then((m) => line(m.CARTLING, [m.WAGONOX, m.HAULHORN])),
  orse: () => import('./wild-hare').then((m) => line(m.THISTLEKIT, [m.BUNNYCOURSER, m.MOONHARE], { kinds: m.HARE_TACKED, seat: m.hareSeat, grip: m.hareGrip, tuck: m.HARE_TUCK })),
  cudda: () => import('./wild-cow').then((m) => line(m.CREAMCALF, [m.MILKMERE, m.LACTISOVEREIGN])),
  bura: () => import('./wild-pack').then((m) => line(m.PACKLET, [m.HAULBUD, m.CARGOCREST])),
  gorral: () => import('./wild-herd').then((m) => line(m.GORRAL)),
  shaggan: () => import('./wild-herd').then((m) => line(m.SHAGGAN)),
  snedda: () => import('./wild-giraffe').then((m) => line(m.SAPLINGREACH, [m.CANOPYSHAPER, m.GROVEMASTER])),
  sappa: () => import('./wild-pip').then((m) => line(m.PIPSEED, [m.SPRIGWING, m.ARBORCREST])),
  rowl: () => import('./wild-vine').then((m) => line(m.SNAREPUP, [m.LASHRUNNER, m.VINEHUNTER])),
  grubba: () => import('./wild-petal').then((m) => line(m.BUDSCARAB, [m.BLOSSOMHORN, m.FLORANTLER])),
  cobbe: () => import('./wild-brick').then((m) => line(m.BRICKLING, [m.MORTARBACK, m.BASTIONDRAKE])),
  quarra: () => import('./wild-chip').then((m) => line(m.CHIPTAIL, [m.QUARRYBASH, m.MONOLITHUMP])),
  embra: () => import('./wild-slug').then((m) => line(m.SLUGLOW, [m.SLUGEMBER, m.SLUGFERNO])),
  bogga: () => import('./wild-toad').then((m) => line(m.MOSSKIP, [m.CRAGHOPPER, m.BASTIONTOAD])),
  bevere: () => import('./wild-gnaw').then((m) => line(m.SAPGNAW, [m.LOGCHEWER, m.TIMBERLORD])),
  wadd: () => import('./wild-penguin').then((m) => line(m.FINLET, [m.REEFFIN, m.TIDEHARVEST])),
  holla: () => import('./wild-frog').then((m) => line(m.PUDDLEHOP, [m.SPRINGCARRIER, m.AQUAVOYAGER])),
  plucka: () => import('./wild-vanari').then((m) => line(m.VANARI, [m.ORCHIBELLE, m.ARBOANARI])),
  middun: () => import('./wild-snail').then((m) => line(m.SNAILEAF, [m.MIDDUNSNAIL, m.HEARTHSNAIL])),
  sedra: () => import('./wild-reed').then((m) => line(m.REEDPUP, [m.REEDWEAVER, m.MARSHREAPER])),
  warda: () => import('./wild-sky').then((m) => line(m.SKYLOOKLET, [m.SKYWARDEN, m.SKYRANGE])),
  quill: () => import('./wild-peafowl').then((m) => line(m.PEACHICK, [m.PLUMECREST, m.FEATHERBOURNE])),
  tinka: () => import('./wild-mend').then((m) => line(m.STITCHKIT, [m.PATCHCOON, m.MENDERMASK])),
  goblin: () => import('./wild-upright').then((m) => line(m.GOBLIN)),
  orc: () => import('./wild-orc').then((m) => ({ kind: m.ORCS[0], subspecies: m.ORCS })),
  ogre: () => import('./wild-ogre').then((m) => ({ kind: m.OGRES[0], subspecies: m.OGRES })),
  vesp: () => import('./wild-bee').then((m) => line(m.BUZZLET, [m.COMBWORKER, m.HIVEMASTER])),
  lume: () => import('./wild-air').then((m) => line(m.LUME)),
  dragon: () => import('./wild-dragon').then((m) => line(m.DRAGON)),
  kemma: () => import('./wild-owl').then((m) => line(m.WHISPLING, [m.HUSHWING, m.SONGROOST])),
  sheela: () => import('./wild-shear').then((m) => line(m.SHEARLING, [m.CLIPPEROO, m.SHEARLORD])),
  // The Herbpup, the Herbfox and the Herbwarden.
  salva: () => import('./wild-herbpup').then((m) => line(m.HERBPUP, [m.HERBFOX, m.HERBWARDEN])),
  carra: () => import('./wild-log').then((m) => line(m.LOGNIB, [m.TIMBERSPLIT, m.BEAMMASTER])),
  tanna: () => import('./wild-pelt').then((m) => line(m.PELTLING, [m.PELTIPEDE, m.HIDEWEAVER])),
  grista: () => import('./wild-hamster').then((m) => line(m.WHEATLEY, [m.WHEATWHIRL, m.WHEATCHEEKS])),
  wicka: () => import('./wild-moth').then((m) => line(m.GLIMMOTH, [m.LUREWING, m.NOCTILURE])),
  brambo: () => import('./wild-hands').then((m) => line(m.BRAMBO)),
  grazza: () => import('./wild-mantis').then((m) => line(m.SPRIGMANT, [m.PETALBLADE, m.BLOOMREAPER])),
  siffa: () => import('./wild-ribbon').then((m) => line(m.RIBBONIP, [m.STRIPFORGE, m.METALLOCURL])),
  forga: () => import('./wild-hands2').then((m) => line(m.FORGA)),
  potta: () => import('./wild-kiln').then((m) => line(m.KILNLET, [m.TERRABRICK, m.KILNSPIRE])),
  cindra: () => import('./wild-ember').then((m) => line(m.EMBERKIT, [m.EMBERBRUSH, m.ASHSWEEPER])),
  hoppa: () => import('./wild-hands2').then((m) => line(m.HOPPA)),
  simma: () => import('./wild-broth').then((m) => line(m.BROTHLET, [m.STOCKBELLY, m.CAULDRONTHROAT])),
  relka: () => import('./wild-relic').then((m) => line(m.KINTSU, [m.RELICRAWLER, m.AURELIAX])),
  bedda: () => import('./wild-calico').then((m) => line(m.SPRIGKIT, [m.BLOOMWHISK, m.FLORAMANE])),
  wurla: () => import('./wild-curlew').then((m) => line(m.PEBBLEBEAK, [m.SOILWHISTLE, m.WORMHERON])),
  sprigga: () => import('./wild-lemur').then((m) => line(m.LEMLET, [m.LEMLEAF, m.LEMORIAN])),
  ambra: () => import('./wild-maple').then((m) => line(m.SAPLET, [m.MAPLETAP, m.TAPSYLVAN])),
  petta: () => import('./wild-goat').then((m) => line(m.BRIARLING, [m.MEADOWTIDE, m.FLORACRUX])),
  scurra: () => import('./wild-wall').then((m) => line(m.WALLKIT, [m.BRISTLEWARD, m.STONEPOLISH])),
  rippa: () => import('./wild-timber').then((m) => line(m.LOGKIT, [m.SAWQUILL, m.TIMBERBACK])),
  chissa: () => import('./wild-hands3').then((m) => line(m.CHISSA)),
  mudda: () => import('./wild-clayroll').then((m) => line(m.SLIPLET, [m.WHEELMOTE, m.ROLLTERRA])),
  cordra: () => import('./wild-hands3').then((m) => line(m.CORDRA)),
  flecha: () => import('./wild-sable').then((m) => line(m.SABLEKIT, [m.SABLEPLUME, m.FLETCHERCREST])),
  papra: () => import('./wild-papyrus').then((m) => line(m.REEDLING, [m.PAPYRUSKIN, m.PRESSMERE])),
  glossa: () => import('./wild-mortoise').then((m) => line(m.MORTARSHELL, [m.GROUTBACK, m.MORTOISE])),
  dippa: () => import('./wild-capy').then((m) => line(m.PAILBARA, [m.CASKYBARA, m.RESERVARA])),
  thumpa: () => import('./wild-crag').then((m) => line(m.PEBBLETOOTH, [m.SHALECLAW, m.CRAGJAWS])),
  spitta: () => import('./wild-fighters').then((m) => line(m.SPITTA)),
  awla: () => import('./wild-spiral').then((m) => line(m.SPIRALCALF, [m.SPIRALTRUNK, m.SPIRALPHANT])),
  sparra: () => import('./wild-dummy').then((m) => line(m.DUMMICUB, [m.DUMMIBEAR, m.DUMMITITAN])),
  lungra: () => import('./wild-briar').then((m) => line(m.BLUSHKIT, [m.BRIARPOUNCE, m.THORNLANCE])),
  crakka: () => import('./wild-pestlet').then((m) => line(m.PESTLET, [m.CHURNSCALE, m.MORTARIUM])),
  whirla: () => import('./wild-abilities').then((m) => line(m.WHIRLA)),
  scorcha: () => import('./wild-abilities').then((m) => line(m.SCORCHA)),
  frosta: () => import('./wild-abilities').then((m) => line(m.FROSTA)),
  rootle: () => import('./wild-abilities').then((m) => line(m.ROOTLE)),
  dulla: () => import('./wild-moss').then((m) => line(m.MOSSNIB, [m.MOSSSHEAR, m.MOSSREAVER])),
  brittla: () => import('./wild-abilities').then((m) => line(m.BRITTLA)),
  stona: () => import('./wild-zephyr').then((m) => line(m.ZEPHLET, [m.GALECREST, m.TEMPESTWYRM])),
  leecha: () => import('./wild-loomhare').then((m) => line(m.CLOTHKIT, [m.LOOMHARE, m.BANDAGEWEAVER])),
  whispet: () => import('./wild-ghost').then((m) => line(m.WHISPET, [m.LANTERNVEIL, m.HALLOWMIRE])),
  springlet: () => import('./wild-tide').then((m) => line(m.SPRINGLET, [m.SPRINGSAIL, m.TIDECOURSER], { kinds: m.TIDE_TACKED, seat: m.tideSeat, grip: m.tideGrip, tuck: m.TIDE_TUCK })),
  glimmip: () => import('./wild-glass').then((m) => line(m.GLIMMIP, [m.GLASCADE, m.PRISMETAIL])),
};

/** The kinds drawn as a model here, rather than by hand. */
export const WILDERMON_SPECIES: readonly string[] = Object.keys(LINES);

/** Each line whose module is in, by species. */
const lines = new Map<string, Line>();
/** Each line whose module is on its way. */
const fetching = new Map<string, Promise<Line | undefined>>();
/** Pictures for a page asked for before their line was in, put down once it is (`drawWildermonPortrait`). */
const owed = new Map<string, (() => void)[]>();

/**
 * Drawing put off to the next frames, a slice at a time.
 *
 * The field guide's index asks for a portrait of every kind and stage at once; with each line fetched when first
 * wanted, its pictures were drawn as each line arrived, and the arrivals came back to back, so one task drew them all:
 * 18 s in the boot check's software renderer, 3-5 s on a player's machine, with the page frozen. Drawn here, at most
 * `SLICE_MS` a frame (always one at least), the window opens at once and fills in.
 */
export const SLICE_MS = 8;
const soon: Array<() => void> = [];
let pumping = false;
function nextSlice(): void {
  if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && document.visibilityState !== 'hidden') requestAnimationFrame(pump);
  else setTimeout(pump, 16);
}
function pump(): void {
  const end = performance.now() + SLICE_MS;
  do {
    const f = soon.shift();
    if (!f) break;
    try {
      f();
    } catch (e) {
      console.error(e);
    }
  } while (soon.length && performance.now() < end);
  if (soon.length) nextSlice();
  else pumping = false;
}
/** Draw at the next frame with time to spare, in the order asked. */
export function drawSoon(f: () => void): void {
  soon.push(f);
  if (pumping) return;
  pumping = true;
  nextSlice();
}

/**
 * A line's models, fetched if they are not yet. Resolves to nothing for a kind with none, or when the fetch fails (asked
 * again, it is tried again).
 */
export function loadWildermon(species: string): Promise<Line | undefined> {
  const had = lines.get(species);
  if (had) return Promise.resolve(had);
  const load = LINES[species];
  if (!load) return Promise.resolve(undefined);
  let p = fetching.get(species);
  if (!p) {
    p = inTurn(load, !asking).then((l) => {
      lines.set(species, l);
      return l;
    }, () => undefined).finally(() => {
      fetching.delete(species);
      const due = owed.get(species) ?? [];
      owed.delete(species);
      for (const draw of due) drawSoon(draw);
    });
    fetching.set(species, p);
  }
  return p;
}

/**
 * Lines fetched a few at a time.
 *
 * The field guide asks for every line at once; fetched together, they arrived together and the browser ran all of
 * their code in one task, 4 s of the page held in the boot check. `LOADING_AT_ONCE` at a time, with a turn of the
 * page between, and a line a creature in the world wants goes ahead of those a portrait wants.
 */
export const LOADING_AT_ONCE = 2;
let loadingNow = 0;
const waiting: Array<() => void> = [];
function inTurn<T>(load: () => Promise<T>, urgent: boolean): Promise<T> {
  return new Promise<T>((done, fail) => {
    const go = (): void => {
      loadingNow++;
      load().then(done, fail).finally(() => {
        loadingNow--;
        setTimeout(nextLoad, 0);
      });
    };
    if (loadingNow < LOADING_AT_ONCE && !waiting.length) go();
    else if (urgent) waiting.unshift(go);
    else waiting.push(go);
  });
}
function nextLoad(): void {
  while (loadingNow < LOADING_AT_ONCE && waiting.length) waiting.shift()!();
}
/** A portrait is asking (`drawWildermonPortrait`): its line can wait behind those the world wants. */
let asking = false;

/** Every line's models, for a harness or a tool that draws them all. */
export async function loadAllWildermon(): Promise<void> {
  await Promise.all(WILDERMON_SPECIES.map(loadWildermon));
}

/* ---- letting go ------------------------------------------------------------------------ */

/** How long a line goes undrawn before what is kept for it is let go, in milliseconds. */
export const FORGET_AFTER = 5 * 60_000;
/** How often the lines are looked over for that, in milliseconds. */
const SWEEP_EVERY = 30_000;
/** When each line was last wanted, by species, on `performance.now()`'s clock. */
const used = new Map<string, number>();
let swept = 0;
/** Told each body's key let go, for whatever else keeps pictures under it. */
const forgetters: ((key: string) => void)[] = [];

/** Calls `f` with each body's key (the name its pictures are kept under) whose line has been let go. */
export function onWildermonForgotten(f: (key: string) => void): void {
  forgetters.push(f);
}

/** The keys a line's bodies are kept under: each stage, and saddled. */
function keysOf(species: string, l: Line): { key: string; kind: Kind }[] {
  const out = [{ key: species, kind: l.kind }];
  l.stages?.forEach((kind, i) => out.push({ key: `${species}@${i + 1}`, kind }));
  l.tacked?.kinds.forEach((kind, i) => out.push({ key: `${species}@${i}+tack`, kind }));
  l.subspecies?.forEach((kind, i) => out.push({ key: `${species}~${i}`, kind }));
  return out;
}

/**
 * Let go of what is kept for every line not wanted since `FORGET_AFTER` before `now`. Its module stays in, so drawn
 * again it is only its pictures that are made afresh. The keys let go.
 */
export function sweepWildermon(now = performance.now()): string[] {
  swept = now;
  const gone: string[] = [];
  for (const [species, at] of used) {
    if (now - at < FORGET_AFTER) continue;
    used.delete(species);
    const l = lines.get(species);
    if (!l) continue;
    for (const { key, kind } of keysOf(species, l)) {
      forgetBeast(key, kind);
      clears.delete(key);
      for (const f of forgetters) f(key);
      gone.push(key);
    }
  }
  return gone;
}

/** A line wanted now: kept, and the lines not wanted for a while let go. */
function want(species: string): Line | undefined {
  const now = performance.now();
  used.set(species, now);
  if (now - swept > SWEEP_EVERY) sweepWildermon(now);
  const l = lines.get(species);
  if (!l && species in LINES) void loadWildermon(species);
  return l;
}

/* ---- drawing them ---------------------------------------------------------------------- */

/** Whether a kind is drawn as a model here, or still by hand. */
export const modelled = (species: string | undefined): boolean => !!species && species in LINES;

/**
 * The model a kind is drawn as at a stage (or, for a kind of subspecies, as its variant's subspecies), and the name its
 * pictures are kept under; nothing while its line is on its way.
 */
export function wildermonKind(species: string, stage = 0, tacked = false, variant?: number): { key: string; kind: Kind } | null {
  const l = want(species);
  if (!l) return null;
  if (l.subspecies && variant !== undefined) {
    const v = l.subspecies[variant] ? variant : 0;
    return { key: `${species}~${v}`, kind: l.subspecies[v] };
  }
  const saddled = tacked ? l.tacked?.kinds[Math.max(0, Math.min(2, stage))] : undefined;
  if (saddled) return { key: `${species}@${stage}+tack`, kind: saddled };
  const later = stage > 0 ? l.stages?.[stage - 1] : undefined;
  if (later) return { key: `${species}@${stage}`, kind: later };
  return { key: species, kind: l.kind };
}

/** A wildermon with its feet at (sx, sy), as it is drawn at its stage, and for a kind of subspecies as its variant's. */
export function drawWildermon(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, species: string, colors: [string, string], p: BeastPose, stage = 0, tacked = false,
  variant?: number): void {
  const m = wildermonKind(species, stage, tacked, variant);
  if (m) drawBeast(ctx, sx, sy, zoom, m.key, m.kind, colors, p);
}

/** How far over its feet the top of a kind is, standing, at zoom one: where its name and health bar go. */
export function wildermonTop(species: string, stage = 0, variant?: number): number | undefined {
  const m = wildermonKind(species, stage, false, variant);
  if (!m) return undefined;
  return CLEARS.has(species) ? Math.max(topOf(m.key, m.kind), clearOf(m.key, m.kind)) : topOf(m.key, m.kind);
}

/**
 * The kinds whose name and health bar go over the highest they reach standing about or at their acts, not only standing still and
 * going: a beast that rears, or whose tall ears swivel, would otherwise come up through its own name.
 */
const CLEARS = new Set(['orse', 'springlet']);
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
  return want(species)?.tacked?.seat(stage);
}

/**
 * How its rider sits on a kind at its stage: where the reins go to -- its bit, in the rider's own units from the saddle, grown
 * (`Seat.grip`) -- and how far the legs are drawn up (`Seat.tuck`).
 */
export function wildermonSaddle(species: string, stage = 0): { grip: V3; tuck: number } | undefined {
  const t = want(species)?.tacked;
  return t && { grip: t.grip(stage), tuck: t.tuck[Math.max(0, Math.min(t.tuck.length - 1, stage))] };
}

/** Where a kind's head is over its feet at a facing, at zoom one (`headOf`): where the reins of a team come to. */
export function wildermonHead(species: string, facing: number, stage = 0): [number, number] | null {
  const m = wildermonKind(species, stage);
  return m ? headOf(m.key, m.kind, facing) : null;
}

/**
 * A kind on its own, for a page; posed, for one that shows it walking, striking or at its task. Asked for before its line
 * is in, it is put down on `ctx` once it is, as `ctx` stood when it was asked for.
 */
export function drawWildermonPortrait(ctx: CanvasRenderingContext2D, w: number, h: number, species: string, colors: [string, string], facing = 1, ink?: string,
  stage = 0, pose?: Partial<Anim>, t = 0): void {
  asking = true;
  let m: ReturnType<typeof wildermonKind>;
  try {
    m = wildermonKind(species, stage);
  } finally {
    asking = false;
  }
  if (m) {
    drawBeastPortrait(ctx, w, h, m.key, m.kind, colors, facing, ink, t, pose);
    return;
  }
  if (!(species in LINES)) return;
  const at = ctx.getTransform();
  const due = owed.get(species) ?? [];
  due.push(() => {
    const later = wildermonKind(species, stage);
    if (!later) return;
    ctx.save();
    ctx.setTransform(at);
    drawBeastPortrait(ctx, w, h, later.key, later.kind, colors, facing, ink, t, pose);
    ctx.restore();
  });
  owed.set(species, due);
}

export type { Anim };
export { darker };
