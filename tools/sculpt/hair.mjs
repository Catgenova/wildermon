// The hairstyles the sculpt draws over the traced head, one mesh per HAIRSTYLES id (src/game/look.ts), built per body in
// MakeHuman's space by `tools/sculpt/base.mjs` and kept once in the asset for every band. `generic` is the hair a style
// not made yet falls back to. Every style is a function of the body's head (`head` below) into a `facets()` mesh, the
// same topology for the man and the woman.
//
// `head`: { P (head units [u, v, z] -> MakeHuman's space: u the viewer's right, v up from the chin, z forward, the head
// one tall), H (the head's height), tris (the traced head's triangles, [p0, p1, p2, region]), skull (its vertices), ey
// (the eyes' height), style ('man' | 'woman') }.
//
// Regions: 9 the generic shell and clumps (the lilac highlight stamp), 12 a generic clump with the teal, 16 a cut's
// planes (the hair's own colour, flat-shaded; its stamp, positive, the top's lighter colour on a plane facing up), 17 a
// cut's edge where its thickness shows (the dark of the hair).
import { facets } from './planar.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const HEAD = [['head', 1]];

/** Piecewise-linear through [x, y] pairs (sorted by x), held flat past the ends. */
const interp = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (x <= table[i][0]) { const [x0, y0] = table[i - 1], [x1, y1] = table[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return table[table.length - 1][1];
};
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** How far from `o` along unit `d` the head's skin is (its furthest crossing), or 0 where the ray misses. */
function skullAlong(head, o, d) {
  let best = 0;
  for (const [a, b, c, region] of head.tris) {
    if (region === 14) continue; // the ears stand off the skull: the hair sits on the skull, not on them
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det; if (t > best) best = t;
  }
  return best;
}

/* ---- short: the reference picture's cut (docs/aesthetic/14) ---------------------------------------------------------
 * A low-poly cap laid on a grid over the skull: columns run front to back at angles `g` across the head (about the
 * front-back axis through the skull's middle; negative to the viewer's left), rows run side to side at fractions `s` from
 * the front hairline to the nape. The part is the column at g = -30 (his right, the viewer's left): the volume rises off
 * it and is swept over to the viewer's right, highest at the front; the part side is cut short; the sides are trimmed
 * close above the ears; the back tapers to the nape. Each grid cell is two flat triangles, the vertices jittered so the
 * triangles break into slabs; a skirt from the cap's edge into the skull closes it, so the fringe's thickness shows. */
const SHORT = {
  centre: [0, 0.6, -0.06],
  cols: [-90, -68, -50, -30, -14, 2, 18, 34, 50, 66, 90],
  part: 3,
  // (The outer columns are the side poles, straight out over the ears, where every row meets: the hairline runs from the
  // temple to the pole and back down to the nape, round nothing.)
  rows: [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1],
  // The hairline: the front's and the nape's angle (degrees about the across axis from straight ahead, up positive) per
  // column. The fringe sweeps down to the temple on the viewer's right; the part side comes down to the temple too.
  front: [[-84, -6], [-68, -14], [-50, 20], [-30, 37], [0, 40], [30, 36], [50, 16], [68, -12], [84, -6]],
  back: [[-84, 176], [-60, 188], [-30, 198], [0, 206], [30, 198], [60, 188], [84, 176]],
  // The fringe's points: each front column's hairline lowered (negative) or raised, degrees.
  tips: [0, 3, -4, 4, -10, 3, -11, 2, -9, 3, 0],
  // Thickness off the skull in head heights: along the rows from the front, and across the columns, multiplied.
  along: [[0, 0.085], [0.1, 0.16], [0.22, 0.15], [0.36, 0.105], [0.5, 0.072], [0.64, 0.055], [0.78, 0.036], [0.9, 0.024], [1, 0.016]],
  across: [[-84, 0.2], [-68, 0.45], [-50, 0.5], [-30, 0.55], [-14, 1.0], [18, 1.0], [34, 0.78], [50, 0.48], [66, 0.22], [84, 0.1]],
  // Behind the crown the sides are cut closer: the across factor there, blended in from s = 0.3 to 0.6.
  acrossBack: [[-84, 0.12], [-68, 0.28], [-50, 0.6], [-30, 0.85], [0, 1.0], [30, 0.85], [50, 0.6], [68, 0.28], [84, 0.12]],
  // The sweep: on top, each point pushed to the viewer's right by this many times its thickness; the front row forward.
  sweep: 0.6, lean: 0.025,
  jitter: 0.025, slide: 3,
  // How far up a plane faces (the up component of its normal) to take the top's lighter colour.
  topAt: 0.7,
};

export function shortHair(head, f = facets()) {
  const S = SHORT, H = head.H, c = head.P(S.centre);
  const nc = S.cols.length, nr = S.rows.length;
  const rad = (x) => (x * Math.PI) / 180;
  const dirOf = (beta, gamma) => { const b = rad(beta), g = rad(gamma); return [Math.sin(g), Math.cos(g) * Math.sin(b), Math.cos(g) * Math.cos(b)]; };
  const outer = [], inner = [];
  for (let i = 0; i < nr; i++) {
    outer.push([]); inner.push([]);
    for (let j = 0; j < nc; j++) {
      const s = S.rows[i];
      // Jitter on the inside of the grid only, so the edges stay where the hairline says: the point slid a little over
      // the skull and stood a little in or out, so a cell's two triangles break into two slabs.
      const edge = i === 0 || i === nr - 1 || j === 0 || j === nc - 1;
      const jit = (k) => (edge ? 0 : (hash(i + 17 * k, j + 31 * k) - 0.5) * 2);
      const g = S.cols[j] + jit(1) * S.slide;
      const b0 = interp(S.front, g) + S.tips[j], b1 = interp(S.back, g);
      const beta = b0 + (b1 - b0) * s + jit(2) * S.slide;
      const d = dirOf(beta, g);
      const R = skullAlong(head, c, d) || 0.45 * H;
      const k = Math.min(1, Math.max(0, (s - 0.3) / 0.3));
      let t = Math.max(0.016, interp(S.along, s) * (interp(S.across, g) * (1 - k) + interp(S.acrossBack, g) * k));
      // The part: a crease where the volume leaves the short side.
      if (j === S.part && i > 0 && i < nr - 1) t *= 0.8;
      const pole = Math.abs(g) >= 90;
      if (pole) t = 0.016;
      const jr = jit(0) * S.jitter * Math.min(1, t / 0.1);
      let p = add(c, mul(d, R + (t + jr) * H));
      // The sweep, where the point faces up: over to the viewer's right, by its thickness.
      const up = Math.max(0, d[1]);
      p = add(p, [S.sweep * t * up * H, 0, 0]);
      // The front's lean: the quiff carried forward over the forehead.
      if (i <= 1 && j >= S.part && !pole) p = add(p, [0, 0, S.lean * H * (i === 0 ? 1 : 0.6)]);
      outer[i].push(p);
      inner[i].push(add(c, mul(d, R - 0.012 * H)));
    }
  }
  // No plane of the cap inside the skull: where a triangle's middle or an edge's middle comes nearer the skull's middle
  // than the skin plus a margin, its corners are stood out along their own lines until none does.
  const tri = (i, j) => (j >= S.part ? [[[i, j], [i, j + 1], [i + 1, j + 1]], [[i, j], [i + 1, j + 1], [i + 1, j]]] : [[[i, j], [i, j + 1], [i + 1, j]], [[i, j + 1], [i + 1, j + 1], [i + 1, j]]]);
  const margin = 0.01 * H;
  for (let pass = 0; pass < 8; pass++) {
    let moved = 0;
    for (let i = 0; i + 1 < nr; i++) for (let j = 0; j + 1 < nc; j++) for (const t3 of tri(i, j)) {
      const P3 = t3.map(([a, b]) => outer[a][b]);
      for (const p of [mul(add(add(P3[0], P3[1]), P3[2]), 1 / 3), mul(add(P3[0], P3[1]), 0.5), mul(add(P3[1], P3[2]), 0.5), mul(add(P3[2], P3[0]), 0.5)]) {
        const v = sub(p, c), l = Math.hypot(...v), R = skullAlong(head, c, mul(v, 1 / l));
        const short = R + margin - l;
        if (R && short > 0) { moved++; for (const [a, b] of t3) { const q = outer[a][b], w = sub(q, c), wl = Math.hypot(...w); outer[a][b] = add(c, mul(w, (wl + short) / wl)); } }
      }
    }
    if (!moved) break;
  }
  // Each pole one point again: the furthest out of its column.
  for (const j of [0, nc - 1]) {
    const far = outer.map((r) => r[j]).reduce((a, b) => (Math.hypot(...sub(b, c)) > Math.hypot(...sub(a, c)) ? b : a));
    for (let i = 0; i < nr; i++) outer[i][j] = far;
  }
  // The cap's planes facing up (in the head's frame) take the lighter top colour: a stamp over the whole facet.
  const R16 = 16, R17 = 17;
  const plane = (pts) => {
    const before = f.pos.length;
    f.facet(pts, R16, HEAD, c);
    const n = cross(sub(f.pos[before + 1], f.pos[before]), sub(f.pos[before + 2], f.pos[before])), l = Math.hypot(...n) || 1;
    const top = n[1] / l - S.topAt;
    for (let k = before; k < f.pos.length; k++) f.stamp[k] = top > 0 ? 0.5 : -1;
  };
  f.capFrom = f.tris.length;
  // The cap: two triangles a cell, the diagonal laid along the sweep (from the part outward each way).
  for (let i = 0; i + 1 < nr; i++) for (let j = 0; j + 1 < nc; j++) {
    const a = outer[i][j], b = outer[i][j + 1], d = outer[i + 1][j], e = outer[i + 1][j + 1];
    // (Next to a pole the two corners on it are one point: that cell is one triangle.)
    if (j >= S.part) { if (j + 1 !== nc - 1) plane([a, b, e]); plane([a, e, d]); }
    else { if (j !== 0) plane([a, b, d]); plane([b, e, d]); }
  }
  f.capTo = f.tris.length;
  // The skirt: from each edge of the cap down into the skull, facing out of the cap.
  const skirt = (i0, j0, i1, j1, ii, jj) => {
    const a = outer[i0][j0], b = outer[i1][j1], a2 = inner[i0][j0], b2 = inner[i1][j1];
    const mid = mul(add(a, b), 0.5), inMid = mul(add(outer[ii][jj], outer[ii + (i1 - i0)][jj + (j1 - j0)]), 0.5);
    f.facet([a, b, b2, a2], R17, HEAD, sub(mid, inMid), true);
  };
  for (let j = 0; j + 1 < nc; j++) { skirt(0, j, 0, j + 1, 1, j); skirt(nr - 1, j, nr - 1, j + 1, nr - 2, j); }
  // (The poles' columns are single points: no skirt runs along them.)
  return f;
}

/* ---- generic: the design sheet's tousled hair, for every style not made yet ---------------------------------------- */

/**
 * A shell of the scalp's own faces pushed out, and over it the sheet's wedges -- a fringe mass swept over the forehead
 * with pointed tips, side masses over the ears, a tousled top with two cowlicks, a mass down the nape.
 */
export function genericHair(head, f = facets()) {
  const { ey, style } = head;
  const put = (p, region, stamp = -1) => { f.pos.push(p); f.region.push(region); f.stamp.push(stamp); f.bones.push(HEAD); return f.pos.length - 1; };
  const hairline = (p) => (p[2] > 0.3 ? ey + 0.55 : p[2] > -0.3 ? ey + 0.1 : ey + 0.05);
  // The shell: the traced skull's own facets above the hairline, pushed out from the skull's middle (the same way for
  // every copy of a vertex, so the shell has no cracks), further on top and at the back than at the hairline.
  const c0 = [0, ey + 0.15, 0.3];
  const hh = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  for (const [p0, p1, p2, region] of head.tris) {
    const tr = [p0, p1, p2];
    if (region !== 1 || !tr.every((p) => p[1] > hairline(p))) continue;
    const ids = tr.map((p) => {
      const d = [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]], l = Math.hypot(...d) || 1;
      const edge = p[1] < hairline(p) + 0.2;
      const h = (edge ? 0.08 : 0.14 + 0.22 * Math.max(0, d[1] / l) + 0.26 * Math.max(0, -d[2] / l)) + 0.04 * hh(Math.round(p[0] * 97 + p[1] * 31 + p[2] * 13));
      return put([p[0] + (d[0] / l) * h, p[1] + (d[1] / l) * h - (edge ? 0.08 : 0), p[2] + (d[2] / l) * h], 9);
    });
    f.tris.push(ids);
  }
  // A clump of hair: a lofted flattened teardrop along a curve through three points -- a thick rounded base sunk a
  // little into the shell, the body standing off the skull, tapering to a point. Its upper face carries a highlight
  // stamp (region 9 lilac, region 12 teal), positive where the ring faces up and out.
  const clump = (pts, w0, h0, up, region = 9) => {
    const P = (t) => [0, 1, 2].map((k) => (1 - t) * (1 - t) * pts[0][k] + 2 * (1 - t) * t * pts[1][k] + t * t * pts[2][k]);
    const S = 8, M = 10, rings = [];
    for (let i = 0; i <= S; i++) {
      const t = i / S, c = P(t), d = [0, 1, 2].map((k) => P(Math.min(1, t + 0.01))[k] - P(Math.max(0, t - 0.01))[k]), dl = Math.hypot(...d) || 1;
      const tg = d.map((x) => x / dl);
      let side = [tg[1] * up[2] - tg[2] * up[1], tg[2] * up[0] - tg[0] * up[2], tg[0] * up[1] - tg[1] * up[0]]; const sl = Math.hypot(...side) || 1; side = side.map((x) => x / sl);
      const u = [side[1] * tg[2] - side[2] * tg[1], side[2] * tg[0] - side[0] * tg[2], side[0] * tg[1] - side[1] * tg[0]];
      // Rounded at the base (a quarter circle over the first fifth), then tapering to the point.
      const g = t < 0.2 ? Math.sqrt(1 - (1 - t / 0.2) * (1 - t / 0.2)) : 1 - ((t - 0.2) / 0.8) * ((t - 0.2) / 0.8) * 0.96;
      const taper = i === S ? 0.02 : Math.max(0.02, g), w = w0 * taper, h = h0 * taper;
      rings.push(Array.from({ length: M }, (_, j) => {
        const a = (j / M) * Math.PI * 2, lit = Math.sin(a) - 0.25;
        return put([c[0] + side[0] * w * Math.cos(a) + u[0] * h * Math.sin(a), c[1] + side[1] * w * Math.cos(a) + u[1] * h * Math.sin(a), c[2] + side[2] * w * Math.cos(a) + u[2] * h * Math.sin(a)], region, lit * 0.3);
      }));
    }
    const p0 = P(0), b = [0, 1, 2].map((k) => p0[k] - (P(0.05)[k] - p0[k]) * 1.5);
    const cap = put(b, region, -0.3);
    for (let j = 0; j < M; j++) f.tris.push([cap, rings[0][(j + 1) % M], rings[0][j]]);
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < M; j++) { const a = rings[i][j], d = rings[i][(j + 1) % M], e2 = rings[i + 1][j], f2 = rings[i + 1][(j + 1) % M]; f.tris.push([a, d, f2], [a, f2, e2]); }
  };
  // The clumps are set by direction from the skull's middle: azimuth from the front (toward the body's left positive),
  // elevation, and how far out past the skull. The flat of each faces out. Sizes in head widths.
  const skull = head.skull.map((p) => { const d = [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]]; const l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l, d[2] / l, l]; });
  const Hd = (az, el, out, cap = 9) => {
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, d = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
    // The skull's radius along d: the furthest vertex within a narrow cone, widening the cone until one is found.
    let r = 0; for (const cone of [0.99, 0.975, 0.95, 0.9]) { for (const v of skull) if (v[0] * d[0] + v[1] * d[1] + v[2] * d[2] > cone) r = Math.max(r, v[3]); if (r) break; }
    r = Math.min(r || 0.9, cap);
    return [c0[0] + d[0] * (r + out), c0[1] + d[1] * (r + out), c0[2] + d[2] * (r + out)];
  };
  const HW = 1.7;
  const C = (a, b, c, w, h, region) => { const p1 = Hd(...b); const up = [p1[0] - c0[0], p1[1] - c0[1], p1[2] - c0[2]]; clump([Hd(...a), p1, Hd(...c)], w * HW, h * HW, up, region); };
  // The fringe: three big clumps from the right temple sweeping left across the forehead, tips over the brows (one between
  // them), and a small clump flicking up off the forehead at the parting. Two of them carry the teal. (A clump's middle
  // control point pulls its curve only half way, so the middles stand at twice the mass wanted.)
  C([-70, 24, -0.04], [-42, 24, 0.55], [-16, -1, 0.2], 0.17, 0.06, 12);
  C([-55, 30, -0.04], [-16, 28, 0.6], [2, -3, 0.2], 0.18, 0.06);
  C([-35, 36, -0.04], [12, 28, 0.56], [32, 1, 0.22], 0.17, 0.06);
  C([-45, 40, -0.02], [-54, 60, 0.5], [-76, 70, 0.62], 0.09, 0.04);
  // The top: four clumps fanning up and back from the front of the crown, the tips splaying apart.
  C([-30, 46, -0.04], [-42, 80, 0.85], [-122, 44, 0.7], 0.2, 0.075, 12);
  C([-10, 52, -0.04], [-4, 88, 0.95], [184, 30, 0.75], 0.21, 0.075);
  C([15, 48, -0.04], [44, 80, 0.85], [118, 50, 0.5], 0.2, 0.075);
  C([40, 42, -0.04], [72, 70, 0.75], [152, 18, 0.62], 0.2, 0.075);
  // The sides: two clumps a side sweeping back over the top third of the ear, and one behind it to the nape. The woman's
  // fall to the jaw and the nape's to the shoulders: the same clumps on longer curves, so the two bodies keep one topology.
  const L = style === 'woman';
  for (const sd of [-1, 1]) {
    C([sd * 40, 36, -0.04], [sd * 78, L ? 8 : 18, 0.34], [sd * 104, L ? -34 : -8, L ? 0.2 : 0.26, 1.15], 0.16, 0.06);
    C([sd * 60, 30, -0.04], [sd * 96, L ? 0 : 8, 0.32], [sd * 122, L ? -42 : -16, L ? 0.16 : 0.22, 1.15], 0.15, 0.06);
    C([sd * 118, 40, -0.04], [sd * 132, L ? 0 : 8, 0.56], [sd * 142, L ? -52 : -24, L ? 0.16 : 0.2, L ? 1.3 : 1.0], L ? 0.2 : 0.16, 0.06);
  }
  // The nape: three clumps down the neck, the middle one longest.
  C([150, 32, -0.04], [148, L ? -10 : 0, 0.62], [158, L ? -62 : -26, L ? 0.14 : 0.22, L ? 1.5 : 1.0], L ? 0.24 : 0.2, 0.06);
  C([180, 36, -0.04], [180, L ? -12 : -2, 0.66], [180, L ? -72 : -40, L ? 0.14 : 0.16, L ? 1.6 : 1.0], L ? 0.25 : 0.2, 0.07);
  C([210, 32, -0.04], [212, L ? -10 : 0, 0.62], [202, L ? -62 : -32, L ? 0.14 : 0.26, L ? 1.5 : 1.0], L ? 0.24 : 0.2, 0.06);
  return f;
}

/** The styles made, by HAIRSTYLES id; `generic` for the rest. */
export const HAIRS = { generic: genericHair, short: shortHair };

/**
 * Where a style's mesh goes inside the head: the points of its triangles (centroids and edge middles) nearer the skull's
 * middle than the head's own skin along the same line, as a count and the deepest, in head heights.
 */
export function clipAudit(head, f) {
  const c = head.P(SHORT.centre);
  let n = 0, worst = 0;
  for (const [a, b, d] of f.tris.slice(f.capFrom ?? 0, f.capTo ?? f.tris.length)) {
    const A = f.pos[a], B = f.pos[b], D = f.pos[d];
    for (const p of [mul(add(add(A, B), D), 1 / 3), mul(add(A, B), 0.5), mul(add(B, D), 0.5), mul(add(D, A), 0.5)]) {
      const v = sub(p, c), l = Math.hypot(...v) || 1, R = skullAlong(head, c, mul(v, 1 / l));
      if (R && l < R - 1e-6) { n++; worst = Math.max(worst, (R - l) / head.H); }
    }
  }
  return { inside: n, deepest: +worst.toFixed(4) };
}
