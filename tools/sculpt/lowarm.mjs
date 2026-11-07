// The low-poly arms with hands (male and female) for the reference sheets in tools/sculpt/ARM_SPEC.md and
// tools/sculpt/ARM_SPEC_FEMALE.md, drawn by tools/sculpt/lowarmshot.mjs and fitted by tools/sculpt/lowafit.mjs:
//
//   node tools/sculpt/lowarm.mjs [--who male|female]   # the triangle counts; the arm alone and torso plus arms closed
//
// Units are the low-poly head's and torso's: y up (the chin's underside at 0), z forward, x the body's left. The right
// arm (x < 0) is authored by name; the left is its mirror. Its shoulder end is the torso's arm cut (the ring da3 da4 da5
// db5 dc5 dc4 dc3 db3 of tools/sculpt/lowtorso.mjs, mirrored to the right), taken from the torso itself, so torso plus
// arms is one closed body and the arm follows any change to the torso.
//
// The arm is a tube of eight-sided rings from that ring (r) down, each ring's vertices round the arm in one order: 0 the
// front's outer corner, 1 the outer side, 2 the back's outer corner, 3 the back, 4 the back's inner corner, 5 the inner
// side (the armpit's), 6 the front's inner corner, 7 the front (as the torso's ring runs: da3 da4 da5 db5 dc5 dc4 dc3
// db3). The upper arm's rings ua..ue to the elbow el, the forearm's fa..ff (fg), then the six-sided wrist, the
// hand pronated as the sheets draw it (the back of the hand forward, the thumb toward the body):
//   wrist: wk the little finger's side, wb0 wb1 the back's corners, wt the thumb's side, wp1 wp0 the palm's corners;
//   the knuckle line kb0..kb4 across the back (little finger to index) and kp4..kp0 across the palm; the four-finger
//   mass in two rows, its middle line mb/mp and its tips nb/np (curled under), closed across the tips; sk the little
//   finger's side at its widest; the palm's diamond pa (by the wrist), pb (toward the little finger), pc (toward the
//   index) and td; the thumb's root ta tb tc td (ta tb the back's side, tc td the palm's; tb tc toward the index) and its two
//   segments t1a..t1d, t2a..t2d, closed at the tip.
// Shown alone, as the sheets show it, the arm is closed by the cap (part 'cap', the deltoid's ball: rings ca cb (cc) and the
// point ct) from its first ring ua up; joined to the torso (buildArmBody), the joint (part 'joint', the band from the
// torso's ring r to ua) takes the cap's place and the torso's own shoulder covers it.
//
// Parts: cap, arm, hand. Regions, for the colour-coded arm: deltoid, upper, forearm, hand.

import { existsSync, readFileSync } from 'node:fs';
import { buildLowTorso, buildLowBody, openEdges } from './lowtorso.mjs';
import { buildLowHead } from './lowhead.mjs';
import { buildLowLegs } from './lowlegs.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mx = (p) => [-p[0], p[1], p[2]];

export const TORSO_RING = ['da3', 'da4', 'da5', 'db5', 'dc5', 'dc4', 'dc3', 'db3'];
export const WRIST = ['wk', 'wb0', 'wb1', 'wt', 'wp1', 'wp0'];
// the last forearm ring's corners onto the wrist's: two pairs meet one wrist corner each (the back, the front's middle)
const WRIST_OF = ['wb0', 'wk', 'wp0', 'wp0', 'wp1', 'wt', 'wb1', 'wb1'];
const KNUCKLE = (p) => [`${p}b0`, `${p}b1`, `${p}b2`, `${p}b3`, `${p}b4`, `${p}p4`, `${p}p3`, `${p}p2`, `${p}p1`, `${p}p0`];
export const TOPO = {
  male: { cap: ['ca', 'cb', 'cc'], rings: ['ua', 'uc', 'ue', 'el', 'fa', 'fb', 'fc', 'fd', 'fe', 'fg'] },
  female: { cap: ['ca', 'cb', 'cc'], rings: ['ua', 'uc', 'ue', 'el', 'fa', 'fb', 'fd', 'ff'] },
};
const ring8 = (r) => Array.from({ length: 8 }, (_, i) => `${r}${i}`);
const REGION = (r) => (r === 'r' || r.startsWith('c') ? 'deltoid' : r.startsWith('u') ? 'upper' : 'forearm');

