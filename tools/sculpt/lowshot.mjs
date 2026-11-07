// The low-poly head's modeling reference sheet (tools/sculpt/HEAD_SPEC.md, HEAD_SPEC_FEMALE.md; references in
// tools/sculpt/ref): the one mesh from tools/sculpt/lowhead.mjs in seven orthographic views, its wireframe over the
// front, and a profile in its three regions, laid out as the reference sheets are.
//
//   node tools/sculpt/lowshot.mjs --who male|female --out /some/dir [--scale 2]     # writes <dir>/sheet-<who>.png
//
// Flat shading (each triangle its own normal), a cool light from the left, a warm one from the right, a front fill.
// The top and the bottom views leave the shoulder stub out, as the references do; the bottom view looks up from the
// front at --pitch degrees (default 45) so the jaw's underside and the neck read.
// Uses Playwright's Chromium at /opt/pw-browsers/chromium with software GL.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildLowHead } from './lowhead.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const who = opt('who', 'male');
const out = resolve(opt('out', 'tmp/lowhead'));
const dsf = +opt('scale', '1');
const pitch = +opt('pitch', '45');
mkdirSync(out, { recursive: true });

const mesh = buildLowHead(who);
console.log(who, 'triangles', JSON.stringify(mesh.counts), `head ${mesh.counts.head} (budget 350-700${mesh.counts.head >= 350 && mesh.counts.head <= 700 ? ', in' : ', OUT'})`);

// Flat buffers per part: each triangle its own three vertices, its normal and its material and region.
const MAT = { skin: 0, brow: 1, pupil: 2, lid: 3, lip: 4 };
const REG = { skull: 0, face: 1, neck: 2 };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const parts = {};
mesh.tris.forEach((t, i) => {
  const [a, b, c] = t.v.map((k) => mesh.verts[k]);
  const n = cross(sub(b, a), sub(c, a)); const l = Math.hypot(...n) || 1;
  const P = (parts[t.part] ??= []);
  for (const p of [a, b, c]) P.push(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, MAT[t.mat], REG[t.region], ((t.poly * 2654435761) % 1000) / 1000);
});
// The wireframe: each polygon's outline once (the quads' diagonals left out), the head and the neck and the stub.
const seen = new Set(), lines = [];
for (const p of mesh.polys) {
  if (p.mat !== 'skin' && p.mat !== 'lip') continue;
  for (let i = 0; i < p.v.length; i++) {
    const a = p.v[i], b = p.v[(i + 1) % p.v.length];
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(...mesh.verts[a], ...mesh.verts[b]);
  }
}

const female = who === 'female';
const DATA = {
  parts, lines, pitch, counts: mesh.counts,
  lid: female ? [0.16, 0.12, 0.12] : [0.36, 0.24, 0.2],
  title: female ? 'Female Head Modeling Guide' : 'Modeling Guide',
  checks: female
    ? ['Stylized low-poly head', 'Feminine proportions', 'Bald (no hair)', 'Soft, tapered jawline', 'Small, angular nose and lips', 'Game-ready topology']
    : ['Stylized low-poly head', 'Angular, faceted planes', 'Bald (no hair)', 'Strong brow and jaw', 'Simple, solid features', 'Game-ready topology'],
  legend: female ? ['Skull / Forehead', 'Face Planes', 'Neck'] : ['Forehead / Skull', 'Face Planes', 'Neck'],
};

const PAGE = String.raw`<!doctype html><html><head><style>
html,body{margin:0;background:#3e3335}
#sheet{position:relative;width:1536px;height:1024px;overflow:hidden;font-family:Inter,sans-serif;color:#efe2d6;
  background:radial-gradient(ellipse at 50% 45%,#41353a 0%,#3d3235 55%,#372d30 100%)}
canvas{position:absolute;left:0;top:0;width:1536px;height:1024px}
.pill{position:absolute;transform:translateX(-50%);border:1.5px solid rgba(214,190,172,.62);border-radius:9px;
  background:rgba(82,68,68,.55);padding:5px 22px 6px;font-size:20px;letter-spacing:.1px;white-space:nowrap;color:#f3e8de}
.rule{position:absolute;background:rgba(206,184,168,.42)}
.h{position:absolute;font-weight:600;font-size:25px;color:#f4dccb}
.chk{position:absolute;font-size:20px;color:#f1e6dc;display:flex;align-items:center;gap:14px;white-space:nowrap}
.box{width:15px;height:15px;border:1.6px solid #e8d8cc;border-radius:2px}
.sw{position:absolute;width:42px;height:30px;border-radius:5px}
.lg{position:absolute;font-size:20px;color:#f1e6dc}
</style></head><body><div id=sheet><canvas id=gl></canvas><div id=ui></div></div></body></html>`;

