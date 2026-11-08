// Each plate of the chest (tools/sculpt/garments/platechest.mjs) read off the sheet's pieces (tools/sculpt/plate/
// chest-masks.json) onto the body, under the registered cameras, review pose and body map (lowplatechestview.mjs):
//
//   a chart: points over the surface a set of plates is laid on (the trunk's at the plates' clearance, the faulds' over
//   the hips, the pauldron's dome, the arm's sections), each mapped as the plate there would be (the review pose, the
//   sheet's body map) and looked up in every view that sees it face on (facing the camera, not behind our own body, not
//   under one of the sheet's arm pieces for a point on the trunk): the pieces there weighted by how square on, and the
//   background as none; each point the piece with the most.
//   Each plate's outline is then its chart's points: per column its top and bottom (the breastplate's foot and sides,
//   the back plate's, the lames' and the belt's feet, each fauld's sides and foot), and the faulds' flare from the
//   sheet's outline in the front and back views.
//
//   solve() writes tools/sculpt/plate/chest-fit.json ({ who: { breast, back, lames, faulds, ... } }, taken over DESIGN
//   by platechest.mjs designOf) and returns it.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, posed } from './lowrig.mjs';
import { TORSO_RING } from './lowarm.mjs';
import { DESIGN, bodySamples, trunkCharts, pauldronFrame, collarFrame, armCharts } from './garments/platechest.mjs';
import { VIEWS, PIECES, DIR, loadCams, reviewVerts, reviewPose, bodyMap, proj, pw, sheetLabels, canvas, fillTri, savePNG } from './lowplatechestview.mjs';
import { sub, cross, unit, dot, add, mul } from './lowgarment.mjs';

const IDX = Object.fromEntries(PIECES.map((n, i) => [n, i + 1]));
const ARMP = new Set(PIECES.map((n, i) => (/^(pauldron|plame|rerebrace|under|vambrace|cuff|gauntlet)/.test(n) ? i + 1 : 0)).filter(Boolean));
const r3 = (x) => +x.toFixed(3);

/** The voter for a body: vote(points, onTrunk) with points [{ q (mapped), n (mapped normal) }] → per point { label: weight }. */
function voter(rig, C) {
  const { PB } = reviewVerts(rig, null, C), who = rig.who, V = {};
  for (const v of VIEWS) {
    const S = sheetLabels(who, v), Z = canvas(S.W, S.H);
    const P = PB.map((p) => { const q = proj(p, C, v); return [q[0] - S.x0, q[1] - S.y0, q[2]]; });
    for (const t of rig.B.tris) fillTri(Z, P[t.v[0]], P[t.v[1]], P[t.v[2]], [0, 0, 0]);
    const a = (C.views[v].yaw * Math.PI) / 180;
    V[v] = { S, Z, eye: [-Math.sin(a), 0, Math.cos(a)] };
  }
  return (pts, onTrunk = true, tol = 0.12) => pts.map(({ q, n }) => {
    const w = {};
    for (const v of VIEWS) {
      const { S, Z, eye } = V[v], f = dot(n, eye);
      if (f < 0.25) continue;
      const p = proj(q, C, v), x = Math.floor(p[0] - S.x0), y = Math.floor(p[1] - S.y0);
      if (x < 0 || y < 0 || x >= S.W || y >= S.H) continue;
      if (p[2] < Z.z[y * S.W + x] - tol) continue;
      const k = S.L[y * S.W + x];
      if (onTrunk && ARMP.has(k)) continue;
      w[k] = (w[k] ?? 0) + f * f * f;
    }
    return w;
  });
}
const winner = (w) => { let b = -1, bw = 0.02; for (const [k, x] of Object.entries(w)) if (x > bw) { bw = x; b = +k; } return b; };

