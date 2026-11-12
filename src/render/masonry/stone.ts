import { COURSES, EDGE, TH, TW, blob, channels, clamp, hexA, mid, mixHex, poly, rand, roughen, shape, solid } from './draw';
import type { Kit } from './kit';
import type { Block, Ctx, Pt, Rand, Run, Tone } from './types';

/**
 * One unit of a wall: its tone, its outline and bevel, the grain of sandstone and the veins of
 * marble, the band's slabs, and the wear a storey's own stones take.
 */

/* The tones a block can take. Most are the pale stone; the rest are sand, a warm brown, a grey-green
 * and the dark grey, all at the reference's low saturation, each with its own lit, shade and bevel. */
/** Which tone the next block takes, off the stock's own mix. The mossy greens are rare, twice as
 *  common on the two lowest courses, where the wall is damp, and again under a crest, where it
 *  drips; the tones that came in by the load come singly or in pairs, and `run` carries a pair over. */
export function pickTone(kit: Kit, R: Rand, course: number, run: Run, underCrest: boolean, drift?: number): string {
  const { S } = kit;
  if (run.left > 0) { run.left--; return run.tone; }
  // Half the draw, where a drift is given, so the off tones arrive in the
  // patches a kiln load is laid in rather than one unit at a time.
  let t = drift === undefined ? R() : R() * 0.5 + drift * 0.5;
  const low = course >= COURSES - 2;
  let tone = '';
  for (const [name, share] of S.mix) {
    const p = name === 'green' ? share * (low ? 2.25 : 1) * (underCrest ? 2.5 : 1) : share;
    if (t < p) { tone = name; break; }
    t -= p;
  }
  if (S.pairs.includes(tone) && R() < 0.4) { run.tone = tone; run.left = 1; }
  return tone;
}

/** One block: a squarish oval with a wobbly edge, two tones, a line, and a hairline bevel; one in
 *  three has a corner pulled in where it was knocked, and `tilt` turns it a degree or two. */
/**
 * `ink` is the weight of the outline and `bevel` whether the block gets the
 * lit band along its top -- a coping seen from above is a run of stones a
 * few pixels deep, and a lit rim on every one of them turns the top of the
 * wall into a row of keycaps.
 */
export function stone(kit: Kit, g: Ctx, x: number, y: number, w: number, h: number, R: Rand, tone: string, cut: 'laid' | 'sawn' | 'unit' = 'laid', tilt?: number, ink = 2.4, bevel = true): Pt[] {
  const { S, TONES, PASTEL } = kit;
  const cx = x + w / 2, cy = y + h / 2;
  const laid = cut === 'laid';
  /*
   * A unit off a mould has corners, and at twenty-five pixels deep the
   * fourteen points a block is drawn with put the nearest one twenty-five
   * degrees off each corner -- so the curve through their midpoints cut a
   * quarter of the depth off it and every brick came out a sweet. Twenty
   * points at a squarer profile puts one within nine degrees of the corner,
   * which is a brick with the arris still on it and a hand's wobble along
   * the edges.
   */
  const pn = cut === 'unit' ? 20 : 14;
  // Marble is cut to a sharp arris: its outline is its corners, drawn
  // straight between them with a hand's wobble along the edges.
  const sharp = !!S.slab && cut === 'unit';
  // Sandstone's arrises go soft with the weather, and its edges wander more.
  const pts = sharp ? roughen([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], R, 3, 0.4) : cut === 'unit' ? blob(cx, cy, w / 2, h / 2, pn, R, S.grain ? 0.24 : S.master ? 0.11 : 0.15, 0.1, S.grain ? 0.03 : S.master ? 0.009 : 0.018)
    : blob(cx, cy, w / 2, h / 2, pn, R, laid ? 0.28 : 0.26, laid ? 0.28 : 0.16, laid ? 0.05 : 0.025);
  if (laid && R() < 0.3) { const k = Math.floor(R() * pts.length); pts[k] = [pts[k][0] * 0.85 + cx * 0.15, pts[k][1] * 0.85 + cy * 0.15]; }
  if (tilt) { const c = Math.cos(tilt), s = Math.sin(tilt); for (const p of pts) { const px = p[0] - cx, py = p[1] - cy; p[0] = cx + px * c - py * s; p[1] = cy + px * s + py * c; } }
  const T = TONES[tone] || TONES[''];
  // How far the lit face sits up and left of the shade, which is how deep
  // the crescent of shade along the lower right is. A moulded unit is
  // shallow relief: at a tenth of its width it was a dark rim on every
  // brick in the wall, heavier than the joint beside it.
  const [ox, oy] = cut === 'unit' ? [-w * 0.035, -h * 0.1] : [-w * 0.1, -h * 0.14];
  const outline = (): void => { if (sharp) { g.beginPath(); poly(g, pts); } else shape(g, pts); };
  if (sharp) {
    outline(); g.fillStyle = T.shade; g.fill();
    g.save(); outline(); g.clip(); g.beginPath(); poly(g, pts, ox, oy); g.fillStyle = T.lit; g.fill(); g.restore();
    outline(); g.strokeStyle = PASTEL.line; g.lineWidth = ink; g.lineJoin = 'round'; g.stroke();
  } else solid(g, pts, T.lit, T.shade, PASTEL.line, ink, ox, oy);
  if (S.grain) grainOf(kit, g, pts, x, y, w, h, R, T, tone);
  if (S.slab) veinOf(kit, g, outline, x, y, w, h, R, T);
  // the bevel: the block's own outline, shifted a little down and right and clipped to the block,
  // shows as a light band along the top and the upper left, where the light lands
  if (!bevel) return pts;
  g.save(); outline(); g.clip();
  g.beginPath(); g.rect(x - 4, y - 4, w + 8, h * 0.6); g.clip();
  g.globalAlpha = 0.45;
  g.translate(1.5, 2); outline(); g.strokeStyle = T.hi; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
  g.restore();
  return pts;
}

