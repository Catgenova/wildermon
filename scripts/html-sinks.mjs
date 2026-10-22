/**
 * Every place in src/ that turns a string into HTML, each one looked at.
 *
 * `innerHTML`, `outerHTML`, `insertAdjacentHTML` and their kin parse what they
 * are given, so a player's name, a line of chat, a letter, a sign or an item's
 * label that reaches one unescaped is markup the next person's browser runs.
 * The rule: such text goes through `esc()` (src/ui/esc.ts) or in as
 * `textContent`.
 *
 * This lists every sink by file and the text of its line and compares that
 * with `scripts/html-sinks.allow`, the sinks somebody has read and found safe.
 * A sink not on the list fails, so a new one is looked at before it ships; an
 * entry whose sink has gone fails too, so the list stays the list. Matching is
 * on the line's text, not its number, so a sink that only moves is still known.
 *
 *   node scripts/html-sinks.mjs           check
 *   node scripts/html-sinks.mjs --list    print every sink, as the allow file wants it
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ALLOW = join(ROOT, 'scripts/html-sinks.allow');
const SINK = /\b(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|setHTMLUnsafe|parseHTMLUnsafe|srcdoc)\b|\bdocument\.write(ln)?\s*\(/;

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx|js|mjs|html)$/.test(name)) yield path;
  }
}

/** Every sink as `file<TAB>trimmed line`, in file order. */
const found = [];
for (const path of sources(join(ROOT, 'src'))) {
  const file = relative(ROOT, path).split('\\').join('/');
  readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
    const text = line.trim();
    if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*')) return;
    if (SINK.test(text)) found.push({ key: `${file}\t${text}`, at: `${file}:${i + 1}` });
  });
}

if (process.argv.includes('--list')) {
  for (const f of found) console.log(f.key);
  process.exit(0);
}

/** Each allowed line allows one sink with that text, so two alike in a file are listed twice. */
const allowed = new Map();
for (const raw of readFileSync(ALLOW, 'utf8').split('\n')) {
  if (!raw.trim() || raw.startsWith('#')) continue;
  const tab = raw.indexOf('\t');
  if (tab < 0) {
    console.error(`html-sinks: ${relative(ROOT, ALLOW)}: no tab between file and line in "${raw}".`);
    process.exit(1);
  }
  const key = `${raw.slice(0, tab).trim()}\t${raw.slice(tab + 1).trim()}`;
  allowed.set(key, (allowed.get(key) ?? 0) + 1);
}

const unreviewed = [];
for (const f of found) {
  const left = allowed.get(f.key) ?? 0;
  if (left > 0) allowed.set(f.key, left - 1);
  else unreviewed.push(f);
}
const gone = [...allowed].filter(([, n]) => n > 0).map(([key]) => key);

if (unreviewed.length) {
  console.error(`html-sinks: ${unreviewed.length} HTML sink(s) not in ${relative(ROOT, ALLOW)}.`);
  console.error('Escape any text that did not come from this source with esc() (src/ui/esc.ts), or use textContent;');
  console.error('then add the line to the allow file, with a comment saying why it is safe:');
  for (const f of unreviewed) console.error(`  ${f.at}\n    ${f.key.split('\t')[1]}`);
}
if (gone.length) {
  console.error(`html-sinks: ${gone.length} line(s) in ${relative(ROOT, ALLOW)} match no sink any more; take them out:`);
  for (const key of gone) console.error(`  ${key.replace('\t', '  ')}`);
}
if (unreviewed.length || gone.length) process.exit(1);
console.log(`html-sinks: ${found.length} HTML sinks in src/, every one reviewed.`);
