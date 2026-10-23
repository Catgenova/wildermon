import {
  boards, clothTone, css, deeper, extrude, faceColour, grain, hex, lathe, mix, paler, slab, stud, warped, woodTone,
  type Ctx, type Tone, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type V3,
} from './core';

/**
 * A chair (`chair`, one subtile), in the kit: a cottage chair of the wood it
 * was built of, four square legs chamfered and drawn in a hair at the foot,
 * a thick seat on an apron, side stretchers low between the legs, and a back
 * raked a little as it rises -- two posts with turned knobs, a low rail, and
 * an arched crest rail with a gold stud set in its front. A
 * plump cushion, tufted in its middle, sits on the seat: linen, or the dye.
 */

/* ---- where it stands, in units ------------------------------------------------------ */

/** The seat: half its width, its back and front, the foot of its apron, and its underside and top. */
const SEAT_X = 2.75, SEAT_Y0 = -2.35, SEAT_Y1 = 2.65;
const APRON_Z = 3.25, SEAT_Z0 = 3.85, SEAT_Z1 = 4.55;
/** The legs: square, centred this far out, this thick. */
const LEG_X = 2.2, LEG_FRONT = 2.15, LEG_BACK = -1.85, LEG_W = 0.9;
/** The back: its posts' tops, the low rail's foot and head, and the crest rail's foot, shoulders and crown. */
const POST_TOP = 9.2, RAIL_Z0 = 6.2, RAIL_Z1 = 6.85, CREST_Z0 = 7.75, CREST_Z1 = 8.85, CREST_CROWN = 9.45;
/** How far back the back leans at its top, from the seat up. */
const RAKE = 0.55;
const raked = (p: V3): V3 => [p[0], p[1] - (RAKE * Math.max(0, p[2] - SEAT_Z1)) / (POST_TOP - SEAT_Z1), p[2]];

/* ---- painting ----------------------------------------------------------------------- */

/** A wood's side, its grain running up it (a leg, a post) or along it (a rail, the seat's edge). */
const woodSide = (seed: number, along: 'x' | 'y') => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, along, 0.7);

/** The cushion's cloth: a soft light over its crown, and the tuft pulling folds in toward its middle. */
function quilted(g: Ctx, k: PaintCtx, s: Side, tone: Tone): void {
  const lit = faceColour(tone, Math.min(1, k.L + 0.1));
  const r = Math.min(s.w, s.h) * 0.5;
  const gr = g.createRadialGradient(-0.3, 0.2, 0, 0, 0, r * 1.4);
  gr.addColorStop(0, css(mix(lit, [255, 252, 246], 0.35), 0.55));
  gr.addColorStop(1, css(lit, 0));
  g.fillStyle = gr;
  g.fillRect(-s.w, -s.h, s.w * 2, s.h * 2);
  // Folds drawn in to the tuft from its four corners.
  g.lineCap = 'round';
  g.strokeStyle = css(mix(k.fill, hex('#6a5468'), 0.35), 0.5);
  g.lineWidth = 0.13;
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]) {
    g.beginPath();
    g.moveTo(x * s.w * 0.36, y * s.h * 0.34);
    g.quadraticCurveTo(x * s.w * 0.1, y * s.h * 0.22, x * 0.18, y * 0.14);
    g.stroke();
  }
  // The tuft: a button sunk in it.
  g.beginPath();
  g.ellipse(0, 0, 0.3, 0.26, 0, 0, Math.PI * 2);
  g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.45));
  g.fill();
  g.beginPath();
  g.ellipse(-0.06, 0.06, 0.13, 0.11, 0, 0, Math.PI * 2);
  g.fillStyle = css(mix(lit, [255, 255, 255], 0.4), 0.8);
  g.fill();
}

/* ---- the model ------------------------------------------------------------------------ */

function chairOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const TOP = paler(WOOD, 0.08);
  const END = deeper(WOOD, 0.12);
  const CLOTH = clothTone(look.tint);
  const parts: KitPart[] = [];
  const solid = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The legs, square, chamfered at their arrises and drawn in a hair at the foot; the back two stop under the seat and go on over it as posts.
  const legAt: Array<[number, number]> = [[-LEG_X, LEG_BACK], [LEG_X, LEG_BACK], [LEG_X, LEG_FRONT], [-LEG_X, LEG_FRONT]];
  legAt.forEach(([x, y], i) => solid(slab(x - LEG_W / 2, x + LEG_W / 2, y - LEG_W / 2, y + LEG_W / 2, 0, SEAT_Z0, WOOD, {
    corner: 0.16, taper: 0.07, paint: { front: woodSide(11 + i, 'y'), left: woodSide(21 + i, 'y'), right: woodSide(31 + i, 'y'), back: woodSide(41 + i, 'y') },
  })));
  // The side stretchers, low between front and back legs.
  for (const x of [-LEG_X, LEG_X]) {
    solid(slab(x - 0.22, x + 0.22, LEG_BACK + LEG_W / 2, LEG_FRONT - LEG_W / 2, 1.15, 1.6, END, { corner: 0.08 }));
  }
  // The apron round under the seat, between the legs.
  solid(slab(-SEAT_X + 0.32, SEAT_X - 0.32, SEAT_Y0 + 0.45, SEAT_Y1 - 0.4, APRON_Z, SEAT_Z0, END, {
    paint: { front: woodSide(51, 'x'), left: woodSide(52, 'x'), right: woodSide(53, 'x'), back: woodSide(54, 'x') },
  }));
  // The seat: three boards across, its edges softened.
  const seat = solid(slab(-SEAT_X, SEAT_X, SEAT_Y0, SEAT_Y1, SEAT_Z0, SEAT_Z1, TOP, {
    corner: 0.42, bevel: 0.2,
    paint: {
      top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 3, 61, 'y'); g.restore(); },
      front: woodSide(62, 'x'), left: woodSide(63, 'x'), right: woodSide(64, 'x'), back: woodSide(65, 'x'),
    },
  }), { edges: true });

  // The back, raked: the posts and their knobs, and the rails between them.
  for (const [i, x] of [-LEG_X, LEG_X].entries()) {
    solid(warped(slab(x - LEG_W / 2, x + LEG_W / 2, LEG_BACK - LEG_W / 2, LEG_BACK + LEG_W / 2, SEAT_Z1, POST_TOP, WOOD, {
      corner: 0.16, bevel: 0.14, paint: { front: woodSide(71 + i, 'y'), left: woodSide(73 + i, 'y'), right: woodSide(75 + i, 'y'), back: woodSide(77 + i, 'y') },
    }), raked));
    solid(warped(lathe(x, LEG_BACK, [[POST_TOP - 0.05, 0.36], [POST_TOP + 0.16, 0.46], [POST_TOP + 0.38, 0.38], [POST_TOP + 0.54, 0.18], [POST_TOP + 0.6, 0.02]], 8, TOP), raked), { edges: true });
  }
  // The rails across the back: a straight one low, and the crest rail arched over its middle with a gold stud set in its front.
  const inner = LEG_X - LEG_W / 2 + 0.05;
  const rail = (outline: Pt[], z0: number, z1: number, thick: number, seed: number, studded: boolean): KitPart => solid(warped(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, LEG_BACK - thick / 2, LEG_BACK + thick / 2, WOOD, 0.14, {
    front: (g, k) => {
      g.save(); g.translate(-inner, z0); grain(g, k.fill, inner * 2, z1 - z0, seed, 'x', 0.6); g.restore();
      if (studded) stud(g, 0, (CREST_Z0 + CREST_Z1) / 2 + 0.1, 0.44);
    },
    back: (g, k) => { g.save(); g.translate(-inner, z0); grain(g, k.fill, inner * 2, z1 - z0, seed + 1, 'x', 0.6); g.restore(); },
  }), raked), { edges: true });
  rail([[-inner, RAIL_Z0], [inner, RAIL_Z0], [inner, RAIL_Z1], [-inner, RAIL_Z1]], RAIL_Z0, RAIL_Z1, 0.5, 81, false);
  const rise = (k: number): number => CREST_Z1 + (CREST_CROWN - CREST_Z1) * k;
  rail([[-inner, CREST_Z0], [inner, CREST_Z0], [inner, CREST_Z1], [inner * 0.7, rise(0.55)], [inner * 0.3, rise(0.92)], [0, CREST_CROWN], [-inner * 0.3, rise(0.92)], [-inner * 0.7, rise(0.55)], [-inner, CREST_Z1]], CREST_Z0, CREST_CROWN, 0.66, 91, true);

  // The cushion: a plump pad on the seat in front of the back, its crown tufted.
  const cx0 = -SEAT_X + 0.3, cx1 = SEAT_X - 0.3, cy0 = LEG_BACK + LEG_W / 2 + 0.12, cy1 = SEAT_Y1 - 0.3;
  const top = SEAT_Z1 + 0.85;
  solid([
    ...slab(cx0 + 0.15, cx1 - 0.15, cy0 + 0.15, cy1 - 0.15, SEAT_Z1, top, CLOTH, {
      corner: 0.75, bevel: 0.42,
      paint: { top: (g, k, s) => quilted(g, k, s, CLOTH) },
      crease: 0.25,
    }),
  ], { after: [seat], edges: false });
  return { parts, shade: [[-SEAT_X, SEAT_Y0, 0], [SEAT_X, SEAT_Y0, 0], [SEAT_X, SEAT_Y1, 0], [-SEAT_X, SEAT_Y1, 0]] };
}

export const CHAIR: KitPiece = {
  model: (look) => chairOf(look),
  uses: { tint: true, material: true },
};
