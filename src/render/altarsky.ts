import { HEIGHT_SCALE } from './iso';
import { star } from './shine';

/**
 * The stars over an altar, drawn over its bake every frame and taken off the
 * night after dark: by the altar's old model (`MODELS.altar` in furniture.ts)
 * and its kit model (`kit/altar.ts`) alike.
 */

const TAU = Math.PI * 2;
type Pt = [number, number];
/** A piece's turn on the screen (`PieceView` in furniture.ts). */
interface PieceView { ux: number; uy: number; vx: number; vy: number }

/** Where a point of the piece falls on the screen and how near you it is, as `Scene` has them (`P`, `depth`). */
function sceneOf(v: PieceView): { P: (x: number, y: number, z: number) => Pt; depth: (x: number, y: number, z?: number) => number } {
  const k = v.vx * v.uy - v.ux * v.vy;
  const s = Math.sign(k) || 1;
  const toward = [s * v.vx, -s * v.ux, (s * k) / HEIGHT_SCALE];
  return {
    P: (x, y, z) => [x * v.ux + y * v.vx, x * v.uy + y * v.vy - z * HEIGHT_SCALE],
    depth: (x, y, z = 0) => x * toward[0] + y * toward[1] + z * toward[2],
  };
}

/* ---- the stars over an altar ----------------------------------------------- */

/**
 * The stars over an altar, which move.
 *
 * A piece is baked once for each way it is seen and blitted from then on,
 * which is right for a chest and wrong for anything that moves: a fire gets
 * four flickers, and a figure of stars turned through four pictures would
 * jerk round rather than turn. So what stands over the altar's dish is not in
 * the bake. The model keeps room for it -- a part that draws nothing, so the
 * piece is measured and clicked as tall as it stands -- and `drawFurniture`
 * draws it over the bake every frame, as it is at that moment.
 *
 * It is a figure of ten stars -- a head, two shoulders, a belt of three, two
 * feet and two raised hands -- set out in depth rather than on a card, joined
 * by lines, turning to and fro high over the dish and bobbing as it goes.
 * Loose stars hang round it, and under its feet a ring of light goes round
 * and round, with two motes running round it.
 *
 * It has to hold its own on pale grass by day, where nothing pale can: white
 * itself is under two to one against it. So what carries it is dark -- the
 * lines are a deep violet and each star has a gold body and a warm ink edge
 * like everything else on the island -- and the light by day is put where it
 * tells, in a halo behind the head and hands and a beam up from the dish. At
 * night the wash is taken back off the stars (`furnitureHoles`) rather than
 * the stars being painted over it, so whoever stands in front of them still
 * stands in front of them.
 */
type Star = readonly [number, number, number, number];
/**
 * The figure's stars from its middle, in units -- across, toward you and up --
 * and how bright each is: the brightest at the top, the head, then the raised
 * hands, the shoulders, the belt and the feet.
 *
 * Face on it is a person standing with both arms up, taller than it is wide
 * as a person is: narrow shoulders over a short torso, the head clear over
 * them, the hands higher still and out past them, long legs to a stride
 * below the belt. It stands in depth, not on a card -- the hands reach 3
 * units out toward you, the head leans 1 back and the feet stride 1.5 each
 * way -- so as it turns the near hand slides across the far one and the
 * figure is seen to turn, not only to narrow.
 */
const SKY_STARS: Star[] = [
  [0, -1, 7.4, 1.5],
  [-4.2, 0, 4, 1.1], [4.2, 0, 4, 1.1],
  [-3, 0, 0.1, 1], [0, 0, 0, 1], [3, 0, -0.1, 1],
  [-3.4, 1.5, -7.5, 0.85], [3.4, -1.5, -7.5, 0.85],
  [-7.5, 3, 12.2, 1.3], [7.5, 3, 12.2, 1.3],
];
/** Which stars a line joins: head to shoulders, shoulders to belt, belt to feet, and each shoulder up to its hand. */
const SKY_LINKS: Array<[number, number]> = [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7], [1, 8], [2, 9]];
/**
 * The loose stars round it: small, dim and joined to nothing, so the figure is
 * what is seen -- each in a gap of it that no star or line of the figure
 * crosses at any point of its turn, and none near another: two over its head,
 * one outside a shoulder, one by a hip, one by a knee and one between its
 * feet.
 */
