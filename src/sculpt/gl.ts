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
/** Materials a draw may use: a low-poly body's own (`bodyMaterials`), its garments' and its sword's (plain or enchanted) after them. */
const MAX_MATS = 128;
/** How far behind the body's surface (figure units, toward the viewer) the trail is still hidden by it: so the blade shows over its own trail. */
const TRAIL_BEHIND = 0.6;
/** The trail's opacity at its fullest, plain and lit, and the light a lit one adds over its opacity. */
const TRAIL_PLAIN = 0.6, TRAIL_LIT = 0.8, TRAIL_ADD = 0.7;
/** The trail's colours, at its inner edge and toward the point: plain, a pale cream; lit, the enchanted sword's golds (`assets/long_sword.json`). */
const TRAIL_RGB = { plain: { edge: '#f3ead8', mid: '#fffaf0' }, lit: { edge: '#ffb347', mid: '#ffe7a6' } };
/** A low-poly body's hair in a valley (`Material.valley`, its step: the darkest first): its colour times this, however
 * lit (the numbers; `tools/sculpt/lowhairshot.mjs` reads them from here). */
export const HAIR_VALLEYS = [0.62, 0.7, 0.78, 0.86];
/** Corrective shapes a draw may weigh (`Baked.shapes`). */
const MAX_SHAPES = 8;
/** Texels a row of the shapes' texture (each vertex's shapes, two texels a shape, run on along the rows). */
const SHAPE_ROW = 1024;
/** Terms of the review renders' light (`LowLight.sh`). */
export const SH_TERMS = 19;
/** Degrees the whole-body review renders' camera looks down (their fitted cameras: the man's 8, the woman's 7.5). */
const REVIEW_PITCH = 8;
const DEG = Math.PI / 180;
/** A low-poly body's outline in screen px at a zoom: a pixel at one, two at the closest. */
const LOW_INK = (zoom: number): number => Math.min(2, Math.max(1, 0.8 + 0.2 * zoom));

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in float aMat; layout(location=3) in vec4 aBones; layout(location=4) in vec4 aW; layout(location=5) in vec2 aStamp;
layout(location=6) in vec4 aFaceBones; layout(location=7) in vec4 aFaceW;
uniform vec4 uBones[${MAX_BONES * 3}];
uniform vec2 uEx, uEy; uniform float uHS; uniform vec3 uT; uniform vec2 uHalf; uniform float uDepth; uniform vec2 uOff; uniform float uLow;
uniform highp sampler2D uShapes; uniform int uShapeFrom, uShapeCount, uShapeK; uniform float uShapeW[${MAX_SHAPES}];
out vec3 vNrm; out vec3 vPos; flat out float vMat; flat out float vBone; out float vDepth; flat out float vMatB; out float vStamp; flat out vec3 vFace;
vec3 skinP(int b, vec3 p) { vec4 q = vec4(p, 1.0); return vec3(dot(uBones[b*3], q), dot(uBones[b*3+1], q), dot(uBones[b*3+2], q)); }
vec3 skinN(int b, vec3 n) { return vec3(dot(uBones[b*3].xyz, n), dot(uBones[b*3+1].xyz, n), dot(uBones[b*3+2].xyz, n)); }
void main() {
  // A garment's corrective shapes, by their weights, at rest: its offset and its polygon's normal's.
  vec3 rp = aPos, rn = aNrm;
  int c = gl_VertexID - uShapeFrom;
  if (c >= 0 && c < uShapeCount) {
    bool moved = false;
    for (int k = 0; k < ${MAX_SHAPES}; k++) {
      if (k >= uShapeK) break;
      float w = uShapeW[k]; if (w <= 0.0) continue;
      int t = (c * uShapeK + k) * 2;
      rp += w * texelFetch(uShapes, ivec2(t % ${SHAPE_ROW}, t / ${SHAPE_ROW}), 0).xyz;
      rn += w * texelFetch(uShapes, ivec2((t + 1) % ${SHAPE_ROW}, (t + 1) / ${SHAPE_ROW}), 0).xyz;
      moved = true;
    }
    if (moved) rn = normalize(rn);
  }
  vec3 p = vec3(0.0), n = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float w = aW[i]; if (w <= 0.0) continue;
    int b = int(aBones[i] + 0.5);
    p += w * skinP(b, rp); n += w * skinN(b, rn);
  }
  // A low-poly body's face normal: the polygon's own, turned by the polygon's weights (the same at all its corners).
  vec3 fn = vec3(0.0, 0.0, 1.0);
  if (uLow > 0.5) {
    fn = vec3(0.0);
    for (int i = 0; i < 4; i++) { float w = aFaceW[i]; if (w > 0.0) fn += w * skinN(int(aFaceBones[i] + 0.5), rn); }
    fn = normalize(fn);
  }
  vFace = fn;
  float sx = p.x * uEx.x + p.y * uEy.x - uOff.x;
  float sy = p.x * uEx.y + p.y * uEy.y - p.z * uHS - uOff.y;
  float d = -dot(p, uT);
  vNrm = normalize(n); vPos = p; vMat = aMat; vBone = aBones.x; vDepth = d; vMatB = aStamp.x; vStamp = aStamp.y;
  gl_Position = vec4(sx / uHalf.x, -sy / uHalf.y, d / uDepth, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNrm; in vec3 vPos; flat in float vMat; flat in float vBone; in float vDepth; flat in float vMatB; in float vStamp; flat in vec3 vFace;
uniform vec4 uMat[${MAX_MATS}];
uniform vec3 uL; uniform vec3 uT; uniform float uGrain; uniform float uNight; uniform float uMode; uniform float uFlat; uniform float uBlink;
uniform float uLow; uniform vec3 uSH[${SH_TERMS}]; uniform vec3 uTone; uniform vec3 uFit; uniform vec3 uXv, uYv, uZv;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oNd; layout(location=2) out vec4 oId;
vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy); vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// The review renders' light (tools/sculpt/lowlight.py): the skin's colour from the facet's normal in view space (x right,
// y up, z toward the viewer), real spherical harmonics to the third order and three rims, one coefficient set a channel.
vec3 lowLight(vec3 v) {
  float x = v.x, y = v.y, z = v.z, b = pow(1.0 - max(z, 0.0), 3.0);
  float t[${SH_TERMS}] = float[${SH_TERMS}](1.0, x, y, z, x * y, y * z, 3.0 * z * z - 1.0, x * z, x * x - y * y, y * (3.0 * x * x - y * y), x * y * z,
    y * (5.0 * z * z - 1.0), z * (5.0 * z * z - 3.0), x * (5.0 * z * z - 1.0), z * (x * x - y * y), x * (x * x - 3.0 * y * y),
    pow(max(0.0, dot(v, normalize(vec3(-0.95, 0.25, -0.2)))), 8.0), max(-x, 0.0) * b, max(x, 0.0) * b);
  vec3 c = vec3(0.0);
  for (int k = 0; k < ${SH_TERMS}; k++) c += t[k] * uSH[k];
  return max(c, 0.0);
}
vec3 hashCol(float i){ return 0.35 + 0.6 * vec3(hash(vec2(i, 1.0)), hash(vec2(i, 7.0)), hash(vec2(i, 13.0))); }
void main() {
  vec3 n = uLow > 0.5 ? vFace : normalize(vNrm);
  // The stamp's material where the stamp's distance says inside, its edge one pixel soft across the interpolated distance.
  float fw = max(fwidth(vStamp), 1e-4);
  float inStamp = smoothstep(-fw, fw, vStamp);
  int mi = inStamp > 0.5 ? int(vMatB + 0.5) : int(vMat + 0.5);
  vec4 M = mix(uMat[int(vMat + 0.5)], uMat[int(vMatB + 0.5)], inStamp);
  vec3 base = M.rgb;
  int flags = int(uMat[mi].a + 0.5);
  // Lids shut: the eye's parts take the lid's colour, the first material's a shade darker, and shade as skin.
  if (uBlink > 0.5 && (flags & 8) != 0) { base = uMat[0].rgb * 0.94; flags = 2; }
  bool emissive = (flags & 1) != 0, skin = (flags & 2) != 0, metal = (flags & 4) != 0, soft = (flags & 16) != 0, noInk = (flags & 32) != 0, noCrease = (flags & 64) != 0, thinInk = (flags & 128) != 0, cloth = (flags & 256) != 0, gear = (flags & 512) != 0, ramp = (flags & 1024) != 0, shave = (flags & 2048) != 0, valley = (flags & 4096) != 0;
  int step = (flags >> 13) & 3;
  float dl = dot(n, uL);
  vec3 c = base;
  if (uMode > 0.5) {
    if (uMode < 1.5) c = n * 0.5 + 0.5;
    else if (uMode < 2.5) c = hashCol(float(mi));
    else c = hashCol(vBone);
  } else if (emissive) {
    c = base;
  } else if (uLow > 0.5) {
    // A low-poly body as its review renders: one shade a polygon, skin lit by their light in the look's tone, cloth by the
    // same light in its own colour over the skin it was fitted to, the rest its colour.
    vec3 lv = vec3(dot(n, uXv), dot(n, uYv), dot(n, uZv)), lit = lowLight(lv);
    if (ramp) {
      // Hair: its colour, a mid tone or a highlight (toward a warm light) by the facet's light over the review skin's
      // (tools/sculpt/lowhairshot.mjs HAIR_RAMP, HAIR_TONES), each lit a little within its step so two facets part; a
      // facet in a valley in its valley's tone however lit (HAIR_VALLEYS, by its step).
      float l = dot(lit, vec3(0.3, 0.59, 0.11)) / 0.5382;
      vec3 W = vec3(1.0, 0.784, 0.667);
      float vt[4] = float[4](${HAIR_VALLEYS.map((x) => x.toFixed(3)).join(', ')});
      c = valley ? base * vt[step] : (l < 1.15 ? base : (l < 1.4 ? mix(base, W, 0.22) : mix(base, W, 0.45)));
      c = min(c * (1.0 + 0.45 * (l - (valley || l < 1.15 ? 0.95 : (l < 1.4 ? 1.275 : 1.5)))), 1.0);
    } else if (shave) {
      // The shaved scalp: the skin's light, its colour 0.65 of the way to the hair's (tools/sculpt/lowhairshot.mjs SHAVE).
      c = min(lit * uTone * mix(vec3(1.0), base / max(uMat[0].rgb, vec3(0.05)), 0.65), 1.0);
    } else {
      // and gear in hand (a sword) by its brightness only, as the gear's review renders light it
      const vec3 LUM = vec3(0.299, 0.587, 0.114);
      c = skin ? min(lit * uTone, 1.0) : cloth ? min(lit * base / uFit, 1.0) : gear ? min(base * (0.18 + 0.82 * dot(lit, LUM) / dot(uFit, LUM)), 1.0) : base;
    }
  } else if (uFlat > 0.5) {
    c = base;
  } else {
    // Ligne claire: a hard shadow shape and a hard highlight shape per surface, each a shifted hue, the terminator one pixel soft.
    vec3 h = rgb2hsv(base);
    bool warm = h.x < 0.2 || h.x > 0.9;
    float aa = fwidth(dl) * 1.2;
    float shadowAt = soft ? -0.85 : (skin ? -0.35 : -0.1), lightAt = metal ? 0.78 : (skin ? 0.72 : 0.64);
    // The face's half-shadow: a plane turned a little from the light, between the base and the shadow.
    float halfSh = soft ? (1.0 - smoothstep(-0.25 - aa, -0.25 + aa, dl)) * 0.35 : 0.0;
    float sh = 1.0 - smoothstep(shadowAt - aa, shadowAt + aa, dl);
    float li = smoothstep(lightAt - aa, lightAt + aa, dl);
    vec3 shadow, light;
    if (skin) {
      shadow = hsv2rgb(vec3(fract(h.x - 0.035), min(1.0, h.y * 1.22), h.z * 0.74));
      light = hsv2rgb(vec3(h.x, h.y * 0.9, min(1.0, h.z * 1.05)));
    } else {
      float toS = warm ? 0.02 : 0.78; float dS = toS - h.x; dS -= floor(dS + 0.5);
      shadow = hsv2rgb(vec3(fract(h.x + dS * 0.1), min(1.0, h.y * 1.15 + 0.08), h.z * 0.78));
      float toL = warm ? 0.15 : 0.5; float dL = toL - h.x; dL -= floor(dL + 0.5);
      light = hsv2rgb(vec3(fract(h.x + dL * 0.08), h.y * (metal ? 0.6 : 0.88), min(1.0, h.z * (metal ? 1.2 : 1.1) + 0.02)));
    }
    c = mix(mix(base, light, li), shadow, max(sh, halfSh));
    // A rim where the surface turns from the viewer, in the shadow's hue: the form's edge read without a line.
    float rim = pow(1.0 - clamp(dot(n, uT), 0.0, 1.0), 4.0);
    c = mix(c, shadow, rim * 0.2 * (1.0 - li));
    // The grain, a breath of broken colour.
    c += (hash(floor(gl_FragCoord.xy / 2.0)) - 0.5) * uGrain;
  }
  if (!emissive && uMode < 0.5) c = mix(c, vec3(12.0, 20.0, 44.0) / 255.0, uNight * 0.68);
  oCol = vec4(c, 1.0);
  oNd = vec4(n * 0.5 + 0.5, vDepth);
  oId = vec4(float(mi) / 255.0, emissive ? 1.0 : 0.0, noInk ? 1.0 : (noCrease ? 0.5 : 0.0), thinInk ? 0.5 : 1.0);
}`;

const EDGE_VS = `#version 300 es
in vec2 aP; out vec2 vUv; void main(){ vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;

const EDGE_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uCol; uniform sampler2D uNd; uniform sampler2D uId; uniform vec2 uPx; uniform float uInk; uniform float uDepthStep; uniform float uShow; uniform float uNight; uniform float uInner;
out vec4 o;
vec3 inkOf(vec3 base) { return min(mix(base, vec3(0.157, 0.11, 0.102), 0.62), base * 0.5); }
void main() {
  vec4 c = texture(uCol, vUv);
  vec4 nd = texture(uNd, vUv);
  vec4 id = texture(uId, vUv);
  // The silhouette: an even band uInk px wide just outside the body, in a dark of the nearest body colour.
  float sil = 0.0; vec3 near = vec3(0.0);
  if (c.a < 0.5 && uInk > 0.0) {
    float best = 1.0e9;
    for (int d = 0; d < 16; d++) {
      float a = float(d) * 0.3927;
      vec2 dir = vec2(cos(a) * uPx.x, sin(a) * uPx.y);
      for (int k = 1; k <= 6; k++) {
        float t = float(k) / 6.0 * uInk;
        if (t >= best) break;
        vec4 sm = texture(uCol, vUv + dir * t);
        if (sm.a > 0.5) { if (texture(uId, vUv + dir * t).a > 0.75 || t <= uInk * 0.4) { sil = 1.0; best = t; near = sm.rgb; } break; }
      }
    }
  }
  // Inside: a thinner line where a part stands in front of another (a step away in depth to a pixel beside), or at a sharp crease.
  float inner = 0.0;
  if (c.a > 0.5 && uInner > 0.5) {
    vec4 A = texture(uNd, vUv + vec2(uPx.x, 0.0)), B = texture(uNd, vUv - vec2(uPx.x, 0.0)), C = texture(uNd, vUv + vec2(0.0, uPx.y)), D = texture(uNd, vUv - vec2(0.0, uPx.y));
    float dz = max(max(A.w - nd.w, B.w - nd.w), max(C.w - nd.w, D.w - nd.w));
    vec3 n0 = nd.xyz * 2.0 - 1.0;
    float crease = min(min(dot(n0, A.xyz * 2.0 - 1.0), dot(n0, B.xyz * 2.0 - 1.0)), min(dot(n0, C.xyz * 2.0 - 1.0), dot(n0, D.xyz * 2.0 - 1.0)));
    float aA = texture(uCol, vUv + vec2(uPx.x, 0.0)).a, aB = texture(uCol, vUv - vec2(uPx.x, 0.0)).a, aC = texture(uCol, vUv + vec2(0.0, uPx.y)).a, aD = texture(uCol, vUv - vec2(0.0, uPx.y)).a;
    bool rim = min(min(aA, aB), min(aC, aD)) < 0.5;
    if (rim) inner = 1.0;
    // A part with no ink of its own (an ear, a mitt) still takes a line where it stands well off what is behind it.
    else if (id.b > 0.75) inner = dz > uDepthStep * 0.3 ? 0.55 : 0.0;
    else if (id.b > 0.25) inner = 0.0;
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

/*
 * The slash trail over a body (`SculptDraw.trail`): a ribbon in the figure's frame, projected as the body is, drawn after
 * the ink onto the canvas, hidden where the body stands in front of it (its depth, from the body's pass), its edges soft.
 * Plain: pale and see-through, washed at night as the body is. Lit (an enchanted blade): the sword's gold, brighter than
 * it is opaque, so it adds light over what is behind it, and kept through the night.
 */
const TRAIL_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aAV;
uniform vec2 uEx, uEy; uniform float uHS; uniform vec3 uT; uniform vec2 uHalf; uniform vec2 uOff;
out float vA; out float vV; out float vDepth;
void main() {
  float sx = aPos.x * uEx.x + aPos.y * uEy.x - uOff.x;
  float sy = aPos.x * uEx.y + aPos.y * uEy.y - aPos.z * uHS - uOff.y;
  vDepth = -dot(aPos, uT); vA = aAV.x; vV = aAV.y;
  gl_Position = vec4(sx / uHalf.x, -sy / uHalf.y, 0.0, 1.0);
}`;
const TRAIL_FS = `#version 300 es
precision highp float;
in float vA; in float vV; in float vDepth;
uniform sampler2D uCol; uniform sampler2D uNd; uniform vec2 uPx; uniform vec3 uRgb; uniform vec3 uEdge; uniform float uLit; uniform float uNight;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uPx;
  if (texture(uCol, uv).a > 0.5 && texture(uNd, uv).w < vDepth + ${TRAIL_BEHIND.toFixed(2)}) discard;
  float a = clamp(vA, 0.0, 1.0) * smoothstep(0.0, 0.35, vV) * (1.0 - smoothstep(0.8, 1.0, vV));
  vec3 c = mix(uEdge, uRgb, smoothstep(0.15, 0.85, vV));
  if (uLit < 0.5) { c = mix(c, vec3(12.0, 20.0, 44.0) / 255.0, uNight * 0.68); a *= ${TRAIL_PLAIN.toFixed(2)}; o = vec4(c * a, a); }
  else { float k = a * ${TRAIL_LIT.toFixed(2)}; o = vec4(c * k * (1.0 + ${TRAIL_ADD.toFixed(2)} * a), k); }
}`;

const WIRE_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.1, 0.08, 0.1, 1.0); }`;

interface Ctx {
  gl: WebGL2RenderingContext; cv: HTMLCanvasElement; prog: WebGLProgram; edge: WebGLProgram; wire: WebGLProgram;
  /** The slash trail's program, its uniforms and its buffer, made the first time one is drawn. */
  trail?: { prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; buf: WebGLBuffer };
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
  const names = ['uBones', 'uEx', 'uEy', 'uHS', 'uT', 'uHalf', 'uDepth', 'uOff', 'uMat', 'uL', 'uGrain', 'uNight', 'uMode', 'uFlat', 'uBlink', 'uLow', 'uSH', 'uTone', 'uFit', 'uXv', 'uYv', 'uZv', 'uShapes', 'uShapeFrom', 'uShapeCount', 'uShapeK', 'uShapeW'];
  const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  const wu = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(wire, n)]));
  const eu = Object.fromEntries(['uCol', 'uNd', 'uId', 'uPx', 'uInk', 'uDepthStep', 'uShow', 'uNight', 'uInner'].map((n) => [n, gl.getUniformLocation(edge, n)]));
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

