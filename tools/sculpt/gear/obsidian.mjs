// The knapped obsidian heads and blades (src/game/recipes.ts KNAPPED): every tool and weapon knapped from obsidian
// drawn as its own prop (src/sculpt/assets/<asset>.json, the metal one's sockets, grip and scale, so it is held
// where the metal one is), its head or blade re-cut as knapped volcanic glass:
//
//   * every face of the head split into facets round a flake scar, each scar's middle sunk into the stone (conchoidal:
//     a shallow dish), so each facet takes the light at its own angle;
//   * the cutting edge (its bevel) flaked: the points along it pushed out and in by turns, station by station through
//     the thickness, so the edge is a row of scallops and the outline a serrated one;
//   * the veins over the stone gone, and the head's stone in obsidian's own colours (no metal: `glass`, which the game
//     lights as metal for its sheen and draws in the colour given, src/sculpt/lowpoly.ts metalTint): black, a violet
//     black where a facet takes the light, a deeper black in shade, the flaked edge a smoky violet grey.
//
// Its haft, collars, medallions, pommel and glow are the metal prop's, untouched.
//
//   node tools/sculpt/gear/obsidian.mjs
//     writes src/sculpt/assets/obsidian_<asset>.json for each (`KNAPPED_ASSETS`); loaded by src/sculpt/lowpoly.ts
//     (`OBSIDIAN_PROPS`), drawn for an item whose material is Obsidian.
import { readFileSync, writeFileSync } from 'node:fs';

/** The item knapped, and the prop it is drawn as (the maul is the Runestone Warhammer's prop). */
export const KNAPPED_ASSETS = {
  hatchet: 'hatchet', pickaxe: 'pickaxe', shovel: 'shovel', saw: 'saw', carving_knife: 'carving_knife', butchering_knife: 'butchering_knife',
  sickle: 'sickle', hammer: 'hammer', chisel: 'chisel', hunting_knife: 'hunting_knife', short_sword: 'short_sword', sword: 'sword',
  long_sword: 'long_sword', battle_axe: 'battle_axe', maul: 'warhammer', spear: 'spear', javelin: 'javelin', throwing_axe: 'throwing_axe',
};

/** Obsidian's colours, by the metal role and the stone each was modelled in. */
export const OBSIDIAN = {
  stoneM: '#24202d', stoneLM: '#463e5c', stoneBM: '#131117', panelM: '#1c1924', bevelM: '#6b6384', crackM: '#0d0b10',
};
/** How deep a flake scar is sunk, as a share of its facet's reach; how far the edge is flaked, as a share of the head's size. */
const SCAR = [0.18, 0.36];
const FLAKE = 0.035;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
const newell = (P) => { let n = [0, 0, 0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); } return n; };
/** A number nought to one off two integers, the same every run. */
const hash = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000 / 1000;

