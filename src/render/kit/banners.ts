import { deviceInk, DEVICES } from '../devices';
import { canvasOf, drawFaces, eyeOfView, lightOf, nearness, type Eye } from '../runestone';
import { room } from './hearthstone';
import {
  BRASS, clothTone, css, deeper, faceColour, grain, hex, IRON, KIT_INK, KIT_INK_W, lathe, mix, paler, proj, sheen, slab, woodTone,
  type Ctx, type Face, type KitAir, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type PaintCtx, type Pt, type RGB, type Side, type Tone, type V3,
} from './core';

/**
 * A banner (`banner`) and a flagpole (`flagpole`), one subtile each, in the
 * kit. The banner's staff stands on crossed feet with a brass finial over a
 * crossbar; the flagpole is a tall turned pole of the wood it was built of on
 * a two-step plinth, a brass collar at its foot and a brass ball at its head,
 * the halyard run down it to an iron cleat.
 *
 * Their cloth is not baked: it moves in the wind, so it is drawn each frame
 * over the bake (`live`, `wind`) as the wind has it -- the banner's
 * swallowtail swinging down the wind and rippling, the flag flying out from
 * the pole, straight in a gale and drooping in a calm -- in linen or the dye,
 * with the settlement's device on it where it stands on one. Seen from
 * behind, the staff or the pole is in front of the cloth, so the cloth is
 * drawn with their shape taken out of it and the bake shows through. The
 * model keeps room for it, so the piece is as tall and as wide to the
 * pointer as it is drawn.
 */

/* ---- where it stands, in units ------------------------------------------------------- */

/** The crossbar's height, and where the banner's cloth hangs from: under the bar, just in front of the staff; the staff's head. */
const BAR_Z = 22.4, BANNER_HEAD = BAR_Z - 0.3, BANNER_Y = 0.6, STAFF_TOP = 24.2;
/** A flag's head on its pole, how deep it is at the hoist and how long it flies; the pole's foot. */
const FLAG_TOP = 44, FLAG_HOIST = 10, FLAG_FLY = 17, POLE_FOOT = 3.2;
/** Cloth with no weather on it: what a piece being set down is drawn with. */
const STILL: KitAir = { x: 1, y: 0, force: 0, t: 0 };

/* ---- the cloth ------------------------------------------------------------------------- */

/** Where a piece's cloth is drawn: the eye, and the screen at zoom one from its floor contact. */
interface Sheet { e: Eye; NU: number; NV: number; at: (u: number, v: number) => V3 }

/** A sheet's points this frame, `NU` + 1 along it by `NV` + 1 down it; its outline on the screen; and whether it is behind the staff, which stands at the middle (on the whole, further from the eye). */
interface Grid { pts: V3[][]; edge: Pt[]; behind: boolean }
function gridOf({ e, NU, NV, at }: Sheet): Grid {
  const pts: V3[][] = [];
  let mx = 0, my = 0;
  for (let i = 0; i <= NU; i++) {
    const row: V3[] = [];
    for (let j = 0; j <= NV; j++) {
      const p = at(i / NU, j / NV);
      mx += p[0]; my += p[1];
      row.push(p);
    }
    pts.push(row);
  }
  const S = (v: V3): Pt => proj(e, v);
  const edge: Pt[] = [...pts.map((r) => S(r[0])), ...pts[NU].map(S), ...pts.slice().reverse().map((r) => S(r[NV])), ...pts[0].slice().reverse().map(S)];
  return { pts, edge, behind: mx * e.toward[0] + my * e.toward[1] < 0 };
}

/** A side of wood, its grain running up it. */
const upGrain = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'y', 0.6);

/**
 * A sheet of cloth as it is this frame, on `g` in pixels at zoom one from the
 * floor contact: its quads laid back to front, each lit by which way it
 * faces, the hems `bands` of it a step deeper, the device on it, ruled round
 * in the kit's ink.
 */
