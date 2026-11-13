// The mohawk (tools/sculpt/hairs/mohawk.mjs) for the low-poly bodies: the game's 'mohawk', "Mohawk". No sheet: built
// straight from the style's numbers on each body's own skull (tools/sculpt/lowhair.mjs skullOf), as one closed shell:
//
//   rings    along the head's middle line from the forehead's hairline (the head's t0) over the crown to past the back
//            of the skull (bk), each six corners: the border each side and the underside's middle sunk in the scalp,
//            a shoulder each side and the middle standing off it. A spike's ring: its middle the spike's tip (its
//            height off the skin, leaned back along the strip and swayed across), its shoulders a share of that, a
//            flank ring each side of it partway down (the cone's planes broken once); a valley's ring between two
//            spikes low on the scalp (the crest's body). Each face between two rings a triangle (a facet of its
//            own), so each spike shows its planes; the ends a fan to a point on the scalp.
//   shade    the faces down into a valley between two spikes and the strip's low sides in the valleys' tones
//            (src/sculpt/gl.ts HAIR_VALLEYS), the spikes' planes in the three lit tones.
//   sides    the head's own polygons shaved, and the buzz forward of them to the sideburn, as the swept back's
//            (tools/sculpt/lowhair.mjs shaveOf, buzzOf; tools/sculpt/hairs/swept.mjs shave, buzz).
//
// Rigid on the head. On the nape's polygons (which the neck moves too) the shell lies just off the skin instead of in it.
//
//   node tools/sculpt/lowmohawk.mjs [--who female,male]   # counts, open edges, crossings at rest and with the head turned
import { readFileSync } from 'node:fs';
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { skullOf, shaveOf, buzzOf, openEdges, skinHair, hairCrossings, crossings } from './lowhair.mjs';
import { crossReport, POSES } from './lowbob.mjs';
import MOHAWK from './hairs/mohawk.mjs';
import SWEPT from './hairs/swept.mjs';

const SIDES = { swept: SWEPT };
const DEG = Math.PI / 180;
/** A direction from the skull's centre: over the middle line (0 ahead, 90 up, 180 back), out toward the head's left. */
const dirOf = (over, out) => { const a = over * DEG, b = out * DEG; return [Math.sin(b), Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a)]; };
/** A point's angle over the middle line, seen from the skull's centre (-90..270). */
const overOf = (C, p) => { const d = sub(p, C); let a = Math.atan2(d[1], d[2]) / DEG; if (a < -90) a += 360; return a; };

/** The furthest crossing of a ray from o along unit d with triangles (three points each, each with its polygon,
 * .poly): { t (0 for none), poly }. */
function farHit(tris, o, d) {
  let best = 0, poly = -1;
  for (const tri of tris) {
    const [a, b, c] = tri, e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = dot(e2, q) / det; if (t > best) { best = t; poly = tri.poly; }
  }
  return { t: best, poly };
}
/** Linear through evenly spaced values, at u in [0, 1]. */
const along = (arr, u) => { const n = arr.length - 1, x = Math.min(n, Math.max(0, u * n)), i = Math.min(n - 1, Math.floor(x)); return n ? arr[i] + (arr[i + 1] - arr[i]) * (x - i) : arr[0]; };

/**
 * The mohawk on a body: { verts, polys: [{ v, piece, valley?, buzz? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, rings }.
 */
