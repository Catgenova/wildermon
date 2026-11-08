// The renderer for the low-poly garments (tools/sculpt/lowgarment.mjs) on the low-poly bodies: the bodies' own flat
// shading (one normal per polygon, the heads' camera-fixed light tools/sculpt/lowlight-<who>.json, as
// tools/sculpt/lowrigshot.mjs draws them), each polygon in its material's colour, and reference images laid beside.
//
// shoot(w, h, cells, file, { texts, imgs }) — cells: { meshes: [{ P, polys, tris, col }], cam: { yaw, pitch, s, c },
// box: [x, y, w, h], label, bg }; imgs: { src (a file), crop: [x, y, w, h], box: [x, y, w, h] }.
// A polygon's colour each channel over 2 (its colour plus 2) is drawn unlit, as the game draws an emissive.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const SKIN = [0.68, 0.49, 0.41];
const shOf = (who) => {
  const C = JSON.parse(readFileSync(join(DIR, `lowlight-${who}.json`), 'utf8')).global, o = new Array(57).fill(0);
  for (let k = 0; k < C[0].length; k++) for (let ch = 0; ch < 3; ch++) o[k * 3 + ch] = C[ch][k] / 255;
  return o;
};

/** A mesh's polygon outlines as line segments (each edge once). */
export function edgesOf({ P, polys }) {
  const seen = new Set(), out = [];
  for (const v of polys) v.forEach((a, k) => { const b = v[(k + 1) % v.length], key = a < b ? a + ',' + b : b + ',' + a; if (seen.has(key)) return; seen.add(key); out.push(...P[a].map((x) => +x.toFixed(4)), ...P[b].map((x) => +x.toFixed(4))); });
  return out;
}
/** One mesh's triangles flattened for the page: position, its polygon's normal, its polygon's colour. */
export function flatMesh({ P, polys, tris, col }) {
  const pn = polys.map((v) => {
    let n = [0, 0, 0];
    for (let i = 0; i < v.length; i++) { const a = P[v[i]], b = P[v[(i + 1) % v.length]]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
    const l = Math.hypot(...n) || 1; return n.map((x) => x / l);
  });
  const out = [];
  for (const [a, b, c, pi] of tris) for (const i of [a, b, c]) out.push(...P[i].map((x) => +x.toFixed(4)), ...pn[pi].map((x) => +x.toFixed(4)), ...col[pi]);
  return out;
}

const PAGE = (w, h) => String.raw`<!doctype html><html><head><style>
html,body{margin:0;background:#2f292b}
#sheet{position:relative;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,Arial,sans-serif;color:#efe2d6;background:#362a2e}
canvas{position:absolute;left:0;top:0;width:${w}px;height:${h}px}
.lab{position:absolute;font-size:15px;color:#f1e6dc;white-space:nowrap}
.h{position:absolute;font-weight:600;font-size:20px;color:#f4dccb;white-space:nowrap}
.im{position:absolute;background-repeat:no-repeat}
</style></head><body><div id=sheet><div id=imgs></div><canvas id=gl></canvas><div id=ui></div></div></body></html>`;

const RENDER = String.raw`
const W = window.SW, Hh = window.SHH, dpr = window.devicePixelRatio;
const cv = document.getElementById('gl'); cv.width = W * dpr; cv.height = Hh * dpr;
const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
const vs = 'attribute vec3 p; attribute vec3 n; attribute vec3 m; uniform mat3 R; uniform vec3 piv; uniform float s; uniform vec2 asp; uniform float lift; varying vec3 vn; varying vec3 vm;' +
  'void main(){ vec3 q = R*(p - piv); vn = R*n; vm = m; gl_Position = vec4(q.x*s*asp.x, q.y*s*asp.y, -q.z/30.0 - lift, 1.0); }';
const fs = 'precision highp float; varying vec3 vn; varying vec3 vm; uniform vec3 SHC[19]; uniform int mode; uniform vec3 linec;' +
  'void main(){ if (mode == 1) { gl_FragColor = vec4(linec, 1.0); return; } if (vm.r > 1.5) { gl_FragColor = vec4(vm - 2.0, 1.0); return; } vec3 nn = normalize(vn); if (!gl_FrontFacing) nn = -nn; float x = nn.x, y = nn.y, z = nn.z;' +
  ' vec3 c = SHC[0] + SHC[1]*x + SHC[2]*y + SHC[3]*z + SHC[4]*x*y + SHC[5]*y*z + SHC[6]*(3.0*z*z-1.0) + SHC[7]*x*z + SHC[8]*(x*x-y*y)' +
  '   + SHC[9]*y*(3.0*x*x-y*y) + SHC[10]*x*y*z + SHC[11]*y*(5.0*z*z-1.0) + SHC[12]*z*(5.0*z*z-3.0) + SHC[13]*x*(5.0*z*z-1.0) + SHC[14]*z*(x*x-y*y) + SHC[15]*x*(x*x-3.0*y*y)' +
  '   + SHC[16]*pow(max(dot(nn, normalize(vec3(-0.95,0.25,-0.2))),0.0),8.0) + SHC[17]*max(-x,0.0)*pow(1.0-max(z,0.0),3.0) + SHC[18]*max(x,0.0)*pow(1.0-max(z,0.0),3.0);' +
  ' c *= vm/vec3(0.68,0.49,0.41); gl_FragColor = vec4(min(c, vec3(1.0)), 1.0); }';
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
const U = (n) => gl.getUniformLocation(pr, n);
const AL = { p: gl.getAttribLocation(pr, 'p'), n: gl.getAttribLocation(pr, 'n'), m: gl.getAttribLocation(pr, 'm') };
gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0);
gl.scissor(0, 0, W * dpr, Hh * dpr); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
const buf = gl.createBuffer();
function rotm(yaw, pitch) {
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const Ry = [ca, 0, -sa, 0, 1, 0, sa, 0, ca], Rx = [1, 0, 0, 0, cb, sb, 0, -sb, cb];
  const m = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m.push(Rx[i * 3] * Ry[j] + Rx[i * 3 + 1] * Ry[3 + j] + Rx[i * 3 + 2] * Ry[6 + j]);
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
for (const c of window.CELLS) {
  const [bx, by, bw, bh] = c.box;
  gl.viewport(bx * dpr, (Hh - by - bh) * dpr, bw * dpr, bh * dpr); gl.scissor(bx * dpr, (Hh - by - bh) * dpr, bw * dpr, bh * dpr);
  const bg = c.bg ?? [0.212, 0.165, 0.18]; gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix3fv(U('R'), false, rotm(c.cam.yaw, c.cam.pitch ?? 0)); gl.uniform3fv(U('piv'), c.cam.c); gl.uniform1f(U('s'), c.cam.s);
  gl.uniform2f(U('asp'), 2 / bw, 2 / bh);
  for (const k of [AL.p, AL.n, AL.m]) gl.enableVertexAttribArray(k);
  for (const m of c.meshes) {
    gl.uniform3fv(U('SHC'), window.SHS[m.who]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.a), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(AL.n, 3, gl.FLOAT, false, 36, 12); gl.vertexAttribPointer(AL.m, 3, gl.FLOAT, false, 36, 24);
    gl.uniform1i(U('mode'), 0); gl.uniform1f(U('lift'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, m.a.length / 9);
  }
  for (const m of c.meshes) {
    if (!m.e) continue;
    gl.uniform1i(U('mode'), 1); gl.uniform1f(U('lift'), 0.003); gl.uniform3fv(U('linec'), m.ec);
    gl.disableVertexAttribArray(AL.n); gl.disableVertexAttribArray(AL.m);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.e), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 12, 0);
    gl.drawArrays(gl.LINES, 0, m.e.length / 3);
    gl.enableVertexAttribArray(AL.n); gl.enableVertexAttribArray(AL.m);
  }
}
const ui = document.getElementById('ui');
const el = (cls, css, html) => { const e = document.createElement('div'); e.className = cls; e.style.cssText = css; e.innerHTML = html; ui.appendChild(e); };
for (const c of window.CELLS) if (c.label) el('lab', 'left:' + (c.box[0] + 6) + 'px;top:' + (c.box[1] + 4) + 'px', c.label);
for (const t of window.TEXTS ?? []) el(t.cls ?? 'h', t.css, t.html);
window.READY = true;
`;

const kept = '/opt/pw-browsers/chromium';
let browser = null;
/** cells: { meshes: [{ who, P, polys, tris, col }], cam, box, label, bg }. */
export async function shoot(w, h, cells, file, { texts = [], imgs = [] } = {}) {
  browser ??= await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent(PAGE(w, h));
  const data = cells.map((c) => ({ ...c, meshes: c.meshes.map((m) => ({ who: m.who ?? 'male', a: flatMesh(m), e: m.edges ? edgesOf(m) : null, ec: m.edgec ?? [0.15, 0.1, 0.1] })) }));
  const SHS = { male: shOf('male'), female: shOf('female') };
  // the references: each a crop of an image scaled into its box
  const urls = {};
  for (const im of imgs) urls[im.src] ??= 'data:image/png;base64,' + readFileSync(im.src).toString('base64');
  await p.evaluate(([C, ww, hh, tx, SH, ims, U]) => {
    window.CELLS = C; window.SW = ww; window.SHH = hh; window.TEXTS = tx; window.SHS = SH;
    const host = document.getElementById('imgs');
    for (const im of ims) {
      const [x, y, cw, ch] = im.crop, [bx, by, bw, bh] = im.box, k = Math.min(bw / cw, bh / ch);
      const e = document.createElement('div'); e.className = 'im';
      e.style.cssText = `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:#362a2e url(${U[im.src]}) no-repeat;` +
        `background-size:${im.size[0] * k}px ${im.size[1] * k}px;background-position:${-x * k + (bw - cw * k) / 2}px ${-y * k + (bh - ch * k) / 2}px`;
      host.appendChild(e);
    }
    document.getElementById('gl').style.pointerEvents = 'none';
  }, [data, w, h, texts, SHS, imgs, urls]);
  await p.addScriptTag({ content: RENDER });
  await p.waitForFunction('window.READY', null, { timeout: 180000 });
  // the canvas is drawn only in the cells' boxes: everything else stays see-through, over the references
  await p.locator('#sheet').screenshot({ path: file });
  console.log('wrote', file);
  await p.close();
}
export async function closeBrowser() { if (browser) await browser.close(); browser = null; }
export { SKIN };
