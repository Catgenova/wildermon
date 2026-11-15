/**
 * The site's icon, one drawing: a wildermon crate, a crate in the rune pastel
 * kit's oak (the left face in the light, the right turned to mauve, a dark
 * seam between its boards) with a wildermon's head and ears up out of its
 * open top, every shape ruled round in the kit's ink.
 *
 * From the shapes below this writes the favicon, an SVG in a data URI, into
 * every page that has one (`<link rel="icon">` in src/index.html,
 * src/account.html and scripts/wildermon.html), and draws the home-screen
 * icons (src/public/icons/) from the same shapes, on the boot screen's sea,
 * centred and inside the middle of the square so a launcher that crops to a
 * circle (`maskable`) keeps all of it. Run by `npm run build`; the same bytes
 * every time, so a rebuild changes nothing.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = 'src/public/icons';
/** The pages whose favicon this writes. */
const PAGES = ['src/index.html', 'src/account.html', 'scripts/wildermon.html'];

/** The boot screen's sea (#boot in src/style.css), which is also the manifest's background. */
const SEA = '#12395f';

/* ---- the drawing, in a 32-unit square ------------------------------------------------- */

/** The kit's ink, and how wide it is ruled. */
const INK = '#4a3240';
const LINE = 1.1;
/** Oak as the kit tones it: a top worn pale, the side in the light, the side turned away, the dark inside. */
const RIM = '#ecd0a2';
const LIT = '#d6ae80';
const SHADE = '#8f7262';
const SEAM = '#6e5060';
const INSIDE = '#4a3448';
/** A snufflet's coat and its ears' pink, its eyes plum. */
const COAT = '#f6e9da';
const PINK = '#eda4ae';
const EYE = '#3a2436';

/** An ellipse as a polygon of 28 corners, turned `rot` radians. */
const ellipse = (cx, cy, rx, ry, rot = 0) => Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});

// The crate: its top's four corners (left, back, right, front), how tall it stands, and its rim.
const L = [3, 18], B = [16, 11.5], R = [29, 18], F = [16, 24.5];
const H = 6.5;
const down = ([x, y]) => [x, y + H];
const inset = (p, k) => [16 + (p[0] - 16) * k, 18 + (p[1] - 18) * k];
const IL = inset(L, 0.8), IB = inset(B, 0.8), IR = inset(R, 0.8), IF = inset(F, 0.8);
/** A seam across a face from `a` to `b` (its top corners), `t` of the way down it. */
const seam = (a, b, t) => {
  const y = H * t, w = 0.55;
  return [[a[0], a[1] + y - w], [b[0], b[1] + y - w], [b[0], b[1] + y + w], [a[0], a[1] + y + w]];
};

/** Back to front, each filled and then ruled round (`line` its width, nought for none). */
const SHAPES = [
  // The top, and the dark inside it.
  { fill: RIM, line: LINE, pts: [L, B, R, F] },
  { fill: INSIDE, line: 0, pts: [IL, IB, IR, IF] },
  // The ears, then the head, up out of it.
  { fill: COAT, line: LINE, pts: ellipse(11.4, 6, 2.2, 4.8, -0.3) },
  { fill: PINK, line: 0, pts: ellipse(11.45, 6.4, 1, 3.2, -0.3) },
  { fill: COAT, line: LINE, pts: ellipse(20.6, 6, 2.2, 4.8, 0.3) },
  { fill: PINK, line: 0, pts: ellipse(20.55, 6.4, 1, 3.2, 0.3) },
  { fill: COAT, line: LINE, pts: ellipse(16, 13.6, 7.2, 5.8) },
  { fill: EYE, line: 0, pts: ellipse(13, 13.4, 1.25, 1.6) },
  { fill: EYE, line: 0, pts: ellipse(19, 13.4, 1.25, 1.6) },
  { fill: PINK, line: 0, pts: ellipse(16, 15.9, 1, 0.65) },
  // The near half of the rim, over the head's foot.
  { fill: RIM, line: LINE, pts: [L, IL, IF, IR, R, F] },
  // Its two sides, a seam across each.
  { fill: LIT, line: LINE, pts: [L, F, down(F), down(L)] },
  { fill: SEAM, line: 0, pts: seam(L, F, 0.5) },
  { fill: SHADE, line: LINE, pts: [F, R, down(R), down(F)] },
  { fill: SEAM, line: 0, pts: seam(F, R, 0.5) },
];
/** What the drawing covers, ink and all. */
const BOX = (() => {
  const all = SHAPES.flatMap((s) => s.pts);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  return [Math.min(...xs) - LINE / 2, Math.min(...ys) - LINE / 2, Math.max(...xs) + LINE / 2, Math.max(...ys) + LINE / 2];
})();

