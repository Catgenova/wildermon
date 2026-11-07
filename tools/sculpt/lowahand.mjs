// The low-poly hands (tools/sculpt/lowarm.mjs) placed by hand off their reference sheets (tools/sculpt/ARM_SPEC.md,
// ARM_SPEC_FEMALE.md): every hand vertex read off the sheet, not fitted.
//
//   node tools/sculpt/lowahand.mjs --who male|female     # writes the hand's vertices into lowafit-<who>.json and the
//                                                       # hand views' cameras into lowacams.json
//
// Each vertex is given in the sheet's own pixels in the hand's frame (lowarm.mjs handFrame, the wrist's): u across
// toward the thumb from the stub's middle and v down from the wrist's line, both read in the Back view (the Hand
// Topology's back panel where its wireframe shows the vertex, the palm panel for the palm's: the panels are the Back
// and Palm views redrawn at the same scale), and w out of the back of the hand from the stub's middle, read in the
// Profile view. The hand views' cameras are a turntable about the stub (yaw 0, -45, -90, -135, -180, no roll), the
// pitch off the stub's top, each view's middle the stub's middle, its height the wrist's line; their scale (px per
// head unit) is the one the body reference's hand length gives (the full body sets the hand's size).
// The wrist ring keeps its centre and plane (the forearm ends there); its shape is the stub's.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { handFrame, PRESETS } from './lowarm.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'male');
const DIR = new URL('.', import.meta.url).pathname;

export const HAND = {
  male: {
    // the stub: its middle (x) and the wrist's line (y) per view, the pitch off its top's ellipse
    cams: { s: 135.33, pitch: 4, views: { hback: [112.6, 711], hq3: [289, 712.5], hprofile: [451.6, 710], hr3: [609.7, 712.5, -145], hpalm: [778.8, 714] } },
    V: {
      // the wrist: the stub, 78 px across and 63 deep
      wk: [-39, 0, 0], wb0: [-20, 0, 31], wb1: [20, 0, 31], wt: [39, 0, 0], wp1: [20, 0, -31], wp0: [-20, 0, -31],
      // the knuckle line on the back (back panel), lower in the middle; its depth the profile's back at that row
      kb0: [-64, 90, 36], kb1: [-41, 95, 48], kb2: [-15, 99, 51], kb3: [12, 95, 48], kb4: [38, 94, 28],
      // the knuckle line on the palm (palm panel), rising toward the little finger
      kp4: [29, 104, 2], kp3: [15, 99, 0], kp2: [-9, 95, 0], kp1: [-34, 91, 2], kp0: [-60, 87, 4],
      // the four-finger mass: the second row's line (back panel, palm panel), the tips (the views' bottom edges)
      mb0: [-52, 148, 22], mb1: [-28, 161, 33], mb2: [-8, 168, 35], mb3: [17, 167, 33], mb4: [39, 160, 18],
      mp4: [31, 157, 0], mp3: [21, 169, -3], mp2: [-4, 170, -4], mp1: [-25, 157, -3], mp0: [-51, 147, 0],
      nb0: [-30, 178, 10], nb1: [-16, 190, 16], nb2: [0, 194, 16], nb3: [19, 189, 16], nb4: [34, 186, 8],
      np4: [29, 185, -6], np3: [12, 191, -7], np2: [-4, 190, -7], np1: [-21, 182, -7], np0: [-36, 175, -4],
      // the little finger's side at its widest (back panel, palm panel)
      sk: [-59, 50, 8],
      // the palm's diamond (palm panel): by the wrist, toward the little finger, toward the index; td its thumb corner
      pa: [20, 14, -33], pb: [-24, 41, -26], pc: [20, 75, -18],
      // the thumb's root: ta tb on the back (its outer top, the web), tc td on the palm (the web, the mound's corner)
      ta: [65, 45, 0], tb: [44, 82, 6], tc: [35, 84, -14], td: [49, 50, -38],
      // the thumb's two segments: a b on the back, c d on the palm; b c toward the index
      t1a: [79, 92, -10], t1b: [47, 99, -10], t1c: [47, 99, -38], t1d: [79, 92, -38],
      t2a: [77, 126, -14], t2b: [52, 131, -14], t2c: [52, 131, -34], t2d: [77, 126, -34],
    },
  },
  female: {
    cams: { s: 115.19, pitch: 5, views: { hback: [101.2, 559.5], hq3: [249.6, 559.5], hprofile: [394.7, 559], hr3: [538.6, 559.5, -180], hpalm: [683.6, 559.5, -188] } },
    // her topology panels drawn 1.16 times as wide as her Back view: their u read there and taken at 0.86
    V: {
      // the wrist: the stub, 50 px across and 43 deep
      wk: [-25, 0, 0], wb0: [-12.5, 0, 21.5], wb1: [12.5, 0, 21.5], wt: [25, 0, 0], wp1: [12.5, 0, -21.5], wp0: [-12.5, 0, -21.5],
      kb0: [-42, 58, 21], kb1: [-25, 63, 31], kb2: [-9.5, 66, 33], kb3: [11, 65, 31], kb4: [27, 64, 19],
      kp4: [21, 68, -6], kp3: [7, 68, -6], kp2: [-8, 67, -6], kp1: [-22, 63, -5], kp0: [-37, 59, -3],
      mb0: [-28, 88, 12], mb1: [-18, 100, 22], mb2: [-4, 101, 24], mb3: [12, 100, 22], mb4: [24, 92, 11],
      mp4: [21, 99, -7], mp3: [10, 100, -8], mp2: [-3, 99, -8], mp1: [-15, 96, -8], mp0: [-28, 90, -6],
      nb0: [-22, 110, 3], nb1: [-11, 121, 7], nb2: [1, 127, 7], nb3: [12, 126, 7], nb4: [22, 118, 3],
      np4: [22, 124, -8], np3: [10, 128, -8], np2: [-2, 127, -8], np1: [-15, 118, -8], np0: [-26, 106, -6],
      sk: [-38, 40, 4],
      pa: [12, 12, -23], pb: [-13, 30, -18], pc: [12, 48, -12],
      ta: [46, 36, -4], tb: [27, 50, 4], tc: [23, 56, -12], td: [33, 33, -28],
      t1a: [50, 58, -14], t1b: [30, 63, -14], t1c: [30, 63, -31], t1d: [50, 58, -31],
      t2a: [49, 84, -16], t2b: [36, 89, -16], t2c: [36, 89, -29], t2d: [49, 84, -29],
    },
  },
};

