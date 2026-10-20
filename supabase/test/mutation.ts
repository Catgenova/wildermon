/**
 * A mutation, one young in `MUTATION_ODDS`.
 *
 * Asked for: "one birth in MUTATION_ODDS = 200, the foal gets a trait that
 * neither parent carries (compared by family, the same uniqueness rule
 * rollTraits / the ancient lamp use), at one tier above the best tier among the
 * parents' traits (capped at the top tier). It takes the foal's lowest-tier
 * trait slot after normal inheritance (an empty slot first). Same RNG order on
 * both sides as far as practical; the island decides on the island. The birth
 * message says it mutated and what came."
 *
 * Asked of both sides, with the rolls forced so that the draw comes out the
 * same either way and only the mutation's roll differs:
 *
 *   * that a roll just under one in `MUTATION_ODDS` mutates and one just over
 *     it does not;
 *   * that what mutated is the young one it would have been with one slot
 *     changed, the lowest-tier one, and the trait in it is a name neither parent
 *     carries nor the young one does elsewhere, a tier above the best of the
 *     parents', and the top tier where that is the best; that it is written
 *     down as a mutation, and the trait that went out is not written down at
 *     all;
 *   * that an empty slot is the lowest there is;
 *
 * of the browser, that over forty thousand draws about one in `MUTATION_ODDS`
 * mutates and every one keeps the rule; and of both, that a birth that mutated
 * says so and what came, in the same words for every trait there is.
 *
 * Runs against the database the suite leaves behind, in one transaction that is
 * rolled back.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { mutationSaid, type Creature } from '../../src/game/creatures';
import {
  breedTraits, familyOf, lowestSlot, MUTATION_ODDS, mutationOf, mutationTier, TIERS, TRAITS, traitTier, TRAIT_SLOTS, type TraitSource, type TraitTier,
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

const rank = (id: string): number => TIERS.indexOf(traitTier(id));
const TOP: TraitTier = TIERS[TIERS.length - 1];
/** A roll just under the odds of a mutation, which mutates, and one just over, which does not. */
const UNDER = 1 / MUTATION_ODDS - 1e-4;
const OVER = 1 / MUTATION_ODDS + 1e-4;

/** Pairs, by name: what a mutation in each comes in at. */
const PAIRS: Record<string, { sire: string[]; dam: string[] }> = {
  // All common: a mutation is rare.
  common: { sire: ['willing', 'thrifty', 'fanged'], dam: ['careful', 'rangy', 'scarred'] },
  // A supreme one between them: a mutation is fantastic.
  supreme: { sire: ['willing', 'fleet', 'fanged_rare'], dam: ['thrifty', 'swift', 'scarred'] },
  // A fantastic one already: still fantastic.
  top: { sire: ['windborn', 'fleet', 'fanged'], dam: ['ironsides', 'willing', 'thrifty'] },
};

interface Bred { traits: string[]; from: Record<string, string> }

/** Everything one forced pairing must keep to, as `mutated` against what it would have been, `plain`; null where it does. */
function keeps(pair: { sire: string[]; dam: string[] }, plain: Bred, mutated: Bred): string | null {
  const changed = mutated.traits.flatMap((t, i) => (plain.traits[i] !== t ? [i] : []));
  if (mutationOf(plain.from as Record<string, TraitSource>)) return 'the roll over the odds mutated';
  if (changed.length !== 1 || mutated.traits.length !== plain.traits.length) return `${changed.length} slots changed`;
  const slot = changed[0];
  const now = mutated.traits[slot];
  if (rank(plain.traits[slot]) !== Math.min(...plain.traits.map(rank))) return `slot ${slot} (${plain.traits[slot]}) is not the lowest of ${plain.traits}`;
  if (mutated.from[now] !== 'mutation') return `${now} is written down as ${mutated.from[now]}`;
  if (plain.traits[slot] in mutated.from) return `${plain.traits[slot]}, which went out, is still written down`;
  if (JSON.stringify(Object.keys(mutated.from).sort()) !== JSON.stringify([...mutated.traits].sort())) return 'what is written down is not its traits';
  if ([...pair.sire, ...pair.dam].some((t) => familyOf(t) === familyOf(now))) return `${now} is a name a parent carries`;
  if (mutated.traits.some((t, i) => i !== slot && familyOf(t) === familyOf(now))) return `${now} is a name it carries already`;
  const want = TIERS[Math.min(TIERS.length - 1, Math.max(...[...pair.sire, ...pair.dam].map(rank)) + 1)];
  if (traitTier(now) !== want || mutationTier(pair.sire, pair.dam) !== want) return `${now} is ${traitTier(now)}, not ${want}`;
  return null;
}

