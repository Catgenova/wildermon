/**
 * What a pairing would throw, said before it is made.
 *
 * Asked for: "Before a pairing is confirmed, show for that pair: each trait
 * either parent carries, with the chance the foal inherits it (from the same
 * functions the birth uses, so it cannot drift); the chance the foal comes out
 * at each tier better than common, given the pair's care and the breeder's
 * skill; the chance of a mutation and what tier it would be; the pedigree bonus
 * the foal would start with. If the island's formulas differ in any way, fix
 * the difference (one rule) and add an agreement check."
 *
 * Asked, of a constructed pair (one trait shared, fanged in two grades, a line
 * four deep on work behind the dam):
 *
 *   * that the preview is the covering's own draw: its shares are what
 *     `breedTraits` throws, counted off the same rolls, and land where forty
 *     thousand fresh draws do;
 *   * that it lands where the birth does, through `pair` and `giveBirth` with
 *     the breeder's perks, and where the island's `breed_traits` does;
 *   * that the island's numbers under the draw are the browser's: the odds a
 *     pairing takes, a trait is drawn from the pair and comes out a tier better
 *     at every husbandry and care tried, the odds of a mutation and its tier;
 *   * that a wild roll is one rule on both sides: the tiers it comes out at, the
 *     share that is fighting blood, and never a name already carried, from an
 *     empty set and from one that already holds two of the top tier's plain
 *     traits (where the two rules had differed);
 *   * that the words on the screen are those numbers: how often it takes, each
 *     trait it may carry, its best tier, the mutation's odds and tier, the line
 *     it would start with and what it is worth, its own rarity; that a trait
 *     your husbandry cannot read is counted and not named; and that it is asked
 *     before a pairing through the door and not where the pairing is refused.
 *
 * Runs against the database the suite leaves behind, inside a transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { breedPlus, type Creature } from '../../src/game/creatures';
import { breedChance, breedPreview, rarityShares, TIER_LEVEL } from '../../src/game/husbandry';
import { RARITIES } from '../../src/game/items';
import {
  bestTier, BY_TIER, breedOdds, breedTraits, carriesOn, CHANNELS, depthMul, FIGHT_SHARE, familyOf, inheritChance, lineIfCarried, MUTATION_ODDS, mutationOf,
  mutationTier, pct, PREVIEW_GOES, rollTrait, seededRand, TIERS, traitName, traitOf, traitTier, upgradeChance, type BreedOdds, type Line, type TraitChannel,
  type TraitTier,
} from '../../src/game/traits';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the pair ---------------------------------------------------------------- */

const SIRE = ['willing', 'thrifty', 'fanged'];
const DAM = ['willing', 'fleet', 'fanged_rare'];
const DAM_LINE: Line = { work: 4 };
const HUSBANDRY = 50;
const CARE = 0.5;
/** How many fresh draws the preview is held against in the browser, and how many the island makes. */
const MANY = 40000;
const ISLE = 3000;
/** How far apart two shares counted off `a` and `b` draws may land: four and a half deviations, and a hair for rounding. */
const near = (x: number, y: number, a: number, b: number): boolean => {
  const p = Math.min(0.5, Math.max(0.005, (x + y) / 2));
  return Math.abs(x - y) <= 4.5 * Math.sqrt(p * (1 - p) * (1 / a + 1 / b)) + 0.002;
};
/** Every share two counts give, side by side, and the ones that do not agree. */
function agree(a: BreedOdds, an: number, b: BreedOdds, bn: number): string[] {
  const off: string[] = [];
  for (const id of Object.keys(a.carry)) if (!near(a.carry[id], b.carry[id] ?? 0, an, bn)) off.push(`carry ${id} ${a.carry[id]} / ${b.carry[id]}`);
  for (const t of TIERS) if (!near(a.best[t], b.best[t], an, bn)) off.push(`best ${t} ${a.best[t]} / ${b.best[t]}`);
  for (const ch of CHANNELS) if (!near(a.on[ch.id], b.on[ch.id], an, bn)) off.push(`on ${ch.id} ${a.on[ch.id]} / ${b.on[ch.id]}`);
  if (!near(a.mutated, b.mutated, an, bn)) off.push(`mutated ${a.mutated} / ${b.mutated}`);
  return off;
}
/** The same shares, counted off a list of young ones. */
function tally(young: Array<{ traits: string[]; from?: Record<string, string> }>): BreedOdds {
  const n = young.length;
  const carry = Object.fromEntries([...new Set([...SIRE, ...DAM])].map((id) => [id, young.filter((y) => y.traits.includes(id)).length / n]));
  const best = Object.fromEntries(TIERS.map((t) => [t, young.filter((y) => bestTier(y.traits) === t).length / n])) as Record<TraitTier, number>;
  const on = Object.fromEntries(CHANNELS.map((ch) => [ch.id, young.filter((y) => carriesOn(y.traits, ch.id)).length / n])) as Record<TraitChannel, number>;
  const mutated = young.filter((y) => Object.values(y.from ?? {}).includes('mutation')).length / n;
  return { carry, best, on, mutated };
}