const RENDER = String.raw`
const D = window.DATA, dpr = window.devicePixelRatio;
const cv = document.getElementById('gl');
cv.width = 1536 * dpr; cv.height = 1024 * dpr;
const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: false });
const vs = 'attribute vec3 p; attribute vec3 n; attribute vec3 m; uniform mat3 R; uniform vec3 piv; uniform vec2 sc; uniform vec2 off; uniform float lift;' +
  'varying vec3 vn; varying vec3 vm; void main(){ vec3 q = R*(p - piv); vn = R*n; vm = m;' +
  ' gl_Position = vec4(off + sc*q.xy, -q.z/8.0 - lift, 1.0); }';
const fs = 'precision highp float; varying vec3 vn; varying vec3 vm; uniform int mode; uniform vec3 lidc; uniform vec3 linec;' +
  'void main(){ if (mode == 2) { gl_FragColor = vec4(linec, 1.0); return; }' +
  ' vec3 nn = normalize(vn); if (!gl_FrontFacing) nn = -nn;' +
  ' vec3 base = vec3(0.68, 0.49, 0.41);' +
  ' float jit = vm.z - 0.5; base *= 1.0 + jit*0.03; base.r += jit*0.01;' +
  ' if (vm.x > 0.5 && vm.x < 1.5) base = vec3(0.27, 0.17, 0.13);' +
  ' else if (vm.x > 1.5 && vm.x < 2.5) base = vec3(0.09, 0.09, 0.11);' +
  ' else if (vm.x > 2.5 && vm.x < 3.5) base = lidc;' +
  ' else if (vm.x > 3.5) base = vec3(0.56, 0.37, 0.36);' +
  ' if (mode == 1) { vec3 rc = vm.y < 0.5 ? vec3(0.62,0.60,0.60) : (vm.y < 1.5 ? vec3(0.82,0.62,0.45) : vec3(0.70,0.52,0.50));' +
  '   if (vm.x > 0.5) rc = vm.x < 2.5 ? vec3(0.2,0.16,0.15) : rc;' +
  '   float l = 0.82 + 0.18*max(dot(nn, normalize(vec3(-0.4,0.5,0.8))),0.0); gl_FragColor = vec4(rc*l,1.0); return; }' +
  ' vec3 Lk = normalize(vec3(0.15,0.2,0.97)), Lr = normalize(vec3(1.0,0.1,0.1)), Lc = normalize(vec3(-0.7,0.6,0.35));' +
  ' float dk = max(dot(nn,Lk),0.0), dr = max(dot(nn,Lr),0.0), dc = max(dot(nn,Lc),0.0);' +
  ' vec3 L = vec3(0.73 + 0.34*nn.y) + 0.25*dk*vec3(1.0,0.98,0.95) + 0.31*dr*vec3(1.04,0.98,0.86);' +
  ' vec3 c = base*L + vec3(0.08,0.38,0.78)*pow(dc,6.0)*(0.3+0.7*base.r/0.68);' +
  ' gl_FragColor = vec4(c, 1.0); }';
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
const U = (n) => gl.getUniformLocation(pr, n);
const A = { p: gl.getAttribLocation(pr, 'p'), n: gl.getAttribLocation(pr, 'n'), m: gl.getAttribLocation(pr, 'm') };
const buf = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return { b, n: arr.length }; };
const B = {}; for (const k in D.parts) B[k] = buf(D.parts[k]);
const LB = buf(D.lines);
gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
gl.uniform3fv(U('lidc'), D.lid);
const yaw = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
const pitchM = (d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
function drawMesh(part) {
  const b = B[part]; if (!b) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, b.b);
  gl.enableVertexAttribArray(A.p); gl.enableVertexAttribArray(A.n); gl.enableVertexAttribArray(A.m);
  gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 36, 12); gl.vertexAttribPointer(A.m, 3, gl.FLOAT, false, 36, 24);
  gl.drawArrays(gl.TRIANGLES, 0, b.n / 9);
}
/** One view: R (column-major mat3) about the pivot, the pivot at (cx, cy) css px, s px per unit. */
function view({ R, cx, cy, s, piv = [0, 1, 0.1], parts = ['head', 'neck', 'shoulders'], mode = 0, wire = false }) {
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix3fv(U('R'), false, R); gl.uniform3fv(U('piv'), piv);
  gl.uniform2f(U('sc'), 2 * s / 1536, 2 * s / 1024); gl.uniform2f(U('off'), cx / 768 - 1, 1 - cy / 512);
  gl.uniform1i(U('mode'), mode); gl.uniform1f(U('lift'), 0);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
  for (const p of parts) drawMesh(p);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if (wire) {
    gl.uniform1i(U('mode'), 2); gl.uniform3fv(U('linec'), [0.99, 0.93, 0.86]);
    gl.bindBuffer(gl.ARRAY_BUFFER, LB.b);
    gl.disableVertexAttribArray(A.n); gl.disableVertexAttribArray(A.m);
    gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 12, 0);
    gl.uniform1f(U('lift'), 0.0015);
    for (const [dx, dy] of [[0, 0], [0.6, 0], [0, 0.6]]) {
      gl.uniform2f(U('off'), (cx + dx / dpr * 1.2) / 768 - 1, 1 - (cy + dy / dpr * 1.2) / 512);
      gl.drawArrays(gl.LINES, 0, LB.n / 3);
    }
  }
}
const S = 136;
const ROW = [['Front (0°)', 0, 172], ['Three-Quarter (45°)', 45, 478], ['Profile (90°)', 90, 780], ['Rear Three-Quarter (135°)', 135, 1085], ['Back (180°)', 180, 1388]];
for (const [, d, cx] of ROW) view({ R: yaw(d), cx, cy: 184, s: S });
view({ R: pitchM(90), cx: 180, cy: 735, s: S * 0.98, piv: [0, 1, 0.12], parts: ['head', 'neck'] });
view({ R: pitchM(-D.pitch), cx: 502, cy: 730, s: S * 0.98, piv: [0, 0.75, 0.12], parts: ['head', 'neck'] });
view({ R: yaw(0), cx: 822, cy: 686, s: S * 0.99, wire: true });
view({ R: yaw(90), cx: 1395, cy: 685, s: 96, mode: 1, parts: ['head', 'neck'], piv: [0, 1, 0.1] });

const ui = document.getElementById('ui');
const el = (cls, css, html) => { const e = document.createElement('div'); e.className = cls; e.style.cssText = css; if (html != null) e.innerHTML = html; ui.appendChild(e); return e; };
for (const [label, , cx] of ROW) el('pill', 'left:' + cx + 'px;top:462px', label);
el('pill', 'left:180px;top:928px', 'Top'); el('pill', 'left:502px;top:928px', 'Bottom');
el('rule', 'left:31px;top:524px;width:1474px;height:1.5px');
el('rule', 'left:674px;top:560px;width:1.5px;height:392px');
el('h', 'left:998px;top:556px', D.title);
D.checks.forEach((t, i) => el('chk', 'left:1002px;top:' + (607 + i * 34) + 'px', '<span class=box></span>' + t));
el('rule', 'left:1002px;top:824px;width:238px;height:1.5px');
el('h', 'left:1002px;top:843px;font-size:22px', 'Target Geometry');
el('lg', 'left:1002px;top:880px;font-size:21px', '≈ 350 – 700 triangles');
el('lg', 'left:1002px;top:914px;font-size:16px;color:#cdb9ab', 'this head ' + D.counts.head + ' · neck ' + D.counts.neck + ' · stub ' + D.counts.shoulders);
const SW = ['#9e9999', '#d1a07a', '#b48683'];
D.legend.forEach((t, i) => { el('sw', 'left:1288px;top:' + (840 + i * 37) + 'px;background:' + SW[i]); el('lg', 'left:1346px;top:' + (842 + i * 37) + 'px', t); });
window.READY = true;
`;

const kept = '/opt/pw-browsers/chromium';
const b = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: dsf });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => console.log('console', m.text()));
await p.setContent(PAGE);
await p.evaluate((d) => { window.DATA = d; }, DATA);
await p.addScriptTag({ content: RENDER });
await p.waitForFunction('window.READY');
await p.evaluate(() => document.fonts.ready);
const file = join(out, `sheet-${who}.png`);
await p.locator('#sheet').screenshot({ path: file });
console.log('wrote', file);
await b.close();
