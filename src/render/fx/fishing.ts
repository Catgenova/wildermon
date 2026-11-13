/**
 * Fishing with a rod: the line and its float out over the water, drawn by the effects from the cast until the line is
 * reeled in (`../../sculpt/anim/clips/fish.ts` LINE_OUT; the rod's own baked line and float are left out then,
 * `FigurePose.line`), followed through the go as the clip plays it:
 *   - the cast (`CAST`): the float thrown from the rod's tip on an arc to the spot (`FLIGHT` seconds), landing with a
 *     `plop` (`./water.ts`);
 *   - the wait: the float bobbing `BOB` height units at the spot, a small ring off it (`bob`) every `BOB_RINGS` seconds;
 *     the line from the tip to it sagging as a slack line does, lying on the water short of the float;
 *   - the strike (`STRIKE`): the float jerked up out of the water (`pop`), then reeled in to the tip, the line drawn taut.
 *
 * Where the float goes: your own cast, the tile the island casts to (`castAt`, through `ActionWhere.cast`); anybody
 * else's, `AHEAD` tiles ahead of them, which is where they face.
 *
 * What came of a go is known for your own alone, from the island's word of it (`Caught: ...` / `Bite lost`), which comes
 * as the go ends, after the strike: a catch then fires `catch` at the float's spot, the fish brought out to you. A bite
 * lost is the strike's `pop` alone, which is all anybody else's ever shows.
 */
import { CAST, FISH, FISH_LEFT, LINE_OUT, REELED, STRIKE } from '../../sculpt/anim/clips/fish';
import { UNITS_PER_TILE } from '../iso';
import { TAU, arcAt, clamp, easeIn, mid3, type P3 } from '../spells/kit';
import { FOAM } from '../water';
import { hexOf, mixHex } from './material';
import type { ActionKit } from './kit';
import type { FollowFrame, FxFollower } from './types';

/** Seconds the float takes from the rod's tip to the water, and how high its arc goes over the straight way, height units. */
export const FLIGHT = 0.45;
const FLIGHT_LIFT = 8;
/** Height units the float bobs up and down at the spot, and seconds a bob. */
export const BOB = 0.35;
const BOB_SECS = 1.3;
/** Seconds between the rings off a bobbing float, at least and at most. */
export const BOB_RINGS: readonly [number, number] = [1.8, 3.6];
/** Tiles ahead of somebody else fishing their float is put. */
export const AHEAD = 2;
/** How far the slack line sags, height units for each tile from the tip to the float, and at least. */
const SAG = 1.6, SAG_LEAST = 1.2;
/** How high the float is jerked at the strike, height units. */
const POP_UP = 3;
/** Seconds after a go's line is in that the island's word of a catch is still taken as that go's. */
const TOLD_LATE = 4;
/** The float's red cap and white body, and the line's colour. */
const FLOAT_RED = '#d8463a', FLOAT_WHITE = '#f4f0e6', LINE = '#e4e2d8', INK = '#3a3038';
/** Points along the line. */
const LINE_POINTS = 12;

interface Cast { t: number; spot: P3 | null; landed: boolean; popped: boolean; nextBob: number; seen: number; was: P3 | null; caught: boolean }

export class Fishing implements FxFollower {
  private casts = new Map<string, Cast>();

  constructor(private readonly castOf: (id: string) => { x: number; y: number } | null) {}

  /** The island's word of your own go: a catch brought out at the float's spot. */
  caught(id: string): void {
    const c = this.casts.get(id);
    if (c) c.caught = true;
  }

