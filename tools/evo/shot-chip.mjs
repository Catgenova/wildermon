// tools/evo/shot.mjs with its own bundle path, so two of them can run at once: node tools/evo/shot-chip.mjs out.png '<rows json>' [width]
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [,, out, json, width] = process.argv;
const js = `${out}.sheet.js`;
execFileSync('npx', ['esbuild', 'tools/evo/sheet.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: Number(width ?? 1500), height: 400 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent(`<html><body style="margin:0;background:#222"><div id=root></div><script>window.ROWS=${json}</script></body></html>`);
await p.addScriptTag({ content: readFileSync(js, 'utf8') });
await p.waitForFunction('window.DONE');
await p.screenshot({ path: out, fullPage: true });
await b.close();
execFileSync('rm', ['-f', js]);
