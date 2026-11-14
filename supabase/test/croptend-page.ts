/**
 * The page `croptend.ts` opens: every crop's field tile baked (`fieldBake`) and
 * drawn flat (`cropFlatSprite`) at every stage, still to tend and tended, and
 * how far the two pictures are apart. Bundled for the browser by `croptend.ts`.
 */
import { CROP_LIST, RIPE } from '../../src/game/farming';
import { cropFrame, fieldBake, forgetFields, type CropBake } from '../../src/render/crops';
import { cropFlatSprite } from '../../src/render/sprites';
import { planterHolds, planterTrim } from '../../src/render/plantertrim';

/** A picture's pixels laid on a canvas of `w` by `h` with its anchor at the middle, so two of them line up. */
function pixels(p: { canvas: HTMLCanvasElement; ax: number; ay: number }, scale: number, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2d context');
  g.drawImage(p.canvas, Math.round(w / 2 - p.ax * scale), Math.round(h / 2 - p.ay * scale));
  return g.getImageData(0, 0, w, h).data;
}

/** The share of the pixels either picture covers that differ between them by more than a hair, anchored together. */
function apart(a: { canvas: HTMLCanvasElement; ax: number; ay: number }, b: { canvas: HTMLCanvasElement; ax: number; ay: number }, scale: number): number {
  const w = 2 * Math.ceil(Math.max(a.canvas.width, b.canvas.width) + 8), h = 2 * Math.ceil(Math.max(a.canvas.height, b.canvas.height) + 8);
  const pa = pixels(a, scale, w, h), pb = pixels(b, scale, w, h);
  let covered = 0, differ = 0;
  for (let i = 0; i < pa.length; i += 4) {
    if (!pa[i + 3] && !pb[i + 3]) continue;
    covered++;
    const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) + Math.abs(pa[i + 3] - pb[i + 3]);
    if (d > 24) differ++;
  }
  return covered ? differ / covered : 0;
}

export interface Pair { crop: string; stage: number; dormant: boolean; step: number; field: number; flat: number; same: boolean }

const SCALE = 2;

/** Each crop at each stage, in summer at midday, in a winter, and at night: how far tended is from still to tend. */
function pairs(): Pair[] {
  const out: Pair[] = [];
  for (const c of CROP_LIST) {
    const [leaf, fruit] = c.colors;
    for (let stage = 0; stage <= RIPE; stage++) {
      for (const [dormant, step] of [[false, 4], [true, 4], [false, -1]] as Array<[boolean, number]>) {
        forgetFields();
        cropFrame();
        const a: CropBake = fieldBake(c.id, stage, leaf, fruit, dormant, false, 0, step, SCALE, 1);
        cropFrame();
        const b: CropBake = fieldBake(c.id, stage, leaf, fruit, dormant, true, 0, step, SCALE, 1);
        const fa = cropFlatSprite(c.id, stage, c.look, leaf, fruit, dormant, false), fb = cropFlatSprite(c.id, stage, c.look, leaf, fruit, dormant, true);
        out.push({ crop: c.id, stage, dormant, step, field: apart(a, b, SCALE), flat: apart(fa, fb, SCALE), same: a === b && fa === fb });
      }
    }
  }
  return out;
}

/** A planter's trim and what it reads back: tended kept before ripe, dropped at ripe. */
function trims(): string[] {
  const wrong: string[] = [];
  const seen = new Set<number>();
  for (const c of CROP_LIST) for (let stage = 0; stage <= RIPE; stage++) for (const tended of [false, true]) {
    const t = planterTrim(c.id, stage, tended);
    const h = planterHolds(t);
    const want = tended && stage < RIPE;
    if (!h || h.crop.id !== c.id || h.stage !== stage || h.tended !== want) wrong.push(`${c.id} ${stage} ${tended}: ${t} reads ${JSON.stringify(h && { crop: h.crop.id, stage: h.stage, tended: h.tended })}`);
    if (stage === RIPE && tended && t !== planterTrim(c.id, stage, false)) wrong.push(`${c.id} ripe: tended is another trim`);
    if (!(stage === RIPE && tended)) {
      if (seen.has(t)) wrong.push(`${c.id} ${stage} ${tended}: trim ${t} taken twice`);
      seen.add(t);
    }
  }
  return wrong;
}

(window as unknown as { cropTend: unknown }).cropTend = { pairs, trims };
