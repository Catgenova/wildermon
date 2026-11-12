// A stood clip (the 6 7 gesture, src/sculpt/anim/clips/sixseven.ts, the placeholder of src/sculpt/anim/index.ts) played on
// both low-poly bodies in the game's own renderer: drawFigure with the "Sculpted figures" switch on, as the island draws a
// body (drawFigure -> drawSculptLive -> lowScene -> drawSculptGL), in each outfit asked, as a state that plays it.
//
//   node tools/sculpt/lowplacegame.mjs --out <dir> [--name sixseven-game] [--sets outfit1,hood,plate,leather,bare]
//       [--views front,q3,side] [--zoom 10] [--fps 20] [--seconds 1.2] [--crop 0.62] [--width 26] [--state emote|work|idle] [--job chop]
//       [--from <seconds>] [--keys t1,t2,...] [--genders man,woman] [--act <seconds>]
//     <dir>/<name>.gif: rows the outfits, columns him then her in each view, played in real time: each body its own id, its
//       phase the island's (six a second stood) and the clock (performance.now, which the game fades clips over) the
//       frame's, so a body goes from one clip into the next as it does in the game; each frame taken from the page's
//       canvas (toDataURL), not a screenshot.
//     --state: what the bodies are doing: `emote` (an emote, the default), `work` (at work on --job, not a swing job, its
//       go's time `act`), `idle` (stood doing nothing; the idle clip), or `idle-work` (stood, then set to --job at --from
//       seconds: the fade from the idle into what the job plays).
//     --keys: also <dir>/<name>-keys.png, the frames at those clip times, stood still (no fades).
//     --genders: the bodies drawn (both by default); --act: a go's length at work (3 s by default; a clip's own length
//       plays it at its own times, so --keys are its times).
//     --crop k keeps the top k of each cell (the arms and the trunk close up), or with --low its bottom k (a body knelt or
//       crouched at the ground); --width w makes each cell w game units wide.
//
// Outfits: outfit1 (the first outfit: the shawl, the tunic, the trousers, the boots, the hood down), hood (the same with
// the hood up), plate (the plate set: chest & arms, leggings, boots, helm, mantle), leather (the leather set's leggings,
// boots, shawl and hat; the first outfit's tunic under the shawl), leatherset (the whole leather set: its chest too, the
// shawl worn over it), bare (nothing on but the undergarment).
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL; the GIF needs Python's PIL (PYTHON: a python that has it).
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowplacegame')), name = opt('name', 'sixseven-game');
const sets = opt('sets', 'outfit1,hood,plate,leather,bare').split(','), VIEWS = { front: 0, q3: 1, side: 2, rq3: 3, back: 4 };
const views = opt('views', 'front,q3,side').split(',').map((v) => VIEWS[v]);
const zoom = +opt('zoom', '10'), width = +opt('width', '26'), fps = +opt('fps', '20'), seconds = +opt('seconds', '1.2'), crop = +opt('crop', '0.62');
const genders = opt('genders', 'man,woman').split(','), act = +opt('act', '3');
const low = args.includes('--low');
const state = opt('state', 'emote'), job = opt('job', 'chop'), from = +opt('from', '0.6'), keys = opt('keys', '').split(',').filter(Boolean).map(Number);
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const OUTFITS = {
  outfit1: {},
  hood: { hood: true },
  plate: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true },
  leather: { leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  leatherset: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true },
  bare: { shawl: false, trousers: false, boots: false, tunic: false, hood: false },
};
const entry = `
import { drawFigure, sculptedFigures } from './src/render/figure';
import { DEFAULT_LOOK } from './src/game/look';
const OUTFITS = ${JSON.stringify(OUTFITS)};
const look = (gender) => ({ ...DEFAULT_LOOK, gender, hair: 'swept', beard: 'none' });
let CLOCK = null;
const realNow = performance.now.bind(performance);
performance.now = () => CLOCK ?? realNow();
window.ready = async () => { sculptedFigures(true); await import('./src/sculpt/sculpted'); await new Promise((r) => setTimeout(r, 50)); };
/** What a body is doing at s seconds in. */
const doing = (s, st) => {
  const working = st === 'work' || (st === 'idle-work' && s >= ${from});
  if (working) return { working: true, job: ${JSON.stringify(job)}, act: { t: st === 'work' ? s : s - ${from}, length: ${act} } };
  return st === 'emote' ? { working: false, emote: 'wave', emoteT: s } : { working: false };
};
// rows of cells [set, gender, facing]; at s seconds (the clock and the phase), each body its own id unless still
window.frame = (s, rows, still, st) => {
  const w = Math.ceil(${width * zoom}), h = Math.ceil(${48 * zoom} * ${crop}) + 8, full = Math.ceil(${48 * zoom}) + 24;
  const cv = document.createElement('canvas'); cv.width = w * rows[0].length; cv.height = h * rows.length;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, cv.width, cv.height);
  CLOCK = s * 1000;
  rows.forEach((row, j) => row.forEach(([set, gender, facing], i) => {
    g.save(); g.beginPath(); g.rect(i * w, j * h, w, h); g.clip();
    drawFigure(g, i * w + w / 2, j * h + (${low} ? h : full) - 2 * ${zoom} - 8, ${zoom}, { id: still ? undefined : set + '-' + gender + '-' + facing, phase: s * 6, moving: false, facing, swimming: false, look: look(gender), outfit: OUTFITS[set], ...doing(s, st) });
    g.restore();
    g.fillStyle = '#2f292b'; g.fillRect(i * w, j * h, 1, h);
  }));
  CLOCK = null;
  return cv.toDataURL('image/png');
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dir = join(out, `.frames-${process.pid}`);
try {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  await p.evaluate(() => window.ready());
  mkdirSync(dir, { recursive: true });
  const rows = sets.map((set) => genders.flatMap((g) => views.map((f) => [set, g, f])));
  const save = async (file, s, still) => { const url = await p.evaluate(([ss, r, st, x]) => window.frame(ss, r, st, x), [s, rows, still, state]); writeFileSync(join(dir, file), Buffer.from(url.split(',')[1], 'base64')); };
  const N = Math.round(seconds * fps);
  // (a run-in before the first frame kept, so each body's fade into its clip is done: the frames from 0 s are the game's)
  for (let k = 0; k < N; k++) await save(`f${String(k).padStart(4, '0')}.png`, k / fps, false);
  for (let k = 0; k < keys.length; k++) await save(`k${String(k).padStart(3, '0')}.png`, keys[k], true);
  const label = `${name}: ${sets.join(' / ')} (rows); ${genders.join(' then ')}, ${opt('views', 'front,q3,side')} (columns); zoom ${zoom}; ${state}${state.includes('work') ? ` (${job})` : ''}`;
  execFileSync(process.env.PYTHON ?? 'python3', ['-c', String.raw`
