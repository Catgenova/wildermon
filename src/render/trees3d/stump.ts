/**
 * Stumps and felled logs drawn as solids (`stump3dSprite`, `log3dSprite` in
 * `./index`), in their species' bark as its trees are painted (`./paint`).
 *
 * A stump is the foot of its species' mature tree on that tile, sawn off
 * flat: the same trunk, root flare or buttresses and bark, with a cut top of
 * growth rings in the pale wood the flat stump's face is (`woodOf`). A log is
 * a length of the same trunk lying on the ground, both ends sawn.
 */
import { KIT_INK, KIT_INK_W } from '../kit/core';
import { proj } from '../runestone';
import { dulled } from '../trees/kit';
import { mulberry32 } from '../../world/noise';
import { ACROSS, bandPath, buttress, chainsOf, footOf, paintChain, paintFoot, SNOW_EDGE, type Chain, type Item, type Job } from './paint';
import type { Limb, Skeleton, Species3D, V3 } from './types';
import { add, dot, hex, lerp, mixRgb, mul, rgb, sub, unit } from './vec';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** A sawn face: its middle, its radius, which way it faces, and the piece of wood it ends. */
export interface Cut {
  c: V3;
  r: number;
  n: V3;
  limb: number;
  /** A log's end: the log's way across on the screen there, and how far the end is turned to the eye, 0 to 1. */
  side?: { n: Pt; f: number };
}

/** A stump's model: its wood, cut, and each stem's sawn top. */
export interface StumpModel {
  sk: Skeleton;
  cuts: Cut[];
}

/** The cut wood's tones, as the flat stump's face (`stumpSprite`): the face and its rings, from the species' trunk colour. */
export function woodOf(trunk: string): { face: string; ring: string } {
  return { face: dulled(trunk, -0.62), ring: dulled(trunk, -0.12) };
}

/** How high a stump is sawn, against its trunk's radius there; and the lowest and highest, in model units. */
const CUT_HIGH = 1.05;
const CUT_LO = 2.6;
const CUT_HI = 6;

/** The radius of the first stem of a tree's trunk at height `z`. */
function radiusAt(limbs: Limb[], z: number): number {
  for (const L of limbs) {
    if (L.order !== 0) continue;
    if (L.b[2] >= z) return L.ra + (L.rb - L.ra) * clamp01((z - L.a[2]) / Math.max(1e-6, L.b[2] - L.a[2]));
  }
  return limbs[0]?.rb ?? 2;
}

/**
 * The stump a tree leaves: its trunk (every stem of it) up to where it is
 * sawn, and its roots, kept below the cut. Its own shade at its foot reaches
 * a little past the trunk (`Skeleton.foot`).
 */
export function stumpOf(tree: Skeleton): StumpModel {
  const L = tree.limbs;
  let zc = 3;
  for (let i = 0; i < 4; i++) zc = Math.max(CUT_LO, Math.min(CUT_HI, radiusAt(L, zc) * CUT_HIGH));
  const limbs: Limb[] = [];
  const cuts: Cut[] = [];
  const kept = new Map<number, number>();
  const above = new Set<number>();
  for (let i = 0; i < L.length; i++) {
    const P = L[i];
    if (P.order === 0) {
      if (P.parent >= 0 && (L[P.parent].order !== 0 || !kept.has(P.parent) || above.has(P.parent))) continue;
      if (P.a[2] >= zc) continue;
      let b = P.b, rb = P.rb;
      const cut = P.b[2] >= zc - 0.01;
      if (cut) {
        const t = (zc - P.a[2]) / Math.max(1e-6, P.b[2] - P.a[2]);
        b = lerp(P.a, P.b, t);
        rb = P.ra + (P.rb - P.ra) * t;
        above.add(i);
      }
      kept.set(i, limbs.length);
      limbs.push({ a: P.a, b, ra: P.ra, rb, order: 0, parent: P.parent >= 0 ? kept.get(P.parent)! : -1, bough: -1 });
      if (cut) cuts.push({ c: b, r: rb, n: [0, 0, 1], limb: limbs.length - 1 });
    } else if (P.order === -1) {
      const parent = kept.get(P.parent);
      if (parent === undefined) continue;
      // Out of the trunk under the cut.
      const a: V3 = L[P.parent].order === 0 ? [P.a[0], P.a[1], Math.min(P.a[2], zc * 0.72)] : P.a;
      kept.set(i, limbs.length);
      limbs.push({ ...P, a, parent });
    }
  }
  const r0 = Math.max(...cuts.map((c) => Math.hypot(c.c[0], c.c[1]) + c.r), 1);
  const reach = Math.max(r0, ...limbs.filter((l) => l.order < 0).map((l) => Math.hypot(l.b[0], l.b[1]) + l.rb));
  return {
    sk: {
      limbs, clumps: [], crown: { c: [0, 0, zc], r: reach, rz: 1 }, height: zc, rune: null, hollow: null,
      rough: tree.rough ? Math.min(tree.rough, zc * 0.45) : undefined,
      foot: Math.max(3, r0 * ACROSS * 1.7),
    },
    cuts,
  };
}

