/**
 * How a garden piece (`garden.ts`) is drawn: the one number its bake is kept
 * under (`gardenTrim`), worked out off what the island keeps of it and the
 * wall clock; what moves on a birdhouse, by the season and the Effects
 * setting (`gardenAmbience`); and a carved figure, which is the kind's own
 * model recoloured to the wood it was carved from (`carving`).
 */
import { furnitureDef, type PlacedFurniture } from '../game/furniture';
import { bloomStage, bonsaiGrowth, FIGURE_KINDS, hedgeGrowth, topiaryOut, topiaryShows } from '../game/garden';
import type { Effects } from '../game/settings';
import { CLIMBER_BARE, CLIMBER_BLOOMS, roseStage } from '../game/roses';
import { seasonAt } from '../world/calendar';
import { FEWER_SHARE } from './fx/actions';
import { bloomTrim, BLOOM_STAGES, bonsaiTrim, carving, figureTrim, gardenFx, hedgeTrim, standTrim, topiaryTrim, trophyTrim, wisteriaTrim } from './kit/garden';
import { drawBeastPortrait } from './beasts';
import { wildermonKind } from './wildermon';
import { css, mix, type RGB } from './runestone';

/** A garden piece's trim, or undefined for a piece that is none of them (or, a herb box, is drawn as a planter is). */
export function gardenTrim(f: PlacedFurniture, now: number): number | undefined {
  const def = furnitureDef(f.kind);
  const g = f.garden;
  if (def.bloom) return bloomTrim(BLOOM_STAGES.indexOf(bloomStage(f.setAt, now).stage), g?.bloom ?? []);
  if (def.hedge) return hedgeTrim(hedgeGrowth(f.setAt, now), g?.clip ?? null);
  if (def.topiary) return topiaryTrim(topiaryShows(g, now), topiaryOut(g, now));
  if (def.bonsai) return bonsaiTrim(bonsaiGrowth(f.setAt, now), g?.prunes ?? 0);
  if (def.climber === 'wisteria') {
    const r = roseStage(f.setAt, now, 'wisteria');
    const season = seasonAt(now).season;
    return wisteriaTrim(r.days, CLIMBER_BARE.wisteria.includes(season) ? 2 : CLIMBER_BLOOMS.wisteria.includes(season) ? 0 : 1);
  }
  if (def.figure) {
    const kind = g?.figure;
    const i = kind ? FIGURE_KINDS().indexOf(kind) : -1;
    return figureTrim(i, i >= 0 && !!wildermonKind(kind as string));
  }
  if (def.shows?.what === 'trophy') return trophyTrim(g?.held?.[0]?.def ?? null);
  if (def.shows?.what === 'pot') return standTrim((g?.held ?? []).map((h) => h.def));
  return undefined;
}

/** What a birdhouse's birds go by this frame: the season, and the share of them the Effects setting allows. */
export function gardenAmbience(season: string, effects: Effects): void {
  gardenFx.season = season;
  gardenFx.birds = effects !== 'off';
  gardenFx.share = effects === 'fewer' ? FEWER_SHARE : 1;
}

/* ---- a carved figure ---------------------------------------------------------------------- */

const carved = new Map<string, HTMLCanvasElement>();
/** Where a carving's shade gives way to its wood, and its wood to its light, as shares of its pixels darkest first. */
const CARVE_BANDS = [0.3, 0.75] as const;
/** How far a carving's model is softened before it is cut, in pixels at zoom one. */
const CARVE_SOFT = 0.6;

/**
 * A kind drawn as a carving: its model as a portrait, every pixel of it cut
 * to one of the wood's three tones -- the light and shade of the model kept, its colours
 * gone -- and set in the box. False while its model is on its way.
 */
carving.draw = (g, index, w, h, wood: RGB) => {
  const species = FIGURE_KINDS()[index];
  const line = species ? wildermonKind(species) : null;
  if (!species || !line) return false;
  // At the pixels it will land on, so a bake at zoom two is as sharp as one at zoom one.
  const m = g.getTransform();
  const k = Math.max(1, Math.hypot(m.a, m.b));
  const key = `${species}|${Math.round(w * k)}|${Math.round(h * k)}|${wood.map(Math.round).join(',')}`;
  let pic = carved.get(key);
  if (!pic) {
    const W = Math.max(1, Math.ceil(w * k)), H = Math.max(1, Math.ceil(h * k));
    const raw = document.createElement('canvas');
    raw.width = W; raw.height = H;
    const r = raw.getContext('2d');
    const cut = document.createElement('canvas');
    cut.width = W; cut.height = H;
    const p = cut.getContext('2d', { willReadFrequently: true });
    if (!r || !p) return false;
    drawBeastPortrait(r, W, H, species, line.kind, [css(wood), css(mix(wood, [90, 64, 70], 0.4))], 1);
    // Softened a hair first, so the coat's fleck does not come through as speckle.
    p.filter = `blur(${(CARVE_SOFT * k).toFixed(2)}px)`;
    p.drawImage(raw, 0, 0);
    p.filter = 'none';
    // Its light and shade alone, cut into the wood's three flat tones: the band each pixel falls in is by where it
    // stands among the figure's own lightnesses, so a dark coat carves as clear as a pale one.
    const img = p.getImageData(0, 0, W, H);
    const d = img.data;
    const lights: number[] = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) lights.push(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
    lights.sort((x, y) => x - y);
    const low = lights[Math.floor(lights.length * CARVE_BANDS[0])] ?? 0;
    const high = lights[Math.floor(lights.length * CARVE_BANDS[1])] ?? 255;
    const tones = [mix(wood, [90, 64, 70], 0.3), wood, mix(wood, [255, 244, 228], 0.35)];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 127) { d[i + 3] = 0; continue; }
      const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const tone = tones[l < low ? 0 : l < high ? 1 : 2];
      d[i] = tone[0]; d[i + 1] = tone[1]; d[i + 2] = tone[2]; d[i + 3] = 255;
    }
    p.putImageData(img, 0, 0);
    // Cut down to the figure, so it stands on the base whatever its pose (a flier's model hangs in the air).
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return false;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(W / cw, H / ch);
    pic = document.createElement('canvas');
    pic.width = W; pic.height = H;
    const q = pic.getContext('2d');
    if (!q) return false;
    q.imageSmoothingEnabled = false;
    q.drawImage(cut, x0, y0, cw, ch, Math.round((W - cw * s) / 2), Math.round(H - ch * s), Math.round(cw * s), Math.round(ch * s));
    if (carved.size > 128) carved.clear();
    carved.set(key, pic);
  }
  g.drawImage(pic, 0, 0, w, h);
  return true;
};