/* ---- the browser ------------------------------------------------------------- */

console.log('--- the browser');
const preview = breedOdds(SIRE, DAM, HUSBANDRY, CARE);
{
  // The preview is the draw: the same rolls, counted by hand, give the same shares to the last digit.
  const rand = seededRand(7);
  const mine = breedOdds(SIRE, DAM, HUSBANDRY, CARE, 0, 0, 500, seededRand(7));
  const drawn = Array.from({ length: 500 }, () => breedTraits(SIRE, DAM, HUSBANDRY, CARE, rand));
  const byHand = tally(drawn);
  check('the preview is the covering\'s own draw: the same rolls through breedTraits give the very same shares',
    JSON.stringify(mine) === JSON.stringify(byHand), `${JSON.stringify(mine.best)} / ${JSON.stringify(byHand.best)}`);
  // And lands where forty thousand fresh draws do.
  const fresh = tally(Array.from({ length: MANY }, () => breedTraits(SIRE, DAM, HUSBANDRY, CARE, Math.random)));
  const off = agree(preview, PREVIEW_GOES, fresh, MANY);
  check(`the preview, ${PREVIEW_GOES} draws from one seed, lands where ${MANY} fresh draws do`, off.length === 0, off.slice(0, 4).join('; '));
  check('and it names every trait either parent carries, once', JSON.stringify(Object.keys(preview.carry).sort()) === JSON.stringify([...new Set([...SIRE, ...DAM])].sort()));
}

// A keeper and the pair, to put through the door and through the birth.
const game = Game.create(5151);
game.skills.values.set('animal_husbandry', HUSBANDRY);
game.deed = { name: 'Hearth', x: game.player.tileX + 4, y: game.player.tileY + 4, radius: 5, level: 3 };
for (const c of [...game.creatures.list.values()]) if (c.mode !== 'wild') c.mode = 'wild';
const raise = (name: string, traits: string[], sex: 'male' | 'female', dx: number): Creature => {
  const c = game.creatures.spawn('rabba', game.player.x + dx, game.player.y, 'deed', game.rand, 0);
  Object.assign(c, { name, sex, traits: [...traits], hunger: 1, care: CARE, bredAt: -1e9, due: 0 });
  return c;
};
const dam = raise('Snow', DAM, 'female', 0.3);
const sire = raise('Horn', SIRE, 'male', -0.3);
dam.pedigree = { dam: { id: 900, name: 'Old Snow' }, sire: { id: 901, name: 'Old Horn' }, from: {}, line: DAM_LINE };
{
  // Through the birth itself, with the breeder's perks as `pair` reads them.
  const born: Array<{ traits: string[]; from?: Record<string, string> }> = [];
  for (let i = 0; i < 4000; i++) {
    game.creatures.pair(game, dam, sire, HUSBANDRY);
    dam.due = game.time;
    const c = game.creatures.giveBirth(game, dam);
    if (!c) continue;
    born.push({ traits: c.traits, from: c.pedigree?.from });
    game.creatures.remove(c.id);
  }
  dam.bredAt = -1e9;
  sire.bredAt = -1e9;
  const { keepPlus, upPlus } = breedPlus(game);
  const off = agree(breedOdds(SIRE, DAM, HUSBANDRY, CARE, keepPlus, upPlus), PREVIEW_GOES, tally(born), born.length);
  check(`${born.length} births through the covering and the hour land where the preview says`, off.length === 0 && born.length === 4000, off.slice(0, 4).join('; '));
}

