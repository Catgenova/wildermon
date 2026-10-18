// Plays a kind's voice offline: node tools/evo/voice.mjs <species> <outdir>. Writes <act>-<stage>.wav and .png, and prints levels.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const [,, species, dir] = process.argv;
mkdirSync(dir, { recursive: true });
const js = '/tmp/evo-voice.js';
execFileSync('npx', ['esbuild', 'tools/evo/voice.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent(`<html><body><script>window.SPECIES=${JSON.stringify(species)}</script></body></html>`);
await p.addScriptTag({ content: readFileSync(js, 'utf8') });
await p.waitForFunction('window.OUT', null, { timeout: 120000 });
const out = await p.evaluate('window.OUT');
for (const [k, v] of Object.entries(out)) {
  writeFileSync(`${dir}/${k}.wav`, Buffer.from(v.wav, 'base64'));
  writeFileSync(`${dir}/${k}.png`, Buffer.from(v.png.split(',')[1], 'base64'));
  console.log(`${k}: peak ${v.peak.toFixed(3)} rms ${v.rms.toFixed(4)}`);
}
if (!Object.keys(out).length) console.log('no voice for', species);
await b.close();
