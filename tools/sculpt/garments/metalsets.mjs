// The metal sets: for each metal with a set of its own, its helm, chest & arms, shawl, leggings and boots, on both
// low-poly bodies, made out of the body itself (tools/sculpt/garments/metalkit.mjs). Each piece's plates are `plate` and
// `shade` (drawn in the piece's metal: src/sculpt/lowpoly.ts plateMat), its glow `rune` (lit in the enchantment's colour).
//
//   node tools/sculpt/garments/metalsets.mjs [--set copper] [--only chest]
//     writes src/sculpt/assets/lowmetal<set><piece>-<who>.json for helm, chest, mantle, legs and boots.
import { writeFileSync } from 'node:fs';
import {
  browTheta, cape, chestFront, cloak, disc, feet, forearms, fromFront, helm, hips, shins, shoulderCaps, shoulders, torso, upperArms, waistOf as waistAt,
} from './metalkit.mjs';
import {
  add, assetOf, bodyOf, browsOf, dome, clamp, cross, dot, frameOf, len, lerp, likeBody, limbAt, loft, merge, mul, onBone, ring, shell, smooth, sub, unit,
} from './metalkit.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ASSETS = new URL('../../../src/sculpt/assets/', import.meta.url);
const frac = (x) => x - Math.floor(x);
const y = (p) => p[1];

/** How far a point's weight is on these parts. */
const on = (B, i, ...parts) => parts.reduce((s, p) => s + B.share(i, p), 0);
/** Where a point is round the torso: radians from the front, toward the body's left. */
const roundTorso = (p) => Math.atan2(p[0], p[2]);
/** A limb's own frame for a point: along it and round it (from its front), on the side the point is on. */
const armAt = (B, p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, up: limbAt(p, B.at.shoulder[s], B.at.elbow[s]), fore: limbAt(p, B.at.elbow[s], B.at.wrist[s]) }; };
const legAt = (B, p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, thigh: limbAt(p, B.at.hip[s], B.at.knee[s]), shin: limbAt(p, B.at.knee[s], B.at.ankle[s]) }; };

/* ==== copper: the Bronze Age warrior (the Dendra panoply, Mycenaean) ============================================= */
const COPPER_MATS = {
  // (its own copper, deeper than the plate set's tint, lit as metal: the game's copper is too near a light skin)
  cu: { c: '#a8522a', kind: 3 },
  cuS: { c: '#6a3016', kind: 3 },
  seam: { c: '#3b2016', kind: 2 },
  patina: { c: '#4f9a80', kind: 2 },
  rune: { c: '#6f8f78', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  cloth: { c: '#9b3324', kind: 2 },
  clothD: { c: '#6e2219', kind: 2 },
  clothW: { c: '#9b3325', kind: 2 },
  leather: { c: '#6e3f2a', kind: 2 },
  leatherD: { c: '#43261b', kind: 2 },
  leatherL: { c: '#a4734b', kind: 2 },
  tusk: { c: '#eadbb2', kind: 2 },
  tuskS: { c: '#cdb98c', kind: 2 },
  plume: { c: '#b13a22', kind: 2 },
  plumeD: { c: '#7c2416', kind: 2 },
  hide: { c: '#5e3a26', kind: 2 },
  hideL: { c: '#8a5d3d', kind: 2 },
  hideEdge: { c: '#2f1d15', kind: 2 },
  sole: { c: '#33231b', kind: 2 },
};
const waistOf = (A) => lerp(A.spine1, A.pelvis, 0.45)[1];

/** The copper cuirass's depth off the body at a point: its bands each stepped out below the last, its foot flared, its collar raised. */
/** The hoops, from the collar down: each `HOOP` deep, numbered from the top. */
const copperHoop = (A) => (A.neck[1] - 0.45 - waistOf(A)) / 6;
const copperBand = (A, yy) => clamp(Math.floor((A.neck[1] - 0.45 - yy) / copperHoop(A)), 0, 6);
const copperCuirassOff = (A, p) => {
  const neckCut = A.neck[1] - 0.3, waist = waistOf(A);
  const flare = 0.16 * smooth(lerp(A.spine1, A.pelvis, 0.1)[1], waist, y(p)), collar = y(p) > neckCut - 0.05 && Math.abs(p[0]) < 0.75 ? 0.06 : 0.12 * smooth(neckCut - 0.35, neckCut + 0.1, y(p));
  // (each hoop out a little at its foot, over the top of the one below)
  const f = frac((A.neck[1] - 0.45 - y(p)) / copperHoop(A));
  return 0.13 + 0.018 * copperBand(A, y(p)) + 0.035 * f + flare + collar;
};

function copperChest(B) {
  const A = B.at, waist = waistOf(B.at), neckCut = A.neck[1] - 0.3;
  const bandAt = (yy) => copperBand(A, yy);
  const H = copperHoop(A), edge = (yy) => { const f = frac((A.neck[1] - 0.45 - yy) / H); return Math.min(f, 1 - f) * H; };
  const disc = [0, lerp(A.chest, A.spine2, 0.35)[1]];
  // (the torso's shell with the shoulders' tops in it, the cuirass's bands over the chest and back, the shoulders' tops dark copper under the plates)
  const cuirass = torso(B, {
    from: waist,
    collar: 0,
    off: (p) => copperCuirassOff(A, p),
    mat: (p, n) => {
      const yy = y(p), e = edge(yy);
      if (yy > neckCut - 0.05 && Math.abs(p[0]) < 0.75) return 'cuS';
      if (e < 0.05) return 'seam';
      if (e < 0.08) return 'cuS';
      // a row of rivets along each band's top edge, glowing when enchanted
      // a row of rivets along each hoop's foot, glowing when enchanted; the hoop's face lit, its foot in shadow
      const f = frac((A.neck[1] - 0.45 - yy) / H);
      if (f > 0.62 && f < 0.82 && frac((roundTorso(p) / (2 * Math.PI)) * 30) < 0.32) return 'rune';
      if (f > 0.82) return 'cuS';
      if (f < 0.2) return 'patina';
      void disc; void n; void bandAt;
      return 'cu';
    },
    rim: 'cuS', thick: 0.08,
    caps: { off: () => 0.2, mat: () => 'cuS' },
  });
  // the shoulder plates: a domed plate over each shoulder, a lame under it
  const pauldrons = shell(B, {
    sub: 2, hide: false,
    keep: (i) => { const p = B.V[i]; if (Math.abs(p[0]) < 0.95) return false; const a = armAt(B, p); return on(B, i, 'upperarm', 'shoulder') > 0.35 && a.up.t < 0.36 && a.up.t > -0.3 && dot(B.N[i], unit([Math.sign(p[0]), 0.5, 0])) > 0.15 && !(B.N[i][2] < -0.35 && a.up.t < 0.1) && !(B.N[i][2] > 0.45 && a.up.t > 0.12); },
    off: ({ p }) => { const t = armAt(B, p).up.t; return 0.04 + (t < 0.17 ? 0.32 - 0.5 * (t + 0.05) ** 2 : t < 0.22 ? 0.18 : 0.29 - 0.2 * (t - 0.22)); },
    mat: ({ p }) => { const t = armAt(B, p).up.t; if (t >= 0.17 && t < 0.22) return 'seam'; if (t > 0.3) return 'cuS'; if (t < 0.17 && t > 0.1) return 'patina'; return 'cu'; },
    rim: 'cuS', thick: 0.08,
  });
  // the linen under: short sleeves of the red tunic
  const sleeves = shell(B, {
    sub: 1,
    keep: (i) => { const p = B.V[i]; const t = armAt(B, p).up.t; return on(B, i, 'upperarm', 'shoulder') > 0.5 && t > 0.12 && t < 0.6 && Math.abs(p[0]) > 0.8 && !(t < 0.4 && dot(B.N[i], [Math.sign(p[0]), 0, 0]) < -0.2); },
    off: ({ p }) => 0.09 + (armAt(B, p).up.t > 0.5 ? 0.02 : 0),
    mat: ({ p }) => (armAt(B, p).up.t > 0.5 ? 'clothD' : 'cloth'),
    rim: 'clothD', thick: 0.04,
  });
  // a bracer on each forearm: leather, a copper band at each end, a glowing line down its back
  const bracer = shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i]; const t = armAt(B, p).fore.t; return on(B, i, 'forearm') > 0.5 && t > 0.4 && t < 0.93; },
    off: ({ p }) => { const t = armAt(B, p).fore.t; return 0.07 + (t < 0.5 || t > 0.84 ? 0.035 : 0); },
    mat: ({ p }) => { const f = armAt(B, p).fore; if (f.t < 0.5 || f.t > 0.84) return 'cu'; return Math.abs(Math.abs(f.a) - Math.PI / 2) < 0.22 ? 'rune' : 'leather'; },
    rim: 'leatherD', thick: 0.05,
  });
  return merge(cuirass, pauldrons, sleeves, bracer);
}