/* ---- what time does to a wall ------------------------------------------------ */
/** A corner knocked off: the mortar shows through a bite at one corner, the stone's line round it. */
export function chipCorner(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { S, PASTEL } = kit;
  const cx = s.x + (R() < 0.5 ? 0 : s.w), cy = s.y + (R() < 0.5 ? 0 : s.h), r = Math.min(s.w, s.h) * (0.16 + 0.12 * R());
  const pts = blob(cx, cy, r, r * 0.8, 8, R, 0.85, 0.3, 0.2);
  g.save();
  if (S.slab) { g.beginPath(); poly(g, s.pts); } else shape(g, s.pts);
  g.clip();
  shape(g, pts); g.fillStyle = PASTEL.joint; g.fill(); g.strokeStyle = PASTEL.line; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  g.restore();
}

/** A crack: two to three pixels wide with a kink, from one edge part way across the stone, and one
 *  in five right across it; a pale lip along its lower side where the broken edge catches the light. */
export function crack(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  const fromLeft = R() < 0.5, through = R() < 0.22, x0 = fromLeft ? s.x + 2 : s.x + s.w - 2, y0 = s.y + s.h * (0.25 + 0.5 * R()), dir = fromLeft ? 1 : -1;
  const len = s.w * (through ? 1 : 0.3 + 0.35 * R()), n = through ? 4 : 3, pts: Pt[] = [[x0, y0]];
  // it wanders, but never doubles back: each step drifts a little from the last, the same way more often than not
  let dy = (R() - 0.5) * s.h * 0.2;
  for (let i = 1; i <= n; i++) { dy = dy * 0.4 + (R() - 0.5) * s.h * (through ? 0.16 : 0.24); pts.push([x0 + dir * len * i / n, pts[i - 1][1] + dy]); }
  g.save(); shape(g, s.pts); g.clip();
  g.strokeStyle = hexA('#ffffff', 0.3); g.lineWidth = 1.2; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1] + 2); for (let i = 1; i <= n; i++) g.lineTo(pts[i][0], pts[i][1] + 2); g.stroke();
  g.strokeStyle = PASTEL.line;
  for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.lineWidth = through ? 2.4 : 2.8 - i * 0.6; g.stroke(); }
  g.restore();
}

