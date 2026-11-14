/**
 * The interior kit's guard (src/ui/interior.css), in warn mode: it prints what
 * is still hand-rolled inside a window's rim, window by window, and exits 0.
 *
 *   * a font size written as a number that is not on the scale (`--rc-fs-1`
 *     to `--rc-fs-5`: 10, 11, 12, 13 and 15 px);
 *   * a colour written as a hex in a window's rule (not a Classic fallback,
 *     `var(--t-x, #hex)`, which is how Classic keeps its look);
 *   * `overflow: auto` or `scroll` anywhere but the kit's one scroll area
 *     (`.rc-scroll`);
 *   * a `[data-frame]` rule that reaches inside the rim: a frame may dress its
 *     window's band, title, title buttons and niche, and nothing else.
 *
 * A rule is a window's when a class in its selector is written in that
 * window's code (`WINDOWS` below): the class with the fewest windows decides,
 * and one in more than three is the kit's or the interface's own ("shared").
 * A `[data-frame]` rule is the windows its frame goes round (`FRAMES`).
 *
 *   node scripts/ui-lint.mjs            the counts
 *   node scripts/ui-lint.mjs --list     and every finding
 *   node scripts/ui-lint.mjs --strict   exit 1 on any finding
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STYLES = ['src/style.css', 'src/phone.css', 'src/ui/creator.css', 'src/ui/interior.css'];
const SCALE = new Set([10, 11, 12, 13, 15]);

/** Each window's code: what it is made in, so its classes can be found. */
const WINDOWS = {
  events: ['ui/panels/eventlog.ts'],
  inventory: ['ui/panels/inventory.ts', 'ui/itemcells.ts'],
  skills: ['ui/panels/skills.ts'],
  health: ['ui/panels/health.ts', 'ui/health.ts'],
  equipment: ['ui/panels/equipment.ts', 'ui/equipment.ts'],
  craft: ['ui/panels/craft.ts', 'ui/panels/craftqueue.ts', 'ui/recipetree.ts'],
  shopping: ['ui/panels/shopping.ts'],
  mend: ['ui/panels/mend.ts'],
  tile: ['ui/panels/tile.ts'],
  map: ['ui/panels/minimap.ts'],
  settings: ['ui/panels/settings.ts'],
  crate: ['ui/panels/crate.ts', 'ui/itemcells.ts'],
  stores: ['ui/panels/stores.ts'],
  journal: ['ui/panels/journal.ts', 'ui/panels/journaltabs.ts', 'ui/panels/news.ts', 'ui/panels/boards.ts', 'ui/panels/guide.ts', 'ui/panels/tracker.ts', 'ui/panels/help.ts'],
  ledger: ['ui/panels/ledger.ts'],
  wildermon: ['ui/panels/wildermon.ts', 'ui/panels/care.ts', 'ui/panels/attention.ts'],
  deed: ['ui/panels/deed.ts'],
  social: ['ui/panels/social.ts'],
  market: ['ui/panels/market.ts'],
  hoard: ['ui/panels/hoard.ts'],
  barter: ['ui/panels/barter.ts'],
  trades: ['ui/panels/trades.ts'],
  faith: ['ui/panels/faith.ts'],
  keeper: ['ui/panels/keeper.ts', 'ui/panels/keeperflags.ts'],
};

/** What a frame may dress: the band (the window itself), its title, title buttons and niche. */
const RIM = /^(?:\s*(?:>\s*)?(?:\.win-title(?:-text)?|\.win-head|\.win-buttons|\.win-btn|\.rc-niche|\.rc-plate|\.win-rune)\b[^\s]*)?\s*$/;

const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/** Window ids by frame kind, from `FRAMES` in src/ui/runecut-frames.ts. */
const frameWindows = new Map();
for (const m of read('src/ui/runecut-frames.ts').matchAll(/\{ kind: '(\w+)', label: [^}]*?for: \[([^\]]*)\] \}/g)) {
  frameWindows.set(m[1], [...m[2].matchAll(/'([\w-]+)'/g)].map((x) => (x[1] === 'ledger' ? 'journal' : x[1])));
}

