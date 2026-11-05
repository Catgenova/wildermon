/**
 * Looks for the places an orc proposal (`src/render/wild-orc.ts`) passes through itself: an arm, a hand, a leg, a foot
 * or what it holds going into its trunk, hips, head or jaw, into the flaps hanging from its belt or its cloak, or into its
 * other limbs. Every frame of its loop standing (a twelfth of a second apart), of a walk and a run (a forty-eighth of a
 * stride apart) and of its strike standing and on the move (a fiftieth of it apart), in its own units.
 *
 *   npx esbuild tools/orc/clip.ts --bundle --platform=node --format=esm --outfile=/tmp/orc-clip.mjs && node /tmp/orc-clip.mjs [A B C] [--all]
 *
 * Prints, for each kind, each pair that goes through by more than `MIN` at its worst, the moment it is worst and by how
 * much; `--all` prints every moment over `MIN`. Arms and legs are capsules down their bones, the fist a ball, the foot a
 * capsule along it; the trunk and a cloak their rings, the hips, head and jaw eggs, a flap a slab, and what is held the
 * corners of its mesh. Where a limb joins the body (the top of the upper arm, of the thigh) it is not counted.
 */
import { add, scale, sub, type Anim, type Bones } from '../../src/render/beasts';
import { place, type V3, type Xf } from '../../src/render/figure';
import { ORC_PROPOSALS, ORC_SHAPES, type OrcShape } from '../../src/render/wild-orc';

/** Deeper than this (a share of the kind's unit) is a clip. */
const MIN = 0.05;

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3): number => Math.sqrt(dot(a, a));
/** A point in a bone's frame, from the body's. */
const local = (x: Xf, p: V3): V3 => {
  const d = sub(p, x.t), m = x.m;
  return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
};

/** How far a ball at `p` of radius `r` goes into an egg (`c`, `r3`) in a bone's frame: more than nought is in. */
function intoEgg(x: Xf, c: V3, r3: V3, p: V3, r: number): number {
  const q = sub(local(x, p), c);
  // How far out of the egg's skin, to first order: (k - 1) over how fast k grows there.
  const k = Math.sqrt((q[0] / r3[0]) ** 2 + (q[1] / r3[1]) ** 2 + (q[2] / r3[2]) ** 2);
  const g = Math.sqrt((q[0] / r3[0] ** 2) ** 2 + (q[1] / r3[1] ** 2) ** 2 + (q[2] / r3[2] ** 2) ** 2) / (k || 1);
  return r - (k - 1) / (g || 1 / Math.min(...r3));
}

/** Half the width, half the depth and the forward of rings at a height; nothing outside them. */
function ringAt(rings: readonly (readonly number[])[], z: number): [number, number, number] | null {
  if (z < rings[0][0] || z > rings[rings.length - 1][0]) return null;
  let i = 0;
  while (i < rings.length - 2 && rings[i + 1][0] < z) i++;
  const a = rings[i], b = rings[i + 1], k = Math.min(1, Math.max(0, (z - a[0]) / (b[0] - a[0] || 1)));
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}

/** How far a ball goes into a trunk of rings on a bone; `shell`, how far it goes through the skin of one open at the front (a cloak). */
function intoRings(x: Xf, rings: readonly (readonly number[])[], p: V3, r: number, shell = false): number {
  const q = local(x, p), at = ringAt(rings, q[2]);
  if (!at) return -1;
  const [w, h, y] = at;
  const dy = q[1] - y, k = Math.sqrt((q[0] / w) ** 2 + (dy / h) ** 2);
  const g = Math.sqrt((q[0] / (w * w)) ** 2 + (dy / (h * h)) ** 2) / (k || 1), d = (k - 1) / (g || 1 / Math.min(w, h));
  if (!shell) return r - d;
  // A cloak is open at the front: only where it is.
  if (q[1] > Math.min(0.12 + (q[2] - 1.0) * 0.55, 0.16)) return -1;
  return r - Math.abs(d) - 0.04;
}

/** How far a ball goes into a flap hanging from the belt (`y` out, `w` half wide, down to `z`), as a slab `t` thick, in the body's frame. */
function intoFlap(body: Xf, f: readonly [number, number, number], p: V3, r: number): number {
  const q = local(body, p), [y, w, z] = f;
  if (q[2] > 0.02 + r || q[2] < z - r || Math.abs(q[0]) > w + r) return -1;
  return r + 0.05 - Math.abs(q[1] - y * 1.04);
}

/** The closest two points on two segments, and how far apart. */
function segDist(p1: V3, q1: V3, p2: V3, q2: V3): number {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
  s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  return len(sub(add(p1, scale(d1, s)), add(p2, scale(d2, t))));
}