/** A flake of the face gone along one edge: a jagged region a shade darker, lined. */
export function spall(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  const top = R() < 0.5, x = s.x + s.w * (0.2 + 0.6 * R()), y = top ? s.y : s.y + s.h, rw = s.w * (0.15 + 0.2 * R()), rh = s.h * (0.2 + 0.2 * R());
  const pts = blob(x, y, rw, rh, 9, R, 0.7, 0.45, 0.35);
  g.save(); shape(g, s.pts); g.clip();
  shape(g, pts); g.fillStyle = hexA(PASTEL.line, 0.28); g.fill(); g.strokeStyle = PASTEL.line; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
  g.restore();
}

/** Abrasion: a patch of the face worn rough, paler and scratched. */
export function abrade(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  const x = s.x + s.w * (0.25 + 0.5 * R()), y = s.y + s.h * (0.3 + 0.4 * R()), rw = s.w * (0.18 + 0.2 * R()), rh = s.h * (0.2 + 0.25 * R());
  const pts = blob(x, y, rw, rh, 12, R, 0.85, 0.5, 0.4);
  g.save(); shape(g, s.pts); g.clip();
  shape(g, pts); g.fillStyle = hexA('#ffffff', 0.22); g.fill();
  g.strokeStyle = hexA(PASTEL.line, 0.4); g.lineWidth = 1; g.lineCap = 'round';
  for (let k = 0; k < 2 + Math.floor(R() * 3); k++) { const sx = x + (R() - 0.5) * rw * 1.6, sy = y + (R() - 0.5) * rh * 1.4, a = (R() - 0.5) * 0.6, l = 4 + 8 * R(); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); g.stroke(); }
  g.restore();
}

/** Mortar squeezed out of a joint and left there: a lump of the joint tone over the stone's edge. */
export function slop(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  const top = R() < 0.5, x = s.x + s.w * (0.15 + 0.7 * R()), y = top ? s.y + 1 : s.y + s.h - 1, rw = 5 + 7 * R(), rh = 3 + 3 * R();
  const pts = blob(x, y, rw, rh, 8, R, 0.9, 0.3, 0.2);
  shape(g, pts); g.fillStyle = PASTEL.joint; g.fill(); g.strokeStyle = hexA(PASTEL.line, 0.6); g.lineWidth = 1.2; g.lineJoin = 'round'; g.stroke();
}

/** A stone sunk a little deeper than its neighbours: darker, with shade along its upper and left edges. */
export function recessed(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  g.save(); shape(g, s.pts); g.clip();
  g.fillStyle = hexA(PASTEL.line, 0.16); g.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
  g.fillStyle = hexA(PASTEL.line, 0.28); g.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h * 0.22); g.fillRect(s.x - 2, s.y - 2, s.w * 0.12, s.h + 4);
  g.restore();
}

/** A stone gone: its pocket in the darker mortar, a shadow under its upper edge, and rubble left in it. */
function missing(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  g.save(); shape(g, s.pts); g.clip();
  g.fillStyle = '#9b9789'; g.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
  g.fillStyle = hexA(PASTEL.line, 0.28); g.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h * 0.3);
  for (let k = 0; k < 2 + Math.floor(R() * 2); k++) {
    const rw = s.w * (0.18 + 0.15 * R()), rh = s.h * (0.16 + 0.12 * R()), rx = s.x + s.w * (0.15 + 0.6 * R()), ry = s.y + s.h - rh * (0.4 + 0.3 * R());
    solid(g, blob(rx, ry, rw / 2, rh / 2, 8, R, 0.6, 0.3, 0.1), PASTEL.stoneShade, PASTEL.stoneDark, PASTEL.line, 1.8, -rw * 0.1, -rh * 0.15);
  }
  g.restore();
  shape(g, s.pts); g.strokeStyle = PASTEL.line; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke();
}

/** A pit or two in the face of a stone. */
export function pits(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  for (let k = 0; k < 1 + Math.floor(R() * 2); k++) {
    const x = s.x + s.w * (0.15 + 0.7 * R()), y = s.y + s.h * (0.2 + 0.6 * R()), r = 2 + 1.5 * R();
    g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, 7); g.fillStyle = hexA(PASTEL.line, 0.55); g.fill();
    g.beginPath(); g.ellipse(x + 0.5, y + 1.2, r, r * 0.6, 0, 0, Math.PI); g.strokeStyle = hexA('#ffffff', 0.35); g.lineWidth = 1; g.stroke();
  }
}

