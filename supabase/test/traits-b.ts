/**
 * Traits part B: stamina, rest, breeding, care and food.
 *
 * Eight traits on eight new channels. This asks, of both sides:
 *
 *   * that each trait's card is the same words on both (`traitSays`, the island's `trait_says`), and that those are the
 *     channel's figure and label and nothing else; and that every new channel's row is the same (`CHANNELS`,
 *     `channel_def`);
 *   * that each can be rolled at its tier, out of the wild table, on both sides (`rollTrait`, `roll_trait`);
 *   * and that each channel changes its rule by the same number on both, the event caused on the island in a
 *     transaction that is rolled back: a worker's goes before it rests (`tireOf`, `tire_of` in `worker_settle`), its
 *     rest (`restFor`, `rest_of`), a dam's time (`gestationOf`, `gestation_of` in `pair_them`), a second young
 *     (`twinChance`, `twin_chance`), a mutation and a slot drawn from the pair (`pairBlood`, `pair_mutate`,
 *     `pair_fresh` into `breed_traits`, at dice between the odds with the trait and without), the care a brushing
 *     loses (`creature_settle`) and what a meal is worth (`mealQuality`, `meal_ql` in `beast_fed`).
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import {
  CARE_HOURS, FED_CARE, FED_LEARN, fedOn, GESTATION, mealQuality, pairBlood, REST_FOR, restFor, TIRE_GOES, tireOf, twinChance,
  type Creature,
} from '../../src/game/creatures';
import { QL_TOP } from '../../src/game/limits';
import {
  BY_TIER, CHANNELS, inheritChance, keepChance, mutationChance, MUTATION_ODDS, pct, rollTrait, seededRand, traitOf, traitSays,
  type TraitChannel, type TraitDef,
} from '../../src/game/traits';
import { TileType } from '../../src/world/tiles';

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
// The island keeps a trait's figure as a `real`, so its products agree with the browser's to a few parts in ten million.
const near = (a: number, b: number, by = 1e-4): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));

const IDS = ['enduring', 'light_sleeper', 'fertile', 'twin_bearing', 'mutable', 'true_breeding', 'long_memoried', 'iron_stomached'];
const CHS: TraitChannel[] = ['stamina', 'rest', 'gestation', 'twins', 'mutate', 'fresh', 'carefade', 'food'];
const DEF = Object.fromEntries(IDS.map((id) => [id, traitOf(id) as TraitDef]));
const fx = (id: string, ch: TraitChannel): number => DEF[id].effects[ch] as number;
const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(', ')}]::text[]`;
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000b2';
// Dice between the odds with each breeding trait and without it.
const TWIN_AT = (fx('twin_bearing', 'twins') - 1) / 2;
const MUT_AT = (mutationChance(1) + mutationChance(fx('mutable', 'mutate'))) / 2;
const KEEP_AT = (inheritChance(0, 0) + keepChance(0, 0, 0, fx('true_breeding', 'fresh'))) / 2;
const CARE_SECS = 600;
const MEAL_QL = 40;
// Parents with six names between them, so that a slot drawn from the pair always has one left to draw.
const SIRE = ['willing', 'curious', 'careful'];
const DAM = ['fleet', 'thrifty', 'rangy'];

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wurm.dice'), ',');
        n int := coalesce(nullif(current_setting('wurm.dice_n', true), ''), '0')::int;
begin
  perform set_config('wurm.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wurm.dice', v, true);
  perform set_config('wurm.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;

-- Every new channel's row, and every new trait's card.
insert into said select 'CH_' || id, label || '|' || note || '|' || up from channel_def where id = any(${arr(CHS)});
insert into said select 'SAYS_' || id, coalesce(trait_says(id), '') || '|' || tier || '|' || coalesce(family, '-') from trait_def where id = any(${arr(IDS)});
-- What the wild table throws up: at no husbandry, and at the most husbandry and rarity lift there is.
insert into said select 'ROLL_' || r.id, d.tier from (
  select distinct roll_trait('{}'::text[], 0, 0) as id from generate_series(1, 4000)
  union select distinct roll_trait('{}'::text[], 100, 3) from generate_series(1, 4000)) r
  join trait_def d on d.id = r.id where r.id = any(${arr(IDS)});

do $t$
declare w uuid; u uuid := '${U}'; a int; b int; c creature; v_dam int; v_sire int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Blood B', 277, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set body_at = now(), x = ${T} + 0.5, y = ${T} + 0.5, seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Bloodstead', ${T}, ${T}, 10, 5, u);

  -- A forager with no bed about, tired by the rule's own count of goes and by its blood's.
  ${[['PLAIN', [] as string[]], ['ENDURING', ['enduring']], ['SLEEPER', ['light_sleeper']]].map(([k, traits]) => `
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = ${arr(traits as string[])}, rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null,
         skills = jsonb_build_object('foraging', 10), phase = 'idle'
   where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('TIRE_${k}', tire_of(c)::text || ',' || rest_of(c)::text);
  update creature set worn = tire_goes(), phase = 'idle', from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'AT30_${k}', phase || ',' || coalesce(idle_why, '-') || ',' || extract(epoch from until - leg_at) from creature where world_id = w and id = a;
  update creature set worn = tire_of(c), phase = 'idle', carrying = null, from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'ATOWN_${k}', phase || ',' || coalesce(idle_why, '-') || ',' || extract(epoch from until - leg_at) from creature where world_id = w and id = a;
  delete from creature where world_id = w and id = a;`).join('')}

  -- Pairings, each at dice between the odds with the trait and without it.
  ${[
    ['PLAIN', [] as string[], [] as string[], TWIN_AT],
    ['FERTILE', ['fertile'], [], TWIN_AT],
    ['TWINS', ['twin_bearing'], [], TWIN_AT],
    ['TWINSIRE', [], ['twin_bearing'], TWIN_AT],
    ['MUTPLAIN', [], [], MUT_AT],
    ['MUTABLE', [], ['mutable'], MUT_AT],
    ['KEEPPLAIN', [], [], KEEP_AT],
    ['TRUE', ['true_breeding'], [], KEEP_AT],
  ].map(([k, dam, sire, dice]) => `
  v_dam := creature_spawn(w, 'rabba', ${T} + 0.5, ${T} + 1.5, 'active', now() - interval '3 hours', u);
  v_sire := creature_spawn(w, 'rabba', ${T} + 1.5, ${T} + 1.5, 'deed', now() - interval '3 hours', u);
  update creature set sex = 'female', care = 0, rare = null, pedigree = null, boosts = null, form_size = null, form_colour = false,
         traits = ${arr([...(dam as string[]), ...DAM].slice(0, 3))} where world_id = w and id = v_dam;
  update creature set sex = 'male', care = 0, rare = null, pedigree = null, boosts = null, form_size = null, form_colour = false,
         traits = ${arr([...(sire as string[]), ...SIRE].slice(0, 3))} where world_id = w and id = v_sire;
  perform pg_temp.dice('${dice}');
  perform pair_them(w, v_dam, v_sire, 0, u);
  perform pg_temp.nodice();
  insert into said select 'PAIR_${k}', extract(epoch from due - now())::text || '|' || (unborn ? 'twin')::text || '|'
      || (select string_agg(v, ',' order by v) from jsonb_each_text(unborn->'from') e(k, v))
    from creature where world_id = w and id = v_dam;
  select * into c from creature where world_id = w and id = v_dam;
  insert into said select 'BLOOD_${k}', pair_fresh(c, s) || ',' || pair_mutate(c, s) || ',' || twin_chance(0, c) || ',' || gestation_of(1, c)
    from creature s where s.world_id = w and s.id = v_sire;
  delete from creature where world_id = w and id in (v_dam, v_sire);`).join('')}

  -- A brushing wearing off, and a meal of a middling quality, plain and with the trait.
  ${[['PLAIN', [] as string[]], ['LONG', ['long_memoried']], ['IRON', ['iron_stomached']]].map(([k, traits]) => `
  a := creature_spawn(w, 'rabba', ${T + 8} + 0.5, ${T + 8} + 0.5, 'wild', now() - interval '3 hours', null);
  update creature set traits = ${arr(traits as string[])}, rare = null, care = 0.9, hunger = 1, kept = null, boosts = null, form_size = null,
         settled_at = now() - make_interval(secs => ${CARE_SECS}) where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'CARE_${k}', care::text from creature where world_id = w and id = a;
  update creature set mode = 'active', keeper = u, care = 0, fed_until = null, fed_bonus = null where world_id = w and id = a;
  perform beast_fed(w, a, 'stone', ${MEAL_QL});
  select * into c from creature where world_id = w and id = a;
  insert into said values ('MEAL_${k}', c.care::text || ',' || coalesce(c.fed_bonus, 0)::text || ',' || meal_ql(c, ${MEAL_QL}));
  delete from creature where world_id = w and id = a;`).join('')}
end $t$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}
const at = (k: string): string => said.get(k) ?? '(nothing)';

// Every new channel's row, and every trait's card: its figure and its label, the same words on both sides.
for (const ch of CHS) {
  const def = CHANNELS.find((c) => c.id === ch);
  check(`channel ${ch}: the same label, note and direction on both sides`, !!def && at(`CH_${ch}`) === `${def.label}|${def.note}|${def.up}`, at(`CH_${ch}`));
}
for (const id of IDS) {
  const t = DEF[id];
  const want = CHS.filter((ch) => t.effects[ch] !== undefined).map((ch) => `${pct(t.effects[ch] as number)} ${CHANNELS.find((c) => c.id === ch)?.label}`).join(', ');
  check(`${t.name} (${t.tier}): its card is "${want}" on both sides`, traitSays(t) === want && at(`SAYS_${id}`) === `${want}|${t.tier}|-`, `${traitSays(t)} / ${at(`SAYS_${id}`)}`);
}

// Rolled at its tier out of the wild table, on both sides.
const rolled = new Set<string>();
for (const [h, rare] of [[0, 0], [100, 3]]) {
  const rand = seededRand(4242 + h);
  for (let i = 0; i < 8000; i++) {
    const id = rollTrait(rand, [], h, rare);
    if (id) rolled.add(id);
  }
}
for (const id of IDS) {
  const t = DEF[id];
  check(`${t.name}: in the wild table's ${t.tier} row and rolled out of it, on both sides`,
    BY_TIER[t.tier].some((d) => d.id === id) && rolled.has(id) && at(`ROLL_${id}`) === t.tier, `${rolled.has(id)} / ${at(`ROLL_${id}`)}`);
}

// Stamina and rest on the island.
const [tirePlain, restPlain] = at('TIRE_PLAIN').split(',').map(Number);
const [tireEnd] = at('TIRE_ENDURING').split(',').map(Number);
const [, restSleep] = at('TIRE_SLEEPER').split(',').map(Number);
check(`enduring: ${Math.round(TIRE_GOES * fx('enduring', 'stamina'))} goes before it tires on the island, ${TIRE_GOES} without`,
  tirePlain === TIRE_GOES && tireEnd === Math.round(TIRE_GOES * fx('enduring', 'stamina')) && near(restPlain, REST_FOR), at('TIRE_ENDURING'));
check(`and at ${TIRE_GOES} goes a plain worker rests and an enduring one does not; at its own count it does`,
  at('AT30_PLAIN').startsWith('rest,rest,') && !/^(rest|bed),/.test(at('AT30_ENDURING')) && at('ATOWN_ENDURING').startsWith('rest,rest,'),
  `${at('AT30_PLAIN')} / ${at('AT30_ENDURING')} / ${at('ATOWN_ENDURING')}`);
check(`light sleeper: rests ${REST_FOR * fx('light_sleeper', 'rest')} seconds on the island, ${REST_FOR} without`,
  near(restSleep, REST_FOR * fx('light_sleeper', 'rest')) && near(Number(at('AT30_SLEEPER').split(',')[2]), REST_FOR * fx('light_sleeper', 'rest'))
  && near(Number(at('AT30_PLAIN').split(',')[2]), REST_FOR), `${at('AT30_SLEEPER')} / ${at('AT30_PLAIN')}`);

// Pairings on the island.
const pairAt = (k: string): { due: number; twin: boolean; from: string[] } => {
  const [due, twin, from] = at(`PAIR_${k}`).split('|');
  return { due: Number(due), twin: twin === 'true', from: (from ?? '').split(',') };
};
const islandGest = pairAt('PLAIN').due;
check(`fertile: a dam carries ${pct(fx('fertile', 'gestation'))} of the time on the island`,
  near(pairAt('FERTILE').due / islandGest, fx('fertile', 'gestation'), 1e-3), `${pairAt('FERTILE').due} / ${islandGest}`);
check(`twin-bearing: at dice of ${TWIN_AT} a twin-bearing dam throws a second young on the island, a plain one and a twin-bearing sire's dam do not`,
  pairAt('TWINS').twin && !pairAt('PLAIN').twin && !pairAt('TWINSIRE').twin, `${at('PAIR_TWINS')} / ${at('PAIR_PLAIN')} / ${at('PAIR_TWINSIRE')}`);
check(`mutable: at dice of ${MUT_AT} a mutable sire's young is born with a mutation on the island, a plain pair's is not`,
  pairAt('MUTABLE').from.includes('mutation') && !pairAt('MUTPLAIN').from.includes('mutation'), `${at('PAIR_MUTABLE')} / ${at('PAIR_MUTPLAIN')}`);
check(`true-breeding: at dice of ${KEEP_AT} every slot of a true-breeding dam's young is drawn from the pair on the island, a plain pair's none`,
  !pairAt('TRUE').from.includes('roll') && pairAt('KEEPPLAIN').from.every((f) => f === 'roll'), `${at('PAIR_TRUE')} / ${at('PAIR_KEEPPLAIN')}`);

// Care and meals on the island.
const careLoss = (k: string): number => 0.9 - Number(at(`CARE_${k}`));
check(`long-memoried: ${pct(fx('long_memoried', 'carefade'))} care lost over ${CARE_SECS} seconds on the island`,
  near(careLoss('PLAIN'), CARE_SECS / (CARE_HOURS * 3600)) && near(careLoss('LONG'), careLoss('PLAIN') * fx('long_memoried', 'carefade')),
  `${careLoss('LONG')} / ${careLoss('PLAIN')}`);
const meal = (k: string): number[] => at(`MEAL_${k}`).split(',').map(Number);
const ironQl = QL_TOP - (QL_TOP - MEAL_QL) * fx('iron_stomached', 'food');
check(`iron-stomached: a QL ${MEAL_QL} meal counts as QL ${ironQl} on the island, to its care and its learning`,
  near(meal('IRON')[2], ironQl) && near(meal('IRON')[0], FED_CARE * ironQl / QL_TOP) && near(meal('IRON')[1], FED_LEARN * ironQl / QL_TOP)
  && near(meal('PLAIN')[0], FED_CARE * MEAL_QL / QL_TOP), `${at('MEAL_IRON')} / ${at('MEAL_PLAIN')}`);

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(2770);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 12; y <= T + 12; y++) for (let x = T - 12; x <= T + 12; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Bloodstead', x: T, y: T, radius: 10, level: 5, mine: true };
g.crates.clear();
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const spawn = (sp: string, mode: 'deed' | 'active' | 'wild', traits: string[]): Creature => {
  const c = g.creatures.spawn(sp, T + 0.5, T + 0.5, mode, g.rand, g.time - 3600 * 24 * 30);
  Object.assign(c, { traits, rare: 0, care: 0, hunger: 1, stance: 'passive', until: g.time - 1 });
  return c;
};

// Stamina and rest.
for (const [k, traits] of [['PLAIN', []], ['ENDURING', ['enduring']], ['SLEEPER', ['light_sleeper']]] as const) {
  const c = spawn('sedra', 'deed', [...traits]);
  c.skills = { foraging: 10 };
  check(`in the browser, ${k.toLowerCase()}: the same goes before it tires and the same rest as the island`,
    tireOf(c) === Number(at(`TIRE_${k}`).split(',')[0]) && near(restFor(false, c), Number(at(`TIRE_${k}`).split(',')[1])),
    `${tireOf(c)},${restFor(false, c)} / ${at(`TIRE_${k}`)}`);
  c.worn = TIRE_GOES;
  call('updateWorker', c, 0.05, g);
  const rests30 = c.state === 'rest';
  const secs = (c.restUntil ?? g.time) - g.time;
  check(`in the browser, ${k.toLowerCase()} at ${TIRE_GOES} goes: ${at(`AT30_${k}`).startsWith('rest,') ? `rests ${secs} seconds` : 'goes on'}, as on the island`,
    rests30 === at(`AT30_${k}`).startsWith('rest,') && (!rests30 || near(secs, Number(at(`AT30_${k}`).split(',')[2]))), `${c.state} ${secs} / ${at(`AT30_${k}`)}`);
  g.creatures.remove(c.id);
}
{
  const c = spawn('sedra', 'deed', ['enduring']);
  c.skills = { foraging: 10 };
  c.worn = tireOf(c);
  call('updateWorker', c, 0.05, g);
  check('in the browser, an enduring worker at its own count rests, as on the island', c.state === 'rest' && at('ATOWN_ENDURING').startsWith('rest,'), c.state);
  g.creatures.remove(c.id);
}

// Pairings, at the same dice.
for (const [k, damT, sireT, dice] of [
  ['PLAIN', [], [], TWIN_AT], ['FERTILE', ['fertile'], [], TWIN_AT], ['TWINS', ['twin_bearing'], [], TWIN_AT], ['TWINSIRE', [], ['twin_bearing'], TWIN_AT],
  ['MUTPLAIN', [], [], MUT_AT], ['MUTABLE', [], ['mutable'], MUT_AT], ['KEEPPLAIN', [], [], KEEP_AT], ['TRUE', ['true_breeding'], [], KEEP_AT],
] as const) {
  const dam = spawn('rabba', 'active', [...damT, ...DAM].slice(0, 3));
  const sire = spawn('rabba', 'deed', [...sireT, ...SIRE].slice(0, 3));
  Object.assign(dam, { sex: 'female', due: 0, unborn: null });
  Object.assign(sire, { sex: 'male', due: 0 });
  g.rand = () => dice;
  g.creatures.pair(g, dam, sire, 0);
  g.rand = () => 0.5;
  const from = Object.values(dam.unborn?.from ?? {}).sort();
  const isl = pairAt(k);
  const pb = pairBlood(dam, sire);
  const [fresh, mutate, twins, gest] = at(`BLOOD_${k}`).split(',').map(Number);
  check(`in the browser, ${k.toLowerCase()}: the pair's blood, the twin chance and the dam's time are the island's`,
    near(pb.fresh, fresh) && near(pb.mutate, mutate) && near(twinChance(0, dam), twins) && near((dam.due - g.time) / GESTATION, gest / islandGest),
    `${pb.fresh},${pb.mutate},${twinChance(0, dam)},${(dam.due - g.time) / GESTATION} / ${fresh},${mutate},${twins},${gest / islandGest}`);
  // Which of the pair's names a slot draws can differ between the sides; whether it is drawn from them, mutated or doubled cannot.
  const kinds = (xs: string[]): string => ['roll', 'mutation'].map((f) => xs.filter((x) => x === f).length).join(',');
  check(`in the browser, ${k.toLowerCase()} at dice of ${dice}: ${dam.unborn?.twin ? 'twins' : 'one young'}, fresh draws and mutations ${kinds(from)}, as on the island`,
    !!dam.unborn?.twin === isl.twin && kinds(from) === kinds(isl.from), `${!!dam.unborn?.twin} ${from.join(',')} / ${at(`PAIR_${k}`)}`);
  g.creatures.remove(dam.id);
  g.creatures.remove(sire.id);
}
check(`a mutation's chance with a mutable parent is ${mutationChance(fx('mutable', 'mutate'))}, 1 in ${MUTATION_ODDS} without`,
  mutationChance(1) === 1 / MUTATION_ODDS && near(mutationChance(fx('mutable', 'mutate')), fx('mutable', 'mutate') / MUTATION_ODDS));

// Care and meals.
for (const k of ['PLAIN', 'LONG', 'IRON'] as const) {
  const traits = k === 'LONG' ? ['long_memoried'] : k === 'IRON' ? ['iron_stomached'] : [];
  const c = spawn('rabba', 'wild', traits);
  c.care = 0.9;
  call('body', g, c, CARE_SECS);
  check(`in the browser, ${k.toLowerCase()}: the care left after ${CARE_SECS} seconds is the island's`, near(c.care, Number(at(`CARE_${k}`))), `${c.care} / ${at(`CARE_${k}`)}`);
  c.mode = 'active';
  c.care = 0;
  c.fedUntil = undefined;
  c.fedBonus = undefined;
  fedOn(c, 'stone', MEAL_QL, g.time);
  const [care, bonus, ql] = meal(k);
  check(`in the browser, ${k.toLowerCase()}: a QL ${MEAL_QL} meal counts and is worth what it is on the island`,
    near(mealQuality(c, MEAL_QL), ql) && near(c.care, care) && near(c.fedBonus ?? 0, bonus), `${mealQuality(c, MEAL_QL)},${c.care},${c.fedBonus} / ${at(`MEAL_${k}`)}`);
  g.creatures.remove(c.id);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`traits part B — ${ok.length} of ${ok.length}`);