const SKY_DUST: Star[] = [[-3.5, 3, 12, 1.3], [2.5, 2, 12.5, 1.3], [-9, 0, 4, 1.3], [7.5, 2, -1.5, 1.3], [-6.5, 0, -4, 1.3], [0, 0, -4.5, 1.3]];
/** Each star's colours, deep and pale: a rose shoulder, a blue foot, and gold for the rest. */
const STAR_INK = (i: number): [string, string] =>
  i === 1 ? ['214, 98, 98', '255, 214, 200'] : i === 7 ? ['80, 140, 214', '210, 232, 255'] : ['230, 180, 84', '255, 236, 170'];
/** The warm ink every piece on the island is edged in, and the violet of the lines, deep and pale. */
const SKY_EDGE = '74, 48, 40', LINE_DEEP = '96, 70, 156', LINE_PALE = '214, 186, 246';
/** The violet of the beam and of the glow by day, which green grass takes as lilac. */
const BEAM_DAY = '200, 90, 230';
/** The top of the dish the stars stand over and how far its lip runs out, and where the middle of the figure hangs, in units over the floor. */
export const DISH_Z = 13.65, DISH_R = 4.3, SKY_Z = 26.55;
/** Seconds to a bob of the figure, and how far it bobs in units; seconds to a turn of the ring, and to a lap of a mote round it. */
const SKY_BOB = 5.5, BOB = 0.7, RING_TURN = 24, MOTE_LAP = 12;
/**
 * The figure's turn: to and fro about facing you, `SKY_SWAY` radians each
 * way, once there and back in `SKY_SWING` seconds. A figure of stars is a
 * string of beads seen end on, so it never goes all the way round; and on
 * this slant a turn tips whatever lies across it, so it goes no further than
 * keeps its lower hand over its head -- at the far end it is still nine
 * tenths as wide as face on and its hands tip 15 degrees. The ring under it
 * is what goes all the way round.
 */
const SKY_SWAY = 0.5, SKY_SWING = 14;
/**
 * The ring: how far out it runs, how far it leans off level, and how far
 * under the middle of the figure it turns -- below its feet and over the
 * dish, the orbit it stands on, with the beam coming up through it.
 */
const RING_R = 11, RING_LEAN = 0.1, RING_DROP = 10;
/** The furthest a star stands out from the middle, or the ring runs: the sides of the room the model keeps. */
export const SKY_REACH = Math.max(RING_R, ...[...SKY_STARS, ...SKY_DUST].map(([x, y]) => Math.hypot(x, y)));
/** The highest a star reaches, bob and spikes and all: the top of that room. */
export const SKY_TOP = SKY_Z + BOB + Math.max(...[...SKY_STARS, ...SKY_DUST].map((q) => q[2])) + 2.4;

/** Where everything over an altar is at `t`, on a screen with the altar's floor at (sx, sy). */
function skyAt(view: PieceView, zoom: number, sx: number, sy: number, t: number) {
  const sc = sceneOf(view);
  // Square to you is where a step across the figure goes straight across the screen and a step toward it straight down.
  const square = Math.atan2(-view.uy, view.vy);
  const turn = square + SKY_SWAY * Math.sin((t / SKY_SWING) * TAU), c = Math.cos(turn), s = Math.sin(turn);
  const mid = SKY_Z + Math.sin((t / SKY_BOB) * TAU) * BOB;
  const at = (x: number, y: number, z: number): Pt => {
    const [px, py] = sc.P(x, y, z);
    return [sx + px * zoom, sy + py * zoom];
  };
  /** A star where it has turned to: its place on the screen and how near you it is. */
  const place = ([x, y, z]: Star): { p: Pt; d: number } => {
    const wx = x * c - y * s, wy = x * s + y * c;
    return { p: at(wx, wy, mid + z), d: sc.depth(wx, wy, mid + z) };
  };
  const figure = SKY_STARS.map(place);
  const dust = SKY_DUST.map(place);
  const ds = figure.map((q) => q.d);
  const dMin = Math.min(...ds), dSpan = Math.max(1e-6, Math.max(...ds) - dMin);
  /** 0 on the far side of the figure, 1 on the near. */
  const near = (d: number): number => Math.max(0, Math.min(1, (d - dMin) / dSpan));
  // A unit across the screen, in pixels: what the light is measured in.
  const unit = Math.hypot(view.ux, view.vx) * zoom;
  // The ring, turning the other way, and what rides it: eight beads and two motes, half a lap apart.
  const ringTurn = -(t / RING_TURN) * TAU, rc = Math.cos(ringTurn), rs = Math.sin(ringTurn);
  const onRing = (a: number): { p: Pt; d: number } => {
    const x = Math.cos(a) * RING_R, y = Math.sin(a) * RING_R * Math.cos(RING_LEAN), z = mid - RING_DROP + Math.sin(a) * RING_R * Math.sin(RING_LEAN);
    const wx = x * rc - y * rs, wy = x * rs + y * rc;
    return { p: at(wx, wy, z), d: sc.depth(wx, wy, z) };
  };
  const beads = Array.from({ length: 8 }, (_, j) => onRing((j / 8) * TAU + 0.2));
  const motes = [0, 0.5].map((lap) => { const a = ((t / MOTE_LAP + lap) % 1) * TAU; return { a, ...onRing(a) }; });
  return { sc, at, mid, figure, dust, near, unit, onRing, beads, motes };
}

