import {
  BRASS, css, extrude, grain, hex, IRON, lathe, mix, nail, paler, seam, sheen, TAU, woodTone,
  type Ctx, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type V3,
} from './core';

/**
 * The barrels (`small_barrel`, `barrel`, `large_barrel`), in the kit: one
 * cask at three sizes, standing on end. Staves of the wood it was built of
 * swelling to its middle, four iron hoops (at each chime and each quarter),
 * a head of boards with its bung, and a brass tap low on the front, which
 * says which way it faces. Dyed, its staves take the dye as paint and the
 * hoops stay bare iron.
 */

/** One size of cask: `k` scales its height and hoops, `r0` and `rm` are its radius at the heads and at the bilge, all in units. */
interface Cask { k: number; r0: number; rm: number; sides: number }

/** The barrel's own height, 9.8 units (the old model's); the others are `k` of it. */
const H1 = 9.8;
/** Where up it, as a share of its height, its hoops are centred, and how tall each is at a `k` of one. */
const HOOPS = [0.1, 0.27, 0.73, 0.9];
const HOOP_W = 0.72;

/** Its radius at a share `u` of its height: drawn in to its heads, round at its bilge. */
const radiusAt = (c: Cask, u: number): number => c.r0 + (c.rm - c.r0) * (1 - (2 * u - 1) ** 2);

/**
 * The rings it is turned through, as shares of its height, and whether the
 * band over each is a hoop: a hoop is a band of the lathe of its own, so its
 * iron is lit stave by stave and ruled off the wood where it meets it.
 */
function ringsOf(c: Cask, H: number): Array<{ u: number; hoop: boolean }> {
  const w = (HOOP_W * c.k) / H / 2;
  const out: Array<{ u: number; hoop: boolean }> = [{ u: 0, hoop: false }];
  for (const u of HOOPS) {
    if (u > 0.5 && out[out.length - 1].u < 0.5) out.push({ u: 0.5, hoop: false });
    out.push({ u: u - w, hoop: true }, { u: u + w, hoop: false });
  }
  out.push({ u: 1, hoop: false });
  return out;
}

/** A stave between two hoops: its grain up it, its own hair of tint so the staves read one from the next, and the joint at its edge. */
function stave(seed: number, i: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const t = ((i * 37) % 7) / 7;
    if (t > 0.6) { g.fillStyle = css(mix(k.fill, hex('#6e5060'), 0.08), 0.6); g.fillRect(-0.2, -0.2, s.w + 0.4, s.h + 0.4); }
    else if (t < 0.25) { g.fillStyle = css(mix(k.fill, [255, 248, 234], 0.1), 0.6); g.fillRect(-0.2, -0.2, s.w + 0.4, s.h + 0.4); }
    grain(g, k.fill, s.w, s.h + 0.2, seed + i * 13, 'y', 0.55);
    seam(g, k.fill, 0.03, -0.2, 0.03, s.h + 0.2, 0.1);
  };
}

/** A hoop's iron over a stave: its sheen, a lit lip along its head and a dark one along its foot, and a rivet where it laps. */
function hoop(n: number, i: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    sheen(g, k.fill, s.w, s.h, 40 + n * 7 + i);
    g.fillStyle = css(mix(k.fill, [255, 255, 255], 0.45), 0.6);
    g.fillRect(-0.1, s.h - 0.14, s.w + 0.2, 0.14);
    g.fillStyle = css(mix(k.fill, hex('#2e2a3c'), 0.5), 0.55);
    g.fillRect(-0.1, 0, s.w + 0.2, 0.1);
    if ((i + n * 5) % 7 === 3) nail(g, k.fill, s.w / 2, s.h / 2, 0.14);
  };
}

/** Its head: the boards it is made of, the chime round it where the staves stand proud, and the bung. */
function head(c: Cask) {
  return (g: Ctx, k: PaintCtx): void => {
    const r = c.r0 * Math.cos(Math.PI / c.sides);
    const chime = Math.max(0.32, 0.45 * c.k);
    g.save();
    g.beginPath();
    g.arc(0, 0, r - chime, 0, TAU);
    g.clip();
    const fill = mix(k.fill, hex('#6e5060'), 0.1);
    g.fillStyle = css(fill);
    g.fillRect(-r, -r, r * 2, r * 2);
    g.save();
    g.translate(-r, -r);
    grain(g, fill, r * 2, r * 2, 31, 'x', 0.6);
    g.restore();
    for (const y of [-r * 0.36, r * 0.36]) seam(g, fill, -r, y, r, y, 0.14);
    // The shade the chime throws over the far side of the head.
    const gr = g.createLinearGradient(0, -r, 0, r);
    gr.addColorStop(0, 'rgba(70, 52, 72, 0.3)');
    gr.addColorStop(0.35, 'rgba(70, 52, 72, 0)');
    g.fillStyle = gr;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
    // The chime: the staves' end grain in a ring round the head.
    g.beginPath();
    g.arc(0, 0, r - chime, 0, TAU);
    g.strokeStyle = css(mix(k.fill, hex('#4a3640'), 0.45), 0.8);
    g.lineWidth = 0.14;
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r - chime * 0.5, 0, TAU);
    g.strokeStyle = css(mix(k.fill, [255, 248, 232], 0.35), 0.6);
    g.lineWidth = chime * 0.45;
    g.stroke();
    // The bung, stopped with a plug a step darker.
    const bx = r * 0.42, by = r * 0.1, br = Math.max(0.42, 0.62 * c.k);
    g.beginPath();
    g.arc(bx, by, br, 0, TAU);
    g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.55));
    g.fill();
    g.beginPath();
    g.arc(bx - 0.06, by + 0.06, br * 0.65, 0, TAU);
    g.fillStyle = css(mix(k.fill, hex('#6e5060'), 0.25));
    g.fill();
  };
}