function copperLegs(B) {
  const A = B.at, waist = waistOf(A);
  const skirtFoot = (s) => lerp(A.hip[s], A.knee[s], 0.6)[1];
  // the red kilt under: the hips and the thighs to above the knee, its waist left out under a chest piece
  const kilt = shell(B, {
    sub: 1,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; const inner = dot(B.N[i], [-Math.sign(p[0]), 0, 0]); return on(B, i, 'thigh', 'torso') > 0.6 && on(B, i, 'calf') < 0.3 && y(p) < waist + 0.25 && y(p) > A.hip[s][1] - 0.25 && !(inner > 0.35 && y(p) < A.hip[s][1] + 0.1) && !(inner > -0.05 && y(p) < A.hip[s][1] - 0.35) && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    off: ({ p }) => 0.09 + 0.07 * smooth(A.hip.l[1], lerp(A.hip.l, A.knee.l, 0.6)[1], y(p)),
    mat: ({ p }) => (y(p) > waist - 0.1 ? 'clothW' : y(p) < lerp(A.hip.l, A.knee.l, 0.64)[1] ? 'clothD' : 'cloth'),
    rim: 'clothD', thick: 0.04,
  });
  // the strips: leather, hung from the waist, each with a copper tip, the gaps between open
  const strips = shell(B, {
    sub: 2, hide: false,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; if (y(p) > waist - 0.05 || y(p) < skirtFoot(s) - 0.05) return false; if (on(B, i, 'thigh', 'torso') < 0.6) return false; const inner = dot(B.N[i], [-Math.sign(p[0]), 0, 0]); return !(inner > 0.35 && y(p) < A.hip[s][1] + 0.1) && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    off: ({ p }) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.13 + 0.12 * smooth(waist, skirtFoot(s), y(p)); },
    mat: ({ p }) => {
      const s = p[0] >= 0 ? 'l' : 'r', a = (roundTorso(p) + Math.PI) / (2 * Math.PI), k = frac(a * 20);
      if (k < 0.1) return null;
      if (y(p) > waist - 0.28) return 'leatherD';
      if (y(p) < skirtFoot(s) + 0.3) return k > 0.3 && k < 0.85 ? 'cu' : 'cuS';
      return k > 0.45 && k < 0.6 ? 'leatherD' : 'leather';
    },
    rim: 'leatherD', thick: 0.05,
  });
  // the greaves: copper, shaped to the calf, over the knee's front, open down the back, a glowing line round the top and down the shin
  const greaves = shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i]; const g = legAt(B, p).shin; return on(B, i, 'calf', 'thigh') > 0.5 && g.t > -0.12 && g.t < 0.88 && Math.abs(g.a) < (g.t < 0.18 ? 1.7 : 2.35); },
    off: ({ p }) => { const g = legAt(B, p).shin; return 0.12 + 0.05 * Math.exp(-(((g.t - 0.3) / 0.22) ** 2)) + (g.t < 0.08 ? 0.05 : 0); },
    mat: ({ p }) => { const g = legAt(B, p).shin; if (g.t < 0.08) return 'cuS'; if (g.t > 0.13 && g.t < 0.19) return 'rune'; if (Math.abs(g.a) < 0.13 && g.t > 0.19 && g.t < 0.78) return 'rune'; if (Math.abs(g.a) > 2.0 || g.t > 0.8) return 'cuS'; if (Math.abs(Math.abs(g.a) - 1.3) < 0.1) return 'patina'; return 'cu'; },
    rim: 'cuS', rimIn: 0.03,
  });
  return { P: merge(kilt, strips, greaves), dropAt: (f) => f.mat === 'clothW' };
}

