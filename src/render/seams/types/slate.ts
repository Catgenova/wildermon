import { channel, css, footShadow, hex, mix, palOf, periodic, poly, ribbon, seeded, wrap, CREAM, INK } from '../kit';
import type { Ctx, SeamLook, Stud } from '../types';

/**
 * Slate: a bed of it split along its cleavage into thin courses lying flat
 * along the band, each course broken into plates at a slant, a cool
 * blue-grey with the odd plate gone violet or sea-green. Here and there a
 * plate has lifted proud of the bed, its edge in shade under it, and here and
 * there riven slates already lie stacked on the face, ready to carry off.
 */
const L = 4;
const PAL = palOf('#7383a8', { lit: 0.45, dark: 0.3 });
/** The tones a plate may be, most of them the blue-grey. */
const TONES = [
  hex('#7383a8'),
  hex('#7d8db0'),
  hex('#6b7a9f'),
  hex('#8696b8'),
  hex('#7f7cab'),
  hex('#72909f'),
].map((c) => palOf(c, { lit: 0.42, dark: 0.22 }));
const PICK = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 5];
const GAP = mix(PAL.rim, INK, 0.35);
const SHEEN = mix(hex('#dfe8fb'), CREAM, 0.4);
/** How many courses the bed is split into, across the band. */
const COURSES = 3;

/** A plate's outline from its left end, `len` long, between `y0` and `y1`, its ends cut on a slant of `cut`. */
function plate(x: number, len: number, y0: number, y1: number, cut: number): number[] {
  const s = (y1 - y0) * cut;
  return [x + s, y0, x + len + s, y0, x + len, y1, x, y1];
}

/** A stack of riven slates for a stud, its foot at (0, 0): plates seen from above and a little in front. */
function stack(g: Ctx, R: () => number, n: number): void {
  footShadow(g, 0.01, 0.005, 0.15, 0.32);
  const t = 0.016;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const pal = TONES[PICK[Math.floor(R() * PICK.length)]];
    const w = 0.24 - i * 0.012 + (R() - 0.5) * 0.03;
    const d = 0.075;
    const dx = (R() - 0.5) * 0.05;
    const sk = 0.035 + (R() - 0.5) * 0.02;
    // The plate's top face: a parallelogram, back edge up and to the right.
    const x0 = -w / 2 + dx;
    const top = [x0, y - t, x0 + w, y - t, x0 + w + sk, y - t - d, x0 + sk, y - t - d];
    // Its front edge and its right end, in shade.
    const front = [x0, y, x0 + w, y, x0 + w, y - t, x0, y - t];
    const side = [x0 + w, y, x0 + w + sk, y - d, x0 + w + sk, y - t - d, x0 + w, y - t];
    g.lineWidth = 0.014;
    g.strokeStyle = css(pal.rim);
    g.beginPath();
    poly(g, [x0, y, x0 + w, y, x0 + w + sk, y - d, x0 + w + sk, y - t - d, x0 + sk, y - t - d, x0, y - t]);
    g.stroke();
    g.fillStyle = css(pal.dark);
    g.beginPath();
    poly(g, front);
    g.fill();
    g.fillStyle = css(mix(pal.dark, INK, 0.25));
    g.beginPath();
    poly(g, side);
    g.fill();
    g.fillStyle = css(pal.body);
    g.beginPath();
    poly(g, top);
    g.fill();
    // The light on the riven face, toward its back, and its front arris.
    g.fillStyle = css(pal.lit, 0.9);
    g.beginPath();
    poly(g, [x0 + sk * 0.5, y - t - d * 0.5, x0 + w * 0.7 + sk * 0.5, y - t - d * 0.5, x0 + w * 0.7 + sk, y - t - d, x0 + sk, y - t - d]);
    g.fill();
    g.strokeStyle = css(SHEEN, 0.9);
    g.lineWidth = 0.009;
    g.beginPath();
    g.moveTo(x0 + 0.01, y - t);
    g.lineTo(x0 + w - 0.01, y - t);
    g.stroke();
    y -= t + 0.003;
  }
}