/**
 * How far a star's body reaches, in pixels, by how bright it is: in step with
 * the zoom up close but a little behind it, so a star that is big enough to
 * read at play zoom does not crowd the figure in a close-up.
 */
const starR = (mag: number, zoom: number): number => (0.8 + mag * 0.6) * zoom ** 0.85;

/** Where star `i` is in its twinkle at `t`, 0 to 1: each on its own beat, 1.7 to 3.1 s. */
const starFlare = (t: number, i: number): number => 0.5 + 0.5 * Math.sin((t / (1.7 + ((i * 0.37) % 1.4))) * TAU + i * 2.1);

/**
 * Draw the stars over an altar standing at (sx, sy), at `t` seconds, under a
 * night `night` dark (0 by day, 1 at midnight): after dark the lines lose some
 * of their ink, the pale in them and the light round the figure come up, the
 * ink edge goes and the loose stars come out, since the wash is taken back
 * off them.
 */
export function drawSky(g: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, view: PieceView, t: number, night = 0): void {
  const { sc, at, mid, figure, dust, near, unit, onRing, beads, motes } = skyAt(view, zoom, sx, sy, t);
  const day = 1 - night;
  g.save();
  g.lineCap = 'round';

  /*
   * First what it stands against and the light off it: the violet haze
   * behind the figure, breathing, a bloom of light over it and the pool in
   * the dish lit from above.
   */
  const breath = 0.8 + 0.2 * Math.sin(t * 1.3);
  const bloom = (x: number, y: number, r: number, ink: string, a: number): void => {
    if (a <= 0.002) return;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${ink}, ${a.toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(${ink}, ${(a * 0.45).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${ink}, 0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  const [cx, cy] = at(0, 0, mid + 0.6);
  const [dx, dy] = at(0, 0, DISH_Z);
  g.globalCompositeOperation = 'source-over';
  bloom(cx, cy, unit * 11, LINE_DEEP, 0.08 * night * breath);
  g.globalCompositeOperation = 'lighter';
  bloom(cx, cy, unit * 11, LINE_PALE, 0.25 * night * breath);
  bloom(dx, dy, unit * 5, LINE_PALE, (0.2 + 0.35 * night) * breath);
  /*
   * By day light added to pale grass is barely seen, so the glow behind the
   * head and both raised hands is laid on as colour instead: the violet of
   * the beam, which the grass takes as lilac, reaching well past each star's
   * points and pulsing on its own beat, so the top of the figure glows.
   */
  if (day > 0.02) {
    g.globalCompositeOperation = 'source-over';
    for (const i of [0, 8, 9]) {
      const q = figure[i];
      bloom(q.p[0], q.p[1], starR(SKY_STARS[i][3], zoom) * 3.5, BEAM_DAY, (0.28 + 0.12 * starFlare(t, i)) * day);
    }
    g.globalCompositeOperation = 'lighter';
  }
  // And after dark a gold glow round every star, so what shows round each through the wash is its own light, not the grass.
  if (night > 0.02) {
    figure.forEach((q, i) => bloom(q.p[0], q.p[1], starR(SKY_STARS[i][3], zoom) * 3, '255, 214, 150', 0.55 * night));
  }

  /*
   * Everything else goes down in one order, far to near: the ring's lengths
   * and its beads, the motes on it, the lines and the stars. So the ring's far
   * side is behind the figure and its near side in front, a star behind a
   * line is behind it, and nothing is on top only because it is a star. A
   * line is laid as far back as the further of its two stars, so it runs into
   * both of them rather than over either.
   */
  const draws: Array<{ d: number; draw: () => void }> = [];

  /*
   * A beam between the dish and the figure, so the stars stand on the altar
   * rather than hanging somewhere near it: from the far lip of the dish, so
   * the gold of the rim is not tinted by it, up through the ring and the legs
   * to the belt. It is brightest two fifths of the way up, between the dish
   * and the feet, where there is nothing behind it but grass or whoever
   * stands there, and fades out through the legs; and it is laid six times,
   * each narrower, so its sides are a soft ramp and nothing in it is an
   * edge. It goes in with the rest at the depth of the dish, so the far side
   * of the ring passes behind it and the near side in front.
   */
  const lip = Math.hypot(view.uy, view.vy);
  const [, ry] = at((-view.uy / lip) * DISH_R, (-view.vy / lip) * DISH_R, DISH_Z);
  const [, by] = at(0, 0, mid);
  const beamA = 0.6 * breath, BEAM_LAYERS = 6;
  // Violet by day, which lands on green grass as lilac -- the pale of the lines lands there as mint -- and the pale by night.
  const beamInk = BEAM_DAY.split(',').map((v, i) => Math.round(+v + ([214, 186, 246][i] - +v) * night)).join(', ');
  draws.push({ d: sc.depth(0, 0, DISH_Z), draw: () => {
    const beam = g.createLinearGradient(dx, ry, dx, by);
    beam.addColorStop(0, `rgba(${beamInk}, 0)`);
    beam.addColorStop(0.4, `rgba(${beamInk}, ${(beamA / BEAM_LAYERS).toFixed(3)})`);
    beam.addColorStop(0.75, `rgba(${beamInk}, ${((0.6 * beamA) / BEAM_LAYERS).toFixed(3)})`);
    beam.addColorStop(1, `rgba(${beamInk}, 0)`);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = beam;
    for (let j = 0; j < BEAM_LAYERS; j++) {
      const k = 1 - j / BEAM_LAYERS;
      g.beginPath();
      g.moveTo(dx - unit * 3.4 * k, ry);
      g.lineTo(dx - unit * 1.6 * k, by);
      g.lineTo(dx + unit * 1.6 * k, by);
      g.lineTo(dx + unit * 3.4 * k, ry);
      g.closePath();
      g.fill();
    }
  } });

  /*
   * One star, the same colour however far off it is: an ink edge round gold
   * points with arms six tenths as wide as they are tall, a pale body over
   * them and a white heart. Its twinkle is in the heart and the reach of its
   * points; the far side of the figure is a little smaller and a darker gold,
   * never a thinner one.
   */
  const drawStar = ([x, y]: Pt, r: number, flare: number, far: number, [deep, pale]: [string, string], tilt: number): void => {
    const [dr, dg, db] = deep.split(',').map(Number);
    const k = 1 - 0.2 * far;
    const spikes = `rgb(${Math.round(dr * k)}, ${Math.round(dg * k)}, ${Math.round(db * k)})`;
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    g.globalCompositeOperation = 'source-over';
    const R = r * 2 * (0.9 + 0.25 * flare);
    star(g, R, R * 0.6);
    if (day > 0.02) {
      g.strokeStyle = `rgba(${SKY_EDGE}, ${(0.85 * day).toFixed(3)})`;
      g.lineWidth = Math.max(1, 0.5 * zoom);
      g.stroke();
    }
    g.fillStyle = spikes;
    g.fill();
    g.fillStyle = `rgb(${pale})`;
    star(g, r * 1.3, r * 0.95);
    g.fill();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255, 255, 255, ${(0.2 + 0.8 * flare).toFixed(3)})`;
    g.beginPath();
    g.arc(0, 0, Math.max(1, r * 0.45), 0, TAU);
    g.fill();
    g.restore();
  };

  /*
   * The ring: level but for a tenth of a radian, so it is an orbit from every
   * side; faint by day, under the figure's feet. Eight beads ride it so its
   * turn can be seen, and two motes run round it, each a point of light with
   * a fading wake -- as bright as they are near, smoothly, so nothing flicks
   * from dim to bright where the ring passes behind.
   */
  const dMid = sc.depth(0, 0, mid - RING_DROP);
  const nearRing = (d: number): number => Math.max(0, Math.min(1, (d - dMid) / 3 + 0.5));
  const RING_N = 56;
  const ringPts = Array.from({ length: RING_N + 1 }, (_, j) => onRing((j / RING_N) * TAU));
  for (let j = 0; j < RING_N; j++) {
    const a = ringPts[j], b = ringPts[j + 1];
    const k = 0.65 + 0.35 * nearRing((a.d + b.d) / 2);
    draws.push({ d: Math.min(a.d, b.d), draw: () => {
      // Butt-ended, so where two lengths meet they meet, and do not lay a darker dot of both.
      g.lineCap = 'butt';
      // By day the violet alone, which shows on the grass; a pale core only after dark, when it has the wash to show against.
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(${LINE_DEEP}, ${(k * (0.75 * day + 0.25 * night)).toFixed(3)})`;
      g.lineWidth = Math.max(1.6, 0.55 * zoom);
      g.beginPath(); g.moveTo(a.p[0], a.p[1]); g.lineTo(b.p[0], b.p[1]); g.stroke();
      if (night > 0.02) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(${LINE_PALE}, ${(0.47 * k * night).toFixed(3)})`;
        g.lineWidth = Math.max(0.5, 0.22 * zoom);
        g.beginPath(); g.moveTo(a.p[0], a.p[1]); g.lineTo(b.p[0], b.p[1]); g.stroke();
      }
      g.lineCap = 'round';
    } });
  }
  for (const b of beads) {
    const k = 0.35 + 0.25 * nearRing(b.d);
    draws.push({ d: b.d, draw: () => {
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(${LINE_DEEP}, ${(k * day).toFixed(3)})`;
      g.beginPath(); g.arc(b.p[0], b.p[1], Math.max(1, 0.8 * zoom) + 0.5, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(${LINE_PALE}, ${(k + 0.3 * night).toFixed(3)})`;
      g.beginPath(); g.arc(b.p[0], b.p[1], Math.max(1, 0.8 * zoom), 0, TAU); g.fill();
    } });
  }
  for (const m of motes) {
    const a0 = m.a;
    const k = 0.6 + 0.4 * nearRing(m.d);
    draws.push({ d: m.d, draw: () => {
      // The wake: twelve samples close enough to run together, fading behind it.
      g.globalCompositeOperation = 'lighter';
      for (let i = 12; i >= 1; i--) {
        const w = onRing(a0 - i * 0.04);
        g.fillStyle = `rgba(${LINE_PALE}, ${(k * 0.45 * (1 - i / 13)).toFixed(3)})`;
        g.beginPath(); g.arc(w.p[0], w.p[1], zoom * (1.1 - i * 0.05), 0, TAU); g.fill();
      }
      // A glow round it, smaller and fainter by day, where white is only a puff on the grass.
      const reach = (2 + night) * zoom;
      const glow = g.createRadialGradient(m.p[0], m.p[1], 0, m.p[0], m.p[1], reach);
      glow.addColorStop(0, `rgba(${LINE_PALE}, ${((0.4 + 0.3 * night) * k).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${LINE_PALE}, 0)`);
      g.fillStyle = glow;
      g.beginPath(); g.arc(m.p[0], m.p[1], reach, 0, TAU); g.fill();
      // And its core, rimmed in the violet of the lines by day so it holds against the grass.
      g.globalCompositeOperation = 'source-over';
      const core = 1.2 * zoom ** 0.75;
      if (day > 0.02) {
        g.strokeStyle = `rgba(${LINE_DEEP}, ${(day * k).toFixed(3)})`;
        g.lineWidth = 1;
        g.beginPath(); g.arc(m.p[0], m.p[1], core + 0.5, 0, TAU); g.stroke();
      }
      g.fillStyle = `rgba(255, 255, 255, ${k.toFixed(3)})`;
      g.beginPath(); g.arc(m.p[0], m.p[1], core, 0, TAU); g.fill();
    } });
  }

  // The lines: deep violet, and a thin pale core down them.
  const wDeep = Math.max(1.8, 0.5 * zoom + 1.1);
  for (const [i, j] of SKY_LINKS) {
    const a = figure[i], b = figure[j];
    const k = 0.85 + 0.15 * (near(a.d) + near(b.d)) / 2;
    draws.push({ d: Math.min(a.d, b.d) - 1e-3, draw: () => {
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(${LINE_DEEP}, ${(k * (0.95 - 0.2 * night)).toFixed(3)})`;
      g.lineWidth = wDeep;
      g.beginPath(); g.moveTo(a.p[0], a.p[1]); g.lineTo(b.p[0], b.p[1]); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${LINE_PALE}, ${((0.3 + 0.6 * night) * k).toFixed(3)})`;
      g.lineWidth = wDeep * 0.45;
      g.beginPath(); g.moveTo(a.p[0], a.p[1]); g.lineTo(b.p[0], b.p[1]); g.stroke();
    } });
  }

  // The stars of the figure, each twinkling on its own beat.
  figure.forEach((q, i) => {
    const flare = starFlare(t, i);
    const n = near(q.d);
    draws.push({ d: q.d, draw: () => drawStar(q.p, starR(SKY_STARS[i][3], zoom) * (0.82 + 0.3 * n), flare, 1 - n, STAR_INK(i), ((i % 3) - 1) * 0.1) });
  });
  // And the loose ones, which come out after dark.
  if (night > 0.02) {
    dust.forEach((q, i) => {
      const r = starR(SKY_DUST[i][3], zoom) * 0.5;
      draws.push({ d: q.d, draw: () => {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255, 236, 190, ${(0.9 * Math.sqrt(Math.max(0, (night - 0.02) / 0.98))).toFixed(3)})`;
        g.save(); g.translate(q.p[0], q.p[1]); star(g, r * 1.8, r * 1.3); g.fill(); g.restore();
      } });
    });
  }

  draws.sort((p, q) => p.d - q.d);
  for (const it of draws) it.draw();
  g.restore();
}

