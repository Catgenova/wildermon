// Renders tools/evo/lineup-chip.ts to a PNG: node tools/evo/lineup-chip.mjs out.png '<json>'
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [,, out, json] = process.argv;
const js = `${out}.lineup.js`;
execFileSync('npx', ['esbuild', 'tools/evo/lineup-chip.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent(`<html><body style="margin:0;background:#222"><script>window.SPEC=${json}</script></body></html>`);
await p.addScriptTag({ content: readFileSync(js, 'utf8') });
await p.waitForFunction('window.DONE', null, { timeout: 120000 });
await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
execFileSync('rm', ['-f', js]);
