// A clip of src/sculpt/anim/clips played on the low-poly man and woman in the game's own renderer (drawFigure with the
// "Sculpted figures" switch on, through the GPU skinning path), as tools/sculpt/lowwalk.mjs draws them, and measured.
//
//   node tools/sculpt/lowanim.mjs --clip idle --out <dir> [--zoom 5] [--close 11] [--fps 10] [--only gifs,keys,current,metrics]
//     [--pass blocking|breakdowns|splined|polish] [--times t1,t2,...] [--name <file prefix>]
//
// A clip that keys its feet (a walk: src/sculpt/anim/clip.ts Clip.feet) is drawn moving, its time the game's walk phase
// (src/sculpt/anim/index.ts clipFor), and has two more pictures (in --only by default for it):
//   <clip>-side.gif        side on, both bodies carried forward at the game's pace over marks on the ground (`side`)
//   idle-<clip>-transition.gif  stood, set off, walked, stopped, as the game fades one clip into the next (`transition`)
//
// A stood clip that is not the idle's (no feet keyed, nothing gripped: the placeholder, src/sculpt/anim/index.ts PLACEHOLDER)
// is drawn in the idle's place: a body stood doing nothing, its time the island's.
//
// --pass shows a pose-to-pose clip (one whose module exports BEATS, src/sculpt/anim/author.ts passOf) as it stood at an
// earlier pass: its key poses held, then every beat held, then eased; the files are then named <clip>-<pass>-*.
// --close 0 leaves out the close-up GIF. --bare draws the bodies without the outfit.
//
// A clip that grips what is held in both hands (Clip.grip: the swing) is drawn at work, the long sword in hand
// (--enchanted: lit), its time the go's (FigurePose.act); its metrics add the sword's faces crossing the body's (the blade
// and guard against all of it, the grip and pommel against all but the hands), how far its point and its lowest point
// are off the ground, and the arms' faces crossing the head's and the chest's.
//
// writes into <dir>:
//   <clip>-both.gif     both bodies side by side, front, three-quarter and side, at game zoom
//   <clip>-close.gif    both bodies front and three-quarter, close up
//   <clip>-keys.png     the clip's key poses (Clip.poses), front, three-quarter and side, both bodies, game zoom and close
//   <clip>-strike.png   for a clip with a blow (`strike` and `impact` events): frames of it every 0.02 s to the slash trail's
//     fade, both bodies, front, three-quarter and side, at game zoom and close (`strike` in --only)
//   <clip>-vs-current.gif  the figure's own pose for the state (left; the clips switched off) against the clip (right)
//   <clip>-metrics.json and a metrics line per body on stdout: foot sliding, ground penetration, the faces newly passing
//     through each other and the volume kept per joint region (tools/sculpt/lowrigshot.mjs makeMetrics), the loop's seam,
//     and the silhouette at game size (height, the arms read clear of the trunk); the forearms' and hands' nearest to the
//     hips and thighs; the feet: a foot in the air, its toe's lowest off the ground; a planted foot, its sole's spread off flat;
//     the feet's triangles crossing each other; for a walk, the sliding measured against the ground going back under the body, and the ground a
//     planted foot goes back over in a stride against the game's
//
// Distances are given in centimetres of a 1.8 m man (the woman 0.85 of him, src/sculpt/lowpoly.ts WOMAN_OF_MAN).
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the GIFs need Python's PIL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const clipName = opt('clip', 'idle');
const out = resolve(opt('out', `tmp/lowanim/${clipName}`));
const zoom = +opt('zoom', '5'), close = +opt('close', '11'), fps = +opt('fps', '10');
let only = opt('only', '').split(',').filter(Boolean);
const pass = opt('pass', 'polish'), ENCH = args.includes('--enchanted'), FILE = opt('name', (pass === 'polish' ? clipName : `${clipName}-${pass}`) + (ENCH ? '-enchanted' : ''));
// the clip as the pass has it, in the page and in node alike
const PASS = `
import * as CLIPMOD from './src/sculpt/anim/clips/${clipName}';
import { passOf } from './src/sculpt/anim/author';
import { CLIPS as ALL, CLIP_OF } from './src/sculpt/anim';
const M = CLIPMOD;
if (M.BEATS && ${JSON.stringify(pass)} !== 'polish') ALL[${JSON.stringify(clipName)}] = passOf(ALL[${JSON.stringify(clipName)}], M.BEATS, ${JSON.stringify(pass)});
// a stood clip (no feet keyed, nothing gripped) that is not the idle's -- the placeholder, a work clip -- drawn in the idle's place
{ const c = ALL[${JSON.stringify(clipName)}]; if (c && !c.feet && !c.grip) CLIP_OF.idle = ${JSON.stringify(clipName)}; }
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
export { lowSkeleton, lowFigure, lowHeld } from './src/sculpt/lowpoly';
export { DEFAULT_LOOK } from './src/game/look';
export { BASE_SPEED, CADENCE, strideAt } from './src/game/player';
export { strideOf } from './src/sculpt/anim/clip';
export { UNITS_PER_TILE } from './src/render/iso';
export const BEATS = CLIPMOD.BEATS;
`, 'esm', 'node'));
const AN = await import(pathToFileURL(nodeMod).href);
rmSync(nodeMod);
const clip = AN.CLIPS[clipName];
if (!clip) throw new Error(`no clip ${clipName}: ${Object.keys(AN.CLIPS).join(', ')}`);
// a walk: drawn moving, a whole stride to a turn of the walk's phase (index.ts clipFor)
const MOVING = !!clip.feet;
if (!only.length) only = ['gifs', 'keys', 'current', 'metrics', ...(MOVING ? ['side', 'transition'] : [])];
const N = Math.max(2, Math.round(clip.length * fps));
const times = Array.from({ length: N }, (_, k) => (k / N) * clip.length);
const keyTimes = AN.BEATS && pass === 'blocking' ? new Set(AN.BEATS.filter((b) => b.stage === 'key').map((b) => b.t)) : null;
// (--times t1,t2,...: the key sheet drawn at those times instead of the clip's key poses)
const TIMES = opt('times', '');
const keys = TIMES ? TIMES.split(',').map((t) => ({ t: +t, name: `t ${t}` })) : (clip.poses?.length ? clip.poses : [{ t: 0, name: 'start' }]).filter((k) => !keyTimes || keyTimes.has(k.t));