export function buildMohawk(rig, S = MOHAWK, { clear = true } = {}) {
  const B = rig.B, { tris: skull, centre: C } = skullOf(B);
  const N = (n) => B.verts[B.index.get(n)];
  // the skull's size against the male's (tools/sculpt/lowhair.mjs buildOnce's k)
  const k = (N('f3.L')[0] + N('t0')[2] - N('bk')[2]) / (0.73 + 0.739 + 0.79);
  const R = (over, out) => farHit(skull, C, dirOf(over, out)).t;
  // (a skin polygon the neck moves too, the nape's: the shell lies LIFT off it rather than sunk in it)
  const rigid = (pi) => B.polys[pi].v.every((i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3));
  const o0 = overOf(C, N('t0')) + S.front, oBk = overOf(C, N('bk')), o1 = oBk + S.back;
  const pt = (over, out, h) => { const d = dirOf(over, out), s = farHit(skull, C, d); return add(C, mul(d, s.t + (h < 0 && (!rigid(s.poly) || over > oBk - S.liftFrom) ? S.lift * k : h))); };
  const overAt = (u) => o0 + u * (o1 - o0);
  const sinkAt = () => -S.sink * k;
  // the rings: a valley at each end and between two spikes, a spike's ring at its middle and a flank each side
  const sp = S.spikes;
  const rows = [{ u: 0, kind: 'end' }];
  sp.forEach((s, i) => {
    // (a spike's flanks, a ring each side of its tip partway to the valley: its planes broken over a convex cone)
    const before = rows.at(-1).u, after = i + 1 < sp.length ? (s.at + sp[i + 1].at) / 2 : 1;
    rows.push({ u: s.at - S.flank.at * (s.at - before), kind: 'tip', s, f: S.flank });
    rows.push({ u: s.at, kind: 'tip', s });
    rows.push({ u: s.at + S.flank.at * (after - s.at), kind: 'tip', s, f: S.flank });
    rows.push({ u: after, kind: i + 1 < sp.length ? 'valley' : 'end' });
  });
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  const rings = rows.map((r) => {
    const over = overAt(r.u), W = along(S.width, r.u) * k, aw = W / R(over, 0) / DEG, sink = sinkAt(over);
    const n = dirOf(over, 0), t = dirOf(over + 90, 0);
    let L1, M, R1;
    if (r.kind === 'tip') {
      const H = r.s.h * k, lean = r.s.lean * DEG, up = add(mul(n, Math.cos(lean)), mul(t, Math.sin(lean)));
      // (a flank's middle and shoulders a share of the tip's and of its shoulders' heights)
      const fm = r.f?.h ?? 1, fs = r.f?.shoulder ?? 1;
      M = add(add(pt(over, 0, 0), mul(up, H * fm)), [r.s.sway * k * fm, 0, 0]);
      L1 = add(pt(over, aw * S.shoulder, 0), mul(up, H * S.shoulderH * fs));
      R1 = add(pt(over, -aw * S.shoulder, 0), mul(up, H * S.shoulderH * fs));
    } else {
      const f = r.kind === 'end' ? 0.5 : 1;
      M = pt(over, 0, S.valley * k * f);
      L1 = pt(over, aw * S.shoulder, S.valleyShoulder * k * f);
      R1 = pt(over, -aw * S.shoulder, S.valleyShoulder * k * f);
    }
    // (the corners round the ring: the left border, the left shoulder, the middle, the right shoulder, the right
    // border, the underside)
    return { ...r, over, v: [pt(over, aw, sink), L1, M, R1, pt(over, -aw, sink), pt(over, 0, sink)].map(V) };
  });
  // the ends: a point on the scalp a little beyond each end ring
  const fr = rings[0], bk = rings.at(-1);
  const F = V(pt(fr.over - 4, 0, sinkAt(fr.over))), Bp = V(pt(bk.over + 4, 0, sinkAt(bk.over)));
  // the faces: each a triangle, its own facet; per pair of rings, per side of the ring
  const tri = (a, b, c, sh = {}) => polys.push({ v: [a, b, c], piece: 0, ...sh });
  const quad = (a, b, c, d, sh) => {
    // (the shorter diagonal, so a spike's plane folds along its length)
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) { tri(a, b, c, sh); tri(a, c, d, sh); } else { tri(a, b, d, sh); tri(b, c, d, sh); }
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    const a = rings[r].v, b = rings[r + 1].v;
    // (the strip's low sides, a shoulder to the border, in the lighter valley tone; the upper faces lit)
    for (let j = 0; j < 6; j++) { const j1 = (j + 1) % 6; quad(a[j], a[j1], b[j1], b[j], j === 0 || j === 3 ? { valley: S.shadeLow } : {}); }
  }
  // (a face down into a valley between two spikes, one with a valley ring's middle for a corner, in the darker one)
  const notch = new Set(rings.filter((r) => r.kind === 'valley').map((r) => r.v[2]));
  for (const p of polys) if (!p.valley && p.v.some((v) => notch.has(v))) p.valley = S.shadeValley;
  for (let j = 0; j < 6; j++) {
    const j1 = (j + 1) % 6;
    tri(F, fr.v[j1], fr.v[j], j < 4 ? { valley: S.shadeLow } : {});
    tri(Bp, bk.v[j], bk.v[j1], j < 4 ? { valley: S.shadeLow } : {});
  }
  // orientation: outward (the faces were wound one way round; turned if the shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) vol += dot(verts[p.v[0]], cross(verts[p.v[1]], verts[p.v[2]]));
  if (vol < 0) for (const p of polys) p.v.reverse();
  const nShell = polys.length, nVerts = verts.length;
  // the sides: shaved and buzzed as the swept back's
  const side = SIDES[S.sides];
  if (side.buzz) buzzOf(B, side, verts, polys, k);
  const tris = [];
  polys.forEach((p, pi) => { for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]); });
  const hair = {
    verts, polys, tris, weights: verts.map(() => [['head', 1]]),
    pieces: [{ id: 'mohawk', kind: 'shell', polys: [0, nShell], verts: [0, nVerts] }],
    shave: shaveOf(B, side.shave), scalp: shaveOf(B, side.scalp ?? side.shave), centre: C, k, rings,
  };
  if (clear) clearBody(rig, hair);
  return hair;
}

