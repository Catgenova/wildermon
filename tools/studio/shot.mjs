// The asset studio: every drawable asset in the game, catalogued, drawn to a
// contact sheet as the game draws it, and judged against docs/aesthetic.md.
// The page is tools/studio/page.ts; what there is and how each is drawn is
// tools/studio/families.ts; the checks are tools/studio/checks.ts.
//
//   node tools/studio/shot.mjs --list                      # every asset by family: style, views, states, variants, moving parts, file and its lines
//   node tools/studio/shot.mjs --list creature             # one family
//   node tools/studio/shot.mjs --list --json               # the same as JSON
//   node tools/studio/shot.mjs furniture:chair             # tmp/studio/furniture-chair.png: views, zooms, day and night, states, variants, motion strips, checks
//   node tools/studio/shot.mjs creature:rabba player:default tree:oak world:meadow
//   node tools/studio/shot.mjs creature:rabba --check      # the checks alone, no picture
//   node tools/studio/shot.mjs creature:rabba --bench      # ms to draw it fresh, kept, and twenty of it
//   node tools/studio/shot.mjs furniture:chair --baseline  # keep this sheet as the one a rework is judged against (tmp/studio/baseline/)
//   node tools/studio/shot.mjs furniture:chair --compare   # baseline | current | difference, tmp/studio/furniture-chair-compare.png
//   node tools/studio/shot.mjs player:default --ref some.png   # a reference beside the cells (by default the family's from docs/aesthetic/)
//   --out dir --zooms 1,2 --mag 2 --turns 0,1,2,3,4,5,6,7 --facings 0,1,2,3,4,5,6,7 --frames 6 --hours 6,9,13,17,19,22 --seasons summer,winter
//
// Uses Playwright's Chromium (/opt/pw-browsers/chromium when it is there) and
// esbuild from node_modules; never `playwright install`.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const nums = (s) => s.split(',').map(Number);
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const out = resolve(opt('out', 'tmp/studio'));
const spec = {
  zooms: nums(opt('zooms', '1,2')), mag: Number(opt('mag', '2')), turns: nums(opt('turns', '0,1,2,3,4,5,6,7')), facings: nums(opt('facings', '0,1,2,3,4,5,6,7')),
  frames: Number(opt('frames', '0')), hours: nums(opt('hours', '6,9,13,17,19,22')), seasons: opt('seasons', 'summer').split(','),
};
const refPath = opt('ref', null);
const json = flag('json');
const listing = flag('list');
const checkOnly = flag('check');
const benching = flag('bench');
const baseline = flag('baseline');
const compare = flag('compare');
const dpr = Number(opt('dpr', '1'));
const targets = args.filter((a) => !a.startsWith('--'));
if (!listing && !targets.length) {
  console.error('usage: node tools/studio/shot.mjs --list [family] | <family>:<kind>... [--check] [--bench] [--baseline] [--compare] [--ref png] [--out dir] [--zooms 1,2] [--mag 2]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const bundled = await build({
  entryPoints: [join(ROOT, 'tools/studio/page.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error', target: 'es2022',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const js = bundled.outputFiles[0].text;

const kept = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(kept) ? { executablePath: kept } : {});
async function page(scale = 1) {
  const p = await browser.newPage({ viewport: { width: 1900, height: 900 }, deviceScaleFactor: scale });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent('<html><body style="margin:0;background:#2a2622"><div id=root style="display:inline-block;padding-bottom:8px;min-width:1900px"></div></body></html>');
  await p.addScriptTag({ content: js });
  await p.waitForFunction('window.studio && window.studio.ready', null, { timeout: 60000 });
  const err = await p.evaluate(() => window.studio.error);
  if (err) console.error(err);
  return { p, errors };
}

/** Lines in a file the catalogue names, where it names one that is there. */
function linesOf(file) {
  const first = file.split(/[ ,]/)[0];
  const path = join(ROOT, first);
  if (!existsSync(path)) return '';
  if (statSync(path).isDirectory()) return readdirSync(path).filter((f) => f.endsWith('.ts')).reduce((n, f) => n + readFileSync(join(path, f), 'utf8').split('\n').length, 0);
  return readFileSync(path, 'utf8').split('\n').length;
}

/** The family's reference out of docs/aesthetic, by its number, as a data URL. */
function refFor(n) {
  const dir = join(ROOT, 'docs/aesthetic');
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((x) => x.startsWith(String(n).padStart(2, '0')));
  if (!f) return null;
  return { url: `data:image/jpeg;base64,${readFileSync(join(dir, f)).toString('base64')}`, note: f };
}
const refOf = (path) => ({ url: `data:image/${path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'jpeg' : 'png'};base64,${readFileSync(path).toString('base64')}`, note: basename(path) });

if (listing) {
  const { p } = await page();
  const all = await p.evaluate(() => window.studio.catalogue());
  const about = await p.evaluate(() => window.FAMILY_ABOUT());
  await p.close();
  const only = targets[0];
  const rows = all.filter((a) => !only || a.family === only).map((a) => ({ ...a, lines: linesOf(a.file) }));
  if (json) console.log(JSON.stringify(rows, null, 1));
  else {
    const byFamily = new Map();
    for (const a of rows) byFamily.set(a.family, [...(byFamily.get(a.family) ?? []), a]);
    for (const [fam, list] of byFamily) {
      const info = about.find(([id]) => id === fam);
      const kit = list.filter((a) => a.style === 'kit' || a.style === 'model').length;
      console.log(`\n== ${fam} (${list.length}; ${kit} in the kit or modelled, ${list.length - kit} old, flat or scene-only) · ${info ? info[1] : ''}\n   ${info ? info[2] : ''}`);
      for (const a of list) {
        const parts = [
          a.style, a.views === 'none' ? '' : a.views,
          a.states.length ? `states ${a.states.map((s) => s.label).join('|')}` : '',
          a.variants.length ? `variants ${a.variants.length}` : '',
          a.motions.length ? `moves ${a.motions.map((m) => m.id).join('|')}` : 'still',
          a.emissive ? 'emissive' : '', a.heightPx ? `${a.heightPx}px` : '',
        ].filter(Boolean).join(' · ');
        console.log(`  ${`${fam}:${a.kind}`.padEnd(30)} ${a.name.padEnd(28).slice(0, 28)} ${parts}\n  ${''.padEnd(30)} ${a.entry} · ${a.file}${a.lines ? ` (${a.lines} lines)` : ''}`);
      }
    }
    console.log(`\n${rows.length} assets in ${byFamily.size} families.`);
  }
  await browser.close();
  process.exit(0);
}

let failed = 0;
for (const target of targets) {
  const [family, kind] = target.split(':');
  const { p, errors } = await page(dpr);
  const ref = refPath ? refOf(resolve(refPath)) : null;
  const want = { family, kind, ...spec };
  if (benching) {
    const b = await p.evaluate((s) => window.studio.bench(s), want);
    console.log(`${target}: fresh ${b.fresh.toFixed(2)} ms, kept ${b.kept.toFixed(2)} ms, twenty ${b.crowd.toFixed(1)} ms`);
    await p.close();
    continue;
  }
  // The reference: the one given, or the family's out of docs/aesthetic by the asset's number.
  let refNow = ref;
  if (!refNow) {
    const all = await p.evaluate(() => window.studio.catalogue());
    const a = all.find((x) => x.family === family && x.kind === kind);
    if (a) refNow = refFor(a.ref);
  }
  if (refNow) { want.ref = refNow.url; want.refNote = refNow.note; }
  const report = await p.evaluate((s) => window.studio.sheet(s), want);
  if (report.error) { console.error(report.error); failed++; await p.close(); continue; }
  const bad = report.checks.filter((c) => c.ok === false);
  console.log(`\n${target} — ${report.asset.name} · ${report.asset.register} · ${report.asset.style} · ${report.asset.entry}`);
  for (const c of report.checks) console.log(`  ${c.ok === null ? '  · ' : c.ok ? ' ok ' : 'FAIL'} ${c.id.padEnd(20)} ${c.said}  [${c.cell}]`);
  if (report.box) console.log(`  box at zoom 1: ${report.box.map((v) => v.toFixed(0)).join(', ')} (left, top, right, bottom from the floor contact)`);
  if (errors.length) console.error(errors.join('\n'));
  if (bad.length) failed++;
  if (!checkOnly) {
    const name = `${family}-${kind}`;
    const file = join(out, `${name}.png`);
    await p.locator('#root').screenshot({ path: file });
    console.log(`  ${file}`);
    if (baseline) {
      mkdirSync(join(out, 'baseline'), { recursive: true });
      copyFileSync(file, join(out, 'baseline', `${name}.png`));
      console.log(`  kept as baseline: ${join(out, 'baseline', `${name}.png`)}`);
    }
    if (compare) {
      const base = join(out, 'baseline', `${name}.png`);
      if (!existsSync(base)) console.error(`  no baseline for ${name}: run with --baseline first`);
      else {
        const q = await browser.newPage({ viewport: { width: 1900, height: 900 } });
        const asUrl = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
        await q.setContent(`<html><body style="margin:0;background:#2a2622;color:#ddd;font:12px system-ui"><div id=root style="display:inline-block"></div>
<script>
window.go = async (a, b) => {
  const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
  const cv = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return g; };
  const ga = cv(A), gb = cv(B);
  const da = ga.getImageData(0, 0, w, h), db = gb.getImageData(0, 0, w, h);
  const d = document.createElement('canvas'); d.width = w; d.height = h; const gd = d.getContext('2d'); const out = gd.createImageData(w, h);
  let n = 0;
  for (let i = 0; i < da.data.length; i += 4) {
    const diff = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
    const changed = diff > 30; if (changed) n++;
    out.data[i] = changed ? 255 : db.data[i] * 0.25; out.data[i + 1] = changed ? 40 : db.data[i + 1] * 0.25; out.data[i + 2] = changed ? 140 : db.data[i + 2] * 0.25; out.data[i + 3] = 255;
  }
  gd.putImageData(out, 0, 0);
  const root = document.getElementById('root');
  const col = (title, c) => { const b = document.createElement('div'); b.style.cssText = 'display:inline-block;vertical-align:top;margin:4px'; const t = document.createElement('div'); t.textContent = title; b.append(t, c); root.append(b); };
  col('baseline', ga.canvas); col('current', gb.canvas); col('difference: ' + (100 * n / (w * h)).toFixed(2) + '% of pixels', d);
  return n / (w * h);
};
</script></body></html>`);
        const share = await q.evaluate(([a, b]) => window.go(a, b), [asUrl(base), asUrl(file)]);
        const cfile = join(out, `${name}-compare.png`);
        await q.locator('#root').screenshot({ path: cfile });
        console.log(`  compare: ${(share * 100).toFixed(2)}% of pixels differ from the baseline → ${cfile}`);
        await q.close();
      }
    }
  }
  await p.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
