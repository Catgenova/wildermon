// The chain set's hauberk and sleeves (one garment, worn for either item): mail over the trunk from a standing collar up
// the neck down under the belt, and down the arms to above the wrist, in courses of rings (chainmail.mjs mailShell); a
// leather belt at the waist, a rune line round it and a gold buckle at the front with a gem (glowing when enchanted); a
// skirt of mail from the belt to mid-thigh, split at the front and the back, each half flaring over the hip and the thigh,
// its hem a row of brass rings with the padded gambeson showing under it; the gambeson again at the cuffs, under the
// sleeves' brass hem, and round the collar's top; a gold clasp at the throat with its gem. Worn over bare skin: the body's
// polygons the mail covers whole are hidden (`hides`).
//
//   buildChainChest(rig, design?) → the mesh (chainmail.mjs chainMesh, its `hides`)
//
//   node tools/sculpt/garments/chainchest.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowchainchest-male.json and -female.json (lowgarment.mjs
//     garmentAsset, with `hides` and the `plain` and `enchanted` looks; loaded by src/sculpt/lowpoly.ts)
//
// The skirt: two halves round the hips' vertical axis, columns by azimuth (0 the front, 90 the body's left) from the slit
// to the slit behind, each column out from the axis by the hips' reach that way (the hull of the body's slab there,
// platechest.mjs sectioner) and the clearance, flaring as it falls, never in from the row above, and clear of the other
// sets' leggings (their assets' vertices at rest) by `gap`; its rows the courses of the trunk's mail on the same grid.
// Weighted from the pelvis at its top to a share of its side's thigh at its hem (more at the front than behind).
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { sub, add, mul, unit, closestOnBody } from '../lowgarment.mjs';
import { sectioner } from './platechest.mjs';
import { coreOn, hemRow, chainMesh, mailShell, coveredPolys, band, stud, facing, named, writePiece, linksOf, axisThrough, armBones } from './chainmail.mjs';

/** The courses' grid, shared by the set: their spacing, the ridge's height, the crest's place up a course and the foot's offset. */
export const COURSE = { male: { h: 0.36, d: 0.055, crest: 0.45, foot: 0 }, female: { h: 0.32, d: 0.05, crest: 0.45, foot: 0 } };

/**
 * The design per body (heights the body's y): the mail's offset off the trunk and the arm (`c`, `arm`); the collar's top
 * up the neck; the sleeve's hem over the wrist (`cuff` above the wrist's joint) and the gambeson cuff's foot (`under`
 * below it); the belt (its middle and width, its clearance over the mail); the skirt (its top under the belt, its hem,
 * its clearance at the top and its flare a unit fallen, the slits' half-width in degrees, the thigh's share at the hem
 * front and back, its columns' spacing); the gambeson's drop under the skirt's hem.
 */
export const DESIGN = {
  male: { cores: { y: -1.95, breast: 0.4, belt: 0.16 }, links: { w: 0.42, rT: 1.25, rA: 0.42, edge: 0.75, centre: 0.2 }, c: 0.05, arm: 0.045, collar: -0.18, cuff: 0.38, under: 0.06, belt: { y: -3.8, w: 0.42, c: 0.05 }, skirt: { top: -3.7, hem: -6.45, r: 1.5, c: 0.12, flare: 0.05, slit: 7, front: 0.7, back: 0.5, gap: 0.05, backing: { inset: 0.1, span: 6 } }, gambeson: 0.3 },
  female: { cores: { y: -1.75, breast: 0.34, belt: 0.14 }, links: { w: 0.38, rT: 1.0, rA: 0.34, edge: 0.75, centre: 0.2 }, c: 0.04, arm: 0.04, collar: -0.25, cuff: 0.34, under: 0.06, belt: { y: -3.3, w: 0.36, c: 0.045 }, skirt: { top: -3.22, hem: -5.4, r: 1.3, c: 0.11, flare: 0.06, slit: 7, front: 0.7, back: 0.5, gap: 0.045, backing: { inset: 0.09, span: 6 } }, gambeson: 0.26 },
};

/** The body's weights at the closest point of its surface (its triangles in `parts`), as { bone: w }. */
export function skinAt(rig, p, parts) {
  const { B } = rig, keep = parts ? B.tris.map((t) => t.v.every((i) => parts.includes(B.part[i]))) : null;
  const c = closestOnBody(B.verts, B.tris, p, keep), o = {};
  B.tris[c.tri].v.forEach((vi, k) => { for (const [b, w] of rig.vw[vi]) o[b] = (o[b] ?? 0) + w * c.w[k]; });
  return o;
}

