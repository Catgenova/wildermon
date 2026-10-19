import { DEG, TAU, type LegSpec, type QuadPose, type QuadSpec } from './beasts';
import type { V3 } from './figure';

/** Legs set by where the feet go, for any kind that wants them. */

export const scale3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/* ---- legs set by where the feet go ------------------------------------------------ */

/**
 * The swing and the fold (`QuadPose.legs`) that put a leg's ankle at a point
 * in the body's own frame, `y` forward and `z` up: the knee forward of the
 * line from hip to ankle, as a hind leg bends, or with `elbow` behind it, as
 * a fore leg does. A point out of reach gets the leg straight at it.
 */
export function legTo(s: LegSpec, y: number, z: number, elbow = false): [number, number] {
  const rest = s.rest ?? [0, 0, 0], folds = s.fold ?? [45, 75];
  const L0 = s.len[0], L1 = s.len[1];
  const dy = y - s.at[1], dz = z - s.at[2];
  const d = Math.min(L0 + L1 - 1e-3, Math.max(Math.abs(L0 - L1) + 1e-3, Math.hypot(dy, dz)));
  const knee = Math.acos(Math.max(-1, Math.min(1, (L0 * L0 + d * d - L1 * L1) / (2 * L0 * d))));
  const a1 = Math.atan2(dy, -dz) + (elbow ? -knee : knee);
  const ky = s.at[1] + L0 * Math.sin(a1), kz = s.at[2] - L0 * Math.cos(a1);
  let a2 = Math.atan2(y - ky, kz - z) - a1;
  while (a2 > Math.PI) a2 -= TAU;
  while (a2 < -Math.PI) a2 += TAU;
  const sw = a1 / DEG - rest[0];
  return [sw, (rest[1] - a2 / DEG) / lerp(folds[0], folds[1], Math.min(1, Math.abs(sw) / 40))];
}

/**
 * Every foot flat on the ground, the fore paws `fore` ahead of the body's
 * bone and the hind feet `hind`, under a body `high` over the ground at the
 * pitch it is posed at: each leg set to reach its foot (`legTo`), laid over
 * the pose by `k`.
 */
export function planted(s: QuadSpec, p: QuadPose, high: number, fore: number, hind: number, k: number): void {
  const P = p.pitch * DEG, cp = Math.cos(P), sp = Math.sin(P);
  for (let i = 0; i < 4; i++) {
    const leg = i < 2 ? s.fore : s.hind, y = i < 2 ? fore : hind, z = leg.len[2] - high;
    const [sw, fold] = legTo(leg, y * cp + z * sp, -y * sp + z * cp, i < 2);
    p.legs[i] = [lerp(p.legs[i][0], sw, k), lerp(p.legs[i][1], fold, k), p.legs[i][2] * (1 - k)];
    p.foot[i] = lerp(p.foot[i], -(leg.rest?.[2] ?? 0), k);
  }
  p.lift *= 1 - k;
}
