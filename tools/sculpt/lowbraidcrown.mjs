// The side braid's crown clumps' heights solved against its sheet: per clump and station (each inner ring, and the
// blunt back end on the seam) a share of the section's heights over the hull, so the hair's outline meets the sheet's
// five silhouettes (tools/sculpt/lowbraid.mjs outlineDiff, all five at once), kept smooth along each clump. Coordinate
// descent from 1. Writes tools/sculpt/hairs/braid-crown.json { clump: [share per station] }, which hairs/braid.mjs
// takes.
//
//   node tools/sculpt/lowbraidcrown.mjs [--rounds 3] [--fresh]
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { carve, buildBraid, outlineDiff, bodyTris } from './lowbraid.mjs';

const FILE = new URL('./hairs/braid-crown.json', import.meta.url);
const VW = { front: 1.4, q3: 1.3, profile: 1.2, r3: 1, back: 1 }, SMOOTH = 4, LO = 0.6, HI = 1.8;

export async function solveCrown(rounds = 3, fresh = false) {
  if (fresh && existsSync(FILE)) rmSync(FILE);
  const style = (await import(`./hairs/braid.mjs?${Date.now()}`)).default;
  const H = carve(), rig = H.rig, body = bodyTris(rig.B);
  const M = Object.fromEntries(style.clumps.map((c) => [c.id, c.m ? [...c.m] : new Array(c.n - 1).fill(1)]));
  const cost = (Mx) => {
    const hair = buildBraid(rig, { ...style, clumps: style.clumps.map((c) => ({ ...c, m: Mx[c.id] })) }, H, { clear: false });
    const d = outlineDiff(hair.tris.map(([a, b, e]) => [hair.verts[a], hair.verts[b], hair.verts[e]]), body);
    let c = 0; for (const [v, x] of Object.entries(d)) c += VW[v] * x.px;
    for (const m of Object.values(Mx)) for (let i = 1; i < m.length; i++) c += SMOOTH * (m[i] - m[i - 1]) ** 2;
    return c;
  };
  let best = cost(M);
  console.log('start', best.toFixed(2));
  for (let r = 0; r < rounds; r++) {
    const st = 0.2 / 2 ** r;
    for (const id of Object.keys(M)) for (let i = 0; i < M[id].length; i++) for (const sg of [1, -1]) for (let it = 0; it < 4; it++) {
      const T = { ...M, [id]: [...M[id]] }; T[id][i] = Math.min(HI, Math.max(LO, T[id][i] + sg * st));
      const f = cost(T); if (f < best) { best = f; Object.assign(M, T); } else break;
    }
    console.log('round', r, best.toFixed(2));
  }
  const out = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v.map((x) => +x.toFixed(3))]));
  writeFileSync(FILE, JSON.stringify(out) + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  console.log(JSON.stringify(await solveCrown(+opt('rounds', 3), args.includes('--fresh'))));
}