function drawSheet(g: Ctx, s: Sheet, grid: Grid, cloth: Tone, bands: Array<[number, number]>, dev: { k: number; u: number; v: number; su: number; sv: number } | null): void {
  const { e, NU, NV } = s;
  const { pts, edge } = grid;
  const S = (v: V3): Pt => proj(e, v);
  const hem = deeper(cloth, 0.28);
  const quads: Array<{ q: V3[]; L: number; d: number; band: boolean }> = [];
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const q = [pts[i][j], pts[i + 1][j], pts[i + 1][j + 1], pts[i][j + 1]];
      const e1 = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]], e2 = [q[3][0] - q[1][0], q[3][1] - q[1][1], q[3][2] - q[1][2]];
      let n: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n[0] * e.toward[0] + n[1] * e.toward[1] + n[2] * e.toward[2] < 0) n = [-n[0], -n[1], -n[2]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      const mid: V3 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2];
      const d = nearness(e, mid);
      const vm = (j + 0.5) / NV;
      quads.push({ q, L: lightOf(e, [n[0] / l, n[1] / l, n[2] / l]), d, band: bands.some(([a, b]) => vm >= a && vm <= b) });
    }
  }
  quads.sort((a, b) => a.d - b.d);
  const poly = (p: readonly Pt[]): void => {
    g.beginPath();
    p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  // The ink round it, twice as wide as it shows, the cloth laid over it; the cloth whole first, so no seam between its quads lets the ground through.
  g.lineJoin = 'round';
  poly(edge);
  g.strokeStyle = css(KIT_INK);
  g.lineWidth = KIT_INK_W * 2;
  g.stroke();
  g.fillStyle = css(faceColour(cloth, 0.9));
  g.fill();
  for (const { q, L, band } of quads) {
    const fill = faceColour(band ? hem : cloth, L);
    poly(q.map(S));
    g.fillStyle = css(fill);
    g.fill();
    g.strokeStyle = css(fill);
    g.lineWidth = 0.35;
    g.stroke();
  }
  if (dev) {
    const bil = (u: number, v: number): Pt => {
      const fu = Math.max(0, Math.min(NU - 1e-6, u * NU)), fv = Math.max(0, Math.min(NV - 1e-6, v * NV));
      const i = Math.floor(fu), j = Math.floor(fv), a = fu - i, b = fv - j;
      const p00 = pts[i][j], p10 = pts[i + 1][j], p01 = pts[i][j + 1], p11 = pts[i + 1][j + 1];
      const m = (k: number): number => (p00[k] * (1 - a) + p10[k] * a) * (1 - b) + (p01[k] * (1 - a) + p11[k] * a) * b;
      return S([m(0), m(1), m(2)]);
    };
    const ink = deviceInk(cloth.lit) as RGB;
    poly(DEVICES[dev.k].map(([x, y]) => bil(dev.u + x * dev.su, dev.v + y * dev.sv)));
    g.fillStyle = css(ink);
    g.fill();
    g.strokeStyle = css(mix(ink, [40, 30, 34], 0.5), 0.8);
    g.lineWidth = 0.35;
    g.stroke();
  }
}

/** A scratch canvas for cloth drawn behind a staff, kept from one frame to the next. */
let pad: [HTMLCanvasElement, Ctx] | null = null;

/**
 * Lay a piece's cloth on `ctx` at (sx, sy): drawn on the screen as it is, or
 * -- when it is behind the staff -- on a scratch canvas first,
 * with the staff's shape (`cover`, outlines in pixels at zoom one) taken out
 * of it, so the staff's bake shows through.
 */
function layCloth(ctx: Ctx, sx: number, sy: number, zoom: number, grid: Grid, draw: (g: Ctx) => void, cover: Pt[][]): void {
  if (!grid.behind) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(zoom, zoom);
    draw(ctx);
    ctx.restore();
    return;
  }
  // Drawn on the scratch canvas at the screen's own resolution.
  const m = ctx.getTransform();
  const res = Math.max(1e-3, Math.hypot(m.a, m.b)) * zoom;
  const edge = grid.edge;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of edge) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= 3; y0 -= 3; x1 += 3; y1 += 3;
  const w = Math.ceil((x1 - x0) * res), h = Math.ceil((y1 - y0) * res);
  if (!pad || pad[0].width < w || pad[0].height < h) pad = canvasOf(Math.max(w, pad?.[0].width ?? 0), Math.max(h, pad?.[0].height ?? 0));
  const [c, g] = pad;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w + 1, h + 1);
  g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  draw(g);
  // The staff's shape, and its ink round it, taken out.
  g.globalCompositeOperation = 'destination-out';
  g.lineJoin = 'round';
  g.lineWidth = KIT_INK_W * 2;
  for (const hull of cover) {
    g.beginPath();
    hull.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(zoom, zoom);
  ctx.drawImage(c, 0, 0, w, h, x0, y0, w / res, h / res);
  ctx.restore();
}