/** A grid chart: at(y, az) the point; its normals by differences; returns cells [{ y, az, q, n, k (winner) }]. */
function chart(vote, at, ys, azs, map, onTrunk = true) {
  const P = ys.map((y) => azs.map((a) => at(y, a)));
  const cells = [];
  ys.forEach((y, i) => azs.forEach((a, j) => {
    const p = P[i][j], du = sub(P[i][Math.min(j + 1, azs.length - 1)], P[i][Math.max(j - 1, 0)]), dv = sub(P[Math.max(i - 1, 0)][j], P[Math.min(i + 1, ys.length - 1)][j]);
    let n = unit(cross(dv, du));
    const out = [p[0], 0, p[2]];
    if (dot(n, out) < 0) n = n.map((x) => -x);
    cells.push({ y, az: a, p, q: map(p), n: unit(map.normal(n, p)) });
  }));
  const W = vote(cells, onTrunk);
  cells.forEach((c, i) => { c.k = winner(W[i]); });
  return cells;
}
const range = (a, b, s) => { const o = []; for (let x = a; s > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += s) o.push(+x.toFixed(4)); return o; };

export async function solve() {
  const FIT = {}, cams = loadCams();
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), C = cams[who], D = structuredClone(DESIGN[who]), S = bodySamples(rig.B);
    const vote = voter(rig, C);
    const tmap = (p) => [p[0] * pw(C.sx, p[1]), p[1], p[2] * pw(C.sz, p[1])];
    tmap.normal = (n, p) => [n[0] / pw(C.sx, p[1]), n[1], n[2] / pw(C.sz, p[1])];
    // the faulds' clearance and flare: their outline in the front and back views (the side plates' outer edge, row by
    // row, taken back through the body map) against the hips' reach, by least squares on c + flare (top - y) / 2
    {
      const F0 = D.faulds, { fsec } = trunkCharts(D, S), rows = [];
      const reachX = (y) => Math.max(...[60, 75, 90, 105, 120].map((a) => fsec.at(y, a, 0)[0]));
      for (const v of ['front', 'back']) {
        const Sv = sheetLabels(who, v), ids = new Set([IDX['fauld.l'], IDX['fauld.r']]);
        for (let y = 0; y < Sv.H; y++) {
          const by = (C.cy - (Sv.y0 + y + 0.5)) / C.s;
          if (by > F0.top - 0.25) continue;
          for (const side of [-1, 1]) {
            let edge = null;
            for (let x = 0; x < Sv.W; x++) { const xx = side > 0 ? Sv.W - 1 - x : x; if (ids.has(Sv.L[y * Sv.W + xx])) { edge = xx; break; } }
            if (edge === null || edge === 0 || edge === Sv.W - 1) continue;
            const half = Math.abs(Sv.x0 + edge + 0.5 - C.views[v].cx) / C.s / pw(C.sx, by);
            rows.push([F0.top - by, half - reachX(by)]);
          }
        }
      }
      // (need(y) = c + flare (top - y) / 2: a line through the rows)
      const n = rows.length, mx = rows.reduce((a, r) => a + r[0], 0) / n, my = rows.reduce((a, r) => a + r[1], 0) / n;
      const b = rows.reduce((a, r) => a + (r[0] - mx) * (r[1] - my), 0) / rows.reduce((a, r) => a + (r[0] - mx) ** 2, 0);
      const c = my - b * mx;
      D.faulds = { ...F0, c: r3(Math.max(0.08, c)), flare: r3(Math.max(0, 2 * b)) };
    }
    const { chest, fauldAt } = trunkCharts(D, S);
    const F = D.faulds, low = who === 'male' ? -6.8 : -5.8;
    const azs = range(-180, 177, 3);
    const trunk = chart(vote, (y, a) => chest.at(y, a, 0.06), range(0.2, F.top - 0.6, -0.03), azs, tmap);
    const fauld = chart(vote, (y, a) => fauldAt(y, a), range(F.top, low, -0.03), azs, tmap);
    if (process.env.CHART) {
      const pic = (cells, ys) => { const R = canvas(azs.length * 3, ys.length * 3); cells.forEach((c, i) => { const x = i % azs.length, y = Math.floor(i / azs.length), h = c.k < 0 ? [0, 0, 0] : c.k === 0 ? [60, 60, 60] : [(c.k * 97) % 255, (c.k * 57 + 80) % 255, (c.k * 151 + 40) % 255]; for (let d = 0; d < 9; d++) R.c.set(h, ((y * 3 + Math.floor(d / 3)) * R.W + x * 3 + (d % 3)) * 3); }); return R; };
      const tx = []; for (const [cells, ys, y0] of [[trunk, range(0.2, F.top - 0.6, -0.03), 0]]) for (const k of new Set(cells.map((c) => c.k))) { if (k <= 0) continue; const cs = cells.map((c, i) => [c, i]).filter(([c]) => c.k === k); const m = cs[Math.floor(cs.length / 2)][1]; tx.push([(m % azs.length) * 3, 22 + 16 + Math.floor(m / azs.length) * 3, PIECES[k - 1], [255, 255, 255]]); }
      savePNG(process.env.CHART + `-${who}.png`, [[{ R: pic(trunk, range(0.2, F.top - 0.6, -0.03)), label: 'trunk chart: az -180..180 across, y down' }], [{ R: pic(fauld, range(F.top, low, -0.03)), label: 'fauld chart' }]], { title: who, texts: tx });
    }
    // per piece and |az| column: its cells' heights (both sides, within half a step)
    // (per side, the longest run of the piece down the column, allowing gaps of 2 cells: [right's, left's])
    const runs = (cells, piece, az, half = 1.6) => [1, -1].map((sgn) => {
      const ys = [...new Set(cells.filter((c) => c.k === IDX[piece] && Math.abs(c.az * sgn - az) <= half + (az === 180 ? 0 : 0) && (az === 0 || az === 180 || Math.sign(c.az) === sgn || Math.abs(c.az) === 180)).map((c) => c.y))].sort((a, b) => b - a);
      let best = [], cur = [];
      for (const y of ys) { if (cur.length && cur[cur.length - 1] - y > 0.1) { if (cur.length > best.length) best = cur; cur = []; } cur.push(y); }
      return cur.length > best.length ? cur : best;
    });
    // (the foot: the mean of the two sides' where both have the piece, else the one that has)
    const footAt = (cells, piece, az, half) => { const f = runs(cells, piece, az, half).filter((r) => r.length >= 2).map((r) => Math.min(...r)); return f.length ? f.reduce((a, b) => a + b) / f.length : null; };
    const has = (cells, piece, az, half) => runs(cells, piece, az, half).map((r) => r.length >= 3);
    const fill = (vals) => { // (columns with nothing: from their neighbours)
      const idx = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
      return vals.map((v, i) => { if (v !== null) return v; const a = idx.filter((j) => j < i).pop(), b = idx.find((j) => j > i); return a === undefined ? vals[b] : b === undefined ? vals[a] : vals[a] + ((vals[b] - vals[a]) * (i - a)) / (b - a); });
    };
    const lowOf = (ys) => (ys.length >= 2 ? Math.min(...ys) : null), highOf = (ys) => (ys.length >= 2 ? Math.max(...ys) : null);
    const out = {};
    const interp = (A, Vv, x) => { if (x <= A[0]) return Vv[0]; for (let i = 0; i + 1 < A.length; i++) if (x <= A[i + 1]) return Vv[i] + ((Vv[i + 1] - Vv[i]) * (x - A[i])) / (A[i + 1] - A[i]); return Vv[Vv.length - 1]; };

    // the breastplate: its foot per column, its side where it stops; the top the design's (the collar's and the
    // pauldrons' line, under them on the sheet)
    {
      const B = D.breast, step = 6, cols = [];
      // (its side: the mean of the two sides' last columns)
      const lastOf = (sd) => { let l = 0; for (let a = 0; a <= 126; a += step) { if (has(trunk, 'breast', a)[sd]) l = a; else if (a > 30) break; } return l; };
      const last = Math.round((lastOf(0) + lastOf(1)) / 2 / step) * step;
      for (let a = 0; a <= last; a += step) cols.push([a, footAt(trunk, 'breast', a)]);
      const az = cols.map((c) => c[0]);
      { const f = fill(cols.map((c) => c[1])); cols.forEach((c, i) => { c[1] = f[i]; }); }
      // (the top the design's, and under the armpit (the ring where the arm meets the torso) at the side columns)
      const pit = Math.min(...TORSO_RING.map((n) => rig.B.verts[rig.B.index.get(`${n}.L`)][1])) - 0.1;
      out.breast = { az, top: az.map((a) => r3(a >= 80 ? Math.min(pit, interp(B.az, B.top, a)) : interp(B.az, B.top, a))), bottom: cols.map((c) => r3(c[1])), flat: az.reduce((b, a) => (Math.abs(a - B.flat) < Math.abs(b - B.flat) ? a : b), az[0]) };
      out.breast.top[az.length - 1] = r3(Math.min(out.breast.top[az.length - 1], interp(B.az, B.top, Math.min(last, B.az[B.az.length - 1]))));
    }
    // the back plate: from the back (180) toward the side, where it stops
    {
      const K2 = D.back, step = 6, cols = [];
      const firstOf = (sd) => { let l = 180; for (let a = 180; a >= 54; a -= step) { if (has(trunk, 'back', a)[sd]) l = a; else if (a < 150) break; } return l; };
      const first = Math.round((firstOf(0) + firstOf(1)) / 2 / step) * step;
      for (let a = first; a <= 180; a += step) cols.push([a, footAt(trunk, 'back', a)]);
      { const f = fill(cols.map((c) => c[1])); cols.forEach((c, i) => { c[1] = f[i]; }); }
      const az = cols.map((c) => c[0]);
      const pit = Math.min(...TORSO_RING.map((n) => rig.B.verts[rig.B.index.get(`${n}.L`)][1])) - 0.1;
      out.back = { az, top: az.map((a) => r3(a <= 110 ? Math.min(pit, interp(K2.az, K2.top, a)) : interp(K2.az, K2.top, a))), bottom: cols.map((c) => r3(c[1])) };
    }
    // the lames and the belt: each one's foot per column, its top under the foot of the one above by the overlap
    {
      const az = range(0, 180, 15), over = 0.18;
      const footOf = (piece) => fill(az.map((a) => footAt(trunk, piece, a, 7.5)));
      const plateFoot = az.map((a) => (a <= out.breast.az[out.breast.az.length - 1] ? interp(out.breast.az, out.breast.bottom, a) : a >= out.back.az[0] ? interp(out.back.az, out.back.bottom, a) : null));
      const above = [fill(plateFoot)];
      out.lames = D.lames.map((L, i) => {
        const piece = L.piece;
        let foot = footOf(piece);
        if (foot.some((x) => x === null || x === undefined)) foot = az.map(() => L.bottom);
        // (never above the one above's foot, and at least `over` under its top)
        foot = foot.map((y, j) => Math.min(y, above[i][j] - 0.08));
        const top = above[i].map((y) => y + over);
        above.push(foot);
        return { ...L, edge: { az, top: top.map(r3), bottom: foot.map(r3) } };
      });
    }
    // the faulds: each plate's sides (the furthest columns with its cells) and its foot at five columns between them
    {
      const plateOf = (pieces) => {
        const cs = fauld.filter((c) => pieces.some(([p, s]) => c.k === IDX[p] && Math.sign(c.az || 1) * s >= 0));
        const az = cs.map((c) => (pieces.length === 1 && pieces[0][0] === 'fauld.r' ? -c.az : c.az));
        return { cs, az };
      };
      const plates = [];
      // (the side plates first; the front and back ones no wider than to overlap them by 8°)
      let sideLo = 0, sideHi = 180;
      for (const [names, sym] of [[['fauld.l', 'fauld.r'], 'side'], [['fauld.f'], 'mid'], [['fauld.b'], 'back']]) {
        let cells = fauld.filter((c) => names.some((n) => c.k === IDX[n]));
        // (both sides onto the left: the side plates' right ones mirrored, the middle ones folded about their middle)
        const A = cells.map((c) => (sym === 'back' ? (c.az < 0 ? c.az + 360 : c.az) : sym === 'side' ? Math.abs(c.az) : c.az));
        if (A.length < 6) { plates.push(null); continue; }
        const sorted = A.slice().sort((a, b) => a - b), lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.98)];
        const mid = (lo + hi) / 2;
        let half = sym === 'side' ? (hi - lo) / 2 : Math.max(Math.abs(lo - (sym === 'back' ? 180 : 0)), Math.abs(hi - (sym === 'back' ? 180 : 0)));
        if (sym === 'side') { sideLo = lo; sideHi = hi; }
        if (sym === 'mid') half = Math.min(half, sideLo + 8);
        if (sym === 'back') half = Math.min(half, 180 - sideHi + 8);
        const c0 = sym === 'side' ? mid : sym === 'back' ? 180 : 0;
        const az = [-1, -0.5, 0, 0.5, 1].map((t) => r3(c0 + t * (half + 2)));
        const bottom = az.map((a) => { const ys = cells.filter((c, i) => Math.abs(A[i] - a) <= 4 || (sym !== 'side' && Math.abs((2 * c0 - A[i]) - a) <= 4)).map((c) => c.y); return ys.length ? r3(Math.min(...ys)) : null; });
        plates.push({ az, bottom: fill(bottom).map(r3), sym });
      }
      const bySym = Object.fromEntries(plates.filter(Boolean).map((p) => [p.sym, p]));
      plates.splice(0, plates.length, bySym.mid ?? null, bySym.side ?? null, bySym.back ?? null);
      out.faulds = { c: D.faulds.c, flare: D.faulds.flare, plates: D.faulds.plates.map((p, i) => (plates[i] ? { ...p, az: plates[i].az, bottom: plates[i].bottom } : p)) };
    }
    // the pauldron: its dome the sheet's (the visual hull of its side's arm pieces, in the views that show that side's
    // shoulder whole), its foot where the sheet's cap ends; both sides together
    {
      const Pd = D.pauldron, { centre, dirAt, reach, outSign } = pauldronFrame(rig, D, S);
      const f = posed(rig, reviewPose(rig, C.pose)), map = bodyMap(rig, C, f);
      const views = { l: ['front', 'back', 'r3'], r: ['front', 'back', 'q3', 'side'] };
      const Sv = Object.fromEntries(VIEWS.map((v) => [v, sheetLabels(who, v)]));
      const at = (p, s) => { // (a point on the left shoulder's bone, on side s, posed and mapped)
        const q = s === 'l' ? p : [-p[0], p[1], p[2]], bi = rig.at.get(`shoulder_${s}`), b = rig.bones[bi], F0 = f[bi];
        const d = sub(q, b.head), r = [F0.S[0] * d[0] + F0.S[1] * d[1] + F0.S[2] * d[2], F0.S[3] * d[0] + F0.S[4] * d[1] + F0.S[5] * d[2], F0.S[6] * d[0] + F0.S[7] * d[1] + F0.S[8] * d[2]];
        return map([r[0] + F0.P[0], r[1] + F0.P[1], r[2] + F0.P[2]], [[bi, 1]]);
      };
      const own = (s) => new Set(['pauldron', 'plame1', 'plame2', 'rerebrace', 'under'].map((n) => IDX[`${n}.${s}`]));
      const inside = (q, s) => views[s].every((v) => { const p = proj(q, C, v), S0 = Sv[v], x = Math.floor(p[0] - S0.x0), y = Math.floor(p[1] - S0.y0); return x >= 0 && y >= 0 && x < S0.W && y < S0.H && own(s).has(S0.L[y * S0.W + x]); });
      const psi = range(0, 345, 15), phis = range(0, 120, 4);
      const R = { l: [], r: [] }, foot = { l: [], r: [] };
      for (const s of ['l', 'r']) {
        for (const ps of psi) {
          const col = [];
          for (const ph of phis) {
            const d = dirAt(ps * outSign, ph), r0 = reach(d) + D.fit.arm + 0.02;
            let r = r0;
            while (r < r0 + 1.6 && inside(at(add(centre, mul(d, r + 0.02)), s), s)) r += 0.02;
            col.push(r);
          }
          R[s].push(col);
          // (the foot: the furthest φ whose point the views take for the cap)
          const pts = phis.map((ph, i) => { const d = dirAt(ps * outSign, ph), p = add(centre, mul(d, col[i])), n0 = d; const q = at(p, s), q2 = at(add(p, mul(n0, 0.05)), s); return { q, n: unit(sub(q2, q)) }; });
          const W = vote(pts, false), k = phis.map((_, i) => winner(W[i]));
          let last = Pd.phi0;
          phis.forEach((ph, i) => { if (ph >= Pd.phi0 && k[i] === IDX[`pauldron.${s}`]) last = ph; });
          foot[s].push(last);
        }
      }
      const footPhi = psi.map((_, k) => r3((foot.l[k] + foot.r[k]) / 2));
      // (smoothed round the dome: each column the mean of itself and its neighbours, the foot likewise)
      // (kept to its first harmonics round the pole, so the dome is a smooth shell rather than the hull's facets)
      const sm = (a, H = 2) => { const n = a.length; return a.map((_, k) => { let v = 0; for (let h = 0; h <= H; h++) { let c = 0, s2 = 0; a.forEach((x, j) => { c += x * Math.cos((2 * Math.PI * h * j) / n); s2 += x * Math.sin((2 * Math.PI * h * j) / n); }); const w = h === 0 ? 1 / n : 2 / n; v += w * (c * Math.cos((2 * Math.PI * h * k) / n) + s2 * Math.sin((2 * Math.PI * h * k) / n)); } return v; }); };
      const phiS = sm(footPhi).map(r3);
      const fRows = [0, 0.2, 0.4, 0.6, 0.8, 1];
      const rAt = (s, k, ph) => { const i = Math.min(phis.length - 2, Math.floor(ph / 4)), t = (ph - phis[i]) / 4; return R[s][k][i] * (1 - t) + R[s][k][i + 1] * t; };
      const rr = fRows.map((fr) => sm(psi.map((_, k) => { const ph = Pd.phi0 + (phiS[k] - Pd.phi0) * fr; return Math.min(rAt('l', k, ph), rAt('r', k, ph)); })).map(r3));
      out.pauldron = { hull: { psi, f: fRows, phi: phiS, r: rr } };
    }
    // the collar: its top per column and where the front flaps start and end, on its own cylinder round the neck
    {
      const Cd = D.collar, { nz, rTop } = collarFrame(D, S, rig.B), r = rTop + Cd.flare;
      const cells = chart(vote, (y, a) => { const t = (a * Math.PI) / 180; return [Math.sin(t) * r, y, nz + Math.cos(t) * r]; }, range(0.6, -1.4, -0.03), azs, tmap);
      const isC = (k) => k === IDX['collar.l'] || k === IDX['collar.r'] || k === IDX['collar.back'], isF = (k) => k === IDX['collar.l'] || k === IDX['collar.r'];
      const az = range(0, 180, 15), top = [];
      for (const a of az) {
        const t = [1, -1].map((sg) => { const ys = cells.filter((c) => isC(c.k) && Math.abs(c.az - sg * a) <= 7.5).map((c) => c.y); return ys.length >= 2 ? Math.max(...ys) : null; }).filter((x) => x !== null);
        top.push(t.length ? t.reduce((x, y) => x + y) / t.length : null);
      }
      // (the flaps: from the first column either side that has them to the last)
      const flap = [1, -1].map((sg) => { const as = cells.filter((c) => isF(c.k) && Math.sign(c.az) === sg).map((c) => Math.abs(c.az)).sort((x, y) => x - y); return as.length > 4 ? [as[Math.floor(as.length * 0.03)], as[Math.floor(as.length * 0.97)]] : null; }).filter(Boolean);
      const a0 = flap.reduce((x, f) => x + f[0], 0) / flap.length, a1 = flap.reduce((x, f) => x + f[1], 0) / flap.length;
      out.collar = { topTab: { az, top: fill(top).map(r3) }, seg: { a0: r3(Math.max(6, a0)), a1: r3(Math.min(150, a1)), gap: 6 } };
    }
    // the arm's plates: on the upper arm the pauldron's lame and the rerebrace, on the forearm the vambrace (its top per
    // side round the elbow, its foot), at the wrist the cuff: each one's reach along the bone per column round it,
    // both arms together (the right's points the left's mirrored)
    {
      const { up, fo, upper, fore, wsec } = armCharts(rig, S);
      const f = posed(rig, reviewPose(rig, C.pose)), map = bodyMap(rig, C, f);
      const onBone = (p, bone, s) => {
        const q = s === 'l' ? p : [-p[0], p[1], p[2]], bi = rig.at.get(`${bone}_${s}`), b = rig.bones[bi], F0 = f[bi], d = sub(q, b.head);
        const r = [F0.S[0] * d[0] + F0.S[1] * d[1] + F0.S[2] * d[2], F0.S[3] * d[0] + F0.S[4] * d[1] + F0.S[5] * d[2], F0.S[6] * d[0] + F0.S[7] * d[1] + F0.S[8] * d[2]];
        return map([r[0] + F0.P[0], r[1] + F0.P[1], r[2] + F0.P[2]], [[bi, 1]]);
      };
      const ths = range(0, 345, 15);
      // (per side and θ, the t's of each piece's points)
      const armChart = (sec, fr, bone, ts, c) => {
        const per = {};
        for (const s of ['l', 'r']) {
          const pts = [];
          for (const th of ths) for (const t of ts) {
            const p = sec.at(t, th, c), p2 = sec.at(t, th, c + 0.05);
            const q = onBone(p, bone, s), q2 = onBone(p2, bone, s);
            pts.push({ q, n: unit(sub(q2, q)), th, t });
          }
          const W = vote(pts, false);
          pts.forEach((p, i) => { const k = winner(W[i]); if (k <= 0) return; const nm = PIECES[k - 1].replace(/\.(l|r)$/, (m, x) => (x === s ? '' : '.other')); ((per[nm] ??= {})[p.th] ??= []).push(p.t); });
        }
        return per;
      };
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
      const reachT = (per, nm, th, end) => { const ts = per[nm]?.[th]; return ts && ts.length >= 2 ? (end === 'max' ? Math.max(...ts) : Math.min(...ts)) : null; };
      const U = armChart(upper, up, 'upperarm', range(-0.2, up.len + 0.25, 0.03), 0.05);
      const Fa = armChart(fore, fo, 'lowerarm', range(-0.5, fo.len + 0.3, 0.03), 0.05);
      const Wc = armChart(wsec, { ...fo, o: rig.J.wrist }, 'hand', range(-0.6, 0.4, 0.03), 0.07);
      const outer = ths.filter((th) => th <= 210 || th >= 330);
      const lameFoot = med(outer.map((th) => reachT(U, 'plame1', th, 'max')).filter((x) => x !== null));
      const rereFoot = med(outer.map((th) => reachT(U, 'rerebrace', th, 'max')).filter((x) => x !== null));
      const vTop = (th0) => med(ths.filter((th) => Math.abs(((th - th0 + 540) % 360) - 180) <= 30).map((th) => reachT(Fa, 'vambrace', th, 'min')).filter((x) => x !== null));
      const vFoot = med(ths.map((th) => reachT(Fa, 'vambrace', th, 'max')).filter((x) => x !== null));
      const cuffT = [med(ths.map((th) => reachT(Wc, 'cuff', th, 'min')).filter((x) => x !== null)), med(ths.map((th) => reachT(Wc, 'cuff', th, 'max')).filter((x) => x !== null))];
      const Pd = D.pauldron, Rr = D.rerebrace, Vb = D.vambrace, Cf = D.cuff;
      const L0 = Pd.lames[0], lf = lameFoot ?? L0.t[1];
      out.pauldron.lames = [{ ...L0, t: [L0.t[0], r3(lf)] }];
      out.rerebrace = { t: [r3(lf - 0.22), r3(Math.max(lf + 0.1, rereFoot ?? Rr.t[1]))] };
      const tops = [0, 90, 180, 270].map(vTop), vt = Vb.top.map((x, i) => (tops[i] === null ? x : r3(tops[i])));
      out.vambrace = { top: vt, bottom: r3(vFoot ?? Vb.bottom), mid: r3(((vFoot ?? Vb.bottom) + Math.max(...vt)) / 2) };
      out.cuff = { t: [r3(cuffT[0] ?? Cf.t[0]), r3(cuffT[1] ?? Cf.t[1])] };
      console.log(who, 'arm', JSON.stringify({ lames: out.pauldron.lames, rerebrace: out.rerebrace, vambrace: out.vambrace, cuff: out.cuff }));
    }
    FIT[who] = out;
    console.log(who, 'collar', JSON.stringify(out.collar), '\n pauldron', JSON.stringify(out.pauldron.hull.phi), JSON.stringify(out.pauldron.hull.r[3]), '\n breast', JSON.stringify(out.breast), '\n back', JSON.stringify(out.back), '\n lames', JSON.stringify(out.lames.map((l) => l.edge)), '\n faulds', JSON.stringify(out.faulds.plates.map((p) => [p.az, p.bottom])));
  }
  writeFileSync(join(DIR, 'plate/chest-fit.json'), JSON.stringify(FIT, null, 1));
  return FIT;
}
if (import.meta.url === `file://${process.argv[1]}`) await solve();