/* ---- pictures --------------------------------------------------------------------------------------------------- */
// (a clip that grips a sword: room for the blade over the head and out ahead)
const GRIP = !!clip.grip, GW = GRIP ? 250 : 112, GH = GRIP ? 330 : 236, CW = GRIP ? Math.round((250 * close) / zoom) : 240, CH = GRIP ? Math.round((330 * close) / zoom) : 520;
// the side on and the transition: their own frames, at the game's pace
const SPEED = AN.BASE_SPEED * 40, SIDE_PX = 1.2 * Math.SQRT2;
const sideFps = 25, sideN = MOVING ? Math.round((3 * clip.length) * sideFps) : 0;
const sideW = Math.round(112 + 3 * clip.length * SPEED * SIDE_PX * zoom);
/** The transition: stood, walking from TR[0] to TR[1] seconds, stood again to TR[2]. */
const TR = [0.6, 1.9, 2.8], trFps = 25, trN = Math.round(TR[2] * trFps);
const trW = Math.round(112 + (TR[1] - TR[0]) * SPEED * SIDE_PX * zoom);
// the blow, for a clip with one (its `strike` and `impact` events): frames every 0.02 s from a little before it to the
// slash trail's fade after it (src/sculpt/anim/trail.ts FADE)
const STRIKE_T = clip.events?.find((e) => e.name === 'strike')?.t, IMPACT_T = clip.events?.find((e) => e.name === 'impact')?.t;
const strikeTimes = STRIKE_T === undefined || IMPACT_T === undefined ? [] : Array.from({ length: Math.round((IMPACT_T + 0.2 - (STRIKE_T - 0.02)) / 0.02) + 1 }, (_, k) => +(STRIKE_T - 0.02 + k * 0.02).toFixed(3));
if (only.some((o) => ['gifs', 'keys', 'current', 'side', 'transition', 'strike'].includes(o))) {
  const page = `${PASS}
const OUTFIT = ${JSON.stringify(args.includes('--bare') ? { shawl: false, trousers: false, boots: false, tunic: false, hood: false } : undefined)};
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
import { clipsOn } from './src/sculpt/anim';
import { viewOf } from './src/render/figure';
import { walkPhase } from './src/sculpt/anim';
const MOVING = ${MOVING}, LEN = ${clip.length}, TAU = Math.PI * 2, GRIP = ${!!clip.grip};
/** For a clip that grips: at work with the long sword, the go a run of the clip, at clip time t. */
const work = (t) => (GRIP ? { working: true, job: 'attack_creature', act: { t, length: LEN }, gear: { weapon: { id: 'long_sword', material: 'iron', enchanted: ${ENCH} } } } : {});
/** The game's phase that puts a body at clip time t: the walk's (index.ts walkPhase, the body's own stride), or six a second stood. */
const phaseAt = (t, gender) => (MOVING ? walkPhase(ALL[${JSON.stringify(clipName)}], t, gender) : t * 6);
// the clock the fades between clips are timed by, set by the transition
let CLOCK = null;
const realNow = performance.now.bind(performance);
performance.now = () => CLOCK ?? realNow();
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
const canvas = (cells) => {
  const W = cells.reduce((a, c) => a + c[3], 0), H = Math.max(...cells.map((c) => c[4]));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, W, H);
  return { cv, g };
};
/** Marks on the ground every two units, from screen x0, y0 along the way the body faces: what a planted foot keeps to. */
const marks = (g, x0, y0, z, facing, w) => {
  const e = viewOf(facing).ey;
  g.fillStyle = '#4f6b38';
  for (let u = -40; u <= 80; u += 2) {
    const x = x0 + e[0] * u * z, y = y0 + e[1] * u * z;
    if (x > x0 - w && x < x0 + 2 * w) g.fillRect(Math.round(x), Math.round(y) - 1, 1, 4);
  }
};
// cells: [gender, facing, zoom, w, h, clipsOn, x0 (share of w), carried (units forward), moving, phase, id]; at clock ms
window.seq = (ms, cells) => {
  CLOCK = ms;
  const { cv, g } = canvas(cells);
  let x = 0;
  for (const [gender, facing, z, w, h, on, x0, d, moving, phase, id] of cells) {
    clipsOn(on);
    g.save(); g.beginPath(); g.rect(x, 0, w, h); g.clip();
    const sx = x + w * x0, sy = h - 14;
    if (d !== null) marks(g, sx, sy, z, facing, w);
    const e = viewOf(facing).ey, dd = d ?? 0;
    drawFigure(g, sx + e[0] * dd * z, sy + e[1] * dd * z, z, { id, phase, moving, gait: 0, facing, swimming: false, working: false, look: { ...DEFAULT_LOOK, gender, hair: 'bald', beard: 'none' }, outfit: OUTFIT });
    g.restore();
    x += w;
  }
  clipsOn(true);
  CLOCK = null;
  return cv.toDataURL('image/png');
};
// cells: [gender, facing, zoom, w, h, clipsOn]; one picture of them in a row at time t
window.shot = (t, cells) => {
  const W = cells.reduce((a, c) => a + c[3], 0), H = Math.max(...cells.map((c) => c[4]));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, W, H);
  let x = 0;
  for (const [gender, facing, z, w, h, on] of cells) {
    clipsOn(on);
    drawFigure(g, x + w / 2, h - 14, z, { phase: phaseAt(t, gender), moving: MOVING, gait: 0, facing, swimming: false, working: false, look: { ...DEFAULT_LOOK, gender, hair: 'bald', beard: 'none' }, outfit: OUTFIT, ...work(t) });
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
    if (close) await save(`close-${k}.png`, times[k], both([0, 1, 2], close, CW, CH));
  }
  if (only.includes('current')) for (let k = 0; k < N; k++) await save(`cur-${k}.png`, times[k], [...both([0, 1], zoom, GW, GH, false), ...both([0, 1], zoom, GW, GH, true)]);
  const seq = async (file, ms, cells) => { const url = await p.evaluate(([m, cc]) => window.seq(m, cc), [ms, cells]); writeFileSync(join(dir, file), Buffer.from(url.split(',')[1], 'base64')); };
  if (only.includes('side') && MOVING) for (let k = 0; k < sideN; k++) {
    // a body carried forward at the game's walking pace, its phase the game's for the ground covered (CADENCE a second)
    const s = k / sideFps, d = s * SPEED, phase = (d / (AN.strideAt(0) * AN.UNITS_PER_TILE)) * 2 * Math.PI;
    await seq(`side-${k}.png`, 0, ['man', 'woman'].map((g) => [g, 2, zoom, sideW, GH, true, 56 / sideW, d, true, phase, undefined]));
  }
  if (only.includes('transition') && MOVING) {
    // the game's: stood, the phase six a second; walking, the walk's phase counted up from where it was, the body carried
    let walked = 0, d = 0;
    for (let k = 0; k < trN; k++) {
      const s = k / trFps, moving = s >= TR[0] && s < TR[1];
      if (k > 0 && moving) { walked += AN.CADENCE / trFps; d += SPEED / trFps; }
      const phase = moving ? walked : s * 6;
      await seq(`tr-${k}.png`, s * 1000, ['man', 'woman'].flatMap((g) => [[g, 1, zoom, GW, GH, true, 0.5, null, moving, phase, `${g}-tr34`], [g, 2, zoom, trW, GH, true, 56 / trW, d, moving, phase, `${g}-trside`]]));
    }
  }
  // each key a moment after its time, so a held (stepped) key shows itself and not the one before
  if (only.includes('keys')) for (let k = 0; k < keys.length; k++) {
    await save(`kg-${k}.png`, keys[k].t + 1e-4, both([0, 1, 2], zoom, GW, CH));
    if (close) await save(`kc-${k}.png`, keys[k].t + 1e-4, both([0, 1, 2], close, CW, CH));
  }
  if (only.includes('strike')) for (let k = 0; k < strikeTimes.length; k++) {
    await save(`sg-${k}.png`, strikeTimes[k], both([0, 1, 2], zoom, GW, GH));
    if (close) await save(`sc-${k}.png`, strikeTimes[k], both([0, 1, 2], close, CW, CH));
  }
  await browser.close();
  execFileSync('python3', ['-c', String.raw`
import sys, os, json
from PIL import Image, ImageDraw
d, out, name, N, fps, keys, only, close = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), float(sys.argv[5]), json.loads(sys.argv[6]), sys.argv[7].split(','), float(sys.argv[8])
sideN, trN, clipName, strikeTimes = int(sys.argv[9]), int(sys.argv[10]), sys.argv[11], json.loads(sys.argv[12])
def gif(prefix, file, label, scale=1, n=None, f=None):
  n = n or N; f = f or fps; ms = int(round(1000 / f))
  fr = []
  for k in range(n):
    im = Image.open(f'{d}/{prefix}-{k}.png').convert('RGB')
    if scale != 1: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    o = Image.new('RGB', (im.width, im.height + 18), (47, 41, 43)); o.paste(im, (0, 18))
    ImageDraw.Draw(o).text((4, 3), f'{label}  t {k / f:5.2f}s', fill=(240, 230, 220)); fr.append(o)
  fr[0].save(f'{out}/{file}', save_all=True, append_images=fr[1:], duration=ms, loop=0, optimize=True)