/** The faces of the right arm by vertex name: { v, part, region, name }. */
export function armFaces(who) {
  const T = TOPO[who], F = [];
  const f = (v, part, region, name) => F.push({ v, part, region, name: name ?? v.join('-') });
  const band = (A, B, part, region, tag) => A.forEach((a, i) => {
    const j = (i + 1) % A.length, v = [a, A[j], B[j], B[i]].filter((x, k, s) => s.indexOf(x) === k);
    f(v, part, region, `${tag}${i}`);
  });
  // the cap, shown alone: from the arm's first ring up to the point, over the torso's ring (the ball over the arm as the
  // sheets draw it; joined, the torso's own shoulder is there)
  const cap = [T.rings[0], ...T.cap];
  for (let k = 0; k + 1 < cap.length; k++) band(ring8(cap[k]), ring8(cap[k + 1]), 'cap', 'deltoid', `${cap[k + 1]}-`);
  ring8(cap.at(-1)).forEach((a, i) => f([a, `${cap.at(-1)}${(i + 1) % 8}`, 'ct'], 'cap', 'deltoid', `ct-${i}`));
  // the arm's rings
  const rings = ['r', ...T.rings];
  // the joint: from the torso's ring to the arm's first ring, on the body only
  for (let k = 0; k + 1 < rings.length; k++) band(ring8(rings[k]), ring8(rings[k + 1]), k ? 'arm' : 'joint', REGION(rings[k + 1] === 'el' ? 'ua' : rings[k]), `${rings[k]}-`);
  band(ring8(rings.at(-1)), WRIST_OF, 'arm', 'forearm', 'wr-');
  // the hand: the back, the sides and the palm from the wrist to the knuckle line, as the sheets' hand topology
  const h = (v, name) => f(v, 'hand', 'hand', name);
  // the back (the Hand Topology's back panel): the middle plane between the lines from the wrist's back corners to the
  // knuckles, the little finger's side plane out to its widest (sk), the thumb's side plane down to the thumb's root
  h(['wb0', 'wb1', 'kb3', 'kb2', 'kb1'], 'back of hand');
  h(['wk', 'wb0', 'kb1', 'kb0', 'sk'], 'back, little finger side');
  h(['wb1', 'wt', 'ta', 'tb'], 'back, thumb side');
  h(['wb1', 'tb', 'kb4', 'kb3'], 'back, by the index');
  h(['wt', 'td', 'ta'], 'thumb root, wrist side');
  h(['tb', 'tc', 'kp4', 'kb4'], 'web');
  h(['sk', 'kb0', 'kp0'], 'little finger side');
  // the palm (the palm panel): a facet at the wrist's thumb corner, the thumb's mound to its root (td), the diamond
  // pa pb pc td in the middle, the heel from the wrist to pb and sk, the palm's planes to the knuckle line
  h(['wt', 'wp1', 'pa'], 'thumb mound, wrist');
  h(['wt', 'pa', 'td'], 'thumb mound');
  h(['pa', 'pb', 'pc', 'td'], 'palm, middle');
  h(['wp1', 'wp0', 'pb', 'pa'], 'palm heel');
  h(['wp0', 'wk', 'sk', 'pb'], 'palm heel, little finger side');
  h(['pb', 'sk', 'kp0', 'kp1'], 'palm, little finger side');
  h(['pb', 'kp1', 'kp2', 'kp3', 'pc'], 'palm');
  h(['pc', 'kp3', 'kp4'], 'palm, by the index');
  h(['td', 'pc', 'kp4', 'tc'], 'palm, thumb side');
  // the four-finger mass: two rows of four strips, closed across the tips
  band(KNUCKLE('k'), KNUCKLE('m'), 'hand', 'hand', 'fingers ');
  band(KNUCKLE('m'), KNUCKLE('n'), 'hand', 'hand', 'finger tips ');
  for (let i = 0; i < 4; i++) h([`nb${i}`, `nb${i + 1}`, `np${i + 1}`, `np${i}`], `finger ends ${i}`);
  // the thumb
  const TR = ['ta', 'tb', 'tc', 'td'], T1 = ['t1a', 't1b', 't1c', 't1d'], T2 = ['t2a', 't2b', 't2c', 't2d'];
  band(TR, T1, 'hand', 'hand', 'thumb ');
  band(T1, T2, 'hand', 'hand', 'thumb tip ');
  h(T2, 'thumb end');
  return F;
}

