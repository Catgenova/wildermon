// The renderer for the low-poly hair (tools/sculpt/lowhair.mjs) on the low-poly bodies, after
// tools/sculpt/lowgarmentshot.mjs (sculpt-cloth): the bodies' own flat shading (one normal per polygon, the heads'
// camera-fixed light tools/sculpt/lowlight-<who>.json, as tools/sculpt/lowrigshot.mjs draws them), each polygon in its
// own colour, reference crops laid beside. A polygon whose colour is negative is hair: drawn in three tones of that
// colour (main, mid, highlight) by how much light its facet takes (HAIR_RAMP, against the skin's), as the game draws it;
// one in a valley (its red under -VALLEY_MARK times its step) in that step's tone however lit (HAIR_VALLEYS).
//
// shoot(w, h, cells, file, { texts, imgs }) — cells: { meshes: [{ who, P, polys, tris, col, edges?, edgec?, flat? }],
// cam: { yaw, pitch, s, c }, box: [x, y, w, h], label, bg }; imgs: { src, size: [w, h], crop: [x, y, w, h], box }.
/** The facet's light (its shade over the skin's, by luminance) where the hair steps from its main tone to the mid and
 * from the mid to the highlight; within a tone the facet is lit a little by that light (RAMPK, about the tone's middle),
 * so two facets of one tone still part. */
export const HAIR_RAMP = [1.15, 1.4];
/** The mid tone and the highlight: the hair's colour this far toward a warm light (#ffc8aa), from the sheet's palette. */
export const HAIR_TONES = [0.22, 0.45];
/** The valleys' tones (the floor of a groove between two tufts and under the lifted fronts: tools/sculpt/lowhair.mjs
 * shadeOf, its step the darkest first): the hair's colour times these however lit (the sheet's grooves, about 0.6 to 0.8
 * of its main brown); the game's own numbers (src/sculpt/gl.ts HAIR_VALLEYS), read from there. */
