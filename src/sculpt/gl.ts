/**
 * Drawing a sculpt: WebGL2, the baked mesh skinned on the GPU by the pose's
 * bone frames, projected exactly as the 2D figure is (`viewOf`'s `ex`, `ey`
 * and `HEIGHT_SCALE`), and painted in the island's ligne claire -- flat local
 * colour in the pastel base, one hard shadow shape in a hue shifted toward
 * teal or plum, one highlight in lemon or cyan, a rim -- then a second pass
 * that inks one clean even line round the silhouette and a thinner one
 * where a part crosses in front of another, in a deep hue of the surface's
 * own colour. Emissives are unlit and bloom a little; the night wash is
 * applied here so they keep their colour through it. The result is put down
 * on the 2D canvas with one `drawImage`, where `drawFigure` would draw.
 */
import { HEIGHT_SCALE } from '../render/iso';
import type { View } from '../render/figure';
import { STRIDE, type Baked } from './bake';
import type { Material } from './sdf';

export type Debug = 'none' | 'wire' | 'normals' | 'mats' | 'bones' | 'edges';
export interface DrawOpts {
  /** Night, nought to one: the island's wash over everything but emissives. */
  night?: number;
  debug?: Debug;
  /** Ink width in screen px at this zoom, before the device ratio; left out, the figure's rule. */
  ink?: number;
  grain?: number;
  /** Device pixels per canvas unit the 2D context is scaled by. */
  dpr?: number;
  /** Flat light (no shadow or highlight shapes), for a look at the colours alone. */
  flat?: boolean;
}

/** The screen box a body fits in at zoom one, in figure units, as the 2D figure's `STILL_BOX`. */
export const BOX = { left: -42, right: 42, top: -66, bottom: 14 };
const MAX_BONES = 80;
const MAX_MATS = 32;

