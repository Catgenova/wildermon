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

/**
 * A kind drawn as a carving: its model as a portrait, every pixel of it taken
 * to the wood's grain -- the light and shade of the model kept, its colours
 * gone -- and set in the box. False while its model is on its way.
 */
carving.draw = (g, index, w, h, wood: RGB) => {
  const species = FIGURE_KINDS()[index];
  const k = species ? wildermonKind(species) : null;
  if (!species || !k) return false;
  const key = `${species}|${Math.round(w)}|${Math.round(h)}|${wood.map(Math.round).join(',')}`;
  let pic = carved.get(key);
  if (!pic) {
    const W = Math.max(1, Math.ceil(w)), H = Math.max(1, Math.ceil(h));
    const raw = document.createElement('canvas');
    raw.width = W; raw.height = H;
    const r = raw.getContext('2d');
    pic = document.createElement('canvas');
    pic.width = W; pic.height = H;
    const p = pic.getContext('2d');
    if (!r || !p) return false;
    drawBeastPortrait(r, W, H, species, k.kind, [css(wood), css(mix(wood, [90, 64, 70], 0.4))], 1);
    // Its light and shade alone, in the wood's colour: grey, then the wood laid over it, then cut to its shape.
    p.filter = 'grayscale(1) contrast(0.9) brightness(1.15)';
    p.drawImage(raw, 0, 0);
    p.filter = 'none';
    p.globalCompositeOperation = 'multiply';
    p.fillStyle = css(mix(wood, [255, 236, 214], 0.15));
    p.fillRect(0, 0, W, H);
    p.globalCompositeOperation = 'destination-in';
    p.drawImage(raw, 0, 0);
    p.globalCompositeOperation = 'source-over';
    if (carved.size > 128) carved.clear();
    carved.set(key, pic);
  }
  g.drawImage(pic, 0, 0, w, h);
  return true;
};