export const HAIR_VALLEYS = JSON.parse(readFileSync(new URL('../../src/sculpt/gl.ts', import.meta.url), 'utf8').match(/export const HAIR_VALLEYS = (\[[\d., ]+\]);/)[1]);
const VALLEY_MARK = 10;
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
const fs = 'precision highp float; varying vec3 vn; varying vec3 vm; uniform vec3 SHC[19]; uniform int mode; uniform vec3 linec; uniform vec2 RAMP; uniform float ALPHA; const float RAMPK = 0.45; const float HAIR_MID = ${HAIR_TONES[0].toFixed(3)}; const float HAIR_HI = ${HAIR_TONES[1].toFixed(3)}; const float V1 = ${HAIR_VALLEYS[0].toFixed(3)}, V2 = ${HAIR_VALLEYS[1].toFixed(3)}, V3 = ${HAIR_VALLEYS[2].toFixed(3)}, V4 = ${HAIR_VALLEYS[3].toFixed(3)};' +
  'void main(){ if (mode == 1) { gl_FragColor = vec4(linec, 1.0); return; } vec3 nn = normalize(vn); if (!gl_FrontFacing) nn = -nn; float x = nn.x, y = nn.y, z = nn.z;' +
  ' vec3 c = SHC[0] + SHC[1]*x + SHC[2]*y + SHC[3]*z + SHC[4]*x*y + SHC[5]*y*z + SHC[6]*(3.0*z*z-1.0) + SHC[7]*x*z + SHC[8]*(x*x-y*y)' +
  '   + SHC[9]*y*(3.0*x*x-y*y) + SHC[10]*x*y*z + SHC[11]*y*(5.0*z*z-1.0) + SHC[12]*z*(5.0*z*z-3.0) + SHC[13]*x*(5.0*z*z-1.0) + SHC[14]*z*(x*x-y*y) + SHC[15]*x*(x*x-3.0*y*y)' +
  '   + SHC[16]*pow(max(dot(nn, normalize(vec3(-0.95,0.25,-0.2))),0.0),8.0) + SHC[17]*max(-x,0.0)*pow(1.0-max(z,0.0),3.0) + SHC[18]*max(x,0.0)*pow(1.0-max(z,0.0),3.0);' +
  ' if (mode == 2) { gl_FragColor = vec4(abs(vm), ALPHA); return; }' +
  ' if (vm.x < 0.0) { vec3 hc = -vm; float step = floor((hc.x + ${VALLEY_MARK / 2}.0) / ${VALLEY_MARK}.0); bool valley = step > 0.5; hc.x -= step * ${VALLEY_MARK}.0;' +
  '   float vt = step < 1.5 ? V1 : (step < 2.5 ? V2 : (step < 3.5 ? V3 : V4));' +
  '   float l = dot(c, vec3(0.3,0.59,0.11)) / dot(vec3(0.68,0.49,0.41), vec3(0.3,0.59,0.11));' +
  '   vec3 W = vec3(1.0,0.784,0.667); c = valley ? hc * vt : (l < RAMP.x ? hc : (l < RAMP.y ? mix(hc, W, HAIR_MID) : mix(hc, W, HAIR_HI)));' +
  '   c *= 1.0 + RAMPK * (l - (valley || l < RAMP.x ? RAMP.x - 0.2 : (l < RAMP.y ? 0.5 * (RAMP.x + RAMP.y) : RAMP.y + 0.1))); }' +
  ' else c *= vm/vec3(0.68,0.49,0.41); gl_FragColor = vec4(min(c, vec3(1.0)), ALPHA); }';
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
  const bg = c.bg ?? [0.212, 0.165, 0.18]; gl.clearColor(bg[0], bg[1], bg[2], c.see ? 0 : 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix3fv(U('R'), false, rotm(c.cam.yaw, c.cam.pitch ?? 0)); gl.uniform3fv(U('piv'), c.cam.c); gl.uniform1f(U('s'), c.cam.s);
  gl.uniform2f(U('asp'), 2 / bw, 2 / bh);
  for (const k of [AL.p, AL.n, AL.m]) gl.enableVertexAttribArray(k);
  for (const m of c.meshes) {
    gl.uniform3fv(U('SHC'), window.SHS[m.who]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.a), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(AL.n, 3, gl.FLOAT, false, 36, 12); gl.vertexAttribPointer(AL.m, 3, gl.FLOAT, false, 36, 24);
    gl.uniform1f(U('ALPHA'), m.alpha); gl.disable(gl.BLEND); // (a see-through mesh writes its alpha as it is: the front-most layer alone, over the page)
    gl.uniform1i(U('mode'), m.flat ? 2 : 0); gl.uniform1f(U('lift'), 0); gl.uniform2f(U('RAMP'), window.RAMP[0], window.RAMP[1]);
    if (m.depthOnly) gl.colorMask(false, false, false, false);
    gl.drawArrays(gl.TRIANGLES, 0, m.a.length / 9);
    gl.colorMask(true, true, true, true);
  }
  for (const m of c.meshes) {
    if (!m.e) continue;
    gl.uniform1f(U('ALPHA'), 1); gl.disable(gl.BLEND); gl.uniform1i(U('mode'), 1); gl.uniform1f(U('lift'), 0.003); gl.uniform3fv(U('linec'), m.ec);
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
  const RAMP = HAIR_RAMP;
  browser ??= await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent(PAGE(w, h));
  const data = cells.map((c) => ({ ...c, meshes: c.meshes.map((m) => ({ who: m.who ?? 'male', a: flatMesh(m), e: m.edges ? edgesOf(m) : null, ec: m.edgec ?? [0.15, 0.1, 0.1], flat: !!m.flat, alpha: m.alpha ?? 1, depthOnly: !!m.depthOnly })) }));
  const SHS = { male: shOf('male'), female: shOf('female') };
  // the references: each a crop of an image scaled into its box
  const urls = {};
  for (const im of imgs) urls[im.src] ??= 'data:image/png;base64,' + readFileSync(im.src).toString('base64');
  await p.evaluate(([C, ww, hh, tx, SH, ims, U, RAMP]) => {
    window.CELLS = C; window.RAMP = RAMP; window.SW = ww; window.SHH = hh; window.TEXTS = tx; window.SHS = SH;
    const host = document.getElementById('imgs');
    for (const im of ims) {
      const [x, y, cw, ch] = im.crop, [bx, by, bw, bh] = im.box, k = Math.min(bw / cw, bh / ch);
      const e = document.createElement('div'); e.className = 'im';
      e.style.cssText = `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:#362a2e url(${U[im.src]}) no-repeat;` +
        `background-size:${im.size[0] * k}px ${im.size[1] * k}px;background-position:${-x * k + (bw - cw * k) / 2}px ${-y * k + (bh - ch * k) / 2}px` + (im.flip ? ';transform:scaleX(-1)' : '');
      host.appendChild(e);
    }
    document.getElementById('gl').style.pointerEvents = 'none';
  }, [data, w, h, texts, SHS, imgs, urls, RAMP]);
  await p.addScriptTag({ content: RENDER });
  await p.waitForFunction('window.READY', null, { timeout: 180000 });
  // the canvas is drawn only in the cells' boxes: everything else stays see-through, over the references
  await p.locator('#sheet').screenshot({ path: file });
  console.log('wrote', file);
  await p.close();
}
export async function closeBrowser() { if (browser) await browser.close(); browser = null; }
export { SKIN };

/* ---- the sheets ------------------------------------------------------------------------------------------------------ */
//   node tools/sculpt/lowhairshot.mjs --out <dir> [--style swept] [--only views,wire,sil,exploded,game,turn]
// views: the reference sheet's five views over ours, per body (hair-sheet-<who>.png); close: the front, the three-quarter,
// the rear three-quarter and the back, larger, the sheet's beside ours (hair-close-<who>.png); wire: the topology (hair-wire.png);
// sil: the silhouette; exploded: the clumps pulled apart (hair-exploded.png); game: the full bodies at the game's zooms
// (hair-game.png); turn: the head turned 70° and nodded, with the crossings counted (hair-turn.png).
// The cameras are the hair sheet's own (tools/sculpt/lowhaircams.json: the head sheets' turns, tools/sculpt/lowcams.json,
// with the scale and the centre fitted to this sheet's faces and ears below the hair).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRig, posed, skin } from './lowrig.mjs';
import { buildHair, skinHair, STYLES, crossings, openEdges, hairCrossings } from './lowhair.mjs';
import { carve, hullSurface, warpOf, camsFor, project as sheetAt } from './lowhairhull.mjs';
import { sheetOf, bodyMarks, pairsOf, outlineOf, headTris } from './lowhairreg.mjs';

const REF = join(DIR, 'ref/hair-swept-undercut.png'), REF_SIZE = [1536, 1024];
const PIV = [0, 1, 0.1];
const VIEWS = [['front', 'Front (0°)'], ['q3', 'Three-quarter (45°)'], ['profile', 'Profile (90°)'], ['r3', 'Rear three-quarter (135°)'], ['back', 'Back (180°)']];
/** The sheet's main hair tone, the colour the review renders take (the game takes the look's). */
export const SHEET_HAIR = [104 / 255, 62 / 255, 51 / 255];
const BROW = [0.22, 0.15, 0.13], PUPIL = [0.08, 0.06, 0.06];
/** The shaved scalp: the skin toward the hair's colour by this much (the sheet's buzz is about 0.7 of its skin's value). */
export const SHAVE = 0.65;
const mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);

