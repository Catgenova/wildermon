// Writes the wildermon dex: node tools/dex/build.mjs <outdir>
//
// Draws every stage's strip in a browser with the game's own renderer (tools/dex/dex.ts) and writes <outdir>/index.html,
// with each strip beside it as <outdir>/sprites/<kind>-<stage>.webp. Run it again after anything about a wildermon
// changes; nothing on the page is written by hand.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('usage: node tools/dex/build.mjs <outdir>');
const js = join(out, '.dex.js');
mkdirSync(out, { recursive: true });
execFileSync('npx', ['esbuild', 'tools/dex/dex.ts', '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.setContent('<html><body></body></html>');
await p.addScriptTag({ content: readFileSync(js, 'utf8') });
await p.waitForFunction('window.DONE', null, { timeout: 0 });
const err = await p.evaluate('window.DEX_ERROR');
if (err) throw new Error(err);
const dex = await p.evaluate('window.DEX');
await b.close();
rmSync(js);

rmSync(join(out, 'sprites'), { recursive: true, force: true });
mkdirSync(join(out, 'sprites'));
for (const row of dex.rows) {
  row.stages.forEach((s, i) => {
    if (!s.strip) return;
    const file = `sprites/${row.id}-${i}.webp`;
    writeFileSync(join(out, file), Buffer.from(s.strip.split(',')[1], 'base64'));
    s.strip = file;
  });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ROMAN = ['I', 'II', 'III'];
const STATUS = { line: 'Revamped', named: 'Art in progress', single: 'Not revamped' };
const pct = (m) => `${Math.round((m - 1) * 100)}%`;

function stageCell(row, i) {
  const s = row.stages[i];
  if (!s) return '<td class="stage"><div class="tbd" aria-label="Not revamped yet">TBD</div><div class="sname muted">Not named yet</div></td>';
  const lv = i === 0 ? 'From birth' : `Level ${s.at}`;
  if (!s.strip) {
    return `<td class="stage"><div class="tbd" aria-label="No model yet">TBD</div><div class="sname">${esc(s.name)}</div><div class="lv">${lv}</div></td>`;
  }
  const n = s.segments.reduce((a, g) => a + g.frames, 0);
  const segs = esc(JSON.stringify(s.segments.map((g) => [g.label, g.frames])));
  return `<td class="stage"><div class="frame" role="img" aria-label="${esc(s.name)}, cycling through ${esc(s.segments.map((g) => g.label.toLowerCase()).join(', '))}" data-n="${n}" data-seg="${segs}" style="--n:${n};background-image:url(${s.strip})"><span class="pose">${esc(s.segments[0].label)}</span></div><div class="sname">${esc(s.name)}</div><div class="lv">${lv}</div></td>`;
}

function statsCell(row) {
  const named = row.stages;
  const head = named.map((_, i) => `<th scope="col">${ROMAN[i]}</th>`).join('');
  const line = (label, key) => `<tr><th scope="row">${label}</th>${named.map((s) => `<td>${s[key]}</td>`).join('')}</tr>`;
  return `<td class="stats"><table class="mini"><thead><tr><th></th>${head}</tr></thead><tbody>${line('Health', 'health')}${line('Attack', 'attack')}${line('Speed', 'speed')}</tbody></table><p>${esc(row.tame)}</p><p>Blows leave a ${esc(row.wound.toLowerCase())}</p></td>`;
}

const listOf = (lines) => `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
const TEMPER_CLASS = { Hunter: 'hunter', 'Strikes back': 'back', Skittish: 'skittish', Unruly: 'unruly', Docile: 'docile' };

function rowHtml(row) {
  const was = row.was.length ? `<div class="was">was the ${esc(row.was.join(', the '))}</div>` : '';
  const search = esc([row.id, ...row.stages.map((s) => s.name), ...row.was].join(' ').toLowerCase());
  return `<tr data-status="${row.status}" data-q="${search}">
<th scope="row" class="kind"><div class="kname">${esc(row.name)}</div>${was}<span class="status ${row.status}">${STATUS[row.status]}</span></th>
${[0, 1, 2].map((i) => stageCell(row, i)).join('')}
${statsCell(row)}
<td class="trade">${listOf(row.trade)}</td>
<td class="temper"><span class="tpill ${TEMPER_CLASS[row.temper.label]}">${esc(row.temper.label)}</span>${listOf(row.temper.lines)}</td>
</tr>`;
}

const TIERS = ['common', 'rare', 'supreme', 'fantastic'];
const TIER_NAME = { common: 'Common', rare: 'Rare', supreme: 'Supreme', fantastic: 'Fantastic' };
function traitRows(list) {
  return list.map((t) => `<tr><th scope="row">${esc(t.name)}${t.aura ? ' <span class="aura" title="Lifts every wildermon on the same settlement or post, the bearer included">herd-wide</span>' : ''}</th>${TIERS.map((tier) => `<td class="g ${t.grades[tier] ? tier : 'none'}">${t.grades[tier] ? esc(t.grades[tier]) : '<span aria-label="Not at this grade">·</span>'}</td>`).join('')}</tr>`).join('');
}

const counts = { line: 0, named: 0, single: 0 };
for (const r of dex.rows) counts[r.status]++;
const mul = dex.stageMul;
const html = `<title>Wildermon Dex</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans+SC:wght@500;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Cormorant+Unicase:wght@600;700&display=swap">
<style>
/* Runecut's carved stone by day and the same stone under the island's night: one long ledger of kinds, then the traits. */
:root {
  --stone: #f2e7d3; --stone-2: #e8dcc6; --field: #fbf6ec; --deep: #d8cbb5;
  --ink: #463d50; --strong: #2b2333; --carve: #5d5464; --shade: #8f879c;
  --rune: #a7631a; --rune-soft: #f3d9b0; --moss: #3f6632; --moss-soft: #dcebcb;
  --ember: #933f30; --ember-soft: #f2d3cc; --teal: #285d84; --teal-soft: #d6e6f2; --rose: #7a4a6a; --rose-soft: #ecdbe6;
  --common: #5d5464; --rare: #285d84; --supreme: #6b4699; --fantastic: #7a4e08;
  --ground: #c9d6b4; --line: rgba(70, 61, 80, 0.18);
  --title: 'Cormorant Unicase', 'Palatino Linotype', Georgia, serif;
  --label: 'Alegreya Sans SC', 'Gill Sans', 'Segoe UI', sans-serif;
  --body: 'Alegreya Sans', 'Gill Sans', 'Segoe UI', system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --stone: #2b2b3d; --stone-2: #262638; --field: #222233; --deep: #1c1c2b;
  --ink: #f1ebe0; --strong: #fffbea; --carve: #e2dae8; --shade: #a9a2b6;
  --rune: #f2b968; --rune-soft: #4a3a26; --moss: #c2e4ae; --moss-soft: #2f4029; --ember: #fbcabf; --ember-soft: #4d2d2a;
  --teal: #b8dcf5; --teal-soft: #26394a; --rose: #efd6d9; --rose-soft: #43303d;
  --common: #e2dae8; --rare: #b8dcf5; --supreme: #e2cff7; --fantastic: #f8d68e;
  --ground: #34402f; --line: rgba(241, 235, 224, 0.14); color-scheme: dark;
} }
:root[data-theme="dark"] {
  --stone: #2b2b3d; --stone-2: #262638; --field: #222233; --deep: #1c1c2b;
  --ink: #f1ebe0; --strong: #fffbea; --carve: #e2dae8; --shade: #a9a2b6;
  --rune: #f2b968; --rune-soft: #4a3a26; --moss: #c2e4ae; --moss-soft: #2f4029; --ember: #fbcabf; --ember-soft: #4d2d2a;
  --teal: #b8dcf5; --teal-soft: #26394a; --rose: #efd6d9; --rose-soft: #43303d;
  --common: #e2dae8; --rare: #b8dcf5; --supreme: #e2cff7; --fantastic: #f8d68e;
  --ground: #34402f; --line: rgba(241, 235, 224, 0.14); color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--stone); color: var(--ink); font: 15px/1.45 var(--body); margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 56px; }
header, .intro, .controls, section > h2, section > p { max-width: 72rem; }
h1 { font: 700 clamp(2rem, 5vw, 3.1rem)/1 var(--title); color: var(--strong); margin: 0 0 6px; letter-spacing: 0.01em; text-wrap: balance; }
h2 { font: 700 1.7rem/1.1 var(--title); color: var(--strong); margin: 44px 0 6px; text-wrap: balance; }
.intro { color: var(--carve); max-width: 62ch; margin: 0 0 18px; }
.tally { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 22px; }
.tally span { font: 500 0.82rem/1 var(--label); letter-spacing: 0.04em; padding: 7px 11px; border-radius: 999px; background: var(--field); border: 1px solid var(--line); }
.tally b { font-variant-numeric: tabular-nums; color: var(--strong); }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.controls input { font: 15px var(--body); color: var(--ink); background: var(--field); border: 1px solid var(--line); border-radius: 6px; padding: 8px 11px; min-width: 0; flex: 1 1 14rem; max-width: 22rem; }
.controls button { font: 500 0.85rem/1 var(--label); letter-spacing: 0.04em; color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; cursor: pointer; }
.controls button[aria-pressed="true"] { background: var(--strong); color: var(--stone); border-color: var(--strong); }
:focus-visible { outline: 2px solid var(--rune); outline-offset: 2px; }
.wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--field); }
table.dex { border-collapse: collapse; width: 100%; min-width: 1180px; }
.dex > thead th { position: sticky; top: 0; z-index: 2; background: var(--stone-2); font: 700 0.78rem/1.2 var(--label); letter-spacing: 0.06em; text-align: left; color: var(--carve); padding: 10px 10px; border-bottom: 1px solid var(--line); }
.dex > tbody > tr > * { vertical-align: top; padding: 12px 10px; border-bottom: 1px solid var(--line); }
.dex > tbody > tr:nth-child(even) { background: color-mix(in srgb, var(--stone-2) 45%, transparent); }
.kind { width: 9.5rem; text-align: left; font-weight: 400; }
.kname { font: 700 1.15rem/1.1 var(--title); color: var(--strong); }
.was { font-size: 0.82rem; color: var(--carve); font-style: italic; margin-top: 2px; }
.status { display: inline-block; margin-top: 8px; font: 500 0.72rem/1 var(--label); letter-spacing: 0.05em; padding: 4px 7px; border-radius: 4px; }
.status.line { background: var(--moss-soft); color: var(--moss); }
.status.named { background: var(--rune-soft); color: var(--rune); }
.status.single { background: var(--stone-2); color: var(--carve); }
.stage { width: 150px; text-align: center; }
.frame { --s: 138px; width: var(--s); height: var(--s); margin: 0 auto; position: relative; border-radius: 8px;
  background-color: var(--ground); background-repeat: no-repeat; background-size: calc(var(--s) * var(--n)) var(--s); background-position: 0 0;
  box-shadow: inset 0 -26px 0 color-mix(in srgb, var(--ground) 70%, var(--deep)); }
.pose { position: absolute; left: 6px; top: 6px; font: 500 0.7rem/1 var(--label); letter-spacing: 0.05em; background: var(--field); color: var(--ink); padding: 3px 6px; border-radius: 4px; }
.tbd { width: 138px; height: 138px; margin: 0 auto; border: 1.5px dashed var(--shade); border-radius: 8px; display: grid; place-items: center; font: 700 1.1rem var(--label); letter-spacing: 0.1em; color: var(--shade); }
.sname { font: 700 0.98rem/1.2 var(--title); color: var(--strong); margin-top: 7px; }
.sname.muted { color: var(--shade); font: 500 0.8rem var(--label); }
.lv { font: 500 0.74rem/1.3 var(--label); letter-spacing: 0.04em; color: var(--carve); }
.stats { width: 12.5rem; font-size: 0.86rem; }
.stats p { margin: 6px 0 0; color: var(--carve); }
table.mini { border-collapse: collapse; font-variant-numeric: tabular-nums; }
.mini th, .mini td { padding: 2px 8px 2px 0; text-align: right; }
.mini thead th { font: 700 0.7rem var(--label); color: var(--carve); letter-spacing: 0.05em; }
.mini tbody th { text-align: left; font: 500 0.8rem var(--label); color: var(--carve); letter-spacing: 0.03em; }
.mini td { color: var(--strong); font-weight: 500; }
.trade, .temper { font-size: 0.88rem; min-width: 15rem; }
.trade { max-width: 30rem; }
ul { margin: 0; padding-left: 1.05em; }
li { margin: 0 0 4px; }
li::marker { color: var(--shade); }
.tpill { display: inline-block; font: 700 0.74rem/1 var(--label); letter-spacing: 0.05em; padding: 4px 8px; border-radius: 4px; margin-bottom: 7px; }
.tpill.hunter { background: var(--ember-soft); color: var(--ember); }
.tpill.back { background: var(--rune-soft); color: var(--rune); }
.tpill.unruly { background: var(--rose-soft); color: var(--rose); }
.tpill.skittish { background: var(--teal-soft); color: var(--teal); }
.tpill.docile { background: var(--moss-soft); color: var(--moss); }
.empty { padding: 26px; text-align: center; color: var(--carve); }
table.traits { border-collapse: collapse; width: 100%; min-width: 720px; font-size: 0.88rem; }
.traits th, .traits td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.traits thead th { background: var(--stone-2); font: 700 0.78rem/1.2 var(--label); letter-spacing: 0.06em; color: var(--carve); position: sticky; top: 0; }
.traits thead th.common { color: var(--common); } .traits thead th.rare { color: var(--rare); } .traits thead th.supreme { color: var(--supreme); } .traits thead th.fantastic { color: var(--fantastic); }
.traits tbody th { font: 700 0.95rem var(--title); color: var(--strong); white-space: nowrap; }
.g { font-variant-numeric: tabular-nums; white-space: nowrap; }
.g.common { color: var(--common); } .g.rare { color: var(--rare); } .g.supreme { color: var(--supreme); } .g.fantastic { color: var(--fantastic); font-weight: 500; }
.g.none { color: var(--shade); }
.note { color: var(--carve); font-style: italic; }
.aura { font: 500 0.68rem var(--label); letter-spacing: 0.05em; color: var(--moss); background: var(--moss-soft); padding: 2px 5px; border-radius: 3px; vertical-align: 2px; }
.traits .group th { background: var(--stone); font: 700 0.82rem var(--label); letter-spacing: 0.06em; color: var(--carve); }
.odds td { font-variant-numeric: tabular-nums; }
footer { margin-top: 30px; color: var(--carve); font-size: 0.82rem; max-width: 62ch; }
@media (prefers-reduced-motion: reduce) { .frame { background-position: 0 0 !important; } }
</style>
<header>
<h1>Wildermon Dex</h1>
<p class="intro">All ${dex.rows.length} wildermon you can tame, one row each. Each stage plays its own moves, drawn by the game's renderer: standing, a stride of its walk and run, then its strike, its work or graze, its ability, and evolving. Stage stats grow by ${pct(mul.hardy)} health, ${pct(mul.tough)} attack and ${pct(mul.speed)} speed per stage, at levels ${dex.evolveAt.join(' and ')}.</p>
<div class="tally"><span><b>${counts.line}</b> revamped</span><span><b>${counts.named}</b> named, art in progress</span><span><b>${counts.single}</b> not revamped</span></div>
</header>
<div class="controls" role="search">
<input id="q" type="search" placeholder="Find a wildermon or a stage" aria-label="Find a wildermon or a stage">
<button type="button" id="f-all" data-f="all" aria-pressed="true">All</button>
<button type="button" id="f-line" data-f="line" aria-pressed="false">Revamped</button>
<button type="button" id="f-named" data-f="named" aria-pressed="false">Art in progress</button>
<button type="button" id="f-single" data-f="single" aria-pressed="false">Not revamped</button>
</div>
<div class="wrap">
<table class="dex">
<thead><tr><th scope="col">Wildermon</th><th scope="col">Stage I</th><th scope="col">Stage II</th><th scope="col">Stage III</th><th scope="col">Base stats</th><th scope="col">Trade and special attack</th><th scope="col">Aggression</th></tr></thead>
<tbody id="rows">
${dex.rows.map(rowHtml).join('\n')}
</tbody>
</table>
<div class="empty" id="empty" hidden>No wildermon match that.</div>
</div>
<section>
<h2>Traits</h2>
<p class="intro">Every wildermon is born with ${dex.traitSlots} traits. A plain trait comes in one grade only. Fighting blood comes in all four grades of one name, and the grade is rolled separately. Wild odds are the chance a trait rolls at each grade on a wild-born wildermon, before animal husbandry lifts it. A herd-wide trait lifts every wildermon on the same settlement or post, the bearer included.</p>
<div class="wrap">
<table class="traits">
<thead><tr><th scope="col">Trait</th>${TIERS.map((t) => `<th scope="col" class="${t}">${TIER_NAME[t]}</th>`).join('')}</tr></thead>
<tbody>
<tr class="odds"><th scope="row">Wild odds</th>${TIERS.map((t) => `<td class="g ${t}">${(dex.wildOdds[t] * 100).toFixed(1).replace(/\.0$/, '')}%</td>`).join('')}</tr>
<tr class="group"><th colspan="5" scope="colgroup">Plain traits</th></tr>
${traitRows(dex.traits.filter((t) => !t.fighting))}
<tr class="group"><th colspan="5" scope="colgroup">Fighting blood</th></tr>
${traitRows(dex.traits.filter((t) => t.fighting))}
</tbody>
</table>
</div>
</section>
<footer>Built ${new Date().toISOString().slice(0, 10)} from the game's code at ${esc(process.env.DEX_REV ?? 'the working tree')}. Every figure is read from the rules.</footer>
<script>
(() => {
  const FPS = ${dex.fps};
  const frames = [...document.querySelectorAll('.frame')];
  const seen = new Set();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)), { rootMargin: '200px' }) : null;
  for (const f of frames) {
    f._n = +f.dataset.n; f._seg = JSON.parse(f.dataset.seg); f._pose = f.querySelector('.pose');
    if (io) io.observe(f); else seen.add(f);
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let i = 0;
  setInterval(() => {
    if (still.matches || document.hidden) return;
    i++;
    for (const f of seen) {
      const k = i % f._n;
      const s = f.clientWidth;
      f.style.backgroundPosition = (-k * s) + 'px 0';
      let at = k;
      for (const [label, n] of f._seg) { if (at < n) { if (f._pose.textContent !== label) f._pose.textContent = label; break; } at -= n; }
    }
  }, 1000 / FPS);
  const q = document.getElementById('q');
  const rows = [...document.querySelectorAll('#rows > tr')];
  const buttons = [...document.querySelectorAll('.controls button')];
  let filter = 'all';
  const apply = () => {
    const text = q.value.trim().toLowerCase();
    let shown = 0;
    for (const r of rows) {
      const ok = (filter === 'all' || r.dataset.status === filter) && (!text || r.dataset.q.includes(text));
      r.hidden = !ok; if (ok) shown++;
    }
    document.getElementById('empty').hidden = shown > 0;
  };
  q.addEventListener('input', apply);
  for (const b of buttons) b.addEventListener('click', () => {
    filter = b.dataset.f;
    for (const o of buttons) o.setAttribute('aria-pressed', String(o === b));
    apply();
  });
})();
</script>
`;
writeFileSync(join(out, 'index.html'), html);
console.log(`${dex.rows.length} kinds, ${dex.traits.length} traits, written to ${out}`);