function copperBoots(B) {
  const A = B.at;
  // the sandal-boot: light leather, a dark sole, three dark straps (the toes, the instep, the ankle), a copper toe tip and a copper cuff
  const strapAt = (p, s) => {
    const h = y(p) - A.floor, fwd = p[2] - A.ankle[s][2];
    if (Math.abs(fwd - (A.ball[s][2] - A.ankle[s][2]) * 0.95) < 0.13 && h < 0.5) return true;
    if (Math.abs(fwd - (A.ball[s][2] - A.ankle[s][2]) * 0.45) < 0.12 && h < 0.75) return true;
    return Math.abs(y(p) - (A.ankle[s][1] + 0.12)) < 0.09;
  };
  const keepB = (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.5 && y(p) < A.ankle[s][1] + 0.75; };
  // (the boot's top: its highest point, the cuff and the glowing band under it measured down from there)
  const topY = Math.max(...B.V.filter((_, i) => keepB(i)).map((p) => p[1]));
  const boots = shell(B, {
    sub: 2,
    keep: keepB,
    off: ({ p, n }) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.075 + (n[1] < -0.6 ? 0.04 : 0) + (strapAt(p, s) ? 0.03 : 0) + (y(p) > topY - 0.3 ? 0.03 : 0); },
    mat: ({ p, n }) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (n[1] < -0.55) return 'sole';
      if (p[2] > A.ball[s][2] + 0.28 && y(p) < A.ball[s][1] + 0.25) return 'cu';
      if (y(p) > topY - 0.3) return y(p) > topY - 0.12 ? 'cu' : 'rune';
      return strapAt(p, s) ? 'leatherD' : 'leatherL';
    },
    rim: 'leatherD', thick: 0.04,
  });
  boots.soles = boots.V.map((p, i) => i).filter((i) => boots.V[i][1] < A.floor + 0.12);
  return boots;
}

/** Where a helm's dome is centred on a body: in the head, a little above its bone. */
const headCentre = (B) => [0, B.at.head[1] + 0.72 * (B.at.top - B.at.head[1]) / 1.6, B.at.head[2] + 0.05];
/** The head's points a helm is fitted over: the head and the top of the neck, not the eyes nor the brows. */
const headPts = (B) => { const eye = new Set(B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0])); return (i) => !eye.has(i) && B.V[i][1] > B.at.neck[1] + 0.05 && on(B, i, 'head', 'neck') > 0.3; };
/** A direction's polar angle (from up) at a point seen from the head's centre. */
const thetaOf = (B, p) => { const c = headCentre(B), v = sub(p, c); return Math.acos(clamp(v[1] / len(v), -1, 1)); };

function copperHelm(B) {
  const A = B.at, c = headCentre(B);
  // (the brow: just above the brows, seen from the centre)
  const browTh = thetaOf(B, [0, A.head[1] + 0.62, A.head[2] + 0.9]);
  const ROWS = [0.42, browTh - 0.22];
  const rowOf = (th) => (th - ROWS[0]) / ((ROWS[1] - ROWS[0]) / 2);
  const side = (ph) => Math.abs(Math.atan2(Math.sin(ph), Math.cos(ph)));
  const cap = dome(B, {
    c, keep: headPts(B), down: 2.2, rows: 26, cols: 36, cone: 0.6, thick: 0.08, rim: 'cuS',
    margin: ({ th, ph }) => {
      // (drawn up to a blunt cone, as the tusk helms were)
      const cone = 0.32 * Math.max(0, 1 - th / ROWS[1]) ** 2;
      if (th < ROWS[0]) return 0.09 + cone;
      if (th < ROWS[1]) { const f = frac(rowOf(th)); return 0.08 + cone + (f > 0.15 ? 0.07 * (1 - f) + 0.03 : 0); }
      return 0.1;
    },
    mat: (d, { th, ph }) => {
      const s = side(ph);
      // the face open below the brow, the cheek guards down each side, the neck guard behind
      // (the face open below the brow; the cheek guards down each side to the jaw; the neck guard behind)
      if (th > browTh && s < 0.72) return null;
      if (th > browTh + 0.75) return s > 2.3 && th < 2.12 ? 'cu' : null;
      if (th < ROWS[0]) return 'cu';
      // (the rows of tusk plates, each plate set off from the next, the rows staggered)
      if (th < ROWS[1]) { const f = frac(rowOf(th)), k = frac((ph / (2 * Math.PI)) * 18 + (Math.floor(rowOf(th)) % 2) * 0.5); return f < 0.15 ? 'seam' : f > 0.86 || k < 0.1 ? 'tuskS' : 'tusk'; }
      if (th < ROWS[1] + 0.09) return 'rune';
      if (th < browTh + 0.02) return 'cuS';
      // the cheek guards: dark copper, a glowing ring on each
      if (th > browTh + 0.05 && s < 2.2) { const r = Math.hypot(th - (browTh + 0.38), (s - 1.1) * 0.9); if (r > 0.09 && r < 0.15) return 'rune'; return r <= 0.09 ? 'cu' : 'cuS'; }
      return 'cu';
    },
  });
  // the crown's knob and its plume, streaming back
  const head = onBone(B, 'head');
  const top = cap.V.reduce((b2, p) => (p[1] > b2[1] ? p : b2), [0, -99, 0]);
  const knob = loft([ring(8, -0.05, 0.16, 0.16), ring(8, 0.1, 0.13, 0.13), ring(8, 0.18, 0.07, 0.07)], 'cu', { o: top, X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }, head);
  const plume = [];
  // (a full horsehair crest: seven locks, the middle ones longest, fanned a little)
  for (let k = 0; k < 7; k++) {
    const sx = (k - 3) * 0.045, base = add(top, [sx, 0.16, 0.02]), long = 1 - Math.abs(k - 3) * 0.12;
    const path = [[0, 0, 0], [0, 0.3, -0.25], [0, 0.26, -0.75], [0, -0.1, -1.15], [0, -0.6, -1.35]].map((q) => [q[0] + sx * 1.6 * (q[2] < 0 ? -q[2] : 0), q[1] * long - Math.abs(sx) * 0.5, q[2] * long]);
    const rings = path.map((q, j) => { const w = 0.08 * (1 - j / 5) + 0.025; return [add(q, [-w, 0, 0]), add(q, [0, w * 0.8, 0]), add(q, [w, 0, 0]), add(q, [0, -w * 0.5, 0])]; });
    plume.push(loft(rings, (cc, i) => (i >= 3 ? 'plumeD' : 'plume'), { o: base, X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }, head));
  }
  const P = merge(cap, knob, ...plume);
  for (const b2 of browsOf(B)) P.hides.add(b2);
  return P;
}