  follow(f: FollowFrame): void {
    let c = this.casts.get(f.id);
    if (c?.caught) {
      c.caught = false;
      const at = c.spot ?? c.was;
      if (at && f.now - c.seen <= TOLD_LATE) f.fire('catch', at, { to: f.local([0, 3, 12]), key: true, seed: Math.floor(f.now * 10) });
    }
    const clip = f.fx.clip(f.pose);
    if (!clip || (clip.name !== FISH.name && clip.name !== FISH_LEFT.name)) return;
    const t = clip.t;
    if (!c || t < c.t - 0.5) {
      c = { t, spot: null, landed: false, popped: false, nextBob: 0, seen: f.now, was: c?.spot ?? c?.was ?? null, caught: false };
      this.casts.set(f.id, c);
      if (this.casts.size > 64) this.casts.delete(this.casts.keys().next().value as string);
    }
    c.t = t;
    c.seen = f.now;
    if (t < LINE_OUT[0] || t >= LINE_OUT[1]) {
      if (c.spot) c.was = c.spot;
      c.spot = null;
      c.landed = c.popped = false;
      return;
    }
    if (!f.pose.line) return;
    const tipF = f.fx.point(f.pose, { tool: 'tip' });
    if (!tipF) return;
    const tip = f.local(tipF.at);
    if (!c.spot) {
      const at = this.castOf(f.id), ahead = f.local([0, AHEAD * UNITS_PER_TILE, 0]), x = at?.x ?? ahead.x, y = at?.y ?? ahead.y;
      c.spot = { x, y, z: f.water(x, y) ?? f.body.z };
    }
    const spot = c.spot, fl = t - CAST;
    let float: P3, sag: number;
    if (fl < FLIGHT) {
      float = arcAt(tip, spot, fl / FLIGHT, FLIGHT_LIFT);
      sag = 0.3;
    } else if (t < STRIKE) {
      float = { x: spot.x, y: spot.y, z: spot.z + BOB * Math.sin(((f.now % BOB_SECS) / BOB_SECS) * TAU) };
      sag = Math.max(SAG_LEAST, SAG * Math.hypot(tip.x - spot.x, tip.y - spot.y));
    } else {
      // jerked up, then reeled in to the tip, the line taut
      const u = (t - STRIKE) / (REELED - STRIKE), up = { x: spot.x, y: spot.y, z: spot.z + POP_UP };
      float = u < 0.15 ? mid3(spot, up, u / 0.15) : mid3(up, tip, easeIn((u - 0.15) / 0.85) * 0.92);
      sag = 0.2;
    }
    if (!c.landed && fl >= FLIGHT) {
      c.landed = true;
      f.fire('plop', spot, { seed: Math.floor(f.now * 10) });
      c.nextBob = f.now + BOB_RINGS[0];
    }
    if (c.landed && t < STRIKE && f.now >= c.nextBob) {
      f.fire('bob', spot, { seed: Math.floor(f.now * 10) + 1 });
      c.nextBob = f.now + BOB_RINGS[0] + (BOB_RINGS[1] - BOB_RINGS[0]) * (Math.abs(Math.sin(f.now * 12.9898) * 43758.5453) % 1);
    }
    if (!c.popped && t >= STRIKE) {
      c.popped = true;
      f.fire('pop', spot, { key: true, seed: Math.floor(f.now * 10) + 2 });
    }
    const water = spot.z, body = f.body;
    f.draw((k) => drawLine(k, body, tip, float, sag, water));
  }

  clear(): void {
    this.casts.clear();
  }
}

/** The line from the rod's tip to the float, sagging `sag` at its middle and lying on the water where it would go under; and the float. */
function drawLine(k: ActionKit, body: import('../spells/kit').Body, tip: P3, float: P3, sag: number, water: number): void {
  const pts: P3[] = [];
  for (let i = 0; i <= LINE_POINTS; i++) {
    const u = i / LINE_POINTS, p = mid3(tip, float, u);
    pts.push({ x: p.x, y: p.y, z: Math.max(Math.min(water, p.z), p.z - 4 * sag * u * (1 - u)) });
  }
  const dim = k.night * 0.5, line = dim > 0.01 ? mixHex(LINE, '#1c2c40', dim) : LINE, zoom = k.zoom;
  const W = Math.max(0.7, 0.16 * zoom);
  // in front of the body where it comes round in front of it, behind it where it goes behind
  const { back, front } = k.aroundBody(body, pts);
  for (const [runs, bias] of [[back, -0.5], [front, 0.5]] as const) {
    for (const run of runs) {
      const xy = run.map((p) => [k.sx(p), k.sy(p)]);
      k.worldDraw({ x: body.x, y: body.y, z: body.z }, (g) => {
        g.globalAlpha = 0.9;
        g.strokeStyle = line;
        g.lineWidth = W;
        g.lineJoin = 'round';
        g.beginPath();
        xy.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.globalAlpha = 1;
      }, bias);
    }
  }
  // the float: a white body under a red cap, half in the water once it is on it
  const sx = k.sx(float), sy = k.sy(float), R = Math.max(2, 0.8 * zoom), wet = clamp((water + 0.4 - float.z) / 0.8);
  const red = dim > 0.01 ? mixHex(FLOAT_RED, '#1c2c40', dim) : FLOAT_RED, white = dim > 0.01 ? mixHex(FLOAT_WHITE, '#1c2c40', dim) : FLOAT_WHITE;
  const ring = mixHex(hexOf(FOAM), '#1c2c40', dim);
  const bias = k.eye.worldToScreenY(float.x, float.y, float.z) - k.eye.worldToScreenY(float.x, float.y, k.ground(float.x, float.y)) + 2;
  k.worldDraw(float, (g) => {
    g.lineWidth = Math.max(0.5, 0.12 * zoom);
    g.strokeStyle = INK;
    // the body, cut at the water as far as it is in
    g.save();
    if (wet > 0) {
      g.beginPath();
      g.rect(sx - 2 * R, sy - 3 * R, 4 * R, 3 * R + R * (1 - wet));
      g.clip();
    }
    g.fillStyle = white;
    g.beginPath();
    g.ellipse(sx, sy, R * 0.8, R, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = red;
    g.beginPath();
    g.ellipse(sx, sy - R * 0.25, R * 0.8, R * 0.75, 0, Math.PI, TAU);
    g.fill();
    g.restore();
    if (wet > 0) {
      // the water's edge round it
      g.globalAlpha = 0.7 * wet;
      g.strokeStyle = ring;
      g.beginPath();
      g.ellipse(sx, sy + R * (1 - wet), R * 1.4, R * 0.5, 0, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
    }
  }, bias);
}