export function bodyMesh(rig, hair, P = rig.B.verts, hairCol = SHEET_HAIR, o = {}) {
  const B = rig.B, shave = new Set(o.bald ? [] : hair.shave);
  const keep = o.parts ? (p) => o.parts.includes(p.part) : () => true;
  const col = B.polys.map((p, i) => (p.mat === 'pupil' ? PUPIL : p.mat === 'brow' || p.mat === 'lid' ? BROW : shave.has(i) ? mix(SKIN, hairCol, SHAVE) : SKIN));
  return { who: rig.who, P, polys: B.polys.map((p) => p.nv ?? p.v), tris: B.tris.filter((t) => keep(B.polys[t.poly])).map((t) => [...t.v, t.poly]), col };
}
export function hairMesh(rig, hair, H = hair.verts, hairCol = SHEET_HAIR) {
  return { who: rig.who, P: H, polys: hair.polys.map((p) => p.v), tris: hair.tris, col: hair.polys.map((p) => (p.buzz ? mix(SKIN, hairCol, SHAVE) : hairCol.map((x, c) => -x - (p.valley && !c ? VALLEY_MARK * p.valley : 0)))) };
}
const camOf = (c, k = 1) => ({ yaw: -c.yaw, pitch: -c.pitch, s: c.s * k, c: PIV });
/** The head-space point the plain camera draws at sheet pixel (x, y) (at the pivot's depth): a cell's centre. */
function sheetPivot(c, x, y) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const qx = (x - c.cx) / c.s, qy = (c.cy - y) / c.s;
  return [PIV[0] + qx * ca + qy * sb * sa, PIV[1] + qy * cb, PIV[2] + qx * sa - qy * sb * ca];
}