interface Buffers { vbo: WebGLBuffer; ibo: WebGLBuffer; lines: WebGLBuffer; nLines: number; face: WebGLBuffer | null; shapes: WebGLTexture | null }
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
  let face: WebGLBuffer | null = null;
  if (b.faceSkin) {
    face = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, face);
    gl.bufferData(gl.ARRAY_BUFFER, b.faceSkin, gl.STATIC_DRAW);
  }
  let shapes: WebGLTexture | null = null;
  if (b.shapes) {
    // each vertex's shapes, two texels a shape, run on along rows of SHAPE_ROW
    const n = b.shapes.count * b.shapes.shapes * 2, rows = Math.ceil(n / SHAPE_ROW), px = new Float32Array(rows * SHAPE_ROW * 4);
    px.set(b.shapes.data.subarray(0, n * 4));
    shapes = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, shapes);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, SHAPE_ROW, rows);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SHAPE_ROW, rows, gl.RGBA, gl.FLOAT, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  bf = { vbo, ibo, lines, nLines: ln.length, face, shapes };
  BUFFERS.set(b, bf);
  return bf;
}

/** A bake's buffers on the graphics chip let go, for a bake that is going. */
export function forgetBuffers(b: Baked): void {
  const bf = BUFFERS.get(b);
  if (!bf || !CTX) return;
  CTX.gl.deleteBuffer(bf.vbo); CTX.gl.deleteBuffer(bf.ibo); CTX.gl.deleteBuffer(bf.lines);
  if (bf.face) CTX.gl.deleteBuffer(bf.face);
  if (bf.shapes) CTX.gl.deleteTexture(bf.shapes);
  BUFFERS.delete(b);
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
    f.set([c[0], c[1], c[2], (m.emissive ? 1 : 0) + (m.skin ? 2 : 0) + (m.metal ? 4 : 0) + (m.eye ? 8 : 0) + (m.soft ? 16 : 0) + (m.noInk ? 32 : 0) + (m.noCrease ? 64 : 0) + (m.thinInk ? 128 : 0) + (m.cloth ? 256 : 0) + (m.gear ? 512 : 0) + (m.ramp ? 1024 : 0) + (m.shave ? 2048 : 0) + (m.valley ? 4096 + (m.valley - 1) * 8192 : 0)], i * 4);
  });
  MATS.set(ms, f);
  return f;
}

