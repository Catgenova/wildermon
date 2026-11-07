// The low-poly head sheets' cameras, one per view, shared by the fitter (tools/sculpt/lowfit.mjs) and the renderer
// (tools/sculpt/lowshot.mjs). Fitted cameras are kept in tools/sculpt/lowcams.json as { who: { view: camera } }; a
// camera is { yaw, pitch (degrees: the head turned about its vertical axis, then tipped toward the viewer), s (sheet
// pixels per head unit), cx, cy (where the pivot [0, 1, 0.1] lands on the 1536x1024 sheet), f (the camera's distance
// in head units for a perspective view, 0 for orthographic), clip (the bottom view: the neck cut flat at this height) }.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const CAMS_FILE = join(new URL('.', import.meta.url).pathname, 'lowcams.json');
export const PIV = [0, 1, 0.1];
export const VIEWS = ['front', 'q3', 'profile', 'r3', 'back', 'top', 'bottom'];
export const DEFAULT_CAMS = {
  front: { yaw: 0, pitch: 0, s: 136, cx: 172, cy: 184, f: 0 },
  q3: { yaw: 45, pitch: 0, s: 136, cx: 478, cy: 184, f: 0 },
  profile: { yaw: 90, pitch: 0, s: 136, cx: 780, cy: 184, f: 0 },
  r3: { yaw: 135, pitch: 0, s: 136, cx: 1085, cy: 184, f: 0 },
  back: { yaw: 180, pitch: 0, s: 136, cx: 1388, cy: 184, f: 0 },
  top: { yaw: 0, pitch: 80, s: 140, cx: 180, cy: 730, f: 0 },
  bottom: { yaw: 0, pitch: -45, s: 140, cx: 502, cy: 726, f: 0, clip: -0.3 },
};
/** The parts each view shows (the rest show the head, the neck and the shoulders). */
export const PARTS = { top: ['head', 'neck'] };

// The torsos' sheets (tools/sculpt/lowtorso.mjs): eight views, kept in the same file under 'torso-<who>'. Their pivot
// is the torso's middle, [0, -2, 0], at sheet pixel (cx, cy); s is sheet pixels per head unit, as the heads'.
export const TORSO_PIV = [0, -2, 0];
export const TORSO_VIEWS = ['front', 'q3', 'profile', 'r3', 'back', 'top', 'bottom', 'under'];
export const TORSO_CAMS = {
  front: { yaw: 0, pitch: 0, s: 66, cx: 162, cy: 239, f: 0 },
  q3: { yaw: 35, pitch: 0, s: 66, cx: 400, cy: 239, f: 0 },
  profile: { yaw: 90, pitch: 0, s: 66, cx: 608, cy: 239, f: 0 },
  r3: { yaw: 215, pitch: 0, s: 66, cx: 818, cy: 239, f: 0 },
  back: { yaw: 180, pitch: 0, s: 66, cx: 1073, cy: 239, f: 0 },
  top: { yaw: 0, pitch: 60, s: 52, cx: 145, cy: 590, f: 0 },
  bottom: { yaw: 0, pitch: -30, s: 52, cx: 366, cy: 600, f: 0 },
  under: { yaw: -40, pitch: -30, s: 52, cx: 578, cy: 600, f: 0 },
};

/** The cameras of a head (kind 'head') or a torso ('torso'), the fitted over the defaults. */
export function loadCams(who, kind = 'head') {
  const all = existsSync(CAMS_FILE) ? JSON.parse(readFileSync(CAMS_FILE, 'utf8')) : {};
  const torso = kind === 'torso';
  const c = {};
  for (const v of torso ? TORSO_VIEWS : VIEWS) c[v] = { ...(torso ? { ...TORSO_CAMS[v], piv: TORSO_PIV } : DEFAULT_CAMS[v]), ...((torso ? all[`torso-${who}`] : all[who])?.[v] ?? {}) };
  return c;
}

/** The camera's rotation as a row-major 3x3 (yaw about y, then pitch about x). */
export function rotation(c) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return [ca, 0, sa, -sb * -sa, cb, -sb * ca, cb * -sa, sb, cb * ca];
}

/** A point's sheet position and its depth toward the viewer under a camera. */
export function project(p, c) {
  const r = rotation(c), pv = c.piv ?? PIV;
  const x = p[0] - pv[0], y = p[1] - pv[1], z = p[2] - pv[2];
  const qx = r[0] * x + r[1] * y + r[2] * z, qy = r[3] * x + r[4] * y + r[5] * z, qz = r[6] * x + r[7] * y + r[8] * z;
  const k = c.f ? c.f / (c.f - qz) : 1;
  return [c.cx + c.s * qx * k, c.cy - c.s * qy * k, qz];
}