function copperMantle(B) {
  const A = B.at, hang = lerp(A.spine1, A.pelvis, 0.35)[1];
  // the bull hide: over the left shoulder and hung straight down the back to the hips, its foot clear of the back
  const backZ = Math.min(...B.V.filter((p) => p[1] < A.chest[1] && p[1] > A.pelvis[1] - 0.6).map((p) => p[2])) - 0.42;
  const cape = shell(B, {
    sub: 2, hide: false,
    keep: (i) => {
      const p = B.V[i], n = B.N[i];
      if (on(B, i, 'torso', 'shoulder', 'neck') < 0.6 || on(B, i, 'upperarm') > 0.02 || on(B, i, 'shoulder') > 0.5) return false;
      if (y(p) > A.neck[1] + 0.05) return false;
      // (as wide as the shoulder blades at the top, narrowing to the small of the back, its foot cut on the slant from the left)
      const wide = Math.min(A.shoulder.l[0] * 0.76, A.shoulder.l[0] - 0.5) - 0.3 * A.shoulder.l[0] * smooth(A.chest[1], hang, y(p));
      if (n[2] < 0.1) return y(p) > hang + 0.25 * (p[0] < 0 ? -p[0] : 0) && Math.abs(p[0]) < wide && n[2] < -0.2 + (y(p) > A.spine2[1] ? 0.3 : 0);
      return p[0] > 0.3 && p[0] < wide && y(p) > A.chest[1] - 0.05;
    },
    off: ({ p, n }) => {
      // (clear of the cuirass under it, and of its shoulder plates where it crosses the shoulder)
      return copperCuirassOff(A, p) + 0.16 + 0.05 * clamp(-n[2]) + (Math.abs(p[0]) > 0.6 && y(p) > A.chest[1] ? 0.12 : 0);
    },
    // (below the shoulder blades the back's points let straight back onto a plane behind the body: it hangs, it does not cling)
    move: ({ p, n }) => (n[2] >= 0.1 ? [0, 0, 0] : [0, 0, -smooth(A.chest[1] + 0.1, A.spine2[1] - 0.2, y(p)) * Math.max(0, p[2] - backZ) * 0.8]),
    mat: ({ p }) => {
      if (y(p) < hang + 0.2) return 'hideEdge';
      const h = Math.sin(p[0] * 3.1 + y(p) * 1.9) + 0.7 * Math.sin(p[0] * 1.7 - y(p) * 2.9 + 1.3);
      return h > 0.95 ? 'hideL' : 'hide';
    },
    rim: 'hideEdge', thick: 0.06,
  });
  // the brooch: a copper disc on the left breast, a glowing ring round its boss
  const chest = onBone(B, 'spine_03');
  const at = B.V.reduce((b, p, i) => (B.N[i][2] > 0.6 && Math.abs(p[0] - 0.55) < 0.25 && Math.abs(y(p) - (A.chest[1] + 0.35)) < 0.3 && p[2] > b[2] ? p : b), [0, 0, -9]);
  const o = add(at, [0, 0, 0.3]), place = { o, X: [1, 0, 0], Y: [0, 0, 1], Z: [0, -1, 0] };
  const disc = loft([ring(12, 0, 0.32, 0.32), ring(12, 0.06, 0.32, 0.32), ring(12, 0.07, 0.25, 0.25), ring(12, 0.07, 0.19, 0.19), ring(12, 0.08, 0.13, 0.13), ring(12, 0.14, 0.08, 0.08)],
    (c, i) => (i === 2 ? 'rune' : i === 3 ? 'patina' : i >= 4 ? 'cuS' : 'cu'), place, chest);
  return merge(cape, disc);
}

/* ==== iron: the early medieval foot soldier (the Norman and the Norseman) ========================================== */
const IRON_MATS = {
  hoseW: { c: '#5a4637', kind: 2 },
  fe: { c: '#7d8590', kind: 3 },
  feS: { c: '#4d535c', kind: 3 },
  rivet: { c: '#a9b0ba', kind: 3 },
  rune: { c: '#5f7f9a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  mail: { c: '#6f7680', kind: 3 },
  mailD: { c: '#3f444b', kind: 3 },
  gam: { c: '#3f5677', kind: 2 },
  gamD: { c: '#2a3a52', kind: 2 },
  wool: { c: '#4f6247', kind: 2 },
  woolD: { c: '#34412f', kind: 2 },
  hose: { c: '#5a4636', kind: 2 },
  hoseD: { c: '#3c2e24', kind: 2 },
  leather: { c: '#6b4630', kind: 2 },
  leatherD: { c: '#3e281c', kind: 2 },
  sole: { c: '#2e211a', kind: 2 },
};
/** The iron coat's depth: the gambeson under it, the lamellar over the chest and the back, a step at each row's foot. */
const ironRow = (A) => (A.chest[1] + 0.35 - waistOf(A)) / 5;
const ironCoat = (A, p) => { const r = frac((A.chest[1] + 0.35 - y(p)) / ironRow(A)); return y(p) < A.chest[1] + 0.35 && y(p) > waistOf(A) - 0.6 ? 0.19 + 0.03 * r + 0.09 * smooth(A.chest[1] - 0.2, A.chest[1] + 0.35, y(p)) : y(p) > waistOf(A) ? 0.13 : 0.09; };

function ironChest(B) {
  const A = B.at, waist = waistOf(A), R = ironRow(A), top = A.chest[1] + 0.35;
  // the gambeson to the hips, the iron coat of lames over it from the chest down, a belt at the waist
  const coat = torso(B, {
    from: waist - 0.6,
    off: (p) => ironCoat(A, p) + (Math.abs(y(p) - waist) < 0.1 ? 0.05 : 0),
    mat: (p) => {
      if (Math.abs(y(p) - waist) < 0.1) return Math.abs(p[0]) < 0.12 && p[2] > 0 ? 'rivet' : 'leatherD';
      if (y(p) >= top || y(p) < waist - 0.6) return frac((p[0] + y(p)) * 2.2) < 0.15 || frac((p[0] - y(p)) * 2.2) < 0.15 ? 'gamD' : 'gam';
      const r = frac((top - y(p)) / R), col = frac((roundTorso(p) / (2 * Math.PI)) * 26);
      if (r > 0.86) return 'feS';
      if (r < 0.2 && col > 0.4 && col < 0.6) return 'rune';
      if (col < 0.07) return 'feS';
      return 'fe';
    },
    rim: 'feS',
    caps: { off: () => 0.15, mat: (p) => (frac((p[0] + y(p)) * 2.2) < 0.15 ? 'gamD' : 'gam') },
  });
  // square shoulder plates, two lames
  const pl = shoulders(B, {
    off: (t) => (t < 0.12 ? 0.3 : 0.33),
    mat: (t) => (t > 0.1 && t < 0.15 ? 'feS' : t > 0.3 ? 'feS' : frac(t * 9) < 0.15 ? 'rivet' : 'fe'),
  });
  // the gambeson's long sleeves, quilted
  // (the armpit's front fold, and the arm's inner side where it faces front or back, on his body only: hers lies against
  // the arm and crosses it in the walk)
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.09), mat: (u, p) => (frac(u.t * 7) < 0.18 ? 'gamD' : 'gam') });
  // the vambraces: iron bands over the sleeve's end, a glowing band at the wrist
  const vamb = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.1 + (f.t > 0.3 ? 0.04 : 0), mat: (f) => { if (f.t < 0.3) return frac(f.t * 8) < 0.2 ? 'gamD' : 'gam'; if (f.t > 0.8) return 'rune'; return frac(f.t * 7) < 0.25 ? 'feS' : 'fe'; } });
  return merge(coat, pl, sleeves, vamb);
}

