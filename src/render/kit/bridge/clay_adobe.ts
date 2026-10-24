import { rand } from '../../ivy';
import { proj, RUNE_GOLD, RUNE_WHITE } from '../../runestone';
import { css, faceColour, hex, mix, type Tone } from '../core';
import { bayAt, BUILDERS, byRole, refugeGaps, runeLine, samples, turned, U, type BridgePainter, type Kit, type L, type Part3 } from './core';
import { plasterPaint, stoneBase } from './base';
import { arcade, cface, fi, fixKit, lampPost, roundOut, runsOf, tilePaint, wallFrame, wide , ownerOf, runeKey, seen } from './clay';

/**
 * Clay adobe: the coat of the island's adobe houses (`ADOBE` in
 * `masonry.ts`), a golden sand plaster laid by hand, the mud brick showing
 * where a patch has come away; its timber the houses' too, a row of beam ends
 * (vigas) carrying the deck. Round buttresses at the piers, battered out to
 * their feet and domed; soft plastered arches with no line round them, a
 * round glazed plaque at each crown; a low parapet rounded over its top,
 * rising over each pier; at two lanes a round refuge on each buttress; the
 * deck in the houses' terracotta tiles.
 */

const COAT: Tone = { lit: hex('#e4cdab'), shade: hex('#a99282') };
const PALE: Tone = { lit: hex('#eedfc4'), shade: hex('#b6a394') };
const TILE: Tone = { lit: hex('#e5a585'), shade: hex('#b27e70') };
/** A glazed tile set over each crown, the pale blue of the houses' glass. */
const GLAZE: Tone = { lit: hex('#b3dcd8'), shade: hex('#6f9099') };
const VIGA: Tone = { lit: hex('#ab8a6c'), shade: hex('#6a5650') };

/** The coat: soft patches where it was made good, and now and then a spall with the mud brick under it. */
const coatPaint: BridgePainter = (g, k, f, st) => {
  plasterPaint(g, k, f, st);
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1), y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  if (x1 - x0 < 7 || y1 - y0 < 7) return;
  const T = rand(f.seed * 31 + Math.round(x0) * 7 + 3);
  if (T() > 0.22) return;
  const cx = x0 + 3.5 + T() * (x1 - x0 - 7), cy = y0 + 3 + T() * Math.min(12, y1 - y0 - 6);
  const rx = 2.2 + T() * 1.6, ry = 1.4 + T() * 0.8;
  g.save();
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 0.75 + T() * 0.35;
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = css(mix(k.fill, hex('#a2846a'), 0.45));
  g.fill();
  g.strokeStyle = css(mix(k.fill, hex('#8a6851'), 0.55), 0.8);
  g.lineWidth = 0.3;
  g.stroke();
  g.clip();
  // The mud brick in it, barely a step under the coat.
  g.strokeStyle = css(mix(k.fill, hex('#8a6851'), 0.35), 0.6);
  g.lineWidth = 0.25;
  g.beginPath();
  for (let y = Math.floor((cy - ry) / 2.6) * 2.6; y < cy + ry; y += 2.6) {
    g.moveTo(cx - rx, y); g.lineTo(cx + rx, y);
    const off = (Math.round(y / 2.6) & 1) * 3.2;
    for (let x = Math.floor((cx - rx - off) / 6.4) * 6.4 + off; x < cx + rx; x += 6.4) { g.moveTo(x, y); g.lineTo(x, y + 2.6); }
  }
  g.stroke();
  g.restore();
};

/** A viga's sawn end: paler end grain, a ring or two, the darker rim. */
const vigaEnd: BridgePainter = (g, k, f) => {
  const r = (f.x1 - f.x0) / 2;
  g.fillStyle = css(mix(k.fill, hex('#d6b88f'), 0.45));
  g.beginPath(); g.arc(0, 0, r * 0.72, 0, Math.PI * 2); g.fill();
  g.strokeStyle = css(mix(k.fill, hex('#6e5444'), 0.4), 0.7);
  g.lineWidth = 0.18;
  g.beginPath(); g.arc(0.1, 0.1, r * 0.4, 0, Math.PI * 2); g.stroke();
};

