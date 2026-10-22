/**
 * A bronze mirror: the young of a mirrored wildermon's next covering get its best trait as it carries it.
 *
 * Asked for: "Copy a trait to a newborn: at breeding, the newborn gets the parent's best trait at that parent's value
 * instead of rolling it. Used up on the birth." This asks, of both sides:
 *
 *   * that the mirror is used from a wildermon's menu, refused and kept without one, on one already mirrored and on one
 *     with no traits, in the same words, and marks it (`boosts.mirror`), the mirror used up;
 *   * that its best trait is the highest-tier one, the first in its own order on a tie (`mirrorTrait`, `mirror_trait`),
 *     and is named the same way (`mirrorNames`, `mirror_names`), for every trait there is;
 *   * that a draw with copies puts each in as its parent carries it, before the rest, the dam's before the sire's and a
 *     name once, whose it was written down as a draw from the pair says it; that the rest are drawn; that a mutation
 *     never takes a copy, even the lowest-tier one; and that over many draws every young carries every copy;
 *   * that a covering copies a mirrored parent's best trait into its young (each of both parents, and a twin's too),
 *     the young is born with it, and the mark is used up and said, in the same words on both sides;
 *   * and in the browser, that the card and the pairing preview say which trait and at what rarity.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { RELICS } from '../../src/game/archaeology';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { mirrorCopy, mirrored, mirrorNames, type Creature } from '../../src/game/creatures';
import { breedPreview } from '../../src/game/husbandry';
import { ITEM_DEFS } from '../../src/game/items';
import { breedTraits, familyOf, MUTATION_ODDS, mirrorTrait, mutationOf, TRAITS, TRAIT_SLOTS, type TraitSource } from '../../src/game/traits';
import { fittedTags } from '../../src/ui/panels/wildermon';

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
const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(',')}]::text[]`;

/** A dam with two rare traits (the first listed is her best), a sire whose best is fighting blood, and one all common. */
const SNOW = ['willing', 'diligent', 'fleet'];
const HORN = ['thrifty', 'fanged_supreme', 'careful'];
const PLAIN = ['willing', 'thrifty', 'careful'];
/** Sets and the trait a mirror copies of each: ties go to the first listed. */
const BEST: Array<[string[], string | null]> = [
  [[], null], [['willing'], 'willing'], [SNOW, 'diligent'], [HORN, 'fanged_supreme'], [['fanged', 'willing'], 'fanged'],
  [['fanged_rare', 'fleet'], 'fanged_rare'], [['swift', 'windborn', 'ironsides'], 'windborn'], [['scarred_fantastic', 'windborn'], 'scarred_fantastic'],
];
/** A roll that keeps every slot to the pair, never a tier up or a mutation; and one just under a mutation's odds. */
const KEEP = 0.01;
const UNDER = 1 / MUTATION_ODDS - 1e-4;
const DRAWS = 300;
const U = '6d6d6d6d-6d6d-4d6d-8d6d-6d6d6d6d6d6d';