if 'gifs' in only:
  gif('game', f'{name}-both.gif', f'{name}: man | woman, front 3/4 side, zoom ${zoom}')
  if close: gif('close', f'{name}-close.gif', f'{name}: man | woman, front 3/4 side, zoom ${close}', 0.6)
if 'current' in only:
  gif('cur', f'{name}-vs-current.gif', f'left: today (figure.ts mapped) | right: the clip; man, woman front 3/4, zoom ${zoom}')
if 'side' in only and sideN:
  gif('side', f'{name}-side.gif', f'{name}: man | woman, side on, carried at the game pace over marks 2 units apart, zoom ${zoom}', n=sideN, f=25)
if 'transition' in only and trN:
  gif('tr', f'idle-{name}-transition.gif', f'idle > {clipName} > idle (walking 0.6-1.9s): man 3/4, side | woman 3/4, side, zoom ${zoom}', n=trN, f=25)
if 'keys' in only:
  rows = []
  for k, kp in enumerate(keys):
    g = Image.open(f'{d}/kg-{k}.png').convert('RGB'); c = Image.open(f'{d}/kc-{k}.png').convert('RGB') if close else Image.new('RGB', (0, g.height))
    r = Image.new('RGB', (g.width + c.width, c.height + 20), (47, 41, 43)); r.paste(g, (0, 20)); r.paste(c, (g.width, 20))
    ImageDraw.Draw(r).text((4, 4), f"{kp['name']}  (t {kp['t']}s)   game zoom ${zoom}: man F 3/4 S, woman F 3/4 S  |  close: man F 3/4 S, woman F 3/4 S", fill=(240, 230, 220)); rows.append(r)
  sh = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (47, 41, 43)); y = 0
  for r in rows: sh.paste(r, (0, y)); y += r.height
  sh.save(f'{out}/{name}-keys.png')
