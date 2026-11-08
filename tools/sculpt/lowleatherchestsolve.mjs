// Each plate of the leather chest (tools/sculpt/garments/leatherchest.mjs) read off the sheet's pieces
// (tools/sculpt/leather/chest-masks.json) onto the body, under the registered cameras, review pose and body map
// (lowleatherchestview.mjs, each view in its own corrected pose):
//
//   a chart: points over the surface a set of plates is laid on (the trunk's at the plates' clearance, the skirt's over
//   the hips, the pauldron's dome, the arm's sections), each mapped as the plate there would be (the view's review pose,
//   the sheet's body map) and looked up in every view that sees it face on (facing the camera, not behind our own body,
//   not under one of the sheet's arm pieces for a point on the trunk): the pieces there weighted by how square on, the
//   background as none; each point the piece with the most.
//   Each plate's outline is then its chart's points: the belt's top and foot per column, the chest and back cores' feet
//   (over the belt's top) and the chest core's side, the skirt plates' sides and feet, the collar's top, the pauldron's
//   dome (the visual hull of its side's arm pieces) and foot, the lames', the base sleeve's end, the bracer's and the
//   band's spans along the arm.
//
//   solve() writes tools/sculpt/leather/chest-fit.json ({ who: { belt, core, back, side, skirt, collar, pauldron, bracer,
//   band, sleeve } }, taken over DESIGN by leatherchest.mjs designOf) and returns it.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, posed } from './lowrig.mjs';
import { DESIGN, bodySamples, trunkCharts, pauldronFrame, collarFrame, sectioner } from './garments/leatherchest.mjs';
import { VIEWS, PIECES, DIR, loadCams, reviewVerts, reviewPose, poseOf, bodyMap, proj, pw, sheetLabels, canvas, fillTri } from './lowleatherchestview.mjs';
import { sub, cross, unit, dot, add, mul } from './lowgarment.mjs';

const IDX = Object.fromEntries(PIECES.map((n, i) => [n, i + 1]));
const ARMP = new Set(PIECES.map((n, i) => (/^(pauldron|plame|sleeve|bracer|band)/.test(n) ? i + 1 : 0)).filter(Boolean));
const r3 = (x) => +x.toFixed(3);
const range = (a, b, s) => { const o = []; for (let x = a; s > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += s) o.push(+x.toFixed(4)); return o; };
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/**
 * The voter for a body: vote(points, onTrunk) with points [{ at: (view) => [q, n] }] (q mapped as the plate there would be
 * in that view, n its normal) → per point { label: weight }.
 */