const T_WALL = 0.11;
const H_WALL = 5.2;
/** The parapet's top over the deck at `s`: rising a little toward each pier, round over. */
const wave = (k: Kit, s: number): number => {
  const b = bayAt(k.plan, Math.min(k.plan.n - 1e-4, Math.max(1e-4, s)));
  const u = (s - b.s0) / (b.s1 - b.s0);
  return 1.8 * (2 * u - 1) ** 2;
};

/** The deck: the core's, and a row of viga ends under its edge, a third of a tile apart. */
function deck(k0: Kit): void {
  const k = fixKit(k0);
  BUILDERS.deck(k);
  const { plan, sl } = k;
  const gaps = refugeGaps(plan);
  const r = 1.45, rs = r / U, out = 0.065, n = 8;
  for (const edge of sl.edges) {
    if (!seen(k, edge)) continue;
    const t = edge > 0 ? sl.t1 : sl.t0;
    for (let j = Math.floor(sl.s0 * 3); j / 3 < sl.s1; j++) {
      const s = (j + 0.5) / 3;
      if (s < 0.2 || s > plan.n - 0.2) continue;
      if (gaps.some(([a, b]) => s > a - 0.06 && s < b + 0.06)) continue;
      if (plan.bays.some((b) => Math.abs(b.c - s) < 0.14)) continue;
      if (ownerOf(k, s - rs, s + rs) === null) continue;
      const z = plan.deck(s) - plan.thick - 1.4 - 1.75;
      const te = t + edge * out;
      const ring = (tt: number): L[] => Array.from({ length: n }, (_, i) => [s + Math.cos((i / n) * Math.PI * 2) * rs, tt, z + Math.sin((i / n) * Math.PI * 2) * r] as L);
      const a = ring(t), b = ring(te);
      k.solid('front', k.ord(edge, 1.2));
      k.face('front', b, [0, edge, 0], VIGA, fi('beam', -r, r, -r, r, j), { o: [s, te, z], a: [1 / U, 0, 0], b: [0, 0, 1] });
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n, th = ((i + 0.5) / n) * Math.PI * 2;
        const q: L[] = [a[i], a[i2], b[i2], b[i]];
        k.face('front', q, [Math.cos(th), 0, Math.sin(th) / U], VIGA);
      }
    }
  }
}

