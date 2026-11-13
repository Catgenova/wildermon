/**
 * Both hands on one long handle reached as the clip goes (`../clip.ts` Clip.hands): the saw's, the fishing rod's and the
 * net's clips (`./saw.ts`, `./fish.ts`, `./net.ts`) key where the right fist is and which way the handle runs from it;
 * the left fist is put on the same line, `gap` body heights along it, its knuckles kept the same way.
 */
import type { EaseName, HandReach } from '../clip';
import type { Euler } from '../math';

const RAD = Math.PI / 180;
/** The way a handle runs, raised `elev` degrees over level and turned `yaw` degrees to the body's left from straight ahead. */
export const wayOf = (elev: number, yaw = 0): Euler => [Math.cos(elev * RAD) * Math.sin(yaw * RAD), Math.sin(elev * RAD), Math.cos(elev * RAD) * Math.cos(yaw * RAD)];
/** Square to it, below it (where the knuckles of a fist under it point, and what hangs from it hangs). */
export const downOf = (elev: number, yaw = 0): Euler => [Math.sin(elev * RAD) * Math.sin(yaw * RAD), -Math.cos(elev * RAD), Math.sin(elev * RAD) * Math.cos(yaw * RAD)];

/** A key of the hands: the right fist's place (body heights across, up from the ground, forward) and the handle's way. */
export interface Hold { t: number; at: Euler; elev: number; yaw?: number; ease?: EaseName; hold?: number; back?: number; left?: Euler }
/**
 * The two hands' reaches for keys of the right fist on a handle: the left `gap` body heights from it along the handle
 * (ahead of it where gap is more than nothing, behind it toward the butt where less), or where a key's `left` puts it.
 */
export function onHandle(holds: Hold[], gap: number): { r: HandReach; l: HandReach } {
  const ease = (h: Hold) => ({ ...(h.ease ? { ease: h.ease } : {}), ...(h.hold !== undefined ? { hold: h.hold } : {}), ...(h.back !== undefined ? { back: h.back } : {}) });
  const way = holds.map((h) => ({ t: h.t, v: wayOf(h.elev, h.yaw), ...ease(h) }));
  const knuckles = holds.map((h) => ({ t: h.t, v: downOf(h.elev, h.yaw), ...ease(h) }));
  const r: HandReach = { at: holds.map((h) => ({ t: h.t, v: h.at, ...ease(h) })), way: way[0].v, ways: way, knuckles };
  const l: HandReach = {
    at: holds.map((h) => { const w = wayOf(h.elev, h.yaw); return { t: h.t, v: h.left ?? [h.at[0] + w[0] * gap, h.at[1] + w[1] * gap, h.at[2] + w[2] * gap] as Euler, ...ease(h) }; }),
    way: way[0].v, ways: way, knuckles,
  };
  return { r, l };
}
