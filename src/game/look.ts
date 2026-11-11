/**
 * What somebody looks like, and the only place that decides it.
 *
 * This is data, so anything may read it — the sprites, the account page, the
 * definition dump that puts it in Postgres — without anything importing
 * anything back. Its one import is data too: the list of hairstyles made for
 * the sculpted bodies (`src/sculpt/assets/lowhair-styles.json`, written by
 * `tools/sculpt/lowhair.mjs --asset` beside the meshes), so a new hairstyle
 * is offered the day its mesh is.
 *
 * ## Ids and numbers, never colours
 *
 * A look is a body (an id), a hairstyle (an id) and three numbers from nought
 * to one: where the skin is along `SKIN_RAMP`, where the hair is along
 * `HAIR_RAMP`, and how far the hair has gone toward white. Nothing a person
 * types ever reaches a canvas: a `look` travels from a stranger's browser
 * through the database and into `ctx.fillStyle` on everybody else's machine,
 * so a field is either an id out of a table here or a number this file turns
 * into a colour itself. An id that is not in the table is not a colour, it is
 * a default; a number out of range is the nearest end.
 *
 * ## Looks from before the sculpted bodies
 *
 * Those were eight ids: twenty haircuts, three builds, ten skins and
 * twenty-three hair colours as swatches, eyes, beards and two cloths. The
 * sculpted bodies draw two builds and the hairstyles made for them, so an old
 * look is read through `LEGACY`: a build or haircut to the nearest there is
 * now, a skin or hair colour to the place on the ramps nearest the swatch it
 * was. Eyes, beards and cloth are not part of a look any more (the flat figure
 * draws the defaults below). The island does the same (`look_clean`, from the
 * `look_legacy` rows the definitions write out of `legacyLooks()`).
 */
import HAIR_INDEX from '../sculpt/assets/lowhair-styles.json';

export type Gender = 'man' | 'woman';

export interface Look {
  gender: Gender;
  /** 'bald', or a hairstyle made for the sculpted bodies: an id out of HAIRSTYLES. */
  hair: string;
  /** Along HAIR_RAMP: nought black, one flax. */
  hairColour: number;
  /** Toward HAIR_WHITE: nought none, one white. */
  hairGrey: number;
  /** Along SKIN_RAMP: nought the palest, one the darkest. */
  skin: number;
}

export interface Style {
  id: string;
  name: string;
}

const y = (id: string, name: string): Style => ({ id, name });

/** The two bodies, by the names the creator shows: Type 1 the man's, Type 2 the woman's. */
export const GENDERS: Style[] = [y('man', 'Type 1'), y('woman', 'Type 2')];

/** Bald, and every hairstyle there is a mesh for on both bodies. */
export const HAIRSTYLES: Style[] = [y('bald', 'Bald'), ...HAIR_INDEX.styles.map((s) => y(s.id, s.name))];

/**
 * The build each answers to: how wide the shoulders, waist and hips are
 * against a body in between (the flat figure's; the sculpted bodies are their
 * own meshes).
 */
export const BUILDS: Record<Gender, { shoulder: number; waist: number; hip: number }> = {
  man: { shoulder: 1.18, waist: 1, hip: 0.95 },
  woman: { shoulder: 0.84, waist: 0.76, hip: 1.2 },
};