/* ---- the words on the screen ------------------------------------------------- */

const pairIt = ACTION_BY_ID.get('pair_creature')!;
const asked = pairIt.confirms?.({ kind: 'creature', id: dam.id }, game) ?? '';
const lines = asked.split('\n');
const line = (start: string): string => lines.find((l) => l.startsWith(start)) ?? '(no such line)';
/** A share as the preview writes it. */
const said = (x: number): string => {
  const n = x * 100;
  return `${n >= 1 || n === 0 ? Math.round(n) : n >= 0.1 ? n.toFixed(1) : n.toFixed(2)}%`;
};
check('pairing through the door asks first, with the preview and a question', lines.length > 6 && lines[lines.length - 1] === 'Pair them?', lines[lines.length - 1]);
check('it is the preview of this pair, the sire put to the dam', asked.startsWith(breedPreview(game, dam, sire)) && lines[0].startsWith('Pair Horn with Snow'), lines[0]);
check('it says how often it takes, off the rule', line('Success: ') === `Success: ${Math.round(breedChance(HUSBANDRY, CARE) * 100)}%.`, line('Success: '));
check('and how often each trait is drawn from their blood and comes out a tier better',
  line('Each of ').includes(`inherited ${Math.round(inheritChance(HUSBANDRY, CARE) * 100)}%`)
    && line('Each of ').includes(`rarity-up ${Math.round(upgradeChance(HUSBANDRY, CARE) * 100)}%`), line('Each of '));
{
  const want = Object.keys(preview.carry).sort((a, b) => preview.carry[b] - preview.carry[a]).map((id) => `${traitName(id)} ${said(preview.carry[id])}`).join(', ');
  check('each trait either parent carries, with the share of young born carrying it', line('Born carrying: ') === `Born carrying: ${want}.`, line('Born carrying: '));
  check('the share whose best trait comes out at each tier', line('Best trait rarity: ') === `Best trait rarity: ${TIERS.map((t) => `${t} ${said(preview.best[t])}`).join(', ')}.`,
    line('Best trait rarity: '));
  const tier = mutationTier(SIRE, DAM);
  check(`one in ${MUTATION_ODDS} a mutation, at the tier above the best of theirs (${tier})`,
    line('Mutation: ') === `Mutation: 1 in ${MUTATION_ODDS} (${said(1 / MUTATION_ODDS)}): a ${tier} trait in neither parent, in its lowest slot.`
      && TIERS.indexOf(tier) === TIERS.indexOf(bestTier([...SIRE, ...DAM])) + 1, line('Mutation: '));
  const parents = [{ traits: DAM, line: DAM_LINE }, { traits: SIRE }] as const;
  const wantLines = CHANNELS.filter((ch) => lineIfCarried(parents[0], parents[1], ch.id) > 1 && preview.on[ch.id] > 0).map((ch) => {
    const d = lineIfCarried(parents[0], parents[1], ch.id);
    return `Line (${ch.label}): ${d} generations, ${pct(depthMul(d, ch.id))} ${ch.label}, if it carries a ${ch.label} trait (${said(preview.on[ch.id])}).`;
  });
  check('the line it would start with on each channel either of them carries, what it is worth, and how often it carries a trait there',
    JSON.stringify(lines.filter((l) => l.startsWith('Line ('))) === JSON.stringify(wantLines) && wantLines.some((l) => l.startsWith('Line (work): 5 generations, +8% work')),
    lines.filter((l) => l.startsWith('Line (')).join(' | '));
  const rare = rarityShares();
  check('its own rarity, at the odds anything is born at', line('Rarity, as any wildermon') === `Rarity, as any wildermon: ${rare.map((p, i) => `${RARITIES[i + 1].name} ${said(p)}`).join(', ')}.`
    && Math.abs(rare.reduce((a, b) => a + b, 0) - 0.01) < 1e-9, line('Rarity, as any wildermon'));
}
{
  // A trait too good to read is counted and not named.
  game.skills.values.set('animal_husbandry', TIER_LEVEL.rare);
  const blind = pairIt.confirms?.({ kind: 'creature', id: dam.id }, game) ?? '';
  const carrying = blind.split('\n').find((l) => l.startsWith('Born carrying: ')) ?? '';
  const unread = [...new Set([...SIRE, ...DAM])].filter((id) => TIER_LEVEL.rare < 1 + TIER_LEVEL[traitTier(id)]).length;
  check(`at ${TIER_LEVEL.rare} husbandry the rare ones are counted and not named`, !carrying.includes('fanged (rare)') && !carrying.includes('fleet')
    && carrying.includes(`; ${unread} more unreadable`) && unread === 2 && carrying.includes('willing'), carrying);
  game.skills.values.set('animal_husbandry', HUSBANDRY);
}
{
  // Where the pairing is refused, nothing is asked: the refusal says why.
  dam.hunger = 0.1;
  check('nothing is asked where the pairing would be refused', pairIt.confirms?.({ kind: 'creature', id: dam.id }, game) === null && !!pairIt.check?.({ kind: 'creature', id: dam.id }, game));
  dam.hunger = 1;
}