interface Cap { name: string; a: V3; b: V3; r: number; from?: number }
/** The limbs as capsules in the body's frame: `from`, the share of the way down it before which it is where it joins the body. */
function capsules(b: Bones, s: OrcShape): Cap[] {
  const L = s.limbs, out: Cap[] = [];
  for (const k of [0, 1]) {
    const side = k ? 'R' : 'L';
    out.push({ name: `${side}arm`, a: place(b[`arm${k}`], [0, 0, 0]), b: place(b[`arm${k}`], [0, 0, -L.arm[0]]), r: L.armW[0] * 0.95, from: 0.5 });
    out.push({ name: `${side}fore`, a: place(b[`elbow${k}`], [0, 0, 0]), b: place(b[`elbow${k}`], [0, 0, -L.arm[1]]), r: L.armW[1] * 0.9 });
    const h = L.hand;
    out.push({ name: `${side}hand`, a: place(b[`hand${k}`], [0, h * 0.2, -h * 0.4]), b: place(b[`hand${k}`], [0, h * 0.35, -h * 0.8]), r: h * 0.85 });
  }
  for (const [key, side] of [['ll', 'L'], ['lr', 'R']]) {
    out.push({ name: `${side}thigh`, a: place(b[`${key}0`], [0, 0, 0]), b: place(b[`${key}0`], [0, 0, -L.leg[0]]), r: L.legW[0] * 0.95, from: 0.5 });
    out.push({ name: `${side}shin`, a: place(b[`${key}1`], [0, 0, 0]), b: place(b[`${key}1`], [0, 0, -L.leg[1]]), r: L.legW[1] * 0.92 });
    const [fr, fl] = L.foot;
    out.push({ name: `${side}foot`, a: place(b[`${key}2`], [0, fl * 0.05, -fr * 0.55]), b: place(b[`${key}2`], [0, fl * 0.75, -fr * 0.6]), r: fr * 0.62 });
  }
  return out;
}

/** Points down a capsule, a ball at each, from where it leaves the body. */
const balls = (c: Cap): Array<{ p: V3; r: number }> => Array.from({ length: 7 }, (_, q) => (c.from ?? 0) + ((1 - (c.from ?? 0)) * q) / 6)
  .map((t) => ({ p: add(c.a, scale(sub(c.b, c.a), t)), r: c.r }));

/** Pairs of limbs that are expected to touch where they meet. */
const joined = (a: string, b: string): boolean => {
  const part = (n: string): [string, string] => [n[0], n.slice(1)];
  const [sa, pa] = part(a), [sb, pb] = part(b);
  if (sa !== sb) return false;
  const chain = [['arm', 'fore'], ['fore', 'hand'], ['thigh', 'shin'], ['shin', 'foot']];
  return chain.some(([x, y]) => (pa === x && pb === y) || (pa === y && pb === x));
};

