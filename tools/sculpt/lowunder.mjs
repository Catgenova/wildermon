// The undergarment painted on the low-poly bodies (tools/sculpt/lowarm.mjs buildArmBody): not a garment of its own but
// the body's own polygons over the pelvis (both bodies: briefs) and her breasts (a band), given the undergarment's
// material (src/sculpt/models/body.ts M.under) in the game's copy of the body (tools/sculpt/lowrig.mjs gameAsset).
//
//   underOf(B, who) → { polys: Set of polygon indices painted, splits: [{ poly, keep, paint }] }
//   paintUnder(B, who) → { polys, tris, from }: the body's polygons and triangles with the splits made (each split's
//     painted piece appended after the body's polygons, its parent's outline kept for its shading) and `from`, each
//     appended polygon's parent (a garment hiding the parent hides it too: src/sculpt/lowpoly.ts)
//
//   node tools/sculpt/lowunder.mjs [--who male|female]   prints what the game's copies have painted (after lowrig.mjs)
//
// Chosen by the polygons' names (tools/sculpt/lowtorso.mjs, lowlegs.mjs, lowloops*.mjs; a split by its corners' names),
// the same on both sides, so the paint is symmetric (only existing vertices: no vertex added, the weights untouched):
//   briefs: the waistband on the hip cut's ring bt (between the hips' widest, hw, and the hip line, gl), level all round;
//     the leg openings: his from the crotch along th7 th0 th1 at the front, over the hip line gl3 gl4 at the side, down
//     gl4-gf4 (his groin quad split on that diagonal) and th3 th4 th5 at the back; hers along th7 th0 th1 th2 at the front
//     and side, then from th3 across the buttock to the gluteal fold tg4 (her buttock's five-sided facet split on its own
//     diagonal th3-tg4) and along it, tg4 tg5 tg6, to the crotch;
//   her band: the breasts' patch whole (its foot's top da0 bx0 da1 bx1 da2 the band's top edge at the front), and one
//     closed band round the ribs from the breasts' foot down to the rb row: its top at the side and the back level (ra3
//     ra4 ra5, dc6 dc7 dc8; the back's corner split on its own diagonal ra5-dc6), its foot the rb row all round.
import { tris } from './lowarm.mjs';

const BRIEFS = {
  male: {
    pelvis: ['bt0', 'bt1', 'bt2', 'bt3', 'bt4', 'bt5', 'bt6', 'bt7'],
    groin: ['gr0/a', 'gr0/b', 'gr1/a', 'gr1/b', 'gr2/a', 'gr2/b', 'gr5/a', 'gr5/b', 'gr6/a', 'gr6/b', 'gr7/a', 'gr7/b', 'gr8/a', 'gr8/b', 'gr9/a', 'gr9/b'],
  },
  female: {
    pelvis: ['bt0', 'bt1', 'bt2', 'bt3', 'bt4', 'bt5a', 'bt5b', 'bt5c', 'bt6', 'bt7', 'gm6', 'gm7'],
    groin: ['gr0a', 'gr0b', 'gr1a', 'gr1b', 'gr2', 'gr3', 'gr4', 'gr5', 'gr6', 'gr7a', 'gr7b', 'gr8', 'gr9'],
    thigh: ['th4', 'th5'],
  },
};
/**
 * Her band's polygons: the breasts' patch (torso/chest but its facets toward the arm and the shoulder) and one closed band
 * round the ribs under it, from the breasts' foot (at the side ra3 ra4 ra5, at the back dc6 dc7 dc8: level, the back's
 * corner split on its diagonal ra5-dc6) down to the rb row all round.
 */
const BAND = [
  // the front, under the breasts
  'dc0-dc1-ra1-ra0', 'dc1-dc2-ra2-ra1', 'under the breast 2', 'under the breast 3', 'ra0-ra1-rb1-rb0', 'ra1-ra2-rb2-rb1', 'ra2-ra3-rb3-rb2',
  // the side and the back
  'ra3-ra4-rb4-rb3', 'ra4-ra5-rb5-rb4', 'ra5-ra6-rb6-rb5', 'dc6-dc7-ra7-ra6', 'dc7-dc8-ra8-ra7', 'ra6-ra7-rb7-rb6', 'ra7-ra8-rb8-rb7',
];
const NOT_BAND = new Set(['sd1-sd2-da2-da1', 'da2-da3-db3-db2']);
/**
 * Polygons split along two of their own corners, found by their corners' names (either side's: the pieces' a/b names
 * are not mirrored), the piece with `paint`'s corners painted, the rest left.
 */