function voter(rig, C) {
  const who = rig.who, V = {};
  for (const v of VIEWS) {
    const { PB } = reviewVerts(rig, null, C, v), S = sheetLabels(who, v), Z = canvas(S.W, S.H);
    const P = PB.map((p) => { const q = proj(p, C, v); return [q[0] - S.x0, q[1] - S.y0, q[2]]; });
    for (const t of rig.B.tris) fillTri(Z, P[t.v[0]], P[t.v[1]], P[t.v[2]], [0, 0, 0]);
    const a = (C.views[v].yaw * Math.PI) / 180;
    V[v] = { S, Z, eye: [-Math.sin(a), 0, Math.cos(a)] };
  }
  return (pts, onTrunk = true, tol = 0.12) => pts.map((pt) => {
    const w = {};
    for (const v of VIEWS) {
      const { S, Z, eye } = V[v], [q, n] = pt.at(v), f = dot(n, eye);
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

/** A trunk chart: points at(y, az) on a grid, mapped by the trunk's map (the same in every view). */
function trunkChart(vote, at, ys, azs, map) {
  const P = ys.map((y) => azs.map((a) => at(y, a)));
  const cells = [];
  ys.forEach((y, i) => azs.forEach((a, j) => {
    const p = P[i][j], du = sub(P[i][Math.min(j + 1, azs.length - 1)], P[i][Math.max(j - 1, 0)]), dv = sub(P[Math.max(i - 1, 0)][j], P[Math.min(i + 1, ys.length - 1)][j]);
    let n = unit(cross(dv, du));
    if (dot(n, [p[0], 0, p[2]]) < 0) n = n.map((x) => -x);
    const q = map(p), nn = unit(map.normal(n, p));
    cells.push({ y, az: a, p, at: () => [q, nn] });
  }));
  const W = vote(cells, true);
  cells.forEach((c, i) => { c.k = winner(W[i]); });
  return cells;
}

export async function solve() {
  const FIT = {}, cams = loadCams();
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), C = cams[who], D = structuredClone(DESIGN[who]), S = bodySamples(rig.B);
    const vote = voter(rig, C);
    const tmap = (p) => [p[0] * pw(C.sx, p[1]), p[1], p[2] * pw(C.sz, p[1])];
    tmap.normal = (n, p) => [n[0] / pw(C.sx, p[1]), n[1], n[2] / pw(C.sz, p[1])];
    const { chest, skirtAt } = trunkCharts(D, S);
    const azs = range(-180, 177, 3), Sk = D.skirt;
    const low = who === 'male' ? -6.4 : -5.6;
    const trunk = trunkChart(vote, (y, a) => chest.at(y, a, 0.08), range(-0.4, Sk.top - 0.3, -0.03), azs, tmap);
    const hips = trunkChart(vote, (y, a) => skirtAt(y, a), range(Sk.top + 0.3, low, -0.03), azs, tmap);
    const out = {};
    // per |az| column (both sides folded, within `half` degrees): the heights of a piece's cells
    const colYs = (cells, names, a, half = 4.5) => cells.filter((c) => names.some((n) => c.k === IDX[n]) && Math.abs(Math.abs(c.az) - a) <= half).map((c) => c.y);
    const fill = (vals) => {
      const idx = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
      if (!idx.length) return vals;
      return vals.map((v, i) => { if (v !== null) return v; const a = idx.filter((j) => j < i).pop(), b = idx.find((j) => j > i); return a === undefined ? vals[b] : b === undefined ? vals[a] : vals[a] + ((vals[b] - vals[a]) * (i - a)) / (b - a); });
    };
    // (a robust top and foot: the 90th and 10th percentile of a column's heights, with at least 3 cells)
    const pct = (ys, q) => { if (ys.length < 3) return null; const s = ys.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

    // the belt: its top and foot per column
    {
      const az = range(0, 180, 15), all = [...trunk, ...hips];
      const top = fill(az.map((a) => pct(colYs(all, ['belt'], a, 7.5), 0.92))), bottom = fill(az.map((a) => pct(colYs(all, ['belt'], a, 7.5), 0.06)));
      // (each the median of itself and its neighbours: a column's few cells are noisy)
      const sm3 = (a) => a.map((x, i) => median([a[Math.max(0, i - 1)], x, a[Math.min(a.length - 1, i + 1)]]));
      out.belt = { az, top: sm3(top).map(r3), bottom: sm3(bottom).map(r3) };
    }
    // the chest core: where it stops round the side (the last column with its cells below the armpit), its foot over the
    // belt's top; the back core likewise from the back
    {
      const pit = Math.min(...D.core.bottom.slice(D.core.bottom.length - 3));
      // (the chest core's side where the lacing is drawn, the design's: the sheet's side panels are too narrow in its
      // views for the chart to find; the back core's from the chart, the first column from the back with its cells)
      void pit;
      const lastChest = D.core.az[3] + 2;
      const firstBack = Math.max(100, Math.min(...range(90, 180, 3).filter((a) => colYs(trunk, ['back'], a, 1.6).filter((y) => y < pit - 0.2).length >= 3)));
      const bt = (a) => { const T = out.belt; for (let i = 0; i + 1 < T.az.length; i++) if (a <= T.az[i + 1]) return T.top[i] + ((T.top[i + 1] - T.top[i]) * (a - T.az[i])) / (T.az[i + 1] - T.az[i]); return T.top[T.top.length - 1]; };
      const over = 0.14;
      const core = structuredClone(D.core), back = structuredClone(D.back), side = structuredClone(D.side);
      // (the chest core's columns: the design's, its side at the sheet's last column; the foot `over` under the belt's top)
      const A = Math.round(lastChest);
      core.az = [0, Math.round(A / 3), Math.round((2 * A) / 3), A - 3, A, ...D.core.az.filter((a) => a > A + 8)];
      const tabOf = (T, key, a) => { const X = T.az, V = T[key]; if (a <= X[0]) return V[0]; for (let i = 0; i + 1 < X.length; i++) if (a <= X[i + 1]) return V[i] + ((V[i + 1] - V[i]) * (a - X[i])) / (X[i + 1] - X[i]); return V[V.length - 1]; };
      core.top = core.az.map((a) => r3(tabOf(D.core, 'top', a)));
      core.bottom = core.az.map((a) => r3(a <= A - 3 ? bt(a) - over : a === A ? bt(a) - over : tabOf(D.core, 'bottom', Math.max(a, D.core.az[4]))));
      core.bottom[4] = D.core.bottom[4];
      const B0 = Math.round(firstBack);
      back.az = [...D.back.az.filter((a) => a < B0 - 6), B0, B0 + 3, ...[150, 165, 180].filter((a) => a > B0 + 6)];
      back.top = back.az.map((a) => r3(tabOf(D.back, 'top', a)));
      back.bottom = back.az.map((a) => r3(a >= B0 + 3 ? bt(a) - over : tabOf(D.back, 'bottom', Math.min(a, D.back.az[1]))));
      side.az = [A - 4, ...side.az.filter((a) => a > A + 6 && a < B0 - 6), B0 + 4];
      side.top = side.az.map(() => D.side.top[0]);
      side.bottom = side.az.map((a) => r3(bt(a) - over));
      out.core = core; out.back = back; out.side = side;
      out.lacing = D.lacing.map((L) => ({ ...L, az: Math.sign(L.az) * A, y: [L.y[0], r3(bt(A) - 0.05)] }));
    }
    // the skirt: each plate's sides (both sides folded onto the left) and its foot at its columns
    {
      const plates = D.skirt.plates.map((p) => structuredClone(p));
      for (const [name, names] of [['skirt.f', ['skirt.f']], ['skirt.b', ['skirt.b']], ['skirtU', ['skirtU.l', 'skirtU.r']], ['skirtL', ['skirtL.l', 'skirtL.r']]]) {
        const cells = hips.filter((c) => names.some((n) => c.k === IDX[n]));
        if (cells.length < 6) continue;
        const A = cells.map((c) => (name === 'skirt.b' ? 180 - Math.abs(c.az) : Math.abs(c.az)));
        // (the foot per 6 degrees of its span; the span by its 3rd and 97th percentile)
        const s = A.slice().sort((x, y) => x - y), lo = s[Math.floor(s.length * 0.03)], hi = s[Math.floor(s.length * 0.97)];
        const footAt = (a) => { const ys = cells.filter((c, i) => Math.abs(A[i] - a) <= 4.5).map((c) => c.y); return ys.length >= 2 ? Math.min(...ys) : null; };
        const topAt = (a) => { const ys = cells.filter((c, i) => Math.abs(A[i] - a) <= 4.5).map((c) => c.y); return ys.length >= 2 ? Math.max(...ys) : null; };
        const mine = plates.filter((p) => p.name === name);
        if (name === 'skirt.f' || name === 'skirt.b') {
          const half = Math.min(22, Math.max(12, hi)), c0 = name === 'skirt.f' ? 0 : 180, f = fill([footAt(half * 0.9), footAt(0)]);
          mine[0].az = [c0 - half, c0, c0 + half].map(r3); mine[0].bottom = [f[0], f[1], f[0]].map(r3);
        } else {
          // (three plates round the span, overlapping by 4 degrees; each one's foot at its columns)
          const w = (hi - lo) / 3;
          mine.forEach((p, i) => {
            const a0 = lo + i * w - (i ? 2 : 0), a1 = lo + (i + 1) * w + (i < 2 ? 2 : 0);
            p.az = [a0, (a0 + a1) / 2, a1].map(r3);
            p.bottom = fill(p.az.map((a) => footAt(a))).map((y) => r3(y ?? p.bottom[0]));
            if (name === 'skirtL') { const t = fill(p.az.map((a) => topAt(a))); p.top = r3(Math.max(...t.filter((x) => x !== null)) ); }
          });
        }
      }
      out.skirt = { plates };
    }
    // the collar: its top, the highest row of the sheet's collar in the front (its edges either side of the throat's
    // notch, az 30), side (90) and back (180) views, as a height on the body (the camera's row)
    {
      const topRow = (v) => { const S0 = sheetLabels(who, v); for (let y = 0; y < S0.H; y++) { let n = 0; for (let x = 0; x < S0.W; x++) if (S0.L[y * S0.W + x] === IDX.collar) n++; if (n >= 3) return S0.y0 + y + 0.5; } return null; };
      const yOf = (v) => r3((C.cy - topRow(v)) / C.s);
      // (a view without the collar in its mask: the mean of the others)
      const yOf2 = (v) => (topRow(v) === null ? null : yOf(v));
      const f0 = yOf2('front'), b0 = yOf2('back'), s0 = yOf2('side') ?? r3((f0 + b0) / 2);
      out.collar = { top: { az: [0, 30, 90, 180], top: [r3(f0 - 0.12), f0, s0, b0] } };
    }
    // the arm: along the upper arm and the forearm, each arm piece's span (the median over the round of its first and
    // last t), in the views that see that side; the pauldron's dome as the visual hull of its side's arm pieces
    {
      const { J } = rig, FWD = [0, 0, 1];
      const frameOf = (o, tail) => { const a = unit(sub(tail, o)), e1 = unit(sub(FWD, mul(a, dot(FWD, a)))), e2 = cross(e1, a); return { o, a, e1, e2: dot(e2, [1, 0, 0]) >= 0 ? e2 : mul(e2, -1), len: Math.hypot(...sub(tail, o)) }; };
      const armS = S.filter((s) => (s.part === 'arm' || s.part === 'joint') && s.p[0] > 0).map((s) => s.p);
      const up = frameOf(J.shoulder, J.elbow), fo = frameOf(J.elbow, J.wrist);
      const upper = sectioner(armS, { ...up, dt: 0.12 }), fore = sectioner(armS, { ...fo, dt: 0.12 });
      // (a point on the left arm on side s, posed as `bone` in view v and mapped)
      const F = Object.fromEntries(VIEWS.map((v) => { const f = posed(rig, reviewPose(rig, poseOf(C, v))); return [v, { f, map: bodyMap(rig, C, f, v) }]; }));
      const at = (p, n, bone, s) => (v) => {
        const q = s === 'l' ? p : [-p[0], p[1], p[2]], m = s === 'l' ? n : [-n[0], n[1], n[2]], bi = rig.at.get(`${bone}_${s}`), b = rig.bones[bi], F0 = F[v].f[bi];
        const T = (x) => [F0.S[0] * x[0] + F0.S[1] * x[1] + F0.S[2] * x[2], F0.S[3] * x[0] + F0.S[4] * x[1] + F0.S[5] * x[2], F0.S[6] * x[0] + F0.S[7] * x[1] + F0.S[8] * x[2]];
        const r = add(T(sub(q, b.head)), F0.P);
        return [F[v].map(r, [[bi, 1]]), unit(T(m))];
      };
      const span = (sec, fr, bone, ts, c, names) => {
        const firsts = [], lasts = [];
        for (const s of ['l', 'r']) for (let th = 0; th < 360; th += 20) {
          const pts = ts.map((t) => { const p = sec.at(t, th, c), d = sub(p, fr.o), n = unit(sub(d, mul(fr.a, dot(d, fr.a)))); return { t, at: at(p, n, bone, s) }; });
          const W = vote(pts, false), k = W.map(winner), own = (j) => names.some((nm) => k[j] === IDX[`${nm}.${s}`]);
          const hit = ts.filter((_, j) => own(j));
          if (hit.length >= 2) { firsts.push(Math.min(...hit)); lasts.push(Math.max(...hit)); }
        }
        return { t0: median(firsts), t1: median(lasts), n: firsts.length };
      };
      const tsF = range(-0.1, fo.len + 0.15, 0.03), tsU = range(0, up.len, 0.03);
      const br = span(fore, fo, 'lowerarm', tsF, D.bracer.c[1] + 0.02, ['bracer']);
      const bd = span(fore, fo, 'lowerarm', tsF, D.band.c[0] + 0.03, ['band']);
      const sl = span(upper, up, 'upperarm', tsU.concat(range(up.len + 0.03, up.len + 0.4, 0.03)), 0.06, ['sleeve']);
      const l1 = span(upper, up, 'upperarm', tsU, D.pauldron.lames[0].c[0], ['plame1']), l2 = span(upper, up, 'upperarm', tsU, D.pauldron.lames[1].c[0], ['plame2']);
      out.arm = { bracer: br, band: bd, sleeve: sl, plame1: l1, plame2: l2, foreLen: r3(fo.len), upLen: r3(up.len) };
      // (into the design: the bracer from its top to the band's; the lames' spans as fractions of the upper arm, his read
      // off the sheet and hers where hers are found (her lames' masks are thin), else his fractions)
      out.bracer = { t: [r3(br.t0), r3(Math.max(br.t1, fo.len - 0.14))] };
      const okL = (L) => L.n >= 12 && L.t0 >= 0 && L.t1 > L.t0 + 0.25;
      out.lameFrac = okL(l1) && okL(l2) ? [[l1.t0 / up.len, l1.t1 / up.len], [l2.t0 / up.len, l2.t1 / up.len]].map((p) => p.map(r3)) : null;
      // the pauldron's dome: per column ψ its radius from the centre down to its foot, the visual hull of its side's arm
      // pieces in the views that show that side's shoulder whole
      const Pd = D.pauldron, { centre, dirAt, reach, outSign } = pauldronFrame(rig, D, S);
      const views = { l: ['front', 'side', 'r3', 'back'], r: ['front', 'q3', 'back'] };
      const Sv = Object.fromEntries(VIEWS.map((v) => [v, sheetLabels(who, v)]));
      const own = (s) => new Set(['pauldron', 'plame1', 'plame2', 'sleeve'].map((n) => IDX[`${n}.${s}`]));
      const inside = (p, s) => views[s].every((v) => { const [q] = at(p, [0, 1, 0], 'shoulder', s)(v), pp = proj(q, C, v), S0 = Sv[v], x = Math.floor(pp[0] - S0.x0), y = Math.floor(pp[1] - S0.y0); return x >= 0 && y >= 0 && x < S0.W && y < S0.H && own(s).has(S0.L[y * S0.W + x]); });
      const psi = range(0, 330, 30), phis = range(0, 120, 4), R = { l: [], r: [] }, foot = { l: [], r: [] };
      for (const s of ['l', 'r']) for (const ps of psi) {
        const col = [];
        for (const ph of phis) {
          const d = dirAt(ps * outSign, ph), r0 = reach(d) + D.fit.arm + 0.02;
          let r = r0;
          while (r < r0 + 1.6 && inside(add(centre, mul(d, r + 0.02)), s)) r += 0.02;
          col.push(r);
        }
        R[s].push(col);
        const pts = phis.map((ph, i) => { const d = dirAt(ps * outSign, ph); return { at: at(add(centre, mul(d, col[i])), d, 'shoulder', s) }; });
        const W = vote(pts, false), k = W.map(winner);
        let last = Pd.phi0;
        phis.forEach((ph, i) => { if (ph >= Pd.phi0 && k[i] === IDX[`pauldron.${s}`]) last = ph; });
        foot[s].push(last);
      }
      const sm = (a) => a.map((x, k) => (a[(k + a.length - 1) % a.length] + 2 * x + a[(k + 1) % a.length]) / 4);
      const phiS = sm(psi.map((_, k) => (foot.l[k] + foot.r[k]) / 2)).map(r3);
      const fRows = [0, 0.25, 0.5, 0.75, 1];
      const rAt = (s, k, ph) => { const i = Math.min(phis.length - 2, Math.floor(ph / 4)), t = (ph - phis[i]) / 4; return R[s][k][i] * (1 - t) + R[s][k][i + 1] * t; };
      const rr = fRows.map((fr) => sm(psi.map((_, k) => { const ph = Pd.phi0 + (phiS[k] - Pd.phi0) * fr; return Math.min(rAt('l', k, ph), rAt('r', k, ph)); })).map(r3));
      // (the dome read this way is noisy at this sheet's scale, its foot's φ jumping 30 degrees between columns: kept as
      // a record, `hullRead`, and the design's parametric dome used, its size checked against the silhouettes)
      out.pauldronHull = { psi, f: fRows, phi: phiS, r: rr };
      out.pauldron = {};
    }
    if (!out.lameFrac && FIT.male?.lameFrac) out.lameFrac = FIT.male.lameFrac;
    if (out.lameFrac) out.pauldron.lames = D.pauldron.lames.map((L, i) => ({ ...L, t: out.lameFrac[i].map((x) => r3(x * out.arm.upLen)) }));
    FIT[who] = out;
    console.log(who, JSON.stringify({ belt: out.belt, collar: out.collar, arm: out.arm, pauldronPhi: out.pauldronHull.phi }));
    console.log('  core', JSON.stringify(out.core.az), JSON.stringify(out.core.bottom), 'back', JSON.stringify(out.back.az), JSON.stringify(out.back.bottom));
    console.log('  skirt', JSON.stringify(out.skirt.plates.map((p) => [p.name, p.az, p.bottom, p.top])));
  }
  writeFileSync(join(DIR, 'leather/chest-fit.json'), JSON.stringify(FIT, null, 1));
  return FIT;
}
if (import.meta.url === `file://${process.argv[1]}`) await solve();
