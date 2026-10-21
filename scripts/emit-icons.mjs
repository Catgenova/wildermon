/**
 * The home-screen icons (src/public/icons/), drawn from the favicon's tile in
 * src/index.html: the same three faces, on the boot screen's sea, centred and
 * inside the middle of the square so a launcher that crops to a circle
 * (`maskable`) keeps all of it. Run by `npm run build`; the same bytes every
 * time, so a rebuild changes nothing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = 'src/public/icons';

/** The boot screen's sea (#boot in src/style.css), which is also the manifest's background. */
const SEA = [0x12, 0x39, 0x5f];
/** The favicon's faces, in its own 32-unit square: top, left, right. */
const FACES = [
  { rgb: [0x5c, 0x9a, 0x3e], pts: [[16, 3], [30, 11], [16, 19], [2, 11]] },
  { rgb: [0x79, 0x5c, 0x3c], pts: [[2, 11], [2, 19], [16, 27], [16, 19]] },
  { rgb: [0x4f, 0x3c, 0x27], pts: [[30, 11], [30, 19], [16, 27], [16, 19]] },
];
/** The tile's width as a share of the icon's: inside the 80% circle a maskable icon promises to keep. */
const SPAN = 0.62;
/** Samples a pixel is split into along each side, for smooth edges. */
const AA = 4;

const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

const inside = (pts, x, y) => {
  // Convex and wound one way: on the same side of every edge.
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c === 0) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
};

function draw(size) {
  const scale = (SPAN * size) / 28;
  // The tile spans 2..30 across and 3..27 down; its middle goes to the icon's.
  const ox = size / 2 - 16 * scale;
  const oy = size / 2 - 15 * scale;
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < AA; sy++) {
        for (let sx = 0; sx < AA; sx++) {
          const ux = (x + (sx + 0.5) / AA - ox) / scale;
          const uy = (y + (sy + 0.5) / AA - oy) / scale;
          const face = FACES.find((f) => inside(f.pts, ux, uy));
          const c = face ? face.rgb : SEA;
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

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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
console.log(`Drew ${Object.keys(SIZES).map((n) => `${OUT}/${n}`).join(', ')}.`);