function ironLegs(B) {
  const A = B.at, waist = waistOf(A);
  // wool trousers, the waist left out under a chest piece
  const hose = hips(B, { inner: 0.3, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 0.85)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - 0.75 ? 'hoseW' : frac(y(p) * 1.4) < 0.1 ? 'hoseD' : 'hose'), rim: 'hoseD' });
  // the knee cops and the splints down the shin, a glowing rim round each cop
  const shin = shins(B, {
    from: -0.18, to: 0.85, round: 1.35,
    off: (g) => (g.t < 0.12 ? 0.2 + 0.08 * Math.cos(g.a) * (1 - Math.abs(g.t) * 5) : 0.13),
    mat: (g) => { if (g.t < 0.12) return g.t < -0.11 || g.t > 0.1 ? 'rune' : 'fe'; if (g.t < 0.17) return 'leatherD'; const k = frac((g.a + 1.35) / 2.7 * 4); return k < 0.12 ? 'hoseD' : frac(g.t * 6) < 0.1 ? 'rivet' : 'fe'; },
    rim: 'feS',
  });
  // the trousers' shins under the splints
  const calves = shins(B, { from: 0.12, to: 0.9, round: 3.2, off: () => 0.07, mat: () => 'hose', rim: 'hoseD' });
  return { P: merge(hose, calves, shin), dropAt: (f) => f.mat === 'hoseW' };
}

function ironBoots(B) {
  const A = B.at;
  return feet(B, {
    up: 0.75,
    off: (p, n, top) => (y(p) > top - 0.22 ? 0.03 : 0),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.22) return y(p) > top - 0.08 ? 'fe' : 'rune';
      if (Math.abs(y(p) - (A.ankle[s][1] - 0.05)) < 0.06) return 'feS';
      return p[2] > A.ball[s][2] + 0.2 ? 'leatherD' : 'leather';
    },
    rim: 'leatherD',
  });
}

function ironHelm(B) {
  const browTh = browTheta(B), top0 = 0.5;
  return helm(B, {
    rim: 'feS', down: 2.22,
    margin: ({ th }) => 0.1 + 0.42 * Math.max(0, 1 - th / 1.2) ** 1.6,
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      // the face open below the brow but for the nasal; the mail falling round the sides and the back
      if (th > browTh && s < 0.95 && !(s < 0.12 && th < browTh + 0.55)) return null;
      if (th > browTh + 0.08) { if (s < 0.12) return 'fe'; return frac(th * 18 + (Math.floor(ph * 10) % 2) * 0.5) < 0.5 ? 'mail' : 'mailD'; }
      if (th > browTh - 0.12) return frac(ph * 12 / (2 * Math.PI)) < 0.25 ? 'rune' : 'feS';
      // the four ribs of the frame, riveted
      const rib = frac(ph / (Math.PI / 2) + 0.5);
      if (rib < 0.08 || rib > 0.92) return th > top0 && frac(th * 6) < 0.25 ? 'rivet' : 'feS';
      return 'fe';
    },
  });
}

function ironMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // a wool cloak over both shoulders and down the back to the seat, its edge and its lining darker; a square iron pin at
  // the right shoulder
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.2, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.88 * sx, 0, 0], [0.74 * sx, 0, 0], smooth(0, 0.5, s))[0],
    over: [ironChest(B)],
    off: () => 0.18, thick: 0.04,
    hang: lerp(A.spine1, A.pelvis, 0.8)[1], folds: 7, fold: 0.12,
    mat: (p, u, s) => (Math.abs(u) > 0.93 || s > 0.96 ? 'woolD' : frac(s * 9) < 0.08 ? 'woolD' : 'wool'),
    rim: 'woolD',
  });
  // (the pin on the cloak's front edge over the right shoulder)
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.2, 0, 'feS'], [0.2, 0.05, 'fe'], [0.15, 0.06, 'rune'], [0.1, 0.06, 'feS'], [0.06, 0.1, 'fe']]);
  return merge(cloth, pin);
}

