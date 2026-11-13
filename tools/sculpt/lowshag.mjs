// The curtain-fringe shag for the low-poly bodies: the game's 'shag', "Shag". Modelled from its description
// (tools/sculpt/hairs/shag.mjs, no sheet), on the shoulder length's frame (tools/sculpt/lowwarrior.mjs: its paths over
// the skull, its skin radii, its cover and scalp): one closed shell of locks over the skull, fitted to each body's own
// head and shoulders.
//
//   columns  per side the lock borders (the style's keys and locks): each border a path over the skull from the middle
//            parting to where the hair starts to hang, the front edge the curtain fringe's (from the parting's foot on the
//            forehead down and out across the brow's end to the temple, then in front of the ear, the sides over the ears); per
//            lock a ridge between its two borders stood out and the borders sunk, each border a narrow crease in the
//            valleys' shade. Her right mirrors her left; the two sides meet on the parting and down the back's middle.
//   rows     down each column: over the skull from the parting to the hang, then down the layers (the style's `hang`):
//            each layer's ends flicked out from the hair's line, a step in under them (in the valleys' shade) to the
//            layer under it; each lock's tip at each layer lower than its borders, by its own length (the choppy ends);
//            the hem at the shoulders at the back, higher on the sides.
//   inside   sunk into the scalp under the cap, a thickness in from the hair's line where it hangs free (not following
//            the flicks), off the skin where it is not the scalp (the face, the ears, the neck); the rim between the two
//            at the hem and along the front edge in the valleys' shade.
//
// Rigid on the head; kept off the face, the ears, the neck and the shoulders at rest and in the game's clips' poses
// (clearBody; the poses tools/sculpt/hairs/shag-poses-<who>.json, tools/sculpt/lowshaganim.mjs --write).
//
//   node tools/sculpt/lowshag.mjs [--who female,male] [--raw] [--save <dir>] [--asset [--load <dir>]]   # counts, open
//     edges, crossings at rest and head turned; --raw: as built, not kept off the body in the clips' poses; --save: each
//     body's kept in <dir> (shag-<who>.json) for --load here and in lowshaganim.mjs and lowshagshot.mjs
//     --asset: the shag alone into the game's copies (src/sculpt/assets/lowhair.json, lowhair-styles.json and, pressed
//     under the leather hat, lowhat-<who>.json), every other entry left as it is
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { crossings, openEdges, skinHair, gameHair } from './lowhair.mjs';
import { crossReport, POSES } from './lowbob.mjs';
import { dirOf, radiiOf, farHit, pathOf, coverSkin, trisOf, scalpOf } from './lowwarrior.mjs';
import SHAG from './hairs/shag.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const deg = (x) => (x * 180) / Math.PI;
const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/shag-poses-<who>.json, written by
 * tools/sculpt/lowshaganim.mjs --write), or none. */