const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNrm; in float aMat; in vec4 aBones; in vec4 aW; in vec2 aStamp;
uniform vec4 uBones[${MAX_BONES * 3}];
uniform vec2 uEx, uEy; uniform float uHS; uniform vec3 uT; uniform vec2 uHalf; uniform float uDepth; uniform vec2 uOff;
out vec3 vNrm; out vec3 vPos; flat out float vMat; flat out float vBone; out float vDepth; flat out float vMatB; out float vStamp;
vec3 skinP(int b, vec3 p) { vec4 q = vec4(p, 1.0); return vec3(dot(uBones[b*3], q), dot(uBones[b*3+1], q), dot(uBones[b*3+2], q)); }
vec3 skinN(int b, vec3 n) { return vec3(dot(uBones[b*3].xyz, n), dot(uBones[b*3+1].xyz, n), dot(uBones[b*3+2].xyz, n)); }
void main() {
  vec3 p = vec3(0.0), n = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float w = aW[i]; if (w <= 0.0) continue;
    int b = int(aBones[i] + 0.5);
    p += w * skinP(b, aPos); n += w * skinN(b, aNrm);
  }
  float sx = p.x * uEx.x + p.y * uEy.x - uOff.x;
  float sy = p.x * uEx.y + p.y * uEy.y - p.z * uHS - uOff.y;
  float d = -dot(p, uT);
  vNrm = normalize(n); vPos = p; vMat = aMat; vBone = aBones.x; vDepth = d; vMatB = aStamp.x; vStamp = aStamp.y;
  gl_Position = vec4(sx / uHalf.x, -sy / uHalf.y, d / uDepth, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNrm; in vec3 vPos; flat in float vMat; flat in float vBone; in float vDepth; flat in float vMatB; in float vStamp;
uniform vec4 uMat[${MAX_MATS}];
uniform vec3 uL; uniform vec3 uT; uniform float uGrain; uniform float uNight; uniform float uMode; uniform float uFlat; uniform float uBlink;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oNd; layout(location=2) out vec4 oId;
vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy); vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hashCol(float i){ return 0.35 + 0.6 * vec3(hash(vec2(i, 1.0)), hash(vec2(i, 7.0)), hash(vec2(i, 13.0))); }
void main() {
  vec3 n = normalize(vNrm);
  // The stamp's material where the stamp's distance says inside, its edge one pixel soft across the interpolated distance.
  float inStamp = smoothstep(-fwidth(vStamp), fwidth(vStamp), vStamp);
  int mi = inStamp > 0.5 ? int(vMatB + 0.5) : int(vMat + 0.5);
  vec4 M = mix(uMat[int(vMat + 0.5)], uMat[int(vMatB + 0.5)], inStamp);
  vec3 base = M.rgb;
  int flags = int(uMat[mi].a + 0.5);
  // Lids shut: the eye's parts take the lid's colour, the first material's a shade darker, and shade as skin.
  if (uBlink > 0.5 && (flags & 8) != 0) { base = uMat[0].rgb * 0.94; flags = 2; }
  bool emissive = (flags & 1) != 0, skin = (flags & 2) != 0, metal = (flags & 4) != 0;
  float dl = dot(n, uL);
  vec3 c = base;
  if (uMode > 0.5) {
    if (uMode < 1.5) c = n * 0.5 + 0.5;
    else if (uMode < 2.5) c = hashCol(float(mi));
    else c = hashCol(vBone);
  } else if (emissive) {
    c = base;
  } else if (uFlat > 0.5) {
    c = base;
  } else {
    // Ligne claire: a hard shadow shape and a hard highlight shape per surface, each a shifted hue, the terminator one pixel soft.
    vec3 h = rgb2hsv(base);
    bool warm = h.x < 0.2 || h.x > 0.9;
    float aa = fwidth(dl) * 1.2;
    float shadowAt = skin ? 0.0 : 0.12, lightAt = metal ? 0.78 : (skin ? 0.72 : 0.64);
    float sh = 1.0 - smoothstep(shadowAt - aa, shadowAt + aa, dl);
    float li = smoothstep(lightAt - aa, lightAt + aa, dl);
    vec3 shadow, light;
    if (skin) {
      shadow = hsv2rgb(vec3(fract(h.x - 0.035), min(1.0, h.y * 1.22), h.z * 0.74));
      light = hsv2rgb(vec3(h.x, h.y * 0.9, min(1.0, h.z * 1.05)));
    } else {
      float toS = warm ? 0.5 : 0.78; float dS = toS - h.x; dS -= floor(dS + 0.5);
      shadow = hsv2rgb(vec3(fract(h.x + dS * 0.2), min(1.0, h.y * 1.15 + 0.08), h.z * 0.7));
      float toL = warm ? 0.15 : 0.5; float dL = toL - h.x; dL -= floor(dL + 0.5);
      light = hsv2rgb(vec3(fract(h.x + dL * 0.08), h.y * (metal ? 0.6 : 0.88), min(1.0, h.z * (metal ? 1.2 : 1.1) + 0.02)));
    }
    c = mix(mix(base, light, li), shadow, sh);
    // A rim where the surface turns from the viewer, in the shadow's hue: the form's edge read without a line.
    float rim = pow(1.0 - clamp(dot(n, uT), 0.0, 1.0), 4.0);
    c = mix(c, shadow, rim * 0.35 * (1.0 - li));
    // The grain, a breath of broken colour.
    c += (hash(floor(gl_FragCoord.xy / 2.0)) - 0.5) * uGrain;
  }
  if (!emissive && uMode < 0.5) c = mix(c, vec3(12.0, 20.0, 44.0) / 255.0, uNight * 0.68);
  oCol = vec4(c, 1.0);
  oNd = vec4(n * 0.5 + 0.5, vDepth);
  oId = vec4(float(mi) / 255.0, emissive ? 1.0 : 0.0, 0.0, 1.0);
}`;

const EDGE_VS = `#version 300 es
in vec2 aP; out vec2 vUv; void main(){ vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;

const EDGE_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uCol; uniform sampler2D uNd; uniform sampler2D uId; uniform vec2 uPx; uniform float uInk; uniform float uDepthStep; uniform float uShow; uniform float uNight;
out vec4 o;
vec3 inkOf(vec3 base) { return min(mix(base, vec3(0.157, 0.11, 0.102), 0.62), base * 0.5); }
void main() {
  vec4 c = texture(uCol, vUv);
  vec4 nd = texture(uNd, vUv);
  vec4 id = texture(uId, vUv);
  // The silhouette: an even band uInk px wide just outside the body, in a dark of the nearest body colour.
  float sil = 0.0; vec3 near = vec3(0.0);
  if (c.a < 0.5) {
    float best = 1.0e9;
    for (int d = 0; d < 16; d++) {
      float a = float(d) * 0.3927;
      vec2 dir = vec2(cos(a) * uPx.x, sin(a) * uPx.y);
      for (int k = 1; k <= 6; k++) {
        float t = float(k) / 6.0 * uInk;
        if (t >= best) break;
        vec4 sm = texture(uCol, vUv + dir * t);
        if (sm.a > 0.5) { sil = 1.0; best = t; near = sm.rgb; break; }
      }
    }
  }
  // Inside: a thinner line where a part stands in front of another (a step away in depth to a pixel beside), or at a sharp crease.
  float inner = 0.0;
  if (c.a > 0.5) {
    vec4 A = texture(uNd, vUv + vec2(uPx.x, 0.0)), B = texture(uNd, vUv - vec2(uPx.x, 0.0)), C = texture(uNd, vUv + vec2(0.0, uPx.y)), D = texture(uNd, vUv - vec2(0.0, uPx.y));
    float dz = max(max(A.w - nd.w, B.w - nd.w), max(C.w - nd.w, D.w - nd.w));
    vec3 n0 = nd.xyz * 2.0 - 1.0;
    float crease = min(min(dot(n0, A.xyz * 2.0 - 1.0), dot(n0, B.xyz * 2.0 - 1.0)), min(dot(n0, C.xyz * 2.0 - 1.0), dot(n0, D.xyz * 2.0 - 1.0)));
    float aA = texture(uCol, vUv + vec2(uPx.x, 0.0)).a, aB = texture(uCol, vUv - vec2(uPx.x, 0.0)).a, aC = texture(uCol, vUv + vec2(0.0, uPx.y)).a, aD = texture(uCol, vUv - vec2(0.0, uPx.y)).a;
    bool rim = min(min(aA, aB), min(aC, aD)) < 0.5;
    if (rim) inner = 1.0;
    else if (dz > uDepthStep) inner = 0.85;
    else if (crease < 0.15) inner = 0.6;
  }
  // Emissive bloom: the glow of any emissive pixel within four px, stronger at night.
  vec3 glow = vec3(0.0);
  if (id.g < 0.5) {
    float w = 0.0;
    for (int d = 0; d < 8; d++) {
      float a = float(d) * 0.7854;
      for (int k = 1; k <= 3; k++) {
        vec2 off = vec2(cos(a) * uPx.x, sin(a) * uPx.y) * float(k) * 1.4;
        vec4 e = texture(uId, vUv + off);
        if (e.g > 0.5) { float f = 1.0 - float(k) / 4.0; glow += texture(uCol, vUv + off).rgb * f; w += f; }
      }
    }
    if (w > 0.0) glow = glow / w * min(1.0, w / 6.0) * (0.35 + 0.45 * uNight);
  }
  if (uShow > 0.5) { o = sil > 0.5 ? vec4(1.0, 0.2, 0.2, 1.0) : inner > 0.0 ? vec4(0.2, 1.0, 0.3, 1.0) : vec4(c.rgb * 0.5 + 0.3, c.a); return; }
  if (sil > 0.5) o = vec4(inkOf(near), 1.0);
  else if (c.a > 0.5) o = vec4(mix(c.rgb, inkOf(c.rgb), inner) + glow, 1.0);
  else o = vec4(glow, glow == vec3(0.0) ? 0.0 : min(1.0, length(glow) * 2.0));
}`;

const WIRE_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.1, 0.08, 0.1, 1.0); }`;

interface Ctx {
  gl: WebGL2RenderingContext; cv: HTMLCanvasElement; prog: WebGLProgram; edge: WebGLProgram; wire: WebGLProgram;
  fbo: WebGLFramebuffer; tCol: WebGLTexture; tNd: WebGLTexture; tId: WebGLTexture; depth: WebGLRenderbuffer; quad: WebGLBuffer;
  w: number; h: number; u: Record<string, WebGLUniformLocation | null>; eu: Record<string, WebGLUniformLocation | null>; wu: Record<string, WebGLUniformLocation | null>;
}
let CTX: Ctx | null | undefined;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as Array<[number, string]>) {
    const s = gl.createShader(t)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

/** The one GL context, made on first use; null where there is no WebGL2 (the caller falls back to the 2D figure). */
export function glContext(): Ctx | null {
  if (CTX !== undefined) return CTX;
  const cv = document.createElement('canvas');
  const gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true, preserveDrawingBuffer: false });
  if (!gl) return (CTX = null);
  if (!gl.getExtension('EXT_color_buffer_float')) return (CTX = null);
  const prog = compile(gl, VS, FS), edge = compile(gl, EDGE_VS, EDGE_FS), wire = compile(gl, VS, WIRE_FS);
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const names = ['uBones', 'uEx', 'uEy', 'uHS', 'uT', 'uHalf', 'uDepth', 'uOff', 'uMat', 'uL', 'uGrain', 'uNight', 'uMode', 'uFlat', 'uBlink'];
  const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  const wu = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(wire, n)]));
  const eu = Object.fromEntries(['uCol', 'uNd', 'uId', 'uPx', 'uInk', 'uDepthStep', 'uShow', 'uNight'].map((n) => [n, gl.getUniformLocation(edge, n)]));
  CTX = { gl, cv, prog, edge, wire, fbo: gl.createFramebuffer()!, tCol: gl.createTexture()!, tNd: gl.createTexture()!, tId: gl.createTexture()!, depth: gl.createRenderbuffer()!, quad, w: 0, h: 0, u, eu, wu };
  return CTX;
}