/** A water stain running down from the joint above a stone, over it and onto the one below. */
function stain(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { MORTAR } = kit;
  const w = 6 + 10 * R(), x = s.x + s.w * (0.2 + 0.6 * R()), y0 = s.y - MORTAR, len = s.h * (0.7 + 0.7 * R());
  g.save(); g.beginPath(); g.rect(EDGE, 0, TW - 2 * EDGE, TH - 3); g.clip();
  for (const [ww, a] of [[w, 0.07], [w * 0.5, 0.06]]) {
    g.beginPath(); g.moveTo(x - ww / 2, y0); g.lineTo(x + ww / 2, y0); g.lineTo(x + ww * 0.3, y0 + len); g.lineTo(x - ww * 0.3, y0 + len); g.closePath();
    g.fillStyle = hexA('#5f5644', a); g.fill();
  }
  g.restore();
}

/**
 * The beds a block of sandstone was laid down in: two to four laminae
 * across it, each a hair lighter or darker than the block and gently
 * waved; in one block in five a set of them at a slant under a bedding
 * plane, where the sand came in on a current; and in an iron-rich block,
 * two or three bands of the iron curving through it.
 */
function grainOf(kit: Kit, g: Ctx, pts: Pt[], x: number, y: number, w: number, h: number, R: Rand, T: Tone, tone: string): void {
  const { PASTEL } = kit;
  if (w < 16 || h < 10) return;
  g.save(); shape(g, pts); g.clip();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const cross = w > 70 && h > 34 && R() < 0.2, split = y + h * (0.3 + R() * 0.3);
  const n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const ly = y + h * ((i + 0.3 + R() * 0.4) / n);
    if (cross && ly > split) continue;
    const amp = 0.6 + R() * 1.2, ph = R() * 6, f = 0.6 + R() * 0.4;
    g.beginPath();
    for (let k = 0; k <= 8; k++) g.lineTo(x - 2 + ((w + 4) * k) / 8, ly + Math.sin(ph + (k / 8) * Math.PI * 2 * f) * amp);
    g.strokeStyle = hexA(i % 2 ? T.shade : T.hi, i % 2 ? 0.55 : 0.6); g.lineWidth = 1.2 + R() * 1.2; g.stroke();
  }
  if (cross) {
    // the foresets, down a slant under the plane that cut them off
    const dir = R() < 0.5 ? 1 : -1, slope = Math.tan(0.28 + R() * 0.2), gap = 9 + R() * 4, hh = y + h - split;
    g.save(); g.beginPath(); g.rect(x - 2, split, w + 4, hh + 2); g.clip();
    g.strokeStyle = hexA(T.shade, 0.5); g.lineWidth = 1.2;
    for (let t = -hh / slope; t < w + hh / slope; t += gap) {
      g.beginPath(); g.moveTo(x + t, split); g.quadraticCurveTo(x + t + dir * (hh / slope) * 0.55, split + hh * 0.55, x + t + dir * (hh / slope) * 1.2, y + h + 2); g.stroke();
    }
    g.restore();
    g.beginPath(); g.moveTo(x - 2, split); g.lineTo(x + w + 2, split + (R() - 0.5) * 3); g.strokeStyle = hexA(T.shade, 0.75); g.lineWidth = 1.5; g.stroke();
  }
  if (tone === 'brown') {
    // the iron: rings of it from a centre off the block, so they cross it as curved bands
    const below = R() < 0.5, cx = x + w * (0.1 + R() * 0.8), cy = below ? y + h * (1.6 + R() * 1.4) : y - h * (0.6 + R() * 1.4);
    let r = Math.abs(cy - (below ? y + h : y)) + h * (0.12 + R() * 0.2);
    for (let k = 0, m = 2 + Math.floor(R() * 2); k < m; k++) {
      const t = 3 + R() * 4;
      g.beginPath(); g.ellipse(cx, cy, r * 1.7, r, 0, 0, Math.PI * 2); g.lineWidth = t; g.strokeStyle = hexA(PASTEL.iron, 0.8); g.stroke();
      g.beginPath(); g.ellipse(cx, cy, r * 1.7 + (below ? -t / 2 : t / 2), r + (below ? -t / 2 : t / 2), 0, 0, Math.PI * 2); g.lineWidth = 1.4; g.strokeStyle = hexA(PASTEL.ironDark, 0.75); g.stroke();
      r += t + 4 + R() * 8;
    }
  }
  g.restore();
}

