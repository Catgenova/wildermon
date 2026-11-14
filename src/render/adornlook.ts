/**
 * How an adornment (`adorn.ts`) is drawn: the one number its bake is kept
 * under (`adornTrim`), off what the island keeps of it and the wall clock;
 * a plush's kind as a soft portrait of its model (`plushie`); the colour a
 * gem lamp glows (`GEM_CAST`, off the stones' own colours, `gemTone`).
 */
import type { PlacedFurniture } from '../game/furniture';
import type { Game } from '../game/game';
import {
  BUOY, CAULDRON_HEARTH, CHEESE_RACK, GAME_TABLE, GARDEN_OBELISK, GEM_LAMP, HERB_SPIRAL, IVY_PANEL, LILY_POND, PEDIGREE_BOARD, PELT_RUG, PLUSH,
} from '../game/adorndefs';
import { cheeseOn, GEM_CAST, liliesIn, panelGreenDays, PEA_NAMES, peaColour, peltColours, SPIRAL_HERBS, slotGrown } from '../game/adorn';
import { FIGURE_KINDS } from '../game/garden';
import { SPECIES } from '../game/creatures';
import { roseStage } from '../game/roses';
import { GREEN_DAYS, greenNow } from '../game/greening';
import { gemTone } from './figure';
import { drawBeastPortrait } from './beasts';
import { wildermonKind } from './wildermon';
import { css, hex, mix, type RGB } from './runestone';
import {
  boardTrim, CAULDRONS_LIT, GEM_GLOWS, gemLampTrim, obeliskTrim, panelTrim, peltTrim, plushie, plushTrim, pondTrim, rackTrim, SPIRAL_GREENS, spiralTrim, tableTrim,
} from './kit/adorn';

const ROSE_STAGES = ['bare', 'leafy', 'bud', 'flower'] as const;
const hexOf = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

// A gem's glow, as a light's cast: its colour taken a little toward white, so a dark stone still throws light.
GEM_CAST.of = (gem) => {
  const c = gemTone(gem);
  return c ? mix(c, [255, 250, 240], 0.3).map(Math.round).join(', ') : undefined;
};
// The herbs' greens, a spiral's slots drawn in (`CropDef.colors`).
SPIRAL_GREENS.of = SPIRAL_HERBS.map((c) => [hex(c.colors[0]), hex(c.colors[1])] as [RGB, RGB]);

/** An adornment's trim, or undefined for a piece that is none of them. */
export function adornTrim(f: PlacedFurniture, game: Game): number | undefined {
  const d = f.adorn;
  const now = game.wallNow();
  switch (f.kind) {
    case LILY_POND: return pondTrim(liliesIn(f));
    // On the clock ivy grows by, the woods' (`greenNow`), as its wall's.
    case IVY_PANEL: return panelTrim(f.setAt === undefined ? GREEN_DAYS : panelGreenDays(greenNow() - f.setAt), GREEN_DAYS);
    case GARDEN_OBELISK: {
      const r = roseStage(f.setAt, now, 'sweet_pea');
      return obeliskTrim(ROSE_STAGES.indexOf(r.stage), Math.max(0, PEA_NAMES.indexOf(peaColour(f, now))));
    }
    case HERB_SPIRAL: return spiralTrim((d?.herbs ?? []).map((h) => {
      const i = h ? SPIRAL_HERBS.findIndex((c) => c.id === h[0]) : -1;
      return h && i >= 0 ? [i, Math.min(3, Math.floor(slotGrown(SPIRAL_HERBS[i], h[1], now) * 3))] : null;
    }));
    case BUOY: return 0;
    case CAULDRON_HEARTH:
      if (f.lit && (f.fuel ?? 0) > 0) CAULDRONS_LIT.add(f.id); else CAULDRONS_LIT.delete(f.id);
      return 0;
    case CHEESE_RACK: return rackTrim(cheeseOn(f));
    case PELT_RUG: {
      const c = peltColours(f.material);
      return peltTrim(c?.[0], c?.[1]);
    }
    case PLUSH: {
      const kind = d?.plush;
      const i = kind ? FIGURE_KINDS().indexOf(kind) : -1;
      return plushTrim(i, i >= 0 && !!wildermonKind(kind as string));
    }
    case GAME_TABLE: return tableTrim(!!d?.round);
    case GEM_LAMP: {
      const c = gemTone(f.material);
      const cast = GEM_CAST.of(f.material);
      if (cast) GEM_GLOWS.set(f.id, cast); else GEM_GLOWS.delete(f.id);
      return gemLampTrim(c ? hexOf(c) : undefined);
    }
    case PEDIGREE_BOARD: return boardTrim(!!d?.tree);
    default: return undefined;
  }
}
/** The adornments drawn live (a buoy's light, a cauldron's fire, a gem's glow): what the renderer hands the air to, the piece's id its seed. */
export const ADORN_LIVE: readonly string[] = [BUOY, CAULDRON_HEARTH, GEM_LAMP];