function size(C: Ctx, w: number, h: number): void {
  if (C.w === w && C.h === h) return;
  const { gl } = C;
  C.cv.width = w; C.cv.height = h; C.w = w; C.h = h;
  gl.deleteTexture(C.tCol); gl.deleteTexture(C.tNd); gl.deleteTexture(C.tId);
  C.tCol = gl.createTexture()!; C.tNd = gl.createTexture()!; C.tId = gl.createTexture()!;
  for (const [t, fmt] of [[C.tCol, gl.RGBA8], [C.tNd, gl.RGBA16F], [C.tId, gl.RGBA8]] as Array<[WebGLTexture, number]>) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.bindRenderbuffer(gl.RENDERBUFFER, C.depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, C.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, C.tCol, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, C.tNd, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, C.tId, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, C.depth);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

interface Buffers { vbo: WebGLBuffer; ibo: WebGLBuffer; lines: WebGLBuffer; nLines: number }
const BUFFERS = new WeakMap<Baked, Buffers>();
function buffersOf(gl: WebGL2RenderingContext, b: Baked): Buffers {
  let bf = BUFFERS.get(b);
  if (bf) return bf;
  const vbo = gl.createBuffer()!, ibo = gl.createBuffer()!, lines = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, b.verts.subarray(0, b.nVerts * STRIDE), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.tris, gl.STATIC_DRAW);
  const ln = new Uint32Array(b.nTris * 6);
  for (let t = 0; t < b.nTris; t++) {
    const a = b.tris[t * 3], c = b.tris[t * 3 + 1], d = b.tris[t * 3 + 2];
    ln.set([a, c, c, d, d, a], t * 6);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lines);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ln, gl.STATIC_DRAW);
  bf = { vbo, ibo, lines, nLines: ln.length };
  BUFFERS.set(b, bf);
  return bf;
}

