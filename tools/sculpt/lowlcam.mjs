// The low-poly legs' cameras (tools/sculpt/lowlegs.mjs), one per view of their reference sheets, shared by the fitter
// (tools/sculpt/lowlfit.mjs) and the renderer (tools/sculpt/lowlshot.mjs). Kept in tools/sculpt/lowlcams.json as
// { who: { sy, views: { view: camera } } }. A camera is the heads' and torsos' (tools/sculpt/lowcam.mjs: yaw, pitch, s
// sheet pixels a head unit, cx, cy where the pivot lands) with the pivot at the legs' middle; the leg sheets' views draw
// their legs shorter for their width than the full-body references do (tools/sculpt/LEGS_SPEC.md), so the sheet's views
// share one more number, sy: their vertical scale over their horizontal, the same for every view of that sheet. The
// full-body view ('body', ref/body-<who>.png) is true to proportion (sy 1).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rotation } from './lowcam.mjs';

export const LCAMS_FILE = join(new URL('.', import.meta.url).pathname, 'lowlcams.json');
/** The top row of the sheet, the full-body front, the topology panel's five. */
export const LEG_VIEWS = ['front', 'q3', 'profile', 'r3', 'back', 'body', 'tfront', 'tq3', 'tprofile', 'tr3', 'tback'];
export const PIVOT = { male: [0, -7.5, 0], female: [0, -8.4, 0] };
const row = (s, cy, xs, yaws = [0, 40, 90, 215, 180]) => Object.fromEntries(['front', 'q3', 'profile', 'r3', 'back'].map((v, i) => [v, { yaw: yaws[i], pitch: 0, s, cx: xs[i], cy }]));
// the topology panel's profile looks at the other side (its toes to the left)
const prefix = (o, p) => Object.fromEntries(Object.entries(o).map(([k, v]) => [p + k, k === 'profile' ? { ...v, yaw: -90 } : v]));
export const DEFAULTS = {
  male: { sy: 0.72, views: { ...row(49, 211, [176, 400, 620, 820, 1038]), body: { yaw: 0, pitch: 0, s: 118.4, cx: 435, cy: 1208, sy: 1 }, ...prefix(row(34, 891, [1004, 1144, 1242, 1333, 1458]), 't') } },
  female: { sy: 0.78, views: { ...row(40, 224, [156, 364, 575, 780, 961]), body: { yaw: 0, pitch: 0, s: 107, cx: 439, cy: 1240, sy: 1 }, ...prefix(row(32.5, 904, [919, 1052, 1150, 1247, 1368]), 't') } },
};

export function loadLegCams(who) {
  const all = existsSync(LCAMS_FILE) ? JSON.parse(readFileSync(LCAMS_FILE, 'utf8')) : {};
  const d = DEFAULTS[who], f = all[who] ?? {};
  const sy = f.sy ?? d.sy, cams = {};
  for (const v of LEG_VIEWS) cams[v] = { ...d.views[v], ...(f.views?.[v] ?? {}) };
  return { sy, cams };
}
export function saveLegCams(who, sy, cams) {
  const all = existsSync(LCAMS_FILE) ? JSON.parse(readFileSync(LCAMS_FILE, 'utf8')) : {};
  all[who] = { sy, views: cams };
  writeFileSync(LCAMS_FILE, JSON.stringify(all, null, 1));
}
/** A point's sheet position and its depth toward the viewer: the view's own sy if it has one (the body), else the sheet's. */
export function projectL(p, c, sy, piv) {
  const r = rotation(c);
  const x = p[0] - piv[0], y = p[1] - piv[1], z = p[2] - piv[2];
  const qx = r[0] * x + r[1] * y + r[2] * z, qy = r[3] * x + r[4] * y + r[5] * z, qz = r[6] * x + r[7] * y + r[8] * z;
  return [c.cx + c.s * qx, c.cy - c.s * (c.sy ?? sy) * qy, qz];
}
