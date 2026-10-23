import {
  band, boards, BRASS, clothTone, css, deeper, extrude, faceColour, grain, hex, inlay, IRON, mix, nail, paler, proj, sheen, slab, turned, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type RGB, type Side, type Tone, type V3,
} from './core';

/**
 * A chest (`chest`, two subtiles by two), in the kit: a boarded box on a
 * moulded plinth under a barrel lid of six staves, bound in the anvils' pale
 * iron -- two straps over the lid and down front and back, angle irons up
 * its corners, a grip on each end -- with a brass hasp at the front, its
 * keyhole under a small gold rune. The wood is what it was built of; dyed,
 * its boards are painted in the dye and the iron is left bare.
 *
 * `trim` 1 is it open: the lid back on its hinges past upright, its inside
 * and the inside of the box seen, a lining on its floor in the dye (linen
 * undyed) and a few gold coins on that. The island does not yet say when a
 * chest is open (`pieceTrim` gives a chest none), so it is drawn shut.
 */

/* ---- where it stands, in units -------------------------------------------------------- */

/** The box: half its length and depth, the plinth's top and the box's rim. */
const X = 6.55, Y = 4.15, PLINTH = 0.85, RIM_Z = 5.15;
/** The lid: half its length and depth (it overhangs the box), how tall its band is, how high its crown rises over that. */
const LX = 6.75, LY = 4.35, BAND = 0.8, CROWN = 1.75;
/** The straps: how far either side of the middle, and how wide. */
const STRAP_X = 3.7, STRAP_W = 0.95;
/** The walls when it is open, and how far the lid is thrown back. */
const WALL = 0.55, OPEN = (105 * Math.PI) / 180;
/** The floor inside it, raised so what lies on it is seen over the front wall. */
const FLOOR = RIM_Z - 2.1;

/* ---- painting ---------------------------------------------------------------------------- */

/** A board face of the box: its boards, the straps down it and the angle irons up its ends. */
function boxSide(seed: number, straps: boolean, mount: boolean) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 3, seed);
    if (straps) for (const x of [s.w / 2 - STRAP_X, s.w / 2 + STRAP_X]) band(g, k, x - STRAP_W / 2, x + STRAP_W / 2, 0, s.h, 3, true);
    band(g, k, -0.1, 0.72, 0, s.h, 3, true);
    band(g, k, s.w - 0.72, s.w + 0.1, 0, s.h, 3, true);
    // Under the grip at each end, the plate it is riveted through.
    if (mount) band(g, k, s.w / 2 - 1.5, s.w / 2 + 1.5, s.h - 1.75, s.h - 0.75, 4, false);
  };
}

/** The inside of the box: the wood a step deeper, the boards still seen. */
function inside(tone: Tone, seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const fill = faceColour(tone, k.L);
    g.fillStyle = css(fill);
    g.fillRect(-0.5, -0.5, s.w + 1, s.h + 1);
    boards(g, fill, s.w, s.h, 3, seed);
    // Darker down in it, where the light does not reach.
    const gr = g.createLinearGradient(0, 0, 0, s.h);
    gr.addColorStop(0, 'rgba(46, 36, 56, 0.35)');
    gr.addColorStop(1, 'rgba(46, 36, 56, 0)');
    g.fillStyle = gr;
    g.fillRect(-0.5, 0, s.w + 1, s.h);
  };
}

/* ---- the model ----------------------------------------------------------------------------- */

/** The lid seen end on, round from its back foot: its foot, the front of its band, its six staves over the crown, the back of its band. */
function lidOutline(): Pt[] {
  const out: Pt[] = [[-LY, RIM_Z], [LY, RIM_Z]];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    out.push([LY * Math.cos(a), RIM_Z + BAND + CROWN * Math.sin(a)]);
  }
  return out;
}

function chestOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const LID = paler(WOOD, 0.06);
  const BASE = deeper(woodTone(look.material), 0.22);
  const INNER = deeper(WOOD, 0.5);
  const open = Math.round(look.trim ?? 0) === 1;
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The plinth, moulded round its head.
  add(slab(-X - 0.35, X + 0.35, -Y - 0.35, Y + 0.35, 0, PLINTH, BASE, {
    corner: 0.3, bevel: 0.3,
    paint: {
      front: (g, k, s) => grain(g, k.fill, s.w, s.h, 5, 'x', 0.5), back: (g, k, s) => grain(g, k.fill, s.w, s.h, 6, 'x', 0.5),
      left: (g, k, s) => grain(g, k.fill, s.w, s.h, 7, 'x', 0.5), right: (g, k, s) => grain(g, k.fill, s.w, s.h, 8, 'x', 0.5),
    },
  }), { edges: true });

  // The box: whole when it is shut; when open, four walls round a floor, their insides a step deeper.
  const outside = { front: boxSide(11, true, false), back: boxSide(12, true, false), left: boxSide(13, false, true), right: boxSide(14, false, true) };
  let body: KitPart[];
  if (!open) body = [add(slab(-X, X, -Y, Y, PLINTH, RIM_Z, WOOD, { corner: 0.18, paint: outside }))];
  else {
    const wall = (x0: number, x1: number, y0: number, y1: number, out: 'front' | 'back' | 'left' | 'right', inn: 'front' | 'back' | 'left' | 'right', seed: number): KitPart =>
      add(slab(x0, x1, y0, y1, PLINTH, RIM_Z, WOOD, {
        corner: out === 'front' || out === 'back' ? 0.18 : 0,
        paint: { [out]: outside[out], [inn]: inside(INNER, seed), top: (g: Ctx, k: PaintCtx, s: Side) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, seed + 3, 'x', 0.5); g.restore(); } },
      }), { edges: true });
    body = [
      wall(-X, X, -Y, -Y + WALL, 'back', 'front', 21),
      wall(-X, -X + WALL, -Y + WALL, Y - WALL, 'left', 'right', 22),
      wall(X - WALL, X, -Y + WALL, Y - WALL, 'right', 'left', 23),
      wall(-X, X, Y - WALL, Y, 'front', 'back', 24),
    ];
    const floor = add(slab(-X + WALL, X - WALL, -Y + WALL, Y - WALL, PLINTH, FLOOR, INNER, { paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); inside(INNER, 25)(g, k, s); g.restore(); } } }), { solid: false });
    // The lining over its floor, and a few coins on it.
    const CLOTH = clothTone(look.tint);
    const lining = add(slab(-X + WALL + 0.1, X - WALL - 0.1, -Y + WALL + 0.1, Y - WALL - 0.1, FLOOR, FLOOR + 0.45, CLOTH, { corner: 0.4, bevel: 0.25, crease: 0.25 }), { solid: false, after: [floor] });
    const coins: V3[] = [[-2.2, 0.6, FLOOR + 0.5], [-1.4, 1.2, FLOOR + 0.5], [-1.8, -0.3, FLOOR + 0.55], [-2.6, -0.1, FLOOR + 0.62], [2.4, -0.8, FLOOR + 0.5]];
    parts.push({
      reach: coins, after: [lining],
      draw: (g, e) => {
        for (const c of coins) {
          const [x, y] = proj(e, c);
          g.beginPath();
          g.ellipse(x, y, 0.85, 0.5, 0, 0, Math.PI * 2);
          g.fillStyle = '#9a7434';
          g.fill();
          g.beginPath();
          g.ellipse(x - 0.1, y - 0.1, 0.62, 0.34, 0, 0, Math.PI * 2);
          g.fillStyle = '#f6d47a';
          g.fill();
        }
      },
    });
  }

  // The grips, one at each end.
  for (const sgn of [-1, 1]) {
    const x0 = sgn > 0 ? X : -X - 0.42, x1 = sgn > 0 ? X + 0.42 : -X;
    add(slab(x0, x1, -1.05, 1.05, RIM_Z - 1.45, RIM_Z - 1.05, IRON, { paint: { top: (g, k, s) => sheen(g, k.fill, s.w, s.h, 3) } }));
  }

  // The lid: six staves over the crown, its ends bound in iron, the straps over it.
  const outline = lidOutline();
  const STAVES = outline.length;
  const lidFaces = extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, -LX, LX, LID, 0.24, {
    // Its ends: the grain across them and an iron rim round the curve.
    front: (g, k) => lidEnd(g, k, outline),
    back: (g, k) => lidEnd(g, k, outline),
    edge: (i) => ({
      crease: 0.45,
      paint: (g: Ctx, k: PaintCtx) => {
        const p = outline[i], q = outline[(i + 1) % STAVES];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        // Its underside, seen only with the lid thrown back: the inside of the lid.
        if (i === 0) { g.save(); g.translate(0, -LX); inside(INNER, 31)(g, k, { o: [0, 0, 0], a: [1, 0, 0], b: [0, 1, 0], w: len, h: LX * 2, n: [0, 0, 1], poly: [] }); g.restore(); return; }
        g.save();
        g.translate(0, -LX);
        grain(g, k.fill, len, LX * 2, 40 + i, 'y', 0.9);
        g.restore();
        for (const x of [-STRAP_X, STRAP_X]) band(g, k, -0.1, len + 0.1, x - STRAP_W / 2, x + STRAP_W / 2, i === 1 ? 1 : 2, false);
      },
    }),
  });
  const hinge: V3 = [0, -LY, RIM_Z];
  const lid = add(open ? turned(lidFaces, hinge, [1, 0, 0], OPEN) : lidFaces, { edges: true, after: open ? body : [] });

  // The hasp: a brass plate down over the box's front from the lid, its keyhole, and a small gold rune over that.
  const hasp = slab(-0.8, 0.8, LY + 0.01, LY + 0.27, RIM_Z - 1.55, RIM_Z + 0.75, BRASS, {
    corner: 0.12,
    paint: {
      front: (g, k, s) => {
        sheen(g, k.fill, s.w, s.h, 77);
        // The keyhole: a round and a slot under it.
        const dark = css(mix(k.fill, hex('#2a2030'), 0.85));
        g.fillStyle = dark;
        g.beginPath();
        g.arc(s.w / 2, 0.75, 0.24, 0, Math.PI * 2);
        g.fill();
        g.fillRect(s.w / 2 - 0.1, 0.3, 0.2, 0.45);
        inlay(g, k.fill, 'ingwaz', s.w / 2, 1.65, 0.34, 0.12);
        // Its rivets at the corners.
        for (const [x, y] of [[0.3, 0.25], [s.w - 0.3, 0.25], [0.3, s.h - 0.25], [s.w - 0.3, s.h - 0.25]] as Pt[]) nail(g, k.fill, x, y, 0.12);
      },
    },
  });
  if (!open) add(hasp);
  else {
    // Thrown back with the lid; a staple left on the box's front for it to drop over.
    add(turned(hasp, hinge, [1, 0, 0], OPEN), { after: [lid] });
    add(slab(-0.35, 0.35, Y, Y + 0.22, RIM_Z - 1.05, RIM_Z - 0.35, BRASS, { corner: 0.08 }));
  }
  return { parts, shade: [[-X - 0.35, -Y - 0.35, 0], [X + 0.35, -Y - 0.35, 0], [X + 0.35, Y + 0.35, 0], [-X - 0.35, Y + 0.35, 0]] };
}