/* ---- a plush ---------------------------------------------------------------------------- */

const sewn = new Map<string, HTMLCanvasElement>();
/** How far a plush's model is softened, in pixels at zoom one: felt, not fur. */
const PLUSH_SOFT = 0.2;
/** How far its colours go to cream: the pastel of cloth. */
const PLUSH_PASTEL = 0.14;
/** How many times its pixels it is drawn at, at the least, before it is laid down. */
const PLUSH_OVER = 4;
/** The thread it is outlined in. */
const PLUSH_INK: RGB = [96, 72, 84];

/**
 * A kind drawn as a plush: its model as a portrait in its own coat (or its
 * dye), softened and taken a little toward cream, ruled round in a thread of
 * ink as every piece is -- a toy of the kind. False while its model is on its
 * way.
 */
plushie.draw = (g, index, w, h, dye) => {
  const species = FIGURE_KINDS()[index];
  const line = species ? wildermonKind(species) : null;
  if (!species || !line) return false;
  // Drawn at four times the pixels it lands on at the least, and laid down smaller: a toy a few pixels across stays crisp.
  const m = g.getTransform();
  const k = Math.max(PLUSH_OVER, Math.hypot(m.a, m.b) * 2);
  const key = `${species}|${Math.round(w * k)}|${Math.round(h * k)}|${dye ? dye.map(Math.round).join(',') : '-'}`;
  let pic = sewn.get(key);
  if (!pic) {
    const W = Math.max(1, Math.ceil(w * k)), H = Math.max(1, Math.ceil(h * k));
    const raw = document.createElement('canvas');
    raw.width = W; raw.height = H;
    const r = raw.getContext('2d');
    const soft = document.createElement('canvas');
    soft.width = W; soft.height = H;
    const p = soft.getContext('2d', { willReadFrequently: true });
    if (!r || !p) return false;
    // In its kind's first coat (`SpeciesDef.variants`), or its dye.
    const coat = SPECIES[species]?.variants[0] ?? ['#c8b4a0', '#f0e4d4'];
    const colours: [string, string] = dye ? [css(dye), css(mix(dye, [255, 250, 240], 0.45))] : [coat[0], coat[1]];
    drawBeastPortrait(r, W, H, species, line.kind, colours, 1);
    p.filter = `blur(${(PLUSH_SOFT * k).toFixed(2)}px)`;
    p.drawImage(raw, 0, 0);
    p.filter = 'none';
    const img = p.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 110) { d[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) d[i + c] = d[i + c] + (250 - d[i + c]) * PLUSH_PASTEL;
      d[i + 3] = 255;
    }
    p.putImageData(img, 0, 0);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return false;
    const pad = Math.max(1, Math.round(k * 0.9));
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min((W - pad * 2) / cw, (H - pad) / ch);
    const ox = Math.round((W - cw * s) / 2), oy = Math.round(H - pad - ch * s);
    // Its outline: the figure in ink, nudged round, under the figure itself.
    const ink = document.createElement('canvas');
    ink.width = W; ink.height = H;
    const n = ink.getContext('2d');
    pic = document.createElement('canvas');
    pic.width = W; pic.height = H;
    const q = pic.getContext('2d');
    if (!q || !n) return false;
    n.drawImage(soft, x0, y0, cw, ch, ox, oy, Math.round(cw * s), Math.round(ch * s));
    n.globalCompositeOperation = 'source-in';
    n.fillStyle = css(PLUSH_INK);
    n.fillRect(0, 0, W, H);
    for (const [dx, dy] of [[-pad, 0], [pad, 0], [0, -pad], [0, pad]]) q.drawImage(ink, dx, dy);
    q.drawImage(soft, x0, y0, cw, ch, ox, oy, Math.round(cw * s), Math.round(ch * s));
    if (sewn.size > 64) sewn.clear();
    sewn.set(key, pic);
  }
  g.drawImage(pic, 0, 0, w, h);
  return true;
};