/* ---- the browser ------------------------------------------------------------- */

console.log('--- the browser');
const still = (x: number) => (): number => x;
for (const [name, pair] of Object.entries(PAIRS)) {
  const plain = breedTraits(pair.sire, pair.dam, 0, 0, still(OVER));
  const mutated = breedTraits(pair.sire, pair.dam, 0, 0, still(UNDER));
  const why = keeps(pair, plain, mutated);
  check(`browser, ${name} pair: a roll just under one in ${MUTATION_ODDS} mutates its lowest slot into a name neither parent carries, ${mutationTier(pair.sire, pair.dam)}, and one just over does not`,
    !why, why ?? `${plain.traits} -> ${mutated.traits}`);
}
check('browser: an empty slot is the lowest there is, and in a full set the lowest-tier one is taken',
  lowestSlot(['swift'], Math.random).slot === 1 && lowestSlot([], Math.random).slot === 0
    && lowestSlot(['swift', 'willing', 'fleet'], Math.random).slot === 1 && TRAIT_SLOTS === 3);
{
  // Where two share the lowest tier, either may go, and the one above them never does.
  const set = ['willing', 'thrifty', 'swift'];
  const slots = [0.01, 0.49, 0.51, 0.99].map((r) => lowestSlot(set, still(r)).slot);
  check('browser: where two share the lowest tier either may be taken, and the one above them never is', JSON.stringify(slots) === '[0,0,1,1]', slots.join(','));
}
{
  // Forty thousand draws: about one in MUTATION_ODDS mutates, and every one keeps to the rule.
  const N = 40000;
  const pair = PAIRS.supreme;
  let n = 0;
  const broken: string[] = [];
  for (let i = 0; i < N; i++) {
    const b = breedTraits(pair.sire, pair.dam, 50, 0.5, Math.random);
    const m = mutationOf(b.from);
    if (!m) continue;
    n++;
    if ([...pair.sire, ...pair.dam].some((t) => familyOf(t) === familyOf(m)) || traitTier(m) !== mutationTier(pair.sire, pair.dam)
      || b.traits.filter((t) => familyOf(t) === familyOf(m)).length !== 1) broken.push(`${b.traits}`);
  }
  const want = N / MUTATION_ODDS;
  check(`browser: of ${N} draws about one in ${MUTATION_ODDS} mutates (${want} or so), every one by the rule`,
    Math.abs(n - want) < 4.5 * Math.sqrt(want) && broken.length === 0, `${n}; ${broken.slice(0, 3).join(' / ')}`);
}

// A birth that mutated, through the covering and the hour.
const game = Game.create(6262);
game.deed = { name: 'Hearth', x: game.player.tileX + 4, y: game.player.tileY + 4, radius: 5, level: 3 };
for (const c of [...game.creatures.list.values()]) if (c.mode !== 'wild') c.mode = 'wild';
const raise = (name: string, traits: string[], sex: 'male' | 'female', dx: number): Creature => {
  const c = game.creatures.spawn('rabba', game.player.x + dx, game.player.y, 'deed', game.rand, 0);
  Object.assign(c, { name, sex, traits: [...traits], hunger: 1, care: 0 });
  return c;
};
const dam = raise('Snow', PAIRS.supreme.dam, 'female', 0.3);
const sire = raise('Horn', PAIRS.supreme.sire, 'male', -0.3);
{
  const was = game.rand;
  game.rand = still(UNDER);
  game.creatures.pair(game, dam, sire, 0);
  game.rand = was;
  dam.due = game.time;
  const young = game.creatures.giveBirth(game, dam);
  const told = [...game.log].reverse().find((l) => l.text.includes(' drops a young '))?.text ?? '';
  const m = mutationOf(young?.pedigree?.from);
  check('browser: a birth that mutated says so, and what came', !!m && told.includes(mutationSaid(young?.pedigree?.from)) && told.includes(' It is born with a mutation: ')
    && mutationSaid(young?.pedigree?.from).length > 0, told);
  dam.due = 0;
  game.creatures.pair(game, dam, sire, 0);
  dam.due = game.time;
  const plain = game.creatures.giveBirth(game, dam);
  const plainTold = [...game.log].reverse().find((l) => l.text.includes(' drops a young '))?.text ?? '';
  check('browser: and one that did not says nothing of it', !!plain && (mutationOf(plain.pedigree?.from) !== null || !plainTold.includes('mutation')), plainTold);
}