import sys, glob
from PIL import Image, ImageDraw
d, gif, png, label, fps, keys = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]), sys.argv[6].split(',') if sys.argv[6] else []
def head(im, text):
  o = Image.new('RGB', (im.width, im.height + 18), (47, 41, 43)); o.paste(im, (0, 18)); ImageDraw.Draw(o).text((4, 3), text, fill=(240, 230, 220)); return o
fr = [head(Image.open(f).convert('RGB'), f'{label}  t {k / fps:5.2f}s') for k, f in enumerate(sorted(glob.glob(d + '/f*.png')))]
pal = fr[0].quantize(colors=200, method=Image.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.NONE) for f in fr]
q[0].save(gif, save_all=True, append_images=q[1:], duration=int(round(1000 / fps)), loop=0, optimize=True)
ks = [head(Image.open(f).convert('RGB'), f'{label}  clip t {keys[k]}s') for k, f in enumerate(sorted(glob.glob(d + '/k*.png')))]
if ks:
  sh = Image.new('RGB', (ks[0].width, sum(k.height for k in ks)), (47, 41, 43)); y = 0
  for k in ks: sh.paste(k, (0, y)); y += k.height
  sh.save(png)
`, dir, join(out, `${name}.gif`), join(out, `${name}-keys.png`), label, String(fps), keys.join(',')]);
  console.log('wrote', join(out, `${name}.gif`), keys.length ? join(out, `${name}-keys.png`) : '');
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
