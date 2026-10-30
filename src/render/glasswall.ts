/**
 * A solid wall of glass, drawn: one thick slab of pale sea-green glass the
 * whole thickness of a wall, standing on a timber sill and capped by a timber
 * head, so its foot, its top and its corners read as built and the panes read
 * as thick.
 *
 * Drawn in the wall's own coordinates (`WallGeom` in the renderer): `t` along
 * the border, `k` up the storey, `s` the face toward the camera (1) or the one
 * behind (-1). Back to front:
 *
 *   * the sill: its top, its face, its end where the run stops;
 *   * the glass: its inside face seen through it, with the lines where it
 *     meets the sill and the head; its end, edge-on and so deeper green, where
 *     the run stops; then its near face, a tint over whatever is behind it,
 *     brighter toward the head where it takes the sky, with a reflection
 *     streak across it, a lit edge under the head and over the sill, and a
 *     joint at each end of the section where the next pane carries on;
 *   * the head: its face, its top and its end.
 *
 * Only the timber is solid. Everything behind the glass is drawn first and
 * shows through it; after dark a light in the room behind warms it (`glow`).
 */
type Ctx = CanvasRenderingContext2D;
type RGB = readonly [number, number, number];

/** A point on the wall, as the renderer works it out. */
export interface GlassWallGeom {
  px: (t: number, k: number, s?: number) => number;
  py: (t: number, k: number, s?: number) => number;
}

export interface GlassWallLook {
  /** Where the near face stops at each end, the far face, and the top. */
  near: [number, number];
  far: [number, number];
  top: [number, number];
  /** Whether each end is in sight: the run stops there and turns toward the camera. */
  ends: [boolean, boolean];
  /** Whether glass carries on in line past each end: a joint between panes there. */
  joints: [boolean, boolean];
  /** Whether a glass wall turns the corner at each end: the two slabs meet at the glass, inside the timber. */
  corners: [boolean, boolean];
  /** Whether its top is open to be seen: nothing is drawn standing on it. */
  capped: boolean;
  /** How much light each face takes: the face, its top, an end. */
  lit: number;
  topLit: number;
  endLit: number;
  zoom: number;
  /** A light in the room behind, after dark: 0 to 1. */
  glow: number;
  /** Where the section is, so the streak is not in the same place on every pane. */
  seed: number;
}

/** How far up the storey the sill comes, and where the head starts: some 30 cm of sill and 33 cm of head on a 3 m storey. */
const GLASS_SILL = 0.1;
const GLASS_HEAD = 0.89;
/** How much of a wall's thickness the glass is: the sill and the head stand proud of it either side. */
const GLASS_DEEP = 0.7;
/** How far a rail is laid past an end it carries on from, along the wall: under a pixel at any zoom. */
const HAIR = 0.004;

/** The glass, the deeper green of it seen edge-on, the sky it throws back, and the warm of a lamp behind it. */
const GLASS: RGB = [190, 222, 214];
const EDGE: RGB = [104, 164, 150];
const SKY: RGB = [242, 251, 252];
const WARM: RGB = [255, 184, 104];
/** Oak, oiled: its face, its top, the ink round it, and the dark of its grain. */
const OAK: RGB = [150, 106, 62];
const OAK_TOP: RGB = [178, 134, 84];
const OAK_INK: RGB = [78, 52, 30];
const OAK_GRAIN: RGB = [128, 86, 46];

