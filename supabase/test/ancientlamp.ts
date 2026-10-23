/**
 * An ancient lamp rekindles a wildermon's lowest-tier trait.
 *
 * Asked for: the Old lamp, restored from archaeology finds, becomes the Ancient lamp, and used on a wildermon of yours
 * from its menu it rerolls its lowest-tier trait, at that tier or better and never worse, one time in twenty a tier
 * higher, and is used up. This asks, of both sides:
 *
 *   * that an old lamp restores into an ancient lamp, that the old lamp is no item any more, and that one held from
 *     before is an ancient lamp (in a save; on the island no row is left an old lamp);
 *   * that the slot rekindled is the lowest-tier one, one at random where several share the lowest tier, and an empty
 *     slot first on one with fewer than `TRAIT_SLOTS`;
 *   * that what comes in is never lower, is a tier above about one time in `LAMP_TIER_ODDS` (and always or never with
 *     the rolls forced), and at the top tier is another of the top tier;
 *   * that it is never a name the creature carries, the one going out included;
 *   * that it is used up, one at a time, and refused and kept without one, on a wild one and on somebody else's;
 *   * that both sides say what went, what came and its tier, in the same words, and what a trait does the same way.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { packLand, packWorld, unpack } from '../../src/game/save';
import { Game } from '../../src/game/game';
import { RELICS } from '../../src/game/archaeology';
import { CREATURE_ACTION_BY_ID, lampSays } from '../../src/game/creatureActions';
import { ACTIONS } from '../../src/game/actions';
import { ITEM_DEFS } from '../../src/game/items';
import {
  BY_TIER, familyOf, FIGHTING, gradeId, LAMP_TIER_ODDS, rekindle, TIERS, TRAIT_SLOTS, TRAITS, traitSays, traitTier, type Rekindled, type TraitTier,
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
const LAMP = ITEM_DEFS.ancient_lamp?.name.toLowerCase() ?? '(no lamp)';
/** How many goes the odds of a tier above are sampled over, and how far from the expected count they may land. */
const GOES = 2000;
const expectUps = GOES / LAMP_TIER_ODDS;
const inBand = (n: number): boolean => Math.abs(n - expectUps) < 4 * Math.sqrt(expectUps);

