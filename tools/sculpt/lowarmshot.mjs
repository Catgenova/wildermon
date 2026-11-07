// The low-poly arm's reference sheet (tools/sculpt/ARM_SPEC.md, ARM_SPEC_FEMALE.md): the arm from tools/sculpt/lowarm.mjs
// laid out as its reference sheet: the arm's five views and the hand's five through their fitted cameras
// (tools/sculpt/lowacams.json, tools/sculpt/lowafit.mjs), the hand's topology back and palm, the arm's topology laid flat
// (her sheet's), the colour-coded arm, the labels; and the full body's front view (head, torso and both arms) on the
// full-body reference's own grid.
//
//   node tools/sculpt/lowarmshot.mjs --who male|female --out /some/dir [--ids]
//     writes <dir>/sheet-arm-<who>.png and <dir>/body-arm-<who>.png; --ids also <dir>/ids-arm-<who>.bin (per view of
//     the sheet, the polygon nearest the viewer at each sheet pixel, for tools/sculpt/lowashape.py)
//
// Flat shading: one normal per polygon, the heads' shared light fitted to their references (tools/sculpt/
// lowlight-<who>.json, fixed to the camera), the soft gradient over each facet; not tuned for the arm (the body will be
// repainted). Playwright's Chromium with software GL, as tools/sculpt/lowshot.mjs.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildLowArm, buildHandAlone, buildArmBody, WRIST } from './lowarm.mjs';
import { rotation } from './lowcam.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const who = opt('who', 'male');
const out = resolve(opt('out', 'tmp/lowarm'));
mkdirSync(out, { recursive: true });
const F = who === 'female';
const DIR = new URL('.', import.meta.url).pathname;
const CAMS = JSON.parse(readFileSync(join(DIR, 'lowacams.json'), 'utf8'))[who];
const BODY_CAM = { male: { yaw: 0, pitch: 0, roll: 0, s: 128, cx: 433, cy: 322, piv: [0, 0, 0] }, female: { yaw: 0, pitch: 0, roll: 0, s: 124, cx: 437, cy: 328, piv: [0, 0, 0] } }[who];