function caskOf(look: KitLook, c: Cask): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const H = H1 * c.k;
  const parts: KitPart[] = [];
  const rings = ringsOf(c, H);
  const profile = rings.map(({ u }) => [u * H, radiusAt(c, u)] as [number, number]);
  // Turned so a stave faces square to the front, for the tap to stand on.
  const turn = (((c.sides / 4 - 0.5) % 1) + 1) % 1;
  const body = lathe(0, 0, profile, c.sides, WOOD, turn, (k, i, s) => {
    const paint = rings[k].hoop ? hoop(k, i) : stave(7 + k * 3, i);
    return { crease: 0.3, ...(rings[k].hoop ? { tone: IRON } : {}), paint: (g: Ctx, kk: PaintCtx) => paint(g, kk, s) };
  });
  // The head is the last face: a step paler, and its boards.
  const top = body[body.length - 1];
  body[body.length - 1] = { ...top, tone: paler(WOOD, 0.04), paint: head(c), crease: 0.45 };
  parts.push({ faces: body, edges: true });

  // The tap, low on the front: a brass pipe out of the stave, its spout turned down and its key up.
  const zc = H * 0.2, k = Math.max(0.85, c.k * 0.85);
  const front = radiusAt(c, 0.2) * Math.cos(Math.PI / c.sides);
  const yb = front - 0.2, tip = front + 1.35 * k, ym = front + 0.55 * k;
  const pipe: Pt[] = [
    [yb, zc - 0.3 * k], [tip - 0.5 * k, zc - 0.3 * k], [tip - 0.5 * k, zc - 0.95 * k], [tip, zc - 0.95 * k], [tip, zc + 0.3 * k],
    [ym + 0.24 * k, zc + 0.3 * k], [ym + 0.24 * k, zc + 0.75 * k], [ym - 0.24 * k, zc + 0.75 * k], [ym - 0.24 * k, zc + 0.3 * k], [yb, zc + 0.3 * k],
  ];
  const tw = 0.3 * k;
  parts.push({
    faces: extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], pipe, -tw, tw, BRASS, 0.08, {
      edge: () => ({ paint: (g: Ctx, kk: PaintCtx) => sheen(g, kk.fill, 2, 0.6, 5), crease: 0.35 }),
    }),
  });
  // Its collar, a brass plate nailed to the stave round where the pipe goes in.
  const collar = 0.62 * k;
  parts.push({
    faces: extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], [[-collar, zc - collar], [collar, zc - collar], [collar, zc + collar], [-collar, zc + collar]], front - 0.05, front + 0.12, BRASS, 0.06, {
      front: (g, kk) => {
        for (const [x, y] of [[-collar + 0.22, zc - collar + 0.22], [collar - 0.22, zc - collar + 0.22], [collar - 0.22, zc + collar - 0.22], [-collar + 0.22, zc + collar - 0.22]] as Pt[]) nail(g, kk.fill, x, y, 0.1);
      },
    }),
  });

  const R = c.rm;
  const shade: V3[] = Array.from({ length: 12 }, (_, i) => [Math.cos((i / 12) * TAU) * R, Math.sin((i / 12) * TAU) * R, 0]);
  return { parts, shade };
}

const caskPiece = (c: Cask): KitPiece => ({
  model: (look) => caskOf(look, c),
  uses: { tint: true, material: true },
});

export const BARREL: KitPiece = caskPiece({ k: 1, r0: 3, rm: 3.6, sides: 12 });
export const SMALL_BARREL: KitPiece = caskPiece({ k: 0.72, r0: 2.16, rm: 2.6, sides: 10 });
/** The large one is a vat: a deal wider for its height than a barrel, but kept to its two subtiles by two. */
export const LARGE_BARREL: KitPiece = caskPiece({ k: 1.72, r0: 8.3, rm: 9.8, sides: 18 });
