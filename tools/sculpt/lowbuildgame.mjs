// Bodies at a job in the game's own renderer (drawFigure with the sculpted bodies on), each cell the body at a moment of
// its job's clip (`FigurePose.act`: the clip's own time, one run a go), for the clips of lifting, setting down, taking
// apart, bridges and aqueducts (src/sculpt/anim/clips/build.ts). With --box, a stand-in load drawn where the clip's two
// reached hands hold it (between them where they are less than `--width` apart, else on the ground ahead), so the grip
// can be checked; with --dots, each reached hand's place as a dot; with --still, drawn with Animations Off (the still pose).
//
//   node tools/sculpt/lowbuildgame.mjs --job pick_up_anvil --out <dir> [--name sheet] [--zoom 10] [--box] [--dots]
//       [--times 0,0.5,1 | --frames 8] [--facings 0,1,2,5] [--genders man,woman] [--outfits cloth,plate] [--close] [--strip]
//   node tools/sculpt/lowbuildgame.mjs --sheets <list.json> --out <dir>
//     writes <dir>/<name>.png: a row a moment (a time into the clip's run; the key poses where no times are given), a cell
//     for each gender, outfit and facing, labelled; --strip: a row a body, its moments across. --close cuts each cell to
//     the body. --sheets: many sheets in one browser, a JSON list of { name, job, and any of the options above by name }.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; --scale 2 draws every cell at twice the zoom.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowbuild'));
const scale = +opt('scale', '1');
const list = (v, f) => (Array.isArray(v) ? v : String(v ?? f).split(','));
const sheetOf = (o) => ({
  name: o.name ?? o.job, job: o.job, zoom: +(o.zoom ?? 10) * scale, facings: list(o.facings, '0,1,2,5').map(Number), genders: list(o.genders, 'man,woman'),
  outfits: list(o.outfits, 'cloth'), close: !!o.close, strip: !!o.strip, times: o.times ?? '', frames: +(o.frames ?? 0), box: !!o.box, dots: !!o.dots, width: +(o.width ?? 0.3), still: !!o.still,
});
const sheets = opt('sheets', '') ? JSON.parse(readFileSync(opt('sheets', ''), 'utf8')).map(sheetOf)
  : [sheetOf({ name: opt('name', undefined), job: opt('job', 'pick_up_crate'), zoom: opt('zoom', '10'), facings: opt('facings', '0,1,2,5'), genders: opt('genders', 'man,woman'), outfits: opt('outfits', 'cloth'), close: flag('close'), strip: flag('strip'), times: opt('times', ''), frames: opt('frames', '0'), box: flag('box'), dots: flag('dots'), width: opt('width', '0.3'), still: flag('still') })];
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import './src/game/actions';
import { drawFigure, onScreen, sculptedFigures, viewOf } from './src/render/figure';
import { kitSync } from './src/render/kitpieces';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS, clipFor } from './src/sculpt/anim';
import { handsAt } from './src/sculpt/anim/clip';
import { heightOf } from './src/sculpt/rig';
import { humanProportions } from './src/sculpt/human';
import { WOMAN_OF_MAN } from './src/sculpt/lowpoly';
import { setAnimations } from './src/engine/motion';
kitSync(true);
const OUTFITS = {
  none: {},
  cloth: { chest: { id: 'cloth_tunic' }, legs: { id: 'cloth_trousers' }, feet: { id: 'cloth_shoes' } },
  leather: { chest: { id: 'leather_jerkin' }, shawl: { id: 'leather_shawl' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' }, head: { id: 'leather_cap' } },
  plate: { chest: { id: 'plate_breastplate', material: 'iron' }, shawl: { id: 'plate_shawl', material: 'iron' }, legs: { id: 'plate_legs', material: 'iron' }, feet: { id: 'plate_boots', material: 'iron' }, head: { id: 'helm', material: 'iron' } },
};
const poseOf = (S, gender, outfit, facing, t, clip) => ({ phase: t * 6, moving: false, gait: 0, facing, swimming: false, working: true, job: S.job, act: { t, length: clip.length },
  look: { ...DEFAULT_LOOK, gender, beard: 'none' }, gear: OUTFITS[outfit] ?? {} });
window.clipInfo = (job) => { const c = clipFor(poseOf({ job }, 'man', 'cloth', 1, 0, { length: 1 }))?.clip; return { name: c?.name, length: c?.length, poses: c?.poses ?? [] }; };
window.ready = async () => {
  sculptedFigures(true); await import('./src/sculpt/sculpted');
  await new Promise((r) => setTimeout(r, 100));
  return !!(await import('./src/sculpt/gl')).glContext();
};
/** A box's eight corners (figure frame: x right, y forward, z up; game units) drawn as its faces seen, painted far to near. */
function drawBox(g, v, sx, sy, zoom, c, half) {
  const P = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) P.push([c[0] + a * half[0], c[1] + b * half[1], c[2] + d * half[2]]);
  const at = (i) => { const s = onScreen(v, P[i]); return [sx + s[0] * zoom, sy + s[1] * zoom]; };
  // faces: by corner index (a*4 + b*2 + d over -1/+1 as 0/1), each with its outward way
  const F = [[[0, 1, 3, 2], [-1, 0, 0]], [[4, 5, 7, 6], [1, 0, 0]], [[0, 1, 5, 4], [0, -1, 0]], [[2, 3, 7, 6], [0, 1, 0]], [[1, 3, 7, 5], [0, 0, 1]]];
  const T = v.T, shade = { '-1,0,0': '#b0773c', '1,0,0': '#b0773c', '0,-1,0': '#9a6534', '0,1,0': '#9a6534', '0,0,1': '#d29a5a' };
  g.save(); g.globalAlpha = 0.72; g.strokeStyle = '#3b2412'; g.lineWidth = 1;
  for (const [idx, n] of F) {
    if (n[0] * T[0] + n[1] * T[1] + n[2] * T[2] < 0) continue;
    g.beginPath(); idx.forEach((i, k) => { const p = at(i); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath();
    g.fillStyle = shade[n.join(',')]; g.fill(); g.stroke();
  }
  g.restore();
}
const cell = (S, W, H, gender, outfit, facing, t, label) => {
  const zoom = S.zoom, pose = poseOf(S, gender, outfit, facing, t, { length: window.clipInfo(S.job).length }), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, W, H);
  const sx = W / 2, sy = H * 0.8, v = viewOf(facing);
  setAnimations(!S.still);
  drawFigure(g, sx, sy, zoom, pose);
  setAnimations(true);
  const c = clipFor(pose, gender)?.clip, hands = c ? handsAt(c, t, gender) : undefined;
  // the reached hands' places: body heights (x the body's left, up, forward) to the figure's frame (x right, y forward, z up)
  const tall = heightOf(humanProportions(0)) * (gender === 'woman' ? WOMAN_OF_MAN : 1);
  const fig = (p) => [-p[0] * tall, p[2] * tall, p[1] * tall];
  if (S.box && hands?.l && hands?.r) {
    const l = fig(hands.l.at), r = fig(hands.r.at), gap = Math.hypot(l[0] - r[0], l[1] - r[1], l[2] - r[2]) / tall;
    const half = [0.09 * tall, 0.09 * tall, 0.09 * tall];
    // held between the hands (their grips on its sides, a little below its top), else on the ground ahead
    const mid = gap < S.width ? [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, Math.max(half[2], (l[2] + r[2]) / 2 + 0.02 * tall)] : [0, 0.3 * tall, half[2]];
    half[0] = gap < S.width ? Math.max(0.05 * tall, Math.abs(l[0] - r[0]) / 2 - 0.02 * tall) : half[0];
    drawBox(g, v, sx, sy, zoom, mid, half);
  }
  if (S.dots && hands) for (const h of Object.values(hands)) { const s = onScreen(v, fig(h.at)); g.fillStyle = '#e03'; g.fillRect(sx + s[0] * zoom - 2, sy + s[1] * zoom - 2, 4, 4); }
  g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(label, 5, 15);
  return cv;
};
window.sheet = (S, rows) => {
  const W = Math.ceil(S.zoom * 44), H = Math.ceil(S.zoom * (S.close ? 50 : 60)), gap = 2;
  const n = Math.max(...rows.map((r) => r.length));
  const all = document.createElement('canvas'); all.width = n * (W + gap) - gap; all.height = rows.length * (H + gap) - gap;
  const G = all.getContext('2d'); G.fillStyle = '#2f292b'; G.fillRect(0, 0, all.width, all.height);
  rows.forEach((r, i) => r.forEach((c, j) => G.drawImage(cell(S, W, H, ...c), j * (W + gap), i * (H + gap))));
  return all.toDataURL('image/png');
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const launch = () => chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let browser = await launch();
const pageOf = async () => {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  if (!(await p.evaluate(() => window.ready()))) { await p.close(); throw new Error('no WebGL'); }
  return p;
};
let failed = 0;
try {
  let p = null;
  for (const S of sheets) {
    for (let tries = 0; ; tries++) {
      try {
        if (!p) p = await pageOf();
        const info = await p.evaluate((job) => window.clipInfo(job), S.job);
        if (!info.name) throw new Error(`no clip for ${S.job}`);
        const times = S.times ? String(S.times).split(',').map((t) => ({ t: +t, name: `t ${t}` }))
          : S.frames ? Array.from({ length: S.frames }, (_, k) => ({ t: +((k / S.frames) * info.length).toFixed(3), name: `t ${((k / S.frames) * info.length).toFixed(2)}` }))
            : info.poses.map((q) => ({ t: q.t + 1e-4, name: q.name }));
        const each = (fn) => S.genders.flatMap((g) => S.outfits.flatMap((o) => S.facings.map((f) => fn(g, o, f))));
        const rows = S.strip ? each((g, o, f) => times.map(({ t, name: n }) => [g, o, f, t, `${info.name} ${n} | ${g} f${f}`]))
          : times.map(({ t, name: n }) => each((g, o, f) => [g, o, f, t, `${info.name} ${n} | ${g} ${o} f${f}`]));
        // twice: the first draw asks for what loads
        await p.evaluate(([s, r]) => window.sheet(s, r), [S, rows]);
        await p.waitForTimeout(300);
        const url = await p.evaluate(([s, r]) => window.sheet(s, r), [S, rows]);
        const f = join(out, `${S.name}.png`);
        writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
        console.log('wrote', f, `(${info.name}, ${info.length}s)`);
        break;
      } catch (e) {
        console.log('retry', S.name, String(e.message).split('\n')[0]);
        await p?.close().catch(() => {});
        // (a crashed browser's GL can stay lost: a fresh browser)
        await browser.close().catch(() => {});
        browser = await launch();
        p = null;
        if (tries >= 10) { failed++; console.log('FAILED', S.name); break; }
        await new Promise((r) => setTimeout(r, 15000));
      }
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
