// Renders tools/evo/sheet.ts to a PNG: node tools/evo/shot.mjs out.png '<rows json>'
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [,, out, json] = process.argv;
const js = '/tmp/evo-sheet.js';
execFileSync('npx', ['esbuild', 'tools/evo/sheet.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 400 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent(`<html><body style="margin:0;background:#222"><div id=root></div><script>window.ROWS=${json}</script></body></html>`);
await p.addScriptTag({ content: readFileSync(js, 'utf8') });
await p.waitForFunction('window.DONE');
await p.screenshot({ path: out, fullPage: true });
await b.close();