/** Every set's legs garments at rest (their game copies' vertices: any asset named for legs, leggings or trousers), the skirt's obstacles. */
function legObstacles(who) {
  const out = [], dir = new URL('../../../src/sculpt/assets/', import.meta.url);
  // (every garment on the legs: its name has legs, leggings or trousers in it, whichever set it is from; not the leather
  // leggings' hip flaps, left off under the hauberk)
  for (const name of readdirSync(dir).filter((n) => new RegExp(`^low.*(legs|leggings|trousers).*-${who}\\.json$`).test(n) && !n.includes("flaps"))) {
    const f = new URL(name, dir);
    if (!existsSync(f)) continue;
    const v = JSON.parse(readFileSync(f, 'utf8')).verts;
    for (let i = 0; i < v.length; i += 3) out.push([v[i], v[i + 1], v[i + 2]]);
  }
  return out;
}

/**
 * The skirt's rows down from its top to its hem on the set's grid, per column (its arc `g` round the hips): each course
 * its top, its crest (high at a link's edges, low at its middle, every other course half a link round, as mailShell's
 * links) and its foot, each { ys, adds, kind }; then the gambeson under the hem.
 */
export function skirtRows(top, hem, g, { h, d, foot }, L, gambeson) {
  const R = [], shift = (k) => (k & 1 ? 0.5 : 0);
  const crestAt = (x, k) => { const v = x / L.w - shift(k), f = v - Math.floor(v); return L.edge + (L.centre - L.edge) * (1 - Math.abs(2 * f - 1)); };
  const prof = (u, cr) => (u >= cr ? (1 - u) / (1 - cr) : foot + (1 - foot) * (u / cr));
  for (let k = Math.floor(top / h - 1e-9); k * h + h > hem; k--) {
    const yT = Math.min((k + 1) * h, top), yF = Math.max(k * h, hem), hemC = yF === hem;
    const row = (kind, yOf) => { const ys = g.map((x) => yOf(x)); R.push({ kind, hem: hemC, ys, adds: ys.map((y, c) => d * prof(Math.max(0, Math.min(1, y / h - k)), crestAt(g[c], k))) }); };
    row('top', () => yT);
    row('crest', (x) => Math.max(yF, Math.min(yT, (k + crestAt(x, k)) * h)));
    row('foot', () => yF);
  }
  R.push({ kind: 'gam', ys: g.map(() => hem), adds: g.map(() => -0.04) }, { kind: 'gam', ys: g.map(() => hem - gambeson), adds: g.map(() => -0.04) });
  return R;
}

/**
 * Each column's radius from the hips' axis down it (columns by signed azimuth `az`, each its heights `ys[row][column]`):
 * the hips' reach, the clearance and the flare, clear of the obstacles by the gap and the slits' backing's room behind
 * the skirt (`Sk.back`), never in from the row above, then smoothed round each row, never in (a hem that falls as one
 * piece).
 */
function skirtRadii(Sk, sec, fz, obstacles, az, ys, half) {
  const R = az.map((a, c) => {
    const dir = [Math.sin((a * Math.PI) / 180), 0, Math.cos((a * Math.PI) / 180)];
    let prev = 0;
    return ys.map((row) => {
      const y = row[c], q = sec.at(y, a, 0), reach = Math.hypot(q[0], q[2] - fz);
      let r = reach + Sk.c + Sk.flare * (Sk.top - y);
      for (const p of obstacles) {
        if (Math.abs(p[1] - y) > 0.18) continue;
        const v = [p[0], 0, p[2] - fz], l = Math.hypot(v[0], v[2]);
        if (l < 1e-6 || (v[0] * dir[0] + v[2] * dir[2]) / l < Math.cos((half * Math.PI) / 180)) continue;
        r = Math.max(r, l + Sk.gap + Sk.backing.inset);
      }
      prev = Math.max(prev, r);
      return prev;
    });
  });
  for (let it = 0; it < 2; it++) R.forEach((col, c) => col.forEach((r, k) => { const m = (R[Math.max(0, c - 1)][k] + 2 * r + R[Math.min(R.length - 1, c + 1)][k]) / 4; col[k] = Math.max(r, m); }));
  return R;
}