interface Bred { traits: string[]; from: Record<string, string> }

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return coalesce(nullif(current_setting('wurm.dice', true), '')::double precision, pg_catalog.random());
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; px double precision; py double precision; v_snow int; v_horn int; v_ash int; v_n bigint;
        v_young int; v_b jsonb; v_missing int := 0; v_i int;
        T jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Mirror', 717, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Breeder');
  select x, y into px, py from player where world_id = w and uid = u;

  insert into said select 'RELIC', name || ':' || parts || ':' || difficulty || ':' || result from relic_def where result = 'bronze_mirror';
  insert into said values ('PORTED', act_ported('use_bronze_mirror') || ':' || exists (select 1 from action_def d where d.id = 'use_bronze_mirror'));
  insert into said values ('BEST', ${BEST.map(([set]) => `coalesce(mirror_trait(${arr(set)}), '-')`).join(` || ',' || `)});
  insert into said select 'NAMES', string_agg(d.id || '=' || mirror_names(d.id), '|' order by d.id) from trait_def d;

  -- The draw with copies, the rolls pinned: kept to the pair, and just under a mutation.
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wurm.dice', '${KEEP}', true);
  insert into said values ('DRAW:DAM', breed_traits(${arr(HORN)}, ${arr(SNOW)}, 0, 0, 0, 0, array['diligent'])::text);
  insert into said values ('DRAW:BOTH', breed_traits(${arr(HORN)}, ${arr(SNOW)}, 0, 0, 0, 0, array['diligent', 'fanged_supreme'])::text);
  insert into said values ('DRAW:ONCE', breed_traits(${arr(['fanged'])}, ${arr(['fanged_rare'])}, 0, 0, 0, 0, array['fanged_rare', 'fanged'])::text);
  insert into said values ('DRAW:NONE', breed_traits(${arr(HORN)}, ${arr(SNOW)}, 0, 0)::text);
  perform set_config('wurm.dice', '${UNDER}', true);
  insert into said values ('DRAW:MUTATED', breed_traits(${arr(HORN)}, ${arr(PLAIN)}, 0, 0, 0, 0, array['willing'])::text);
  -- And unpinned, many times: every young carries both copies.
  perform set_config('wurm.dice', '', true);
  for v_i in 1 .. ${DRAWS} loop
    v_b := breed_traits(${arr(HORN)}, ${arr(PLAIN)}, 60, 0.8, 0, 0, array['willing', 'fanged_supreme']);
    if not (v_b->'traits' ? 'willing' and v_b->'traits' ? 'fanged_supreme') or jsonb_array_length(v_b->'traits') <> ${TRAIT_SLOTS} then
      v_missing := v_missing + 1;
    end if;
  end loop;
  insert into said values ('MANY', v_missing::text);
  perform set_config('search_path', '"$user", public', true);

  -- The mirror on a wildermon.
  v_snow := creature_spawn(w, 'rabba', px + 0.5, py, 'active', now() - interval '30 days', u);
  v_horn := creature_spawn(w, 'rabba', px - 0.5, py, 'active', now() - interval '30 days', u);
  v_ash := creature_spawn(w, 'rabba', px, py + 0.5, 'active', now() - interval '30 days', u);
  update creature set sex = 'female', name = 'Snow', traits = ${arr(SNOW)}, rare = null, boosts = null, care = 0, hunger = 1 where world_id = w and id = v_snow;
  update creature set sex = 'male', name = 'Horn', traits = ${arr(HORN)}, rare = null, boosts = null, care = 0, hunger = 1 where world_id = w and id = v_horn;
  update creature set name = 'Ash', traits = '{}', rare = null, boosts = null where world_id = w and id = v_ash;
  T := jsonb_build_object('kind', 'creature', 'id', v_snow);
  insert into said values ('USE:NONE', coalesce(creature_refusal(w, u, 'use_bronze_mirror', T), '-'));
  perform give(w, u, 'bronze_mirror', 3, 30);
  insert into said values ('USE:EMPTY', coalesce(creature_refusal(w, u, 'use_bronze_mirror', jsonb_build_object('kind', 'creature', 'id', v_ash)), '-'));
  insert into said values ('USE:OK', coalesce(creature_refusal(w, u, 'use_bronze_mirror', T), '-'));
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = u;
  perform perform_creature(w, u, 'use_bronze_mirror', T);
  perform perform_creature(w, u, 'use_bronze_mirror', jsonb_build_object('kind', 'creature', 'id', v_horn));
  insert into said select 'MARKED', coalesce(c.boosts::text, '-') || '|' || pack_count(w, u, 'bronze_mirror') from creature c where c.world_id = w and c.id = v_snow;
  insert into said values ('USE:AGAIN', coalesce(creature_refusal(w, u, 'use_bronze_mirror', T), '-'));
  insert into said values ('USED', (select string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and n > v_n));

  -- The covering, pinned to keep to the pair, and the birth.
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = u;
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wurm.dice', '${KEEP}', true);
  perform pair_them(w, v_snow, v_horn, 0, u);
  perform set_config('search_path', '"$user", public', true);
  insert into said values ('PAIRED', (select string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and n > v_n));
  insert into said select 'MARKS', coalesce(c.boosts::text, '-') from creature c where c.world_id = w and c.id = v_snow;
  insert into said select 'MARKS', coalesce(c.boosts::text, '-') from creature c where c.world_id = w and c.id = v_horn;
  update creature set due = now() - interval '1 second' where world_id = w and id = v_snow;
  v_young := give_birth(w, v_snow);
  insert into said values ('BORN', (select jsonb_build_object('traits', to_jsonb(c.traits), 'from', c.pedigree->'from')::text from creature c where c.world_id = w and c.id = v_young));
