// lowids.mjs who out.bin: per view of the top row (front q3 profile r3 back), the id of the polygon nearest the viewer
// at each sheet pixel (x 0..1536, y 0..460, down to the stub's cut), -1 for none; and out.bin.names.json, each polygon's name. For lowlight.py.
// lowids.mjs who out.bin --torso: the torso (tools/sculpt/lowtorso.mjs), all eight of its views, over the whole sheet
// (y 0..1024), for the shape-only comparison (tools/sculpt/lowshape.py).
import { writeFileSync } from 'node:fs';
const W = new URL('.', import.meta.url).href;
const { buildLowHead } = await import(W + 'lowhead.mjs');
const { buildLowTorso } = await import(W + 'lowtorso.mjs');
const { loadCams, project, TORSO_VIEWS } = await import(W + 'lowcam.mjs');
const who = process.argv[2], out = process.argv[3], torso = process.argv.includes('--torso');
const mesh = torso ? buildLowTorso(who) : buildLowHead(who);
const names = mesh.polys.map((p, i) => p.name ?? (p.ear ? 'ear' : p.mat) + '#' + i);
const cams = loadCams(who, torso ? 'torso' : 'head');
const Wd = 1536, H = torso ? 1024 : 460;
const views = torso ? TORSO_VIEWS : ['front', 'q3', 'profile', 'r3', 'back'];
const buf = new Int32Array(views.length * Wd * H).fill(-1);
views.forEach((v, vi) => {
  const depth = new Float32Array(Wd * H).fill(-1e9);
  const c = cams[v];
  for (const t of mesh.tris) {
    const pr = t.v.map((i) => project(mesh.verts[i], c));
    const area = (pr[1][0] - pr[0][0]) * (pr[2][1] - pr[0][1]) - (pr[1][1] - pr[0][1]) * (pr[2][0] - pr[0][0]);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(...pr.map((p) => p[0])))), maxx = Math.min(Wd - 1, Math.ceil(Math.max(...pr.map((p) => p[0]))));
    const miny = Math.max(0, Math.floor(Math.min(...pr.map((p) => p[1])))), maxy = Math.min(H - 1, Math.ceil(Math.max(...pr.map((p) => p[1]))));
    for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
      const x = i + 0.5, y = j + 0.5;
      const b0 = ((pr[1][0] - x) * (pr[2][1] - y) - (pr[1][1] - y) * (pr[2][0] - x)) / area;
      const b1 = ((pr[2][0] - x) * (pr[0][1] - y) - (pr[2][1] - y) * (pr[0][0] - x)) / area;
      const b2 = 1 - b0 - b1;
      if (b0 < 0 || b1 < 0 || b2 < 0) continue;
      const z = b0 * pr[0][2] + b1 * pr[1][2] + b2 * pr[2][2] + (t.mat !== 'skin' ? 0.01 : 0);
      const k = j * Wd + i;
      if (z > depth[k]) { depth[k] = z; buf[vi * Wd * H + k] = t.poly; }
    }
  }
});
writeFileSync(out, Buffer.from(buf.buffer));
writeFileSync(out + '.names.json', JSON.stringify(names));
