/**
 * Renders tools/orc/sheet.ts to a PNG at two pixels to the point.
 *
 *   node tools/orc/shot.mjs out.png A         # proposal A's sheet (or B, C, or orc for the orc on the island)
 *   node tools/orc/shot.mjs out.png close:A   # proposal A close up
 *   node tools/orc/shot.mjs out.png lineup    # every orc beside a person, the goblin, the ogre and three wildermon
 *   node tools/orc/shot.mjs - bench           # each orc's drawing cost, printed
 *
 * Uses Playwright's Chromium (`/opt/pw-browsers/chromium` when it is there) and esbuild from node_modules.
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [,, out, plan = 'A'] = process.argv;
const js = join(tmpdir(), 'orc-sheet.js');
execFileSync('npx', ['esbuild', 'tools/orc/sheet.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });

const turns = [0, 1, 2, 3, 4, 5, 6, 7];
const NAMES = { A: 'A: Runebrand brute', B: 'B: Ironshield veteran', C: 'C: War-chanter', orc: 'The orc on the island now' };
const game = (who, extra = {}) => ({ who, mode: 'game', zoom: 1, w: 165, h: 300, ...extra });
const close = (who, extra = {}) => ({ who, mode: 'close', k: 27, w: 300, h: 430, ...extra });

function sheet(who) {
  const strikes = [0.08, 0.2, 0.3, 0.38, 0.44, 0.52, 0.64, 0.8, 0.95];
  return [
    { title: `${NAMES[who] ?? who} -- the eight turns, standing, at the island's zoom (1), by day`, rows: [turns.map((f) => game(who, { facing: f, label: `turn ${f}` }))] },
    { title: 'by night', rows: [turns.map((f) => game(who, { facing: f, night: true, label: `turn ${f}` }))] },
    { title: 'standing about (its 24 s loop), turn 1', rows: [[0, 2.6, 4.2, 5.6, 8.4, 11, 14.4, 16.6, 20].map((t) => game(who, { t, label: `t ${t}` }))] },
    { title: 'walking and running, turns 1 and 6', rows: [[...[0, 0.25, 0.5, 0.75].map((u) => game(who, { pose: `walk:${u}`, label: `walk ${u}` })), ...[0, 0.25, 0.5, 0.75].map((u) => game(who, { pose: `run:${u}`, facing: 6, label: `run ${u}` }))]] },
    { title: 'striking, turn 1 and turn 6', rows: [strikes.map((t) => game(who, { pose: `strike:${t}`, label: `strike ${t}` })), strikes.map((t) => game(who, { pose: `strike:${t}`, facing: 6, label: `strike ${t}` }))] },
    closeRows(who),
  ];
}
function closeRows(who) {
  return {
    title: 'close up: turns 1, 7, 3, 0, 5, striking, by night',
    rows: [[close(who, { facing: 1 }), close(who, { facing: 7 }), close(who, { facing: 3 }), close(who, { facing: 0 }), close(who, { facing: 5 }), close(who, { facing: 1, pose: 'strike:0.4' }), close(who, { facing: 2, pose: 'strike:0.5' }), close(who, { facing: 1, night: true })]],
  };
}
function lineup() {
  const row = (zoom, night, list) => [{ mode: 'game', zoom, night, w: 150 * zoom * list.length, h: 370 * zoom, label: `${list.map((b) => b.who).join(', ')} at zoom ${zoom}${night ? ', by night' : ''}`,
    lineup: list.map((b, i) => ({ ...b, dx: (i - (list.length - 1) / 2) * 146 * zoom })) }];
  const main = ['person', 'goblin', 'orc', 'A', 'B', 'C', 'ogre'].map((who) => ({ who, facing: 1 }));
  const kin = ['cobbe@2', 'A', 'whispet@2', 'B', 'relka@2', 'C', 'sparra@2'].map((who) => ({ who, facing: 1 }));
  const turned = ['A', 'B', 'C'].flatMap((who) => [{ who, facing: 7 }, { who, facing: 4 }]);
  return [
    { title: 'Lineup at the island zoom: a person, the goblin, the orc now, A, B, C, the ogre', rows: [row(1, false, main), row(1, true, main)] },
    { title: 'Beside three revamped wildermon (Bastiondrake, Hallowmire, Aureliax) and the Dummititan', rows: [row(1, false, kin)] },
    { title: 'Zoomed out (0.5), day and night', rows: [row(0.5, false, main), row(0.5, true, main)] },
    { title: 'Turned away: A, B, C at turns 7 and 4', rows: [row(1, false, turned)] },
  ];
}

let spec;
if (plan === 'bench') spec = { sections: [], bench: { who: (process.argv[4] ?? 'orc,A,B,C').split(','), n: 80, frames: 30 } };
else if (plan === 'lineup') spec = { sections: lineup() };
// Chosen moments close up (the list inline, or `@file`): `frames '<title>' '[{"who":"A","pose":"run-strike:0.68","facing":2,"t":0}, ...]'`, eight to a row.
// Every turn against a run of moments (strike, run, striking on the move, the bellow), small, for looking for what passes through
// what: `audit:A`.
else if (plan.startsWith('audit:')) {
  const who = plan.slice(6);
  const poses = [...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75].map((t) => `strike:${t}`), ...[0, 0.25, 0.5, 0.75].map((u) => `run:${u}`), 'walk-strike:0.2', 'run-strike:0.4', 'stand'];
  spec = { sections: [{ title: `${who}: every turn (rows 0 to 7) through the strike, the run, striking on the move and its loop's bellow`,
    rows: turns.map((f) => poses.map((pose) => close(who, { facing: f, pose: pose === 'stand' ? undefined : pose, t: pose === 'stand' ? { A: 6.2, B: 10.4, C: 8.6 }[who] ?? 0 : 0, k: 12, w: 112, h: 175, label: `${f} ${pose}` }))) }] };
}
else if (plan === 'frames') {
  const list = JSON.parse(process.argv[5].startsWith('@') ? readFileSync(process.argv[5].slice(1), 'utf8') : process.argv[5]);
  const rows = [];
  for (let i = 0; i < list.length; i += 8) rows.push(list.slice(i, i + 8).map((c) => close(c.who, { k: 22, w: 220, h: 330, ...c, label: c.label ?? `${c.who} ${c.pose ?? `stand ${c.t ?? 0}`} turn ${c.facing ?? 1}` })));
  spec = { sections: [{ title: process.argv[4], rows }] };
}
else if (plan.startsWith('close:')) spec = { sections: [closeRows(plan.slice(6))] };
else spec = { sections: sheet(plan) };

const exe = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const p = await b.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await p.setContent(`<html><body style="margin:0;background:#26282c;font:12px sans-serif;color:#ddd;display:inline-block;padding:6px">
<style>.title{margin:10px 2px 4px;font-weight:bold}.row{white-space:nowrap}.cell{display:inline-block;margin:2px;text-align:center;font-size:10px;vertical-align:top}</style>
<div id=root></div><script>window.SPEC=${JSON.stringify(spec)}</script></body></html>`);
await p.addScriptTag({ content: readFileSync(js, 'utf8') });
await p.waitForFunction('window.DONE', null, { timeout: 900000 });
if (plan === 'bench') console.log(JSON.stringify(await p.evaluate('window.BENCH'), null, 1));
else await p.locator('body').screenshot({ path: out });
await b.close();