const MAIN = import.meta.url === `file://${process.argv[1]}`;
if (MAIN) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowhair')); mkdirSync(out, { recursive: true });
  const only = opt('only', 'views').split(','), style = STYLES[opt('style', 'swept')];
  // (each body's own registration: tools/sculpt/lowhairreg.mjs)
  const CAMW = { male: camsFor('male'), female: camsFor('female') };
  const RIGS = {}, HAIRS = {};
    // the hull carved from the sheet's silhouettes: the locks' heights (and, with --hull, drawn itself in their place)
  const HULL = carve(opt('style', 'swept'));
  for (const who of opt('who', 'male,female').split(',')) {
    RIGS[who] = buildRig(who);
    // --hull: the carved hull's outer skin in place of the hair (with the shave of the style)
    HAIRS[who] = args.includes('--hull') ? { ...hullSurface(HULL, RIGS[who]), shave: buildHair(RIGS[who], style).shave } : buildHair(RIGS[who], style, HULL);
  }
  const stage = opt('tag', '');

  if (only.includes('views')) for (const who of Object.keys(RIGS)) {
    const rig = RIGS[who], hair = HAIRS[who];
    const cw = 280, ch = 330, gap = 8, x0 = 10, y1 = 34, y2 = y1 + ch + 26, y3 = y2 + ch + 26, over = who === 'male';
    const cells = [], imgs = [], texts = [];
    VIEWS.forEach(([v, label], i) => {
      const c = CAMW[who][v], x = x0 + i * (cw + gap);
      imgs.push({ src: REF, size: REF_SIZE, crop: [c.cx - cw / 2, c.cy - ch / 2, cw, ch], box: [x, y1, cw, ch] });
      // (the view's 2D correction, tools/sculpt/lowhairreg.mjs, as a map of the head's space: the body and the hair alike)
      const w = warpOf(c), Pw = rig.B.verts.map(w), Hw = hair.verts.map(w);
      cells.push({ meshes: [bodyMesh(rig, hair, Pw), hairMesh(rig, hair, Hw)], cam: camOf(c), box: [x, y2, cw, ch], label });
      if (!over) return;
      // the third row: the sheet with our hair laid over it, a see-through teal with its outline (the head left out)
      imgs.push({ src: REF, size: REF_SIZE, crop: [c.cx - cw / 2, c.cy - ch / 2, cw, ch], box: [x, y3, cw, ch] });
      // (the buzz patches left out: they lie on the skin, as the sheet's buzz, not in its hair's silhouette)
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, Pw), depthOnly: true }, { ...hairMesh(rig, hair, Hw), tris: hair.tris.filter(([, , , pi]) => !hair.polys[pi].buzz), col: hair.polys.map(() => [0.2, 0.95, 0.85]), flat: true, alpha: 0.42 }], cam: camOf(c), box: [x, y3, cw, ch], see: true, label: 'ours (teal, no buzz) over the sheet' });
    });
    texts.push({ css: 'left:12px;top:6px', html: `Swept back undercut — the sheet (top), the ${who === 'male' ? 'man' : 'woman'} (below): ${hair.tris.length} hair triangles, ${hair.pieces.length} clumps` });
    await shoot(x0 * 2 + 5 * cw + 4 * gap, (over ? y3 : y2) + ch + 10, cells, join(out, `hair-sheet-${who}${stage}.png`), { texts, imgs });
  }

  if (only.includes('tufts')) for (const who of Object.keys(RIGS)) {
    // per tuft: each of ours in its own colour (flat, see-through) over the sheet, the sheet's creases traced in that
    // view (tools/sculpt/hairs/swept-lines2d.json, solid where the view sees them) in the crease's colour over it; the
    // sheet alone beside it with the same creases
    const rig = RIGS[who], hair = HAIRS[who], L2 = JSON.parse(readFileSync(join(DIR, 'hairs/swept-lines2d.json'), 'utf8'));
    const cw = 280, ch = 300, gap = 8, K = 1.4, cells = [], imgs = [], texts = [];
    const PAL = [[0.95, 0.3, 0.3], [0.98, 0.65, 0.2], [0.95, 0.9, 0.25], [0.45, 0.85, 0.3], [0.25, 0.8, 0.85], [0.35, 0.5, 0.98], [0.75, 0.4, 0.95], [0.98, 0.45, 0.75], [0.6, 0.95, 0.7], [0.9, 0.9, 0.9]];
    const col = hair.polys.map((p) => (p.buzz ? [0, 0, 0] : p.tuft === undefined ? [0.5, 0.5, 0.5] : p.tuft < 0 ? [0.08, 0.05, 0.05] : PAL[(p.piece * 6 + p.tuft) % PAL.length]));
    VIEWS.forEach(([v, label], i) => {
      const c = CAMW[who][v], x = 10 + i * (cw * K + gap), y0 = 34, y1 = y0 + ch * K + gap, sx = c.cx - cw / 2, sy = c.cy - ch / 2 - 20;
      for (const y of [y0, y1]) imgs.push({ src: REF, size: REF_SIZE, crop: [sx, sy, cw, ch], box: [x, y, cw * K, ch * K] });
      const w = warpOf(c);
      cells.push({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts.map(w)), depthOnly: true }, { ...hairMesh(rig, hair, hair.verts.map(w)), tris: hair.tris.filter(([, , , pi]) => !hair.polys[pi].buzz), col, flat: true, alpha: 0.62 }], cam: { ...camOf(c, K), c: sheetPivot(c, sx + cw / 2, sy + ch / 2) }, box: [x, y1, cw * K, ch * K], see: true, label: label + ': ours per tuft' });
      const svg = (L2[v] ?? []).map((ln) => {
        const segs = []; let cur = [];
        ln.pts.forEach(([px, py, seen]) => { if (seen) cur.push(`${((px - sx) * K).toFixed(1)},${((py - sy) * K).toFixed(1)}`); else { if (cur.length > 1) segs.push(cur); cur = []; } });
        if (cur.length > 1) segs.push(cur);
        return segs.map((sg) => `<polyline points="${sg.join(' ')}" fill="none" stroke="rgb(${ln.col.join(',')})" stroke-width="2.2" stroke-linejoin="round"/>`).join('');
      }).join('');
      for (const y of [y0, y1]) texts.push({ cls: 'lab', css: `left:${x}px;top:${y}px;width:${cw * K}px;height:${ch * K}px`, html: `<svg width="${cw * K}" height="${ch * K}">${svg}</svg>` });
      texts.push({ cls: 'lab', css: `left:${x + 6}px;top:${y0 + 4}px;text-shadow:0 0 3px #000`, html: label + ': the sheet, its creases traced' });
    });
    texts.unshift({ css: 'left:12px;top:6px', html: `Per tuft: the sheet's creases (lines, each its colour) over the sheet (top) and over the ${who === 'male' ? 'man' : 'woman'}'s tufts, each its own colour, the valleys near-black (below)` });
    await shoot(10 + 5 * (cw * K + gap), 34 + 2 * (ch * K + gap) + 4, cells, join(out, `hair-tufts-${who}${stage}.png`), { texts, imgs });
  }

  if (only.includes('reg')) for (const who of Object.keys(RIGS)) {
    // the registration: the body's head and neck as a wire over each sheet view (2x), the sheet's landmarks (yellow
    // rings) and the body's (cyan dots) with their residuals, the outline's mean distance
    const rig = RIGS[who], CAMS = CAMW[who], S = sheetOf(), M = bodyMarks(rig.B), tris = headTris(rig.B), K = 2, cw = 250, ch = 270;
    const cells = [], imgs = [], texts = [];
    VIEWS.forEach(([v, label], i) => {
      const c = CAMS[v], x = 10 + (i % 3) * (cw * K + 8), y = 34 + Math.floor(i / 3) * (ch * K + 30), x0 = c.cx - cw / 2, y0 = 30;
      imgs.push({ src: REF, size: REF_SIZE, crop: [x0, y0, cw, ch], box: [x, y, cw * K, ch * K] });
      const w = warpOf(c), Pw = rig.B.verts.map(w);
      const head = { ...bodyMesh(rig, { shave: [] }, Pw, SHEET_HAIR, { parts: ['head', 'neck'] }) };
      cells.push({ meshes: [{ ...head, depthOnly: true }, { ...head, tris: [], edges: true, edgec: [0.2, 1, 0.95] }], cam: { ...camOf(c, K), c: sheetPivot(c, x0 + cw / 2, y0 + ch / 2) }, box: [x, y, cw * K, ch * K], see: true });
      const at = (q) => [x + (q[0] - x0) * K, y + (q[1] - y0) * K];
      const res = [];
      for (const [n, sp, p] of pairsOf(v, c, S, M)) {
        const a = at(sp), b = at(sheetAt(p, c)), d = Math.hypot(...sheetAt(p, c).slice(0, 2).map((q, k) => q - sp[k]));
        texts.push({ cls: 'lab', css: `left:${a[0] - 7}px;top:${a[1] - 7}px;width:10px;height:10px;border:2px solid #ffe14a;border-radius:50%`, html: '' });
        texts.push({ cls: 'lab', css: `left:${b[0] - 3}px;top:${b[1] - 3}px;width:6px;height:6px;background:#2ff;border-radius:50%`, html: '' });
        texts.push({ cls: 'lab', css: `left:${a[0] + 8}px;top:${a[1] + 4}px;font-size:12px;color:#ffe14a;text-shadow:0 0 3px #000`, html: d.toFixed(1) });
        res.push(d);
      }
      const o = outlineOf(v, c, S, tris);
      texts.push({ cls: 'lab', css: `left:${x + 6}px;top:${y + 4}px;text-shadow:0 0 3px #000`, html: `${label}: outline ${o.px.toFixed(2)} px` + (res.length ? `, landmarks mean ${(res.reduce((a, q) => a + q, 0) / res.length).toFixed(1)} px` : ', no face landmarks') + `<br>correction: roll ${(c.roll ?? 0).toFixed(1)}°, across ×${(c.ax ?? 1).toFixed(3)}, up ×${(c.ay ?? 1).toFixed(3)}, shear ${(c.sh ?? 0).toFixed(3)}` });
    });
    texts.unshift({ css: 'left:12px;top:6px', html: `Registration: the ${who === 'male' ? 'man' : 'woman'}'s head (wire) over the sheet at 2×; yellow rings the sheet's landmarks, cyan dots ${who === 'male' ? 'his' : 'hers'}, residuals in px` });
    await shoot(10 + 3 * (cw * K + 8), 34 + 2 * (ch * K + 30), cells, join(out, `hair-reg-${who}${stage}.png`), { texts, imgs });
  }

  if (only.includes('close')) for (const who of Object.keys(RIGS)) {
    // close: each view larger, the sheet's (left) beside ours (right); his left side the sheet's profile mirrored; where
    // the pieces pass through one another (tools/sculpt/lowhair.mjs hairCrossings), red lines
    const rig = RIGS[who], hair = HAIRS[who], K = 1.8, cw = 420, ch = 420, gap = 8, cells = [], imgs = [];
    const X = hairCrossings(rig, hair), xp = X.flatMap((x) => x.points.length >= 2 ? x.points.slice(0, 2) : []);
    const red = { who: rig.who, P: xp.length ? xp : [[0, 0, 0]], polys: xp.length ? Array.from({ length: xp.length / 2 }, (_, i) => [2 * i, 2 * i + 1]) : [], tris: [], col: [], edges: true, edgec: [1, 0.1, 0.1] };
    const views = [['front', 'Front (0°)'], ['q3', 'Three-quarter (45°)'], ['profile', 'Profile, his right (90°)'], ['profile', 'Profile, his left (270°; the sheet mirrored)', true], ['r3', 'Rear three-quarter (135°)'], ['back', 'Back (180°)']];
    views.forEach(([v, label, flip], i) => {
      const c = CAMW[who][v], x = 10 + (i % 2) * 2 * (cw + gap), y = 34 + Math.floor(i / 2) * (ch + gap), cy = c.cy - 30;
      imgs.push({ src: REF, size: REF_SIZE, crop: [c.cx - cw / K / 2, cy - ch / K / 2, cw / K, ch / K], box: [x, y, cw, ch], flip });
      const cam = { ...camOf(c, K), c: [PIV[0], PIV[1] + 30 / c.s, PIV[2]] };
      if (flip) cam.yaw = -cam.yaw;
      const w = warpOf(c);
      cells.push({ meshes: [bodyMesh(rig, hair, rig.B.verts.map(w)), hairMesh(rig, hair, hair.verts.map(w)), { ...red, P: red.P.map(w) }], cam, box: [x + cw + gap, y, cw, ch], label });
    });
    const sideN = X.filter((x) => x.side).length;
    await shoot(10 + 4 * (cw + gap) + 2, 34 + 3 * (ch + gap) + 10, cells, join(out, `hair-close-${who}${stage}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Close: the sheet (left), the ${who === 'male' ? 'man' : 'woman'} (right); red: pieces through one another where it shows (${X.length}, on the sides ${sideN})` }], imgs });
  }

  const POSES = { headturn: { label: 'Head turned 70°', pose: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] } }, nod: { label: 'Head nod (down 40°)', pose: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] } } };
  const report = {};
  if (only.includes('turn')) {
    const cells = [], cw = 300, ch = 330;
    let x = 10;
    for (const who of Object.keys(RIGS)) {
      const rig = RIGS[who], hair = HAIRS[who];
      report[who] = { tris: hair.tris.length, open: openEdges(hair), rest: crossings(rig, hair, rig.B.verts, hair.verts).n };
      for (const [id, e] of Object.entries(POSES)) {
        const f = posed(rig, e.pose), P = skin(rig, f), Hp = skinHair(rig, hair, f), n = crossings(rig, hair, P, Hp).n;
        report[who][id] = n;
        for (const [yaw, pitch] of [[-30, -5], [-95, 0]]) {
          cells.push({ meshes: [bodyMesh(rig, hair, P), hairMesh(rig, hair, Hp)], cam: { yaw, pitch, s: 105, c: [0, 0.9, 0.1] }, box: [x, 34, cw, ch], label: `${who === 'male' ? 'Man' : 'Woman'}: ${e.label}, crossings ${n}` });
          x += cw + 8;
        }
      }
    }
    await shoot(x + 2, 34 + ch + 10, cells, join(out, `hair-turn${stage}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'The hair on the head bone (rigid): the head turned and nodded, the hair\'s triangles through the neck or the shoulders counted' }] });
    console.log(JSON.stringify(report));
  }

  if (only.includes('wire') && RIGS.male) {
    const rig = RIGS.male, hair = HAIRS.male, cw = 330, ch = 380;
    const cells = [[0, 'Front'], [-90, 'Profile']].map(([yaw, label], i) => ({ meshes: [{ ...bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck'] }), edges: true, edgec: [0.95, 0.85, 0.78] }, { ...hairMesh(rig, hair), edges: true, edgec: [1, 0.93, 0.85] }], cam: { yaw, pitch: 0, s: 125, c: [0, 1.15, 0.1] }, box: [10 + i * (cw + 8), 34, cw, ch], label }));
    await shoot(2 * cw + 28, ch + 44, cells, join(out, `hair-wire${stage}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Topology: ${hair.tris.length} hair triangles in ${hair.pieces.length} closed pieces (${hair.pieces.map((p) => p.id).join(', ')})` }], imgs: [] });
  }

  if (only.includes('sil') && RIGS.male) {
    const rig = RIGS.male, hair = HAIRS.male, cream = [0.98, 0.9, 0.8];
    const flat = (m) => ({ ...m, col: m.col.map(() => cream), flat: true });
    const cells = [{ meshes: [flat(bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck', 'torso'] })), flat(hairMesh(rig, hair))], cam: { yaw: -93, pitch: 0, s: 52, c: [0, 0.7, 0.1] }, box: [190, 34, 170, 200], label: 'Ours' }];
    await shoot(370, 244, cells, join(out, `hair-sil${stage}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'Silhouette: the sheet, ours' }], imgs: [{ src: REF, size: REF_SIZE, crop: [1375, 860, 135, 160], box: [10, 34, 170, 200] }] });
  }

  if (only.includes('exploded') && RIGS.male) {
    const rig = RIGS.male, hair = HAIRS.male, C = hair.centre;
    // each piece moved out from the skull's centre along its own middle's direction
    const H2 = hair.verts.map((p) => [...p]);
    for (const pc of hair.pieces) {
      const vs = hair.verts.slice(...pc.verts), mid = vs.reduce((a, p) => a.map((x, k) => x + p[k] / vs.length), [0, 0, 0]);
      const d = mid.map((x, k) => x - C[k]), l = Math.hypot(...d);
      for (let i = pc.verts[0]; i < pc.verts[1]; i++) H2[i] = H2[i].map((x, k) => x + (d[k] / l) * 0.45);
    }
    const cells = [{ meshes: [bodyMesh(rig, hair, rig.B.verts, SHEET_HAIR, { parts: ['head', 'neck'] }), hairMesh(rig, hair, H2)], cam: { yaw: -35, pitch: 8, s: 95, c: [0, 1.25, 0.1] }, box: [560, 34, 420, 440], label: 'Ours: the pieces pulled apart' }];
    await shoot(990, 484, cells, join(out, `hair-exploded${stage}.png`), { texts: [{ css: 'left:12px;top:6px', html: `Clump breakdown: the sheet, ours (${hair.pieces.map((p) => p.id).join(', ')})` }], imgs: [{ src: REF, size: REF_SIZE, crop: [480, 540, 560, 480], box: [10, 34, 540, 440] }] });
  }

  if (only.includes('game')) {
    // the full bodies at the game's zooms: the man about 58 game units tall, the woman 0.85 of him (src/sculpt/lowpoly.ts),
    // the island's camera looking down 30°
    const cells = [];
    let x = 10;
    for (const zoom of [5, 10]) for (const who of Object.keys(RIGS)) {
      const rig = RIGS[who], hair = HAIRS[who], top = Math.max(...rig.B.verts.map((p) => p[1])), tall = top - rig.J.floor;
      const px = (58 * (who === 'female' ? 0.85 : 1) * zoom) / tall, h = Math.ceil(58 * zoom * 1.05) + 20, w = Math.ceil(px * 7);
      cells.push({ meshes: [bodyMesh(rig, hair), hairMesh(rig, hair)], cam: { yaw: -30, pitch: -30, s: px, c: [0, (top + rig.J.floor) / 2, 0] }, box: [x, 34, w, h], label: `${who === 'male' ? 'Man' : 'Woman'}, zoom ${zoom}` });
      x += w + 8;
    }
    await shoot(x + 2, 34 + Math.ceil(58 * 10 * 1.05) + 30, cells, join(out, `hair-game${stage}.png`), { texts: [{ css: 'left:12px;top:6px', html: 'At the game\'s zooms (5 and 10), the full body' }] });
  }
  await closeBrowser();
}