/** Every vertex name the arm's faces use, but the torso's ring. */
export function armNames(who) {
  const s = new Set();
  for (const f of armFaces(who)) for (const n of f.v) if (!/^r\d$/.test(n)) s.add(n);
  return [...s];
}

/* ---- the two arms: the vertices fitted to the sheets (tools/sculpt/lowafit.mjs), kept in lowafit-<who>.json ------- */
export const PRESETS = {};
for (const who of Object.keys(TOPO)) {
  const file = new URL(`./lowafit-${who}.json`, import.meta.url);
  PRESETS[who] = { V: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).V : {} };
}

/** The torso's arm cut, mirrored to the right arm: r0..r7. */
export function torsoRing(who) {
  const t = buildLowTorso(who);
  return Object.fromEntries(TORSO_RING.map((n, i) => [`r${i}`, mx(t.V[n])]));
}

/** The right arm (side 1) or the left (side -1), alone: the cap closes it over its first ring. opts.cap false: for the
 * body, the joint from the torso's ring instead of the cap, open at that ring. */
export function buildLowArm(who = 'male', preset = null, opts = {}) {
  const P = preset ?? PRESETS[who];
  const side = opts.side ?? 1, withCap = opts.cap ?? true;
  const V = { ...P.V, ...(opts.ring ?? torsoRing(who)) };
  const verts = [], ids = {};
  for (const [n, p] of Object.entries(V)) { ids[n] = verts.length; verts.push(side > 0 ? [...p] : mx(p)); }
  const polys = [];
  for (const fc of armFaces(who)) {
    if (withCap ? fc.part === 'joint' : fc.part === 'cap') continue;
    for (const n of fc.v) if (!(n in ids)) throw new Error(`arm ${who}: no vertex ${n}`);
    polys.push({ v: fc.v.map((n) => ids[n]), part: fc.part, region: fc.region, mat: 'skin', name: fc.name + (side > 0 ? ':R' : ':L') });
  }
  orient(polys, verts);
  return finish({ verts, polys, V, ids });
}

/** Each polygon wound the same way as its neighbours (across every shared edge the two run opposite), then all turned
 * so the enclosed volume is positive (outward). An open arm (no cap) is closed for the volume by its ring's centre. */
export function orient(polys, verts) {
  const key = (a, b) => `${a}>${b}`;
  const owner = new Map();
  polys.forEach((p, pi) => p.v.forEach((a, i) => { const b = p.v[(i + 1) % p.v.length]; (owner.get(`${Math.min(a, b)}|${Math.max(a, b)}`) ?? owner.set(`${Math.min(a, b)}|${Math.max(a, b)}`, []).get(`${Math.min(a, b)}|${Math.max(a, b)}`)).push(pi); }));
  const done = new Array(polys.length).fill(false);
  for (let s = 0; s < polys.length; s++) {
    if (done[s]) continue;
    done[s] = true;
    const st = [s];
    while (st.length) {
      const pi = st.pop(), p = polys[pi];
      const dir = new Set(p.v.map((a, i) => key(a, p.v[(i + 1) % p.v.length])));
      p.v.forEach((a, i) => {
        const b = p.v[(i + 1) % p.v.length];
        for (const qi of owner.get(`${Math.min(a, b)}|${Math.max(a, b)}`)) {
          if (qi === pi || done[qi]) continue;
          const q = polys[qi];
          const same = q.v.some((c, k) => c === a && q.v[(k + 1) % q.v.length] === b);
          if (same) q.v.reverse();
          done[qi] = true; st.push(qi);
        }
      });
      void dir;
    }
  }
  // the volume (with the open rim's fan to its centroid, which changes nothing for a closed mesh)
  let vol = 0;
  for (const p of polys) for (let i = 1; i + 1 < p.v.length; i++) {
    const a = verts[p.v[0]], b = verts[p.v[i]], c = verts[p.v[i + 1]];
    vol += dot(a, cross(b, c));
  }
  if (vol < 0) for (const p of polys) p.v.reverse();
  return polys;
}