/** A run of the low parapet: a wall rounded over its top, its outer face's top band carrying the rune line. */
function parapet(k0: Kit, edge: number, part: Part3): void {
  const k = fixKit(k0);
  const { plan, sl, st } = k;
  const T = T_WALL, rz = (T * U) / 2;
  const tOut = edge > 0 ? sl.t1 : sl.t0, tIn = tOut - edge * T, tc = (tOut + tIn) / 2;
  const deckZ = plan.deck;
  const zTop = (s: number): number => deckZ(s) + H_WALL + wave(k, s);
  const Q = 4;
  const bull = (s: number, q: number): L => { const p = (q / Q) * Math.PI; return [s, tc + edge * (T / 2) * Math.cos(p), zTop(s) + rz * Math.sin(p)]; };
  for (const [sa, sb] of runsOf(plan, sl.s0, sl.s1)) {
    const xs = samples(sa, sb, plan.piers.map((p) => p.s), 1 / 6);
    const band = 1.3;
    // Each face of it one polygon the length of the run: the outer face, the band at its top the rune line is cut in, the inner face, the round over.
    const strip = (lo: (s: number) => L, hi: (s: number) => L): L[] => [...xs.map(lo), ...xs.slice().reverse().map(hi)];
    const zs = (f: (s: number) => number): number[] => xs.map(f);
    k.solid(part, 1);
    k.face(part, strip((s) => [s, tOut, deckZ(s)], (s) => [s, tOut, zTop(s)]), [0, edge, 0], st.stone,
      fi('parapet', sa * U, sb * U, Math.min(...zs(deckZ)), Math.max(...zs(zTop)), sl.i * 3 + 1), wallFrame(tOut, edge));
    k.face(part, strip((s) => [s, tIn, deckZ(s)], (s) => [s, tIn, zTop(s)]), [0, -edge, 0], st.stone,
      fi('parapet', sa * U, sb * U, Math.min(...zs(deckZ)), Math.max(...zs(zTop)), sl.i * 3), wallFrame(tIn, -edge));
    for (let q = 0; q < Q; q++) {
      const pm = ((q + 0.5) / Q) * Math.PI;
      k.face(part, strip((s) => bull(s, q), (s) => bull(s, q + 1)), [0, edge * Math.cos(pm), Math.sin(pm) / U], st.trim);
    }
    // The rune line along its outer face under the round: a groove, gold laid in it; it glows at night.
    const line = xs.map((s): L => [s, tOut + edge * 0.004, zTop(s) - band]);
    k.loose(part, (g, e) => {
      const P = line.map((p) => proj(e, k.m(p)));
      g.beginPath();
      P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineCap = 'round';
      g.strokeStyle = css(mix(faceColour(st.stone, 0.8), hex('#5a4e5e'), 0.35), 0.8);
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = css(mix(hex(RUNE_GOLD), hex(RUNE_WHITE), 0.3), 0.85);
      g.lineWidth = 0.45;
      g.stroke();
    }, [line[0], line[line.length - 1]], 1.5);
    for (let j = 0; j + 1 < xs.length; j++) k.glow.lines.push([k.m(line[j]), k.m(line[j + 1])]);
    // Its ends where a refuge breaks it, rounded over as the top is.
    for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
      if ((dirn < 0 && sa <= sl.s0 + 1e-6) || (dirn > 0 && sb >= sl.s1 - 1e-6)) continue;
      const pts: L[] = [[s, tIn, deckZ(s)], [s, tOut, deckZ(s)]];
      for (let q = 0; q <= Q; q++) pts.push(bull(s, q));
      k.face(part, pts, [dirn, 0, 0], st.stone);
    }
  }
}

/** At each end of each outer edge, a round post of the coat, swelling at its foot and domed, a terracotta knob on it. */
function ends(k0: Kit): void {
  const k = fixKit(k0);
  const { plan, sl, st } = k;
  const post = (part: Part3, s: number, t: number, z: number): void => {
    if (ownerOf(k, s - 0.09, s + 0.09) === null) return;
    turned(k, part, s, t, z, [[0, 0.09], [1.2, 0.08], [8.6, 0.07], [9.6, 0.078], [10.6, 0.074], [11.8, 0.056], [12.6, 0.03], [12.9, 0]], 10, st.stone, 3);
    turned(k, part, s, t, z + 12.6, [[0, 0.02], [0.9, 0.03], [1.9, 0.026], [2.6, 0.008], [2.8, 0]], 8, TILE, 3.3);
  };
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 - 0.09 : sl.t0 + 0.09;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    if (sl.i === 0) post(part, 0.09, t, plan.deck(0.09));
    if (sl.i === plan.n - 1) post(part, plan.n - 0.09, t, plan.deck(plan.n - 0.09));
  }
}

/**
 * Over each pier of a bridge two lanes wide, a round refuge on its buttress:
 * a half-round of deck carried out over it, its edge the cornice's, a low
 * round wall about it with a round post where it meets the parapet; at three
 * lanes a lamp in it.
 */