const hexOf = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const MATS = new WeakMap<Material[], Float32Array>();
function matsOf(ms: Material[]): Float32Array {
  let f = MATS.get(ms);
  if (f) return f;
  f = new Float32Array(MAX_MATS * 4);
  ms.forEach((m, i) => {
    if (i >= MAX_MATS) return;
    const c = hexOf(m.colour);
    f.set([c[0], c[1], c[2], (m.emissive ? 1 : 0) + (m.skin ? 2 : 0) + (m.metal ? 4 : 0) + (m.eye ? 8 : 0)], i * 4);
  });
  MATS.set(ms, f);
  return f;
}

/** What one draw needs: the bake, the pose's skinning frames, the materials and the view. */
export interface SculptDraw { baked: Baked; bones: Float32Array; materials: Material[]; view: View; /** Lids shut, past a half. */ blink?: number }

/**
 * A body drawn on `ctx` with its feet at (sx, sy) at `zoom`, or false where
 * there is no WebGL2 to draw it with.
 */
export function drawSculptGL(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, d: SculptDraw, o: DrawOpts = {}): boolean {
  const C = glContext();
  if (!C) return false;
  const { gl } = C;
  const dpr = o.dpr ?? (window.devicePixelRatio || 1);
  const w = Math.ceil((BOX.right - BOX.left) * zoom * dpr), h = Math.ceil((BOX.bottom - BOX.top) * zoom * dpr);
  size(C, w, h);
  const bf = buffersOf(gl, d.baked);
  gl.bindFramebuffer(gl.FRAMEBUFFER, C.fbo);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
  const setCommon = (prog: WebGLProgram, u: Record<string, WebGLUniformLocation | null>): void => {
    gl.useProgram(prog);
    gl.uniform4fv(u.uBones, d.bones.length >= MAX_BONES * 12 ? d.bones.subarray(0, MAX_BONES * 12) : padded(d.bones));
    const v = d.view;
    gl.uniform2f(u.uEx, v.ex[0], v.ex[1]);
    gl.uniform2f(u.uEy, v.ey[0], v.ey[1]);
    gl.uniform1f(u.uHS, HEIGHT_SCALE);
    gl.uniform3f(u.uT, v.T[0], v.T[1], v.T[2]);
    gl.uniform2f(u.uHalf, (BOX.right - BOX.left) / 2, (BOX.bottom - BOX.top) / 2);
    gl.uniform1f(u.uDepth, 80);
    gl.uniform2f(u.uOff, (BOX.left + BOX.right) / 2, (BOX.top + BOX.bottom) / 2);
    gl.uniform4fv(u.uMat, matsOf(d.materials));
    gl.uniform3f(u.uL, v.L[0], v.L[1], v.L[2]);
    gl.uniform1f(u.uGrain, o.grain ?? 0.02);
    gl.uniform1f(u.uNight, o.night ?? 0);
    gl.uniform1f(u.uMode, o.debug === 'normals' ? 1 : o.debug === 'mats' ? 2 : o.debug === 'bones' ? 3 : 0);
    gl.uniform1f(u.uFlat, o.flat ? 1 : 0);
    gl.uniform1f(u.uBlink, d.blink ?? 0);
  };
  setCommon(C.prog, C.u);
  gl.bindBuffer(gl.ARRAY_BUFFER, bf.vbo);
  const stride = STRIDE * 4;
  for (const [i, sz, off] of [[0, 3, 0], [1, 3, 12], [2, 1, 24], [3, 4, 28], [4, 4, 44], [5, 2, 60]]) {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, sz, gl.FLOAT, false, stride, off);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bf.ibo);
  gl.drawElements(gl.TRIANGLES, d.baked.nTris * 3, gl.UNSIGNED_INT, 0);
  if (o.debug === 'wire') {
    setCommon(C.wire, C.wu);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bf.lines);
    gl.depthFunc(gl.LEQUAL);
    gl.drawElements(gl.LINES, bf.nLines, gl.UNSIGNED_INT, 0);
  }
  // The edge pass onto the canvas itself.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.disable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(C.edge);
  gl.bindBuffer(gl.ARRAY_BUFFER, C.quad);
  for (let i = 1; i < 6; i++) gl.disableVertexAttribArray(i);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, C.tCol); gl.uniform1i(C.eu.uCol, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, C.tNd); gl.uniform1i(C.eu.uNd, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, C.tId); gl.uniform1i(C.eu.uId, 2);
  gl.uniform2f(C.eu.uPx, 1 / w, 1 / h);
  // The figure's ink: most of a pixel however far out, never more than a few however far in; in device pixels here.
  const ink = (o.ink ?? Math.min(3.2, Math.max(0.9, 0.55 * zoom))) * dpr;
  gl.uniform1f(C.eu.uInk, ink);
  gl.uniform1f(C.eu.uDepthStep, 0.7);
  gl.uniform1f(C.eu.uShow, o.debug === 'edges' ? 1 : 0);
  gl.uniform1f(C.eu.uNight, o.night ?? 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.flush();
  ctx.drawImage(C.cv, 0, 0, w, h, sx + BOX.left * zoom, sy + BOX.top * zoom, w / dpr, h / dpr);
  return true;
}

let PAD: Float32Array | null = null;
function padded(b: Float32Array): Float32Array {
  if (!PAD) PAD = new Float32Array(MAX_BONES * 12);
  PAD.fill(0);
  PAD.set(b.subarray(0, Math.min(b.length, PAD.length)));
  return PAD;
}