/**
 * A low-poly body's light, as its review renders (`tools/sculpt/lowlight.py`): per term (`SH_TERMS`) the red, green and
 * blue coefficients nought to one, and the look's skin over the skin the light was fitted to, per channel; a garment's
 * cloth is lit by the same light in its own colour over that skin.
 */
export interface LowLight {
  sh: Float32Array; tone: [number, number, number];
  /** The skin the light was fitted to, red, green and blue nought to one: a cloth's colour over it tints the light. */
  fit: [number, number, number];
}
/** What one draw needs: the bake, the pose's skinning frames, the materials and the view. */
export interface SculptDraw {
  baked: Baked; bones: Float32Array; materials: Material[]; view: View; /** Lids shut, past a half. */ blink?: number;
  /** A low-poly body (`./lowpoly`): one shade a polygon (the bake's `faceSkin`) in this light. */
  low?: LowLight;
  /** A slash trail over it (`./anim/trail.ts`). */
  trail?: TrailDraw;
  /** The weight of each of the bake's corrective shapes (`Baked.shapes`) in this pose, nought to one. */
  shapes?: ArrayLike<number>;
}
/**
 * A slash trail as drawn: a triangle strip, five numbers a point (x, y, z in the figure's frame as the body's skinned
 * points are; how opaque, nought to one; across the ribbon, nought at its inner edge to one at the point's), and whether
 * it is lit (an enchanted blade's).
 */