/* ==== bronze: the hoplite (Classical Greece) ======================================================================= */
const BRONZE_MATS = {
  brz: { c: '#8f7330', kind: 3 },
  brzS: { c: '#4d3a16', kind: 3 },
  brzL: { c: '#c4a552', kind: 3 },
  rune: { c: '#8a6a3a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  linen: { c: '#e6dcc4', kind: 2 },
  linenD: { c: '#b8aa88', kind: 2 },
  linenW: { c: '#e6dcc5', kind: 2 },
  crest: { c: '#a3261c', kind: 2 },
  crestD: { c: '#2a2220', kind: 2 },
  red: { c: '#8e2a1f', kind: 2 },
  redD: { c: '#5c1913', kind: 2 },
  leather: { c: '#5a3a26', kind: 2 },
  leatherD: { c: '#35231a', kind: 2 },
  sole: { c: '#2b1d16', kind: 2 },
};
/** The muscle cuirass's depth: the chest's two pectorals and the belly's six, raised; the foot flared over the hips. */
const bronzeCuirassOff = (A, p) => {
  const ax = Math.abs(p[0]), waist = waistOf(A);
  const pec = 0.07 * Math.exp(-(((ax - 0.48) / 0.32) ** 2) - (((y(p) - (A.chest[1] + 0.25)) / 0.32) ** 2));
  const absRow = frac((A.chest[1] - 0.35 - y(p)) / 0.42), inAbs = y(p) < A.chest[1] - 0.3 && y(p) > waist + 0.05 && ax < 0.42;
  const abs = inAbs && p[2] > 0 ? 0.035 * Math.sin(Math.PI * absRow) * Math.cos((ax / 0.42) * Math.PI * 0.5) : 0;
  return 0.16 + (p[2] > 0 ? pec + abs : 0) + 0.12 * smooth(waist + 0.35, waist - 0.25, y(p));
};

function bronzeChest(B) {
  const A = B.at, waist = waistOf(A);
  // the muscle cuirass, to the hips; its pectorals and belly raised and outlined; a glowing line round its foot
  const coat = torso(B, {
    from: waist - 0.5,
    off: (p) => bronzeCuirassOff(A, p),
    mat: (p) => {
      const ax = Math.abs(p[0]);
      if (y(p) < waist - 0.32) return y(p) < waist - 0.42 ? 'brzS' : 'rune';
      if (p[2] > 0) {
        // (the pectorals' foot, the line down the breastbone, the belly's rows)
        const pecFoot = A.chest[1] - 0.05 - 0.25 * (1 - Math.min(1, ax / 0.75));
        if (Math.abs(y(p) - pecFoot) < 0.05 && ax < 0.8) return 'brzS';
        if (ax < 0.04 && y(p) < A.chest[1] + 0.3) return 'brzS';
        if (y(p) < A.chest[1] - 0.3 && y(p) > waist + 0.05 && ax < 0.42 && frac((A.chest[1] - 0.35 - y(p)) / 0.42) < 0.1) return 'brzS';
        if (Math.abs(ax - 0.48) < 0.18 && Math.abs(y(p) - (A.chest[1] + 0.3)) < 0.12) return 'brzL';
      }
      return 'brz';
    },
    rim: 'brzS',
    caps: { off: () => 0.2, mat: (p) => (frac(p[2] * 2.2) < 0.12 ? 'linenD' : 'linen') },
  });
  // the chiton's short sleeves, linen
  const sleeves = upperArms(B, { from: -0.35, to: 0.5, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.09), mat: (u) => (u.t > 0.44 ? 'linenD' : 'linen') });
  // the bracers: leather, a bronze band at each end, a glowing line between
  const bracer = forearms(B, { from: 0.35, to: 0.93, off: (f) => 0.09 + (f.t < 0.42 || f.t > 0.86 ? 0.04 : 0), mat: (f) => (f.t < 0.42 || f.t > 0.86 ? 'brz' : Math.abs(f.t - 0.64) < 0.03 ? 'rune' : 'leather') });
  return merge(coat, sleeves, bracer);
}

function bronzeLegs(B) {
  const A = B.at, waist = waistOf(A);
  const skirtFoot = (s) => lerp(A.hip[s], A.knee[s], 0.5)[1];
  // the chiton's hem under: the hips and the thighs' tops, its waist left out under a chest piece
  const chiton = hips(B, { inner: -0.05, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 0.4)[1], off: (p) => 0.09 + 0.05 * smooth(A.hip.l[1], skirtFoot('l'), y(p)), mat: (p) => (y(p) > waist - 0.1 ? 'linenW' : 'linen'), rim: 'linenD' });
  // the pteruges: two rows of linen strips from the waist, each edged, a glowing line round the upper row's foot
  const strips = shell(B, {
    sub: 2, hide: false,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; if (y(p) > waist - 0.32 || y(p) < skirtFoot(s) - 0.05) return false; if (on(B, i, 'thigh', 'torso') < 0.6) return false; const inner = dot(B.N[i], [-Math.sign(p[0]), 0, 0]); return !(inner > 0.35 && y(p) < A.hip[s][1] + 0.1) && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    // (from under the cuirass's foot, inside its rim, flaring out below it)
    off: ({ p }) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.11 + 0.17 * smooth(waist - 0.5, skirtFoot(s), y(p)); },
    mat: ({ p }) => {
      const s = p[0] >= 0 ? 'l' : 'r', a = (roundTorso(p) + Math.PI) / (2 * Math.PI), mid = lerp([waist, 0, 0], [skirtFoot(s), 0, 0], 0.45)[0];
      const k = frac(a * 22 + (y(p) < mid ? 0.5 : 0));
      if (k < 0.08) return null;
      if (Math.abs(y(p) - mid) < 0.06) return 'rune';
      return k < 0.2 || k > 0.9 ? 'linenD' : 'linen';
    },
    rim: 'linenD', thick: 0.04,
  });
  // the greaves: bronze, shaped to the knee and the calf, sprung round the leg, open behind; a glowing spiral on the knee
  const greaves = shins(B, {
    from: -0.16, to: 0.9, round: 2.5,
    off: (g) => 0.12 + 0.07 * Math.exp(-(((g.t - 0.32) / 0.2) ** 2)) * (Math.abs(g.a) > 0.6 ? 1 : 0.4) + (g.t < 0.08 ? 0.06 * Math.cos(g.a) : 0),
    mat: (g) => {
      if (g.t < 0.08) { const r = Math.hypot(g.t + 0.04, g.a * 0.25); return frac(r * 14 - Math.atan2(g.a, g.t + 0.04) / (2 * Math.PI)) < 0.25 ? 'rune' : 'brzL'; }
      if (g.t > 0.84 || Math.abs(g.a) > 2.3) return 'brzS';
      if (Math.abs(g.a) < 0.05) return 'brzS';
      return 'brz';
    },
    rim: 'brzS',
  });
  return { P: merge(chiton, strips, greaves), dropAt: (f) => f.mat === 'linenW' };
}

function bronzeBoots(B) {
  const A = B.at;
  // the endromides: dark leather laced up the front in linen, a turned-down flap at the top over a glowing band
  return feet(B, {
    up: 0.85,
    off: (p, n, top) => (y(p) > top - 0.18 ? 0.05 : 0),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.18) return y(p) > top - 0.06 ? 'leatherD' : 'leather';
      if (y(p) > top - 0.27) return 'rune';
      const fwd = p[2] - A.ankle[s][2], across = p[0] - A.ankle[s][0];
      if (fwd > 0.15 && y(p) > A.floor + 0.35 && Math.abs(across) < 0.3) { const l = frac((y(p) * 3 + across * 3.2)), r = frac((y(p) * 3 - across * 3.2)); if (l < 0.18 || r < 0.18) return 'linen'; }
      return p[2] > A.ball[s][2] + 0.2 ? 'leatherD' : 'leather';
    },
    rim: 'leatherD',
  });
}

