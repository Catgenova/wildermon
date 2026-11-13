// The chain set's coif: a hood of mail over the padded arming cap, the face open from the brow to the chin, falling over
// the neck into a tippet that drapes the shoulders; a brass ring row round the face and at the tippet's hem, the padded
// cap's rim showing round the face under it, and a gold clasp on the brow with its gem (glowing when enchanted). The
// hair is not drawn under it (src/sculpt/lowpoly.ts hairShown). The head's and the neck's polygons it covers whole are
// hidden (`hides`). Its tippet, from `dropFrom` on, is left out under a chest piece with a collar of its own (the plate
// and the leather chests, the shawl, the mantle), the hood's neck then tucked under that collar.
//
//   buildChainCoif(rig, design?) → the mesh (chainmail.mjs chainMesh, its `hides`, `dropFrom`)
//
//   node tools/sculpt/garments/chaincoif.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowchaincoif-male.json and -female.json
//
// The mail: the body's own triangles over the skull, the neck and the shoulders (chainmail.mjs mailShell), out from them
// by the padding (more over the neck, and over the shoulders enough to lie over the hauberk's mail), in courses on the
// set's grid with their links round the head's vertical axis. The face: the body's face region and the skull's
// triangles in front of the ears and below the brow line (an ellipse in x and y in front of the head's middle) left open.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { add } from '../lowgarment.mjs';
import { hemRow, chainMesh, mailShell, coveredPolys, stud, writePiece, linksOf } from './chainmail.mjs';
import { COURSE, DESIGN as CHEST, skinAt } from './chainchest.mjs';

/**
 * Per body: the padding off the skull, the neck and the shoulders (`head`, `neck`, `tippet`); the face's opening (its
 * middle's height, half-width and half-height, and how far forward of the head's middle it starts); the tippet's hem
 * (its height), the neck's foot when the tippet is left out (`neckFoot`); the links' radius round the head.
 */
export const DESIGN = {
  male: { head: 0.1, neck: 0.12, tippet: 0.17, face: { y: 0.8, rx: 0.64, ry: 0.98, z: 0.02 }, hem: -1.55, links: { rT: 0.72 } },
  female: { head: 0.09, neck: 0.11, tippet: 0.15, face: { y: 0.78, rx: 0.6, ry: 0.96, z: 0.02 }, hem: -1.55, links: { rT: 0.66 } },
};

export function buildChainCoif(rig, D = DESIGN[rig.who]) {
  const { B, J } = rig, C = COURSE[rig.who], L = CHEST[rig.who].links, G = chainMesh();
  const parts = (t) => t.v.map((i) => B.part[i]);
  const hz = J.head[2];
  // (a point in the face's opening: in front of the head's middle, inside the ellipse)
  const inFace = (p) => p[2] > hz + D.face.z && ((p[0] / D.face.rx) ** 2 + ((p[1] - D.face.y) / D.face.ry) ** 2) < 1;
  const open = (t) => t.region === 'face' || t.v.every((i) => inFace(B.verts[i])) || t.v.filter((i) => inFace(B.verts[i])).length >= 2;
  // (the padding: the head's down to the jaw, the neck's below, the tippet's below the neck's foot)
  const neckY = Math.min(...B.verts.filter((_, i) => B.part[i] === 'neck').map((p) => p[1]));
  const pad = (p) => { const y = p[1]; if (y > 0.05) return D.head; if (y > neckY + 0.15) return D.head + ((D.neck - D.head) * (0.05 - y)) / (0.05 - neckY - 0.15); return D.neck + (D.tippet - D.neck) * Math.min(1, (neckY + 0.15 - y) / 0.45); };
  const links = { ...linksOf(rig, { z0: hz, rT: D.links.rT, w: L.w, edge: L.edge, centre: L.centre }) };
  const hoodTris = (t) => parts(t).every((p) => p === 'head' || p === 'neck' || p === 'torso') && !open(t), split = neckY + 0.05;
  // the hood: the skull and the neck, the face open
  const hood = mailShell(G, rig, {
    tag: 'coif', ...C, links,
    keep: hoodTris, lo: () => split,
    c: (i, p) => pad(p),
    mat: (f, up) => (up ? 'plate' : 'shade'),
    lipMat: 'gold',
  });
  // the padded cap's rim round the face, under the mail's edge
  mailShell(G, rig, {
    tag: 'coif cap', h: 100, d: 0, crest: 0.5, foot: 1,
    keep: (t) => parts(t).every((p) => p === 'head') && !open(t) && t.v.some((i) => { const p = B.verts[i]; return p[2] > hz && ((p[0] / D.face.rx) ** 2 + ((p[1] - D.face.y) / D.face.ry) ** 2) < 1.9; }),
    c: (i, p) => pad(p) * 0.55, mat: () => 'under', lipMat: 'under',
  });
  // the clasp on the brow
  const brow = B.verts.reduce((best, p, i) => (B.part[i] === 'head' && Math.abs(p[0]) < 0.2 && p[1] > D.face.y + D.face.ry * 0.7 && p[1] < D.face.y + D.face.ry * 1.25 && (!best || p[2] > best[2]) ? p : best), null);
  stud(G, add(brow, [0, 0.04, D.head + C.d + 0.01]), [0, 0.35, 1], [1, 0, 0], { a: 0.12, b: 0.14, h: 0.035, inset: 0.6, w: skinAt(rig, brow, ['head']), tag: 'coif clasp', diamond: true });
  // the tippet over the shoulders, left out under another collar (from here on)
  G.dropFrom = G.polys.length;
  mailShell(G, rig, {
    tag: 'tippet', ...C, links: linksOf(rig, { z0: J.spine3[2], rT: L.rT, w: L.w, edge: L.edge, centre: L.centre }),
    keep: (t) => parts(t).every((p) => p === 'torso' || p === 'neck' || p === 'joint'), lo: () => D.hem, hi: () => split,
    c: (i, p) => pad(p),
    mat: (f, up, t, k) => hemRow(C.h, { lo: D.hem })(k, up) ?? (up ? 'plate' : 'shade'),
  });
  G.hides = coveredPolys(rig, (i) => hood.covered(i, 0.02) || (B.part[i] === 'head' && !inFace(B.verts[i]) && hood.covered(i)));
  return G;
}

if (import.meta.url === `file://${process.argv[1]}`) await writePiece('chaincoif', buildChainCoif, 'chaincoif.mjs');