function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/shag-poses-${who}.json`), 'utf8')); } catch { return []; }
}

const TORSO = new Map();
const BENT = ['ground', 'drink-cup', 'drink-cup-left', 'drink-skin', 'drink-skin-left', 'brush-floor', 'brush-floor-left'];
/** The highest point of the torso (and the shoulder joints) straight under (x, z) in the head's own frame (where the
 * hair is, rigid on it), at rest and in each of the clips' poses: the highest of them, or -Infinity. `still`: at rest
 * and in the idle only. The clips that bend the head down to the chest (BENT) are left to clearBody. */
function torsoTop(rig, x, z, still = false) {
  if (!TORSO.has(rig.who)) {
    const B = rig.B, tris = B.tris.filter((t) => ['torso', 'joint'].includes(B.polys[t.poly].part)), hb = rig.bones[rig.at.get('head')];
    const sets = [Object.assign(tris.map((t) => ({ P: t.v.map((i) => B.verts[i]), poly: t.poly })), { still: true })];
    for (const pose of posesOf(rig.who)) {
      if (BENT.includes(pose.$clip.split(' ')[0])) continue;
      const f = posed(rig, pose), P = skin(rig, f), h = f[rig.at.get('head')];
      // (a posed point back in the head's rest frame: the head's turn undone, S its rotation)
      const back = (q) => { const d = sub(q, h.P); return add(hb.head, [0, 1, 2].map((r) => h.S[r] * d[0] + h.S[3 + r] * d[1] + h.S[6 + r] * d[2])); };
      const near = tris.filter((t) => t.v.some((i) => P[i][1] > h.P[1] - 3));
      sets.push(Object.assign(near.map((t) => ({ P: t.v.map((i) => back(P[i])), poly: t.poly })), { still: pose.$clip.startsWith('idle ') }));
    }
    TORSO.set(rig.who, sets);
  }
  let top = -Infinity;
  for (const T of TORSO.get(rig.who)) { if (still && !T.still) continue; const h = farHit(T, [x, -20, z], [0, 1, 0]); if (h.t > 0) top = Math.max(top, -20 + h.t); }
  return top;
}

/**
 * The shag on a body: { verts, polys: [{ v, piece, valley?, hang? }], tris: [[a, b, c, poly]], weights, pieces, shave,
 * scalp, centre, k, grid }. `clear`: kept off the body in the clips' poses (clearBody).
 */
export function buildShag(rig, style = SHAG, { clear = true } = {}) {
  const S = style, B = rig.B, { C, body, polyAt } = radiiOf(rig);
  // the columns, her left: the front edge, then per lock its first border's crease edge, its ridge, its last border's
  const half = [{ a: 0, kind: 'edge', lock: 0 }];
  for (let i = 0; i + 1 < S.locks.length; i++) {
    const a0 = S.locks[i], a1 = S.locks[i + 1];
    if (i > 0) half.push({ a: a0 + S.crease, kind: 'border', lock: i });
    half.push({ a: (a0 + a1) / 2, kind: 'ridge', lock: i });
    half.push({ a: a1 - S.crease, kind: 'border', lock: i, crease: true });
  }
  // both sides: her right (x mirrored) from its front edge back, then her left from the back to its front edge
  const cols = [...half.map((c) => ({ ...c, side: -1 })), ...half.slice().reverse().map((c) => ({ ...c, side: 1 }))];
  // (the strip from a column to the next a border's valley: between a lock's last border and the next lock's first,
  // either side, and across the back's middle)
  for (let j = 0; j + 1 < cols.length; j++) {
    const c = cols[j], n = cols[j + 1];
    c.creaseNext = (c.side < 0 && n.side < 0 && c.crease === true) || (c.side < 0 && n.side > 0) || (c.side > 0 && n.side > 0 && c.kind === 'border' && !c.crease && n.crease === true);
  }
  const nc = cols.length;
  const mirror = (d, s) => [d[0] * s, d[1], d[2]];
  // each column's path over the skull, its outside's height off the skin there
  const KC = S.capRows.length, KH = S.hang.length;
  const paths = cols.map((c) => pathOf(S, c.a).map((d) => mirror(d, c.side)));
  // (a lock's relief over the skull: none on the parting, its full share from halfway down)
  const capRel = (c, i) => (i === 0 ? 0 : S.relief * S.capRelief * (c.kind === 'ridge' ? 1 : -0.6) * Math.min(1, 2 * S.capRows[i]));
  const capOut = (c, d, i) => {
    const f = S.capRows[i], rb = body(d);
    let t = S.partThick + (S.capThick - S.partThick) * Math.min(1, f * 1.6);
    if (c.kind === 'edge' && i > 0) { const [th] = angOf(d); t = S.edgeThick[0] + (S.edgeThick[1] - S.edgeThick[0]) * ramp(Math.abs(th), 20, 70); }
    return rb + Math.max(S.minThick, t + capRel(c, i));
  };
  // how far into the face (in front of the temples, below the forehead's hairline), the ears or down the nape a skin
  // point is: 0 the scalp, 1 off it
  const hairline = B.verts[B.index.get('t0')][1] - S.hairlineDrop;
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  // (the ears, the neck, and skin that moves with the neck, or within S.offScalp degrees of them: not the scalp)
  const offScalp = (pl) => pl && (pl.ear || pl.part === 'neck' || !pl.v.every(rigid));
  const notScalp = (d, rb) => {
    const p = add(C, mul(d, rb)), [th, ph] = angOf(d), e = S.offScalp;
    for (const [a, b] of [[0, 0], [e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, e], [e, -e], [-e, -e]]) if (offScalp(B.polys[polyAt(dirOf(th + a, ph + b))])) return 1;
    return Math.max(ramp(p[2] - C[2], 0.05, 0.3) * ramp(hairline - p[1], 0, 0.08), ramp(C[1] - 0.35 - p[1], 0, 0.15));
  };
  // (the skin's greatest radius within S.wide degrees of a direction: the inside kept off the ears' rims between its
  // corners, not only at them)
  const wide = (d) => {
    const [th, ph] = angOf(d), e = S.wide;
    let m = 0;
    for (const [a, b] of [[0, 0], [e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, e], [e, -e], [-e, -e]]) m = Math.max(m, body(dirOf(th + a, ph + b)));
    return m;
  };
  const outer = [], inner = [], hang = [];
  // over the skull
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = [], n = [];
    // (the front edge's inside off the skin by lip all along it: each corner raised until the straight edges either
    // side of it clear the skin under them)
    const edgeLift = (i) => {
      let need = 0;
      for (const k of [i - 1, i + 1]) {
        if (k < 0 || k >= KC) continue;
        for (let t = 0; t <= 1; t += 0.1) { const m = lerp(paths[j][i], paths[j][k], t); need = Math.max(need, (body(unit(m)) + S.lip) / Math.hypot(...m)); }
      }
      return need;
    };
    for (let i = 0; i < KC; i++) {
      const d = paths[j][i], rb = body(d), f = notScalp(d, rb);
      let rr = capOut(c, d, i), ri = (f > 0 ? Math.max(rb, wide(d) * f) : rb) - S.sink + (S.sink + S.capClear) * f;
      rr = Math.max(rr, ri + S.minThick);
      if (c.kind === 'edge') { ri = Math.max(ri, rb + S.lip, edgeLift(i)); rr = Math.max(rr, ri + S.minThick); }
      ri = Math.min(ri, rr - S.minThick * 0.5);
      o.push(add(C, mul(d, rr))); n.push(add(C, mul(d, ri)));
    }
    // (the hair falls from its widest: the last cap rows' greatest distance from the upright axis)
    const D = o[KC - 1], h0 = [D[0] - C[0], D[2] - C[2]], hu = [h0[0] / Math.hypot(...h0), h0[1] / Math.hypot(...h0)];
    const hl = Math.max(...o.slice(KC - 3).map((p) => (p[0] - C[0]) * hu[0] + (p[2] - C[2]) * hu[1]));
    { const h = h0[0] * hu[0] + h0[1] * hu[1]; o[KC - 1] = [D[0] + hu[0] * (hl - h), D[1], D[2] + hu[1] * (hl - h)]; }
    outer.push(o); inner.push(n); hang.push({ D: o[KC - 1], hu, hl: hl - capRel(c, KC - 1) });
  }
  // the hem at the back: hemAbove over the torso's top under the hanging hair's ends (outside and inside) at rest and
  // in the idle (the locks from hemFrom on); each column's own sideRise higher toward the front
  const relOf = (c, tip) => S.relief * (c.kind === 'ridge' ? 1 : -0.6) * (tip ? 0.3 : 1);
  const last = S.hang.at(-1);
  let hemY = -Infinity;
  hang.forEach(({ hu, hl }, j) => {
    if (cols[j].a < S.hemFrom) return;
    const R0 = hl * (1 + S.flare) + relOf(cols[j], true) + (last.out ?? 0);
    for (const r of [R0, R0 - S.thick]) hemY = Math.max(hemY, torsoTop(rig, C[0] + hu[0] * r, C[2] + hu[1] * r, true));
  });
  hemY += S.hemAbove;
  const hemOf = (c) => hemY + S.sideRise * (1 - ramp(c.a, S.sideTo, S.backFrom));
  // down the layers: the hair's line the widest's distance from the upright axis, flaring a little; a lock's ridge out
  // and its borders in; each layer's ends flicked out (`out`), each lock's tip at its own length, the step in under it
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = outer[j], n = inner[j], { D, hu, hl } = hang[j], hem = hemOf(c);
    // (the rows' heights: a layer's tip, its pre and its ledge moved with the lock's tip; each row under the one above)
    const ys = S.hang.map((row) => {
      const L = row.layer, jit = L === undefined || row.hem ? 0 : S.layerVar * (hash(c.lock + 5 + 3 * L, c.side + 1) - 0.5) * 2;
      let y = D[1] + (hem - D[1]) * (row.s + jit);
      if (L !== undefined) {
        const k = 1 + S.tipVar * (hash(c.lock + 1 + 7 * L, c.side) - 0.5) * 2;
        const tip = c.kind === 'ridge' ? -S.tipLen[L] * k : c.kind === 'border' ? S.notch[L] : 0;
        y += tip * (row.shift ?? 1) - (row.ledge ? S.ledgeDrop : 0);
      }
      return y;
    });
    for (let i = 0; i < KH; i++) ys[i] = Math.min(ys[i], (i ? ys[i - 1] : D[1]) - S.rowGap);
    for (let i = 0; i < KH; i++) {
      const row = S.hang[i], s = row.s, y = ys[i];
      const line = hl * (1 + S.flare * s) + relOf(c, row.tip) + S.sideOut * (1 - ramp(c.a, S.sideOutTo[0], S.sideOutTo[1])) * Math.min(1, s / 0.2), th = S.thick * (1 - 0.35 * s);
      const flick = row.tip ? (c.kind === 'ridge' ? 1 : S.borderFlick) * (1 + 0.4 * (hash(c.lock + 3, c.side + 2 * i) - 0.5)) : 1;
      let R0 = line + (row.out ?? 0) * flick;
      // (the inside: a thickness in from the hair's line (from the tip at the hem), kept off the skin; the outside a
      // least thickness outside it)
      let pi = [C[0] + hu[0] * (row.hem ? R0 - S.tipThick : line - th), y, C[2] + hu[1] * (row.hem ? R0 - S.tipThick : line - th)];
      const v = sub(pi, C), lv = Math.hypot(...v), dv = mul(v, 1 / lv), rb = wide(dv);
      if (lv < rb + S.clear) pi = add(C, mul(dv, rb + S.clear));
      R0 = Math.max(R0, (pi[0] - C[0]) * hu[0] + (pi[2] - C[2]) * hu[1] + S.minThick * 0.5);
      let po = [C[0] + hu[0] * R0, y, C[2] + hu[1] * R0];
      // (the hanging hair no nearer the shoulders under it, in any clip, than tipClear; a row raised so stays
      // tipClear over the one under it)
      if (i >= KH - 2) {
        const lo = Math.max(torsoTop(rig, po[0], po[2]), torsoTop(rig, pi[0], pi[2])) + S.tipClear * (i === KH - 1 ? 1 : 2);
        if (lo > y) { po = [po[0], lo, po[2]]; pi = [pi[0], lo, pi[2]]; }
      }
      o.push(po); n.push(pi);
    }
  }
  // the mesh: the parting's corners shared by the two sides (each border's first corner is on the middle line)
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  const partO = new Map(), partI = new Map();
  const key = (a) => a.toFixed(5);
  const oi = outer.map((col, j) => col.map((p, i) => (i ? V(p) : partO.get(key(cols[j].a)) ?? (partO.set(key(cols[j].a), V(p)), partO.get(key(cols[j].a))))));
  const ii = inner.map((col, j) => col.map((p, i) => (i ? V(p) : partI.get(key(cols[j].a)) ?? (partI.set(key(cols[j].a), V(p)), partI.get(key(cols[j].a))))));
  const NR = KC + KH;
  const poly = (v, sh = {}) => { const u = v.filter((x, k) => x !== v[(k + 1) % v.length]); if (u.length >= 3) polys.push({ v: u, piece: 0, ...sh }); };
  // (a row's face to the next: a layer's step (tip to ledge), the layer just under it (ledge to the next row))
  const faceShade = (i) => { const h = i - KC + 1; return S.hang[h]?.tip && S.hang[h + 1]?.ledge ? S.stepShade : S.hang[h]?.ledge ? S.underShade : 0; };
  for (let j = 0; j + 1 < nc; j++) {
    const k = j + 1, crease = cols[j].creaseNext ? { valley: S.creaseShade } : {};
    for (let i = 0; i + 1 < NR; i++) {
      const hang = i >= KC - 1 ? { hang: true } : {}, step = faceShade(i);
      poly([oi[j][i], oi[k][i], oi[k][i + 1], oi[j][i + 1]], { ...(i === 0 && Math.max(cols[j].a, cols[k].a) <= S.partTo ? { valley: S.partShade } : i === 0 ? {} : crease), ...(step ? { valley: Math.max(step, crease.valley ?? 0) } : {}), ...hang });
      poly([ii[j][i], ii[j][i + 1], ii[k][i + 1], ii[k][i]], { valley: S.insideShade, inside: true, row: i, ...hang });
    }
    // the hem's rim
    poly([oi[j][NR - 1], oi[k][NR - 1], ii[k][NR - 1], ii[j][NR - 1]], { valley: S.rimShade, rim: true, hang: true });
  }
  // the front edges' rims, her right's and her left's
  for (const j of [0, nc - 1]) for (let i = 0; i + 1 < NR; i++) {
    const q = [oi[j][i], oi[j][i + 1], ii[j][i + 1], ii[j][i]];
    poly(j === 0 ? q : q.slice().reverse(), { valley: S.rimShade, rim: true, ...(i >= KC - 1 ? { hang: true } : {}) });
  }
  // orientation: outward on the outside (turned if the shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  for (const p of polys) if (!p.valley) delete p.valley;
  coverSkin(B, C, verts, polys, S.cover);
  const tris = trisOf(verts, polys);
  const pieces = [{ id: 'shag', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, centre: C, k: 1, hemY, grid: { cols, outer: oi, inner: ii } };
  // (the head's polygons drawn shaved: those the cap covers whole; those it covers any of, the scalp its inside may sink
  // into, left out of the crossings)
  hair.shave = scalpOf(B, C, hair, 'every', (p) => !p.hang);
  hair.scalp = scalpOf(B, C, hair, 'some', (p) => !p.rim);
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/**
 * The hair clear of the body at rest and in the game's clips' poses (tools/sculpt/hairs/shag-poses-<who>.json): a face
 * of it through the skin that is not the scalp it covers has its corners moved out `step` at a time (from the skull's
 * middle; below levelBelow, level out from the head's upright axis; through the shoulders, raised), an inner corner's
 * outer one with it so the shell keeps its least thickness, until none is.
 */
function clearBody(rig, hair, S, step = 0.006) {
  const { verts, grid } = hair, C = hair.centre, mate = new Map();
  grid.inner.forEach((col, j) => col.forEach((v, i) => { if (v !== grid.outer[j][i]) mate.set(v, grid.outer[j][i]); }));
  const poses = posesOf(rig.who);
  const states = [{ P: rig.B.verts, f: null, clip: 'rest' }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, clip: pose.$clip }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  // (each round only the states that had crossings the round before; when none has, every state again)
  let live = states;
  for (let it = 0; it < 120; it++) {
    let per = live.map(hitsIn);
    if (!per.some((h) => h.length) && live !== states) { live = states; per = live.map(hitsIn); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, k) => per[k].length);
    const hits = per.flat();
    const out = (p) => { const d = sub(p, C); return unit(p[1] < C[1] - S.levelBelow ? [d[0], 0, d[2]] : d); };
    const up = new Set(hits.filter(([, sp]) => rig.B.polys[sp].part === 'torso').flatMap(([hp]) => hair.polys[hp].v));
    for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) {
      const d = up.has(v) ? [0, 1, 0] : out(verts[v]);
      verts[v] = add(verts[v], mul(d, step));
      const o = mate.get(v);
      if (o !== undefined) {
        const gap = dot(sub(verts[o], verts[v]), d);
        if (gap < S.minThick * 0.5) verts[o] = add(verts[o], mul(d, S.minThick * 0.5 - gap));
      }
    }
  }
  hair.clearedIn = states.map(hitsIn).map((h) => h.length);
  hair.cleared = crossings(rig, hair, rig.B.verts, verts).n;
  return hair;
}

/** The shag on a body, as the game takes it; with `load` (a folder), the one saved there (--save) instead of building it. */
export const shagOf = (rig, style = SHAG, opts = {}) => (opts.load ? loadShag(rig, opts.load) : buildShag(rig, style, opts));
/** A built shag kept in a folder (`<dir>/shag-<who>.json`) and read back: building it with the clips' poses takes long. */
export const saveShag = (rig, hair, dir) => writeFileSync(join(dir, `shag-${rig.who}.json`), JSON.stringify(hair));
const loadShag = (rig, dir) => JSON.parse(readFileSync(join(dir, `shag-${rig.who}.json`), 'utf8'));

/** The shag alone into the game's copies: its entry in src/sculpt/assets/lowhair.json (each body's), its id in
 * lowhair-styles.json, and pressed under the leather hat in lowhat-<who>.json (tools/sculpt/garments/hat.mjs hatHair);
 * every other entry as it was. */
async function writeAsset(load) {
  const A = new URL('../../src/sculpt/assets/', import.meta.url);
  const hairFile = new URL('lowhair.json', A), H = JSON.parse(readFileSync(hairFile, 'utf8'));
  for (const who of ['male', 'female']) { const rig = buildRig(who), hair = shagOf(rig, SHAG, { load }); report(rig, hair); H[who].shag = gameHair(rig, hair); }
  writeFileSync(hairFile, JSON.stringify(H));
  const idx = new URL('lowhair-styles.json', A), I = JSON.parse(readFileSync(idx, 'utf8'));
  if (!I.styles.some((s) => s.id === 'shag')) I.styles.push({ id: 'shag', name: SHAG.name });
  writeFileSync(idx, `${JSON.stringify(I, null, 1)}\n`);
  // (hat.mjs reads lowhair.json as it loads: imported after it is written)
  const { buildHat, hatHair } = await import('./garments/hat.mjs');
  for (const who of ['male', 'female']) {
    const file = new URL(`lowhat-${who}.json`, A), G0 = JSON.parse(readFileSync(file, 'utf8')), rig = buildRig(who);
    const P = hatHair(rig, buildHat(rig), { style: 'shag' });
    G0.hair.shag = { ...H[who].shag, verts: P.verts.flat().map((x) => +x.toFixed(5)) };
    writeFileSync(file, JSON.stringify(G0));
    console.log(who, `shag under the hat: ${P.pressed.length} of ${P.verts.length} vertices pressed, least room ${P.room.toFixed(3)}, ${P.hatCross} crossing the hat`);
  }
}

/** The counts and the crossings at rest and with the head turned, printed. */
function report(rig, hair, t0 = Date.now()) {
  const who = rig.who;
  console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'columns', hair.grid.cols.length, 'hem y', hair.hemY.toFixed(3), 'crossing after clearing', JSON.stringify(hair.clearedIn?.reduce((a, x) => a + x, 0)), 'ms', Date.now() - t0);
  console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
  console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  if (args.includes('--asset')) await writeAsset(opt('load'));
  else for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = shagOf(rig, SHAG, { clear: !args.includes('--raw') });
    report(rig, hair, t0);
    if (opt('save')) saveShag(rig, hair, opt('save'));
  }
}