function bronzeHelm(B) {
  const browTh = browTheta(B);
  const P = helm(B, {
    rim: 'brzS', down: 2.2,
    // (a crest-box down the middle, front to back, raised as a ridge)
    margin: ({ th, ph }) => { const mid = Math.min(fromFront(ph), Math.PI - fromFront(ph)); return 0.1 + (th < 1.35 && mid < 0.2 ? 0.45 * (1 - mid / 0.2) ** 0.4 * Math.min(1, (1.35 - th) / 0.3) : 0) + 0.12 * Math.max(0, 1 - th / 1.1); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph), mid = Math.min(s, Math.PI - s);
      if (th < 1.35 && mid < 0.2) return mid < 0.06 ? 'crestD' : 'crest';
      // the Corinthian face: closed but for the eyes and the slit down the mouth, the nasal between the eyes
      if (th > browTh + 0.02 && th < browTh + 0.3 && s > 0.1 && s < 0.6) return null;
      if (th > browTh + 0.45 && s < 0.09) return null;
      if (Math.abs(th - browTh) < 0.06) return s < 1.3 ? 'rune' : 'brzS';
      if (th > browTh && (Math.abs(s - 0.1) < 0.03 || Math.abs(s - 0.6) < 0.04) && th < browTh + 0.32) return 'brzS';
      return th > 2.15 ? 'brzS' : 'brz';
    },
  });
  return P;
}

function bronzeMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the chlamys: red wool over both shoulders and down the back, a key-pattern border at its foot and its sides; a bronze
  // disc pinning it over the right shoulder
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.2, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.88 * sx, 0, 0], [0.7 * sx, 0, 0], smooth(0, 0.5, s))[0],
    over: [bronzeChest(B)],
    off: () => 0.18, thick: 0.04,
    hang: lerp(A.spine1, A.pelvis, 0.85)[1], folds: 5, fold: 0.15,
    mat: (p, u, s) => {
      if (s > 0.88 || Math.abs(u) > 0.9) { const k = frac(u * 10) < 0.5 !== frac(s * 30) < 0.5; return s > 0.97 || Math.abs(u) > 0.97 ? 'redD' : k ? 'linenD' : 'redD'; }
      return 'red';
    },
    rim: 'redD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.22, 0, 'brzS'], [0.22, 0.05, 'brz'], [0.17, 0.06, 'rune'], [0.11, 0.06, 'brzL'], [0.06, 0.1, 'brz']]);
  return merge(cloth, pin);
}

/* ==== steel: the Milanese harness (Italy, the fifteenth century) ===================================================== */
const STEEL_MATS = {
  st: { c: '#b9c0c8', kind: 3 },
  stS: { c: '#6d747d', kind: 3 },
  stD: { c: '#4a5058', kind: 3 },
  brass: { c: '#b8953f', kind: 3 },
  rune: { c: '#7b8aa0', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  velvet: { c: '#26386a', kind: 2 },
  velvetD: { c: '#18244a', kind: 2 },
  arming: { c: '#7a2420', kind: 2 },
  armingD: { c: '#521714', kind: 2 },
  armingW: { c: '#7a2421', kind: 2 },
  leather: { c: '#4a3021', kind: 2 },
  sole: { c: '#2a1e17', kind: 2 },
};
/** The breastplate's depth: a ridge down its middle, the plackart over its lower half, the faulds stepped below the waist. */
const steelPlateOff = (A, p) => {
  const ax = Math.abs(p[0]), waist = waistOf(A);
  const ridge = p[2] > 0 ? 0.05 * Math.max(0, 1 - ax / 0.25) : 0;
  const plackart = y(p) < A.chest[1] - 0.35 && y(p) > waist - 0.05 ? 0.05 : 0;
  const fauld = y(p) <= waist - 0.05 ? 0.07 + 0.03 * frac((waist - 0.05 - y(p)) / 0.17) : 0;
  return 0.17 + ridge + plackart + fauld;
};

function steelChest(B) {
  const A = B.at, waist = waistOf(A);
  const coat = torso(B, {
    from: waist - 0.55,
    off: (p) => steelPlateOff(A, p),
    mat: (p) => {
      const ax = Math.abs(p[0]);
      if (y(p) <= waist - 0.05) return frac((waist - 0.05 - y(p)) / 0.17) > 0.82 ? 'stS' : frac(roundTorso(p) * 3) < 0.04 ? 'brass' : 'st';
      if (Math.abs(y(p) - (A.chest[1] - 0.35)) < 0.05) return p[2] > 0 ? 'stS' : 'st';
      // (the plackart's point up the middle, a glowing line round it; brass rivets at its foot)
      if (p[2] > 0 && y(p) < A.chest[1] - 0.35 && Math.abs(y(p) - (A.chest[1] - 0.45)) < 0.04 && ax < 0.75) return 'rune';
      if (p[2] > 0 && Math.abs(y(p) - (waist + 0.02)) < 0.05) return frac(ax * 4) < 0.3 ? 'brass' : 'stS';
      if (p[2] > 0 && ax < 0.03) return 'stS';
      return 'st';
    },
    rim: 'stD',
    caps: { off: () => 0.14, mat: () => 'arming' },
  });
  // the pauldrons: four lames over each shoulder, a brass rivet line on the lowest
  const pauldrons = shoulders(B, {
    from: -0.35, to: 0.42,
    off: (t) => 0.3 + 0.04 * frac((t + 0.35) / 0.19),
    mat: (t) => { const k = frac((t + 0.35) / 0.19); return k > 0.85 ? 'stD' : t > 0.23 && k < 0.2 ? 'brass' : 'st'; },
  });
  // the rerebraces down the upper arm, the arming doublet's red at the armpit
  const rere = upperArms(B, { from: -0.35, to: 0.85, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.12), mat: (u, p, n) => (n[0] * Math.sign(p[0]) < -0.3 ? 'arming' : frac(u.t * 5) < 0.12 ? 'stS' : 'st') });
  // the couters and the vambraces: a fan at the elbow's outside, the forearm closed in steel, a glowing band at the wrist
  const vamb = forearms(B, {
    from: -0.15, to: 0.93, elbow: true,
    off: (f) => 0.12 + (f.t < 0.15 ? 0.08 * Math.max(0, 1 - Math.abs(f.t) / 0.15) : 0) + (f.t > 0.85 ? 0.03 : 0),
    mat: (f) => { if (f.t < 0.15) return Math.abs(f.t - 0.02) < 0.03 ? 'brass' : 'st'; if (f.t > 0.85) return f.t > 0.89 ? 'stS' : 'rune'; return frac(f.t * 4) < 0.08 ? 'stS' : 'st'; },
  });
  return merge(coat, pauldrons, rere, vamb);
}

