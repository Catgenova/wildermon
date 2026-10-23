/**
 * A contact sheet of furniture: each kind's old model (`MODELS` in
 * src/render/furniture.ts) beside its kit model (src/render/kit/, drawn by
 * src/render/kitpieces.ts), from several views, at zoom 1 and 2, by day and
 * at night, plain, dyed, in several woods, lit where it lights, and in every
 * state and layer the kit piece declares -- for converting a piece and
 * judging it. A few seconds a run.
 *
 *   node tools/piece-sheet.mjs chair chest                 # tmp/sheet-chair.png, tmp/sheet-chest.png
 *   node tools/piece-sheet.mjs chest --out /some/dir      # where the PNGs go (default tmp/, untracked)
 *   node tools/piece-sheet.mjs chair --mag 3              # pixels shown 3x, nearest-neighbour (default 2)
 *   node tools/piece-sheet.mjs chest --zooms 1,2,3        # zooms drawn (default 1,2)
 *   node tools/piece-sheet.mjs chest --views s0,e0,n0,w0,s1,s3   # facing + camera turn 0-7 (default s0,e0,n0,w0,s1)
 *   node tools/piece-sheet.mjs chest --dye '#c45b6a'      # the dye in the dyed rows (default a blue)
 *   node tools/piece-sheet.mjs chest --woods oak,pine,plum  # the woods row (default oak,birch,cherry,plum)
 *   node tools/piece-sheet.mjs table --lit                # add the lit rows for a piece the kit does not mark lit
 *   node tools/piece-sheet.mjs chest --only new           # the kit model alone (or `old`)
 *   node tools/piece-sheet.mjs @anvil @smelter @kiln den_medium   # the kit's reference pieces, to hold a new one against
 *   node tools/piece-sheet.mjs chair chest --one          # every kind on one sheet, tmp/sheet.png
 *
 * Each sheet has a row per zoom and light, old cells on the left and kit cells
 * on the right, every cell of a zoom the same size, on grass with the piece's
 * footprint in pale squares (one a subtile) under it. Night is the island's
 * wash (`NIGHT_WASH`) over the cell. A kind not in the kit shows its old model
 * alone. Uses Playwright's Chromium at /opt/pw-browsers/chromium and esbuild
 * from node_modules; never `playwright install`.
 */
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
const out = resolve(opt('out', 'tmp'));
const mag = Number(opt('mag', '2'));
const zooms = opt('zooms', '1,2').split(',').map(Number);
const views = opt('views', 's0,e0,n0,w0,s1').split(',').map((v) => [v[0], Number(v.slice(1))]);
const dye = opt('dye', '#4f7ec8');
const woods = opt('woods', 'oak,birch,cherry,plum').split(',');
const only = opt('only', undefined);
const lit = flag('lit');
const one = flag('one');
const kinds = args.filter((a) => !a.startsWith('--'));
if (!kinds.length) {
  console.error('usage: node tools/piece-sheet.mjs <kind|@anvil|@smelter|@kiln>... [--out dir] [--mag n] [--zooms 1,2] [--views s0,e0] [--dye #hex] [--woods a,b] [--lit] [--only old|new] [--one]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const bundled = await build({ entryPoints: ['tools/piece-sheet.ts'], bundle: true, format: 'iife', write: false, logLevel: 'warning' });
const code = bundled.outputFiles[0].text;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const css = `body{margin:0;background:#2b2a33;color:#ddd;font:12px system-ui,sans-serif}
.block{padding:8px 10px 14px;border-bottom:1px solid #444} h2{font-size:14px;margin:2px 0 6px;color:#f3e2b8}
.row{display:flex;align-items:flex-end;gap:4px;margin:3px 0;white-space:nowrap}
.label{width:118px;flex:none;color:#bbb}.gap{width:14px;flex:none;border-left:2px dashed #666;align-self:stretch}
.cell{display:flex;flex-direction:column;align-items:center}.cell.new .cap{color:#bfe3a0}.cap{font-size:10px;color:#aaa}
canvas{display:block}`;
const shoot = async (list, file) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const sheet = { kinds: list, views, zooms, dye, woods, mag, lit, only };
  await page.setContent(`<html><head><style>${css}</style></head><body><div id=root></div><script>window.SHEET=${JSON.stringify(sheet)}</script></body></html>`);
  await page.addScriptTag({ content: code });
  await page.waitForFunction('window.DONE || window.FAILED', null, { timeout: 60000 }).catch(() => {});
  if (errors.length) console.error(errors.join('\n'));
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  console.log(file);
};
if (one) await shoot(kinds, join(out, 'sheet.png'));
else for (const k of kinds) await shoot([k], join(out, `sheet-${k.replace(/^@/, 'ref-')}.png`));
await browser.close();