export interface TrailDraw { strip: Float32Array; n: number; lit: boolean }

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
  const low = d.low && bf.face ? d.low : undefined;
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
    gl.uniform1f(u.uLow, low ? 1 : 0);
    // the garment's corrective shapes: only while one weighs anything (their sampler on a unit of its own always, never
    // on one of the frame's own textures)
    gl.uniform1i(u.uShapes, 3);
    const sh = d.baked.shapes, sw = d.shapes, on = !!(sh && bf.shapes && sw && Array.prototype.some.call(sw, (x: number) => x > 0));
    gl.uniform1i(u.uShapeFrom, on ? (sh as NonNullable<typeof sh>).from : 0);
    gl.uniform1i(u.uShapeCount, on ? (sh as NonNullable<typeof sh>).count : 0);
    gl.uniform1i(u.uShapeK, on ? Math.min(MAX_SHAPES, (sh as NonNullable<typeof sh>).shapes) : 0);
    if (on) {
      SHAPE_W.fill(0);
      for (let k = 0; k < Math.min(MAX_SHAPES, sw!.length); k++) SHAPE_W[k] = sw![k];
      gl.uniform1fv(u.uShapeW, SHAPE_W);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, bf.shapes);
    }
    if (low) {
      gl.uniform3fv(u.uSH, low.sh);
      gl.uniform3f(u.uTone, low.tone[0], low.tone[1], low.tone[2]);
      gl.uniform3f(u.uFit, low.fit[0], low.fit[1], low.fit[2]);
      // The normal in the review camera's view space: the screen's right, and up and toward the viewer pitched down as
      // that camera is rather than as the island's, so a face turned as in a review render takes its tone there.
      const xr = Math.hypot(v.ex[0], v.ey[0]) || 1, hr = Math.hypot(v.T[0], v.T[1]) || 1;
      const cb = Math.cos(REVIEW_PITCH * DEG), sb = Math.sin(REVIEW_PITCH * DEG), h = [v.T[0] / hr, v.T[1] / hr];
      gl.uniform3f(u.uXv, v.ex[0] / xr, v.ey[0] / xr, 0);
      gl.uniform3f(u.uYv, -sb * h[0], -sb * h[1], cb);
      gl.uniform3f(u.uZv, cb * h[0], cb * h[1], sb);
    }
  };
  setCommon(C.prog, C.u);
  gl.bindBuffer(gl.ARRAY_BUFFER, bf.vbo);
  const stride = STRIDE * 4;
  for (const [i, sz, off] of [[0, 3, 0], [1, 3, 12], [2, 1, 24], [3, 4, 28], [4, 4, 44], [5, 2, 60]]) {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, sz, gl.FLOAT, false, stride, off);
  }
  if (low && bf.face) {
    gl.bindBuffer(gl.ARRAY_BUFFER, bf.face);
    for (const [i, off] of [[6, 0], [7, 16]]) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, off);
    }
  } else for (const i of [6, 7]) gl.disableVertexAttribArray(i);
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
  for (let i = 1; i < 8; i++) gl.disableVertexAttribArray(i);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, C.tCol); gl.uniform1i(C.eu.uCol, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, C.tNd); gl.uniform1i(C.eu.uNd, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, C.tId); gl.uniform1i(C.eu.uId, 2);
  gl.uniform2f(C.eu.uPx, 1 / w, 1 / h);
  // The figure's ink: most of a pixel however far out, never more than a few however far in; in device pixels here.
  // A low-poly body's: LOW_INK's, round the silhouette only, as its facets carry the form.
  const ink = (o.ink ?? (low ? LOW_INK(zoom) : Math.min(3.2, Math.max(0.9, 0.55 * zoom)))) * dpr;
  gl.uniform1f(C.eu.uInk, ink);
  gl.uniform1f(C.eu.uInner, low ? 0 : 1);
  gl.uniform1f(C.eu.uDepthStep, 0.7);
  gl.uniform1f(C.eu.uShow, o.debug === 'edges' ? 1 : 0);
  gl.uniform1f(C.eu.uNight, o.night ?? 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (d.trail && d.trail.n > 2) drawTrail(C, d, d.trail, w, h, o.night ?? 0);
  gl.flush();
  ctx.drawImage(C.cv, 0, 0, w, h, sx + BOX.left * zoom, sy + BOX.top * zoom, w / dpr, h / dpr);
  return true;
}