/**
 * The shell clear of the body at rest and in the game's clips' poses (the idle, the walk, the swing, the emote:
 * tools/sculpt/hairs/bob-poses-<who>.json, written by tools/sculpt/lowbobanim.mjs --write, the clips' poses on that
 * body whatever its hair): a face of it through the skin that is not the scalp it sinks into (the nape's, which the
 * neck moves, and the face, the ears, the neck, the shoulders), and with the head turned and nodded
 * (tools/sculpt/lowbob.mjs POSES), has its corners moved out from the skull's centre
 * `step` at a time until none is.
 */
function clearBody(rig, hair, step = 0.004) {
  const { verts } = hair, C = hair.centre;
  let poses = [];
  try { poses = JSON.parse(readFileSync(new URL(`./hairs/bob-poses-${rig.who}.json`, import.meta.url), 'utf8')); } catch { /* none written */ }
  const states = [{ P: rig.B.verts, f: null }, ...[...Object.values(POSES), ...poses].map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  let moved = 0;
  for (let it = 0; it < 60; it++) {
    const hits = states.flatMap(hitsIn);
    if (!hits.length) break;
    for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) { verts[v] = add(verts[v], mul(unit(sub(verts[v], C)), step)); moved++; }
  }
  hair.clearedIn = states.map(hitsIn).map((h) => h.length);
  hair.moved = moved;
  return hair;
}

/** The mohawk on a body (the game's, tools/sculpt/lowhairasset.mjs). */
export const mohawkOf = (rig, style = MOHAWK) => buildMohawk(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const rig = buildRig(who), hair = mohawkOf(rig), shell = hair.polys.filter((p) => !p.buzz);
    const shellTris = hair.tris.filter(([, , , pi]) => !hair.polys[pi].buzz).length;
    console.log(who, 'tris', hair.tris.length, `(shell ${shellTris}, buzz ${hair.tris.length - shellTris})`, 'polys', hair.polys.length, 'verts', hair.verts.length, 'valleys', shell.filter((p) => p.valley).length, 'open edges', openEdges(hair), 'shaved polys', hair.shave.length, 'buzz patches', hair.polys.length - shell.length);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)), JSON.stringify(crossings(rig, hair, rig.B.verts, hair.verts).hits.map(([h, s]) => [h, rig.B.polys[s].name ?? rig.B.polys[s].v.map((i) => rig.B.names[i]).join(' ')])));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
    console.log(who, 'cleared off the body at rest and in', (hair.clearedIn?.length ?? 1) - 1, 'poses (the clips\', the head turned and nodded): corner steps', hair.moved, 'crossings left', hair.clearedIn?.reduce((a, b) => a + b, 0));
    const X = hairCrossings(rig, hair);
    console.log(who, 'the shell through the buzz where it shows', X.length);
  }
}