export const slate: SeamLook = {
  name: 'Slate',
  wash: hex('#8a97b0'),
  pitch: 1.6,
  drift: 0.3,
  half: 0.27,
  length: L,
  variants: 3,
  strip(g, _v, px, R) {
    // Slate lies flat: the band barely wanders and keeps its width.
    const mid = periodic(R, L, 0.035, [[1, 0.7], [2, 0.3]]);
    const wob = periodic(R, L, 0.012, [[2, 0.6], [5, 0.4]]);
    const w = (t: number): number => 0.155 + wob(t);
    const body = ribbon(L, mid, w);
    const line = Math.max(1.2 / px, 0.012);
    channel(g, body, 0.03, 0.34);
    g.fillStyle = css(GAP);
    g.fill(body);
    g.save();
    g.clip(body);
    // Where the courses part, from the top of the bed to the bottom: each a
    // little wavy, so the cleavage is a plane and not a ruled line.
    const parts = Array.from({ length: COURSES + 1 }, (_, i) => {
      const f = -1 + (2 * i) / COURSES;
      const wv = periodic(R, L, i && i < COURSES ? 0.006 : 0, [[3, 0.6], [7, 0.4]]);
      return (t: number): number => mid(t) + f * w(t) * 1.12 + wv(t);
    });
    for (let c = 0; c < COURSES; c++) {
      // The plates of this course, staggered against the course above.
      const start = R() * 0.3;
      // Every plate's end is broken on the same slant: the cleavage's.
      const cut = 1.1 + R() * 0.3;
      let t = start;
      while (t < start + L - 0.05) {
        let len = 0.6 + R() * 0.5;
        if (t + len > start + L - 0.15) len = start + L - t;
        const tone = TONES[PICK[Math.floor(R() * PICK.length)]];
        const hi = R() < 0.35;
        const at = t;
        wrap(L, at + len / 2, len / 2 + 0.1, (cx) => {
          const x = cx - len / 2;
          const xm = cx;
          const y0 = parts[c](xm) + line * 0.55, y1 = parts[c + 1](xm) - line * 0.55;
          const pts = plate(x, len - line * 0.8, y0, y1, cut);
          g.beginPath();
          poly(g, pts);
          g.fillStyle = css(tone.body);
          g.fill();
          // Its lower half a shade down, its upper edge in the light.
          g.fillStyle = css(tone.dark, 0.4);
          g.beginPath();
          poly(g, plate(x, len - line * 0.8, (y0 + y1) / 2 + line * 0.4, y1, cut));
          g.fill();
          g.strokeStyle = css(hi ? SHEEN : tone.lit, hi ? 0.85 : 0.9);
          g.lineWidth = line * 1.2;
          g.beginPath();
          g.moveTo(pts[0] + line, y0 + line * 0.7);
          g.lineTo(pts[2] - line * 1.5, y0 + line * 0.7);
          g.stroke();
        });
        t = at + len;
      }
    }
    // A faint sheen down the top course, the cleavage faces catching the sky.
    g.strokeStyle = css(SHEEN, 0.16);
    g.lineWidth = 0.05;
    g.beginPath();
    for (let x = -0.3; x <= L + 0.3; x += 0.05) g.lineTo(x, mid(x) - w(x) * 0.6);
    g.stroke();
    g.restore();

    // Plates lifted proud of the bed: a shadow cast down the band, the
    // plate's thickness in shade, and its riven face in the light.
    const lifts = 2;
    for (let i = 0; i < lifts; i++) {
      const t = ((i + 0.3 + R() * 0.4) / lifts) * L;
      const len = 0.3 + R() * 0.16;
      const dy = (R() - 0.5) * 0.08;
      const th = 0.05 + R() * 0.025;
      const cut = 1.1 + R() * 0.3;
      const tone = TONES[PICK[Math.floor(R() * PICK.length)]];
      wrap(L, t, len / 2 + 0.12, (cx) => {
        const x = cx - len / 2;
        const m = mid(cx) + dy;
        const y0 = m - th, y1 = m + th;
        const lift = 0.028;
        // The shadow it casts.
        g.fillStyle = css(INK, 0.3);
        g.beginPath();
        poly(g, plate(x + 0.02, len, y0 + lift * 1.6, y1 + lift * 1.6, cut));
        g.fill();
        // Its edge, the thickness of it, under the face.
        const face = plate(x, len, y0 - lift, y1 - lift, cut);
        g.fillStyle = css(mix(tone.dark, INK, 0.2));
        g.beginPath();
        poly(g, [face[6], face[7], face[4], face[5], face[4], face[5] + lift, face[6], face[7] + lift]);
        g.fill();
        g.beginPath();
        poly(g, face);
        g.fillStyle = css(tone.body);
        g.fill();
        g.fillStyle = css(tone.lit, 0.8);
        g.beginPath();
        poly(g, plate(x + (face[0] - x) * 0.4, len * 0.75, y0 - lift, m - lift - th * 0.2, cut));
        g.fill();
        g.strokeStyle = css(tone.rim);
        g.lineWidth = line;
        g.beginPath();
        poly(g, [face[0], face[1], face[2], face[3], face[4], face[5], face[4], face[5] + lift, face[6], face[7] + lift, face[6], face[7]]);
        g.stroke();
        g.strokeStyle = css(SHEEN, 0.95);
        g.lineWidth = line * 1.2;
        g.beginPath();
        g.moveTo(face[0] + line, face[1] + line * 0.8);
        g.lineTo(face[2] - line * 2, face[3] + line * 0.8);
        g.stroke();
      });
    }

    g.strokeStyle = css(PAL.rim, 0.85);
    g.lineWidth = line;
    g.stroke(body);

    // Stacks of riven slates on the face, between the lifted plates.
    const studs: Stud[] = [];
    for (let i = 0; i < 3; i++) studs.push({ t: ((i + 0.85 + (R() - 0.5) * 0.3) / 3) * L, n: (R() - 0.5) * 0.05, kind: Math.floor(R() * 3) });
    return studs;
  },
  studs: {
    w: 0.42,
    h: 0.38,
    ax: 0.5,
    ay: 0.76,
    kinds: 3,
    from: 0.9,
    draw(g, kind) {
      stack(g, seeded(97 + kind * 31), 3 + kind);
    },
  },
};
