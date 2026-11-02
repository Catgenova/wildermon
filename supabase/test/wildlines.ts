/**
 * Each wildermon line's models and voice fetched when they are wanted, not with the page.
 *
 * The models were a quarter of the game's code, all of it loaded before the
 * island was asked for anything, though an island shows a handful of lines at
 * a time. Each line is a module the page fetches the first time a body of it
 * is drawn (`src/render/wildermon.ts`), and its voice the first time one is in
 * earshot (`src/audio/voices.ts`). What is checked:
 *
 *   * every line comes, with a model for each stage it is drawn at, and every
 *     voice comes;
 *   * nothing in the page imports a line's module or a voice by name -- only
 *     the registry's `import()` does -- since one plain import puts it back in
 *     what every player loads at the start, and nothing would say so;
 *   * a line not drawn for `FORGET_AFTER` lets go of its pieces, and drawn
 *     again it is made afresh, the same as it was.
 *
 * Node only: no browser, no island.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORGET_AFTER, loadAllWildermon, loadWildermon, onWildermonForgotten, sweepWildermon, WILDERMON_SPECIES, wildermonKind, wildermonTop } from '../../src/render/wildermon';
import { loadAllVoices } from '../../src/audio/voices';
import { beastsKept, kitOf } from '../../src/render/beasts';
import { SPECIES } from '../../src/game/creatures';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

// Before anything is fetched: nothing.
check('a line not yet fetched has no model', wildermonKind('rabba') === null && wildermonTop('rabba') === undefined);
const rabba = await loadWildermon('rabba');
check('and fetched, it has', !!rabba && wildermonKind('rabba')?.kind === rabba.kind);
check('a kind that is not a line fetches nothing', (await loadWildermon('no-such-kind')) === undefined);

await loadAllWildermon();
const missing = WILDERMON_SPECIES.filter((s) => !wildermonKind(s));
check(`every line comes (${WILDERMON_SPECIES.length})`, missing.length === 0, missing.join(', '));
// A kind the island evolves is drawn as a model of its own at each stage it has one for.
const flat = WILDERMON_SPECIES.filter((s) => SPECIES[s]?.stages && wildermonKind(s, 1)?.key !== `${s}@1` && wildermonKind(s, 2)?.key !== `${s}@2`);
const drawnAt = WILDERMON_SPECIES.filter((s) => wildermonKind(s, 1)?.key === `${s}@1`).length;
check(`and ${drawnAt} of them are drawn as a body of their own at their second stage and third`,
  drawnAt > 0 && WILDERMON_SPECIES.every((s) => (wildermonKind(s, 1)?.key === `${s}@1`) === (wildermonKind(s, 2)?.key === `${s}@2`)), flat.slice(0, 5).join(', '));
check('a ridden kind has its saddled bodies', wildermonKind('orse', 1, true)?.key === 'orse@1+tack' && wildermonKind('springlet', 2, true)?.key === 'springlet@2+tack');

const voices = await loadAllVoices();
const voiced = Object.keys(voices);
check(`every voice comes (${voiced.length})`, voiced.length > 0 && voiced.every((s) => Object.keys(voices[s] ?? {}).length > 0 && WILDERMON_SPECIES.includes(s)));

// Nothing imports a line or a voice by name but the lines and voices themselves.
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []));
const named: string[] = [];
for (const file of files('src')) {
  if (/[\\/](wild-[a-z0-9]+|voice-[a-z0-9]+)\.ts$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']*\/(?:wild|voice)-[a-z0-9]+)'/gm)) named.push(`${file}: ${m[1]}`);
}
check('nothing in the page imports a line\'s models or a voice by name, only fetches them', named.length === 0, named.slice(0, 5).join('; '));

// Let go of after a while undrawn, and made afresh, the same, when drawn again.
const m = wildermonKind('woola') as NonNullable<ReturnType<typeof wildermonKind>>;
const before = kitOf(m.key, m.kind, 0).length;
const top = wildermonTop('woola');
const keptBefore = beastsKept().kits;
const told: string[] = [];
onWildermonForgotten((key) => told.push(key));
const now = performance.now();
const early = sweepWildermon(now + FORGET_AFTER / 2);
check('a line drawn a moment ago is kept', !early.includes('woola'));
const gone = sweepWildermon(now + FORGET_AFTER + 1);
check(`a line not drawn for ${FORGET_AFTER / 60_000} minutes lets go of what is kept for it`, gone.includes('woola') && told.includes('woola') && beastsKept().kits < keptBefore,
  `kits kept ${keptBefore} → ${beastsKept().kits}`);
check('and drawn again it is made afresh, the same', kitOf(m.key, m.kind, 0).length === before && wildermonTop('woola') === top);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`each line's models and voice fetched when wanted, and let go of when not — ${ok.length} of ${ok.length}`);