/**
 * The gambeson behind a slit (centred on azimuth `at`, 0 the front, 180 the back): a panel `Sk.backing.inset` inside the
 * skirt, from its top down to the gambeson's foot, `Sk.backing.span` degrees either side of the slit, so whatever is worn
 * on the legs under the hauberk does not show through it; weighted from the pelvis to the thighs' mean (the skirt's share
 * at its middle).
 */
function slitBacking(G, rig, D, sec, fz, obstacles, at, tag) {
  const Sk = D.skirt, B = Sk.backing, a0 = Sk.slit + B.span, n = 6;
  const az = Array.from({ length: n + 1 }, (_, k) => at - a0 + (2 * a0 * k) / n);
  const top = Sk.top, foot = Sk.hem - D.gambeson, nr = Math.max(2, Math.ceil((top - foot) / 0.3));
  const ys = Array.from({ length: nr + 1 }, (_, r) => az.map(() => top + ((foot - top) * r) / nr));
  const R = skirtRadii(Sk, sec, fz, obstacles, az, ys, a0 / n + 6);
  const share = Sk.front + (Sk.back - Sk.front) * (at / 180);
  const wAt = (y) => { const u = Math.max(0, Math.min(1, (top - y) / (top - Sk.hem))), sh = share * u; return named(rig, { pelvis: 1 - sh, thigh_l: sh / 2, thigh_r: sh / 2 }); };
  const dirOf = (a) => [Math.sin((a * Math.PI) / 180), 0, Math.cos((a * Math.PI) / 180)];
  const ids = ys.map((row, r) => az.map((a, c) => G.add(add([0, row[c], fz], mul(dirOf(a), R[c][r] - B.inset)), wAt(row[c]), tag)));
  G.tag = tag;
  for (let r = 0; r < nr; r++) for (let c = 0; c < n; c++) {
    const q = [ids[r][c], ids[r][c + 1], ids[r + 1][c + 1], ids[r + 1][c]];
    G.polys.push({ v: facing(G, q, dirOf((az[c] + az[c + 1]) / 2)), mat: 'under', part: tag, tag });
  }
}

function skirtHalf(G, rig, D, s, sec, fz, obstacles, tag) {
  const Sk = D.skirt, C = COURSE[rig.who], L = D.links;
  // (the columns every half link round the hips at the skirt's radius, from the slit in front to the slit behind)
  const a0 = Sk.slit, a1 = 180 - Sk.slit, stepDeg = ((L.w / 2) / Sk.r) * (180 / Math.PI), az = [];
  for (let m = Math.ceil(a0 / stepDeg); m * stepDeg < a1 - 1e-6; m++) if (m * stepDeg > a0 + 1e-6) az.push(m * stepDeg);
  az.unshift(a0); az.push(a1);
  const g = az.map((a) => ((a * Math.PI) / 180) * Sk.r);
  const rows = skirtRows(Sk.top, Sk.hem, g, C, L, D.gambeson);
  const axisAt = (y) => [0, y, fz];
  const dirOf = (a) => [Math.sin((a * Math.PI) / 180) * s, 0, Math.cos((a * Math.PI) / 180)];
  const R = skirtRadii(Sk, sec, fz, obstacles, az.map((a) => a * s), rows.map((row) => row.ys), Math.max(stepDeg, 6));
  // (smoothed round each row, never in: a hem that falls as one piece)
  for (let it = 0; it < 2; it++) R.forEach((col, c) => col.forEach((r, k) => { const m = (R[Math.max(0, c - 1)][k] + 2 * r + R[Math.min(R.length - 1, c + 1)][k]) / 4; col[k] = Math.max(r, m); }));
  const thigh = s > 0 ? 'thigh_l' : 'thigh_r';
  const wAt = (a, y) => { const u = Math.max(0, Math.min(1, (Sk.top - y) / (Sk.top - Sk.hem))), sh = (Sk.front + (Sk.back - Sk.front) * (a / 180)) * u; return named(rig, { pelvis: 1 - sh, [thigh]: sh }); };
  const ids = rows.map((row, r) => az.map((a, c) => G.add(add(axisAt(row.ys[c]), mul(dirOf(a), R[c][r] + row.adds[c])), wAt(a, row.ys[c]), tag)));
  const inner = (r, c, t = 0.045) => { const p = G.verts[ids[r][c]]; return G.add(sub(p, mul(dirOf(az[c]), t)), G.w[ids[r][c]], tag); };
  G.tag = tag;
  for (let r = 0; r + 1 < rows.length; r++) for (let c = 0; c + 1 < az.length; c++) {
    const a = rows[r], b = rows[r + 1], q = [ids[r][c], ids[r][c + 1], ids[r + 1][c + 1], ids[r + 1][c]];
    const step = a.kind === 'foot' && b.kind === 'top';
    // (no step where the courses' feet sit on the skirt as their tops do)
    if (step && !(C.foot > 0)) continue;
    const mat = b.kind === 'gam' ? (a.kind === 'gam' ? 'under' : 'shade') : step ? 'shade' : a.hem ? (a.kind === 'top' ? 'rune' : 'gold') : a.kind === 'top' ? 'plate' : 'shade';
    facing(G, q, step ? [0, -1, 0] : dirOf((az[c] + az[c + 1]) / 2));
    G.polys.push({ v: q, mat, part: tag, tag });
  }
  // the slits' edges (gold) and the top and the gambeson's foot, turned in
  for (const c of [0, az.length - 1]) for (let r = 0; r + 1 < rows.length; r++) {
    if (rows[r].kind === 'foot' && rows[r + 1].kind === 'top') continue;
    const q = [ids[r][c], ids[r + 1][c], inner(r + 1, c), inner(r, c)], along = sub(G.verts[ids[r][c]], G.verts[ids[r][c === 0 ? 1 : c - 1]]);
    G.polys.push({ v: facing(G, q, along), mat: rows[r].kind === 'gam' ? 'under' : 'gold', part: tag, tag });
  }
  for (const r of [0, rows.length - 1]) for (let c = 0; c + 1 < az.length; c++) {
    const q = [ids[r][c], ids[r][c + 1], inner(r, c + 1), inner(r, c)];
    G.polys.push({ v: facing(G, q, [0, r === 0 ? 1 : -1, 0]), mat: r === 0 ? 'shade' : 'under', part: tag, tag });
  }
}