/** The blood each go starts from, by name. */
const SETS: Record<string, string[]> = {
  // One of each of three tiers: the common one is the lowest.
  mixed: [BY_TIER.fantastic[0].id, BY_TIER.supreme[0].id, BY_TIER.common[0].id],
  // Two share the lowest tier, one of them fighting blood; the rare one is never touched.
  tie: [gradeId(FIGHTING[0].id, 'common'), BY_TIER.common[1].id, BY_TIER.rare[0].id],
  // All at the top: nothing above.
  top: [BY_TIER.fantastic[0].id, BY_TIER.fantastic[1].id, gradeId(FIGHTING[1].id, 'fantastic')],
  // A supreme lowest, so a tier above is fantastic.
  high: [BY_TIER.fantastic[0].id, BY_TIER.supreme[1].id, gradeId(FIGHTING[2].id, 'fantastic')],
  // Fewer than the slots.
  none: [],
  one: [BY_TIER.rare[0].id],
};
/** Each go on the island: the set it starts from, how many goes, and the dice forced on it (none for the real ones). */
const RUNS: Array<[string, string, number, number | null]> = [
  ['mixed', 'mixed', GOES, null],
  ['tie', 'tie', 400, null],
  ['top', 'top', 300, null],
  ['none', 'none', 60, null],
  ['one', 'one', 60, null],
  // The rolls forced: every roll low is a tier above every time, every roll high never.
  ['mixed_up', 'mixed', 10, 0.001],
  ['high_up', 'high', 10, 0.001],
  ['top_up', 'top', 10, 0.001],
  ['none_up', 'none', 10, 0.001],
  ['mixed_flat', 'mixed', 10, 0.999],
];
const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(',')}]::text[]`;

/* ---- on the island ----------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000000b8';
const OTHER = '7e5b0000-0000-4000-8000-0000000000b9';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table lit (run text, i int, before text, after text, told text, lamps int);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return current_setting('wurm.dice')::double precision;
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; a int; v_wild int; v_theirs int; px double precision; py double precision; i int; v_n bigint; v_left int;
        v_before text[];
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Lamps', 218, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Lamplighter');
  select x, y into px, py from player where world_id = w and uid = u;

  insert into said select 'RELIC', name || ':' || result from relic_def where name = 'old lamp';
  insert into said select 'ITEMS', coalesce(string_agg(id || ':' || name, ',' order by id), '-') from item_def where id in ('ancient_lamp', 'old_lamp');
  insert into said values ('ODDS', lamp_tier_odds()::text || '|' || trait_slots()::text);
  insert into said values ('PORTED', act_ported('use_ancient_lamp') || ':' || exists (select 1 from action_def d where d.id = 'use_ancient_lamp')
    || ':' || coalesce(artifact_item('use_ancient_lamp'), '-'));
  insert into said select 'SAYS', string_agg(d.id || '=' || coalesce(trait_says(d.id), ''), '|' order by d.id collate "C") from trait_def d;
  -- Nowhere an old lamp lies or is counted.
  insert into said values ('OLDROWS', ((select count(*) from item where def = 'old_lamp') + (select count(*) from away_tally where def = 'old_lamp')
    + (select count(*) from barter_item where def = 'old_lamp') + (select count(*) from buy_order where def = 'old_lamp')
    + (select count(*) from sale where def = 'old_lamp') + (select count(*) from deed_ledger where def = 'old_lamp')
    + (select count(*) from deed_store_log where def = 'old_lamp') + (select count(*) from deed_work where def = 'old_lamp')
    + (select count(*) from player where ledger ? 'old_lamp') + (select count(*) from creature where carrying->>'def' = 'old_lamp'))::text);

  a := creature_spawn(w, 'rabba', px + 0.5, py, 'active', now() - interval '60 days', u);
  update creature set name = 'Ash' where world_id = w and id = a;
  v_wild := creature_spawn(w, 'rabba', px - 0.5, py, 'wild', now() - interval '60 days', null);
  v_theirs := creature_spawn(w, 'rabba', px, py + 0.5, 'active', now() - interval '60 days', '${OTHER}');
  update creature set name = 'Birch' where world_id = w and id = v_theirs;

  -- Nothing in the pack; then a wild one, and somebody else's, which keep the lamp and their blood.
  insert into said values ('NONE', coalesce(creature_refusal(w, u, 'use_ancient_lamp', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  perform give(w, u, 'ancient_lamp', 1, 30);
  insert into said values ('WILD', coalesce(creature_refusal(w, u, 'use_ancient_lamp', jsonb_build_object('kind', 'creature', 'id', v_wild)), '-'));
  insert into said values ('THEIRS', coalesce(creature_refusal(w, u, 'use_ancient_lamp', jsonb_build_object('kind', 'creature', 'id', v_theirs)), '-'));
  select traits into v_before from creature where world_id = w and id = v_theirs;
  perform perform_creature(w, u, 'use_ancient_lamp', jsonb_build_object('kind', 'creature', 'id', v_theirs));
  insert into said values ('THEIRSKEPT', pack_count(w, u, 'ancient_lamp') || '|' || ((select traits from creature where world_id = w and id = v_theirs) = v_before)::text);
  insert into said values ('MINE', coalesce(creature_refusal(w, u, 'use_ancient_lamp', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  perform consume(w, u, 'ancient_lamp', 1);

${RUNS.map(([run, set, n, d]) => `
  ${d === null ? `perform set_config('search_path', '"$user", public', true);` : `perform set_config('wurm.dice', '${d}', true); perform set_config('search_path', 'dice, public, pg_catalog', true);`}
  perform give(w, u, 'ancient_lamp', ${n}, 30);
  for i in 1..${n} loop
    update creature set traits = ${arr(SETS[set])} where world_id = w and id = a;
    select coalesce(max(n), 0) into v_n from event where world_id = w and uid = u;
    perform perform_creature(w, u, 'use_ancient_lamp', jsonb_build_object('kind', 'creature', 'id', a));
    insert into lit values ('${run}', i, ${arr(SETS[set])}::text, (select traits::text from creature where world_id = w and id = a),
      (select string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and n > v_n), pack_count(w, u, 'ancient_lamp'));
  end loop;`).join('\n')}
  perform set_config('search_path', '"$user", public', true);
end $t$;
select k || '=' || v from said order by k;
select 'LIT=' || run || '#' || i || '#' || before || '#' || coalesce(after, '-') || '#' || coalesce(told, '-') || '#' || lamps from lit order by run, i;
rollback;`);
const lines = out.split('\n');
const isle = new Map(lines.filter((l) => l.includes('=') && !l.startsWith('LIT=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const pgArr = (s: string): string[] => (s === '{}' || s === '-' ? [] : s.slice(1, -1).split(',').map((x) => x.replace(/^"|"$/g, '')));
interface Go { i: number; before: string[]; after: string[]; told: string; lamps: number }
const goes = new Map<string, Go[]>();
for (const l of lines.filter((x) => x.startsWith('LIT='))) {
  const [run, i, before, after, told, lamps] = l.slice(4).split('#');
  goes.set(run, [...(goes.get(run) ?? []), { i: Number(i), before: pgArr(before), after: pgArr(after), told, lamps: Number(lamps) }]);
}
const run = (name: string): Go[] => goes.get(name) ?? [];

/** What a go did, read off its blood before and after, as `Rekindled`; null where it did not do what a lamp does. */
function readGo(before: string[], after: string[], told: string): Rekindled | null {
  if (before.length < TRAIT_SLOTS) {
    if (after.length !== before.length + 1 || before.some((t, i) => after[i] !== t)) return null;
    const now = after[before.length];
    return { slot: before.length, was: null, from: TIERS[0], now, tier: traitTier(now), up: told.includes(', a rarity above ') };
  }
  const changed = before.flatMap((t, i) => (after[i] !== t ? [i] : []));
  if (changed.length !== 1 || after.length !== before.length) return null;
  const slot = changed[0];
  return { slot, was: before[slot], from: traitTier(before[slot]), now: after[slot], tier: traitTier(after[slot]), up: told.includes(', a rarity above ') };
}

/** Everything a go must keep to, on either side: the lowest slot, never lower, a tier above only when said, a name it did not carry. */
function keeps(before: string[], did: Rekindled | null): string | null {
  if (!did) return 'not one slot changed';
  if (before.length >= TRAIT_SLOTS && rank(before[did.slot]) !== Math.min(...before.map(rank))) return `slot ${did.slot} is not the lowest`;
  if (rank(did.now) < TIERS.indexOf(did.from)) return `${did.now} is lower than ${did.from}`;
  if (rank(did.now) !== TIERS.indexOf(did.from) + (did.up ? 1 : 0)) return `${did.now} is not where a${did.up ? ' tier above' : 't the same tier'} lands`;
  if (before.some((t) => familyOf(t) === familyOf(did.now))) return `${did.now} is a name it carried`;
  return null;
}

/* ---- both ---------------------------------------------------------------------------- */

const browserRelic = RELICS.filter((r) => r.name === 'old lamp').map((r) => `${r.name}:${r.result}`).join(',');
check('an old lamp restores into an ancient lamp, on both sides', browserRelic === 'old lamp:ancient_lamp' && at('RELIC') === browserRelic, at('RELIC'));
check('the ancient lamp is an item named Ancient lamp, and the old lamp is no item any more, on both sides',
  at('ITEMS') === 'ancient_lamp:Ancient lamp' && ITEM_DEFS.ancient_lamp?.name === 'Ancient lamp' && !ITEM_DEFS.old_lamp, at('ITEMS'));
check('no item, tally, sale, order, ledger or load on the island is an old lamp', at('OLDROWS') === '0', at('OLDROWS'));
check(`its description says the odds off the rule, one time in ${LAMP_TIER_ODDS}, and has nothing left unfilled`,
  !!ITEM_DEFS.ancient_lamp?.description?.includes(`1 in ${LAMP_TIER_ODDS}`) && !ITEM_DEFS.ancient_lamp.description.includes('{'),
  ITEM_DEFS.ancient_lamp?.description ?? '-');
check(`one time in ${LAMP_TIER_ODDS} and ${TRAIT_SLOTS} slots, on both sides`, at('ODDS') === `${LAMP_TIER_ODDS}|${TRAIT_SLOTS}`, at('ODDS'));
check('it is a creature action the island does and prices, using the ancient lamp',
  at('PORTED') === 'true:true:ancient_lamp' && ACTIONS.some((x) => x.id === 'use_ancient_lamp'), at('PORTED'));
{
  const browser = [...TRAITS].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)).map((t) => `${t.id}=${traitSays(t)}`).join('|');
  const wrong = browser.split('|').filter((x) => !at('SAYS').split('|').includes(x));
  check(`what each of the ${TRAITS.length} traits does is said the same on both sides`, browser === at('SAYS'), wrong.slice(0, 3).join(' / '));
}

// Refusals.
check('on the island, without one in the pack it is refused', at('NONE') === `Need ${'an'} ${LAMP}.`, at('NONE'));
check('on the island, a wild one and somebody else\'s are not yours, and with a lamp your own one is not refused',
  at('WILD') === 'Not yours.' && at('THEIRS') === 'Birch: not yours.' && at('MINE') === '-', `${at('WILD')} / ${at('THEIRS')} / ${at('MINE')}`);
check('on the island, a lamp tried on somebody else\'s is kept and its blood untouched', at('THEIRSKEPT') === '1|true', at('THEIRSKEPT'));

// The island's goes.
{
  const all = [...goes.values()].flat();
  const broken = all.map((g0) => [g0, keeps(g0.before, readGo(g0.before, g0.after, g0.told))] as const).filter(([, why]) => why);
  check(`on the island, in all ${all.length} goes the lowest slot is rekindled, never lower, a tier above only when it says so, and never a name it carried`,
    all.length > GOES && broken.length === 0, broken.slice(0, 3).map(([g0, why]) => `${g0.before} -> ${g0.after}: ${why}`).join(' / '));
  const said = all.filter((g0) => {
    const did = readGo(g0.before, g0.after, g0.told);
    return did && g0.told === lampSays({ name: 'Ash' }, LAMP, did);
  });
  check('on the island, each go says which trait went, which came, its tier and what it does, in the browser\'s words',
    said.length === all.length, all.find((g0) => !said.includes(g0))?.told ?? '');
  const each = [...goes.entries()].every(([, gs]) => gs.every((g0, k) => g0.lamps === gs.length - k - 1));
  check('on the island, each go uses up one lamp', each, [...goes.entries()].map(([k, gs]) => `${k}:${gs.map((g0) => g0.lamps).slice(-2)}`).join(' '));

  const ups = run('mixed').filter((g0) => g0.told.includes(', a rarity above ')).length;
  check(`on the island, ${GOES} goes on a common lowest come up a tier above about one time in ${LAMP_TIER_ODDS}`, inBand(ups), `${ups} of ${GOES}`);
  const slots = new Set(run('tie').map((g0) => readGo(g0.before, g0.after, g0.told)?.slot));
  check('on the island, where two share the lowest tier either may go, and the one above them never does',
    slots.has(0) && slots.has(1) && !slots.has(2), [...slots].join(','));
  const fightSeen = run('tie').some((g0) => FIGHTING.some((f) => familyOf(g0.after[readGo(g0.before, g0.after, g0.told)!.slot]) === f.id));
  check('on the island, fighting blood comes up too, and never a grade of a name it carries', fightSeen);
  check(`on the island, at ${TOP} it is always another ${TOP} trait, and never says a tier above`,
    run('top').length === 300 && run('top').every((g0) => g0.after.every((t) => traitTier(t) === TOP) && !g0.told.includes('rarity above')
      && !g0.told.includes('one time in')), run('top')[0]?.told ?? '-');
  check('on the island, one with no traits gets one in an empty slot, and one with one keeps it and gets a second',
    run('none').every((g0) => g0.after.length === 1 && g0.told.includes('added to an empty slot'))
      && run('one').every((g0) => g0.after.length === 2 && g0.after[0] === SETS.one[0] && g0.told.includes('added to an empty slot')),
    `${run('none')[0]?.told} / ${run('one')[0]?.after}`);
  check('on the island, an empty slot is filled common, or a tier above rare, never anything else',
    [...run('none'), ...run('one')].every((g0) => ['common', 'rare'].includes(traitTier(g0.after[g0.after.length - 1]))));
  check('on the island, with every roll forced low a common lowest comes up rare, a supreme one fantastic and an empty slot rare, every time',
    run('mixed_up').every((g0) => traitTier(g0.after[2]) === 'rare' && g0.told.includes(', a rarity above common'))
      && run('high_up').every((g0) => traitTier(g0.after[1]) === 'fantastic' && g0.told.includes(', a rarity above supreme'))
      && run('none_up').every((g0) => traitTier(g0.after[0]) === 'rare'),
    `${run('mixed_up')[0]?.told} / ${run('high_up')[0]?.told}`);
  check(`on the island, with every roll forced low a ${TOP} one is still another ${TOP}, and with every roll high a common one stays common`,
    run('top_up').every((g0) => g0.after.every((t) => traitTier(t) === TOP) && !g0.told.includes('rarity above'))
      && run('mixed_flat').every((g0) => traitTier(g0.after[2]) === 'common' && g0.told.includes(`Rarity-up chance: 1 in ${LAMP_TIER_ODDS}`)),
    `${run('top_up')[0]?.told} / ${run('mixed_flat')[0]?.told}`);
}

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(2181);
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const ash = g.creatures.spawn('rabba', g.player.x + 1, g.player.y, 'active', g.rand, g.time - 3600 * 24 * 30);
ash.name = 'Ash';
const wild = g.creatures.spawn('rabba', g.player.x - 1, g.player.y, 'wild', g.rand, g.time - 3600 * 24 * 30);
const birch = g.creatures.spawn('rabba', g.player.x, g.player.y + 1, 'active', g.rand, g.time - 3600 * 24 * 30);
birch.name = 'Birch';
birch.mine = false;
const T = { kind: 'creature' as const, id: ash.id };
const lamp = CREATURE_ACTION_BY_ID.get('use_ancient_lamp')!;
const count = (): number => g.inventory.countAll('ancient_lamp');
const use = (): string | null => {
  const why = lamp.check?.(T, g) ?? null;
  if (!why) lamp.perform(T, g);
  return why;
};

check('in the browser, without one the menu offers nothing, and it is refused in the island\'s words',
  !lamp.applies(T, g) && lamp.check?.(T, g) === at('NONE'), lamp.check?.(T, g) ?? '-');
g.inventory.add('ancient_lamp', { ql: 30 });
{
  const before = [...birch.traits];
  const whyBirch = lamp.check?.({ kind: 'creature', id: birch.id }, g);
  check('in the browser, a wild one and somebody else\'s are refused in the island\'s words, offer nothing, and the lamp is kept',
    lamp.check?.({ kind: 'creature', id: wild.id }, g) === at('WILD') && whyBirch === at('THEIRS')
      && !lamp.applies({ kind: 'creature', id: wild.id }, g) && !lamp.applies({ kind: 'creature', id: birch.id }, g)
      && lamp.applies(T, g) && count() === 1 && birch.traits.join() === before.join(), `${whyBirch}`);
}

/** Goes in the browser through the action, from a set, and what each did and said. */
function browserGoes(set: string[], n: number, rand: () => number = Math.random): Go[] {
  const was = g.rand;
  g.rand = rand;
  for (let i = 0; i < n; i++) g.inventory.add('ancient_lamp', { ql: 30 });
  const res: Go[] = [];
  for (let i = 0; i < n; i++) {
    ash.traits = [...set];
    const why = use();
    res.push({ i, before: [...set], after: [...ash.traits], told: why ?? g.log[g.log.length - 1]?.text ?? '', lamps: count() });
  }
  g.rand = was;
  return res;
}
{
  const left = count();
  const mixed = browserGoes(SETS.mixed, GOES);
  const tie = browserGoes(SETS.tie, 400);
  const top = browserGoes(SETS.top, 300);
  const none = browserGoes(SETS.none, 60);
  const one = browserGoes(SETS.one, 60);
  const all = [...mixed, ...tie, ...top, ...none, ...one];
  const broken = all.map((g0) => [g0, keeps(g0.before, readGo(g0.before, g0.after, g0.told))] as const).filter(([, why]) => why);
  check(`in the browser, in all ${all.length} goes the lowest slot is rekindled, never lower, a tier above only when it says so, and never a name it carried`,
    broken.length === 0, broken.slice(0, 3).map(([g0, why]) => `${g0.before} -> ${g0.after}: ${why}`).join(' / '));
  check('in the browser, each go says it as the island does and uses up one lamp',
    all.every((g0) => g0.told === lampSays(ash, LAMP, readGo(g0.before, g0.after, g0.told)!)) && count() === left,
    all.find((g0) => g0.told !== lampSays(ash, LAMP, readGo(g0.before, g0.after, g0.told)!))?.told ?? `${count()} left of ${left}`);
  const ups = mixed.filter((g0) => g0.told.includes(', a rarity above ')).length;
  check(`in the browser, ${GOES} goes on a common lowest come up a tier above about one time in ${LAMP_TIER_ODDS}`, inBand(ups), `${ups} of ${GOES}`);
  const slots = new Set(tie.map((g0) => readGo(g0.before, g0.after, g0.told)?.slot));
  check('in the browser, where two share the lowest tier either may go, and the one above them never does', slots.has(0) && slots.has(1) && !slots.has(2), [...slots].join(','));
  check(`in the browser, at ${TOP} it is always another ${TOP} trait, and never says a tier above`,
    top.every((g0) => g0.after.every((t) => traitTier(t) === TOP) && !g0.told.includes('rarity above')), top[0]?.told);
  check('in the browser, one with no traits or one gets one more in an empty slot, common or rare, and keeps what it had',
    none.every((g0) => g0.after.length === 1) && one.every((g0) => g0.after.length === 2 && g0.after[0] === SETS.one[0])
      && [...none, ...one].every((g0) => ['common', 'rare'].includes(traitTier(g0.after[g0.after.length - 1])) && g0.told.includes('to an empty slot')),
    `${none[0]?.told}`);
  const lo = (): number => 0.001;
  const hi = (): number => 0.999;
  const up1 = browserGoes(SETS.mixed, 5, lo);
  const up2 = browserGoes(SETS.high, 5, lo);
  const up3 = browserGoes(SETS.top, 5, lo);
  const up4 = browserGoes(SETS.none, 5, lo);
  const flat = browserGoes(SETS.mixed, 5, hi);
  check('in the browser, with every roll forced low a common lowest comes up rare, a supreme one fantastic, an empty slot rare, and a top one stays top',
    up1.every((g0) => traitTier(g0.after[2]) === 'rare') && up2.every((g0) => traitTier(g0.after[1]) === 'fantastic')
      && up4.every((g0) => traitTier(g0.after[0]) === 'rare') && up3.every((g0) => g0.after.every((t) => traitTier(t) === TOP) && !g0.told.includes('rarity above')),
    `${up1[0]?.told} / ${up3[0]?.told}`);
  check('in the browser, with every roll forced high a common lowest stays common', flat.every((g0) => traitTier(g0.after[2]) === 'common'), flat[0]?.told);
  // The rule itself, with a roll that is the tier-above one exactly at its edge.
  const edge = rekindle(SETS.mixed, (() => { const xs = [0, 1 / LAMP_TIER_ODDS - 1e-9, 0.5, 0]; let k = 0; return () => xs[k++ % xs.length]; })());
  const past = rekindle(SETS.mixed, (() => { const xs = [0, 1 / LAMP_TIER_ODDS, 0.5, 0]; let k = 0; return () => xs[k++ % xs.length]; })());
  check(`a roll just under one in ${LAMP_TIER_ODDS} is a tier above, and one at it is not`, !!edge?.did.up && past?.did.up === false, `${edge?.did.now} ${past?.did.now}`);
}

// A save carries an old lamp across.
{
  const s = Game.create(7);
  s.inventory.addItem({ uid: s.inventory.nextUid++, id: 'old_lamp', ql: 25, dmg: 0, count: 1 });
  const back = await unpack(await packLand(s), packWorld(s));
  check('an old lamp in a save comes back an ancient lamp',
    !!back?.inventory.items.some((it) => it.id === 'ancient_lamp') && !back?.inventory.items.some((it) => it.id === 'old_lamp'),
    back?.inventory.items.map((it) => it.id).join(','));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nan ancient lamp rekindles a trait — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