function finish(m) {
  const triList = [];
  m.polys.forEach((p, pi) => { for (const t of tris(p.v, m.verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { ...m, tris: triList, counts };
}

/** The hand's own frame, the wrist's: the wrist ring's centre O; y the ring's normal, up the arm (away from the
 * knuckles); x across the ring from the little finger's side (wk) to the thumb's (wt), square to y; z = x × y, out of
 * the back of the hand. So the stub the hand views show runs straight on from the wrist, as the sheets draw it, and the
 * hand's own vertices can move without turning it. */
export function handFrame(V) {
  const mean = (names) => [0, 1, 2].map((k) => names.reduce((a, n) => a + V[n][k], 0) / names.length);
  const O = mean(WRIST), kn = mean(['kb2', 'kp2']);
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  let n = [0, 0, 0];
  WRIST.forEach((w, i) => { const a = V[w], b = V[WRIST[(i + 1) % 6]]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; });
  let y = unit(n);
  if (dot(y, sub(O, kn)) < 0) y = y.map((q) => -q);
  const d = sub(V.wt, V.wk), x = unit(sub(d, y.map((q) => q * dot(d, y)))), z = cross(x, y);
  return { O, x, y, z };
}

/** The hand alone, as the sheets' hand views show it: the hand and a straight six-sided stub of the wrist, `stub` (head
 * units) up the hand's own line from the wrist's ring, cut flat; in the hand's own frame (handFrame), as the sheets turn
 * the hand about its own line. */
export function buildHandAlone(who = 'male', preset = null, stub = 0.35) {
  const arm = buildLowArm(who, preset, {});
  const F = handFrame(arm.V), n = F.y.map((q) => q * stub);
  const local = (p) => { const d = sub(p, F.O); return [dot(d, F.x), dot(d, F.y), dot(d, F.z)]; };
  const verts = [], polys = [], ids = {};
  const vtx = (name, p) => { ids[name] = verts.length; verts.push(local(p)); };
  for (const f of armFaces(who)) if (f.part === 'hand') for (const name of f.v) if (!(name in ids)) vtx(name, arm.V[name]);
  WRIST.forEach((w) => vtx(`s${w}`, [0, 1, 2].map((k) => arm.V[w][k] + n[k])));
  for (const f of armFaces(who)) if (f.part === 'hand') polys.push({ v: f.v.map((x) => ids[x]), part: 'hand', region: 'hand', mat: 'skin', name: f.name });
  WRIST.forEach((w, i) => { const w2 = WRIST[(i + 1) % 6]; polys.push({ v: [ids[w], ids[w2], ids[`s${w2}`], ids[`s${w}`]], part: 'hand', region: 'forearm', mat: 'skin', name: `stub ${i}` }); });
  polys.push({ v: WRIST.map((w) => ids[`s${w}`]), part: 'hand', region: 'forearm', mat: 'skin', name: 'wrist cut' });
  orient(polys, verts);
  const V = Object.fromEntries(Object.entries(arm.V).map(([k, p]) => [k, local(p)]));
  return finish({ verts, polys, V, ids, frame: F });
}

/** Head, torso, legs and both arms as one body: the torso's arm cuts give way to the arms (their joints, not their
 * caps), its hip cut to the legs (tools/sculpt/lowlegs.mjs). */
export function buildArmBody(who = 'male', preset = null) {
  const body = buildLowBody(who);
  const verts = [], polys = [], at = new Map();
  const take = (m, keep) => {
    const map = new Map();
    m.polys.forEach((p) => {
      if (!keep(p)) return;
      const v = p.v.map((i) => {
        if (!map.has(i)) {
          const k = m.verts[i].map((x) => x.toFixed(6)).join(',');
          if (at.has(k)) map.set(i, at.get(k)); else { verts.push([...m.verts[i]]); at.set(k, verts.length - 1); map.set(i, verts.length - 1); }
        }
        return map.get(i);
      });
      polys.push({ ...p, v });
    });
  };
  take(body, (p) => !(p.name ?? '').startsWith('arm cut') && p.name !== 'hip cut');
  take(buildLowLegs(who), () => true);
  for (const side of [1, -1]) take(buildLowArm(who, preset, { side, cap: false }), () => true);
  return finish({ verts, polys });
}

/** Each polygon in triangles: a quad split so it folds outward, a larger polygon ear-clipped in its own plane. */
export function tris(v, verts) {
  if (v.length === 3) return [v];
  if (v.length === 4 && verts) {
    const [a, b, c, d] = v.map((i) => verts[i]);
    const behind = dot(cross(sub(b, a), sub(c, a)), sub(d, a)) < 0;
    return behind ? [[v[0], v[1], v[2]], [v[0], v[2], v[3]]] : [[v[0], v[1], v[3]], [v[1], v[2], v[3]]];
  }
  const pts = v.map((i) => verts[i]);
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) n = [n[0] + cross(pts[i], pts[(i + 1) % pts.length])[0], n[1] + cross(pts[i], pts[(i + 1) % pts.length])[1], n[2] + cross(pts[i], pts[(i + 1) % pts.length])[2]];
  const u = Math.abs(n[0]) < 0.9 * Math.hypot(...n) ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]), w = cross(n, u);
  const P2 = pts.map((p) => [dot(p, u), dot(p, w)]);
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let sgn = 0; for (let i = 0; i < P2.length; i++) sgn += area2([0, 0], P2[i], P2[(i + 1) % P2.length]);
  const idx = v.map((_, i) => i), out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 500) {
    let cut = -1;
    for (let k = 0; k < idx.length && cut < 0; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      if (area2(P2[a], P2[b], P2[c]) * sgn <= 1e-12) continue;
      const inside = idx.some((q) => q !== a && q !== b && q !== c && area2(P2[a], P2[b], P2[q]) * sgn > 0 && area2(P2[b], P2[c], P2[q]) * sgn > 0 && area2(P2[c], P2[a], P2[q]) * sgn > 0);
      if (!inside) cut = k;
    }
    if (cut < 0) cut = 0;
    const a = idx[(cut + idx.length - 1) % idx.length], b = idx[cut], c = idx[(cut + 1) % idx.length];
    out.push([v[a], v[b], v[c]]); idx.splice(cut, 1);
  }
  out.push(idx.map((i) => v[i]));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--who');
  for (const who of i < 0 ? ['male', 'female'] : [args[i + 1]]) {
    const m = buildLowArm(who);
    const budget = who === 'male' ? [200, 350] : [180, 320];
    const j = buildLowArm(who, null, { cap: false }).counts;
    const arm = m.counts.arm + m.counts.cap, hand = m.counts.hand;
    console.log(who, JSON.stringify(m.counts), `arm with its cap ${arm} (${j.arm + j.joint} joined; budget ${budget.join('-')}${arm >= budget[0] && arm <= budget[1] ? ', in' : ', OUT'}), hand ${hand} (budget 80-150${hand >= 80 && hand <= 150 ? ', in' : ', OUT'})`);
    console.log('  arm alone: edges not shared by exactly two faces', openEdges(m).length);
    console.log('  hand alone (the sheets\' hand views): open edges', openEdges(buildHandAlone(who)).length);
    const own = new Set(openEdges(buildLowHead(who)).map(([k]) => k));
    const seam = openEdges(buildArmBody(who)).filter(([k]) => !own.has(k));
    console.log('  head + torso + legs + both arms: edges not shared by exactly two faces (past the head\'s own open strips)', seam.length);
  }
}