/** One log lying: from `a` to `b`, `ra` thick at `a` and `rb` at `b`. */
export interface Log {
  a: V3;
  b: V3;
  ra: number;
  rb: number;
}

/**
 * `n` logs (one to three) lying along `angle` on the ground: one; two side
 * by side; or two with a third in the groove on top. Beside a stump, moved
 * off it to one side. Each its own length, a little off the others' ends.
 */
export function logsOf(r: number, length: number, n: number, angle: number, off: number, seed: number): { sk: Skeleton; logs: Log[] } {
  const R = mulberry32(seed);
  const d: V3 = [Math.cos(angle), Math.sin(angle), 0];
  const p: V3 = [-d[1], d[0], 0];
  const at: Array<[number, number]> = n <= 1 ? [[0, 0]] : n === 2 ? [[-1, 0], [1, 0]] : [[-1, 0], [1, 0], [0, 1]];
  const logs: Log[] = at.map(([s, up], i) => {
    const rr = r * (0.88 + 0.2 * R());
    const len = length * (0.84 + 0.22 * R());
    const mid = add(add(mul(p, off + s * r * 1.04), mul(d, (R() - 0.5) * r * 1.2)), [0, 0, rr + up * r * 1.72]);
    const flip = (i + Math.round(R())) % 2 ? 1 : -1;
    const half = mul(d, (len / 2) * flip);
    return { a: sub(mid, half), b: add(mid, half), ra: rr * 1.06, rb: rr * 0.94 };
  });
  const limbs: Limb[] = logs.map((l) => ({ a: l.a, b: l.b, ra: l.ra, rb: l.rb, order: 0, parent: -1, bough: -1 }));
  const reach = Math.max(...logs.flatMap((l) => [Math.hypot(l.a[0], l.a[1]), Math.hypot(l.b[0], l.b[1])])) + r;
  return { sk: { limbs, clumps: [], crown: { c: [0, 0, r], r: reach, rz: r }, height: r * 2, rune: null, hollow: null }, logs };
}

/** What of a species a stump or a log is painted as: its bark, always on an open foot; no leaf, no crown; moss only where `moss`. */
export function woodSpec(spec: Species3D, moss: boolean, lying = false): Species3D {
  return {
    ...spec,
    build: { ...spec.build, whorls: undefined, ...(lying ? { habit: undefined } : {}) },
    open: !lying, haze: false, evergreen: undefined, orchard: undefined, keys: undefined, buds: undefined,
    bark: moss ? spec.bark : { ...spec.bark, moss: undefined },
  };
}

/** How much light a face turned along `n` catches, 0 to 1, as the bark is lit (`./paint` barkAt). */
const litBy = (job: Job, n: V3): number => clamp01((job.light.ambient + job.light.direct * Math.max(0, dot(n, job.light.sun)) - 0.22) / 0.82);

/** A colour in shade and in the light, at `l`. */
const lit = (shade: string, light: string, l: number): string => rgb(mixRgb(hex(shade), hex(light), l));

/** A sawn face on the screen: its middle, and where a unit of the model goes along each of its two ways across it. */
interface Frame { o: Pt; u: Pt; v: Pt }