end $t$;
select k || '=' || v from said order by k, v;
rollback;`);
const lines = out.split('\n').filter((l) => l.includes('='));
const isle = new Map(lines.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const all = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const bredOf = (s: string): Bred => {
  try {
    return JSON.parse(s) as Bred;
  } catch {
    return { traits: [], from: {} };
  }
};

/* ---- the rule, of a draw on either side ----------------------------------------------------- */

/** What a draw with these copies must keep to; null where it does. */
function keeps(b: Bred, copy: string[], sire: string[], dam: string[], mutated = false): string | null {
  const want = copy.filter((id, i) => !copy.slice(0, i).some((o) => familyOf(o) === familyOf(id)));
  if (b.traits.length !== TRAIT_SLOTS) return `${b.traits.length} traits`;
  if (want.some((id, i) => b.traits[i] !== id)) return `the copies are not first: ${b.traits}`;
  if (new Set(b.traits.map(familyOf)).size !== b.traits.length) return `a name twice: ${b.traits}`;
  for (const id of want) {
    const whose = dam.includes(id) ? (sire.includes(id) ? 'both' : 'dam') : 'sire';
    if (b.from[id] !== whose) return `${id} written down as ${b.from[id]}, not ${whose}`;
  }
  const m = mutationOf(b.from as Record<string, TraitSource>);
  if (mutated !== !!m) return mutated ? 'no mutation' : `a mutation: ${m}`;
  return null;
}

/* ---- in the browser ---------------------------------------------------------------- */

const still = (x: number) => (): number => x;
const g = Game.create(717);
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const raise = (name: string, traits: string[], sex: 'male' | 'female', dx: number, dy = 0): Creature => {
  const c = g.creatures.spawn('rabba', g.player.x + dx, g.player.y + dy, 'active', g.rand, g.time - 3600 * 24 * 30);
  Object.assign(c, { name, sex, traits: [...traits], rare: 0, boosts: undefined, care: 0, hunger: 1 });
  return c;
};
const snow = raise('Snow', SNOW, 'female', 0.5);
const horn = raise('Horn', HORN, 'male', -0.5);
const ash = raise('Ash', [], 'male', 0, 0.5);
const mirror = CREATURE_ACTION_BY_ID.get('use_bronze_mirror')!;
const on = (c: Creature) => ({ kind: 'creature' as const, id: c.id });
const told = (from: number): string => g.log.slice(from).map((e) => e.text).join(' / ');

/* ---- both ---------------------------------------------------------------------------- */

{
  const r = RELICS.find((x) => x.result === 'bronze_mirror');
  check('the bronze mirror is a relic restoring into a thing of its own, the same on both sides, with a description',
    !!r && at('RELIC') === `${r.name}:${r.parts}:${r.difficulty}:${r.result}` && !!ITEM_DEFS.bronze_mirror.description && !ITEM_DEFS.bronze_mirror.description.includes('{'), at('RELIC'));
  check('its action is one the island does and prices, and the browser has', at('PORTED') === 'true:true' && !!mirror, at('PORTED'));
}
{
  const browser = BEST.map(([set]) => mirrorTrait(set) ?? '-').join(',');
  check('its best trait: the highest rarity, the first listed on a tie, the same on both sides',
    browser === BEST.map(([, want]) => want ?? '-').join(',') && at('BEST') === browser, `${browser} | ${at('BEST')}`);
  const names = [...TRAITS].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)).map((t) => `${t.id}=${mirrorNames(t.id)}`).join('|');
  check(`both sides name a copied trait in the same words, for each of the ${TRAITS.length} traits`,
    names === at('NAMES') && mirrorNames('fleet') === 'fleet (rare)' && mirrorNames('fanged_supreme') === 'fanged (supreme)', names.split('|').find((x) => !at('NAMES').split('|').includes(x)) ?? '');
}

// The draw.
{
  const cases: Array<[string, string[], string[], string[], string[], boolean, () => number]> = [
    ['the dam\'s copy', ['diligent'], HORN, SNOW, ['diligent'], false, still(KEEP)],
    ['both copies, the dam\'s first', ['diligent', 'fanged_supreme'], HORN, SNOW, ['diligent', 'fanged_supreme'], false, still(KEEP)],
    ['two grades of one name, once', ['fanged_rare', 'fanged'], ['fanged'], ['fanged_rare'], ['fanged_rare'], false, still(KEEP)],
    ['a mutation, which never takes the lowest-tier copy', ['willing'], HORN, PLAIN, ['willing'], true, still(UNDER)],
  ];
  const keys = ['DRAW:DAM', 'DRAW:BOTH', 'DRAW:ONCE', 'DRAW:MUTATED'];
  cases.forEach(([what, copy, sire, dam, , mutated, rand], i) => {
    const b = breedTraits(sire, dam, 0, 0, rand, 0, 0, copy);
    const isleB = bredOf(at(keys[i]));
    const whyB = keeps(b, copy, sire, dam, mutated);
    const whyI = keeps(isleB, copy, sire, dam, mutated);
    check(`a draw with ${what}: each copy first, as its parent carries it, whose it was written down, on both sides`,
      !whyB && !whyI, `${whyB ?? ''} ${whyI ?? ''} | ${b.traits} | ${at(keys[i])}`);
  });
  const none = bredOf(at('DRAW:NONE'));
  check('without copies a draw is as it was: no mirror slot on either side', keeps(none, [], HORN, SNOW) === null
    && keeps(breedTraits(HORN, SNOW, 0, 0, still(KEEP)), [], HORN, SNOW) === null, at('DRAW:NONE'));
  let missing = 0;
  for (let i = 0; i < 20000; i++) {
    const b = breedTraits(HORN, PLAIN, 60, 0.8, Math.random, 0, 0, ['willing', 'fanged_supreme']);
    if (!b.traits.includes('willing') || !b.traits.includes('fanged_supreme') || b.traits.length !== TRAIT_SLOTS) missing++;
  }
  check(`over many draws every young carries both copies (browser 20000, island ${DRAWS}), mutations and all`, missing === 0 && at('MANY') === '0', `${missing} | ${at('MANY')}`);
}

// The mirror on a wildermon, and the covering.
{
  check('without a mirror, both refuse in the same words', mirror.check?.(on(snow), g) === at('USE:NONE') && at('USE:NONE') === 'Need a bronze mirror.', at('USE:NONE'));
  g.inventory.add('bronze_mirror', { ql: 30 });
  g.inventory.add('bronze_mirror', { ql: 30 });
  g.inventory.add('bronze_mirror', { ql: 30 });
  check('on one with no traits, both refuse in the same words', mirror.check?.(on(ash), g) === at('USE:EMPTY') && at('USE:EMPTY') === 'Ash: no traits to copy.', at('USE:EMPTY'));
  check('on one with traits, both go ahead', mirror.check?.(on(snow), g) === null && mirror.applies(on(snow), g) && at('USE:OK') === '-', at('USE:OK'));
  const from = g.log.length;
  mirror.perform(on(snow), g);
  mirror.perform(on(horn), g);
  check('used: the mark on it, one mirror used up each, on both sides',
    mirrored(snow) && mirrored(horn) && JSON.stringify(snow.boosts) === '{"mirror":1}' && g.inventory.countAll('bronze_mirror') === 1
      && at('MARKED') === '{"mirror": 1}|1', at('MARKED'));
  check('one mark at a time: a second is refused, kept, in the same words on both sides',
    mirror.check?.(on(snow), g) === at('USE:AGAIN') && at('USE:AGAIN') === 'Snow: already mirrored.' && g.inventory.countAll('bronze_mirror') === 1, at('USE:AGAIN'));
  check('both sides say the same when it is used', told(from) === at('USED')
    && at('USED') === 'Bronze mirror used on Snow: diligent (rare) to its next young. / Bronze mirror used on Horn: fanged (supreme) to its next young.', `${told(from)} | ${at('USED')}`);

  // The card and the preview, in the browser.
  g.skills.values.set('animal_husbandry', 100);
  const tag = fittedTags(g, snow).map((t) => t.text).join(' / ');
  check('the card says which trait and at what rarity', tag.includes('Mirror: diligent (rare) to its next young'), tag);
  const preview = breedPreview(g, snow, horn);
  check('the pairing preview says which trait each copies, at what rarity, all of the time',
    preview.includes('Bronze mirror (Snow): diligent (rare) copied, 100%. Mark used up.') && preview.includes('Bronze mirror (Horn): fanged (supreme) copied, 100%.')
      && preview.includes('diligent 100%') && preview.includes('fanged (supreme) 100%'), preview);
  g.skills.values.set('animal_husbandry', 0);
  check('a trait your husbandry cannot read is not named on the card or in the preview',
    fittedTags(g, snow).some((t) => t.text === 'Mirror: best trait (unreadable) to its next young') && breedPreview(g, snow, horn).includes('Bronze mirror (Snow): best trait (unreadable) copied'),
    fittedTags(g, snow).map((t) => t.text).join(' / '));
  check('both copies, as the covering makes them', mirrorCopy(snow, horn).join() === 'diligent,fanged_supreme' && mirrorCopy(snow, ash).join() === 'diligent');

  const pairFrom = g.log.length;
  const keep = g.rand;
  g.rand = still(KEEP);
  g.creatures.pair(g, snow, horn, 0);
  g.rand = keep;
  check('a covering uses up both marks, on both sides', !mirrored(snow) && !mirrored(horn) && snow.boosts === undefined && all('MARKS').join() === '-,-', all('MARKS').join());
  check('both sides say the same as the marks are used', told(pairFrom) === at('PAIRED')
    && at('PAIRED') === 'Bronze mirror: diligent (rare) from Snow to the young. Mark used up. / Bronze mirror: fanged (supreme) from Horn to the young. Mark used up.',
    `${told(pairFrom)} | ${at('PAIRED')}`);
  snow.due = g.time;
  const young = g.creatures.giveBirth(g, snow);
  const bornB: Bred = { traits: young?.traits ?? [], from: (young?.pedigree?.from ?? {}) as Record<string, string> };
  const bornI = bredOf(at('BORN'));
  const whyB = keeps(bornB, ['diligent', 'fanged_supreme'], HORN, SNOW);
  const whyI = keeps(bornI, ['diligent', 'fanged_supreme'], HORN, SNOW);
  check('the young is born with both copies, as their parents carry them, in its pedigree, on both sides', !whyB && !whyI,
    `${whyB ?? ''} ${whyI ?? ''} | ${bornB.traits} | ${at('BORN')}`);

  // Unmarked, the next covering draws as ever, and says nothing of a mirror.
  snow.bredAt = -1e9;
  horn.bredAt = -1e9;
  const next = g.log.length;
  g.creatures.pair(g, snow, horn, 0);
  check('the next covering, the marks gone, draws as ever and says nothing of a mirror', !told(next).includes('Bronze mirror'), told(next));

  // A twin carries the copies too.
  snow.unborn = null;
  snow.due = 0;
  snow.boosts = { mirror: 1 };
  g.perkFx = { 'breed:twins': 1 };
  g.creatures.pair(g, snow, horn, 0);
  g.perkFx = {};
  const tw = snow.unborn as unknown as { traits: string[]; twin?: { traits: string[] } } | null;
  check('a twin of a mirrored covering carries the copy too', !!tw?.twin && tw.traits.includes('diligent') && tw.twin.traits.includes('diligent'),
    `${tw?.traits} / ${tw?.twin?.traits}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a bronze mirror — ${ok.length} of ${ok.length}`);
