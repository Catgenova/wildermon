import { MATERIAL_BY_ID } from '../../../game/building';
import { rand } from '../../ivy';
import { grain } from '../core';
import { css, hex, mix } from '../core';
import { ashlarPaint, boardPaint, byRole, keyRune, pastel, runeLine, settPaint, voussoirPaint, type BridgePainter, type BridgeStyle } from './core';

/**
 * The two families' first looks, which every material starts from and
 * changes what it would (`<material>.ts`): stone in the marble's manner and
 * timber in the plank's, coloured off the material's own colours
 * (`MaterialDef.color`, `trim`, `floor`) taken into the island's pastels.
 */

/** The grain of a board or a post along a face. */
export const grainPaint: BridgePainter = (g, k, f) => grain(g, k.fill, Math.abs(f.x1 - f.x0) + 1, Math.abs(f.y1 - f.y0), f.seed, 'x', 0.8);

/** Rubble: stones of every size, roughly coursed. */
export const rubblePaint: BridgePainter = (g, k, f) => {
  const T = rand(f.seed * 11 + 5);
  const dark = css(mix(k.fill, hex('#5a4e5e'), 0.4), 0.7);
  g.strokeStyle = dark;
  g.lineWidth = 0.16;
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1);
  for (let y = Math.floor(f.y0 / 2.4) * 2.4; y < f.y1 + 2.4; y += 2.4) {
    let x = x0 - T() * 3;
    while (x < x1) {
      const w = 2 + T() * 3.2, h = 1.6 + T() * 1.2;
      g.beginPath();
      g.ellipse(x + w / 2, y + h / 2 + (T() - 0.5) * 0.5, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (T() < 0.35) { g.fillStyle = css(mix(k.fill, [255, 250, 240], 0.1 + T() * 0.08), 0.7); g.fill(); }
      g.stroke();
      x += w + 0.2;
    }
  }
};

/** Plaster: smooth, a few soft patches where it has been made good. */
export const plasterPaint: BridgePainter = (g, k, f) => {
  const T = rand(f.seed * 3 + 9);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = css(mix(k.fill, T() < 0.5 ? [255, 250, 240] : hex('#8a6a70'), 0.07), 0.6);
    g.beginPath();
    g.ellipse(f.x0 + (f.x1 - f.x0) * T(), f.y0 + (f.y1 - f.y0) * T(), 2 + T() * 4, 1 + T() * 2, 0, 0, Math.PI * 2);
    g.fill();
  }
};

/** A stone bridge of material `id`: ashlar walls, voussoirs, setts, a rune in each keystone and a rune line along its copings. */
export function stoneBase(id: string, over: Partial<BridgeStyle> = {}): BridgeStyle {
  const m = MATERIAL_BY_ID.get(id)!;
  const rune = over.rune ?? 'diamondDot';
  return {
    family: 'stone',
    stone: pastel(m.color, 0.3, 0.45),
    ring: pastel(mix([...m.color] as [number, number, number], [255, 255, 255], 0.12), 0.35, 0.42),
    trim: pastel(m.trim.map((c, i) => (c + m.color[i] * 2) / 3), 0.3, 0.45),
    deck: pastel(m.floor, 0.25, 0.4),
    parapet: 'balustrade',
    rune,
    glow: '#bfe8ff',
    paint: byRole({
      wall: ashlarPaint(3, 7),
      pier: ashlarPaint(3, 6),
      parapet: ashlarPaint(2.5, 6),
      ring: voussoirPaint(2.6),
      key: keyRune(rune),
      cap: runeLine(rune),
      deck: settPaint(5, 4),
      tread: settPaint(5, 4),
    }),
    ...over,
  };
}

/** A timber bridge of material `id`: plank deck, beams and posts in the wood's colours, railed. */
export function timberBase(id: string, over: Partial<BridgeStyle> = {}): BridgeStyle {
  const m = MATERIAL_BY_ID.get(id)!;
  const rune = over.rune ?? 'kenaz';
  return {
    family: 'timber',
    stone: pastel(m.color, 0.2, 0.5),
    ring: pastel(m.trim, 0.25, 0.45),
    trim: pastel(m.trim, 0.25, 0.45),
    deck: pastel(m.floor, 0.22, 0.45),
    post: pastel(m.trim, 0.28, 0.45),
    rail: pastel(m.color, 0.3, 0.45),
    parapet: 'rail',
    rune,
    glow: '#ffd9a0',
    paint: byRole({
      deck: boardPaint(3.2),
      tread: boardPaint(3.2),
      beam: grainPaint,
      post: grainPaint,
      rail: grainPaint,
      cap: grainPaint,
    }),
    ...over,
  };
}