/** Which windows write each class, from the strings in their code. */
const owners = new Map();
for (const [win, files] of Object.entries(WINDOWS)) {
  for (const f of files) {
    const text = read(join('src', f));
    for (const m of text.matchAll(/['"`]([^'"`\n]*)['"`]/g)) {
      for (const word of m[1].split(/[\s.]+/)) {
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(word)) continue;
        if (!owners.has(word)) owners.set(word, new Set());
        owners.get(word).add(win);
      }
    }
  }
}

/** The rules of a stylesheet, flattened out of @media and @container: selector, declarations, line. */
function rules(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      stack.push({ head: text.slice(start, i).trim(), at: i });
      start = i + 1;
    } else if (ch === '}') {
      const open = stack.pop();
      if (open && !open.head.startsWith('@')) {
        const line = text.slice(0, open.at).split('\n').length;
        out.push({ selector: open.head, body: text.slice(open.at + 1, i), line });
      }
      start = i + 1;
    }
  }
  return out;
}

/**
 * Classes the kit already stands over: written beside a kit class (`inv-row
 * rc-row`, `made('div', 'scroll', 'inv-list')`, a kit builder's own). In
 * Runecut the kit's rule draws them, so their own sizes and scrolling are
 * Classic's alone, and not counted.
 */
const kitted = new Set(['tb-btn', 'tb-small', 'inv-group', 'inv-empty', 'panel-search']);
for (const files of Object.values(WINDOWS)) {
  for (const f of files) {
    const text = read(join('src', f));
    for (const m of text.matchAll(/made\('\w+', '\w+', '([^']*)'\)|['"`]([^'"`\n]*\brc-[a-z-]+[^'"`\n]*)['"`]/g)) {
      for (const word of (m[1] ?? m[2]).split(/\s+/)) if (/^[a-z][\w-]*$/.test(word) && !word.startsWith('rc-')) kitted.add(word);
    }
    // And a made element given its kit part after (`kit(el('span', 'hp-chip ...'), 'tag')`): its classes, up to any `${`.
    for (const m of text.matchAll(/kit\(el\('\w+', ['`]([^'`$]*)/g)) {
      for (const word of m[1].split(/\s+/)) if (/^[a-z][\w-]*$/.test(word)) kitted.add(word);
    }
  }
}

/** The class a rule's windows are decided by, and those windows: 'shared', or none (the HUD, the toolbar, menus, the page). */
function windowsOf(selector) {
  const frame = selector.match(/\[data-frame='(\w+)'\]/);
  if (frame) return { cls: null, wins: frameWindows.get(frame[1]) ?? ['stone'] };
  let best = null;
  let cls = null;
  for (const m of selector.matchAll(/\.([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/g)) {
    const o = owners.get(m[1]);
    if (o && (!best || o.size < best.size)) {
      best = o;
      cls = m[1];
    }
  }
  if (!best) return { cls: null, wins: [] };
  return { cls, wins: best.size > 3 ? ['shared'] : [...best] };
}

/** A value with every `var(--x, fallback)` cut to `var(--x)`: a fallback is Classic's, and Classic keeps its literals. */
function noFallbacks(value) {
  let v = value;
  for (let i = 0; i < 8 && /var\(--[\w-]+\s*,/.test(v); i++) v = v.replace(/var\((--[\w-]+)\s*,(?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, 'var($1)');
  return v;
}

/** Split a selector list at its own commas, not those inside `:is()` and the like. */
function parts(selector) {
  const out = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')') depth--;
    else if (selector[i] === ',' && !depth) {
      out.push(selector.slice(from, i));
      from = i + 1;
    }
  }
  out.push(selector.slice(from));
  return out.map((s) => s.trim());
}

/** Whether a selector is a frame's own: its band, title, title buttons or niche. */
const onRim = (sel) => {
  const m = sel.match(/\[data-frame(?:='\w+')?\]([^]*)$/);
  return !!m && RIM.test(m[1].replace(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, ''));
};

const findings = [];
const add = (kind, file, r, what) => {
  for (const w of windowsOf(r.selector).wins) findings.push({ kind, win: w, where: `${file}:${r.line}`, selector: r.selector.replace(/\s+/g, ' ').slice(0, 110), what });
};

for (const file of STYLES) {
  for (const r of rules(read(file))) {
    const sels = parts(r.selector);
    // A frame's rule that reaches past the rim.
    for (const sel of sels) if (/\[data-frame/.test(sel) && !onRim(sel)) add('frame', file, { ...r, selector: sel }, sel);
    // The frame's own band, title and buttons are the frame's to dress, in its own materials; Classic's rules are Classic's.
    if (sels.every(onRim) || /\[data-ui='classic'\]/.test(r.selector)) continue;
    const { cls } = windowsOf(r.selector);
    const kit = r.selector.includes('.rc-') || (cls !== null && kitted.has(cls));
    for (const d of r.body.split(';').map((x) => x.trim()).filter(Boolean)) {
      const [prop, ...rest] = d.split(':');
      const value = rest.join(':').trim();
      const p = prop.trim();
      // Font sizes off the scale, where the kit does not already set the size.
      if ((p === 'font-size' || p === 'font') && !kit) {
        for (const m of value.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)) {
          if (p === 'font' && !/px\s*(?:\/|\s+['"a-zA-Z])/.test(value.slice(m.index))) continue;
          if (!SCALE.has(Number(m[1]))) add('font', file, r, `${p}: ${value}`);
        }
      }
      // Hex colours, not counting Classic's fallbacks inside a var().
      const bare = noFallbacks(value).replace(/url\([^)]*\)/g, '');
      if (/#[0-9a-fA-F]{3,8}\b/.test(bare)) add('hex', file, r, `${p}: ${value.slice(0, 60)}`);
      // Scrolling outside the kit's one scroll area.
      if (/^overflow(-x|-y)?$/.test(p) && /\b(auto|scroll)\b/.test(value) && !kit) add('overflow', file, r, `${p}: ${value}`);
    }
  }
}

const KINDS = ['font', 'hex', 'overflow', 'frame'];
const per = new Map();
for (const f of findings) {
  if (!per.has(f.win)) per.set(f.win, Object.fromEntries(KINDS.map((k) => [k, 0])));
  per.get(f.win)[f.kind]++;
}
const order = [...Object.keys(WINDOWS), 'shared', 'stone'].filter((w) => per.has(w));
const total = Object.fromEntries(KINDS.map((k) => [k, findings.filter((f) => f.kind === k).length]));
const pad = (s, n) => String(s).padEnd(n);
console.log(`ui lint (warn): ${findings.length} findings: font sizes off the scale ${total.font}, hex colours ${total.hex}, overflow outside .rc-scroll ${total.overflow}, frame rules inside the rim ${total.frame}`);
console.log(`  ${pad('window', 11)}${KINDS.map((k) => pad(k, 9)).join('')}`);
for (const w of order) console.log(`  ${pad(w, 11)}${KINDS.map((k) => pad(per.get(w)[k], 9)).join('')}`);
if (process.argv.includes('--list')) for (const f of findings) console.log(`  ${f.kind} ${f.win} ${f.where} ${f.selector} { ${f.what} }`);
if (process.argv.includes('--strict') && findings.length) process.exit(1);
