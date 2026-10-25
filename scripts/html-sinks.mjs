/**
 * Every place in src/ that turns a string into HTML, each one looked at.
 *
 * `innerHTML`, `outerHTML`, `insertAdjacentHTML` and their kin parse what they
 * are given, so a player's name, a line of chat, a letter, a sign or an item's
 * label that reaches one unescaped is markup the next person's browser runs.
 * The rule: such text goes in as `textContent`, or through `setMarkup` and the
 * `html` template tag (src/ui/html.ts), which escapes every `${…}` with `esc()`.
 * `setMarkup` is the only writer of `innerHTML`; `fixed()` and `fixedAll()`,
 * which take HTML written in this source as it stands, count as sinks too.
 *
 * This lists every sink by file and the text of its line and compares that
 * with `scripts/html-sinks.allow`, the sinks somebody has read and found safe.
 * A sink not on the list fails, so a new one is looked at before it ships; an
 * entry whose sink has gone fails too, so the list stays the list. Matching is
 * on the line's text, not its number, so a sink that only moves is still known.
 *
 * And whatever the allow file says, a sink or a `fixed()` whose text is a
 * template may put nothing in it but `esc(…)` or a CONSTANT: an unescaped
 * variable in HTML fails here. The whole statement is read, over as many lines
 * as it runs.
 *
 *   node scripts/html-sinks.mjs           check
 *   node scripts/html-sinks.mjs --list    print every sink, as the allow file wants it
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ALLOW = join(ROOT, 'scripts/html-sinks.allow');
const SINK = /\b(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|setHTMLUnsafe|parseHTMLUnsafe|srcdoc)\b|\bdocument\.write(ln)?\s*\(|\b(fixed|fixedAll|vouch)(<[^>()]*>)?\(/;
/** Where a sink's HTML starts: after `=` or `(` of the sink, or the call to `fixed`. */
const START = /\b(?:innerHTML|outerHTML)\s*[+]?=|\b(?:insertAdjacentHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe|fixed|fixedAll|vouch)(?:<[^>()]*>)?\s*\(|\bdocument\.write(?:ln)?\s*\(|\bsrcdoc\s*=/g;
/** What a template in HTML may put in: an escaped value, or a constant (`GLYPH`, `GLYPH[k]`, `RIMS.hud`). */
const SAFE_PART = /^(esc\([\s\S]*\)|[A-Z][A-Z0-9_]*(\.[A-Za-z0-9_]+|\[[^\]]*\])*)$/;

/**
 * The statement from `at` in `text`: up to the `;`, or the `)` closing the
 * call, at the depth it starts, skipping strings and templates. Returns each
 * `${…}` in a template inside it, as written.
 */
function partsOf(text, at) {
  const parts = [];
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '`') {
      i = template(text, i, parts);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '(' || c === '[' || c === '{') {
      depth++;
    } else if (c === ')' || c === ']' || c === '}') {
      if (--depth < 0) break;
    } else if (c === ';' && depth === 0) {
      break;
    }
  }
  return parts;
}

/** Past the template opening at `i`, gathering its `${…}`s (and those of templates within them); the index of its closing backtick. */
function template(text, i, parts) {
  for (i++; i < text.length && text[i] !== '`'; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '$' && text[i + 1] === '{') {
      const from = i + 2;
      let depth = 1;
      for (i += 2; i < text.length && depth > 0; i++) {
        const c = text[i];
        if (c === '`') i = template(text, i, parts);
        else if (c === "'" || c === '"') { for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++; }
        else if (c === '{') depth++;
        else if (c === '}') depth--;
      }
      i--;
      parts.push(text.slice(from, i).trim());
    }
  }
  return i;
}


function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx|js|mjs|html)$/.test(name)) yield path;
  }
}

/** Every sink as `file<TAB>trimmed line`, in file order; and every unescaped variable put into HTML. */
const found = [];
const unescaped = [];
for (const path of sources(join(ROOT, 'src'))) {
  const file = relative(ROOT, path).split('\\').join('/');
  const source = readFileSync(path, 'utf8');
  let offset = 0;
  source.split('\n').forEach((line, i) => {
    const lineAt = offset;
    offset += line.length + 1;
    const text = line.trim();
    if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*')) return;
    if (!SINK.test(text)) return;
    found.push({ key: `${file}\t${text}`, at: `${file}:${i + 1}` });
    for (const m of line.matchAll(START)) {
      for (const part of partsOf(source, lineAt + m.index + m[0].length)) {
        if (!SAFE_PART.test(part)) unescaped.push({ at: `${file}:${i + 1}`, part });
      }
    }
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
  console.error('Put text in as textContent, or HTML through setMarkup() and the html`` tag (src/ui/html.ts);');
  console.error('a fixed() of HTML written here goes on the allow file, with a comment saying why it is safe:');
  for (const f of unreviewed) console.error(`  ${f.at}\n    ${f.key.split('\t')[1]}`);
}
if (gone.length) {
  console.error(`html-sinks: ${gone.length} line(s) in ${relative(ROOT, ALLOW)} match no sink any more; take them out:`);
  for (const key of gone) console.error(`  ${key.replace('\t', '  ')}`);
}
if (unescaped.length) {
  console.error(`html-sinks: ${unescaped.length} value(s) put into HTML neither escaped nor constant.`);
  console.error('Wrap each in esc(), or build the HTML with the html`` tag (src/ui/html.ts), which escapes for you:');
  for (const u of unescaped) console.error(`  ${u.at}\n    \${${u.part}}`);
}
if (unreviewed.length || gone.length || unescaped.length) process.exit(1);
console.log(`html-sinks: ${found.length} HTML sinks in src/, every one reviewed, nothing unescaped put into one.`);
