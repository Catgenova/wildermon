// The metal sets: for each metal with a set of its own, its helm, chest & arms, shawl, leggings and boots, on both
// low-poly bodies, made out of the body itself (tools/sculpt/garments/metalkit.mjs). Each piece's plates are `plate` and
// `shade` (drawn in the piece's metal: src/sculpt/lowpoly.ts plateMat), its glow `rune` (lit in the enchantment's colour).
//
//   node tools/sculpt/garments/metalsets.mjs [--set copper] [--only chest]
//     writes src/sculpt/assets/lowmetal<set><piece>-<who>.json for helm, chest, mantle, legs and boots.
import { writeFileSync } from 'node:fs';
import {
  browTheta, cape, chestFront, disc, feet, forearms, fromFront, helm, hips, shins, shoulders, torso, upperArms, waistOf as waistAt,
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
  const cuirass = shell(B, {
    sub: 2,
    // (the shoulder joint left to the shoulder plates)
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'neck') > 0.55 && on(B, i, 'upperarm') < 0.02 && on(B, i, 'shoulder') < 0.12 && y(p) > waist - 0.05 && y(p) < neckCut + (Math.abs(p[0]) > 0.5 ? (B.N[i][2] < -0.3 && Math.abs(p[0]) > 0.6 ? 0.02 : 0.4) : 0.12); },
    off: ({ p }) => copperCuirassOff(A, p),
    mat: ({ p, n }) => {
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
  gam: { c: '#c2ad84', kind: 2 },
  gamD: { c: '#8f7a55', kind: 2 },
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
const ironCoat = (A, p) => { const r = frac((A.chest[1] + 0.35 - y(p)) / ironRow(A)); return y(p) < A.chest[1] + 0.35 && y(p) > waistOf(A) - 0.6 ? 0.17 + 0.03 * r : 0.09; };

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
  });
  // square shoulder plates, two lames
  const pl = shoulders(B, {
    off: (t) => (t < 0.12 ? 0.27 : 0.27 + 0.03),
    mat: (t) => (t > 0.1 && t < 0.15 ? 'feS' : t > 0.3 ? 'feS' : frac(t * 9) < 0.15 ? 'rivet' : 'fe'),
  });
  // the gambeson's long sleeves, quilted
  const sleeves = upperArms(B, { from: 0.08, to: 1.05, off: () => 0.09, mat: (u, p) => (frac(u.t * 7) < 0.18 ? 'gamD' : 'gam') });
  // the vambraces: iron bands over the sleeve's end, a glowing band at the wrist
  const vamb = forearms(B, { from: -0.02, to: 0.93, elbow: true, off: (f) => 0.1 + (f.t > 0.3 ? 0.04 : 0), mat: (f) => { if (f.t < 0.3) return frac(f.t * 8) < 0.2 ? 'gamD' : 'gam'; if (f.t > 0.8) return 'rune'; return frac(f.t * 7) < 0.25 ? 'feS' : 'fe'; } });
  return merge(coat, pl, sleeves, vamb);
}

function ironLegs(B) {
  const A = B.at, waist = waistOf(A);
  // wool trousers, the waist left out under a chest piece
  const hose = hips(B, { top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 0.95)[1], off: () => 0.08, mat: (p) => (y(p) > waist - 0.1 ? 'hoseW' : frac(y(p) * 1.4) < 0.1 ? 'hoseD' : 'hose'), rim: 'hoseD' });
  // the knee cops and the splints down the shin, a glowing rim round each cop
  const shin = shins(B, {
    from: -0.15, to: 0.85, round: 1.35,
    off: (g) => (g.t < 0.12 ? 0.17 + 0.05 * Math.cos(g.a) : 0.13),
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
    rim: 'feS', down: 2.35,
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
  const A = B.at;
  // a wool cloak over both shoulders and down the back, its edge darker; a square iron pin at the right shoulder
  const cloak = cape(B, {
    hang: lerp(A.spine1, A.pelvis, 0.4)[1],
    under: (p) => ironCoat(A, p) + 0.05,
    front: A.chest[1] + 0.15,
    mat: (p) => (frac(y(p) * 3) < 0.08 ? 'woolD' : 'wool'),
    rim: 'woolD',
  });
  const at = chestFront(B, -0.62, A.chest[1] + 0.45);
  const pin = disc(B, add(at, [0, 0, 0.42]), [0, 0, 1], [[0.2, 0, 'feS'], [0.2, 0.05, 'fe'], [0.15, 0.06, 'rune'], [0.1, 0.06, 'feS'], [0.06, 0.1, 'fe']]);
  return merge(cloak, pin);
}

/* ==== the sets ===================================================================================================== */
const SETS = {
  copper: { MATS: COPPER_MATS, helm: copperHelm, chest: copperChest, mantle: copperMantle, legs: copperLegs, boots: copperBoots },
  iron: { MATS: IRON_MATS, helm: ironHelm, chest: ironChest, mantle: ironMantle, legs: ironLegs, boots: ironBoots },
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