interface Hit { pair: string; depth: number; at: string }
function check(who: string, a: Anim, label: string, out: Hit[]): void {
  const kind = ORC_PROPOSALS[who], s = ORC_SHAPES[who];
  const b = kind.bones(a);
  const caps = capsules(b, s);
  const hit = (pair: string, depth: number): void => { if (depth > MIN) out.push({ pair, depth, at: label }); };
  // Each limb against the body's solids.
  for (const c of caps) {
    const leg = /thigh|shin|foot/.test(c.name);
    let trunk = -1, hips = -1, head = -1, jaw = -1, cloak = -1, lump = -1;
    const flap = s.flaps.map(() => -1);
    for (const { p, r } of balls(c)) {
      if (!(leg && c.name.endsWith('thigh'))) trunk = Math.max(trunk, intoRings(b.chest, s.trunk, p, r));
      if (!leg) hips = Math.max(hips, intoEgg(b.body, s.hips.c, s.hips.r, p, r));
      head = Math.max(head, intoEgg(b.head, s.face.c, s.face.r, p, r));
      jaw = Math.max(jaw, intoEgg(b.jaw, add(s.face.c, s.face.jaw[0]), s.face.jaw[1], p, r));
      if (s.cloak) cloak = Math.max(cloak, intoRings(b.chest, s.cloak, p, r, true));
      for (const l of s.lumps) if (!c.name.endsWith('arm')) lump = Math.max(lump, intoEgg(b[l.bone], l.c, l.r, p, r));
      if (!leg) s.flaps.forEach((f, i) => { flap[i] = Math.max(flap[i], intoFlap(b.body, f, p, r)); });
    }
    hit(`${c.name}~trunk`, trunk); hit(`${c.name}~hips`, hips); hit(`${c.name}~head`, head); hit(`${c.name}~jaw`, jaw);
    hit(`${c.name}~cloak`, cloak); hit(`${c.name}~pauldron`, lump);
    flap.forEach((d, i) => hit(`${c.name}~${i ? 'back' : 'front'}flap`, d));
  }
  // Each limb against each other one, but not where they join.
  for (let i = 0; i < caps.length; i++) {
    for (let j = i + 1; j < caps.length; j++) {
      const A = caps[i], B = caps[j];
      if (joined(A.name, B.name)) continue;
      // Both legs come out of the hips side by side: their tops are not counted against each other.
      const pa = A.from ? add(A.a, scale(sub(A.b, A.a), A.from)) : A.a, pb = B.from ? add(B.a, scale(sub(B.b, B.a), B.from)) : B.a;
      hit(`${A.name}~${B.name}`, A.r + B.r - segDist(pa, A.b, pb, B.b));
    }
  }
  const kit = kind.build(0);
  // What hangs from the belt, swung as it is drawn (`Piece.bent`), against the legs below where they leave the hips.
  for (const pc of kit) {
    if (!pc.bent || pc.bone !== 'body') continue;
    const pts = pc.bent(pc.mesh.v, a).map((v) => place(b.body, v));
    for (const c of caps) {
      if (!/thigh|shin|foot/.test(c.name)) continue;
      const top = c.from ? add(c.a, scale(sub(c.b, c.a), c.from)) : c.a;
      let d = -1;
      for (const p of pts) d = Math.max(d, c.r - segDist(p, p, top, c.b));
      hit(`${c.name}~${pc.key}`, d);
    }
  }
  // What is held against the body and the limbs not holding it.
  for (const key of s.held) {
    const pc = kit.find((p) => p.key === key);
    if (!pc) continue;
    const xf = b[pc.bone], pts = pc.mesh.v.filter((_, q) => q % 2 === 0).map((v) => place(xf, v));
    const holder = pc.bone.endsWith('0') ? 'L' : 'R';
    let trunk = -1, head = -1, jaw = -1, cloak = -1, hips = -1;
    const limb = new Map<string, number>();
    for (const p of pts) {
      trunk = Math.max(trunk, intoRings(b.chest, s.trunk, p, 0));
      hips = Math.max(hips, intoEgg(b.body, s.hips.c, s.hips.r, p, 0));
      head = Math.max(head, intoEgg(b.head, s.face.c, s.face.r, p, 0));
      jaw = Math.max(jaw, intoEgg(b.jaw, add(s.face.c, s.face.jaw[0]), s.face.jaw[1], p, 0));
      if (s.cloak) cloak = Math.max(cloak, intoRings(b.chest, s.cloak, p, 0, true));
      for (const c of caps) {
        if (c.name.startsWith(holder) && /arm|fore|hand/.test(c.name)) continue;
        const d = c.r - segDist(p, p, c.a, c.b);
        limb.set(c.name, Math.max(limb.get(c.name) ?? -1, d));
      }
    }
    hit(`${key}~trunk`, trunk); hit(`${key}~hips`, hips); hit(`${key}~head`, head); hit(`${key}~jaw`, jaw); hit(`${key}~cloak`, cloak);
    for (const [n, d] of limb) hit(`${key}~${n}`, d);
  }
}

const still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
const args = process.argv.slice(2), all = args.includes('--all');
const whos = args.filter((x) => x in ORC_PROPOSALS);
for (const who of whos.length ? whos : Object.keys(ORC_PROPOSALS)) {
  const hits: Hit[] = [];
  for (let t = 0; t < 24; t += 1 / 12) check(who, { ...still, t, breath: 0.5 + 0.5 * Math.sin(t) }, `stand t${t.toFixed(2)}`, hits);
  for (const gait of [0, 1]) for (let q = 0; q < 48; q++) check(who, { ...still, go: 1, gait, u: q / 48 }, `${gait ? 'run' : 'walk'} u${(q / 48).toFixed(3)}`, hits);
  for (let q = 0; q <= 50; q++) check(who, { ...still, act: { kind: 'strike', t: q / 50 } }, `strike t${(q / 50).toFixed(2)}`, hits);
  for (const gait of [0, 1]) for (let q = 0; q <= 50; q++) check(who, { ...still, go: 1, gait, u: q / 37, act: { kind: 'strike', t: q / 50 } }, `${gait ? 'run' : 'walk'}-strike t${(q / 50).toFixed(2)}`, hits);
  const worst = new Map<string, Hit & { n: number }>();
  for (const h of hits) {
    const w = worst.get(h.pair);
    if (!w) worst.set(h.pair, { ...h, n: 1 });
    else { w.n++; if (h.depth > w.depth) { w.depth = h.depth; w.at = h.at; } }
  }
  const rows = [...worst.values()].sort((x, y) => y.depth - x.depth);
  console.log(`${who}: ${rows.length ? rows.length + ' pairs clip' : 'nothing clips'}`);
  for (const r of rows) console.log(`  ${r.pair.padEnd(26)} ${r.depth.toFixed(3)} at ${r.at.padEnd(22)} (${r.n} frames)`);
  if (all) for (const h of hits) console.log(`    ${h.at} ${h.pair} ${h.depth.toFixed(3)}`);
}
