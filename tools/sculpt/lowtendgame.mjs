// Bodies at a job in the game's own renderer (drawFigure with the sculpted bodies on), each cell the body at a moment of
// its job's clip (`FigurePose.act`: the clip's own time, one run a go) and, where asked, a wildermon beside it drawn as the
// island draws it (`drawWildermon`): for the clips of tending a beast and of healing (src/sculpt/anim/clips/tend.ts).
//
//   node tools/sculpt/lowtendgame.mjs --job milk_creature --out <dir> [--name sheet] [--zoom 10]
//       [--times 0,0.5,1 | --frames 8] [--facings 0,1,2,4] [--genders man,woman] [--outfits cloth,plate]
//       [--beasts none,rabba,orse2:14] [--side 1] [--reach 9] [--close] [--fade 0.4,1.6]
//   node tools/sculpt/lowtendgame.mjs --sheets <list.json> --out <dir>
//     writes <dir>/<name>.png: a row a moment (a time into the clip's run), a cell for each gender, outfit, beast and
//     facing, labelled. The beast stands `--reach` game units ahead of the body (its middle; `name:reach` for one beast),
//     turned side on to it (`--side 1`, its flank to the body) or facing it (`--side 0`, its head to the body's hands).
//     --close cuts each cell to the body. --fade a,b: the body drawn frame after frame (an id, the game's fades) stood
//     idle, at the job from a seconds to b, idle again, a row of frames 0.1 s apart (--frames n of them, 30 if not given)
//     instead of the moments: the fade in and out.
//     --sheets: many sheets drawn in one browser, a JSON list of { name, job, and any of the options above by name
//     (times and fade as strings, facings, genders, outfits and beasts as lists) }.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL, one device pixel a canvas pixel.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);
const out = resolve(opt('out', 'tmp/lowtend'));
const list = (v, f) => (Array.isArray(v) ? v : String(v ?? f).split(','));
/** A sheet's options, its defaults filled in. */
const sheetOf = (o) => ({
  name: o.name ?? o.job, job: o.job, zoom: +(o.zoom ?? 10),
  facings: list(o.facings, '0,1,2,4').map(Number), genders: list(o.genders, 'man,woman'), outfits: list(o.outfits, 'cloth'), beasts: list(o.beasts, 'none'),
  side: +(o.side ?? 1), reach: +(o.reach ?? 9), close: !!o.close, times: o.times ?? '', frames: +(o.frames ?? 0), fade: o.fade ?? '',
});
const sheets = opt('sheets', '') ? JSON.parse(readFileSync(opt('sheets', ''), 'utf8')).map(sheetOf)
  : [sheetOf({ name: opt('name', undefined), job: opt('job', 'milk_creature'), zoom: opt('zoom', '10'), facings: opt('facings', '0,1,2,4'), genders: opt('genders', 'man,woman'), outfits: opt('outfits', 'cloth'), beasts: opt('beasts', 'none'), side: opt('side', '1'), reach: opt('reach', '9'), close: flag('close'), times: opt('times', ''), frames: opt('frames', '0'), fade: opt('fade', '') })];
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import './src/game/actions';
import { drawFigure, sculptedFigures, viewOf } from './src/render/figure';
import { kitSync } from './src/render/kitpieces';
import { drawWildermon, loadWildermon } from './src/render/wildermon';
import { SPECIES } from './src/game/creatures';
import { DEFAULT_LOOK } from './src/game/look';
import { CLIPS, workClipOf } from './src/sculpt/anim';
kitSync(true);
const OUTFITS = {
  none: {},
  cloth: { chest: { id: 'cloth_tunic' }, legs: { id: 'cloth_trousers' }, feet: { id: 'cloth_shoes' } },
  leather: { chest: { id: 'leather_jerkin' }, arms: { id: 'leather_sleeves' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' }, head: { id: 'leather_cap' } },
  chain: { chest: { id: 'chain_hauberk', material: 'iron' }, arms: { id: 'chain_sleeves', material: 'iron' }, legs: { id: 'chain_leggings', material: 'iron' }, feet: { id: 'chain_boots', material: 'iron' }, head: { id: 'chain_coif', material: 'iron' } },
  scale: { chest: { id: 'scale_cuirass' }, arms: { id: 'scale_sleeves' }, legs: { id: 'scale_leggings' }, feet: { id: 'scale_boots' }, head: { id: 'scale_helm' } },
  plate: { chest: { id: 'plate_breastplate', material: 'iron' }, arms: { id: 'plate_arms', material: 'iron' }, legs: { id: 'plate_legs', material: 'iron' }, feet: { id: 'plate_boots', material: 'iron' }, head: { id: 'helm', material: 'iron' } },
};
// the beasts by name: a kind and its stage
const BEASTS = { rabba: ['rabba', 0], springlet: ['springlet', 0], orse0: ['orse', 0], orse1: ['orse', 1], orse2: ['orse', 2], wadd: ['wadd', 0], sheela: ['sheela', 0] };
// the clock the game's fades are timed by (a fade)
let CLOCK = null;
const realNow = performance.now.bind(performance);
performance.now = () => CLOCK ?? realNow();
window.clipInfo = (job) => { const clip = CLIPS[workClipOf(job)]; return { name: clip?.name, length: clip?.length, poses: clip?.poses ?? [] }; };
window.ready = async (kinds) => {
  sculptedFigures(true); await import('./src/sculpt/sculpted');
  for (const b of kinds) if (BEASTS[b]) await loadWildermon(BEASTS[b][0]);
  await new Promise((r) => setTimeout(r, 100));
  // (no WebGL: the flat figure would be drawn in the sculpted body's place)
  return !!(await import('./src/sculpt/gl')).glContext();
};
const cell = (S, W, H, gender, outfit, beastSpec, facing, t, label, fade, idTag) => {
  const zoom = S.zoom, clip = CLIPS[workClipOf(S.job)], cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, W, H);
  const sx = W / 2, sy = H * 0.78;
  const [beast, own] = beastSpec.split(':'), reach = own ? +own : S.reach;
  const v = viewOf(facing), bx = sx + v.ey[0] * reach * zoom, by = sy + v.ey[1] * reach * zoom;
  // (a fade: the clock at t, the body at its job only between the two times, its go begun at the first)
  const at = fade ? t >= fade[0] && t < fade[1] : true, wt = fade ? t - fade[0] : t;
  if (fade) CLOCK = t * 1000;
  const body = () => drawFigure(g, sx, sy, zoom, { id: fade ? idTag + gender + outfit + beastSpec + facing : undefined, phase: t * 6, moving: false, gait: 0, facing, swimming: false, working: at, job: at ? S.job : undefined, act: at ? { t: wt, length: clip.length } : undefined,
    look: { ...DEFAULT_LOOK, gender, beard: 'none' }, gear: OUTFITS[outfit] ?? {} });
  const B = BEASTS[beast];
  // the beast side on to the body (its facing a quarter turn from the body's) or facing it (half a turn)
  const bf = (((facing + (S.side ? 2 : 4)) % 8) + 8) % 8;
  const drawB = () => B && drawWildermon(g, bx, by, zoom, B[0], SPECIES[B[0]]?.colors ?? ['#a87', '#654'], { facing: bf, phase: 0, moving: false }, B[1], false);
  // whichever stands further up the screen drawn first
  if (B && by < sy) { drawB(); body(); } else { body(); drawB(); }
  CLOCK = null;
  g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(label, 5, 15);
  return cv;
};
// a sheet's rows of cells drawn into one picture, returned as a PNG's data URL
window.sheet = (S, rows, idTag) => {
  const W = Math.ceil(S.zoom * (S.beasts.some((b) => b !== 'none') ? 80 : 44)), H = Math.ceil(S.zoom * (S.close ? 50 : 60)), gap = 2;
  const n = Math.max(...rows.map((r) => r.length));
  const all = document.createElement('canvas'); all.width = n * (W + gap) - gap; all.height = rows.length * (H + gap) - gap;
  const G = all.getContext('2d'); G.fillStyle = '#2f292b'; G.fillRect(0, 0, all.width, all.height);
  rows.forEach((r, i) => r.forEach((c, j) => G.drawImage(cell(S, W, H, ...c, idTag), j * (W + gap), i * (H + gap))));
  return all.toDataURL('image/png');
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const kinds = [...new Set(sheets.flatMap((s) => s.beasts.map((x) => x.split(':')[0])))];
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
/** A page with the renderer loaded (again after a crash). */
const pageOf = async () => {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent('<!doctype html><html><body></body></html>');
  await p.addScriptTag({ content: b.outputFiles[0].text });
  if (!(await p.evaluate((k) => window.ready(k), kinds))) { await p.close(); throw new Error('no WebGL'); }
  return p;
};
let failed = 0;
try {
  let p = null;
  for (const S of sheets) {
    for (let tries = 0; ; tries++) {
      try {
        // (a page with the renderer loaded, again after a crash: the machine short of memory)
        if (!p) p = await pageOf();
        const info = await p.evaluate((job) => window.clipInfo(job), S.job);
        if (!info.name) throw new Error(`no clip for ${S.job}`);
        // the moments: those asked, else n frames over a run, else the clip's key poses
        const times = S.times ? String(S.times).split(',').map((t) => ({ t: +t, name: `t ${t}` }))
          : S.frames ? Array.from({ length: S.frames }, (_, k) => ({ t: +((k / S.frames) * info.length).toFixed(3), name: `t ${((k / S.frames) * info.length).toFixed(2)}` }))
            : info.poses.map((q) => ({ t: q.t + 1e-4, name: q.name }));
        // a fade: one row a body, its frames 0.1 s apart in order (each drawn once, so the fades run as in the game)
        const fade = S.fade ? String(S.fade).split(',').map(Number) : null;
        const each = (fn) => S.genders.flatMap((g) => S.outfits.flatMap((o) => S.beasts.flatMap((bb) => S.facings.map((f) => fn(g, o, bb, f)))));
        const rows = fade ? each((g, o, bb, f) => Array.from({ length: S.frames || 30 }, (_, k) => [g, o, bb, f, +(k * 0.1).toFixed(2), `${info.name} ${(k * 0.1).toFixed(1)}s${k * 0.1 >= fade[0] && k * 0.1 < fade[1] ? ' job' : ' idle'} | ${g} f${f}`, fade]))
          : times.map(({ t, name: n }) => each((g, o, bb, f) => [g, o, bb, f, t, `${info.name} ${n} | ${g} ${o} ${bb === 'none' ? '' : bb + ' '}f${f}`, null]));
        // twice: the first draw asks for what loads; a fade's second draw starts its bodies afresh (other ids)
        await p.evaluate(([s, r]) => window.sheet(s, r, 'a'), [S, rows]);
        await p.waitForTimeout(300);
        const url = await p.evaluate(([s, r]) => window.sheet(s, r, 'b'), [S, rows]);
        const f = join(out, `${S.name}.png`);
        writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
        console.log('wrote', f, `(${info.name}, ${info.length}s)`);
        break;
      } catch (e) {
        console.log('retry', S.name, String(e.message).split('\n')[0]);
        await p?.close().catch(() => {});
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