/* ---- colour ------------------------------------------------------------------------------------------ */

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as RGB;
const hexOf = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** CIE Lab (D65) of an sRGB colour: what "nearest" and "evenly spaced" are measured in. */
function labOf(c: RGB): RGB {
  const lin = c.map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const xyz = [
    (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047,
    0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2],
    (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883,
  ].map((v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
const labGap = (a: RGB, b: RGB): number => { const p = labOf(a), q = labOf(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/** A slider's colours: each stop's place along it (nought to one, three places) and colour. */
export interface Ramp {
  at: number[];
  colour: string[];
}

/** Stops placed along nought to one by how far apart they look (Lab), so a slider moves as evenly as it can. */
function ramp(stops: string[]): Ramp {
  const gaps = stops.slice(1).map((c, i) => labGap(rgbOf(stops[i]), rgbOf(c)));
  const total = gaps.reduce((a, b) => a + b, 0);
  let run = 0;
  const at = [0, ...gaps.map((g) => { run += g; return run / total; })].map((t) => Math.round(t * 1000) / 1000);
  at[at.length - 1] = 1;
  return { at, colour: stops };
}

/** The colour at `t` along a ramp, straight between the stops either side. */
export function rampColour(r: Ramp, t: number): string {
  const x = clamp01(t);
  let i = 1;
  while (i < r.at.length - 1 && x > r.at[i]) i++;
  const a = r.at[i - 1], b = r.at[i];
  return hexOf(mixRGB(rgbOf(r.colour[i - 1]), rgbOf(r.colour[i]), b > a ? (x - a) / (b - a) : 0));
}

const clamp01 = (t: number): number => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);
/** A slider's number as it is kept: nought to one, three places. */
export const toneOf = (t: number): number => Math.round(clamp01(t) * 1000) / 1000;

/**
 * Skin, palest to darkest: the ten swatches there were, as stops. The palest
 * is as pale as the sculpted bodies' fitted light can shade without the lit
 * side of a face going flat (its red and green under full on the brightest
 * facets: `supabase/test/sculptlook.ts` measures it), and the darkest still
 * shows its facets above the ink round it.
 */
export const SKIN_RAMP: Ramp = ramp(['#f5ddc6', '#ecc8a6', '#ddae85', '#c79a68', '#b5804f', '#9d6a3f', '#855634', '#6b4328', '#55341f', '#3e2617']);

/** Hair, black through the browns, auburn and red to the blondes. */
export const HAIR_RAMP: Ramp = ramp(['#1c1614', '#3b2a1c', '#5a3a1e', '#6f4423', '#7d3a1d', '#a5521f', '#b8672a', '#b98c3f', '#d8b76a', '#e6d3a1']);

/** What hair goes to as it greys: `hairGrey` of the way from its colour to this. */
export const HAIR_WHITE = '#ded9d0';

/** The hair's colour for a place on HAIR_RAMP and a share of grey. */
export const hairColourAt = (colour: number, grey: number): string =>
  hexOf(mixRGB(rgbOf(rampColour(HAIR_RAMP, colour)), rgbOf(HAIR_WHITE), clamp01(grey)));

/* ---- looks from before ------------------------------------------------------------------------------- */

/** The swatches and builds there were, kept to say where each went. */
const OLD_SKINS: Record<string, string> = {
  porcelain: '#f5ddc6', fair: '#ecc8a6', light: '#ddae85', olive: '#c79a68', tan: '#b5804f',
  bronze: '#9d6a3f', umber: '#855634', deep: '#6b4328', dark: '#55341f', ebony: '#3e2617',
};
const OLD_HAIR_COLOURS: Record<string, string> = {
  black: '#1c1614', soot: '#2a211c', dark_brown: '#3b2a1c', brown: '#5a3a1e', chestnut: '#6f4423', auburn: '#7d3a1d',
  ginger: '#a5521f', copper: '#b8672a', honey: '#b98c3f', blond: '#d8b76a', flax: '#e6d3a1', ash: '#b9b0a3',
  grey: '#8e8b85', white: '#ded9d0', pastel_blue: '#9cc3ec', blue: '#3462bf', teal: '#2b8f8c', green: '#4e9a48',
  purple: '#6c40a6', lavender: '#b69de2', pink: '#e690bd', magenta: '#b9367f', red: '#bb2b30',
};
const OLD_BUILDS: Record<string, { shoulder: number; waist: number; hip: number }> = {
  ...BUILDS, neither: { shoulder: 1, waist: 0.92, hip: 1.03 },
};
/**
 * The twenty haircuts there were, each to the nearest hairstyle there is now:
 * cropped to the shoulders or above to the swept back, longer to the braid,
 * and a tonsure to bald. A haircut there is a mesh for is itself.
 */
const OLD_HAIRSTYLES: Record<string, string> = {
  bald: 'bald', tonsure: 'bald',
  crop: 'swept', short: 'swept', bowl: 'swept', side: 'swept', swept: 'swept', fringe: 'swept', curls: 'swept',
  afro: 'swept', waves: 'swept', ridge: 'swept', undercut: 'swept',
  long: 'braid', ponytail: 'braid', topknot: 'braid', bun: 'braid', braid: 'braid', braids: 'braid', locs: 'braid',
};

/** How far from `want` (Lab) a colour is. */
const gapTo = (want: RGB): ((c: RGB) => number) => {
  const q = labOf(want);
  return (c) => { const p = labOf(c); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
};

/** The place along a ramp whose colour (greyed by `grey`) is nearest `hex`, to three places. */
function nearestOn(r: Ramp, hex: string, grey = 0): number {
  // (a stop is its own place)
  const stop = grey === 0 ? r.colour.indexOf(hex) : -1;
  if (stop >= 0) return r.at[stop];
  const gap = gapTo(rgbOf(hex)), white = rgbOf(HAIR_WHITE);
  let best = 0, least = Infinity;
  for (let k = 0; k <= 1000; k++) {
    const g = gap(mixRGB(rgbOf(rampColour(r, k / 1000)), white, grey));
    if (g < least) { least = g; best = k / 1000; }
  }
  return best;
}

/** The place and grey nearest a hair colour: the grey by hundredths, then the place by thousandths at it. */
function nearestHair(hex: string): { hairColour: number; hairGrey: number } {
  const gap = gapTo(rgbOf(hex)), white = rgbOf(HAIR_WHITE);
  const along = Array.from({ length: 201 }, (_, k) => rgbOf(rampColour(HAIR_RAMP, k / 200)));
  let grey = 0, least = Infinity;
  for (let gi = 0; gi <= 100; gi++) {
    for (const c of along) {
      const g = gap(mixRGB(c, white, gi / 100));
      if (g < least) { least = g; grey = gi / 100; }
    }
  }
  return { hairColour: nearestOn(HAIR_RAMP, hex, grey), hairGrey: grey };
}

/** The build nearest an old one, by its shoulders, waist and hips. */
function nearestBuild(id: string): Gender {
  const b = OLD_BUILDS[id];
  const off = (g: Gender): number => Math.abs(BUILDS[g].shoulder - b.shoulder) + Math.abs(BUILDS[g].waist - b.waist) + Math.abs(BUILDS[g].hip - b.hip);
  return (GENDERS.map((g) => g.id as Gender)).reduce((a, g) => (off(g) < off(a) ? g : a));
}

/** An old id, the field it was in, and the fields it becomes. */
export interface Legacy {
  kind: keyof Look;
  id: string;
  becomes: Partial<Look>;
}

/** The ids there were, by the field they were in, each to what it becomes (worked out the first time it is asked). */
const OLD: Record<string, Record<string, () => Partial<Look>>> = {
  gender: Object.fromEntries(Object.keys(OLD_BUILDS).map((id) => [id, () => ({ gender: nearestBuild(id) })])),
  hair: Object.fromEntries(Object.entries(OLD_HAIRSTYLES).map(([id, to]) => [id, () => ({ hair: HAIRSTYLES.some((h) => h.id === to) ? to : DEFAULT_LOOK.hair })])),
  skin: Object.fromEntries(Object.entries(OLD_SKINS).map(([id, c]) => [id, () => ({ skin: nearestOn(SKIN_RAMP, c) })])),
  hairColour: Object.fromEntries(Object.entries(OLD_HAIR_COLOURS).map(([id, c]) => [id, () => nearestHair(c)])),
};
const BECAME = new Map<string, Partial<Look>>();
function legacyOf(kind: keyof Look, id: string): Partial<Look> | undefined {
  const of = Object.hasOwn(OLD, kind) && Object.hasOwn(OLD[kind], id) ? OLD[kind][id] : undefined;
  if (!of) return undefined;
  const key = `${kind}|${id}`;
  let b = BECAME.get(key);
  if (!b) BECAME.set(key, (b = of()));
  return b;
}

/** Every id a look could hold before the sculpted bodies, and what it is now (the island's `look_legacy`). */
export function legacyLooks(): Legacy[] {
  return Object.entries(OLD).flatMap(([kind, ids]) => Object.keys(ids).map((id) => ({ kind: kind as keyof Look, id, becomes: legacyOf(kind as keyof Look, id) ?? {} })));
}

/* ---- a look ------------------------------------------------------------------------------------------ */

/** The fields of a look, in the order the island keeps them (`look_kinds()`), and those that are numbers (`look_tones()`). */
export const LOOK_KINDS: Array<keyof Look> = ['gender', 'hair', 'skin', 'hairColour', 'hairGrey'];
export const LOOK_TONES: Array<keyof Look> = ['skin', 'hairColour', 'hairGrey'];

/** The ids a look picks from, by the name the database and the creator both file them under. */
export const LOOK_TABLES = {
  gender: GENDERS,
  hair: HAIRSTYLES,
} as const;

export const DEFAULT_LOOK: Look = {
  gender: 'man',
  hair: HAIRSTYLES.some((h) => h.id === 'swept') ? 'swept' : 'bald',
  skin: nearestOn(SKIN_RAMP, OLD_SKINS.light),
  hairColour: nearestOn(HAIR_RAMP, OLD_HAIR_COLOURS.brown),
  hairGrey: 0,
};

const pick = (table: Style[], id: unknown, fallback: string): string =>
  (typeof id === 'string' && table.some((t) => t.id === id) ? id : fallback);
const tone = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? toneOf(v) : fallback);

/**
 * A look out of whatever arrived, with everything unrecognised replaced.
 *
 * Total, deliberately: it never throws and never returns a partial look, so
 * there is no path anywhere in the program where a body has half an
 * appearance. An old look's ids are read through `LEGACY` first. The same is
 * done again in SQL (`look_clean`), because this one runs on the client and
 * therefore proves nothing.
 */
export function cleanLook(raw: unknown): Look {
  const o: Partial<Record<keyof Look, unknown>> = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as object) } : {};
  for (const kind of LOOK_KINDS) {
    const v = o[kind];
    // (an id that is still one is itself: a haircut there is a mesh for, a body there is)
    const current = (kind === 'gender' && GENDERS.some((g) => g.id === v)) || (kind === 'hair' && HAIRSTYLES.some((h) => h.id === v));
    if (typeof v === 'string' && !current) Object.assign(o, legacyOf(kind, v));
  }
  return {
    gender: pick(GENDERS, o.gender, DEFAULT_LOOK.gender) as Gender,
    hair: pick(HAIRSTYLES, o.hair, DEFAULT_LOOK.hair),
    skin: tone(o.skin, DEFAULT_LOOK.skin),
    hairColour: tone(o.hairColour, DEFAULT_LOOK.hairColour),
    hairGrey: tone(o.hairGrey, DEFAULT_LOOK.hairGrey),
  };
}

/**
 * The colours a look comes to, for whoever is holding the brush. A tool may
 * hand in a look that names a colour outright ('#rrggbb') or an old swatch id,
 * and gets that colour.
 */
export function skinColour(l: Look): string {
  const v = l.skin as unknown;
  if (typeof v === 'string') return v.startsWith('#') ? v : OLD_SKINS[v] ?? rampColour(SKIN_RAMP, DEFAULT_LOOK.skin);
  return rampColour(SKIN_RAMP, tone(v, DEFAULT_LOOK.skin));
}
export function hairColour(l: Look): string {
  const v = l.hairColour as unknown;
  if (typeof v === 'string') return v.startsWith('#') ? v : OLD_HAIR_COLOURS[v] ?? hairColourAt(DEFAULT_LOOK.hairColour, 0);
  return hairColourAt(tone(v, DEFAULT_LOOK.hairColour), tone(l.hairGrey, 0));
}

/** What the flat figure draws for what a look no longer says: brown eyes, an unbleached shirt, walnut trousers. */
export const eyeColour = (_l: Look): string => '#5a3a20';
export const shirtColour = (_l: Look): string => '#d9cbae';
export const trouserColour = (_l: Look): string => '#6b4b2e';

/** A hex colour darkened towards black, for a fold or the shaded side. */
export function darken(hex: string, by: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const cut = (v: number): number => Math.max(0, Math.round(v * (1 - by)));
  const r = cut((n >> 16) & 255);
  const g = cut((n >> 8) & 255);
  const b = cut(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Somebody, at random: either body, any hairstyle, anywhere along both ramps, not grey. What the creator opens on. */
export function randomLook(roll: () => number = Math.random): Look {
  const any = <T extends { id: string }>(t: T[]): string => t[Math.min(t.length - 1, Math.floor(roll() * t.length))].id;
  return {
    gender: any(GENDERS) as Gender,
    hair: any(HAIRSTYLES),
    skin: toneOf(roll()),
    hairColour: toneOf(roll()),
    hairGrey: 0,
  };
}