if 'strike' in only and strikeTimes:
  rows = []
  for k, st in enumerate(strikeTimes):
    g = Image.open(f'{d}/sg-{k}.png').convert('RGB'); c = Image.open(f'{d}/sc-{k}.png').convert('RGB') if close else Image.new('RGB', (0, g.height))
    if close: c = c.resize((int(c.width * 0.5), int(c.height * 0.5)), Image.LANCZOS)
    r = Image.new('RGB', (g.width + c.width, max(g.height, c.height) + 20), (47, 41, 43)); r.paste(g, (0, 20)); r.paste(c, (g.width, 20))
    ImageDraw.Draw(r).text((4, 4), f"t {st:.2f}s   game zoom ${zoom}: man F 3/4 S, woman F 3/4 S  |  zoom {close:g} (half size): man F 3/4 S, woman F 3/4 S", fill=(240, 230, 220)); rows.append(r)
  sh = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (47, 41, 43)); y = 0
  for r in rows: sh.paste(r, (0, y)); y += r.height
  sh.save(f'{out}/{name}-strike.png')
`, dir, out, FILE, String(N), String(fps), JSON.stringify(keys), only.join(','), String(close), String(sideN), String(trN), clipName, JSON.stringify(strikeTimes)]);
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
/** The long sword's points (its own frame, game units), its faces (its glow's left out) split into the blade and guard and the grip and pommel, and its point. */
function swordOf() {
  const A = JSON.parse(readFileSync(join(ROOT, 'src/sculpt/assets/long_sword.json'), 'utf8')), V = [], T = [];
  for (let i = 0; i < A.verts.length; i += 3) V.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  for (let t = 0; t < A.tris.length; t += 4) if (A.tris[t + 3] < A.glowFrom) T.push({ v: [A.tris[t], A.tris[t + 1], A.tris[t + 2]] });
  // the blade from where it leaves the guard (tools/sculpt/gear/long_sword.mjs: 520 of the sheet's 1469 px up)
  const from = (520 / 1469) * A.length;
  const blade = T.filter((t) => t.v.every((i) => V[i][1] > from)), hilt = T.filter((t) => !t.v.every((i) => V[i][1] > from));
  // (its point and lowest point among the faces drawn: the glow's own points reach past the point)
  const solid = [...new Set(T.flatMap((t) => t.v))];
  let tip = solid[0]; for (const i of solid) if (V[i][1] > V[tip][1]) tip = i;
  return { A, V, blade, hilt, tip, solid };
}
let XP = null;
if (only.includes('metrics')) {
  XP = (await import('./lowgarment.mjs')).crossPairs;
  const LR = await import('./lowrig.mjs');
  const RS = await import('./lowrigshot.mjs');
  const report = {};
  let sil = {};
  try { sil = JSON.parse((await import('node:fs')).readFileSync(join(out, '.sil.json'), 'utf8')); } catch { /* none drawn */ }
  // and for a walk, today's: the figure's own walk mapped onto the rig (lowpoly.ts fromGame), for comparing
  const runs = [['male', 'man', ''], ['female', 'woman', ''], ...(MOVING ? [['male', 'man', 'current'], ['female', 'woman', 'current']] : [])];
  for (const [who, body, src] of runs) {
    const rig = LR.buildRig(who), metrics = RS.makeMetrics(rig);
    const sk = AN.lowSkeleton(body);
    const cm = (180 * (body === 'woman' ? 0.85 : 1)) / sk.height;
    const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
    // frames a second: for a walk, sixty frames a stride
    const M = MOVING ? 60 : Math.round(clip.length * 3 * fps), F = M / clip.length;
    // the ground going back under the body each frame, mesh units (a walk is on the spot; the game carries it forward)
    // (today's walk: a turn of the phase over the game's own stride)
    const stride = src ? AN.strideAt(0) * AN.UNITS_PER_TILE : AN.strideOf(clip, body), back = MOVING ? (stride * sk.perGame) / M : 0;
    // the forearms and hands, and the hips and thighs they swing past (the trunk below the chest, the legs above the knee)
    const domOf = (i) => rig.bones[rig.vw[i].reduce((a, b) => (b[1] > a[1] ? b : a))[0]].name;
    const chestY = rig.bones[rig.at.get('spine_03')].head[1], kneeY = rig.bones[rig.at.get('calf_l')].head[1];
    const fore = rig.B.names.map((n, i) => (n.startsWith('arm/') && /^(lowerarm|wrist|knuckles|hand|thumb|fingers)/.test(domOf(i)) ? i : -1)).filter((i) => i >= 0);
    const hips = rig.B.names.map((n, i) => (!n.startsWith('arm/') && rig.B.verts[i][1] < chestY && rig.B.verts[i][1] > kneeY ? i : -1)).filter((i) => i >= 0);
    let prev = null, slide = 0, sink = 0, dys = [], worstX = 0, worstFold = 0, regions = {}, seam = 0, step = 0, prevLocal = null, firstLocal = null;
    let gone = 0, goneN = 0, clear = Infinity, touching = 0, clearN = 0;
    // the feet: each side's sole points, its toe's (the toe face's corners at the sole and the band), and its triangles
    // below the ankle's collar (the ankle ring, the collar, the block, the ball's loop)
    const sideOf = (re) => ['L', 'R'].map((sd) => rig.B.names.map((n, i) => (re.test(n) && n.endsWith(`.${sd}`) ? i : -1)).filter((i) => i >= 0));
    const soles = sideOf(/^so\d\./), toes = sideOf(/^(so|ft)[01]\./), footV = sideOf(/^(an|fc|ft|so|fb)\d\./).map((l) => new Set(l));
    const footT = footV.map((V) => rig.B.tris.filter((t) => t.v.every((i) => V.has(i))).map((t) => ({ v: t.v })));
    const ft = { clear: [Infinity, Infinity], cross: 0, crossFrames: 0, spread: [0, 0], planted: [0, 0], airFrames: [0, 0] };
    // a clip that grips: the long sword in both hands, its blade and guard, its grip and pommel; the body's hands, head and chest
    const held = clip.grip && !src ? AN.lowHeld(body) : null, SW = held ? swordOf() : null;
    const tris = rig.B.tris.map((t) => ({ v: t.v })), domTri = (t) => domOf(t.v[0]);
    const handT = tris.filter((t) => /^(hand|thumb|fingers|knuckles)/.test(domTri(t))), notHandT = tris.filter((t) => !/^(hand|thumb|fingers|knuckles)/.test(domTri(t)));
    // (the forearms and hands against the head, neck and trunk; the upper arms against the head and neck only: against the chest and
    // the shoulder's top they are the joint's own, scored by its region)
    const armOnly = (t) => t.v.every((i) => rig.B.names[i].startsWith('arm/')), offArm = (t) => !t.v.some((i) => rig.B.names[i].startsWith('arm/'));
    const foreT = tris.filter((t) => armOnly(t) && /^(elbow|lowerarm|wrist|hand|knuckles|thumb|fingers)/.test(domTri(t))), upperT = tris.filter((t) => armOnly(t) && /^(upperarm|shoulder)/.test(domTri(t)));
    const headT = tris.filter((t) => offArm(t) && /^(head|jaw|neck)/.test(domTri(t))), chestT = tris.filter((t) => offArm(t) && /^(spine|pelvis|clavicle)/.test(domTri(t)));
    const sw = { blade: 0, bladeFrames: 0, hilt: 0, tipMin: Infinity, lowMin: Infinity, tipImpact: null, armsHead: 0, armsChest: 0, armsHeadFrames: 0, worstAt: null };
    const impactT = clip.events?.find((e) => e.name === 'impact')?.t;
    const ang = (a, b) => { if (!a || !b) return 0; const t = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7] + a[8] * b[8] - 1) / 2; return (Math.acos(Math.max(-1, Math.min(1, t))) * 180) / Math.PI; };
    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const maxStep = (a, b) => { let m = 0; for (let i = 0; i < Math.max(a.local.length, b.local.length); i++) m = Math.max(m, ang(a.local[i] ?? I, b.local[i] ?? I)); return m; };
    for (let k = 0; k <= M; k++) {
      const t = (k / M) * clip.length;
      const r = src ? { local: AN.lowFigure(body, { phase: (t / clip.length + 0.25) * 2 * Math.PI, moving: true, gait: 0, facing: 2, swimming: false, working: false, look: { ...AN.DEFAULT_LOOK, gender: body } }), move: [0, 0, 0] } : AN.clipLocal(sk, clip, t, held ?? undefined);
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
      if (prev) for (const i of so) if (P[i][1] - floor < 0.02 && prev[i][1] - floor < 0.02) {
        slide = Math.max(slide, Math.hypot(P[i][0] - prev[i][0], P[i][2] - prev[i][2] + back));
        gone -= P[i][2] - prev[i][2]; goneN++;
      }
      prev = P;
      // the feet: a foot in the air (all its sole off the ground) and its toe's lowest; a planted one (some of its sole
      // on the ground) and how far its sole is from flat; the feet's triangles crossing each other
      for (const s of [0, 1]) {
        const hs = soles[s].map((i) => P[i][1] - floor), lo = Math.min(...hs), hi = Math.max(...hs);
        if (lo > 0.02) { ft.airFrames[s]++; ft.clear[s] = Math.min(ft.clear[s], Math.min(...toes[s].map((i) => P[i][1] - floor))); }
        else { ft.planted[s]++; ft.spread[s] = Math.max(ft.spread[s], hi - lo); }
      }
      { const x = XP(P, footT[0], P, footT[1]).length; ft.cross = Math.max(ft.cross, x); if (x) ft.crossFrames++; }
      if (SW) {
        // the sword where the right fist holds it, stood as the body is (the same shift onto the ground)
        const g = sk.gripOf(sk.fk(r.local, r.move), held)[1], lead = SW.A.grip.lead;
        const Q = SW.V.map((p) => { const d = [(p[0] - lead[0]) / held.scale, (p[1] - lead[1]) / held.scale, (p[2] - lead[2]) / held.scale]; return [g.at[0] + g.R[0] * d[0] + g.R[1] * d[1] + g.R[2] * d[2], g.at[1] + g.R[3] * d[0] + g.R[4] * d[1] + g.R[5] * d[2] + dy, g.at[2] + g.R[6] * d[0] + g.R[7] * d[1] + g.R[8] * d[2]]; });
        const b = XP(Q, SW.blade, P, tris).length, h = XP(Q, SW.hilt, P, notHandT).length;
        if (b + h > sw.blade + sw.hilt) sw.worstAt = +t.toFixed(3);
        sw.blade = Math.max(sw.blade, b); sw.hilt = Math.max(sw.hilt, h); if (b) sw.bladeFrames++;
        const tipY = (Q[SW.tip][1] - floor) * held.scale, lowY = Math.min(...SW.solid.map((i) => Q[i][1])) - floor;
        sw.tipMin = Math.min(sw.tipMin, tipY); sw.lowMin = Math.min(sw.lowMin, lowY * held.scale);
        const ah = XP(P, foreT, P, headT).length + XP(P, upperT, P, headT).length, ac = XP(P, foreT, P, chestT).length;
        sw.armsHead = Math.max(sw.armsHead, ah); sw.armsChest = Math.max(sw.armsChest, ac); if (ah) sw.armsHeadFrames++;
      }
      if (k % 3 === 0) {
        let near = Infinity;
        for (const a of fore) for (const b of hips) { const d = Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]); if (d < near) near = d; }
        clear = Math.min(clear, near); clearN++; if (near * cm < 1) touching++;
        const m = metrics(P, frames);
        worstX = Math.max(worstX, m.crossings); worstFold = Math.max(worstFold, m.flips);
        for (const [id, g] of Object.entries(m.region)) { const o = (regions[id] ??= { vol: 0, x: 0, folds: 0, score: 10 }); if (Math.abs(g.vol) > Math.abs(o.vol)) o.vol = g.vol; o.x = Math.max(o.x, g.x); o.folds = Math.max(o.folds, g.folds); o.score = Math.min(o.score, g.score); }
      }
    }
    if (SW && impactT !== undefined) {
      // the point at the impact itself (a moment after it, so a stepped pass shows the impact's key)
      const r = AN.clipLocal(sk, clip, impactT + 1e-4, held), pose = { $move: r.move };
      r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
      const P0 = LR.skin(rig, LR.posed(rig, pose)), dy = LR.ground(rig, P0)[0][1] - P0[0][1], g = sk.gripOf(sk.fk(r.local, r.move), held)[1];
      sw.tipImpact = +((g.at[1] + ((SW.A.length - SW.A.grip.lead[1]) / held.scale) * g.way[1] + dy - rig.J.floor) * held.scale).toFixed(2);
    }
    const worst = Object.entries(regions).sort((a, b) => a[1].score - b[1].score).slice(0, 4).map(([id, g]) => `${id} ${g.score} (vol ${g.vol}%, x ${g.x}, folds ${g.folds})`);
    const key = src ? `${body} (${src})` : body;
    report[key] = {
      slideCmPerFrame: +(slide * cm).toFixed(2), sinkCm: +(-sink * cm).toFixed(2), groundingRangeCm: +((Math.max(...dys) - Math.min(...dys)) * cm).toFixed(2),
      newCrossingsMax: worstX, foldsMax: worstFold, regionsWorst: worst, regions,
      feet: { toeClearCm: ft.clear.map((c) => (c === Infinity ? null : +(c * cm).toFixed(1))), airFrames: ft.airFrames, soleSpreadCm: ft.spread.map((c) => +(c * cm).toFixed(2)), plantedFrames: ft.planted, feetCrossMax: ft.cross, feetCrossFrames: ft.crossFrames },
      loopSeamDeg: +seam.toFixed(2), maxStepDeg: +step.toFixed(2), silhouette: src ? undefined : sil[body],
      handsToHipsCm: +(clear * cm).toFixed(1), handsTouchShare: +(touching / clearN).toFixed(2),
      ...(SW ? { sword: { bladeCrossingsMax: sw.blade, bladeCrossingFrames: sw.bladeFrames, hiltCrossingsMax: sw.hilt, worstAt: sw.worstAt, frames: M, tipMinGame: +sw.tipMin.toFixed(2), lowestGame: +sw.lowMin.toFixed(2), tipAtImpactGame: sw.tipImpact, tipAtImpactCm: sw.tipImpact === null ? null : +((sw.tipImpact / held.scale) * cm).toFixed(1) }, armsHeadCrossingsMax: sw.armsHead, armsHeadFrames: sw.armsHeadFrames, armsChestCrossingsMax: sw.armsChest } : {}),
      ...(MOVING ? { strideGame: +((gone / Math.max(1, goneN)) * M / sk.perGame).toFixed(2), strideWanted: +stride.toFixed(2), gameStride: +(AN.strideAt(0) * AN.UNITS_PER_TILE).toFixed(2), runSeconds: +(stride / (AN.BASE_SPEED * AN.UNITS_PER_TILE)).toFixed(3), strideCm: +((gone / Math.max(1, goneN)) * M * cm).toFixed(1) } : {}),
    };
    const s = report[key];
    console.log(`${clipName} ${key}: slide ${s.slideCmPerFrame} cm/frame (${+F.toFixed(1)} fps${MOVING ? ', against the ground' : ''})${MOVING ? `, stride ${s.strideGame} game units (${s.strideCm} cm; keyed ${s.strideWanted}, the game's own walk ${s.gameStride}; a stride every ${s.runSeconds} s at the game's pace)` : ''}, hands to hips ≥${s.handsToHipsCm} cm (touching ${s.handsTouchShare}), sink ${s.sinkCm} cm, feet: toe in the air ≥${s.feet.toeClearCm.join('/')} cm off the ground (L/R), planted sole ≤${s.feet.soleSpreadCm.join('/')} cm off flat, feet crossing ≤${s.feet.feetCrossMax} (${s.feet.feetCrossFrames} frames), grounding moves ${s.groundingRangeCm} cm, new crossings ≤${s.newCrossingsMax}, folds ≤${s.foldsMax}, seam ${s.loopSeamDeg}° (largest step ${s.maxStepDeg}°), worst regions: ${worst.join('; ')}${s.sword ? `, sword: blade x ≤${s.sword.bladeCrossingsMax} (${s.sword.bladeCrossingFrames}/${M} frames), grip/pommel x ≤${s.sword.hiltCrossingsMax} (worst at ${s.sword.worstAt}s), point ≥${s.sword.tipMinGame} gu off the ground (at impact ${s.sword.tipAtImpactGame} gu, ${s.sword.tipAtImpactCm} cm), lowest ${s.sword.lowestGame} gu; arms x head ≤${s.armsHeadCrossingsMax} (${s.armsHeadFrames} frames), forearms x trunk ≤${s.armsChestCrossingsMax}` : ''}${s.silhouette ? `, silhouette ${s.silhouette.heightPx[0]}-${s.silhouette.heightPx[1]} px tall, arms clear ${s.silhouette.armsClear}, ≤${s.silhouette.pxMovedMax} px moved` : ''}`);
  }
  writeFileSync(join(out, `${FILE}-metrics.json`), JSON.stringify(report, null, 1));
  await RS.closeBrowser?.();
}
rmSync(join(out, '.sil.json'), { force: true });
console.log('wrote', out);