/**
 * A stump's top lies flat on the ground's plane, seen as the ground is. A
 * log's end stands square to the log: drawn as wide as the log is drawn
 * across (`ACROSS`, as every limb is), and as deep as it is turned to the eye.
 */
function frameOf(job: Job, cut: Cut): Frame {
  const o = proj(job.e, cut.c);
  if (!cut.side) return { o, u: [job.e.ux, job.e.uy], v: [job.e.vx, job.e.vy] };
  const [nx, ny] = cut.side.n;
  return { o, u: [nx * ACROSS, ny * ACROSS], v: [-ny * ACROSS * cut.side.f, nx * ACROSS * cut.side.f] };
}
const at = (f: Frame, s: number, t: number): Pt => [f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t];

/** A sawn face's outline at `k` of its radius, its middle moved `off` model units along its two ways. */
function ringPath(f: Frame, r: number, k = 1, off: Pt = [0, 0]): Path2D {
  const p = new Path2D();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    const [x, y] = at(f, off[0] + r * k * Math.cos(t), off[1] + r * k * Math.sin(t));
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

/** A sawn face, its bark round it and its rings: the stump's top or a log's end. */
function paintFace(g: Ctx, job: Job, cut: Cut, wood: { face: string; ring: string }, seed: number): void {
  const { spec } = job;
  const l = litBy(job, cut.n);
  const R = mulberry32(seed);
  const f = frameOf(job, cut);
  // The bark round it, seen edge on.
  g.fillStyle = lit(spec.bark.shade, spec.bark.lit, l * 0.85);
  g.fill(ringPath(f, cut.r));
  // The wood: the pale face, in the bark's shade as the light leaves it.
  const face = lit(rgb(mixRgb(hex(wood.face), hex(spec.bark.shade), 0.5)), wood.face, l);
  const ring = lit(rgb(mixRgb(hex(wood.ring), hex(spec.bark.shade), 0.5)), wood.ring, l);
  g.fillStyle = face;
  g.fill(ringPath(f, cut.r, 0.84));
  // The rings, round a heart a little off the middle, each the further out the more it is drawn toward the edge.
  const ha = R() * TAU, hd = cut.r * 0.14;
  const hs = Math.cos(ha) * hd, ht = Math.sin(ha) * hd;
  const px = cut.r * ACROSS;
  g.strokeStyle = ring;
  g.lineWidth = Math.max(0.32, Math.min(0.55, px * 0.07));
  for (const k of [0.62, 0.38, 0.17]) {
    if (px * k < 0.7) continue;
    g.stroke(ringPath(f, cut.r, k, [hs * (1 - k), ht * (1 - k)]));
  }
  // A check: a crack out from the heart to the bark.
  if (px > 2.2) {
    const a = ha + Math.PI * (0.6 + 0.8 * R());
    const [x0, y0] = at(f, hs, ht);
    const [x1, y1] = at(f, hs + Math.cos(a) * cut.r * 0.7, ht + Math.sin(a) * cut.r * 0.7);
    g.strokeStyle = rgb(mixRgb(hex(ring), KIT_INK, 0.45));
    g.lineWidth = Math.max(0.35, g.lineWidth);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo((x0 + x1) / 2 + (R() - 0.5) * 0.4, (y0 + y1) / 2 + (R() - 0.5) * 0.4);
    g.lineTo(x1, y1);
    g.stroke();
  }
}

/** Moss over the back of a stump's bark rim, on the side turned from the sun: the damp seasons (`Species3D.bark.moss`). */
function paintRimMoss(g: Ctx, job: Job, cut: Cut, moss: string): void {
  const s = job.light.sun;
  const away = Math.atan2(-s[1], -s[0]);
  const p = new Path2D();
  const N = 14;
  const at = (t: number, k: number): Pt => proj(job.e, add(cut.c, [Math.cos(t) * cut.r * k, Math.sin(t) * cut.r * k, 0]));
  for (let i = 0; i <= N; i++) {
    const t = away - 1.3 + (2.6 * i) / N;
    const [x, y] = at(t, 1.02);
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const t = away - 1.3 + (2.6 * i) / N;
    p.lineTo(...at(t, 0.8 + 0.07 * Math.sin(i * 2.3) - 0.1 * Math.sin((i / N) * Math.PI)));
  }
  p.closePath();
  g.globalAlpha = 0.8;
  g.fillStyle = moss;
  g.fill(p);
  g.globalAlpha = 1;
}

/** Snow on a sawn top: a cap a little in from its edge, standing up over it, edged underneath in the snow's shade. */
function capPath(job: Job, cut: Cut): Path2D {
  const rise = cut.r * 0.32;
  const p = new Path2D();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    const k = 0.95 + 0.04 * Math.sin(t * 3 + cut.r);
    const [x, y] = proj(job.e, add(cut.c, [Math.cos(t) * cut.r * k, Math.sin(t) * cut.r * k, 0]));
    // Mounded: up over its middle, the far side of it seen over the top.
    const [, ym] = proj(job.e, cut.c);
    const up = y < ym ? rise : rise * 0.35;
    if (i) p.lineTo(x, y - up); else p.moveTo(x, y - up);
  }
  p.closePath();
  return p;
}

