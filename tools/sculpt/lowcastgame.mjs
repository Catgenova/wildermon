// Bodies casting a spell in the game's own renderer (drawFigure with the sculpted bodies on), for the casting clips
// (src/sculpt/anim/clips/cast.ts): each cell a body at a share of a spell's cast (`FigurePose.cast`), or, with --fx, the
// spell's own sheet (src/render/spells/preview.ts spellSheet: its effects, a stand-in target) drawn with the sculpted body.
//
//   node tools/sculpt/lowcastgame.mjs --sheets <list.json> --out <dir> [--dpr 1 or 2: the zoom doubled]
//     a JSON list of sheets, each { name, spell, and any of:
//       shares: "0,0.2,0.5" (the cast's share at each row; by default the clip's key poses), facings [0,1,...],
//       genders ["man","woman"], outfit "cloth"|"leather"|"plate"|"none", weapon "<id>", at "creature"|"self"|"person"|"spot",
//       zoom 6, strip (a row a body, its moments across), walk (the body walking while it casts), still (Animations Off),
//       fx (the spell's sheet instead: frames, facing, gender, zoom; a frame on the release) }
//     writes <dir>/<name>.png.
//
// Playwright's Chromium (/opt/pw-browsers/chromium) with software GL.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowcast'));
const dpr = +opt('dpr', '1');
// (--dpr 2: every picture drawn at twice its zoom, as on a screen of two device pixels a pixel)
const sheets = JSON.parse(readFileSync(opt('sheets', ''), 'utf8')).map((S) => ({ ...S, zoom: (S.zoom ?? (S.fx ? 4 : 6)) * dpr }));
mkdirSync(out, { recursive: true });
const ROOT = new URL('../..', import.meta.url).pathname;
const entry = `
import './src/game/actions';
import { drawFigure, sculptedFigures } from './src/render/figure';
import { kitSync } from './src/render/kitpieces';
import { DEFAULT_LOOK } from './src/game/look';
import { clipFor } from './src/sculpt/anim';
import { releaseOf } from './src/sculpt/anim/clips/cast';
import { visualOf } from './src/render/spells/index';
import { spellSheet } from './src/render/spells/preview';
import { setAnimations } from './src/engine/motion';
kitSync(true);
const OUTFITS = {
  none: {},
  cloth: { chest: { id: 'cloth_tunic' }, legs: { id: 'cloth_trousers' }, feet: { id: 'cloth_shoes' } },
  leather: { chest: { id: 'leather_jerkin' }, shawl: { id: 'leather_shawl' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' }, head: { id: 'leather_cap' } },
  plate: { chest: { id: 'plate_breastplate', material: 'iron' }, shawl: { id: 'plate_shawl', material: 'iron' }, legs: { id: 'plate_legs', material: 'iron' }, feet: { id: 'plate_boots', material: 'iron' }, head: { id: 'helm', material: 'iron' } },
};
window.ready = async () => {
  sculptedFigures(true); await import('./src/sculpt/sculpted');
  await new Promise((r) => setTimeout(r, 100));
  return !!(await import('./src/sculpt/gl')).glContext();
};
const poseOf = (S, gender, facing, share) => {
  const gear = { ...(OUTFITS[S.outfit ?? 'cloth'] ?? {}) };
  if (S.weapon) gear.weapon = { id: S.weapon, material: 'iron' };
  const secs = visualOf(S.spell)?.cast.timing.secs ?? 1;
  return { phase: S.walk ? share * secs * 6 : 0, moving: !!S.walk, gait: 0, facing, swimming: false, working: false,
    look: { ...DEFAULT_LOOK, gender, beard: 'none' }, gear, cast: share < 0 ? undefined : { id: S.spell, t: share, at: S.at ?? 'creature' } };
};
window.info = (S) => {
  const v = visualOf(S.spell), c = clipFor(poseOf(S, 'man', 1, 0.5));
  return { secs: v?.cast.timing.secs, release: v?.cast.timing.release, clip: c?.clip.name, length: c?.clip.length, at: c ? releaseOf(c.clip) : 0, poses: c?.clip.poses ?? [] };
};
const cell = (S, W, H, gender, facing, share, label) => {
  const zoom = S.zoom ?? 6, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#7d9b5e'; g.fillRect(0, 0, W, H);
  setAnimations?.(!S.still);
  drawFigure(g, W / 2, H * 0.84, zoom, poseOf(S, gender, facing, share));
  g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(label, 4, 13);
  return cv;
};
window.sheet = (S, rows) => {
  const zoom = S.zoom ?? 6, W = Math.ceil(zoom * 36), H = Math.ceil(zoom * 46), gap = 2;
  const n = Math.max(...rows.map((r) => r.length));
  const all = document.createElement('canvas'); all.width = n * (W + gap) - gap; all.height = rows.length * (H + gap) - gap;
  const G = all.getContext('2d'); G.fillStyle = '#2f292b'; G.fillRect(0, 0, all.width, all.height);
  rows.forEach((r, i) => r.forEach((c, j) => G.drawImage(cell(S, W, H, ...c), j * (W + gap), i * (H + gap))));
  return all.toDataURL('image/png');
};
window.fxSheet = (S) => { globalThis.NO_ONBODY = !!S.noOnbody;
  const v = visualOf(S.spell), rel = v.cast.timing.secs * v.cast.timing.release, N = S.frames ?? 5, k = Math.max(1, Math.round((N - 1) * 0.5));
  DEFAULT_LOOK.gender = S.gender ?? 'man';
  const cv = spellSheet({ spell: S.spell, facing: S.facing ?? 1, frames: N, zoom: S.zoom ?? 4, secs: (rel * (N - 1)) / k, ...(S.weapon ? { weapon: S.weapon } : {}), ...(S.target ? { target: S.target } : {}), cols: S.cols ?? N });
  DEFAULT_LOOK.gender = 'man';
  return cv.toDataURL('image/png');
};`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
        let url;
        if (S.fx) {
          await p.evaluate((s) => window.fxSheet(s), S);
          await p.waitForTimeout(300);
          url = await p.evaluate((s) => window.fxSheet(s), S);
        } else {
          const info = await p.evaluate((s) => window.info(s), S);
          const shares = S.shares ? String(S.shares).split(',').map(Number)
            : info.poses.map((q) => +(q.t <= info.at ? (q.t / info.at) * info.release : info.release + ((q.t - info.at) / (info.length - info.at)) * (1 - info.release)).toFixed(4));
          const L = (x) => (x < 0 ? 'idle' : `${(x * 100).toFixed(0)}%`);
          const facings = S.facings ?? [1, 5], genders = S.genders ?? ['man', 'woman'];
          const each = (fn) => genders.flatMap((g) => facings.map((f) => fn(g, f)));
          const rows = S.strip ? each((g, f) => shares.map((x) => [g, f, x, `${S.spell} ${L(x)} | ${g[0]} f${f}`]))
            : shares.map((x) => each((g, f) => [g, f, x, `${S.spell} ${L(x)} | ${g[0]} f${f}`]));
          await p.evaluate(([s, r]) => window.sheet(s, r), [S, rows]);
          await p.waitForTimeout(300);
          url = await p.evaluate(([s, r]) => window.sheet(s, r), [S, rows]);
          console.log(S.name, JSON.stringify(info));
        }
        const f = join(out, `${S.name}.png`);
        writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
        console.log('wrote', f);
        break;
      } catch (e) {
        console.log('retry', S.name, String(e.message).split('\n')[0]);
        await p?.close().catch(() => {});
        p = null;
        if (tries >= 6) { failed++; console.log('FAILED', S.name); break; }
        await new Promise((r) => setTimeout(r, 10000));
      }
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