/* ---- the island -------------------------------------------------------------- */

const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(',')}]::text[]`;
const U = '7e5b0000-0000-4000-8000-0000000000c3';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return current_setting('wurm.dice')::double precision;
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; px double precision; py double precision; v_dam int; v_sire int; v_young int; v_n bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Mutations', 223, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Breeder');
  select x, y into px, py from player where world_id = w and uid = u;

  -- Every trait, as a mutation, in the island's words.
  insert into said select 'SAID', string_agg(d.id || '=' || mutation_said(jsonb_build_object(d.id, 'mutation')), '|' order by d.id) from trait_def d;
  insert into said values ('NONE', mutation_said('{"willing": "dam"}'::jsonb) || '#' || mutation_said(null));

  perform set_config('search_path', 'dice, public, pg_catalog', true);
${Object.entries(PAIRS).map(([name, pair]) => `
  perform set_config('wurm.dice', '${OVER}', true);
  insert into said values ('PLAIN:${name}', breed_traits(${arr(pair.sire)}, ${arr(pair.dam)}, 0, 0)::text);
  perform set_config('wurm.dice', '${UNDER}', true);
  insert into said values ('MUTATED:${name}', breed_traits(${arr(pair.sire)}, ${arr(pair.dam)}, 0, 0)::text);`).join('\n')}

  -- A birth that mutated, through the covering and the hour.
  v_dam := creature_spawn(w, 'rabba', px + 0.5, py, 'deed', now() - interval '3 hours', u);
  v_sire := creature_spawn(w, 'rabba', px - 0.5, py, 'deed', now() - interval '3 hours', u);
  update creature set sex = 'female', name = 'Snow', traits = ${arr(PAIRS.supreme.dam)}, hunger = 1 where world_id = w and id = v_dam;
  update creature set sex = 'male', name = 'Horn', traits = ${arr(PAIRS.supreme.sire)}, hunger = 1 where world_id = w and id = v_sire;
  perform set_config('wurm.dice', '${UNDER}', true);
  perform pair_them(w, v_dam, v_sire, 0, u);
  perform set_config('search_path', '"$user", public', true);
  update creature set due = now() - interval '1 second' where world_id = w and id = v_dam;
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = u;
  v_young := give_birth(w, v_dam);
  insert into said values ('BORN', (select jsonb_build_object('traits', to_jsonb(c.traits), 'from', c.pedigree->'from')::text from creature c where c.world_id = w and c.id = v_young));
  insert into said values ('TOLD', (select string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and n > v_n));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const bredOf = (k: string): Bred => {
  try {
    return JSON.parse(at(k)) as Bred;
  } catch {
    return { traits: [], from: {} };
  }
};

console.log('--- the island');
for (const [name, pair] of Object.entries(PAIRS)) {
  const plain = bredOf(`PLAIN:${name}`);
  const mutated = bredOf(`MUTATED:${name}`);
  const why = plain.traits.length ? keeps(pair, plain, mutated) : 'nothing said';
  check(`island, ${name} pair: a roll just under one in ${MUTATION_ODDS} mutates its lowest slot into a name neither parent carries, ${mutationTier(pair.sire, pair.dam)}, and one just over does not`,
    !why, why ?? `${plain.traits} -> ${mutated.traits}`);
}
{
  const born = bredOf('BORN');
  const m = mutationOf(born.from as Record<string, TraitSource>);
  check('island: a birth that mutated says so and what came, in the browser\'s words', !!m && at('TOLD').includes(mutationSaid(born.from as Record<string, TraitSource>))
    && at('TOLD').includes(' It is born with a mutation: '), `${at('BORN')} / ${at('TOLD')}`);
  const browser = [...TRAITS].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)).map((t) => `${t.id}=${mutationSaid({ [t.id]: 'mutation' })}`).join('|');
  const wrong = browser.split('|').filter((x) => !at('SAID').split('|').includes(x));
  check(`both sides say a mutation in the same words, for each of the ${TRAITS.length} traits`, browser === at('SAID'), wrong.slice(0, 2).join(' / '));
  check('and nothing for a young one without one', at('NONE') === '#' && mutationSaid({ willing: 'dam' }) === '' && mutationSaid(undefined) === '', at('NONE'));
}
check(`the top tier stays ${TOP}`, mutationTier(PAIRS.top.sire, PAIRS.top.dam) === TOP);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na mutation — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
