// A clip of src/sculpt/anim/clips played on the low-poly man and woman in the game's own renderer (drawFigure with the
// "Sculpted figures" switch on, through the GPU skinning path), as tools/sculpt/lowwalk.mjs draws them, and measured.
//
//   node tools/sculpt/lowanim.mjs --clip idle --out <dir> [--zoom 5] [--close 11] [--fps 10] [--only gifs,keys,current,metrics]
//     [--pass blocking|breakdowns|splined|polish]
//
// --pass shows a pose-to-pose clip (one whose module exports BEATS, src/sculpt/anim/author.ts passOf) as it stood at an
// earlier pass: its key poses held, then every beat held, then eased; the files are then named <clip>-<pass>-*.
// --close 0 leaves out the close-up GIF.
//
// writes into <dir>:
//   <clip>-both.gif     both bodies side by side, front, three-quarter and side, at game zoom
//   <clip>-close.gif    both bodies front and three-quarter, close up
//   <clip>-keys.png     the clip's key poses (Clip.poses), front, three-quarter and side, both bodies, game zoom and close
//   <clip>-vs-current.gif  the figure's own pose for the state (left; the clips switched off) against the clip (right)
//   <clip>-metrics.json and a metrics line per body on stdout: foot sliding, ground penetration, the faces newly passing
//     through each other and the volume kept per joint region (tools/sculpt/lowrigshot.mjs makeMetrics), the loop's seam,
//     and the silhouette at game size (height, the arms read clear of the trunk)
//
// Distances are given in centimetres of a 1.8 m man (the woman 0.85 of him, src/sculpt/lowpoly.ts WOMAN_OF_MAN).
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the GIFs need Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const clipName = opt('clip', 'idle');
const out = resolve(opt('out', `tmp/lowanim/${clipName}`));
const zoom = +opt('zoom', '5'), close = +opt('close', '11'), fps = +opt('fps', '10');
const only = opt('only', 'gifs,keys,current,metrics').split(',');
const pass = opt('pass', 'polish'), FILE = pass === 'polish' ? clipName : `${clipName}-${pass}`;
// the clip as the pass has it, in the page and in node alike
const PASS = `
import * as CLIPMOD from './src/sculpt/anim/clips/${clipName}';
import { passOf } from './src/sculpt/anim/author';
import { CLIPS as ALL } from './src/sculpt/anim';
const M = CLIPMOD;
if (M.BEATS && ${JSON.stringify(pass)} !== 'polish') ALL[${JSON.stringify(clipName)}] = passOf(ALL[${JSON.stringify(clipName)}], M.BEATS, ${JSON.stringify(pass)});
`;
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
const bundle = async (contents, format, platform = 'browser') => (await build({ stdin: { contents, resolveDir: ROOT, loader: 'ts' }, bundle: true, format, platform, write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text;

/* ---- the clip and its player, as the game runs them, in node ---------------------------------------------------- */
const nodeMod = join(out, `.anim-${process.pid}.mjs`);
writeFileSync(nodeMod, await bundle(`${PASS}
export { CLIPS } from './src/sculpt/anim';
export { clipLocal } from './src/sculpt/anim/player';
export { skeleton } from './src/sculpt/anim/skeleton';
export { default as MALE } from './src/sculpt/assets/lowmale.json';
export { default as FEMALE } from './src/sculpt/assets/lowfemale.json';
export const BEATS = CLIPMOD.BEATS;
`, 'esm', 'node'));
const AN = await import(pathToFileURL(nodeMod).href);
rmSync(nodeMod);
const clip = AN.CLIPS[clipName];
if (!clip) throw new Error(`no clip ${clipName}: ${Object.keys(AN.CLIPS).join(', ')}`);
const N = Math.max(2, Math.round(clip.length * fps));
const times = Array.from({ length: N }, (_, k) => (k / N) * clip.length);
const keyTimes = AN.BEATS && pass === 'blocking' ? new Set(AN.BEATS.filter((b) => b.stage === 'key').map((b) => b.t)) : null;
const keys = (clip.poses?.length ? clip.poses : [{ t: 0, name: 'start' }]).filter((k) => !keyTimes || keyTimes.has(k.t));

/* ---- pictures --------------------------------------------------------------------------------------------------- */
const GW = 112, GH = 236, CW = 240, CH = 520;
if (only.some((o) => ['gifs', 'keys', 'current'].includes(o))) {
  const page = `${PASS}
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { clipsOn } from './src/sculpt/anim';
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
// cells: [gender, facing, zoom, w, h, clipsOn]; one picture of them in a row at time t
window.shot = (t, cells) => {
  const W = cells.reduce((a, c) => a + c[3], 0), H = Math.max(...cells.map((c) => c[4]));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, W, H);
  let x = 0;
  for (const [gender, facing, z, w, h, on] of cells) {
    clipsOn(on);
    drawFigure(g, x + w / 2, h - 14, z, { phase: t * 6, moving: false, facing, swimming: false, working: false, look: { ...DEFAULT_LOOK, gender, hair: 'bald', beard: 'none' } });
    x += w;
  }
  clipsOn(true);
  return cv.toDataURL('image/png');
};`;
  const code = await bundle(page, 'iife');
  const kept = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: code });
  await p.evaluate(() => window.ready());
  const dir = join(out, '.frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const save = async (file, t, cells) => { const url = await p.evaluate(([tt, cc]) => window.shot(tt, cc), [t, cells]); writeFileSync(join(dir, file), Buffer.from(url.split(',')[1], 'base64')); };
  const both = (fs, z, w, h, on = true) => ['man', 'woman'].flatMap((g) => fs.map((f) => [g, f, z, w, h, on]));
  if (only.includes('gifs')) for (let k = 0; k < N; k++) {
    await save(`game-${k}.png`, times[k], both([0, 1, 2], zoom, GW, GH));
    if (close) await save(`close-${k}.png`, times[k], both([0, 1], close, CW, CH));
  }
  if (only.includes('current')) for (let k = 0; k < N; k++) await save(`cur-${k}.png`, times[k], [...both([0, 1], zoom, GW, GH, false), ...both([0, 1], zoom, GW, GH, true)]);
  if (only.includes('keys')) for (let k = 0; k < keys.length; k++) {
    await save(`kg-${k}.png`, keys[k].t, both([0, 1, 2], zoom, GW, CH));
    if (close) await save(`kc-${k}.png`, keys[k].t, both([0, 1, 2], close, CW, CH));
  }
  await browser.close();
  execFileSync('python3', ['-c', String.raw`
import sys, os, json
from PIL import Image, ImageDraw
d, out, name, N, fps, keys, only, close = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), float(sys.argv[5]), json.loads(sys.argv[6]), sys.argv[7].split(','), float(sys.argv[8])
ms = int(round(1000 / fps))
def gif(prefix, file, label, scale=1):
  fr = []
  for k in range(N):
    im = Image.open(f'{d}/{prefix}-{k}.png').convert('RGB')
    if scale != 1: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    o = Image.new('RGB', (im.width, im.height + 18), (47, 41, 43)); o.paste(im, (0, 18))
    ImageDraw.Draw(o).text((4, 3), f'{label}  t {k / fps:4.1f}s', fill=(240, 230, 220)); fr.append(o)
  fr[0].save(f'{out}/{file}', save_all=True, append_images=fr[1:], duration=ms, loop=0, optimize=True)
if 'gifs' in only:
  gif('game', f'{name}-both.gif', f'{name}: man | woman, front 3/4 side, zoom ${zoom}')
  if close: gif('close', f'{name}-close.gif', f'{name}: man | woman, front 3/4, zoom ${close}', 0.75)
if 'current' in only:
  gif('cur', f'{name}-vs-current.gif', f'left: today (figure.ts mapped) | right: the clip; man, woman front 3/4, zoom ${zoom}')
if 'keys' in only:
  rows = []
  for k, kp in enumerate(keys):
    g = Image.open(f'{d}/kg-{k}.png').convert('RGB'); c = Image.open(f'{d}/kc-{k}.png').convert('RGB') if close else Image.new('RGB', (0, g.height))
    r = Image.new('RGB', (g.width + c.width, c.height + 20), (47, 41, 43)); r.paste(g, (0, 20)); r.paste(c, (g.width, 20))
    ImageDraw.Draw(r).text((4, 4), f"{kp['name']}  (t {kp['t']}s)   game zoom ${zoom}: man F 3/4 S, woman F 3/4 S  |  close: man F 3/4 S, woman F 3/4 S", fill=(240, 230, 220)); rows.append(r)
  sh = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (47, 41, 43)); y = 0
  for r in rows: sh.paste(r, (0, y)); y += r.height
  sh.save(f'{out}/{name}-keys.png')
`, dir, out, FILE, String(N), String(fps), JSON.stringify(keys), only.join(','), String(close)]);
  // the silhouette at game size: the front cells of the game zoom frames
  if (only.includes('gifs')) {
    const sil = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys, json
from PIL import Image
d, N, GW = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
bg = (0x7d, 0x9b, 0x5e)
res = {}
for b, body in enumerate(['man', 'woman']):
  hs, clear, masks = [], 0, []
  for k in range(N):
    im = Image.open(f'{d}/game-{k}.png').convert('RGB')
    cell = im.crop((b * 3 * GW, 0, b * 3 * GW + GW, im.height)); W, H = cell.size; px = cell.load()
    m = [[sum(abs(px[x, y][i] - bg[i]) for i in range(3)) > 40 for x in range(W)] for y in range(H)]
    rows = [y for y in range(H) if any(m[y])]; top, bot = min(rows), max(rows); h = bot - top + 1; hs.append(h)
    # the arms clear of the trunk: rows down the forearms (0.38 to 0.52 of the height down from the crown) cut
    # into three or more runs
    band = range(top + int(0.38 * h), top + int(0.52 * h)); n3 = 0
    for y in band:
      runs = sum(1 for x in range(W) if m[y][x] and (x == 0 or not m[y][x - 1]))
      n3 += runs >= 3
    clear += n3 / len(band)
    masks.append(m)
  # how far the key frames move at game size: pixels changed against frame 0 at most
  moved = max(sum(1 for y in range(len(masks[0])) for x in range(len(masks[0][0])) if masks[k][y][x] != masks[0][y][x]) for k in range(N))
  res[body] = {'heightPx': [min(hs), max(hs)], 'armsClear': round(clear / N, 2), 'pxMovedMax': moved}
print(json.dumps(res))
`, dir, String(N), String(GW)]).toString());
    writeFileSync(join(out, `.sil.json`), JSON.stringify(sil));
  }
  rmSync(dir, { recursive: true, force: true });
}

/* ---- metrics ---------------------------------------------------------------------------------------------------- */
if (only.includes('metrics')) {
  const LR = await import('./lowrig.mjs');
  const RS = await import('./lowrigshot.mjs');
  const report = {};
  let sil = {};
  try { sil = JSON.parse((await import('node:fs')).readFileSync(join(out, '.sil.json'), 'utf8')); } catch { /* none drawn */ }
  for (const [who, A, body] of [['male', AN.MALE, 'man'], ['female', AN.FEMALE, 'woman']]) {
    const rig = LR.buildRig(who), metrics = RS.makeMetrics(rig);
    const sk = AN.skeleton(A, AN.MALE);
    const cm = (180 * (body === 'woman' ? 0.85 : 1)) / sk.height;
    const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
    const F = 3 * fps, M = Math.round(clip.length * F);
    let prev = null, slide = 0, sink = 0, dys = [], worstX = 0, worstFold = 0, regions = {}, seam = 0, step = 0, prevLocal = null, firstLocal = null;
    const ang = (a, b) => { if (!a || !b) return 0; const t = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7] + a[8] * b[8] - 1) / 2; return (Math.acos(Math.max(-1, Math.min(1, t))) * 180) / Math.PI; };
    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const maxStep = (a, b) => { let m = 0; for (let i = 0; i < Math.max(a.local.length, b.local.length); i++) m = Math.max(m, ang(a.local[i] ?? I, b.local[i] ?? I)); return m; };
    for (let k = 0; k <= M; k++) {
      const t = (k / M) * clip.length, r = AN.clipLocal(sk, clip, t);
      if (k === 0) firstLocal = r;
      if (prevLocal) { const s = maxStep(prevLocal, r); if (k === M) seam = s; else step = Math.max(step, s); }
      prevLocal = r;
      if (k === M) break;
      const pose = { $move: r.move };
      r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
      const frames = LR.posed(rig, pose), P0 = LR.skin(rig, frames), P = LR.ground(rig, P0), dy = P[0][1] - P0[0][1];
      dys.push(dy);
      const floor = rig.J.floor;
      let low = Infinity;
      for (const v of P) low = Math.min(low, v[1]);
      sink = Math.min(sink, low - floor);
      if (prev) for (const i of so) if (P[i][1] - floor < 0.02 && prev[i][1] - floor < 0.02) slide = Math.max(slide, Math.hypot(P[i][0] - prev[i][0], P[i][2] - prev[i][2]));
      prev = P;
      if (k % 3 === 0) {
        const m = metrics(P, frames);
        worstX = Math.max(worstX, m.crossings); worstFold = Math.max(worstFold, m.flips);
        for (const [id, g] of Object.entries(m.region)) { const o = (regions[id] ??= { vol: 0, x: 0, folds: 0, score: 10 }); if (Math.abs(g.vol) > Math.abs(o.vol)) o.vol = g.vol; o.x = Math.max(o.x, g.x); o.folds = Math.max(o.folds, g.folds); o.score = Math.min(o.score, g.score); }
      }
    }
    const worst = Object.entries(regions).sort((a, b) => a[1].score - b[1].score).slice(0, 4).map(([id, g]) => `${id} ${g.score} (vol ${g.vol}%, x ${g.x}, folds ${g.folds})`);
    report[body] = {
      slideCmPerFrame: +(slide * cm).toFixed(2), sinkCm: +(-sink * cm).toFixed(2), groundingRangeCm: +((Math.max(...dys) - Math.min(...dys)) * cm).toFixed(2),
      newCrossingsMax: worstX, foldsMax: worstFold, regionsWorst: worst, regions,
      loopSeamDeg: +seam.toFixed(2), maxStepDeg: +step.toFixed(2), silhouette: sil[body],
    };
    const s = report[body];
    console.log(`${clipName} ${body}: slide ${s.slideCmPerFrame} cm/frame (${F} fps), sink ${s.sinkCm} cm, grounding moves ${s.groundingRangeCm} cm, new crossings ≤${s.newCrossingsMax}, folds ≤${s.foldsMax}, seam ${s.loopSeamDeg}° (largest step ${s.maxStepDeg}°), worst regions: ${worst.join('; ')}${s.silhouette ? `, silhouette ${s.silhouette.heightPx[0]}-${s.silhouette.heightPx[1]} px tall, arms clear ${s.silhouette.armsClear}, ≤${s.silhouette.pxMovedMax} px moved` : ''}`);
  }
  writeFileSync(join(out, `${FILE}-metrics.json`), JSON.stringify(report, null, 1));
  await RS.closeBrowser?.();
}
rmSync(join(out, '.sil.json'), { force: true });
console.log('wrote', out);
