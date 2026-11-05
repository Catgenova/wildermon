// Renders tools/dragon/sheet.ts: the dragon proposals' sheets, close-ups and lineup, or a timing of each.
//   node tools/dragon/shot.mjs --out <dir> [--only A,B,C,lineup,live]
//   node tools/dragon/shot.mjs --bench
// Uses Playwright's Chromium and esbuild from node_modules; never `playwright install`.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const out = resolve(opt('out', 'tmp/dragon'));
const only = opt('only', 'A,B,C,lineup').split(',');
const js = join(tmpdir(), 'dragon-sheet.js');
execFileSync('npx', ['esbuild', 'tools/dragon/sheet.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
// The repository's Playwright may be newer than the browser on the machine: the one there, as tools/evo/shot.mjs does.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function page(cfg, file, width) {
  const p = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: cfg.bench ? 1 : 2 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.text().startsWith('ERR')) console.log(m.text()); });
  await p.setContent(`<html><body style="margin:0;padding:6px;background:#26262b"><div id=root></div><script>window.CFG=${JSON.stringify(cfg)}</script></body></html>`);
  await p.addScriptTag({ content: readFileSync(js, 'utf8') });
  await p.waitForFunction('window.DONE', null, { timeout: 120000 });
  if (cfg.bench) console.log(await p.evaluate('window.BENCH'));
  else await p.screenshot({ path: file, fullPage: true });
  await p.close();
}

const W = 560, H = 440, BW = 700, BH = 580;
const c = (who, facing, pose, more = {}) => ({ who, facing, pose, zoom: 0.8, w: W, h: H, label: `${['front', 'front-right', 'right', 'back-right', 'back', 'back-left', 'left', 'front-left'][facing]} · ${pose}`, ...more });

function sheet(who) {
  return {
    rows: [
      { title: `${who === 'live' ? 'Live dragon' : `Proposal ${who}`} — eight turns standing, camera zoom 1 (the island's default)`, cells: [0, 1, 2, 3].map((f) => c(who, f, 'stand:0', { zoom: 1, w: BW, h: BH })) },
      { cells: [4, 5, 6, 7].map((f) => c(who, f, 'stand:0', { zoom: 1, w: BW, h: BH })) },
      { title: 'Rows below at camera zoom 0.8', cells: [] },
      { title: 'Idle loop (seconds into its 24 s loop): breathing, looking round, wings stretched at 6 s and 17.5 s', cells: [['stand:2', 1], ['stand:7.5', 1], ['stand:12', 7], ['stand:19', 3]].map(([p, f]) => c(who, f, p)) },
      { title: 'Walking (right) and running (front-right), through a stride', cells: [['walk:0', 2], ['walk:0.5', 2], ['run:0.15', 1], ['run:0.6', 1]].map(([p, f]) => c(who, f, p)) },
      { title: 'Strike: rear, lunge and breath (0.55 s), as the island keeps it in pictures', cells: [['strike:0.2', 1], ['strike:0.45', 1], ['strike:0.65', 1], ['strike:0.9', 1]].map(([p, f]) => c(who, f, p)) },
      { title: 'Breath at the other turns', cells: [['strike:0.65', 2], ['strike:0.65', 0], ['strike:0.65', 4], ['strike:0.65', 6]].map(([p, f]) => c(who, f, p)) },
      { title: 'Night: the island\'s wash, less the dragon\'s own 5-tile light', cells: [['stand:7.5', 1], ['walk:0.25', 3], ['strike:0.65', 2], ['stand:0', 5]].map(([p, f]) => c(who, f, p, { night: true, label: `night · ${p}` })) },
      { title: 'Its four colourings, camera zoom 0.35 (the furthest out the island goes)', cells: [0, 1, 2, 3].map((v) => ({ who, facing: 1, pose: 'stand:0', zoom: 0.35, variant: v, w: W, h: 230, label: `variant ${v} · zoom 0.35` })) },
    ],
  };
}

function close(who) {
  return {
    rows: [
      { title: `${who === 'live' ? 'Live dragon' : `Proposal ${who}`} — close up (camera zoom 1.5)`, cells: [['stand:0', 1], ['stand:7.5', 7]].map(([p, f]) => ({ who, facing: f, pose: p, zoom: 1.5, w: 1100, h: 820, label: `close · ${p}` })) },
      { cells: [['strike:0.65', 1], ['run:0.6', 3]].map(([p, f]) => ({ who, facing: f, pose: p, zoom: 1.5, w: 1100, h: 820, label: `close · ${p}` })) },
    ],
  };
}

const LINE = ['live', 'A', 'B', 'C', 'cobbe@2', 'embra@2', 'whispet@2'];
const lineup = {
  rows: [
    { title: 'Lineup at camera zoom 0.6: the live dragon, the three proposals, and the Bastiondrake, Slugferno and Hallowmire', cells: [{ who: 'live', row: LINE, facing: 1, zoom: 0.6, w: 1900, h: 380, label: 'front-right' }] },
    { cells: [{ who: 'live', row: LINE, facing: 7, zoom: 0.6, w: 1900, h: 380, label: 'front-left' }] },
    { cells: [{ who: 'live', row: LINE, facing: 2, zoom: 0.6, w: 1900, h: 380, label: 'right' }] },
    { title: 'Side by side for style: each dragon at camera zoom 0.5, each wildermon at zoom 5 (ten times closer)', cells: [['live', 0.5], ['A', 0.5], ['B', 0.5], ['C', 0.5]].map(([who, zoom]) => ({ who, facing: 1, pose: 'stand:0', zoom, w: 470, h: 300, label: who })) },
    { cells: [['cobbe@2', 5], ['embra@2', 5], ['whispet@2', 5], ['stona@2', 5]].map(([who, zoom]) => ({ who, facing: 1, pose: 'stand:0', zoom, w: 470, h: 300, label: `${who} at zoom 5` })) },
  ],
};

if (args.includes('--bench')) {
  await page({ bench: true }, null, 1000);
} else {
  mkdirSync(out, { recursive: true });
  for (const who of only) {
    if (who === 'lineup') await page(lineup, join(out, 'dragon-lineup.png'), 1940);
    else {
      await page(sheet(who), join(out, `dragon-${who}.png`), 2880);
      await page(close(who), join(out, `dragon-${who}-close.png`), 2260);
    }
  }
}
await browser.close();