/**
 * A stump: its foot and buttresses, its trunk banded and inked as its tree's
 * is, and each stem's sawn top, laid back to front; its bark's moss over the
 * rim in the damp seasons, snow capped on the top in winter.
 */
export function paintStump3d(g: Ctx, job: Job, cuts: Cut[], wood: { face: string; ring: string }): void {
  const { sk, e, spec } = job;
  const near = (p: V3): number => dot(p, e.toward as V3);
  const chains = chainsOf(job, false);
  const sawn = new Set(cuts.map((c) => c.limb));
  for (const c of chains) if (sawn.has(c.pieces[c.pieces.length - 1])) c.cut = true;
  const winter = job.dress.season === 'winter';
  const items: Item[] = [];
  // The ink round the whole of it, laid first: what is laid after covers it but at its outline.
  g.strokeStyle = rgb(KIT_INK);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = KIT_INK_W * 2;
  for (const c of chains) {
    if (c.thin) continue;
    g.stroke(bandPath(c, 0, c.q.length - 1, -1, 1));
    if (c.cut) continue;
    const [x, y] = c.q[c.q.length - 1];
    g.beginPath();
    g.arc(x, y, c.r[c.r.length - 1] + KIT_INK_W, 0, TAU);
    g.fillStyle = rgb(KIT_INK);
    g.fill();
  }
  for (const cut of cuts) {
    g.stroke(ringPath(frameOf(job, cut), cut.r));
    if (winter) g.stroke(capPath(job, cut));
  }
  // Each stem's foot, round on the ground, and the buttresses out of it.
  for (const trunk of chains.filter((c) => c.order === 0 && sk.limbs[c.pieces[0]].parent < 0)) {
    const at = trunk.pieces[0];
    const foot = footOf(job, at);
    g.lineWidth = KIT_INK_W * 2;
    g.stroke(foot.base);
    items.push({ d: near(sk.limbs[at].a) - 0.6, draw: () => paintFoot(g, foot, trunk) });
    foot.lobes.forEach(([a, out], k) => {
      const b = buttress(job, a, out, k);
      items.push({ d: near(b.at) - 0.5, draw: () => b.draw(g) });
    });
  }
  for (const c of chains) {
    const R = mulberry32(job.seed + c.pieces[0] * 13);
    const L0 = sk.limbs[c.pieces[0]], L1 = sk.limbs[c.pieces[c.pieces.length - 1]];
    items.push({ d: near(lerp(L0.a, L1.b, 0.5)) - (c.order <= 0 ? 0.5 : 0), draw: () => paintChain(g, job, c, 0, c.q.length - 1, R) });
  }
  cuts.forEach((cut, i) => {
    items.push({
      d: near(cut.c) + 0.25,
      draw: () => {
        paintFace(g, job, cut, wood, job.seed + i * 977);
        if (spec.bark.moss) paintRimMoss(g, job, cut, spec.bark.moss);
        if (winter) {
          const cap = capPath(job, cut);
          g.fillStyle = '#f4f7fd';
          g.fill(cap);
          g.save();
          g.clip(cap);
          g.strokeStyle = SNOW_EDGE;
          g.lineWidth = Math.max(0.5, cut.r * ACROSS * 0.16);
          const f = frameOf(job, cut);
          g.stroke(ringPath({ ...f, o: [f.o[0], f.o[1] + cut.r * ACROSS * 0.1] }, cut.r, 0.95));
          g.restore();
        }
      },
    });
  });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

/**
 * Logs lying on the ground: each its own contact shade under it, inked
 * round, its far end's bark showing past it, its body banded and marked as
 * its tree's trunk is, and its near end sawn, with its rings; laid back to front.
 */
export function paintLogs3d(g: Ctx, job: Job, logs: Log[], wood: { face: string; ring: string }): void {
  const { e } = job;
  const near = (p: V3): number => dot(p, e.toward as V3);
  const chains = chainsOf(job, false);
  const toward = unit(e.toward as V3);
  // The shade each lays on the ground under it, under everything, in the trees' foot shade's tone.
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = 'rgba(30,56,66,0.27)';
  for (const l of logs) {
    if (l.a[2] > l.ra * 1.5) continue;
    const d = unit(sub(l.b, l.a));
    const p: V3 = [-d[1], d[0], 0];
    const path = new Path2D();
    const N = 10;
    const ring: V3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / N;
      ring.push(add([l.b[0], l.b[1], 0], add(mul(d, Math.cos(t) * l.rb * 0.7), mul(p, Math.sin(t) * l.rb * 1.25))));
    }
    for (let i = 0; i <= N; i++) {
      const t = Math.PI / 2 + (Math.PI * i) / N;
      ring.push(add([l.a[0], l.a[1], 0], add(mul(d, Math.cos(t) * l.ra * 0.7), mul(p, Math.sin(t) * l.ra * 1.25))));
    }
    ring.forEach((q, i) => (i ? path.lineTo(...proj(e, q)) : path.moveTo(...proj(e, q))));
    path.closePath();
    g.fill(path);
  }
  g.restore();
  const items: Item[] = [];
  chains.forEach((c: Chain) => {
    const L = job.sk.limbs[c.pieces[0]];
    const l = logs[c.pieces[0]];
    if (!l) return;
    c.cut = true;
    const d = unit(sub(l.b, l.a));
    // The end turned to the eye shows its face; the other, its bark round past the body.
    const bNear = dot(d, toward) >= 0;
    // As far as an end is turned to the eye, square on it a circle and edge on a line.
    const f = Math.max(0.3, Math.min(0.85, Math.abs(dot(d, toward)) * 1.6));
    const last = c.q.length - 1;
    const ends: Cut[] = [
      { c: l.a, r: l.ra, n: mul(d, -1), limb: c.pieces[0], side: { n: c.n[0], f } },
      { c: l.b, r: l.rb, n: d, limb: c.pieces[0], side: { n: c.n[last], f } },
    ];
    const [farEnd, nearEnd] = bNear ? ends : [ends[1], ends[0]];
    const R = mulberry32(job.seed + c.pieces[0] * 13);
    items.push({
      d: near(lerp(L.a, L.b, 0.5)),
      draw: () => {
        g.strokeStyle = rgb(KIT_INK);
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.lineWidth = KIT_INK_W * 2;
        g.stroke(bandPath(c, 0, c.q.length - 1, -1, 1));
        const farPath = ringPath(frameOf(job, farEnd), farEnd.r);
        const nearPath = ringPath(frameOf(job, nearEnd), nearEnd.r);
        g.stroke(farPath);
        g.stroke(nearPath);
        // The far end: the body's bands carried round it.
        g.fillStyle = c.cols[1];
        g.fill(farPath);
        g.save();
        g.clip(farPath);
        g.fillStyle = c.cols[0];
        g.fill(bandPath(c, 0, c.q.length - 1, -2.5, -0.36));
        g.fillStyle = c.cols[2];
        g.fill(bandPath(c, 0, c.q.length - 1, 0.34, 2.5));
        g.restore();
        paintChain(g, job, c, 0, c.q.length - 1, R);
        paintFace(g, job, nearEnd, wood, job.seed + c.pieces[0] * 977);
      },
    });
  });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}