const css = (c: RGB, k = 1, a = 1): string =>
  `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

export function drawGlassWall(ctx: Ctx, g: GlassWallGeom, o: GlassWallLook): void {
  const { px, py } = g;
  const [T0, T1] = o.near, [B0, B1] = o.far, [C0, C1] = o.top;
  const S = GLASS_SILL, H = GLASS_HEAD;
  const hair = Math.max(0.6, 0.6 * o.zoom);
  const line = Math.max(1, 0.9 * o.zoom);
  const poly = (pts: Array<[number, number, number]>): void => {
    ctx.beginPath();
    pts.forEach(([t, k, s], i) => (i ? ctx.lineTo(px(t, k, s), py(t, k, s)) : ctx.moveTo(px(t, k, s), py(t, k, s))));
    ctx.closePath();
  };
  const quad = (t0: number, t1: number, k0: number, k1: number, s = 1): void => poly([[t0, k0, s], [t1, k0, s], [t1, k1, s], [t0, k1, s]]);
  const end = (t: number, k0: number, k1: number): void => poly([[t, k0, 1], [t, k0, -1], [t, k1, -1], [t, k1, 1]]);
  const seg = (a: [number, number, number], b: [number, number, number], style: string, w: number): void => {
    ctx.beginPath();
    ctx.moveTo(px(...a), py(...a));
    ctx.lineTo(px(...b), py(...b));
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const endAt = (i: 0 | 1): number => (i ? T1 : T0);
  type P3 = [number, number, number];
  /**
   * A gradient from `a` toward `b` whose lines of equal colour run along `a`
   * to `c`: across a face, parallel to its edges. Between two plain points the
   * lines lie level on screen, and on a face that slopes across the screen
   * each section of a run got the light at one end and the dark at the other.
   */
  const across = (a: P3, b: P3, c: P3): CanvasGradient => {
    const ax = px(...a), ay = py(...a), vx = px(...b) - ax, vy = py(...b) - ay;
    const ex = px(...c) - ax, ey = py(...c) - ay, ee = ex * ex + ey * ey || 1, d = (vx * ex + vy * ey) / ee;
    return ctx.createLinearGradient(ax, ay, ax + vx - ex * d, ay + vy - ey * d);
  };

  /** A rail of oak from `k0` to `k1`: its top (the sill's is the ledge the glass stands in), its face, its ends. */
  const rail = (k0: number, k1: number, lid: boolean, lidT: [number, number], lidFar: [number, number]): void => {
    // A hair past an end where the next pane's rail carries on, so the two pictures leave no seam between them.
    const lap = (i: 0 | 1, t: number): number => (o.joints[i] ? t + (i ? HAIR : -HAIR) : t);
    if (lid) {
      poly([[lap(0, lidT[0]), k1, 1], [lap(1, lidT[1]), k1, 1], [lap(1, lidFar[1]), k1, -1], [lap(0, lidFar[0]), k1, -1]]);
      ctx.fillStyle = css(OAK_TOP, o.topLit);
      ctx.fill();
      // Inked along its two long edges only: a run of rail is one length of oak, not a joint at every tile.
      seg([lidFar[0], k1, -1], [lidFar[1], k1, -1], css(OAK_INK, o.topLit, 0.55), hair);
      // A line of grain down the middle of the top, the length of it.
      if (o.zoom >= 1) seg([lidT[0], k1, 0.1], [lidT[1], k1, 0.1], css(OAK_GRAIN, o.topLit, 0.35), hair);
    }
    quad(lap(0, T0), lap(1, T1), k0, k1);
    ctx.fillStyle = css(OAK, o.lit);
    ctx.fill();
    // The light down it: the top of a rail catches the sky, its foot the shade of what is under it.
    const wash = across([0, k1, 1], [0, k0, 1], [1, k1, 1]);
    wash.addColorStop(0, 'rgba(255, 236, 200, 0.16)');
    wash.addColorStop(1, 'rgba(40, 24, 10, 0.16)');
    ctx.fillStyle = wash;
    ctx.fill();
    if (o.zoom >= 1) {
      // Two runs of grain along the face, broken where a board would be scarfed.
      const g1 = k0 + (k1 - k0) * 0.36, g2 = k0 + (k1 - k0) * 0.68, cut = 0.2 + ((o.seed * 7) % 5) * 0.12;
      seg([T0, g1, 1], [Math.min(T1, cut), g1, 1], css(OAK_GRAIN, o.lit, 0.4), hair);
      seg([Math.min(T1, cut + 0.06), g1, 1], [T1, g1, 1], css(OAK_GRAIN, o.lit, 0.4), hair);
      seg([T0, g2, 1], [T1, g2, 1], css(OAK_GRAIN, o.lit, 0.25), hair);
    }
    seg([T0, k0, 1], [T1, k0, 1], css(OAK_INK, o.lit, 0.85), hair);
    seg([T0, k1, 1], [T1, k1, 1], css(OAK_INK, o.lit, 0.7), hair);
    for (const i of [0, 1] as const) if (!o.joints[i]) seg([endAt(i), k0, 1], [endAt(i), k1, 1], css(OAK_INK, o.lit, 0.8), hair);
    // A lit arris along its top front edge.
    seg([T0, k1, 1], [T1, k1, 1], css([255, 240, 214], o.topLit, 0.45), hair);
    for (const i of [0, 1] as const) {
      if (!o.ends[i]) continue;
      end(endAt(i), k0, k1);
      ctx.fillStyle = css(OAK, o.endLit * 0.92);
      ctx.fill();
      ctx.strokeStyle = css(OAK_INK, o.endLit, 0.8);
      ctx.lineWidth = hair;
      ctx.stroke();
    }
  };

  /* ---- the sill ---- */
  rail(0, S, true, [T0, T1], [B0, B1]);

  /* ---- the glass, its foot on the sill, then its inside face ---- */
  const G = GLASS_DEEP;
  /** Where the glass stops at each end on a face at `s`: where it meets other glass round a corner, it meets it at the glass. */
  const glassEnd = (i: 0 | 1, s: 1 | -1): number => {
    const t = s > 0 ? (i ? T1 : T0) : (i ? B1 : B0), edge = i;
    return o.corners[i] ? edge + (t - edge) * G : t;
  };
  const N0 = glassEnd(0, 1), N1 = glassEnd(1, 1), F0 = glassEnd(0, -1), F1 = glassEnd(1, -1);
  // The sill seen through the thickness of the glass standing on it: greener the deeper it is looked into.
  poly([[N0, S, G], [N1, S, G], [F1, S, -G], [F0, S, -G]]);
  ctx.fillStyle = css(EDGE, o.topLit * 0.95, 0.42);
  ctx.fill();
  quad(F0, F1, S, H, -G);
  ctx.fillStyle = css(GLASS, 0.96, 0.2);
  ctx.fill();
  // Where the inside face meets the sill and the head, seen through the glass: the depth of it.
  seg([F0, S, -G], [F1, S, -G], css(EDGE, 0.65, 0.55), line);
  seg([F0, H, -G], [F1, H, -G], css(EDGE, 0.8, 0.35), hair);
  for (const i of [0, 1] as const) {
    if (!o.joints[i]) continue;
    const t = i ? F1 : F0;
    seg([t, S, -G], [t, H, -G], css(EDGE, 0.8, 0.3), hair);
  }
  // Its end, edge-on: the green the whole thickness of it, lit along the arris.
  for (const i of [0, 1] as const) {
    if (!o.ends[i]) continue;
    const t = endAt(i);
    poly([[t, S, G], [t, S, -G], [t, H, -G], [t, H, G]]);
    const e = across([t, S, G], [t, S, -G], [t, H, G]);
    e.addColorStop(0, css(EDGE, o.endLit * 1.08, 0.66));
    e.addColorStop(0.5, css(EDGE, o.endLit * 0.9, 0.52));
    e.addColorStop(1, css(EDGE, o.endLit * 1.05, 0.66));
    ctx.fillStyle = e;
    ctx.fill();
    seg([t, S, G], [t, H, G], 'rgba(255, 255, 255, 0.85)', line);
    seg([t, S, -G], [t, H, -G], 'rgba(255, 255, 255, 0.4)', hair);
    seg([t, S, 0.1], [t, H, 0.1], css(SKY, 1, 0.25), hair);
  }

  /* ---- the near face ---- */
  quad(N0, N1, S, H, G);
  const face = across([0, H, G], [0, S, G], [1, H, G]);
  // The sky in the head of it, the tint through the middle, the green deepening toward the sill.
  face.addColorStop(0, css(SKY, 1, 0.34 * o.lit));
  face.addColorStop(0.22, css(GLASS, Math.min(1.08, o.lit * 1.1), 0.24));
  face.addColorStop(0.75, css(GLASS, o.lit, 0.24));
  face.addColorStop(1, css(EDGE, Math.min(1.1, o.lit * 1.15), 0.36));
  ctx.fillStyle = face;
  ctx.fill();
  if (o.glow > 0) {
    ctx.fillStyle = css(WARM, 1, 0.32 * o.glow);
    ctx.fill();
  }
  // A streak of reflection across it, and a thinner one beside it: where along the pane goes by the section.
  ctx.save();
  quad(N0, N1, S, H, G);
  ctx.clip();
  const r = ((o.seed * 2654435761) >>> 0) / 4294967296;
  const at = 0.18 + 0.5 * r, lean = 0.3;
  const band = (t: number, w: number, a: number): void => {
    poly([[t, H, G], [t + w, H, G], [t + w - lean, S, G], [t - lean, S, G]]);
    ctx.fillStyle = css(SKY, 1, a * (0.55 + 0.45 * o.lit));
    ctx.fill();
  };
  band(at, 0.13, 0.26);
  band(at + 0.2, 0.04, 0.2);
  // The head stands proud of the glass and shades the top of it.
  quad(N0, N1, H - 0.05, H, G);
  const eave = across([0, H, G], [0, H - 0.05, G], [1, H, G]);
  eave.addColorStop(0, 'rgba(30, 50, 46, 0.22)');
  eave.addColorStop(1, 'rgba(30, 50, 46, 0)');
  ctx.fillStyle = eave;
  ctx.fill();
  ctx.restore();
  // The edges catch the light: along the foot, and up an end that turns a corner.
  seg([N0, S + 0.006, G], [N1, S + 0.006, G], 'rgba(255, 255, 255, 0.5)', hair);
  for (const i of [0, 1] as const) {
    if (!o.corners[i] || o.ends[i]) continue;
    const t = i ? N1 : N0;
    seg([t, S, G], [t, H, G], 'rgba(255, 255, 255, 0.6)', hair);
  }
  // And where the next pane carries on, the joint between them.
  for (const i of [0, 1] as const) {
    if (!o.joints[i]) continue;
    const t = endAt(i);
    seg([t, S, G], [t, H, G], css(EDGE, 0.75, 0.55), hair);
    seg([t + (i ? -0.012 : 0.012), S, G], [t + (i ? -0.012 : 0.012), H, G], 'rgba(255, 255, 255, 0.5)', hair);
  }

  /* ---- the head ---- */
  rail(H, 1, o.capped, [C0, C1], [C0, C1]);
  ctx.lineWidth = 1;
}