/* ---- the island -------------------------------------------------------------- */

const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(',')}]::text[]`;
/** The odds the island is asked for, at each husbandry and care. */
const POINTS: Array<[number, number]> = [[0, 0], [25, 0.3], [HUSBANDRY, CARE], [100, 1], [140, 2]];
/** Parent sets for a mutation's tier: each tier best, and none at all. */
const TIER_SETS: Array<[string[], string[]]> = [[[], []], [['willing'], []], [['fleet'], ['willing']], [['swift'], []], [['windborn'], ['fleet']], [['fanged_supreme'], []]];
/**
 * Sets a wild roll is made against: nothing; two of the top tier's plain traits; and every plain trait of the two top
 * tiers, where the island's old rule (keep the tier and the kind, and take anything at all where none of them is left)
 * came out at other odds by far.
 */
const TAKEN: string[][] = [[], BY_TIER.fantastic.slice(0, 2).map((t) => t.id), [...BY_TIER.supreme, ...BY_TIER.fantastic].map((t) => t.id)];
/** The husbandry a wild roll is made at: the top, where the better tiers come up most. */
const ROLL_SKILL = 100;
const ROLLS = 5000;
const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare v_b jsonb; v_i int;
begin
  insert into said values ('ODDS', mutation_odds()::text);
  insert into said select 'POINT', string_agg(round(breed_chance(h, c)::numeric, 9) || ':' || round(inherit_chance(h, c)::numeric, 9) || ':' || round(upgrade_chance(h, c)::numeric, 9), ',' order by n)
    from (values ${POINTS.map(([h, c], n) => `(${n}, ${h}::double precision, ${c}::double precision)`).join(', ')}) p(n, h, c);
  insert into said select 'TIER', string_agg(mutation_tier(s, d), ',' order by n)
    from (values ${TIER_SETS.map(([s, d], n) => `(${n}, ${arr(s)}, ${arr(d)})`).join(', ')}) p(n, s, d);
  for v_i in 1..${ISLE} loop
    v_b := breed_traits(${arr(SIRE)}, ${arr(DAM)}, ${HUSBANDRY}, ${CARE});
    insert into said values ('BRED', v_b::text);
  end loop;
${TAKEN.map((taken, k) => `  insert into said select 'ROLL${k}', roll_trait(${arr(taken)}, ${ROLL_SKILL}) from generate_series(1, ${ROLLS});`).join('\n')}
end $t$;
select k || '=' || v from said;
rollback;`);
const rows = out.split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]);
const at = (k: string): string => rows.find(([key]) => key === k)?.[1] ?? '(not said)';
const all = (k: string): string[] => rows.filter(([key]) => key === k).map(([, v]) => v);