const arm = buildLowArm(who);
const mean = (V, names) => [0, 1, 2].map((k) => names.reduce((a, n) => a + V[n][k], 0) / names.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const STUB = Math.hypot(...sub(mean(arm.V, ['nb0', 'nb4', 'np0', 'np4']), mean(arm.V, WRIST))) * (F ? 0.29 : 0.26);
const hand = buildHandAlone(who, null, STUB);
const body = buildArmBody(who);
console.log(who, 'arm', JSON.stringify(arm.counts), 'hand alone', hand.tris.length, 'body', body.tris.length);

/** A camera's rotation, world to view, column-major for GL: yaw and pitch as the heads', then the roll. */
function camR(c) {
  const r = rotation(c), a = ((c.roll ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const m = [ca * r[0] - sa * r[3], ca * r[1] - sa * r[4], ca * r[2] - sa * r[5], sa * r[0] + ca * r[3], sa * r[1] + ca * r[4], sa * r[2] + ca * r[5], r[6], r[7], r[8]];
  return m; // row-major
}
const colMajor = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
function project(p, c) {
  const m = camR(c), d = sub(p, c.piv);
  return [c.cx + c.s * (m[0] * d[0] + m[1] * d[1] + m[2] * d[2]), c.cy - c.s * (m[3] * d[0] + m[4] * d[1] + m[5] * d[2]), m[6] * d[0] + m[7] * d[1] + m[8] * d[2]];
}
/** A camera turned as c, scaled and placed so the mesh fills the box (x0, y0, x1, y1) with a margin. */
function fitInto(mesh, c, box, margin = 0.06) {
  const t = { ...c, s: 1, cx: 0, cy: 0 };
  const used = [...new Set(mesh.polys.flatMap((p) => p.v))];
  const P = used.map((i) => project(mesh.verts[i], t));
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const s = Math.min((box[2] - box[0]) / w, (box[3] - box[1]) / h) * (1 - 2 * margin);
  return { ...c, s, cx: (box[0] + box[2]) / 2 - s * (Math.min(...xs) + Math.max(...xs)) / 2, cy: (box[1] + box[3]) / 2 - s * (Math.min(...ys) + Math.max(...ys)) / 2 };
}

// one buffer per mesh: each triangle's three corners, the polygon's normal, its region and colour jitter, its centre
const REG = { deltoid: 0, upper: 1, forearm: 2, hand: 3, shoulder: 0, chest: 1, abdomen: 2, pelvis: 3, skull: 0, face: 1, neck: 2 };
function buffers(mesh) {
  const polyN = mesh.polys.map((p) => {
    const pts = p.v.map((k) => mesh.verts[k]); let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
    const l = Math.hypot(...n) || 1; return n.map((x) => x / l);
  });
  const tri = [];
  for (const t of mesh.tris) {
    const n = polyN[t.poly], mat = t.mat === 'skin' || !t.mat ? 0 : 1;
    for (const k of t.v) tri.push(...mesh.verts[k], ...n, REG[t.region] ?? 0, mat, ((t.poly * 2654435761) % 1000) / 1001);
  }
  const lines = [], seen = new Set();
  for (const p of mesh.polys) for (let i = 0; i < p.v.length; i++) {
    const a = p.v[i], b = p.v[(i + 1) % p.v.length], k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(k)) continue; seen.add(k); lines.push(...mesh.verts[a], ...mesh.verts[b]);
  }
  return { tri, lines };
}
const LIGHT_FILE = new URL(`./lowlight-${who}.json`, import.meta.url);
const LIGHT = existsSync(LIGHT_FILE) ? JSON.parse(readFileSync(LIGHT_FILE, 'utf8')) : null;
const SH = LIGHT ? (() => { const C = LIGHT.global, o = new Array(57).fill(0); for (let k = 0; k < C[0].length; k++) for (let ch = 0; ch < 3; ch++) o[k * 3 + ch] = C[ch][k] / 255; return o; })() : null;

// the sheet's layout, per sex: where the panels past the views sit (the reference's own places)
const L = F
  ? { htopo: [[830, 526, 937, 689], [981, 526, 1083, 689]], atopo: [[705, 805, 1068, 890], [705, 895, 1068, 975]], regions: [1375, 50, 1505, 456],
      pills: { arm: 445, hand: 716, htopo: 717 }, title: ['Female Arm Reference', '(Stylized Low-Poly)'] }
  : { htopo: [[905, 664, 1045, 908], [1070, 664, 1206, 908]], atopo: null, regions: [1380, 60, 1500, 524],
      pills: { arm: 546, hand: 950, htopo: 941 }, title: ['Arm Reference', '(Full Arm)'] };
const views = [];
const A = buffers(arm), H = buffers(hand), Bd = buffers(body);
for (const v of ['front', 'q3', 'profile', 'r3', 'back']) views.push({ mesh: 'arm', cam: CAMS[v], name: v });
for (const v of ['hback', 'hq3', 'hprofile', 'hr3', 'hpalm']) views.push({ mesh: 'hand', cam: CAMS[v], name: v });
L.htopo.forEach((box, i) => views.push({ mesh: 'hand', cam: fitInto(hand, CAMS[i ? 'hpalm' : 'hback'], box, 0.03), wire: true }));
if (L.atopo) L.atopo.forEach((box, i) => views.push({ mesh: 'arm', cam: fitInto(arm, { ...CAMS[i ? 'back' : 'front'], roll: (CAMS[i ? 'back' : 'front'].roll ?? 0) + (i ? 90 : -90) }, box, 0.02), wire: true }));
views.push({ mesh: 'arm', cam: fitInto(arm, CAMS.front, L.regions, 0.02), mode: 1 });
for (const v of views) v.R = colMajor(camR(v.cam));
const bodyView = { mesh: 'body', cam: BODY_CAM, R: colMajor(camR(BODY_CAM)) };

// --ids: per view of the sheet (the arm's five, the hand's five) the polygon nearest the viewer at each sheet pixel
if (args.includes('--ids')) {
  const W = 1536, Hh = 1024, list = views.slice(0, 10);
  const buf = new Int16Array(list.length * W * Hh).fill(-1);
  list.forEach((v, vi) => {
    const mesh = v.mesh === 'arm' ? arm : hand, depth = new Float32Array(W * Hh).fill(-1e9);
    for (const t of mesh.tris) {
      const pr = t.v.map((i) => project(mesh.verts[i], v.cam));
      const area = (pr[1][0] - pr[0][0]) * (pr[2][1] - pr[0][1]) - (pr[1][1] - pr[0][1]) * (pr[2][0] - pr[0][0]);
      if (Math.abs(area) < 1e-9) continue;
      const minx = Math.max(0, Math.floor(Math.min(...pr.map((p) => p[0])))), maxx = Math.min(W - 1, Math.ceil(Math.max(...pr.map((p) => p[0]))));
      const miny = Math.max(0, Math.floor(Math.min(...pr.map((p) => p[1])))), maxy = Math.min(Hh - 1, Math.ceil(Math.max(...pr.map((p) => p[1]))));
      for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
        const x = i + 0.5, y = j + 0.5;
        const b0 = ((pr[1][0] - x) * (pr[2][1] - y) - (pr[1][1] - y) * (pr[2][0] - x)) / area;
        const b1 = ((pr[2][0] - x) * (pr[0][1] - y) - (pr[2][1] - y) * (pr[0][0] - x)) / area;
        const b2 = 1 - b0 - b1;
        if (b0 < 0 || b1 < 0 || b2 < 0) continue;
        const z = b0 * pr[0][2] + b1 * pr[1][2] + b2 * pr[2][2], k = j * W + i;
        if (z > depth[k]) { depth[k] = z; buf[vi * W * Hh + k] = t.poly; }
      }
    }
  });
  writeFileSync(join(out, `ids-arm-${who}.bin`), Buffer.from(buf.buffer));
}

const DATA = { A, H, B: Bd, views, bodyView, SH, grad: F ? 0.05 : -0.05, title: L.title, pills: L.pills, cams: CAMS, female: F,
  counts: { arm: arm.counts.arm + arm.counts.cap, joined: arm.counts.arm, hand: arm.counts.hand },
  budget: F ? '≈ 180 – 320 tris' : '≈ 200 – 350 tris', htopo: L.htopo, atopo: L.atopo, regions: L.regions };

const PAGE = (w, h) => String.raw`<!doctype html><html><head><style>
html,body{margin:0;background:#3e3335}
#sheet{position:relative;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,sans-serif;color:#efe2d6;
  background:radial-gradient(ellipse at 50% 45%,#41353a 0%,#3d3235 55%,#372d30 100%)}
canvas{position:absolute;left:0;top:0;width:${w}px;height:${h}px}
.pill{position:absolute;transform:translateX(-50%);border:1.5px solid rgba(214,190,172,.62);border-radius:9px;
  background:rgba(82,68,68,.55);padding:3px 14px 4px;font-size:16px;white-space:nowrap;color:#f3e8de;text-align:center}
.h{position:absolute;font-weight:600;font-size:24px;color:#f4dccb}
.lg{position:absolute;font-size:18px;color:#f1e6dc}
.rule{position:absolute;background:rgba(206,184,168,.42)}
</style></head><body><div id=sheet><canvas id=gl></canvas><div id=ui></div></div></body></html>`;

const RENDER = String.raw`
const D = window.DATA, dpr = window.devicePixelRatio, W = window.SW, Hh = window.SH;
const cv = document.getElementById('gl'); cv.width = W * dpr; cv.height = Hh * dpr;
const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
const vs = 'attribute vec3 p; attribute vec3 n; attribute vec3 m; uniform mat3 R; uniform vec3 piv; uniform vec2 sc; uniform vec2 off; uniform float lift; varying vec3 vn; varying vec3 vm; varying vec3 vq;' +
  'void main(){ vec3 q = R*(p - piv); vn = R*n; vm = m; vq = q; gl_Position = vec4(off + sc*q.xy, -q.z/12.0 - lift, 1.0); }';
const fs = 'precision highp float; varying vec3 vn; varying vec3 vm; varying vec3 vq; uniform int mode; uniform vec3 linec; uniform vec3 SHC[19]; uniform float useSH; uniform vec3 cen;' +
  'void main(){ if (mode == 2) { gl_FragColor = vec4(linec, 1.0); return; }' +
  ' vec3 nn = normalize(vn); if (!gl_FrontFacing) nn = -nn;' +
  ' if (mode == 1) { float r = vm.x; vec3 rc = r < 0.5 ? vec3(0.66,0.64,0.65) : (r < 1.5 ? vec3(0.91,0.75,0.57) : (r < 2.5 ? vec3(0.86,0.63,0.50) : vec3(0.78,0.53,0.52)));' +
  '   float l = 0.82 + 0.18*max(dot(nn, normalize(vec3(-0.4,0.5,0.8))),0.0); gl_FragColor = vec4(rc*l,1.0); return; }' +
  ' vec3 Lg = normalize(vec3(0.45,0.55,0.7)); vec3 tg = Lg - nn*dot(nn,Lg); float grad = 1.0 + ' + D.grad.toFixed(2) + '*dot(vq - cen, tg);' +
  ' float jit = vm.z - 0.5; vec3 base = vec3(0.68, 0.49, 0.41)*(1.0 + jit*0.02);' +
  ' float x = nn.x, y = nn.y, z = nn.z; vec3 c;' +
  ' if (useSH > 0.5) { c = SHC[0] + SHC[1]*x + SHC[2]*y + SHC[3]*z + SHC[4]*x*y + SHC[5]*y*z + SHC[6]*(3.0*z*z-1.0) + SHC[7]*x*z + SHC[8]*(x*x-y*y)' +
  '   + SHC[9]*y*(3.0*x*x-y*y) + SHC[10]*x*y*z + SHC[11]*y*(5.0*z*z-1.0) + SHC[12]*z*(5.0*z*z-3.0) + SHC[13]*x*(5.0*z*z-1.0) + SHC[14]*z*(x*x-y*y) + SHC[15]*x*(x*x-3.0*y*y)' +
  '   + SHC[16]*pow(max(dot(nn, normalize(vec3(-0.95,0.25,-0.2))),0.0),8.0) + SHC[17]*max(-x,0.0)*pow(1.0-max(z,0.0),3.0) + SHC[18]*max(x,0.0)*pow(1.0-max(z,0.0),3.0); c *= base/vec3(0.68,0.49,0.41); }' +
  ' else c = base*(0.6 + 0.45*max(dot(nn, normalize(vec3(-0.15,0.9,0.84))),0.0) + 0.25*max(dot(nn, normalize(vec3(1.0,0.45,0.05))),0.0));' +
  ' gl_FragColor = vec4(c*grad*1.03, 1.0); }';
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
const U = (n) => gl.getUniformLocation(pr, n);
const AL = { p: gl.getAttribLocation(pr, 'p'), n: gl.getAttribLocation(pr, 'n'), m: gl.getAttribLocation(pr, 'm') };
const buf = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return { b, n: arr.length }; };
const M = {}; for (const k of window.MESHES) M[k] = { t: buf(D[k === 'arm' ? 'A' : k === 'hand' ? 'H' : 'B'].tri), l: buf(D[k === 'arm' ? 'A' : k === 'hand' ? 'H' : 'B'].lines) };
gl.uniform1f(U('useSH'), D.SH ? 1 : 0); if (D.SH) gl.uniform3fv(U('SHC'), D.SH);
gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
function view(v) {
  const c = v.cam, m = M[v.mesh];
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix3fv(U('R'), false, v.R); gl.uniform3fv(U('piv'), c.piv); gl.uniform3fv(U('cen'), [0, 0, 0]);
  gl.uniform2f(U('sc'), 2 * c.s / W, 2 * c.s / Hh); gl.uniform2f(U('off'), c.cx / (W / 2) - 1, 1 - c.cy / (Hh / 2));
  gl.uniform1i(U('mode'), v.mode ?? 0); gl.uniform1f(U('lift'), 0);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.t.b);
  for (const k of [AL.p, AL.n, AL.m]) gl.enableVertexAttribArray(k);
  gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(AL.n, 3, gl.FLOAT, false, 36, 12); gl.vertexAttribPointer(AL.m, 3, gl.FLOAT, false, 36, 24);
  gl.drawArrays(gl.TRIANGLES, 0, m.t.n / 9);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if (v.wire) {
    gl.uniform1i(U('mode'), 2); gl.uniform3fv(U('linec'), [0.99, 0.93, 0.86]);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.l.b); gl.disableVertexAttribArray(AL.n); gl.disableVertexAttribArray(AL.m);
    gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 12, 0); gl.uniform1f(U('lift'), 0.002);
    for (const [dx, dy] of [[0, 0], [0.6, 0], [0, 0.6]]) { gl.uniform2f(U('off'), (c.cx + dx / dpr) / (W / 2) - 1, 1 - (c.cy + dy / dpr) / (Hh / 2)); gl.drawArrays(gl.LINES, 0, m.l.n / 3); }
  }
}
for (const v of window.VIEWS) view(v);
const ui = document.getElementById('ui');
const el = (cls, css, html) => { const e = document.createElement('div'); e.className = cls; e.style.cssText = css; if (html != null) e.innerHTML = html; ui.appendChild(e); return e; };
if (window.SHEET) {
  el('h', 'left:34px;top:6px;font-size:30px', D.title[0]); el('lg', 'left:36px;top:42px', D.title[1]);
  const names = ['Front (0°)', 'Three-Quarter (45°)', 'Profile (90°)', 'Rear Three-Quarter (135°)', 'Back (180°)'];
  ['front', 'q3', 'profile', 'r3', 'back'].forEach((v, i) => el('pill', 'left:' + D.cams[v].cx + 'px;top:' + D.pills.arm + 'px', names[i]));
  const hn = ['Back<br>(0°)', 'Three-Quarter<br>(45°)', 'Profile<br>(90°)', 'Three-Quarter<br>(135°)', 'Palm<br>(180°)'];
  ['hback', 'hq3', 'hprofile', 'hr3', 'hpalm'].forEach((v, i) => el('pill', 'left:' + D.cams[v].cx + 'px;top:' + D.pills.hand + 'px', hn[i]));
  D.htopo.forEach((b, i) => el('pill', 'left:' + (b[0] + b[2]) / 2 + 'px;top:' + D.pills.htopo + 'px', i ? 'Palm' : 'Back'));
  el('h', 'left:1080px;top:' + (D.female ? 216 : 262) + 'px;font-size:22px', 'Target Geometry');
  el('lg', 'left:1090px;top:' + (D.female ? 250 : 296) + 'px', 'Arm: ' + D.budget + ' · this ' + D.counts.arm + ' (' + D.counts.joined + ' on the body)');
  el('lg', 'left:1090px;top:' + (D.female ? 276 : 322) + 'px', 'Hand: ≈ 80 – 150 tris · this ' + D.counts.hand);
}
window.READY = true;
`;

const kept = '/opt/pw-browsers/chromium';
const b = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function shoot(w, h, VIEWS, meshes, sheet, file) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent(PAGE(w, h));
  await p.evaluate(([d, V, Ms, s, ww, hh]) => { window.DATA = d; window.VIEWS = V; window.MESHES = Ms; window.SHEET = s; window.SW = ww; window.SH = hh; }, [DATA, VIEWS, meshes, sheet, w, h]);
  await p.addScriptTag({ content: RENDER });
  await p.waitForFunction('window.READY');
  await p.locator('#sheet').screenshot({ path: file });
  console.log('wrote', file);
  await p.close();
}
await shoot(1536, 1024, views, ['arm', 'hand'], true, join(out, `sheet-arm-${who}.png`));
await shoot(887, 1774, [bodyView], ['body'], false, join(out, `body-arm-${who}.png`));
await b.close();