/* ---- marble's veins ---------------------------------------------------- */
/*
 * A vein in marble is not a curve. It crinkles -- a thread that jinks
 * every few pixels about a heading that itself wanders slowly off the slant
 * of the bed -- and it is fine: grey, with the grey bled into the stone
 * either side of it, split in two for a stretch and come back, throwing
 * off lesser threads that run into the next vein, so the veins of a slab
 * make a web rather than a set of strokes; and a hairline of pale gold goes
 * its own way across the lot. Drawn as smooth curves a slab of it was
 * cracked chalk.
 */
/** A vein's course: from (x, y) heading `a`, `step` pixels at a time for `len`, crinkled. */
export function crinkle(x: number, y: number, a: number, len: number, R: Rand, step = 5, jink = 0.9): Pt[] {
  const out: Pt[] = [[x, y]];
  let head = a;
  for (let d = 0; d < len; d += step) {
    head = a + clamp(head - a + (R() - 0.5) * 0.3, -0.8, 0.8);
    const t = head + (R() - 0.5) * jink;
    x += Math.cos(t) * step; y += Math.sin(t) * step;
    out.push([x, y]);
  }
  return out;
}

/** The open polyline through `pts`, as a fresh path. */
export function run(g: Ctx, pts: Pt[]): void {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
}

/** An open curve through the midpoints of `pts`, from the first point to the last. */
function smooth(g: Ctx, pts: Pt[]): void {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]);
}

/** A thread of vein along `pts` in `col`, about `wd` wide, swelling and thinning as it goes. */
export function wire(g: Ctx, pts: Pt[], col: string, wd: number, R: Rand): void {
  const ph = R() * 6, f = 0.08 + R() * 0.1;
  g.strokeStyle = col; g.lineCap = 'round';
  for (let i = 0; i + 1 < pts.length; i++) {
    g.lineWidth = Math.max(0.55, wd * (0.7 + 0.45 * Math.sin(i * f + ph)));
    g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
  }
  g.lineCap = 'butt';
}

/** The grey a vein bleeds into the stone either side of it, `wd` across: two soft passes along its course, smoothed. */
export function bleed(g: Ctx, pts: Pt[], col: string, wd: number): void {
  const s = pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1);
  if (s.length < 2) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = hexA(col, 0.13); g.lineWidth = wd; smooth(g, s); g.stroke();
  g.strokeStyle = hexA(col, 0.17); g.lineWidth = wd * 0.45; smooth(g, s); g.stroke();
  g.lineCap = 'butt';
}

/**
 * The veins of one block of marble, inside whatever `clip` outlines: a
 * crinkled thread across it at a slant, soft-edged and wide enough to hold
 * at the zoom the game is played at, with its grey bled either side; on a
 * big block a lesser thread or two off it; and on the white one block in
 * four with a hairline of gold. On the dove grey the same, a step darker
 * than the stone it is in.
 */
