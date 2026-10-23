import {
  band, boards, BRASS, css, deeper, grain, hex, lathe, mix, nail, paler, sheen, slab, stud, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side,
} from './core';
import { keyhole, topGrain } from './joinery';

/**
 * A coffer (`coffer`, one subtile), in the kit: the chest's smaller, richer
 * sibling -- a boarded box on four brass ball feet under a cushioned lid, its
 * corners capped in brass, a brass band round its foot and round the lid's
 * edge, two brass straps over the lid and down front and back, a brass hasp down over its front with a padlock hung from it, and a
 * gold stud set in the middle of the lid. The wood is what it was built of;
 * dyed, its boards are painted in the dye and the brass is left bare.
 */

/** The box: half its length and depth, the feet's height and the box's rim. */
const X = 3.35, Y = 2.4, FEET = 0.55, RIM = 2.7;
/** The lid: its overhang, and its top. */
const OVER = 0.16, LID = 3.95;
/** How wide the brass caps up its corners are; the two straps over it, how far either side of the middle and how wide. */
const CAP = 0.55, STRAP_X = 1.75, STRAP_W = 0.6;

/** The two straps up a face whose middle is at `mid`, from `y0` to `y1`. */
function straps(g: Ctx, k: PaintCtx, mid: number, y0: number, y1: number, nails: number): void {
  for (const x of [mid - STRAP_X, mid + STRAP_X]) band(g, k, x - STRAP_W / 2, x + STRAP_W / 2, y0, y1, nails, true, BRASS);
}

/** A side of the box: two boards, brass caps up its ends and a brass band along its foot. */
function boxSide(seed: number, strapped: boolean) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 2, seed);
    if (strapped) straps(g, k, s.w / 2, 0, s.h, 2);
    band(g, k, 0, s.w, 0, 0.42, 0, false, BRASS);
    band(g, k, -0.1, CAP, 0, s.h, 2, true, BRASS);
    band(g, k, s.w - CAP, s.w + 0.1, 0, s.h, 2, true, BRASS);
  };
}

/** A side of the lid: the grain along it, a brass band round its foot, its corners capped. */
function lidSide(seed: number, strapped: boolean) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    grain(g, k.fill, s.w, s.h, seed, 'x', 0.7);
    if (strapped) straps(g, k, s.w / 2, -0.1, s.h + 0.1, 0);
    band(g, k, 0, s.w, 0, 0.32, 0, false, BRASS);
    band(g, k, -0.1, CAP, 0, s.h, 1, true, BRASS);
    band(g, k, s.w - CAP, s.w + 0.1, 0, s.h, 1, true, BRASS);
  };
}

function cofferOf(look: KitLook): KitModel {
  // A step deeper than the chest's boards, oiled dark, so its brass stands out.
  const WOOD = deeper(woodTone(look.material, look.tint, 0.75), 0.3);
  const LIDW = paler(WOOD, 0.05);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The feet: brass balls under its corners.
  for (const [fx, fy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    add(lathe(fx * (X - 0.45), fy * (Y - 0.45), [[0, 0.26], [0.12, 0.4], [0.32, 0.46], [0.48, 0.36], [FEET, 0.3]], 8, BRASS), { edges: true });
  }
  add(slab(-X, X, -Y, Y, FEET, RIM, WOOD, {
    corner: 0.12,
    paint: { front: boxSide(11, true), back: boxSide(12, true), left: boxSide(13, false), right: boxSide(14, false) },
  }));
  // The lid, cushioned: its edge bevelled deep, a brass rim round the top of the bevel and the stud in the middle.
  add(slab(-X - OVER, X + OVER, -Y - OVER, Y + OVER, RIM, LID, LIDW, {
    corner: 0.22, bevel: 0.55,
    paint: {
      front: lidSide(21, true), back: lidSide(22, true), left: lidSide(23, false), right: lidSide(24, false),
      top: (g, k, s) => {
        topGrain(31, 'x', 0.7)(g, k, s);
        for (const x of [-STRAP_X, STRAP_X]) band(g, k, x - STRAP_W / 2, x + STRAP_W / 2, -s.h / 2 - 0.1, s.h / 2 + 0.1, 2, true, BRASS);
        stud(g, 0, 0, 0.55);
      },
      bevel: (g, k, s) => {
        grain(g, k.fill, s.w, s.h + 0.4, 41, 'x', 0.5);
        // The straps on over the bevel front and back, where they run from the top down the sides.
        if (Math.abs(s.n[1]) > Math.abs(s.n[0])) straps(g, k, s.w / 2, -0.2, s.h + 0.6, 0);
      },
    },
  }), { edges: true });

  // The hasp: a brass plate from the lid down over the box's front, a staple through it.
  add(slab(-0.32, 0.32, Y + OVER, Y + OVER + 0.16, RIM - 0.85, RIM + 0.75, BRASS, {
    corner: 0.08,
    paint: {
      front: (g, k, s) => {
        sheen(g, k.fill, s.w, s.h, 77);
        nail(g, k.fill, s.w / 2, s.h - 0.25, 0.1);
        g.fillStyle = css(mix(k.fill, hex('#2a2030'), 0.8));
        g.fillRect(s.w / 2 - 0.1, 0.15, 0.2, 0.35);
      },
    },
  }));
  // The padlock hung from the staple: a brass body, its keyhole, and the iron shackle up through the hasp.
  add(slab(-0.4, 0.4, Y + OVER + 0.16, Y + OVER + 0.52, RIM - 1.55, RIM - 0.8, BRASS, {
    corner: 0.14, bevel: 0.1,
    paint: {
      front: (g, k, s) => { sheen(g, k.fill, s.w, s.h, 78); keyhole(g, k, s.w / 2, 0.12, 0.45); },
    },
  }));
  return { parts, shade: [[-X - 0.2, -Y - 0.2, 0], [X + 0.2, -Y - 0.2, 0], [X + 0.2, Y + 0.2, 0], [-X - 0.2, Y + 0.2, 0]] };
}

export const COFFER: KitPiece = {
  model: (look) => cofferOf(look),
  uses: { tint: true, material: true },
};