/** The outline on the screen of a box `x0`..`x1` by `y0`..`y1` from `z0` to `z1`: the hull of its corners. */
function hullOf(e: Eye, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Pt[] {
  const ps: Pt[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) ps.push(proj(e, [x, y, z]));
  ps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], hi: Pt[] = [];
  for (const p of ps) { while (lo.length >= 2 && turn(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of ps.slice().reverse()) { while (hi.length >= 2 && turn(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

/* ---- the banner -------------------------------------------------------------------------- */

function bannerOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const FOOT = deeper(WOOD, 0.12);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The crossed feet: one across, and the other in two either side of it.
  const feet = { corner: 0.08, bevel: 0.12 };
  add(slab(-2.6, 2.6, -0.5, 0.5, 0, 0.85, FOOT, { ...feet, paint: { front: (g, k, s) => grain(g, k.fill, s.w, s.h, 3, 'x', 0.5), back: (g, k, s) => grain(g, k.fill, s.w, s.h, 4, 'x', 0.5) } }), { edges: true });
  add(slab(-0.5, 0.5, -2.6, -0.5, 0, 0.85, FOOT, { ...feet, paint: { left: (g, k, s) => grain(g, k.fill, s.w, s.h, 5, 'x', 0.5), right: (g, k, s) => grain(g, k.fill, s.w, s.h, 6, 'x', 0.5) } }), { edges: true });
  add(slab(-0.5, 0.5, 0.5, 2.6, 0, 0.85, FOOT, { ...feet, paint: { left: (g, k, s) => grain(g, k.fill, s.w, s.h, 7, 'x', 0.5), right: (g, k, s) => grain(g, k.fill, s.w, s.h, 8, 'x', 0.5) } }), { edges: true });
  // The staff, its finial, and the crossbar the cloth hangs from.
  add(lathe(0, 0, [[0.85, 0.52], [STAFF_TOP, 0.44]], 8, WOOD, 0.5, (_k, i) => ({ paint: (g: Ctx, kk: PaintCtx) => grain(g, kk.fill, 0.6, STAFF_TOP, 20 + i, 'y', 0.4) })));
  add(lathe(0, 0, [[STAFF_TOP, 0.5], [24.7, 0.82], [25.4, 0.38], [25.8, 0.02]], 10, BRASS), { edges: true });
  add(slab(-4.6, 4.6, -0.32, 0.32, BAR_Z - 0.32, BAR_Z + 0.32, paler(WOOD, 0.05), { corner: 0.1, bevel: 0.1, paint: { front: (g, k, s) => grain(g, k.fill, s.w, s.h, 31, 'x', 0.5), back: (g, k, s) => grain(g, k.fill, s.w, s.h, 32, 'x', 0.5) } }), { edges: true });
  parts.push(room(-5.6, 5.6, -2.4, 6.4, 8.6, BANNER_HEAD + 0.5));
  return { parts, shade: [[-2.6, -2.6, 0], [2.6, -2.6, 0], [2.6, 2.6, 0], [-2.6, 2.6, 0]] };
}

/**
 * A banner's cloth, hung off the crossbar and cut in a swallowtail: in a calm
 * it hangs in its folds, and the wind swings its foot out down the wind -- a
 * hand's breadth in a light air and most of its own width in a gale -- and
 * sends ripples down it, quicker the harder it blows.
 */
function bannerCloth(ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, air: KitAir = STILL): void {
  const e = eyeOfView(view);
  const f = Math.max(0, Math.min(1, air.force));
  const wl = Math.hypot(air.x, air.y) || 1, wx = air.x / wl, wy = air.y / wl;
  const coarse = zoom < 0.6;
  const NU = coarse ? 3 : 7, NV = coarse ? 2 : zoom < 1.5 ? 4 : 6;
  const t = air.t;
  const at = (u: number, v: number): V3 => {
    const x0 = -4.2 + 8.4 * u;
    const foot = 9.6 + 2.8 * (1 - Math.abs(x0) / 4.2) + (BANNER_HEAD - 22.1);
    const z0 = BANNER_HEAD - (BANNER_HEAD - foot) * v;
    const fold = 0.35 * Math.sin(u * 12.6) * (1 - 0.3 * v);
    const swing = f * 4.8 * v ** 1.5 + 0.25 * v * Math.sin(t * 0.9 + u);
    const ripple = (0.2 + 0.9 * f) * v * Math.sin((u * 1.4 + v * 0.6) * Math.PI * 2 - t * (1.2 + 3.2 * f));
    return [x0 + wx * swing + 0.2 * ripple * wy, BANNER_Y + fold + wy * swing + ripple, z0 + swing * 0.18 * f];
  };
  const cloth = clothTone(air.tint);
  const dev = coarse || air.device === undefined ? null : { k: air.device, u: 0.5, v: 0.46, su: 0.18, sv: 0.21 };
  const sheet = { e, NU, NV, at }, grid = gridOf(sheet);
  layCloth(ctx, sx, sy, zoom, grid, (g) => drawSheet(g, sheet, grid, cloth, coarse ? [] : [[0.03, 0.13], [0.8, 0.92]], dev), [
    hullOf(e, -0.5, 0.5, -0.5, 0.5, 8.6, STAFF_TOP),
    hullOf(e, -0.82, 0.82, -0.82, 0.82, STAFF_TOP, 25.8),
    hullOf(e, -4.6, 4.6, -0.32, 0.32, BAR_Z - 0.32, BAR_Z + 0.32),
  ]);
}

/* ---- the flagpole ------------------------------------------------------------------------- */

function flagpoleOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const sides = (seed: number) => ({ front: upGrain(seed), back: upGrain(seed + 1), left: upGrain(seed + 2), right: upGrain(seed + 3) });
  // Its plinth in two steps, of the wood, and the brass collar at the pole's foot.
  add(slab(-2.3, 2.3, -2.3, 2.3, 0, 1.3, deeper(WOOD, 0.15), { corner: 0.25, bevel: 0.25, paint: sides(1) }), { edges: true });
  add(slab(-1.35, 1.35, -1.35, 1.35, 1.3, 2.5, WOOD, { corner: 0.2, bevel: 0.2, paint: sides(5) }), { edges: true });
  add(lathe(0, 0, [[2.5, 0.8], [2.85, 0.84], [POLE_FOOT, 0.7]], 10, BRASS), { edges: true });
  // The pole, drawn in toward its head, and the ball on it.
  const pole = add(lathe(0, 0, [[POLE_FOOT, 0.56], [FLAG_TOP + 1.2, 0.36]], 8, WOOD, 0.5, (_k, i) => ({ paint: (g: Ctx, kk: PaintCtx) => grain(g, kk.fill, 0.6, FLAG_TOP, 40 + i, 'y', 0.3) })));
  add(lathe(0, 0, [[FLAG_TOP + 1.2, 0.34], [FLAG_TOP + 1.6, 0.8], [FLAG_TOP + 2.3, 0.64], [FLAG_TOP + 2.7, 0.02]], 10, BRASS), { edges: true });
  /*
   * The cleat the halyard is made fast to, and the halyard up the pole from
   * it, on the pole's front right: laid after the pole when that side is
   * toward the eye, and before everything when it is turned away, as the
   * pole's whole length would otherwise sort it behind or in front of all of it.
   */
  const cleat = slab(0.5, 0.95, 0.15, 0.95, 5.8, 7.2, IRON, { corner: 0.08, paint: { right: (g, k, s) => sheen(g, k.fill, s.w, s.h, 3), front: (g, k, s) => sheen(g, k.fill, s.w, s.h, 4) } });
  const rope = faceColour(clothTone(), 0.86);
  const lo: V3 = [0.66, 0.42, 6.8], hi: V3 = [0.5, 0.36, FLAG_TOP - 0.3];
  const toward = (e: Eye): boolean => 0.8 * e.toward[0] + 0.55 * e.toward[1] > 0;
  const rig = (g: Ctx, e: Eye): void => {
    drawFaces(g, e, cleat, KIT_INK_W, KIT_INK);
    const [ax, ay] = proj(e, lo), [bx, by] = proj(e, hi);
    g.lineCap = 'round';
    g.strokeStyle = css(mix(rope, hex('#5a4458'), 0.45));
    g.lineWidth = 0.75;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = css(rope);
    g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  };
  const reach: V3[] = [[0.5, 0.15, 5.8], [0.95, 0.95, FLAG_TOP - 0.3]];
  parts.push({ reach, first: true, draw: (g, e) => { if (!toward(e)) rig(g, e); } });
  parts.push({ reach, after: [pole], draw: (g, e) => { if (toward(e)) rig(g, e); } });
  parts.push(room(-7, 7, -7, 7, FLAG_TOP - FLAG_HOIST - 6, FLAG_TOP));
  return { parts, shade: [[-2.4, -2.4, 0], [2.4, -2.4, 0], [2.4, 2.4, 0], [-2.4, 2.4, 0]] };
}

/**
 * A flag on its pole, flying down the wind: straight out in a gale, drooping
 * in a light air and hanging nearly down the pole in a flat calm, rippling in
 * waves that run out to its fly quicker and deeper the harder it blows. Cut
 * in a swallowtail at the fly.
 */
function flag(ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, air: KitAir = STILL): void {
  const e = eyeOfView(view);
  const f = Math.max(0, Math.min(1, air.force));
  const wl = Math.hypot(air.x, air.y) || 1, wx = air.x / wl, wy = air.y / wl;
  const nx = -wy, ny = wx;
  const coarse = zoom < 0.6;
  const NU = coarse ? 4 : zoom < 1.5 ? 8 : 11, NV = coarse ? 2 : zoom < 1.5 ? 3 : 4;
  const t = air.t;
  const droop = (1 - f) ** 1.4 * 1.25;
  const at = (u0: number, v: number): V3 => {
    const u = u0 * (1 - 0.2 * (1 - Math.abs(2 * v - 1)));
    const z0 = FLAG_TOP - FLAG_HOIST * v;
    let x = wx * 0.45, y = wy * 0.45, z = z0;
    const steps = 8;
    for (let k = 0; k < steps; k++) {
      const s = ((k + 0.5) / steps) * u;
      const dd = droop * (0.35 + 0.65 * s);
      const len = (FLAG_FLY * u) / steps;
      x += wx * Math.cos(dd) * len;
      y += wy * Math.cos(dd) * len;
      z -= Math.sin(dd) * len;
    }
    const amp = (0.35 + 1.9 * f) * u ** 1.25;
    const ph = (u * 1.35 - t * (0.7 + 2.3 * f)) * Math.PI * 2;
    const w = amp * Math.sin(ph + v * 0.7);
    return [x + nx * w, y + ny * w, z + 0.25 * amp * Math.cos(ph)];
  };
  const cloth = clothTone(air.tint);
  const dev = coarse || air.device === undefined ? null : { k: air.device, u: 0.36, v: 0.5, su: 0.14, sv: 0.3 };
  const sheet = { e, NU, NV, at }, grid = gridOf(sheet);
  layCloth(ctx, sx, sy, zoom, grid, (g) => drawSheet(g, sheet, grid, cloth, [], dev), [
    hullOf(e, -0.56, 0.56, -0.56, 0.56, FLAG_TOP - FLAG_HOIST - 1.5, FLAG_TOP + 1.2),
    hullOf(e, -0.8, 0.8, -0.8, 0.8, FLAG_TOP + 1.2, FLAG_TOP + 2.7),
  ]);
}

export const BANNER: KitPiece = {
  model: (look) => bannerOf(look),
  uses: { material: true },
  live: (ctx, sx, sy, zoom, view, _night, _t, air) => bannerCloth(ctx, sx, sy, zoom, view, air),
  wind: true,
};

export const FLAGPOLE: KitPiece = {
  model: (look) => flagpoleOf(look),
  uses: { material: true },
  live: (ctx, sx, sy, zoom, view, _night, _t, air) => flag(ctx, sx, sy, zoom, view, air),
  wind: true,
};