const NOM = { hback: 0, hq3: -45, hprofile: -90, hr3: -135, hpalm: -180 };
const H = HAND[who];
const file = join(DIR, `lowafit-${who}.json`);
const V = structuredClone(PRESETS[who].V);
const F = handFrame(V), s = H.cams.s;
for (const [n, [u, v, w]] of Object.entries(H.V)) {
  const l = [u / s, -v / s, w / s];
  V[n] = [0, 1, 2].map((k) => +(F.O[k] + F.x[k] * l[0] + F.y[k] * l[1] + F.z[k] * l[2]).toFixed(4));
}
writeFileSync(file, JSON.stringify({ V }, null, 1));
const cf = join(DIR, 'lowacams.json'), all = JSON.parse(readFileSync(cf, 'utf8'));
const cb = Math.cos((H.cams.pitch * Math.PI) / 180);
for (const [v, [x, y, yaw]] of Object.entries(H.cams.views)) {
  // the wrist's middle sits a little above its front edge (the line the views show), the stub's top ellipse's half
  const yo = y - 31 * Math.sin((H.cams.pitch * Math.PI) / 180);
  all[who][v] = { yaw: yaw ?? NOM[v], pitch: H.cams.pitch, roll: 0, s, cx: x, cy: +(yo + s * 0.6 * cb).toFixed(3), piv: [0, -0.6, 0] };
}
writeFileSync(cf, JSON.stringify(all, null, 1));
console.log(who, 'hand placed:', Object.keys(H.V).length, 'vertices');