export function buildChainChest(rig, D = DESIGN[rig.who]) {
  const { B, J } = rig, C = COURSE[rig.who], G = chainMesh();
  const parts = (t) => t.v.map((i) => B.part[i]);
  const onArm = (t) => parts(t).some((p) => p === 'arm' || p === 'hand');
  const wristCut = J.wrist[1] + D.cuff, waistLo = D.belt.y - D.belt.w / 2 - 0.3;
  // the mail: the trunk from the collar's top down under the belt, the arms down to the cuff
  const TRUNK = new Set(['neck', 'torso', 'pelvis', 'joint', 'arm']);
  const mail = mailShell(G, rig, {
    tag: 'mail', ...C,
    keep: (t) => parts(t).every((p) => TRUNK.has(p)),
    lo: (t) => (onArm(t) ? wristCut : waistLo), hi: () => D.collar,
    c: (i) => (B.part[i] === 'arm' ? D.arm : D.c),
    mat: (f, up, t, k) => hemRow(C.h, { hi: D.collar, ...(onArm(t) ? { lo: wristCut } : {}) })(k, up) ?? (up ? 'plate' : 'shade'),
    links: linksOf(rig, { ...D.links, z0: J.spine3[2], limbs: [1, -1].map((s) => [s, armBones(s > 0 ? 'l' : 'r'), axisThrough([s * J.shoulder[0], J.shoulder[1], J.shoulder[2]], [s * J.wrist[0], J.wrist[1], J.wrist[2]]), D.links.rA]) }),
  });
  // the gambeson: at the cuffs (from under the sleeve's hem down over the wrist) and round the collar's top
  const cuff = mailShell(G, rig, {
    tag: 'gambeson cuff', h: 100, d: 0, crest: 0.5, foot: 1,
    keep: (t) => parts(t).every((p) => p === 'arm' || p === 'hand'),
    lo: () => J.wrist[1] - D.under, hi: () => wristCut + 0.12, c: () => D.arm * 0.6, mat: () => 'under', lipMat: 'under',
  });
  mailShell(G, rig, {
    tag: 'gambeson collar', h: 100, d: 0, crest: 0.5, foot: 1,
    keep: (t) => parts(t).every((p) => p === 'neck' || p === 'head'),
    lo: () => D.collar - 0.12, hi: () => D.collar + 0.13, c: () => D.c * 0.7, mat: () => 'under', lipMat: 'under',
  });
  // the belt: a band round the waist over the mail, the skin's weights under it
  const S = B.verts.map((p, i) => ({ p, part: B.part[i] })).filter((s) => ['torso', 'pelvis', 'legs'].includes(s.part)).map((s) => s.p);
  const fzOf = (y) => { const z = S.filter((p) => Math.abs(p[1] - y) < 0.2).map((p) => p[2]); return (Math.min(...z) + Math.max(...z)) / 2; };
  const fz = fzOf(D.belt.y);
  const trunk = sectioner(S.filter((p) => p[1] > D.skirt.hem - 3), { o: [0, 0, fz], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12, wedge: 8 });
  const ring = Array.from({ length: 24 }, (_, k) => k * 15);
  const off = D.c + C.d + D.belt.c, bY = [D.belt.y + D.belt.w / 2, D.belt.y + 0.04, D.belt.y - 0.04, D.belt.y - D.belt.w / 2];
  const beltRows = bY.map((y) => ring.map((a) => trunk.at(y, a, off)));
  // (each column no further in than the most of its rows, so the belt hangs straight)
  ring.forEach((a, k) => { const rr = Math.max(...beltRows.map((row) => Math.hypot(row[k][0], row[k][2] - fz))); beltRows.forEach((row) => { const p = row[k]; const d = unit([p[0], 0, p[2] - fz]); row[k] = [d[0] * rr, p[1], fz + d[2] * rr]; }); });
  const skin = ['torso', 'pelvis'];
  band(G, beltRows, { axis: (p) => [0, p[1], fz], t: 0.035, mat: (r) => (r === 1 ? 'rune' : 'leather'), edgeMat: 'leather', w: (p) => skinAt(rig, p, skin), tag: 'belt' });
  // its buckle at the front, its gem
  const front = beltRows[1][0], fr = add(front, [0, -0.04, 0]);
  stud(G, fr, [0, 0, 1], [1, 0, 0], { a: 0.22, b: 0.19, h: 0.04, w: skinAt(rig, front, skin), tag: 'buckle' });
  coreOn(G, add(fr, [0, 0, 0.04]), [0, 0, 1], [0, 1, 0], { r: D.cores.belt, w: skinAt(rig, front, skin), tag: 'buckle core' });
  // the breast's core, on the mail below the collar (the plate set's breast core's place)
  const breast = B.verts.reduce((best, p, i) => (B.part[i] === 'torso' && Math.abs(p[0]) < 0.25 && Math.abs(p[1] - D.cores.y) < 0.35 && (!best || p[2] > best[2]) ? p : best), null);
  coreOn(G, [0, D.cores.y, breast[2] + D.c + C.d + 0.01], [0, 0, 1], [0, 1, 0], { r: D.cores.breast, w: skinAt(rig, breast, ['torso']), tag: 'breast core' });
  // the clasp at the throat: on the collar's front, a gold diamond with its gem
  const neckFront = B.verts.reduce((best, p, i) => (B.part[i] === 'neck' && Math.abs(p[1] - (D.collar - 0.35)) < 0.25 && (!best || p[2] > best[2]) ? p : best), null);
  stud(G, add(neckFront, [0, 0, D.c + C.d + 0.02]), [0, 0.15, 1], [1, 0, 0], { a: 0.13, b: 0.16, h: 0.04, inset: 0.6, w: skinAt(rig, neckFront, ['neck', 'torso']), tag: 'clasp', diamond: true });
  // the skirt's two halves
  const hips = sectioner(S.filter((p) => p[1] > D.skirt.hem - 3.2 && p[1] < D.skirt.top + 0.5), { o: [0, 0, fz], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12 });
  const obstacles = legObstacles(rig.who);
  for (const s of [1, -1]) skirtHalf(G, rig, D, s, hips, fz, obstacles, s > 0 ? 'skirt.l' : 'skirt.r');
  // the gambeson behind the slits, in front and behind
  for (const at of [0, 180]) slitBacking(G, rig, D, hips, fz, obstacles, at, at ? 'slit backing.b' : 'slit backing.f');
  G.hides = coveredPolys(rig, (i) => mail.covered(i, 0.02) || cuff.covered(i, 0.02));
  return G;
}

if (import.meta.url === `file://${process.argv[1]}`) await writePiece('chainchest', buildChainChest, 'chainchest.mjs');