console.log('--- the island');
{
  const bred = all('BRED').map((v) => JSON.parse(v) as { traits: string[]; from: Record<string, string> });
  const isle = tally(bred);
  const off = agree(preview, PREVIEW_GOES, isle, bred.length);
  check(`the island's breed_traits, ${bred.length} times over the same pair, lands where the browser's preview says`, bred.length === ISLE && off.length === 0,
    off.slice(0, 4).join('; '));
  console.log(`   carry: ${Object.keys(preview.carry).map((id) => `${id} ${(preview.carry[id] * 100).toFixed(1)}/${(isle.carry[id] * 100).toFixed(1)}`).join(', ')}`);
  console.log(`   best: ${TIERS.map((t) => `${t} ${(preview.best[t] * 100).toFixed(1)}/${(isle.best[t] * 100).toFixed(1)}`).join(', ')}`);
  check(`one in ${MUTATION_ODDS} on both sides`, at('ODDS') === String(MUTATION_ODDS), at('ODDS'));
  const want = POINTS.map(([h, c]) => [breedChance(h, c), inheritChance(h, c), upgradeChance(h, c)].map((x) => Number(x.toFixed(9))).join(':')).join(',');
  const isleSaid = at('POINT').split(',').map((p) => p.split(':').map((x) => Number(x)).join(':')).join(',');
  check(`the odds a pairing takes, a trait is drawn from the pair and comes out a tier better are the same at ${POINTS.length} husbandries and cares`,
    isleSaid === want, `${isleSaid} // ${want}`);
  const tiers = TIER_SETS.map(([s, d]) => mutationTier(s, d)).join(',');
  check('a mutation\'s tier is the same, at every best tier of the parents and with none at all', at('TIER') === tiers, `${at('TIER')} // ${tiers}`);
}
// One rule for a wild roll: the island's against the browser's own.
TAKEN.forEach((taken, k) => {
  const isle = all(`ROLL${k}`);
  const mine = Array.from({ length: MANY }, () => rollTrait(Math.random, taken, ROLL_SKILL) as string);
  const share = (xs: string[], f: (id: string) => boolean): number => xs.filter(f).length / xs.length;
  const off: string[] = [];
  for (const t of TIERS) {
    const [a, b] = [share(mine, (id) => traitTier(id) === t), share(isle, (id) => traitTier(id) === t)];
    if (!near(a, b, MANY, isle.length)) off.push(`${t} ${a.toFixed(4)} / ${b.toFixed(4)}`);
  }
  const fight = (id: string): boolean => !!traitOf(id)?.family;
  const [fa, fb] = [share(mine, fight), share(isle, fight)];
  if (!near(fa, fb, MANY, isle.length)) off.push(`fighting ${fa.toFixed(4)} / ${fb.toFixed(4)}`);
  const carried = isle.filter((id) => taken.some((t) => familyOf(t) === familyOf(id))).length;
  check(`a wild roll against ${taken.length ? `${taken.length} traits carried` : 'nothing'} comes out at the same tiers on both sides, ${Math.round(FIGHT_SHARE * 100)}% or so of it fighting blood, never a name carried`,
    isle.length === ROLLS && off.length === 0 && carried === 0, `${off.join('; ')}${carried ? `; ${carried} carried` : ''}`);
});

/* ---- and what a mutation is said to be in the preview is what comes ---------- */
{
  const tier = mutationTier(SIRE, DAM);
  const bred = all('BRED').map((v) => JSON.parse(v) as { traits: string[]; from: Record<string, string> });
  const muts = [...bred.map((b) => mutationOf(b.from as never)), ...Array.from({ length: MANY }, () => mutationOf(breedTraits(SIRE, DAM, HUSBANDRY, CARE, Math.random).from))]
    .filter((x): x is string => !!x);
  check(`every mutation that came, on either side, is the tier the preview says (${tier}) and a name neither parent carries`,
    muts.length > 0 && muts.every((id) => traitTier(id) === tier && ![...SIRE, ...DAM].some((t) => familyOf(t) === familyOf(id))), `${muts.length}: ${muts.slice(0, 5).join(', ')}`);
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(`\nwhat a pairing would throw — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