/* ---- the favicon ----------------------------------------------------------------------- */

const n = (v) => Number(v.toFixed(2));
const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>${SHAPES.map((s) => {
  const d = `M${s.pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' ')}z`;
  return `<path d='${d}' fill='${s.fill}'${s.line ? ` stroke='${INK}' stroke-width='${s.line}' stroke-linejoin='round'` : ''}/>`;
}).join('')}</svg>`;
const href = `data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}`;
for (const page of PAGES) {
  const was = readFileSync(page, 'utf8');
  const now = was.replace(/<link rel="icon" href="data:image\/svg\+xml,[^"]*"/, `<link rel="icon" href="${href}"`);
  if (!/<link rel="icon" href="data:image\/svg\+xml,/.test(was)) throw new Error(`${page}: no <link rel="icon"> to write the favicon into.`);
  if (now !== was) writeFileSync(page, now);
}

/* ---- the home-screen icons ------------------------------------------------------------- */

/** The drawing's longer side as a share of the icon's: its corners inside the 80% circle a maskable icon promises to keep. */
const SPAN = 0.6;
/** Samples a pixel is split into along each side, for smooth edges. */
const AA = 4;

const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Each shape with its colour and the box round it and its ink, so a point outside the box is passed over at once. */
const PAINT = SHAPES.map((s) => {
  const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]), m = s.line / 2;
  return { ...s, fillRgb: rgbOf(s.fill), box: [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m] };
});
const INK_RGB = rgbOf(INK);

/** Whether (x, y) is inside a polygon, any shape: the crossings of a ray to the right. */
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c;
  }
  return c;
}
/** How far (x, y) is from a polygon's edge. */
function edgeDistance(pts, x, y) {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l));
    d = Math.min(d, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return d;
}
/** The colour at (x, y) in the drawing's units: the last shape there, its ink over its fill. */
function colourAt(x, y) {
  let c = null;
  for (const s of PAINT) {
    if (x < s.box[0] || y < s.box[1] || x > s.box[2] || y > s.box[3]) continue;
    if (s.line && edgeDistance(s.pts, x, y) <= s.line / 2) c = INK_RGB;
    else if (inside(s.pts, x, y)) c = s.fillRgb;
  }
  return c;
}

function draw(size) {
  const [x0, y0, x1, y1] = BOX;
  const scale = (SPAN * size) / Math.max(x1 - x0, y1 - y0);
  // The drawing's middle goes to the icon's.
  const ox = size / 2 - ((x0 + x1) / 2) * scale;
  const oy = size / 2 - ((y0 + y1) / 2) * scale;
  const sea = rgbOf(SEA);
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < AA; sy++) {
        for (let sx = 0; sx < AA; sx++) {
          const ux = (x + (sx + 0.5) / AA - ox) / scale;
          const uy = (y + (sy + 0.5) / AA - oy) / scale;
          const c = colourAt(ux, uy) ?? sea;
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (y * size + x) * 3;
      px[i] = Math.round(r / (AA * AA));
      px[i + 1] = Math.round(g / (AA * AA));
      px[i + 2] = Math.round(b / (AA * AA));
    }
  }
  return png(size, size, px);
}

const CRC = new Uint32Array(256).map((_, k) => {
  let c = k;
  for (let q = 0; q < 8; q++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** An opaque 8-bit RGB PNG. */
function png(w, h, rgb) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(rows, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of Object.entries(SIZES)) writeFileSync(`${OUT}/${name}`, draw(size));
console.log(`Drew ${Object.keys(SIZES).map((k) => `${OUT}/${k}`).join(', ')}, and the favicon in ${PAGES.join(', ')}.`);