function refuges(k0: Kit): void {
  const k = fixKit(k0);
  const { plan, sl, st } = k;
  const n = 12, T = T_WALL, rz = (T * U) / 2;
  for (const p of plan.piers) {
    if (p.end) continue;
    const R = roundOut(p);
    if (p.s + R < sl.s0 - 1e-6 || p.s - R > sl.s1 + 1e-6) continue;
    const z = plan.deck(p.s);
    const zb = z - plan.thick - 1.4;
    const zt = z + H_WALL + 1.8;
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const at = (phi: number, r: number, zz: number): L => [p.s + r * Math.sin(phi), t + edge * r * Math.cos(phi), zz];
      const phis = Array.from({ length: n + 1 }, (_, i) => -Math.PI / 2 + (Math.PI * i) / n);
      // The floor and its edge.
      k.solid('front', k.ord(edge, 0.9));
      cface(k, 'front', phis.map((f) => at(f, R, z)), [0, 0, 1], st.deck, fi('deck', 0, 1, 0, 1, Math.round(p.s * 10)), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
      for (let i = 0; i < n; i++) {
        const fm = (phis[i] + phis[i + 1]) / 2;
        const rim: L[] = [at(phis[i], R, zb), at(phis[i + 1], R, zb), at(phis[i + 1], R, z), at(phis[i], R, z)];
        cface(k, 'front', rim, [Math.sin(fm), edge * Math.cos(fm), 0], st.trim);
      }
      // The wall round it, rounded over.
      k.solid(part, 2);
      const Q = 4;
      const bull = (f: number, q: number): L => { const a = (q / Q) * Math.PI; return at(f, R - T / 2 + (T / 2) * Math.cos(a), zt + rz * Math.sin(a)); };
      for (let i = 0; i < n; i++) {
        const f0 = phis[i], f1 = phis[i + 1], fm = (f0 + f1) / 2;
        const ov: L = [Math.sin(fm), edge * Math.cos(fm), 0];
        const wo: L[] = [at(f0, R, z), at(f1, R, z), at(f1, R, zt), at(f0, R, zt)], wi: L[] = [at(f0, R - T, z), at(f1, R - T, z), at(f1, R - T, zt), at(f0, R - T, zt)];
        cface(k, part, wo, ov, st.stone, fi('parapet', 0, 1, z, zt, i));
        cface(k, part, wi, [-ov[0], -ov[1], 0], st.stone);
        for (let q = 0; q < Q; q++) {
          const pm = ((q + 0.5) / Q) * Math.PI;
          const bq: L[] = [bull(f0, q), bull(f1, q), bull(f1, q + 1), bull(f0, q + 1)];
          cface(k, part, bq, [ov[0] * Math.cos(pm), ov[1] * Math.cos(pm), Math.sin(pm) / U], st.trim);
        }
        if (ownerOf(k, Math.min(at(f0, R, 0)[0], at(f1, R, 0)[0]), Math.max(at(f0, R, 0)[0], at(f1, R, 0)[0])) !== null) {
          k.glow.lines.push([k.m(at(f0, R + 0.004, zt - 0.6)), k.m(at(f1, R + 0.004, zt - 0.6))]);
        }
      }
      // A round post where it meets the parapet on either hand.
      for (const side of [-1, 1]) {
        const s = p.s + side * (R - T / 2), tp = t - edge * (T / 2);
        if (ownerOf(k, s - T * 0.6, s + T * 0.6) === null) continue;
        turned(k, part, s, tp, z, [[0, T * 0.62], [zt - z + 0.4, T * 0.6], [zt - z + 1.6, T * 0.5], [zt - z + 2.8, T * 0.22], [zt - z + 3.1, 0]], 10, st.stone, 2.4);
      }
      if (plan.width >= 3 && ownerOf(k, p.s - 0.05, p.s + 0.05) !== null) {
        const tl = t + edge * R * 0.45;
        lampPost(wide(k, tl - 0.05, tl + 0.05), part, p.s, tl, z, PALE);
      }
    }
  }
}

/** Clay adobe: rounded plastered piers, soft plastered arches, a low curved parapet. */
export const clay_adobe = stoneBase('clay_adobe', {
  stone: COAT,
  ring: PALE,
  trim: PALE,
  deck: TILE,
  parapet: 'curved',
  // The crown set lower than the band is deep, for the viga ends over it.
  ringDepth: 7,
  rune: 'sowilo',
  paint: byRole({
    wall: coatPaint, pier: coatPaint, parapet: coatPaint,
    key: runeKey('sowilo', 0.56, true),
    cap: runeLine('sowilo'),
    beam: vigaEnd,
    deck: tilePaint(6.6, '#dccab3'),
    tread: tilePaint(40 / 3, '#cdb89c', PALE),
  }),
  build: {
    arches: arcade({ ringD: 2.8, proud: 0.01, ring: 'soft', key: 'plaque', keyTone: () => GLAZE, pier: 'round' }),
    deck,
    parapet,
    ends,
    refuges,
  },
});
