// The side braid's braid fitted to its sheet: the spine's points (the first, the root behind her right ear, moved least)
// and each segment's width, so the hair's outline meets the sheet's five silhouettes (tools/sculpt/lowbraid.mjs
// outlineDiff, all five at once) while the braid stays out of her body (each of its corners inside her, by the body's
// voxels, a penalty, and each of its triangles through her skin another) and rests on her neck and shoulder (a gap
// between them a penalty). Coordinate descent. Each body its own (his neck and chest are not hers). Writes tools/sculpt/hairs/braid-spine.json { who: { spine, w } }, which
// hairs/braid.mjs takes over its own.
//
//   node tools/sculpt/lowbraidspine.mjs [--who female,male] [--rounds 3] [--fresh]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { carve, buildBraid, outlineDiff, bodyTris, bodyInside } from './lowbraid.mjs';
import { crossings } from './lowhair.mjs';

const FILE = new URL('./hairs/braid-spine.json', import.meta.url);
/** Each view's weight; a braid corner inside her body (per voxel's depth, pixels' worth); the pull back to the drawn
 * spine (per square head unit). */
const VW = { front: 1.3, q3: 1.2, profile: 1.3, r3: 0.8, back: 0.8 }, INSIDE = 40, HOME = 30, CROSS = 2;
/** The segments' least half-width, and the penalty on a segment's width against its neighbours' (per square unit). */
const W_MIN = 0.4, W_EVEN = 40, GAP = 60;

export async function fitSpine(rounds = 3, fresh = false, who = 'female') {
  const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  if (fresh) delete all[who];
  writeFileSync(FILE, JSON.stringify(all) + '\n');
  const style = (await import(`./hairs/braid.mjs?${Date.now()}`)).default;
  const H = carve(), rig = who === 'female' ? H.rig : buildRig(who), B = rig.B, body = bodyTris(B);
  const lo = [-1.4, -2.2, -1.3], vox = 0.03, n = [Math.ceil(2.8 / vox), Math.ceil(4.7 / vox), Math.ceil(2.8 / vox)];
  const inside = bodyInside(body, lo, n, vox);
  const isIn = (p) => { const i = Math.floor((p[0] - lo[0]) / vox), j = Math.floor((p[1] - lo[1]) / vox), k = Math.floor((p[2] - lo[2]) / vox); return i >= 0 && j >= 0 && k >= 0 && i < n[0] && j < n[1] && k < n[2] && inside[i + n[0] * (j + n[1] * k)] === 1; };
  const start = { ...style.braid, ...(style.braid.fits[who] ?? {}) };
  const home = structuredClone(style.braid.spine);
  let br = { ...style.braid, fits: {}, spine: structuredClone(start.spine), w: [...start.w] };
  const cost = (b) => {
    const hair = buildBraid(rig, { ...style, braid: b }, H, { clear: false });
    const d = outlineDiff(hair.tris.map(([a, c, e]) => [hair.verts[a], hair.verts[c], hair.verts[e]]), body);
    let c = 0; for (const [v, x] of Object.entries(d)) c += VW[v] * x.px;
    for (const pc of hair.pieces) if (pc.kind === 'braid' || pc.kind === 'tie') for (let i = pc.verts[0]; i < pc.verts[1]; i++) if (isIn(hair.verts[i])) c += INSIDE / 100;
    // the braid's triangles through her skin (the head's, the neck's, the chest's)
    const mine = (pi) => { const k = hair.pieces[hair.polys[pi].piece].kind; return k === 'braid' || k === 'tie'; };
    c += CROSS * crossings(rig, { ...hair, tris: hair.tris.filter(([, , , pi]) => mine(pi)), scalp: [] }, B.verts, hair.verts).n;
    for (let i = 1; i + 1 < b.w.length; i++) c += W_EVEN * (b.w[i] - b.w[i - 1]) ** 2;
    // resting on her: down the neck and over the shoulder the spine no further from her skin (toward the neck's middle)
    // than the braid's half-depth
    for (let m = 12; m <= 80; m += 4) {
      const p = hair.spine[m], d = [-p[0], 0, -0.15 - p[2]], l = Math.hypot(...d), want = hair.braidW[Math.min(hair.braidW.length - 1, Math.floor((m / 120) * 4))] * hair.depth * 0.6 + 0.03;
      let t = 0; while (t < 0.8 && !isIn(p.map((x, k) => x + (d[k] / l) * t))) t += 0.02;
      if (t > want) c += GAP * (t - want) ** 2;
    }
    b.spine.forEach((p, i) => { c += HOME * (i ? 0.2 : 1) * p.reduce((a, x, k) => a + (x - home[i][k]) ** 2, 0); });
    return c;
  };
  let best = cost(br);
  console.log('start', best.toFixed(2));
  for (let r = 0; r < rounds; r++) {
    const st = 0.08 / 2 ** r;
    for (let i = 0; i < br.spine.length; i++) for (let k = 0; k < 3; k++) for (const sg of [1, -1]) for (let it = 0; it < 5; it++) {
      const t = { ...br, spine: br.spine.map((p) => [...p]) }; t.spine[i][k] += sg * st;
      const f = cost(t); if (f < best) { best = f; br = t; } else break;
    }
    for (let i = 0; i < br.w.length; i++) for (const sg of [1, -1]) for (let it = 0; it < 5; it++) {
      const t = { ...br, w: [...br.w] }; t.w[i] = Math.max(W_MIN, t.w[i] + sg * st * 0.5);
      const f = cost(t); if (f < best) { best = f; br = t; } else break;
    }
    console.log('round', r, best.toFixed(2));
  }
  const out = { spine: br.spine.map((p) => p.map((x) => +x.toFixed(3))), w: br.w.map((x) => +x.toFixed(3)) };
  all[who] = out;
  writeFileSync(FILE, JSON.stringify(all) + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female').split(',')) console.log(who, JSON.stringify(await fitSpine(+opt('rounds', 3), args.includes('--fresh'), who)));
}
