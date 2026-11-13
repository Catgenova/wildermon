// Every chest piece over every legs piece as the game wears them (the game's own assets in src/sculpt/assets, each
// piece's polygons left out as src/sculpt/lowpoly.ts leaves them out: its `dropFrom` where its entry drops them, and the
// legs' polygons under the chest worn, src/sculpt/assets/lowchestlegs-<who>.json by tools/sculpt/garments/chestlegs.mjs,
// whose pairs, clips and camera this shares), skinned to the rig in the game's clips (as
// tools/sculpt/lowleathersetcross.mjs skins them), and what of the legs shows through the chest:
//   x: the legs' triangles crossing the chest's;
//   seen: of those, the ones the game's camera can see (a ray from where the two meet toward it, from any of its eight
//     facings, looking down VIEW_DOWN degrees, meets nothing else before it is clear);
//   h (holes): the points of the body of the trunk, the hips and the legs left out under what is worn (`hides`) that the
//     camera could see past every triangle drawn: a hole through to nothing;
//   NEW: of those, the ones seen only because the legs' triangles under the chest are left out: where the chest does not
//     cover what was left out;
//   body: the body's triangles drawn again under the chest (garments/chestlegs.mjs showOf) crossing the chest's or the
//     legs' kept, seen.
// The clips' frames fall between those the table was refined in (garments/chestlegs.mjs REFINE).
//
//   node tools/sculpt/lowchestlegscheck.mjs [--chests tunic,jerkin,breastplate,hauberk,cuirass] [--legs cloth,leather,plate,chain,scale]
//       [--groups rest,idle,walk,fight,swing,kneel,seat,hop] [--who male,female] [--out <file.json>] [--keep]
//     prints per body and pair the most of each in any pose of each group of poses; --keep leaves every legs triangle in
//     (as before lowchestlegs-<who>.json). Exits 1 when any pair has new holes, or a legs asset was rebuilt since the table.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { crossPairs } from './lowgarment.mjs';
import { CHEST_ITEMS, LEGS_ITEMS, LEGS, assetOf, loadAnim, posesOf, pairOf, poseOf, sightGrids, seen, meetOf } from './garments/chestlegs.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const chests = opt('chests', Object.keys(CHEST_ITEMS).join(',')).split(','), legsList = opt('legs', Object.keys(LEGS_ITEMS).join(',')).split(',');
const groups = opt('groups', 'rest,idle,walk,fight,swing,kneel,seat,hop').split(','), whos = opt('who', 'male,female').split(','), keep = args.includes('--keep');
const ROOT = new URL('../..', import.meta.url).pathname;
/** Each group's frames: how many, and where between the refinement's (a share of a step). */
const FRAMES = { rest: [1, 0], idle: [6, 0.4], walk: [8, 0.4], fight: [8, 0.4], swing: [8, 0.4], kneel: [8, 0.4], work: [6, 0.4], seat: [6, 0.4], hop: [10, 0.4] };
const AN = await loadAnim();

const report = {};
let bad = 0;
for (const who of whos) {
  const rig = buildRig(who), body = who === 'male' ? 'man' : 'woman';
  const file = join(ROOT, `src/sculpt/assets/lowchestlegs-${who}.json`), table = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  for (const [c, row] of Object.entries(table)) if (c !== 'built') for (const [l, { tris }] of Object.entries(row)) if (tris !== assetOf(LEGS[l], who).tris.length / 4) { console.log(`FAIL ${LEGS[l]}-${who} rebuilt since lowchestlegs-${who}.json (${c}): run tools/sculpt/garments/chestlegs.mjs`); bad++; }
  const poses = Object.fromEntries(groups.map((g) => [g, posesOf(AN, rig, body, g, ...FRAMES[g])]));
  const R = (report[who] = {});
  for (const chest of chests) for (const legs of legsList) {
    const ck = CHEST_ITEMS[chest], drop = keep ? {} : Object.fromEntries(Object.entries(table[ck] ?? {}).map(([l, d]) => [l, new Set(d.drop)]));
    const pair = pairOf(rig, who, chest, legs, drop), { C, L } = pair;
    const r = (R[`${chest}/${legs}`] = {});
    for (const g of groups) for (const pose of poses[g]) {
      const { XC, XL, PB, ALL, c0, l0, inside, back } = poseOf(rig, pair, pose), grids = sightGrids(ALL);
      let x = 0, s = 0;
      L.forEach((G, k) => {
        const pairs = crossPairs(XL[k], G.tris, XC, C.tris);
        x += pairs.length;
        s += pairs.filter(([i, j]) => seen(meetOf(G.tris[i].v.map((q) => XL[k][q]), C.tris[j].v.map((q) => XC[q])), ALL, grids, new Set([l0[k] + i, c0 + j]))).length;
      });
      // (the body drawn again against the chest and the legs kept, seen; ALL's indices of the body's shown left unskipped)
      let bx = 0;
      if (back.length) {
        const meets = [...crossPairs(PB, back, XC, C.tris).map(([i, j]) => [back[i], C.tris[j].v.map((q) => XC[q])]), ...L.flatMap((G, k) => crossPairs(PB, back, XL[k], G.tris).map(([i, j]) => [back[i], G.tris[j].v.map((q) => XL[k][q])]))];
        bx = meets.filter(([t, T]) => seen(meetOf(t.v.map((q) => PB[q]), T), ALL, grids)).length;
      }
      // (the body left out under what is worn, seen past everything drawn; and again with the legs' triangles under the
      // chest drawn, for the ones seen only because those are left out)
      const looks = inside.filter((m) => seen(m, ALL, grids));
      let fresh = 0;
      if (looks.length && L.some((G) => G.gone.length)) {
        const ALL2 = ALL.slice();
        L.forEach((G, k) => { for (const t of G.gone) ALL2.push(t.v.map((i) => XL[k][i])); });
        const grids2 = sightGrids(ALL2), nw = looks.filter((m) => !seen(m, ALL2, grids2));
        fresh = nw.length;
        if (process.env.DBG) for (const m of nw) console.log(`   new hole ${g} at y ${m[1].toFixed(2)} az ${(Math.atan2(m[0], m[2]) * 180 / Math.PI).toFixed(0)} r ${Math.hypot(m[0], m[2]).toFixed(2)}`);
      }
      const o = (r[g] ??= { x: 0, seen: 0, holes: 0, new: 0, body: 0 });
      o.x = Math.max(o.x, x); o.seen = Math.max(o.seen, s); o.holes = Math.max(o.holes, looks.length); o.new = Math.max(o.new, fresh); o.body = Math.max(o.body, bx);
      bad += fresh;
    }
    console.log(who.padEnd(6), `${chest}/${legs}`.padEnd(19), groups.map((g) => `${g} ${r[g].x}/${r[g].seen}${r[g].holes ? ` h${r[g].holes}` : ''}${r[g].new ? ` NEW${r[g].new}` : ''}${r[g].body ? ` b${r[g].body}` : ''}`).join('  '));
  }
}
console.log('(each group: the most legs × chest crossings in a pose / of them seen; h: the most points of the body left out seen; NEW: the most of them seen only for the legs left out under the chest; b: the most crossings of the body drawn again seen)');
if (opt('out', '')) writeFileSync(opt('out', ''), JSON.stringify(report, null, 1));
process.exit(bad ? 1 : 0);