export function veinOf(kit: Kit, g: Ctx, clip: () => void, x: number, y: number, w: number, h: number, R: Rand, T: Tone): void {
  const { PASTEL } = kit;
  if (w < 12 || h < 8) return;
  g.save(); clip(); g.clip();
  const pale = channels(T.lit)[0] > 215;
  const edge = pale ? PASTEL.veinEdge : mixHex(T.lit, PASTEL.veinDark, 0.16);
  const core = pale ? PASTEL.vein : mixHex(T.lit, PASTEL.veinDark, 0.28);
  const lesser = pale ? PASTEL.veinFaint : mixHex(T.lit, PASTEL.veinDark, 0.12);
  const a = (R() < 0.5 ? 1 : -1) * (0.2 + R() * 0.5);
  const p = crinkle(x - 8, y + R() * h - Math.tan(a) * w * 0.5, a, (w + 16) / Math.cos(a), R, 6, 0.8);
  bleed(g, p, pale ? PASTEL.veinSoft : edge, 14 + R() * 6);
  g.lineJoin = 'round';
  for (let k = 0, m = w > 60 ? Math.floor(R() * 2.5) : R() < 0.4 ? 1 : 0; k < m; k++) {
    const [bx, by] = p[Math.floor(R() * p.length)];
    wire(g, crinkle(bx, by, a + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.35), 16 + R() * 34, R, 6, 0.8), lesser, 4.5, R);
  }
  wire(g, p, edge, 6, R);
  wire(g, p, core, 3.4, R);
  if (pale && R() < 0.25) {
    const b = (R() - 0.5) * 1.2;
    g.strokeStyle = PASTEL.veinGold; g.lineWidth = 3; g.lineCap = 'round';
    run(g, crinkle(x - 8, y + R() * h - Math.tan(b) * w * 0.5, b, (w + 16) / Math.cos(b), R, 6, 0.9)); g.stroke();
    g.lineCap = 'butt';
  }
  g.restore();
}

/**
 * Honeycomb: where salt has worked into a damp block, a patch of it
 * hollowed into cells packed close, so that what is left of the face is a
 * lattice of thin walls between them. Each cell is a pocket in the violet
 * of the shade, with a lit lip along its lower edge where the hollow turns
 * up at the light; the patch is a step darker than the block round it. A
 * scatter of loose pits read as shot.
 */