const SPLITS = {
  male: [{ corners: ['gf3', 'gf4', 'gl4', 'gl5'], paint: ['gl4', 'gl5', 'gf4'] }],
  female: [{ corners: ['th3', 'tg3', 'tg4', 'th4', 'gl5'], paint: ['th3', 'tg4', 'th4', 'gl5'] }, { corners: ['dc5', 'dc6', 'ra5', 'ra6'], paint: ['ra5', 'ra6', 'dc6'] }],
};

const bare = (n) => (n ?? '').replace(/:[LR]/, '');
const vname = (B, i) => B.names[i].replace(/\.[LR]$/, '');

export function underOf(B, who) {
  const want = new Set([...BRIEFS[who].pelvis, ...BRIEFS[who].groin, ...(who === 'female' ? BAND : [])]), thigh = new Set(BRIEFS[who].thigh ?? []);
  const polys = new Set();
  B.polys.forEach((p, i) => {
    const n = bare(p.name);
    if (p.part === 'pelvis' || (p.part === 'torso' && who === 'female')) { if (want.has(n)) polys.add(i); }
    if (p.part === 'legs' && thigh.has(n)) polys.add(i);
    if (who === 'female' && p.part === 'torso' && p.region === 'chest' && !NOT_BAND.has(n)) polys.add(i);
  });
  const splits = [];
  for (const s of SPLITS[who]) B.polys.forEach((p, i) => {
    if (p.v.map((v) => vname(B, v)).sort().join() !== [...s.corners].sort().join()) return;
    const paint = p.v.filter((v) => s.paint.includes(vname(B, v)));
    if (paint.length !== s.paint.length) throw new Error(`split ${s.corners}: corners not found`);
    // the painted piece: the polygon's corners from one cut corner round to the other through the painted ones
    const n = p.v.length, at = (k) => p.v[((k % n) + n) % n];
    const inP = (v) => paint.includes(v);
    let start = p.v.findIndex((v, k) => inP(v) && !inP(at(k - 1)));
    const piece = []; for (let k = 0; k < n && inP(at(start + k)); k++) piece.push(at(start + k));
    const rest = []; for (let k = piece.length - 1; k <= n; k++) rest.push(at(start + k));
    splits.push({ poly: i, paint: piece, keep: rest.slice(0, n - piece.length + 2) });
  });
  return { polys, splits };
}

/** The body's polygons and triangles with the splits made; `paint` the painted polygons (the pieces among them), `from` each appended polygon's parent. */
export function paintUnder(B, who) {
  const { polys: sel, splits } = underOf(B, who);
  const polys = B.polys.map((p) => ({ ...p })), T = B.tris.map((t) => ({ ...t, v: [...t.v] })), from = [];
  for (const s of splits) {
    const P = polys[s.poly], outline = P.nv ?? P.v, k = polys.length;
    polys[s.poly] = { ...P, v: s.keep, nv: outline };
    polys.push({ ...P, v: s.paint, nv: outline, name: `${P.name} under` });
    from.push([k, s.poly]);
    sel.add(k);
    // the parent's triangles: kept where one lies wholly in a piece, else both pieces triangulated afresh
    const own = T.filter((t) => t.poly === s.poly), inside = (t, v) => t.v.every((x) => v.includes(x));
    if (own.every((t) => inside(t, s.keep) || inside(t, s.paint))) own.forEach((t) => { if (!inside(t, s.keep)) t.poly = k; });
    else {
      const rest = T.filter((t) => t.poly !== s.poly);
      T.length = 0; T.push(...rest, ...tris(s.keep, B.verts).map((v) => ({ ...own[0], v, poly: s.poly })), ...tris(s.paint, B.verts).map((v) => ({ ...own[0], v, poly: k })));
    }
  }
  return { polys, tris: T, paint: sel, from };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // (read from the game's copies, as tools/sculpt/lowrig.mjs writes them: lowrig.mjs imports this module)
  const { readFileSync } = await import('node:fs');
  const args = process.argv.slice(2), i = args.indexOf('--who');
  for (const who of i >= 0 ? [args[i + 1]] : ['male', 'female']) {
    const A = JSON.parse(readFileSync(new URL(`../../src/sculpt/assets/low${who}.json`, import.meta.url), 'utf8'));
    const painted = A.polys.filter((p) => p[1] === 9).length, split = A.split ?? [];
    console.log(`${who}: ${painted} of ${A.polys.length} polygons painted (${split.length} split off: ${split.map(([k, p]) => `${k} from ${p}`).join(', ') || 'none'}), ${A.tris.length / 4} triangles`);
  }
}