export function knap(asset) {
  const A = JSON.parse(JSON.stringify(asset));
  const V = [];
  for (let i = 0; i < A.verts.length; i += 3) V.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const glowFrom = A.glowFrom < 0 ? A.polys.length : A.glowFrom;
  const role = (k) => A.plain[k]?.metal;
  const isHead = (i) => i < glowFrom && !!role(A.polys[i][1]);
  const crack = A.mats.indexOf('crackM');
  // The head's points, its middle, and how big it is.
  const headV = new Set();
  A.polys.forEach(([v], i) => { if (isHead(i)) v.forEach((x) => headV.add(x)); });
  const mid = mul([...headV].reduce((s, i) => add(s, V[i]), [0, 0, 0]), 1 / Math.max(1, headV.size));
  const size = Math.max(...[...headV].map((i) => len(sub(V[i], mid))));
  /* ---- the edge flaked: its points pushed out and in by turns, station by station along it ---- */
  const edgeV = new Set();
  A.polys.forEach(([v, k], i) => { if (isHead(i) && role(k) === 'edge') v.forEach((x) => edgeV.add(x)); });
  if (edgeV.size > 2) {
    const pts = [...edgeV];
    // (along the edge: the way its points spread furthest)
    let axis = [1, 0, 0], best = -1;
    for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1], unit([1, 1, 0]), unit([1, -1, 0]), unit([0, 1, 1]), unit([0, 1, -1]), unit([1, 0, 1]), unit([1, 0, -1])]) {
      const ts = pts.map((i) => dot(V[i], d)), spread = Math.max(...ts) - Math.min(...ts);
      if (spread > best) { best = spread; axis = d; }
    }
    const ts = pts.map((i) => dot(V[i], axis)), order = [...ts].sort((a, b) => a - b);
    // (its stations: points within a hair of one another along it are one station, through the thickness)
    const stations = [];
    for (const t of order) if (!stations.length || t - stations[stations.length - 1] > best * 0.02) stations.push(t);
    const at = (t) => stations.reduce((bi, s, j) => (Math.abs(s - t) < Math.abs(stations[bi] - t) ? j : bi), 0);
    pts.forEach((i, j) => {
      const s = at(ts[j]), out = sub(V[i], mid), o = unit(sub(out, mul(axis, dot(out, axis))));
      const k = (s % 2 ? 1 : -1) * FLAKE * size * (0.6 + 0.8 * hash(s, 7));
      V[i] = add(V[i], mul(o, k));
    });
  }
  /* ---- every face of the head in facets round a sunk flake scar; the edge's in triangles; the veins gone ---- */
  const polys = [], tris = [];
  let newGlow = -1;
  const faceMats = ['stoneM', 'stoneLM', 'stoneBM'].map((n) => A.mats.indexOf(n)).filter((k) => k >= 0);
  A.polys.forEach(([v, k], i) => {
    if (i === glowFrom) newGlow = polys.length;
    if (!isHead(i)) {
      const pi = polys.length;
      polys.push([v, k]);
      for (let t = 0; t < A.tris.length; t += 4) if (A.tris[t + 3] === i) tris.push(A.tris[t], A.tris[t + 1], A.tris[t + 2], pi);
      return;
    }
    if (k === crack) return;
    const P = v.map((x) => V[x]), n = unit(newell(P)), c = mul(P.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / P.length);
    const reach = Math.max(...P.map((p) => len(sub(p, c))));
    const tri = (a, b, d, m) => { const pi = polys.length; polys.push([[a, b, d], m]); tris.push(a, b, d, pi); };
    if (role(k) === 'face' && v.length >= 3 && reach > size * 0.06) {
      const deep = reach * (SCAR[0] + (SCAR[1] - SCAR[0]) * hash(i, 3));
      V.push(sub(c, mul(n, deep)));
      const ci = V.length - 1;
      A.alpha.push(1);
      v.forEach((a, j) => {
        const b = v[(j + 1) % v.length], h = hash(i, j);
        tri(a, b, ci, h < 0.34 && faceMats.length ? faceMats[1 % faceMats.length] : h > 0.74 && faceMats.length > 2 ? faceMats[2] : k);
      });
    } else {
      for (let j = 1; j + 1 < v.length; j++) tri(v[0], v[j], v[j + 1], k);
    }
  });
  if (newGlow < 0) newGlow = A.glowFrom < 0 ? -1 : polys.length;
  A.polys = polys;
  A.tris = tris;
  A.glowFrom = newGlow;
  A.verts = V.flat().map((x) => +x.toFixed(5));
  // Obsidian's colours, lit for their sheen, kept as given.
  for (const look of [A.plain, A.enchanted]) look.forEach((m, j) => { const c = OBSIDIAN[A.mats[j]]; if (c && m.metal) { m.c = c; m.metal = 'glass'; } });
  A.counts = { ...A.counts, polys: polys.length, tris: tris.length / 4 };
  A.built = 'node tools/sculpt/gear/obsidian.mjs (the metal prop\'s head knapped)';
  return A;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = new URL('../../../src/sculpt/assets/', import.meta.url);
  for (const asset of new Set(Object.values(KNAPPED_ASSETS))) {
    const A = knap(JSON.parse(readFileSync(new URL(`${asset}.json`, dir), 'utf8')));
    writeFileSync(new URL(`obsidian_${asset}.json`, dir), JSON.stringify(A));
    console.log(`obsidian_${asset}.json: ${A.verts.length / 3} points, ${A.polys.length} polygons`);
  }
}