function honeycomb(kit: Kit, g: Ctx, s: Block, R: Rand): void {
  const { PASTEL } = kit;
  const cx = s.x + s.w * (0.22 + 0.56 * R()), cy = s.y + s.h * (0.42 + 0.3 * R());
  const rw = Math.min(s.w * 0.32, 18 + R() * 20), rh = Math.min(s.h * 0.36, 10 + R() * 9);
  const edge = blob(cx, cy, rw, rh, 12, R, 0.85, 0.45, 0.3);
  g.save(); shape(g, s.pts); g.clip();
  shape(g, edge); g.fillStyle = hexA(PASTEL.pit, 0.22); g.fill(); g.clip();
  const r = 2.6 + R() * 1.4, dx = r * 2.5, dy = r * 1.75;
  for (let j = 0, y = cy - rh; y <= cy + rh + dy; j++, y += dy) {
    for (let x = cx - rw - (j % 2) * dx * 0.5; x <= cx + rw + dx; x += dx) {
      const px = x + (R() - 0.5) * r * 0.6, py = y + (R() - 0.5) * r * 0.5, rr = r * (0.8 + R() * 0.4);
      g.beginPath(); g.ellipse(px, py, rr * 1.3, rr, 0, 0, Math.PI * 2); g.fillStyle = hexA(PASTEL.pit, 0.72); g.fill();
      g.beginPath(); g.ellipse(px, py + 0.7, rr * 1.3, rr, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.strokeStyle = hexA(PASTEL.stoneHi, 0.8); g.lineWidth = 1.1; g.stroke();
    }
  }
  g.restore();
}

/**
 * How time takes sandstone, on the private blocks only: by the grain, not
 * the arris. Honeycomb in two damp blocks in five -- the lowest course, and
 * the drip under the band -- and one in twelve elsewhere; a skin scaled
 * off one in eight; a block sunk back one in thirty; a worn patch on one in
 * six; and a wash from the joint above one in eight.
 */
function sandWeather(kit: Kit, g: Ctx, own: Block[], R: Rand): void {
  for (const s of own) {
    const damp = s.course >= COURSES - 1 || s.course === 0;
    if (R() < (damp ? 0.4 : 0.08)) honeycomb(kit, g, s, R);
    else { const t = R(); if (t < 0.12) spall(kit, g, s, R); else if (t < 0.155) recessed(kit, g, s, R); }
    if (R() < 0.16) abrade(kit, g, s, R);
    if (R() < 0.12 && s.course < COURSES - 1) stain(kit, g, s, R);
  }
}

/**
 * How time takes a wall a master laid, which is hardly at all: an arris
 * knocked on one unit in thirty and a hairline crack along the bed of one
 * in a hundred -- no pits, no worn patches and no mortar left on the face.
 * On slate's dark brick every one of those was a pale fleck, and a
 * scatter of pale flecks over a dark wall is grit on the picture.
 */
export function masterWeather(kit: Kit, g: Ctx, own: Block[], R: Rand): void {
  const { S } = kit;
  for (const s of own) {
    const t = R();
    // A marble garden wall's blocks have the odd corner knocked, and it is
    // what keeps a run of them from being ruled.
    if (t < (S.slab ? 0.2 : 0.03)) chipCorner(kit, g, s, R);
    else if (t < 0.04) crack(kit, g, s, R);
  }
}

/** Wear, on the private stones only, so the seams and the storey line keep their contract. Masonry is
 *  a novice's masonry, and it shows: a chipped corner on one block in five, a crack on one in six, a
 *  flaked edge on one in fourteen, a block sunk deeper on one in twenty and gone on one in fifty;
 *  and over those, an abraded patch on one in five, pits on one in four, mortar squeezed out of one
 *  joint in seven, a water stain under one in seven. */
export function weather(kit: Kit, g: Ctx, own: Block[], R: Rand): void {
  const { S } = kit;
  if (S.grain) { sandWeather(kit, g, own, R); return; }
  if (S.master) { masterWeather(kit, g, own, R); return; }
  const k = S.wear;
  for (const s of own) {
    const t = R();
    if (t < 0.18 * k) chipCorner(kit, g, s, R);
    else if (t < 0.34 * k) crack(kit, g, s, R);
    else if (t < 0.41 * k) spall(kit, g, s, R);
    else if (t < 0.46 * k) recessed(kit, g, s, R);
    else if (t < 0.48 * k) missing(kit, g, s, R);
    if (R() < 0.22 * k) abrade(kit, g, s, R);
    if (R() < 0.25 * k) pits(kit, g, s, R);
    if (R() < 0.15 * k) slop(kit, g, s, R);
    if (R() < 0.14 * k && s.course < COURSES - 1) stain(kit, g, s, R);
  }
}

/** Four flat slabs across a row, set half a slab over so the seam falls in the middle of one; that
 *  slab is drawn twice, half either side, from its own seed, so it is the same in every variant. */
export function slabs(kit: Kit, g: Ctx, y: number, h: number, R: Rand, tone = 'flat'): void {
  const { S, MORTAR } = kit;
  const n = S.bandN, w = TW / n;
  // A slab of a rubble wall was picked over; a band course on brickwork was
  // cut to a line, and at this size a rounded corner on it reads as a sweet.
  const cut: 'sawn' | 'unit' = S.lay === 'bond' ? 'unit' : 'sawn';
  if (S.lay === 'bond') {
    // Cut to what the quarry gave, a quarter either way, so the band is a
    // course of stones rather than one stone printed six times.
    const ws: number[] = []; let sum = 0;
    for (let k = 0; k < n - 1; k++) { const v = S.master ? 0.9 + R() * 0.2 : 0.75 + R() * 0.5; ws.push(v); sum += v; }
    let x = w / 2;
    for (const v of ws) {
      const bw = (v / sum) * (TW - w);
      // And no two the same depth either: the arris along the top is the
      // line the course was laid to, and the bottom is where each stone
      // happened to stop, three or four pixels up or down.
      const bh = h - MORTAR - R() * (S.master ? 1 : 5);
      const t = R();
      const pts = stone(kit, g, x + MORTAR, y + MORTAR / 2, bw - 2 * MORTAR, bh, R, tone === 'flat' && t < (S.master ? 0.1 : 0.25) ? 'plinth' : tone, cut);
      if (R() < (S.master ? 0.04 : 0.22)) chipCorner(kit, g, { x: x + MORTAR, y: y + MORTAR / 2, w: bw - 2 * MORTAR, h: bh, course: 0, pts }, R);
      x += bw;
    }
  } else for (let k = 0; k < n - 1; k++) stone(kit, g, k * w + w / 2 + MORTAR, y + MORTAR / 2, w - 2 * MORTAR, h - MORTAR, R, tone, cut);
  for (const x of [TW - w / 2, -w / 2]) stone(kit, g, x + MORTAR, y + MORTAR / 2, w - 2 * MORTAR, h - MORTAR, rand(98), tone, cut);
}