/** A lid's end: the grain across it, and an iron rim round its curve a little in from its edge. */
function lidEnd(g: Ctx, k: PaintCtx, outline: readonly Pt[]): void {
  g.save();
  g.translate(-LY, RIM_Z);
  grain(g, k.fill, LY * 2, BAND + CROWN, 51, 'x', 0.8);
  g.restore();
  const fill: RGB = faceColour(IRON, k.L);
  const rim = (w: number, colour: string): void => {
    g.beginPath();
    outline.slice(2).forEach(([s, t], i) => {
      // Drawn in toward the middle of the curve, so the rim lies on the end and not over its edge.
      const cz = RIM_Z + BAND * 0.5;
      const d = Math.hypot(s, t - cz) || 1, k2 = 1 - 0.42 / d;
      const x = s * k2, y = cz + (t - cz) * k2;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.strokeStyle = colour;
    g.lineWidth = w;
    g.lineJoin = 'round';
    g.stroke();
  };
  rim(0.78, css(mix(fill, hex('#3a3448'), 0.45), 0.9));
  rim(0.6, css(fill));
  rim(0.14, css(mix(fill, [255, 255, 255], 0.4), 0.55));
}

export const CHEST: KitPiece = {
  model: (look) => chestOf(look),
  uses: { tint: true, material: true, trim: true },
  states: [{ trim: 0, label: 'shut' }, { trim: 1, label: 'open' }],
};