/**
 * Where the night is taken back off the stars over an altar: a soft hole in
 * the wash at each star of the figure, as big as its light, and a wide faint
 * one round the whole -- in pixels, on the same screen as `drawSky`.
 */
export function skyHoles(sx: number, sy: number, zoom: number, view: PieceView, t: number): Array<{ x: number; y: number; r: number; a: number }> {
  const { at, mid, figure, dust, unit, onRing, beads, motes } = skyAt(view, zoom, sx, sy, t);
  const [cx, cy] = at(0, 0, mid + 0.6);
  const out = [
    ...motes.map((m) => ({ x: m.p[0], y: m.p[1], r: 3 * zoom, a: 0.85 })),
    ...beads.map((b) => ({ x: b.p[0], y: b.p[1], r: 1.6 * zoom, a: 0.5 })),
    { x: cx, y: cy, r: unit * 12, a: 0.15 },
    ...figure.map((q, i) => ({ x: q.p[0], y: q.p[1], r: starR(SKY_STARS[i][3], zoom) * 3, a: 0.9 })),
    ...dust.map((q) => ({ x: q.p[0], y: q.p[1], r: starR(1.3, zoom) * 0.9, a: 0.7 })),
  ];
  // And along the lines, every few pixels, so they keep their violet rather than going grey under the wash.
  const wDeep = Math.max(1.8, 0.5 * zoom + 1.1);
  for (const [i, j] of SKY_LINKS) {
    const [ax, ay] = figure[i].p, [bx, by] = figure[j].p;
    const n = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / 4));
    for (let k = 1; k < n; k++) out.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, r: wDeep * 2, a: 0.35 });
  }
  // And round the ring, close enough that it runs as one line rather than a dotted one.
  const around = Math.max(24, Math.ceil((TAU * RING_R * unit) / (2 * zoom)));
  for (let j = 0; j < around; j++) {
    const q = onRing((j / around) * TAU);
    out.push({ x: q.p[0], y: q.p[1], r: 2 * zoom, a: 0.3 });
  }
  return out;
}