/** The slash trail onto the canvas over the inked body, blended (premultiplied), the body's colour and depth textures still bound. */
function drawTrail(C: Ctx, d: SculptDraw, t: TrailDraw, w: number, h: number, night: number): void {
  const { gl } = C;
  if (!C.trail) {
    const prog = compile(gl, TRAIL_VS, TRAIL_FS);
    C.trail = { prog, buf: gl.createBuffer()!, u: Object.fromEntries(['uEx', 'uEy', 'uHS', 'uT', 'uHalf', 'uOff', 'uCol', 'uNd', 'uPx', 'uRgb', 'uEdge', 'uLit', 'uNight'].map((n) => [n, gl.getUniformLocation(prog, n)])) };
  }
  const { prog, u, buf } = C.trail, v = d.view, rgb = t.lit ? TRAIL_RGB.lit : TRAIL_RGB.plain;
  gl.useProgram(prog);
  gl.uniform2f(u.uEx, v.ex[0], v.ex[1]);
  gl.uniform2f(u.uEy, v.ey[0], v.ey[1]);
  gl.uniform1f(u.uHS, HEIGHT_SCALE);
  gl.uniform3f(u.uT, v.T[0], v.T[1], v.T[2]);
  gl.uniform2f(u.uHalf, (BOX.right - BOX.left) / 2, (BOX.bottom - BOX.top) / 2);
  gl.uniform2f(u.uOff, (BOX.left + BOX.right) / 2, (BOX.top + BOX.bottom) / 2);
  gl.uniform1i(u.uCol, 0);
  gl.uniform1i(u.uNd, 1);
  gl.uniform2f(u.uPx, 1 / w, 1 / h);
  gl.uniform3fv(u.uRgb, hexOf(rgb.mid));
  gl.uniform3fv(u.uEdge, hexOf(rgb.edge));
  gl.uniform1f(u.uLit, t.lit ? 1 : 0);
  gl.uniform1f(u.uNight, night);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, t.strip.subarray(0, t.n * 5), gl.DYNAMIC_DRAW);
  for (let i = 2; i < 8; i++) gl.disableVertexAttribArray(i);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, t.n);
  gl.disable(gl.BLEND);
}

const SHAPE_W = new Float32Array(MAX_SHAPES);
let PAD: Float32Array | null = null;
function padded(b: Float32Array): Float32Array {
  if (!PAD) PAD = new Float32Array(MAX_BONES * 12);
  PAD.fill(0);
  PAD.set(b.subarray(0, Math.min(b.length, PAD.length)));
  return PAD;
}