function steelLegs(B) {
  const A = B.at, waist = waistOf(A);
  // the arming hose under, red, its waist left out under a chest piece
  const hose = hips(B, { inner: 0.3, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 0.85)[1], off: (p) => 0.08 + (p[2] > 0.1 && y(p) < waist - 0.75 ? 0.06 : 0), mat: (p) => (y(p) > waist - 0.75 ? 'armingW' : 'arming'), rim: 'armingD' });
  // the cuisses: steel down the front and outside of the thigh
  const cuisse = shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; const g = legAt(B, p).thigh; return on(B, i, 'thigh') > 0.6 && g.t > 0.15 && g.t < 0.95 && dot(B.N[i], [Math.sign(p[0]) * 0.6, 0, 0.8]) > -0.1 && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    off: ({ p }) => 0.17 + 0.04 * smooth(0.6, 0.95, legAt(B, p).thigh.t),
    mat: ({ p }) => { const t = legAt(B, p).thigh.t; return t < 0.22 ? 'brass' : frac(t * 6) < 0.08 ? 'stS' : 'st'; },
    rim: 'stD', thick: 0.05,
  });
  // the poleyns, winged at the outside, and the greaves closed round the shin; a glowing ring round each poleyn
  const greaves = shins(B, {
    from: -0.2, to: 0.9, round: 3.0,
    off: (g) => (g.t < 0.12 ? 0.22 + 0.06 * Math.cos(g.a) * (1 - Math.abs(g.t) * 5) + (g.a * Math.sign(1) > 0.9 && g.t < 0.06 ? 0.08 : 0) : 0.14 + 0.03 * Math.exp(-(((g.t - 0.35) / 0.2) ** 2))),
    mat: (g) => { if (g.t < 0.12) return Math.abs(g.t) > 0.1 ? 'rune' : 'st'; if (g.t < 0.16) return 'stD'; if (g.t > 0.86) return 'stS'; return Math.abs(g.a) < 0.04 ? 'stS' : 'st'; },
    rim: 'stD',
  });
  return { P: merge(hose, cuisse, greaves), dropAt: (f) => f.mat === 'armingW' };
}

function steelBoots(B) {
  const A = B.at;
  // the sabatons: steel lames over the foot to a blunt toe, leather under, a glowing band at the ankle
  return feet(B, {
    up: 0.6,
    off: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.05 + 0.02 * frac((p[2] - A.ankle[s][2]) * 3.5); },
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.12) return 'stS';
      if (y(p) > top - 0.22) return 'rune';
      if (n[1] < -0.3) return 'leather';
      return frac((p[2] - A.ankle[s][2]) * 3.5) > 0.82 ? 'stS' : 'st';
    },
    rim: 'stD',
  });
}

function steelHelm(B) {
  const browTh = browTheta(B);
  return helm(B, {
    rim: 'stD', down: 2.2,
    // (an armet: closed, a low comb down the middle, the visor's point out before the face)
    margin: ({ th, ph }) => { const s = fromFront(ph), mid = Math.min(s, Math.PI - s); return 0.1 + (th < 1.6 && mid < 0.06 ? 0.08 : 0) + (th > browTh && s < 0.5 ? 0.12 * Math.cos(s * Math.PI) * smooth(browTh, browTh + 0.5, th) : 0); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph), mid = Math.min(s, Math.PI - s);
      if (th > browTh + 0.1 && th < browTh + 0.2 && s < 0.85) return s < 0.05 ? 'stS' : null;
      if (Math.abs(th - (browTh + 0.07)) < 0.03 && s < 0.95) return 'rune';
      if (th > browTh + 0.45 && th < browTh + 0.75 && s > 0.15 && s < 0.55 && frac(th * 14) < 0.35 && frac(s * 9) < 0.4) return 'stD';
      if (th < 1.6 && mid < 0.06) return 'stS';
      if (th > 2.05) return 'brass';
      return 'st';
    },
  });
}

function steelMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the mantelet: blue velvet over the pauldrons and down to the shoulder blades' foot, brass-edged
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.1, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.95 * sx, 0, 0], [0.85 * sx, 0, 0], smooth(0, 0.5, s))[0],
    over: [steelChest(B)],
    off: () => 0.16, thick: 0.04,
    hang: A.spine2[1] - 0.3, rowsDown: 5, folds: 9, fold: 0.06,
    mat: (p, u, s) => (s > 0.9 || Math.abs(u) > 0.94 ? 'brass' : 'velvet'),
    rim: 'velvetD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.18, 0, 'stD'], [0.18, 0.05, 'brass'], [0.13, 0.06, 'rune'], [0.08, 0.08, 'brass']]);
  return merge(cloth, pin);
}

/* ==== the sets ===================================================================================================== */
const SETS = {
  copper: { MATS: COPPER_MATS, helm: copperHelm, chest: copperChest, mantle: copperMantle, legs: copperLegs, boots: copperBoots },
  iron: { MATS: IRON_MATS, helm: ironHelm, chest: ironChest, mantle: ironMantle, legs: ironLegs, boots: ironBoots },
  steel: { MATS: STEEL_MATS, helm: steelHelm, chest: steelChest, mantle: steelMantle, legs: steelLegs, boots: steelBoots },
  bronze: { MATS: BRONZE_MATS, helm: bronzeHelm, chest: bronzeChest, mantle: bronzeMantle, legs: bronzeLegs, boots: bronzeBoots },
};

const only = opt('only', null);
for (const [id, S] of Object.entries(SETS)) {
  if (opt('set', id) !== id) continue;
  for (const who of ['male', 'female']) {
    const B = bodyOf(who);
    for (const piece of ['helm', 'chest', 'mantle', 'legs', 'boots']) {
      if (only && only !== piece) continue;
      const made = S[piece](B), P = made.P ?? made;
      const asset = assetOf(B, P, S.MATS, { dropAt: made.dropAt });
      writeFileSync(new URL(`lowmetal${id}${piece}-${who}.json`, ASSETS), JSON.stringify(asset));
      console.log(`lowmetal${id}${piece}-${who}.json: ${asset.verts.length / 3} points, ${asset.polys.length} faces, ${asset.hides.length} hidden, mats ${asset.mats.join(' ')}`);
    }
  }
}
